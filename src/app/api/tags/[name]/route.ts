import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { slugifyTagKey } from "@/lib/tag-utils";

export const runtime = "nodejs";

export async function DELETE(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (!(await isAdminServer())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name: rawName } = await params;
  const key = slugifyTagKey(decodeURIComponent(rawName));
  if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

  await prisma.tag.delete({ where: { key } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
