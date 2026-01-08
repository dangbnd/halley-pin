import { NextResponse } from "next/server";
import { setAdminCookie } from "@/lib/admin-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `admin:login:${ip}`, limit: 8, windowMs: 5 * 60 * 1000 });
  if (!rl.allowed) {
    const r = NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    r.headers.set("Cache-Control", "no-store, max-age=0");
    r.headers.set("Retry-After", String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return r;
  }

  const body = await req.json().catch(() => null);
  const password = String(body?.password ?? "");
  const expect = process.env.ADMIN_PASSWORD ?? "";

  if (!expect || password !== expect) {
    const r = NextResponse.json({ error: "Invalid password" }, { status: 401 });
    r.headers.set("Cache-Control", "no-store, max-age=0");
    return r;
  }

  await setAdminCookie();
  const r = NextResponse.json({ ok: true });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  return r;
}
