import "server-only";

// ⚠️ In-memory rate limit.
// Works fine for single-instance / dev.
// In serverless or multi-instance deployments, replace this with Redis/Upstash/etc.

type Entry = { resetAt: number; count: number };

const STORE = new Map<string, Entry>();
const MAX_KEYS = 5000;

function now() {
  return Date.now();
}

function prune() {
  if (STORE.size <= MAX_KEYS) return;
  const t = now();
  for (const [k, v] of STORE) {
    if (v.resetAt <= t) STORE.delete(k);
    if (STORE.size <= MAX_KEYS) return;
  }
  // Still too big: nuke oldest-ish (Map preserves insertion order).
  const toDrop = Math.ceil(STORE.size - MAX_KEYS);
  for (let i = 0; i < toDrop; i++) {
    const first = STORE.keys().next();
    if (first.done) break;
    STORE.delete(first.value);
  }
}

export function getClientIp(req: Request) {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return "unknown";
}

export function rateLimit({
  key,
  limit,
  windowMs,
}: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  prune();
  const t = now();
  const cur = STORE.get(key);
  if (!cur || cur.resetAt <= t) {
    const resetAt = t + windowMs;
    STORE.set(key, { resetAt, count: 1 });
    return { allowed: true, remaining: Math.max(limit - 1, 0), resetAt };
  }

  if (cur.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: cur.resetAt };
  }

  cur.count++;
  STORE.set(key, cur);
  return { allowed: true, remaining: Math.max(limit - cur.count, 0), resetAt: cur.resetAt };
}
