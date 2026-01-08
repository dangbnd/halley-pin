// Deterministic (per-image) lightweight blur placeholder.
// No extra network calls, no DB migrations, works in both server & client.

function fnv1a32(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    // h *= 16777619 (with 32-bit overflow)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

function toHexColor(n: number) {
  const r = (n & 0xff0000) >> 16;
  const g = (n & 0x00ff00) >> 8;
  const b = n & 0x0000ff;

  // Lift toward light UI (avoid overly dark placeholders)
  const lift = (x: number) => Math.min(240, Math.max(40, Math.round(x * 0.6 + 90)));
  const rr = lift(r).toString(16).padStart(2, "0");
  const gg = lift(g).toString(16).padStart(2, "0");
  const bb = lift(b).toString(16).padStart(2, "0");
  return `#${rr}${gg}${bb}`;
}

function base64EncodeUtf8(s: string) {
  // Buffer is available on server; browser uses btoa.
  const B = (globalThis as any).Buffer;
  if (B) return B.from(s, "utf8").toString("base64");
  // eslint-disable-next-line no-undef
  return btoa(unescape(encodeURIComponent(s)));
}

export function blurDataUrlFromKey(key: string) {
  const h1 = fnv1a32(key);
  const h2 = fnv1a32(key + "::2");
  const c1 = toHexColor(h1);
  const c2 = toHexColor(h2);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="10" viewBox="0 0 16 10">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="16" height="10" fill="url(#g)"/>
</svg>`;

  return `data:image/svg+xml;base64,${base64EncodeUtf8(svg)}`;
}
