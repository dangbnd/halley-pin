import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { computeFinalCategory } from "@/lib/category";
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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAllowed(req))) return unauthorized();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const next = body?.userCategory;

  const userCategoryRaw = typeof next === "string" ? next : "";
  const userCategory = userCategoryRaw.trim() || null;

  const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim() : null;
  const adminNotePublic = Boolean(body?.adminNotePublic);

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.photo.findUnique({ where: { id } });
    if (!current) return null;

    const finalCategory = computeFinalCategory({ aiCategory: current.aiCategory, userCategory });

    return tx.photo.update({
      where: { id },
      data: { userCategory, finalCategory, adminNote, adminNotePublic },
    });
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const r = NextResponse.json({
    id: updated.id,
    userCategory: updated.userCategory,
    finalCategory: updated.finalCategory,
    adminNote: updated.adminNote ?? null,
    adminNotePublic: updated.adminNotePublic,
  });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await isAllowed(req))) return unauthorized();

  const url = new URL(req.url);
  const dbOnly = url.searchParams.get("dbOnly") === "1";

  const photo = await prisma.photo.findUnique({ where: { id } });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!dbOnly) {
    const keys = [photo.displayKey, photo.thumbKey, ...(photo.originalKey ? [photo.originalKey] : [])].filter(Boolean);
    await deleteR2Keys(keys);
  }

  await prisma.photo.delete({ where: { id: photo.id } });

  // Cleanup orphan tags (nice-to-have)
  const orphans = await prisma.tag.findMany({ where: { photos: { none: {} } }, select: { id: true } });
  if (orphans.length) {
    await prisma.tag.deleteMany({ where: { id: { in: orphans.map((t) => t.id) } } });
  }

  const r = NextResponse.json({ ok: true });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}
