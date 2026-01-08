import crypto from "crypto";
import { cookies } from "next/headers";

/**
 * Very small "single admin account" auth:
 * - Login endpoint sets a signed, HttpOnly cookie.
 * - UI and admin-only APIs check this cookie.
 *
 * Env:
 * - ADMIN_PASSWORD (single password)
 * - ADMIN_COOKIE_SECRET (long random secret)
 */
const COOKIE_NAME = "pg_admin";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.ADMIN_COOKIE_SECRET;
  if (!s) throw new Error("Missing ADMIN_COOKIE_SECRET");
  return s;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  // Avoid timing leaks (tiny, but free to fix).
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function makeAdminCookieValue() {
  const ts = Date.now().toString();
  const payload = `1.${ts}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifyAdminCookie(value?: string | null) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [flag, ts, sig] = parts;
  if (flag !== "1") return false;

  const payload = `${flag}.${ts}`;
  const expected = sign(payload);
  if (!safeEqual(expected, sig)) return false;

  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MAX_AGE_SEC * 1000) return false;
  return true;
}

// NOTE: In Next.js 15+ (including 16.x), cookies() is async and returns a Promise.
// Calling cookies().get(...) will throw "get is not a function".
export async function isAdminServer() {
  const store = await cookies();
  const c = store.get(COOKIE_NAME)?.value;
  return verifyAdminCookie(c);
}

export async function setAdminCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, makeAdminCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearAdminCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
