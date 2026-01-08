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

/**
 * POST /api/photos/delete-all
 * Admin-only: requires signed HttpOnly admin cookie.
 * Extra safety: body.confirm must equal "DELETE" to avoid accidental nukes.
 */
export async function POST(req: Request) {
  if (!(await isAdminServer())) return unauthorized();

  const body = await req.json().catch(() => null);
  const confirm = String(body?.confirm ?? "");
  if (confirm !== "DELETE") {
    const r = NextResponse.json({ error: "Confirm required" }, { status: 400 });
    r.headers.set("Cache-Control", "no-store, max-age=0");
    r.headers.set("Vary", "Cookie");
    return r;
  }

  const photos = await prisma.photo.findMany({
    select: { displayKey: true, thumbKey: true, originalKey: true },
  });

  const keys = photos
    .flatMap((p) => [p.displayKey, p.thumbKey, p.originalKey].filter(Boolean))
    .map(String);

  await deleteR2Keys(keys);

  await prisma.photo.deleteMany({});
  await prisma.tag.deleteMany({ where: { photos: { none: {} } } });

  const r = NextResponse.json({ ok: true, deleted: photos.length });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}
