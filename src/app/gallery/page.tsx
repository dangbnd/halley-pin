import { SiteHeader } from "@/components/layout/site-header";
import { GalleryClient } from "./gallery-client";
import { isAdminServer } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { r2PublicUrl } from "@/lib/r2-url";
import type { Photo } from "@/lib/photos";
import { slugifyTagKey } from "@/lib/tag-utils";

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

export default async function GalleryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const isAdmin = await isAdminServer();
  if (isAdmin) redirect("/admin/gallery");

   const sp = (await searchParams) ?? {};

  const get1 = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const q = (get1(sp.q) ?? "").trim();
  const tag = (get1(sp.tag) ?? "").trim();
  const category = (get1(sp.category) ?? "").trim();
  const cursorRaw = (get1(sp.cursor) ?? "").trim();
  const limit = Math.min(Math.max(Number(get1(sp.limit) ?? "30") || 30, 1), 60);

  const and: any[] = [{ active: true }];

  if (category) and.push({ finalCategory: category });

  if (tag) {
    const t = slugifyTagKey(tag);
    if (t) and.push({ tags: { some: { key: t } } });
  }

  if (q) {
    // Keep it light for TTFB: common fields only.
    // (Client fetch uses richer logic for deeper matching.)
    const qTrim = q.trim();
    const qAsTag = slugifyTagKey(qTrim);
    and.push({
      OR: [
        { title: { contains: qTrim } },
        { finalCategory: { contains: qTrim } },
        { tags: { some: { label: { contains: qTrim } } } },
        ...(qAsTag ? [{ tags: { some: { key: { contains: qAsTag } } } }] : []),
      ],
    });
  }

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
    select: {
      id: true,
      createdAt: true,
      displayKey: true,
      thumbKey: true,
      width: true,
      height: true,
      title: true,
      finalCategory: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && page.length
      ? encodeCursor({ id: page[page.length - 1].id, createdAt: page[page.length - 1].createdAt.toISOString() })
      : null;

  const initialItems: Photo[] = page.map((p) => ({
    id: p.id,
    src: r2PublicUrl(p.displayKey),
    thumbSrc: r2PublicUrl(p.thumbKey),
    width: p.width,
    height: p.height,
    title: p.title,
    tags: [],
    blurDataURL: undefined,
    aiCategory: null,
    aiConfidence: 0,
    userCategory: null,
    finalCategory: p.finalCategory,
    classifyStatus: null,
    classifyError: null,
  }));

  const initialKey = `${q}||${tag}||${category}`;
  return (
    <div className="grain min-h-screen">
      <SiteHeader initialIsAdmin={isAdmin} />
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <GalleryClient
          isAdmin={isAdmin}
          basePath=""
          initialItems={initialItems}
          initialCursor={nextCursor}
          initialHasMore={hasMore}
          initialKey={initialKey}
          initialLimit={limit}
        />
      </main>
    </div>
  );
}
