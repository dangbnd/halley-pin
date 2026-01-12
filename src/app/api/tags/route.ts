import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { keyToLabelFallback, normalizeTagLabel, slugifyTagKey } from "@/lib/tag-utils";

export const runtime = "nodejs";

export async function GET() {
  if (!(await isAdminServer())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({
    orderBy: { order: "asc" },
    include: { _count: { select: { photos: true } } },
  });

  return NextResponse.json(
    tags.map((t) => ({
      key: t.key,
      label: t.label || keyToLabelFallback(t.key),
      count: t._count.photos,
      createdAt: t.createdAt,
      order: t.order,
      isActive: t.isActive,
    }))
  );
}

export async function POST(req: Request) {
  if (!(await isAdminServer())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const rawLabel = typeof body?.label === "string" ? body.label : (typeof body?.name === "string" ? body.name : "");
  const label = normalizeTagLabel(rawLabel);
  const key = slugifyTagKey(label);
  if (!key) return NextResponse.json({ error: "Missing label" }, { status: 400 });

  const tag = await prisma.tag.upsert({
    where: { key },
    create: { key, label: label || keyToLabelFallback(key) },
    update: label ? { label } : {},
  });

  return NextResponse.json({ key: tag.key, label: tag.label || keyToLabelFallback(tag.key), createdAt: tag.createdAt });
}
