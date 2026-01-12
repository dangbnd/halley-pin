import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { DEFAULT_BLUR } from "@/lib/photos";
import { blurDataUrlFromKey } from "@/lib/blur";
import { r2PublicUrl } from "@/lib/r2-url";
import { keyToLabelFallback, parseTagsInput, slugifyTagKey } from "@/lib/tag-utils";
import { enqueueClassificationJob } from "@/lib/jobs";
import { computeFinalCategory } from "@/lib/category";
import { getCategoriesServer } from "@/lib/categories.server";
import { deleteR2Key, getR2ObjectBuffer, putR2Object } from "@/lib/r2";

export const runtime = "nodejs";

async function isAllowed(_req: Request) {
  // Admin-only: rely on the signed HttpOnly cookie.
  return await isAdminServer();
}

function json(data: unknown, init?: ResponseInit, isAdmin?: boolean) {
  const res = NextResponse.json(data, init);

  if (isAdmin) {
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    res.headers.set("Vary", "Cookie");
  } else {
    // soft caching for gallery list; safe for public view.
    res.headers.set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60");
  }

  return res;
}

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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cursorRaw = (searchParams.get("cursor") ?? "").trim();
  const q = (searchParams.get("q") ?? "").trim();
  const tag = (searchParams.get("tag") ?? "").trim();
  const category = (searchParams.get("category") ?? "").trim();
  const wantBlur = (searchParams.get("blur") ?? "").trim() === "1";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? "60") || 60, 1), 100);

  const isAdmin = await isAdminServer();

  // Dynamic categories (admin-editable) for search matching.
  // Only needed when searching by free-text.
  let categoriesAll: Awaited<ReturnType<typeof getCategoriesServer>> = [];
  if (q) {
    categoriesAll = await getCategoriesServer({ activeOnly: !isAdmin });
  }

  // Build filters as AND blocks to avoid clobbering OR conditions (we need OR for both search & cursor).
  const and: any[] = [];

  // Public gallery should only show active items.
  if (!isAdmin) and.push({ active: true });

  // ✅ SQLite-safe search (no `mode: "insensitive"`)
  if (q) {
    const qTrim = q.trim();
    const qLower = qTrim.toLowerCase();
    const qAsTag = slugifyTagKey(qTrim);

    const matchedCategoryKeys = categoriesAll.filter((c) => {
      const k = c.key.toLowerCase();
      const lbl = c.label.toLowerCase();
      return k.includes(qLower) || lbl.includes(qLower) || (qAsTag && k.includes(qAsTag));
    }).map((c) => c.key);

    const searchOR: any[] = [
      { title: { contains: qTrim } },
      // admin-only fields should never be queryable by guests
      ...(isAdmin ? [{ adminNote: { contains: qTrim } }] : []),
      ...(isAdmin ? [{ aiCategory: { contains: qTrim } }] : []),
      ...(isAdmin ? [{ userCategory: { contains: qTrim } }] : []),
      // allow searching by category key/label
      ...(matchedCategoryKeys.length ? [{ finalCategory: { in: matchedCategoryKeys } }] : []),
      { finalCategory: { contains: qTrim } },
      // tags: support spaces by also checking kebab-case
      { tags: { some: { label: { contains: qTrim } } } },
      ...(qAsTag ? [{ tags: { some: { key: { contains: qAsTag } } } }] : []),
    ];

    and.push({ OR: searchOR });
  }

  if (category) and.push({ finalCategory: category });

  if (tag) {
    const t = slugifyTagKey(tag);
    if (t) and.push({ tags: { some: { key: t } } });
  }

  // ✅ Keyset pagination
  const cursor = cursorRaw ? decodeCursor(cursorRaw) : null;
  if (cursor) {
    const createdAt = new Date(cursor.createdAt);
    and.push({ OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: cursor.id } }] });
  }

  const where: any = and.length ? { AND: and } : {};

  // Keep public list as light as possible for speed.
  // Admin list needs tags/job/status for management UI.
  const rows = await prisma.photo.findMany(
    isAdmin
      ? {
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit + 1,
          include: {
            tags: { select: { key: true, label: true } },
            job: { select: { status: true, lastError: true } },
          },
        }
      : {
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
        }
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && page.length
      ? encodeCursor({ id: page[page.length - 1].id, createdAt: page[page.length - 1].createdAt.toISOString() })
      : null;

  return json(
    {
      items: page.map((p) => ({
        id: p.id,
        src: r2PublicUrl(p.displayKey),
        thumbSrc: r2PublicUrl(p.thumbKey),
        width: p.width,
        height: p.height,
        title: p.title,
        tags: isAdmin ? (p as any).tags.map((t: any) => t.label || keyToLabelFallback(t.key)) : [],
        blurDataURL: wantBlur ? (blurDataUrlFromKey(p.displayKey) ?? DEFAULT_BLUR) : undefined,

        // Internal signals are admin-only
        aiCategory: isAdmin ? (p as any).aiCategory : null,
        aiConfidence: isAdmin ? (p as any).aiConfidence : 0,
        userCategory: isAdmin ? (p as any).userCategory : null,
        finalCategory: p.finalCategory,
        classifyStatus: isAdmin ? ((p as any).job?.status ?? null) : null,
        classifyError: isAdmin ? ((p as any).job?.lastError ?? null) : null,
      })),
      nextCursor,
    },
    undefined,
    isAdmin
  );
}

