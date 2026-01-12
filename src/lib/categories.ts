export type CategoryItem = {
  key: string;
  label: string;
  order: number;
  isActive: boolean;
};

// Default set used for first-run seeding + client fallback.
export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { key: "uncategorized", label: "Chưa phân loại", order: 0, isActive: true },
  { key: "banh-ve", label: "Bánh vẽ", order: 10, isActive: true },
  { key: "bong-lan-trung-muoi", label: "Bông lan trứng muối", order: 20, isActive: true },
  { key: "banh-hoa-qua", label: "Bánh hoa quả", order: 30, isActive: true },
  { key: "banh-hoa", label: "Bánh hoa", order: 40, isActive: true },
  { key: "banh-kem", label: "Bánh kem", order: 50, isActive: true },
  { key: "khac", label: "Khác", order: 60, isActive: true },
];

export function isValidCategoryKey(key: string) {
  // slug-ish: lowercase letters, numbers, dash
  return /^[a-z0-9-]+$/.test(key);
}

/**
 * Client helper: fetch categories (active-only) from the server.
 * Falls back to DEFAULT_CATEGORIES if request fails.
 */
let _activeCategoriesPromise: Promise<CategoryItem[]> | null = null;

export async function fetchActiveCategoriesClient(): Promise<CategoryItem[]> {
  // Dedupe requests (important in dev/StrictMode where effects run twice)
  if (_activeCategoriesPromise) return _activeCategoriesPromise;

  _activeCategoriesPromise = (async () => {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    if (Array.isArray(data)) return data as CategoryItem[];
    if (Array.isArray((data as any)?.categories)) return (data as any).categories as CategoryItem[];
    return DEFAULT_CATEGORIES;
  })().catch(() => {
    // allow retry after failure
    _activeCategoriesPromise = null;
    return DEFAULT_CATEGORIES;
  });

  return _activeCategoriesPromise;
}
