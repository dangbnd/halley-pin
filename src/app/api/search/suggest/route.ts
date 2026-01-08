import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BLUR, CATEGORIES } from "@/lib/photos";
import { blurDataUrlFromKey } from "@/lib/blur";
import { r2PublicUrl } from "@/lib/r2-url";
import { normalizeTagName } from "@/lib/tags";
import { isAdminServer } from "@/lib/admin-auth";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit, isAdmin?: boolean) {
  const res = NextResponse.json(data, init);

  if (isAdmin) {
    // Never allow CDN to cache admin-scoped results.
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    res.headers.set("Vary", "Cookie");
  } else {
    // tiny caching: suggestions are driven by user typing, keep it short.
    res.headers.set("Cache-Control", "public, s-maxage=5, stale-while-revalidate=30");
  }

  return res;
}

function buildSearchWhere(qRaw: string, isAdmin: boolean) {
  const q = qRaw.trim();
  if (!q) return {};

  const qLower = q.toLowerCase();
  const qAsTag = normalizeTagName(q);

  const matchedCategoryKeys = CATEGORIES.filter((c) => {
    const k = c.key.toLowerCase();
    const lbl = c.label.toLowerCase();
    return k.includes(qLower) || lbl.includes(qLower) || (qAsTag && k.includes(qAsTag));
  }).map((c) => c.key);

  const OR: any[] = [
    { title: { contains: q } },
    ...(isAdmin ? [{ adminNote: { contains: q } }] : []),
    ...(isAdmin ? [{ aiCategory: { contains: q } }] : []),
    ...(isAdmin ? [{ userCategory: { contains: q } }] : []),
    ...(matchedCategoryKeys.length ? [{ finalCategory: { in: matchedCategoryKeys } }] : []),
    { finalCategory: { contains: q } },
    { tags: { some: { name: { contains: q } } } },
    ...(qAsTag ? [{ tags: { some: { name: { contains: qAsTag } } } }] : []),
  ];

  return { OR };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "6") || 6, 1), 60);

  const isAdmin = await isAdminServer();

  // If query is empty, keep it cheap.
  if (!q) {
    return json({ q: "", photos: [], categories: [], tags: [], hasMorePhotos: false }, undefined, isAdmin);
  }

  const where = buildSearchWhere(q, isAdmin);

  const [photosRaw, grouped] = await Promise.all([
    prisma.photo.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { tags: { select: { name: true } } },
    }),
    prisma.photo.groupBy({
      by: ["finalCategory"],
      where,
      _count: { _all: true },
    }),
  ]);

  const hasMorePhotos = photosRaw.length > limit;
  const photos = hasMorePhotos ? photosRaw.slice(0, limit) : photosRaw;

  // lightweight tag facet from the returned photos
  const tagCount = new Map<string, number>();
  for (const p of photos) {
    for (const t of p.tags ?? []) {
      const name = t.name;
      tagCount.set(name, (tagCount.get(name) ?? 0) + 1);
    }
  }
  const tags = !isAdmin
    ? []
    : Array.from(tagCount.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12);

  const catLabel = new Map(CATEGORIES.map((c) => [c.key, c.label] as const));
  const categories = !isAdmin
    ? []
    : grouped
        .map((g) => ({
          key: g.finalCategory,
          label: catLabel.get(g.finalCategory) ?? g.finalCategory,
          count: g._count._all,
        }))
        .sort((a, b) => b.count - a.count);

  // Guests should not receive tag/category facets or per-photo tags in suggestions.
  const outTags = isAdmin ? tags : [];
  const outCategories = isAdmin ? categories : [];

  return json({
    q,
    hasMorePhotos,
    photos: photos.map((p) => ({
      id: p.id,
      title: p.title,
      thumbSrc: r2PublicUrl(p.thumbKey),
      blurDataURL: blurDataUrlFromKey(p.displayKey) ?? DEFAULT_BLUR,
      finalCategory: p.finalCategory,
      tags: isAdmin ? p.tags.map((t) => t.name).slice(0, 6) : [],
    })),
    categories: outCategories,
    tags: outTags,
  }, undefined, isAdmin);
}