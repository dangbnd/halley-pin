import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  // admin-only endpoints
  res.headers.set("Cache-Control", "private, no-store, max-age=0");
  res.headers.set("Vary", "Cookie");
  return res;
}

function normalizeKey(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

function isValidKey(key: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const isAdmin = await isAdminServer();
  if (!isAdmin) return json({ error: "Unauthorized" }, { status: 401 });

  const { key: rawKey } = await ctx.params;
  const oldKey = normalizeKey(rawKey);
  const body = await req.json().catch(() => null);

  const nextKeyRaw = typeof body?.key === "string" ? body.key : oldKey;
  const nextKey = normalizeKey(nextKeyRaw);
  const label = typeof body?.label === "string" ? body.label.trim() : undefined;
  const order = body?.order === undefined ? undefined : Number(body.order);
  const isActive = body?.isActive === undefined ? undefined : Boolean(body.isActive);

  if (!oldKey) return json({ error: "Invalid key" }, { status: 400 });
  if (!nextKey) return json({ error: "Invalid key" }, { status: 400 });
  if (!isValidKey(nextKey)) return json({ error: "Invalid key format" }, { status: 400 });
  if (oldKey === "uncategorized" && nextKey !== "uncategorized") {
    return json({ error: "Reserved category" }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const cat = await tx.category.update({
        where: { key: oldKey },
        data: {
          key: nextKey,
          ...(label !== undefined ? { label } : {}),
          ...(Number.isFinite(order) ? { order: order as number } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
        select: { key: true, label: true, order: true, isActive: true },
      });

      if (oldKey !== nextKey) {
        await tx.photo.updateMany({ where: { userCategory: oldKey }, data: { userCategory: nextKey } });
        await tx.photo.updateMany({ where: { finalCategory: oldKey }, data: { finalCategory: nextKey } });
        await tx.photo.updateMany({ where: { aiCategory: oldKey }, data: { aiCategory: nextKey } });
      }

      return cat;
    });

    return json(updated);
  } catch {
    return json({ error: "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const isAdmin = await isAdminServer();
  if (!isAdmin) return json({ error: "Unauthorized" }, { status: 401 });

  const { key: rawKey } = await ctx.params;
  const key = normalizeKey(rawKey);
  if (!key) return json({ error: "Invalid key" }, { status: 400 });
  if (key === "uncategorized") return json({ error: "Reserved category" }, { status: 400 });

  try {
    await prisma.$transaction(async (tx) => {
      // Remove manual overrides and reset final category back to uncategorized.
      await tx.photo.updateMany({ where: { userCategory: key }, data: { userCategory: null } });
      await tx.photo.updateMany({ where: { finalCategory: key }, data: { finalCategory: "uncategorized" } });
      await tx.photo.updateMany({ where: { aiCategory: key }, data: { aiCategory: null } });

      await tx.category.delete({ where: { key } });
    });

    return json({ ok: true });
  } catch {
    return json({ error: "Delete failed" }, { status: 400 });
  }
}
