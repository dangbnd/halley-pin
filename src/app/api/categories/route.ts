import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isAdminServer } from "@/lib/admin-auth";
import { getCategoriesServer } from "@/lib/categories.server";

export const runtime = "nodejs";

function json(data: unknown, init?: ResponseInit, isAdmin?: boolean) {
  const res = NextResponse.json(data, init);
  if (isAdmin) {
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    res.headers.set("Vary", "Cookie");
  } else {
    // Public category list is safe to cache a bit.
    res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  }
  return res;
}

function normalizeKey(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

function isValidKey(key: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key);
}

export async function GET(req: Request) {
  const isAdmin = await isAdminServer();
  const { searchParams } = new URL(req.url);
  const all = searchParams.get("all") === "1";

  const rows = await getCategoriesServer({ activeOnly: !(isAdmin && all) });
  return json(rows, undefined, isAdmin);
}

export async function POST(req: Request) {
  const isAdmin = await isAdminServer();
  if (!isAdmin) return json({ error: "Unauthorized" }, { status: 401 }, isAdmin);

  const body = await req.json().catch(() => null);
  const rawKey = typeof body?.key === "string" ? body.key : "";
  const key = normalizeKey(rawKey);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const order = Number.isFinite(body?.order) ? Number(body.order) : 0;
  const isActive = body?.isActive === undefined ? true : Boolean(body.isActive);

  if (!key || !label) return json({ error: "Missing key/label" }, { status: 400 }, isAdmin);
  if (!isValidKey(key)) return json({ error: "Invalid key format" }, { status: 400 }, isAdmin);
  if (key === "admin") return json({ error: "Reserved key" }, { status: 400 }, isAdmin);

  try {
    const created = await prisma.category.create({
      data: { key, label, order, isActive },
      select: { key: true, label: true, order: true, isActive: true },
    });
    return json(created, { status: 201 }, isAdmin);
  } catch (e: any) {
    // Unique constraint etc.
    return json({ error: "Create failed" }, { status: 400 }, isAdmin);
  }
}