function stripExt(key: string) {
  const lastSlash = key.lastIndexOf("/");
  const base = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return key;
  return key.slice(0, key.length - (base.length - dot));
}

async function processImageFromIncoming(originalKey: string) {
  const buf = await getR2ObjectBuffer(originalKey);

  const baseNoExt = stripExt(originalKey).replace(/^incoming\//, "");
  const prefix = `photos/${baseNoExt}`;
  const displayKey = `${prefix}/full.webp`;
  const thumbKey = `${prefix}/thumb.webp`;

  const sharp = (await import("sharp")).default;
  const img = sharp(buf, { failOnError: false }).rotate();

  const fullBuf = await img
    .clone()
    .resize({ width: 2200, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const meta = await sharp(fullBuf).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) throw new Error("Cannot read image metadata");

  const thumbBuf = await img
    .clone()
    .resize({ width: 720, withoutEnlargement: true })
    .webp({ quality: 74 })
    .toBuffer();

  await putR2Object(displayKey, fullBuf, {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  });

  await putR2Object(thumbKey, thumbBuf, {
    contentType: "image/webp",
    cacheControl: "public, max-age=31536000, immutable",
  });

  const keepOriginal = (process.env.KEEP_ORIGINAL ?? "").trim().toLowerCase() === "true";
  let storedOriginalKey: string | null = null;

  if (keepOriginal) {
    const origKey = `${prefix}/original`;
    await putR2Object(origKey, buf, {
      contentType: "application/octet-stream",
      cacheControl: "private, max-age=0",
    });
    storedOriginalKey = origKey;
  }

  // Delete incoming temp object to avoid leaking unprocessed originals.
  await deleteR2Key(originalKey);

  return { displayKey, thumbKey, originalKey: storedOriginalKey, width, height };
}

export async function POST(req: Request) {
  if (!(await isAllowed(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const { originalKey, title = "Untitled", tags = [] } = body ?? {};

  if (!originalKey || typeof originalKey !== "string") {
    return NextResponse.json({ error: "Missing originalKey" }, { status: 400 });
  }

  const parsed = parseTagsInput(tags);

  const processed = await processImageFromIncoming(String(originalKey));

  const created = await prisma.$transaction(async (tx) => {
    const photo = await tx.photo.create({
      data: {
        originalKey: processed.originalKey,
        displayKey: processed.displayKey,
        thumbKey: processed.thumbKey,
        width: processed.width,
        height: processed.height,
        title: String(title),
        aiCategory: null,
        aiConfidence: 0,
        userCategory: null,
        finalCategory: computeFinalCategory({ aiCategory: null, userCategory: null }),
        tags: {
          connectOrCreate: parsed.slice(0, 20).map((t) => ({
            where: { key: t.key },
            create: { key: t.key, label: t.label || keyToLabelFallback(t.key) },
          })),
        },
      },
    });
    return photo;
  });

  // enqueue classification (idempotent)
  await enqueueClassificationJob(created.id);
  const r = NextResponse.json({ id: created.id });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}
