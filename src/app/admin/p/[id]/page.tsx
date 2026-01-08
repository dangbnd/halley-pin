import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SiteHeader } from "@/components/layout/site-header";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BLUR } from "@/lib/photos";
import { blurDataUrlFromKey } from "@/lib/blur";
import { r2PublicUrl } from "@/lib/r2-url";
import { isAdminServer } from "@/lib/admin-auth";
import { CATEGORIES } from "@/lib/photos";

import { CakeInfoClient } from "@/app/p/[id]/cake-info-client";
import { RelatedMasonryClient } from "@/app/p/[id]/related-masonry";
import { ArrowLeft } from "lucide-react";

export const runtime = "nodejs";

export default async function AdminPinDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminServer())) redirect("/admin");

  const { id } = await params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: {
      tags: { select: { name: true } },
      job: { select: { status: true, lastError: true } },
    },
  });

  if (!photo) notFound();

  const relatedRaw = await prisma.photo.findMany({
    where: {
      id: { not: photo.id },
      finalCategory: photo.finalCategory,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      tags: { select: { name: true } },
      job: { select: { status: true, lastError: true } },
    },
  });

  const catLabel = CATEGORIES.find((c) => c.key === photo.finalCategory)?.label ?? photo.finalCategory;

  const related = relatedRaw.map((p) => ({
    id: p.id,
    src: r2PublicUrl(p.displayKey),
    thumbSrc: r2PublicUrl(p.thumbKey),
    width: p.width,
    height: p.height,
    title: p.title,
    tags: p.tags.map((t) => t.name),
    blurDataURL: blurDataUrlFromKey(p.displayKey) ?? DEFAULT_BLUR,
    aiCategory: p.aiCategory,
    aiConfidence: p.aiConfidence,
    userCategory: p.userCategory,
    finalCategory: p.finalCategory,
    classifyStatus: p.job?.status ?? null,
    classifyError: p.job?.lastError ?? null,
  }));

  return (
    <div className="grain min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Detail card */}
        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_420px]">
            {/* LEFT: image block (bo 4 góc) */}
            <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-100 md:max-w-[780px] md:justify-self-center">
              <Link
                href="/admin/gallery"
                className="absolute left-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/10 hover:bg-white"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5 text-zinc-900" />
              </Link>

              <div className="relative w-full aspect-[4/5]">
                <Image
                  src={r2PublicUrl(photo.displayKey)}
                  alt={photo.title}
                  fill
                  priority
                  placeholder="blur"
                  blurDataURL={blurDataUrlFromKey(photo.displayKey) ?? DEFAULT_BLUR}
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 55vw"
                />
              </div>
            </div>

            {/* RIGHT: minimal info */}
            <div className="min-w-0 py-1">
              {/* One clean row: title left, category right */}
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h1 className="min-w-0 truncate text-2xl font-semibold text-zinc-900">{photo.title}</h1>
                <div className="shrink-0 inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 ring-1 ring-black/5">
                  {catLabel}
                </div>
              </div>

              <CakeInfoClient
                photoId={photo.id}
                isAdmin
                initial={{
                  userCategory: photo.userCategory,
                  finalCategory: photo.finalCategory,
                  adminNote: photo.adminNote ?? "",
                  adminNotePublic: photo.adminNotePublic ?? false,
                }}
              />
            </div>
          </div>
        </section>

        {/* Related */}
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between">
            <div className="text-sm font-semibold text-zinc-900">Gợi ý cùng chủ đề</div>
            <div className="text-xs text-zinc-500">{related.length} ảnh</div>
          </div>

          {related.length ? (
            <RelatedMasonryClient photos={related} basePath="/admin" />
          ) : (
            <div className="text-sm text-zinc-500">Chưa có ảnh liên quan.</div>
          )}
        </section>
      </main>
    </div>
  );
}
