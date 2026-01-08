import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/admin-auth";

export async function POST() {
  await clearAdminCookie();
  const r = NextResponse.json({ ok: true });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  return r;
}
