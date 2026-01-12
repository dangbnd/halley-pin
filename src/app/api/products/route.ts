import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { r2PublicUrl } from "@/lib/r2-url";
import { keyToLabelFallback, slugifyTagKey } from "@/lib/tag-utils";

export const runtime = "nodejs";

/**
 * Cursor helpers:
 * - Cursor is base64url JSON: { id, createdAt }
 * - Avoids dup/skip when ordering by createdAt desc + id desc.
 */
type Cursor = { id: string; createdAt: string };

function encodeCursor(c: Cursor) {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const txt = Buffer.from(raw, "base64url").toString("utf8");
    const obj = JSON.parse(txt);
    if (!obj?.id || !obj?.createdAt) return null;
    return { id: String(obj.id), createdAt: String(obj.createdAt) };
  } catch {
    return null;
  }
}

function unauthorized() {
  const r = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}

export async function GET(req: Request) {
  if (!(await isAdminServer())) return unauthorized();

  const { searchParams } = new URL(req.url);
  const cursorRaw = (searchParams.get("cursor") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();
  const tag = (searchParams.get("tag") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();
  const active = (searchParams.get("active") ?? "").trim();

  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "80") || 80, 1), 200);

  const and: any[] = [];

  if (q) {
    const qTrim = q.trim();
    const qAsTag = slugifyTagKey(qTrim);

    and.push({
      OR: [
        { title: { contains: qTrim } },
        { id: { contains: qTrim } },
        { finalCategory: { contains: qTrim } },
        { userCategory: { contains: qTrim } },
        { tags: { some: { label: { contains: qTrim } } } },
        ...(qAsTag ? [{ tags: { some: { key: { contains: qAsTag } } } }] : []),
      ],
    });
  }

  if (category) and.push({ finalCategory: category });

  if (tag) {
    const t = slugifyTagKey(tag);
    if (t) and.push({ tags: { some: { key: t } } });
  }

  if (active === "true") and.push({ active: true });
  if (active === "false") and.push({ active: false });

  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursor) {
    const createdAt = new Date(cursor.createdAt);
    and.push({ OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }] });
  }

  const where: any = and.length ? { AND: and } : {};

  const rows = await prisma.photo.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { tags: { select: { key: true, label: true } } },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && page.length
      ? encodeCursor({ id: page[page.length - 1].id, createdAt: page[page.length - 1].createdAt.toISOString() })
      : null;

  const r = NextResponse.json({
    items: page.map((p) => ({
      id: p.id,
      active: p.active,
      thumbSrc: r2PublicUrl(p.thumbKey),
      name: p.title,
      userCategory: p.userCategory,
      finalCategory: p.finalCategory,
      priceBySize: p.priceBySize ?? "",
      priceVisibility: p.priceVisibility,
      description: p.description ?? "",
      descriptionVisibility: p.descriptionVisibility,
      tags: p.tags.map((t: any) => t.label || keyToLabelFallback(t.key)),
      createdAt: p.createdAt,
    })),
    nextCursor,
  });

  r.headers.set("Cache-Control", "private, no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}
