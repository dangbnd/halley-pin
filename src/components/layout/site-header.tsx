"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Camera, Plus, Images, LogOut, Shield, MoreVertical, Check, Folder, Tag, LayoutGrid } from "lucide-react";
import Image from "next/image";

import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import type { CategoryItem } from "@/lib/categories";
import { useCategories, useEnsureCategoriesLoaded } from "@/components/providers/categories-provider";

function isActive(pathname: string, href: string) {
  // Treat pin detail pages as part of Gallery for active state (both public and /admin).
  if (href.endsWith("/gallery")) {
    const base = href.slice(0, -"/gallery".length); // "" or "/admin"
    const detailPrefix = `${base}/p/`;
    if (pathname.startsWith(detailPrefix)) return true;
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteHeader({ initialIsAdmin = false }: { initialIsAdmin?: boolean } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const basePath = isAdminArea ? "/admin" : "";
  const galleryHref = `${basePath}/gallery`;

  // Treat pin detail pages as part of gallery UX (search + category/tag popover should still work).
  const isGalleryLike = pathname.startsWith(galleryHref) || pathname.startsWith(`${basePath}/p/`);

  const qFromUrl = sp.get("q") ?? "";
  const categoryFromUrl = sp.get("category") ?? "";
  const tagFromUrl = sp.get("tag") ?? "";
  const [q, setQ] = useState(qFromUrl);
  const tRef = useRef<number | null>(null);

  const [suggestLoading, setSuggestLoading] = useState(false);
  const categories = useCategories();
  const ensureCategoriesLoaded = useEnsureCategoriesLoaded();
const [suggestPhotos, setSuggestPhotos] = useState<
    { id: string; title: string; thumbSrc: string; blurDataURL: string; finalCategory: string; tags: string[] }[]
  >([]);
  const [suggestCats, setSuggestCats] = useState<{ key: string; label: string; count: number }[]>([]);
  const [suggestTags, setSuggestTags] = useState<{ key: string; label: string; count: number }[]>([]);

  const INITIAL_SUGGEST_LIMIT = 6;
  const SUGGEST_STEP = 12;
  const MAX_SUGGEST = 60;
  const [suggestLimit, setSuggestLimit] = useState(INITIAL_SUGGEST_LIMIT);
  const [suggestHasMorePhotos, setSuggestHasMorePhotos] = useState(false);

  const [isAdmin, setIsAdmin] = useState(Boolean(initialIsAdmin));

  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setQ(qFromUrl), [qFromUrl]);

  useEffect(() => {
    if (!isGalleryLike) setFiltersOpen(false);
  }, [isGalleryLike]);

  // Load categories lazily for best first-paint on public pages.
  useEffect(() => {
    if (!filtersOpen) return;
    void ensureCategoriesLoaded();
  }, [filtersOpen, ensureCategoriesLoaded]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const el = searchWrapRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setFiltersOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function goSearch(next: string) {
    const params = new URLSearchParams(sp.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    // Keep current filters; drop cursor
    params.delete("cursor");
    const qs = params.toString();
    router.replace(qs ? `${galleryHref}?${qs}` : galleryHref);
  }

  function setCategory(nextCat: string | null) {
    const params = new URLSearchParams(sp.toString());
    const trimmedQ = (q ?? "").trim();
    if (trimmedQ) params.set("q", trimmedQ);
    else params.delete("q");
    if (nextCat) params.set("category", nextCat);
    else params.delete("category");
    params.delete("tag");
    params.delete("cursor");
    const qs = params.toString();
    router.replace(qs ? `${galleryHref}?${qs}` : galleryHref);
    setFiltersOpen(false);
  }

  function setTag(nextTag: string | null) {
    const params = new URLSearchParams(sp.toString());
    const trimmedQ = (q ?? "").trim();
    if (trimmedQ) params.set("q", trimmedQ);
    else params.delete("q");
    if (nextTag) params.set("tag", nextTag);
    else params.delete("tag");
    params.delete("cursor");
    const qs = params.toString();
    router.replace(qs ? `${galleryHref}?${qs}` : galleryHref);
    setFiltersOpen(false);
  }

  function onChange(next: string) {
    setQ(next);
    setSuggestLimit(INITIAL_SUGGEST_LIMIT);
    setSuggestHasMorePhotos(false);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => goSearch(next), 250);
  }

  // Live suggestions: photos + category counts + tags, based on what's typed.
  useEffect(() => {
    if (!filtersOpen) return;
    if (!isGalleryLike) return;

    const qq = (q ?? "").trim();
    if (!qq) {
      setSuggestLoading(false);
      setSuggestPhotos([]);
      setSuggestCats([]);
      setSuggestTags([]);
      setSuggestHasMorePhotos(false);
      return;
    }

    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setSuggestLoading(true);
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(qq)}&limit=${suggestLimit}`, {
          signal: ctrl.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        setSuggestPhotos(Array.isArray(data?.photos) ? data.photos : []);
        setSuggestCats(Array.isArray(data?.categories) ? data.categories : []);
        setSuggestTags(Array.isArray(data?.tags) ? data.tags : []);
        setSuggestHasMorePhotos(Boolean(data?.hasMorePhotos));
      } catch {
        // ignore abort/errors
      } finally {
        setSuggestLoading(false);
      }
    }, 120);

    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q, suggestLimit, filtersOpen, pathname, isGalleryLike]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    setIsAdmin(false);
    // If user is in /admin area, drop them back to public gallery for clarity.
    if (isAdminArea) router.replace("/gallery");
    else router.refresh();
  }

  const nav = useMemo(
    () => [
      { href: `${basePath}/gallery`, label: "Gallery", icon: Images, adminOnly: false },
      { href: `${basePath}/products`, label: "Products", icon: LayoutGrid, adminOnly: true },
      { href: `${basePath}/upload`, label: "Upload", icon: Plus, adminOnly: true },
      { href: `${basePath}/categories`, label: "Categories", icon: Folder, adminOnly: true },
      { href: `${basePath}/tags`, label: "Tags", icon: Tag, adminOnly: true },
    ],
    [basePath]
  );

  const menuItems: ActionMenuItem[] = useMemo(() => {
    // Guests should not see admin entry points in the UI.
    if (!isAdmin) return [];

    const items: ActionMenuItem[] = nav
      .filter((n) => (n.adminOnly ? isAdmin : true))
      .map((n) => {
        const act = isActive(pathname, n.href);
        return {
          type: "link",
          href: n.href,
          label: act ? `Đang ở đây: ${n.label}` : n.label,
          icon: act ? Check : n.icon,
        } as ActionMenuItem;
      });

    items.push({ type: "separator" });
    items.push({ type: "action", label: "Logout", icon: LogOut, danger: true, onClick: logout });
    return items;
  }, [nav, isAdmin, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href={galleryHref} className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#e60023] text-white shadow-sm">
            <Camera className="h-5 w-5" />
          </span>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-zinc-900 leading-5">Photo Gallery</div>
            <div className="text-xs text-zinc-500 leading-4">pinterest-style feed</div>
          </div>
        </Link>

        {isAdmin && isAdminArea ? (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 ring-1 ring-black/5">
            <Shield className="h-3.5 w-3.5" /> Admin
          </span>
        ) : null}

        {/* Search */}
        <div className="relative flex-1" ref={searchWrapRef}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goSearch(q);
            }}
          >
            <input
              value={q}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => {
                if (isGalleryLike) setFiltersOpen(true);
              }}
              placeholder="Tìm kiếm"
              className="h-10 w-full rounded-full border border-zinc-200 bg-white px-4 text-sm outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-black/15"
            />
          </form>

          {isGalleryLike && filtersOpen ? (
            <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl border border-zinc-200 bg-white p-3 shadow-lg">
              {/* Results */}
              {(q ?? "").trim() ? (
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-zinc-500">Kết quả</div>
                    {suggestLoading ? <div className="text-[11px] text-zinc-400">đang tìm…</div> : null}
                  </div>

                  {suggestPhotos.length ? (
                    <>
                      <div className="mt-2 grid gap-1">
                        {suggestPhotos.map((p) => {
                          const catLbl = categories.find((c) => c.key === p.finalCategory)?.label ?? p.finalCategory;
                          return (
                            <Link
                              key={p.id}
                              href={`${basePath}/p/${p.id}`}
                              onClick={() => setFiltersOpen(false)}
                              className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-zinc-50"
                            >
                              <div className="relative h-10 w-10 overflow-hidden rounded-lg ring-1 ring-black/5">
                                <Image
                                  src={p.thumbSrc}
                                  alt={p.title}
                                  fill
                                  sizes="40px"
                                  placeholder="blur"
                                  blurDataURL={p.blurDataURL}
                                  className="object-cover"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm text-zinc-900">{p.title || "(no title)"}</div>
                                <div className="truncate text-xs text-zinc-500">
                                  {catLbl}
                                  {isAdmin && p.tags?.length ? ` · ${p.tags.slice(0, 3).join(", ")}` : ""}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>

                      {suggestHasMorePhotos ? (
                        <button
                          type="button"
                          onClick={() => setSuggestLimit((v) => Math.min(v + SUGGEST_STEP, MAX_SUGGEST))}
                          disabled={suggestLoading || suggestLimit >= MAX_SUGGEST}
                          className="mt-1 w-full rounded-xl px-2 py-2 text-left text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Xem thêm…
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-500">Không có ảnh phù hợp.</div>
                  )}
                </div>
              ) : null}

              {/* Tags (admin only) */}
              {isAdmin && (q ?? "").trim() && suggestTags.length ? (
                <div className="mb-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-zinc-500">Tags</div>
                    {tagFromUrl ? (
                      <button
                        type="button"
                        onClick={() => setTag(null)}
                        className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-200"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suggestTags.map((t) => {
                      const act = tagFromUrl === t.key;
                      return (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setTag(act ? null : t.key)}
                          className={
                            "whitespace-nowrap rounded-full px-3 py-1.5 text-xs ring-1 ring-black/5 transition " +
                            (act ? "bg-zinc-900 text-white" : "bg-white text-zinc-800 hover:bg-zinc-50")
                          }
                        >
                          #{t.label}
                          <span
                            className={
                              "ml-2 rounded-full px-2 py-0.5 text-[10px] " + (act ? "bg-white/15" : "bg-zinc-100")
                            }
                          >
                            {t.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Categories */}
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-500">Category</div>
                {categoryFromUrl ? (
                  <button
                    type="button"
                    onClick={() => setCategory(null)}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-200"
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {(() => {
                  const qq = (q ?? "").trim();
                  const base = qq ? suggestCats : categories.map((c) => ({ key: c.key, label: c.label, count: 0 }));

                  // Keep active category visible even if 0 matches.
                  const actKey = categoryFromUrl || "";
                  if (qq && actKey && !base.some((c) => c.key === actKey)) {
                    const lbl = categories.find((c) => c.key === actKey)?.label ?? actKey;
                    base.unshift({ key: actKey, label: lbl, count: 0 });
                  }

                  return base;
                })().map((c) => {
                  const act = categoryFromUrl === c.key;
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(act ? null : c.key)}
                      className={
                        "whitespace-nowrap rounded-full px-3 py-1.5 text-xs ring-1 ring-black/5 transition " +
                        (act ? "bg-zinc-900 text-white" : "bg-white text-zinc-800 hover:bg-zinc-50")
                      }
                    >
                      {c.label}
                      {(q ?? "").trim() ? (
                        <span
                          className={
                            "ml-2 rounded-full px-2 py-0.5 text-[10px] " + (act ? "bg-white/15" : "bg-zinc-100")
                          }
                        >
                          {c.count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Actions menu (admin only). Guests shouldn't see admin entry points. */}
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <ActionMenu
              openOnHover
              items={menuItems}
              trigger={
                <span className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50">
                  <MoreVertical className="h-5 w-5" />
                </span>
              }
            />
          </div>
        ) : null}
      </div>
    </header>
  );
}
