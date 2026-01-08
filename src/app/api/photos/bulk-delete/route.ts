import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { deleteR2Keys } from "@/lib/r2";

export const runtime = "nodejs";

function unauthorized() {
  const r = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}

async function isAllowed(_req: Request) {
  return await isAdminServer();
}

/**
 * POST /api/photos/bulk-delete
 * body: { ids: string[], dbOnly?: boolean }
 */
export async function POST(req: Request) {
  if (!(await isAllowed(req))) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown; dbOnly?: unknown };
  const ids: string[] = Array.isArray(body.ids)
    ? Array.from(new Set(body.ids.map((v) => String(v)).filter((s) => s.length > 0)))
    : [];
  const dbOnly = body.dbOnly === true;

  if (ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  const photos = await prisma.photo.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayKey: true, thumbKey: true, originalKey: true },
  });

  if (!dbOnly) {
    const keys = photos
      .flatMap((p) => [p.displayKey, p.thumbKey, p.originalKey].filter(Boolean))
      .map(String);
    await deleteR2Keys(keys);
  }

  await prisma.photo.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } });

  // Cleanup orphan tags
  const orphans = await prisma.tag.findMany({ where: { photos: { none: {} } }, select: { id: true } });
  if (orphans.length) {
    await prisma.tag.deleteMany({ where: { id: { in: orphans.map((t) => t.id) } } });
  }

  const r = NextResponse.json({ ok: true, deleted: photos.length });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}
