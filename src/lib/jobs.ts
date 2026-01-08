import "server-only";

import { prisma } from "@/lib/prisma";
import { classifyImage } from "@/lib/classify";
import { computeFinalCategory } from "@/lib/category";
import { connectTagsToPhoto } from "@/lib/tags";
import { r2PublicUrl } from "@/lib/r2-url";

const POLL_INTERVAL_MS = Number(process.env.JOBS_POLL_INTERVAL_MS ?? "2000") || 2000;
const MAX_ATTEMPTS = Number(process.env.JOBS_MAX_ATTEMPTS ?? "3") || 3;
const LOCK_TTL_MS = Number(process.env.JOBS_LOCK_TTL_MS ?? "900000") || 900000; // 15m

export { POLL_INTERVAL_MS, MAX_ATTEMPTS };

export async function enqueueClassificationJob(photoId: string) {
  // one job per photo
  await prisma.classificationJob.upsert({
    where: { photoId },
    create: { photoId, status: "queued" },
    update: { status: "queued", lastError: null, lockedAt: null },
  });
}

export type RunJobsResult = {
  processed: number;
  done: number;
  requeued: number;
  failed: number;
};

export async function runJobsOnce(limit = 1): Promise<RunJobsResult> {
  // Recover stuck jobs (e.g. worker crashed mid-run).
  await prisma.classificationJob.updateMany({
    where: {
      status: "processing",
      lockedAt: {
        lt: new Date(Date.now() - LOCK_TTL_MS),
      },
    },
    data: { status: "queued", lockedAt: null },
  });

  let processed = 0, done = 0, requeued = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    const ok = await processOneJob();
    if (!ok) break;
    processed++;
    if (ok === "done") done++;
    if (ok === "failed") failed++;
    if (ok === "requeued") requeued++;
  }
  return { processed, done, requeued, failed };
}

async function processOneJob(): Promise<false | "done" | "requeued" | "failed"> {
  // claim a queued job atomically
  const job = await prisma.classificationJob.findFirst({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
  });
  if (!job) return false;

  const claimed = await prisma.classificationJob.updateMany({
    where: { id: job.id, status: "queued" },
    data: { status: "processing", lockedAt: new Date() },
  });
  if (claimed.count !== 1) return false;

  const withPhoto = await prisma.classificationJob.findUnique({
    where: { id: job.id },
    include: { photo: true },
  });
  if (!withPhoto) return false;

  try {
    const url = r2PublicUrl(withPhoto.photo.displayKey);
    if (!url) throw new Error("Missing NEXT_PUBLIC_R2_PUBLIC_BASE_URL (or R2_PUBLIC_BASE_URL)");

    const r = await classifyImage(url);

    const aiCategory = r.category === "unknown" ? null : r.category;
    const aiConfidence = r.confidence ?? 0;

    // Update photo + finalCategory in ONE transaction
    await prisma.$transaction(async (tx) => {
      const current = await tx.photo.findUnique({ where: { id: withPhoto.photoId } });
      if (!current) return;

      const nextFinal = computeFinalCategory({ aiCategory, userCategory: current.userCategory });

      await tx.photo.update({
        where: { id: current.id },
        data: {
          aiCategory,
          aiConfidence,
          finalCategory: nextFinal,
        },
      });
    });

    if (r.tags?.length) {
      // tags are optional; do it outside transaction to avoid long locks
      await connectTagsToPhoto(withPhoto.photoId, r.tags);
    }

    await prisma.classificationJob.update({
      where: { id: withPhoto.id },
      data: { status: "done", lastError: null, lockedAt: null },
    });

    return "done";
  } catch (e: any) {
    const attempts = job.attempts + 1;
    const isFinalFail = attempts >= MAX_ATTEMPTS;

    await prisma.classificationJob.update({
      where: { id: job.id },
      data: {
        attempts,
        lastError: String(e?.message ?? e ?? "Unknown error"),
        status: isFinalFail ? "failed" : "queued",
        lockedAt: null,
      },
    });

    return isFinalFail ? "failed" : "requeued";
  }
}
