/**
 * Tag helpers.
 *
 * ✅ Option A:
 * - Store a stable `key` (slug: no accents, lowercase, hyphen-separated)
 * - Display a human-readable `label` (can contain Vietnamese + spaces)
 *
 * Admin inputs tags as a text list like Google Sheet:
 *   "100k, basic, lấy ngay, sale"
 */

export type TagInput = { key: string; label: string };

export function normalizeTagLabel(input: string) {
  // Keep Vietnamese and casing as-is; only normalize whitespace.
  return input
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Convert a Vietnamese label to a stable slug key.
 * Example: "lấy ngay" -> "lay-ngay"
 */
export function slugifyTagKey(label: string) {
  let s = normalizeTagLabel(label);
  if (!s) return "";

  // Normalize to NFD and strip diacritics.
  s = s.normalize("NFD");
  s = s.replace(/[\u0300-\u036f]/g, "");
  // Vietnamese đ/Đ
  s = s.replace(/đ/g, "d").replace(/Đ/g, "d");

  s = s
    .toLowerCase()
    // Replace non-alphanumeric with spaces
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    // Spaces -> hyphen
    .replace(/\s+/g, "-")
    // Collapse multiple hyphens
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");

  return s;
}

export function keyToLabelFallback(key: string) {
  return String(key ?? "").replace(/-/g, " ");
}

/**
 * Parse tags input from UI.
 * - Accepts string (comma/newline separated) or array of strings
 * - Returns unique tags by `key` with the first seen label.
 */
export function parseTagsInput(input: unknown): TagInput[] {
  const raw: string[] = Array.isArray(input)
    ? input.filter((x): x is string => typeof x === "string")
    : typeof input === "string"
      ? input.split(/[\n,]/g)
      : [];

  const out: TagInput[] = [];
  const seen = new Set<string>();

  for (const part of raw) {
    const label = normalizeTagLabel(part);
    if (!label) continue;
    const key = slugifyTagKey(label);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label });
  }

  return out;
}

export function tagsToText(tags: string[]) {
  return (tags ?? []).map((t) => String(t).trim()).filter(Boolean).join(", ");
}
