import { NextResponse } from "next/server";
import { runJobsOnce } from "@/lib/jobs";
import { isAdminServer } from "@/lib/admin-auth";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

async function isAllowed(_req: Request) {
  // Admin-only: rely on signed HttpOnly cookie.
  return await isAdminServer();
}

// Trigger from cron or manually.
// Optional query: ?limit=3
export async function POST(req: Request) {
  if (!(await isAllowed(req))) return unauthorized();
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "3") || 3;
  const r = await runJobsOnce(Math.min(Math.max(limit, 1), 20));
  const res = NextResponse.json(r);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}
