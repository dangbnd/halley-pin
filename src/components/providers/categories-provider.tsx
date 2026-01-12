"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_CATEGORIES, fetchActiveCategoriesClient, type CategoryItem } from "@/lib/categories";

type Ctx = {
  categories: CategoryItem[];
  /** Ensure categories have been loaded at least once (deduped). */
  ensureLoaded: () => Promise<void>;
  /** Force refresh categories from server. */
  refresh: () => Promise<void>;
};

const CategoriesContext = createContext<Ctx | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const loadedRef = useRef(false);
  const pathname = usePathname();

  async function ensureLoaded() {
    if (loadedRef.current) return;
    const cats = await fetchActiveCategoriesClient();
    setCategories(cats);
    loadedRef.current = true;
  }

  async function refresh() {
    const cats = await fetchActiveCategoriesClient();
    setCategories(cats);
    loadedRef.current = true;
  }

  useEffect(() => {
    // Eager load only in admin area (admin pages edit categories / need labels).
    // Public gallery should be first-paint optimized: load categories lazily when user opens filters.
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      ensureLoaded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const value = useMemo(() => ({ categories, ensureLoaded, refresh }), [categories]);

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  return ctx?.categories ?? DEFAULT_CATEGORIES;
}

export function useEnsureCategoriesLoaded() {
  const ctx = useContext(CategoriesContext);
  return ctx?.ensureLoaded ?? (async () => {});
}
