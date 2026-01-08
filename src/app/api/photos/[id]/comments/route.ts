import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  const r = NextResponse.json(data, init);
  // Comments are user-generated; don't let proxies cache.
  r.headers.set("Cache-Control", "no-store, max-age=0");
  return r;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const exists = await prisma.photo.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return json({ error: "Not found" }, { status: 404 });

  const items = await prisma.comment.findMany({
    where: { photoId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return json({
    items: items.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `comments:post:${ip}`, limit: 10, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    const r = json({ error: "Bạn gửi quá nhanh. Vui lòng thử lại sau." }, { status: 429 });
    r.headers.set("Retry-After", String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return r;
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const authorName = String(body?.authorName ?? "Ẩn danh").trim().slice(0, 50) || "Ẩn danh";
  const content = String(body?.content ?? "").trim().slice(0, 1000);

  if (!content) return json({ error: "Nội dung bình luận không được rỗng." }, { status: 400 });

  const exists = await prisma.photo.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return json({ error: "Not found" }, { status: 404 });

  const created = await prisma.comment.create({
    data: {
      photoId: id,
      authorName,
      content,
    },
  });

  return json(
    {
      item: {
        id: created.id,
        authorName: created.authorName,
        content: created.content,
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
