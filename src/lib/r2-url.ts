function getBase(): string {
  const base = (
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    process.env.R2_PUBLIC_BASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!base) {
    throw new Error("Missing NEXT_PUBLIC_R2_PUBLIC_BASE_URL (or R2_PUBLIC_BASE_URL)");
  }
  return base;
}

export function r2PublicUrl(key: string) {
  const base = getBase();
  if (!key || !key.trim()) throw new Error("Missing R2 object key");

  // keys may contain slashes; encode per segment so we don't encode '/'
  const encoded = key
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");

  return `${base}/${encoded}`;
}
