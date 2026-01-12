import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { computeFinalCategory } from "@/lib/category";
import { deleteR2Keys } from "@/lib/r2";
import { keyToLabelFallback, parseTagsInput } from "@/lib/tag-utils";

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

  // Product fields (admin-only)
  const title = typeof body?.title === "string" ? body.title.trim() : null;
  const active = typeof body?.active === "boolean" ? body.active : null;

  const priceBySize = typeof body?.priceBySize === "string" ? body.priceBySize : null;
  const description = typeof body?.description === "string" ? body.description : null;

  const priceVisibility = body?.priceVisibility === "public" || body?.priceVisibility === "private" ? body.priceVisibility : null;
  const descriptionVisibility =
    body?.descriptionVisibility === "public" || body?.descriptionVisibility === "private" ? body.descriptionVisibility : null;

  // Tags can be provided as comma-separated string or string[] (labels).
  const tags = body && ("tags" in body) ? parseTagsInput((body as any).tags) : null;

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.photo.findUnique({ where: { id } });
    if (!current) return null;

    const finalCategory = computeFinalCategory({ aiCategory: current.aiCategory, userCategory });

    const nextPhoto = await tx.photo.update({
      where: { id },
      data: {
        userCategory,
        finalCategory,
        adminNote,
        adminNotePublic,
        ...(title !== null ? { title } : {}),
        ...(active !== null ? { active } : {}),
        ...(priceBySize !== null ? { priceBySize } : {}),
        ...(priceVisibility !== null ? { priceVisibility } : {}),
        ...(description !== null ? { description } : {}),
        ...(descriptionVisibility !== null ? { descriptionVisibility } : {}),
      },
    });

    // Replace tags if provided.
    if (tags) {
      for (const t of tags) {
        await tx.tag.upsert({
          where: { key: t.key },
          create: { key: t.key, label: t.label || keyToLabelFallback(t.key) },
          // If label changed, keep the latest non-empty label.
          update: t.label ? { label: t.label } : {},
        });
      }
      await tx.photo.update({
        where: { id },
        data: { tags: { set: tags.map((t) => ({ key: t.key })) } },
      });
    }

    return nextPhoto;
  });

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const r = NextResponse.json({
    id: updated.id,
    title: updated.title,
    active: (updated as any).active,
    userCategory: updated.userCategory,
    finalCategory: updated.finalCategory,
    adminNote: updated.adminNote ?? null,
    adminNotePublic: updated.adminNotePublic,
    priceBySize: (updated as any).priceBySize ?? null,
    priceVisibility: (updated as any).priceVisibility ?? null,
    description: (updated as any).description ?? null,
    descriptionVisibility: (updated as any).descriptionVisibility ?? null,
    // return tag labels so client can keep local state in sync
    tags: tags ? tags.map((t) => t.label || keyToLabelFallback(t.key)) : undefined,
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
