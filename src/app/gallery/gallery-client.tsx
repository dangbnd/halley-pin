"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PhotoCard } from "@/components/photo/photo-card";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import type { Photo } from "@/lib/photos";
import { Trash2, CheckSquare, Square, MoreVertical } from "lucide-react";

type ApiResp = { items: Photo[]; nextCursor: string | null };
// ✅ Cache list để back ra không bị reset -> đỡ nháy
let GALLERY_CACHE: {
  key: string;
  items: Photo[];
  cursor: string | null;
  hasMore: boolean;
} | null = null;

// Responsive columns, nhưng vẫn giữ “4 cột desktop” như Pinterest
function useColumns() {
  const [cols, setCols] = useState(2);

  // useLayoutEffect để giảm “nhảy cột” (set trước khi paint)
  useLayoutEffect(() => {
    let raf = 0;

    const calc = () => {
      const w = window.innerWidth;
      if (w < 640) return 2;
      if (w < 1024) return 3;
      return 4; // desktop cố định 4 cột
    };

    const apply = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = calc();
        setCols((prev) => (prev === next ? prev : next));
      });
    };

    apply();
    window.addEventListener("resize", apply);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", apply);
    };
  }, []);

  return cols;
}

// “Pattern height” dễ chỉnh. Đổi dãy số là đổi vibe ngay.
// Giữ pattern desktop như hiện tại. Mobile/tablet cũng dùng pattern để ảnh nhìn “lệch” giống desktop.
const SPANS_DESKTOP = [15, 21, 17, 23, 16, 22];
const SPANS_TABLET = [13, 18, 14, 19, 15, 17]; // 3 cột: bớt cao để đỡ nặng mắt
const SPANS_MOBILE = [10, 12, 11, 9, 13, 8]; // 2 cột: cao hơn chút để ra vibe “Pinterest”

function hashString(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function spanForCols(photoId: string, index: number, cols: number) {
  const h = hashString(photoId) + index * 7;
  if (cols >= 4) return SPANS_DESKTOP[h % SPANS_DESKTOP.length];
  if (cols === 3) return SPANS_TABLET[h % SPANS_TABLET.length];
  return SPANS_MOBILE[h % SPANS_MOBILE.length];
}



export function GalleryClient({
  isAdmin = false,
  basePath = "",
  initialItems,
  initialCursor,
  initialHasMore,
  initialKey = "",
  initialLimit = 30,
}: {
  isAdmin?: boolean;
  /** When rendered under /admin, pass basePath="/admin" so detail links stay in admin area. */
  basePath?: string;
  /** Server-rendered first page for best first-paint. */
  initialItems?: Photo[];
  initialCursor?: string | null;
  initialHasMore?: boolean;
  /** Filter key (q|tag|category) that `initialItems` corresponds to. */
  initialKey?: string;
  /** Initial page size. Smaller = faster first paint. */
  initialLimit?: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const q = (sp.get("q") ?? "").trim();
  const tagParam = (sp.get("tag") ?? "").trim();
  const catParam = (sp.get("category") ?? "").trim();

  const tag = tagParam || null;
  const category = catParam || null;
  const cacheKey = `${isAdmin ? "admin" : "public"}||${q}||${tag ?? ""}||${category ?? ""}`;

  const initialProvided = typeof initialItems !== "undefined";

  const [items, setItems] = useState<Photo[]>(() =>
    GALLERY_CACHE?.key === cacheKey ? GALLERY_CACHE.items : (initialItems ?? [])
  );

  const [cursor, setCursor] = useState<string | null>(() =>
    GALLERY_CACHE?.key === cacheKey ? GALLERY_CACHE.cursor : (initialCursor ?? null)
  );

  const [hasMore, setHasMore] = useState<boolean>(() =>
    GALLERY_CACHE?.key === cacheKey
      ? GALLERY_CACHE.hasMore
      : (typeof initialHasMore === "boolean" ? initialHasMore : Boolean(initialCursor))
  );

  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);
  const didInitRef = useRef(false);


  // Selection (bulk delete)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedCount = selected.size;

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const clearSelected = () => setSelected(new Set());
  const selectAllLoaded = () => setSelected(new Set(items.map((p) => p.id)));

  const PAGE_LIMIT = initialLimit;

  async function loadMore(reset = false) {
    if (loading) return;
    if (inFlightRef.current) return;
    if (!hasMore && !reset) return;

    inFlightRef.current = true;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_LIMIT));
      if (!reset && cursor) params.set("cursor", cursor);
      if (q) params.set("q", q);
      if (tag) params.set("tag", tag);
      if (category) params.set("category", category);

      const res = await fetch(`/api/photos?${params.toString()}`, isAdmin ? { cache: "no-store" } : undefined);
      const data = (await res.json()) as ApiResp;

      setItems((prev) => {
        if (reset) return data.items ?? [];
        const seen = new Set(prev.map((x) => x.id));
        const out = [...prev];
        for (const it of data.items ?? []) {
          if (!seen.has(it.id)) out.push(it);
        }
        return out;
      });

      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor) && (data.items?.length ?? 0) > 0);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  const filterKey = `${q}||${tag ?? ""}||${category ?? ""}`;
  useEffect(() => {
    GALLERY_CACHE = { key: cacheKey, items, cursor, hasMore };
  }, [cacheKey, items, cursor, hasMore]);

  // Reload when filters/search change (light debounce)
  useEffect(() => {
    const firstRun = !didInitRef.current;
    // On first mount, if we have server-rendered data matching current filters,
    // skip the initial client fetch for best first paint.
    if (firstRun) {
      didInitRef.current = true;
      const initialMatches = initialProvided && initialKey === filterKey;
      if (initialMatches) return;
    }

    const t = window.setTimeout(() => {
      clearSelected();
      setCursor(null);
      setHasMore(true);
      loadMore(true);
    }, firstRun ? 0 : 180);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // Infinite scroll trigger (masonry-friendly)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!hasMore || loading) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore(false);
      },
      // Smaller rootMargin to avoid immediately fetching page 2 on first paint.
      { rootMargin: "200px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, q, tag, category]);

  async function deleteOne(id: string) {
    const ok = confirm("Xóa ảnh này? (sẽ xóa cả trên Cloudinary)");
    if (!ok) return;

    const res = await fetch(`/api/photos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ? String(data.error) : "Delete failed");
      return;
    }

    setItems((prev) => prev.filter((p) => p.id !== id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  async function deleteSelected() {
    if (selectedCount === 0) return;
    const ok = confirm(`Xóa ${selectedCount} ảnh đã chọn? (sẽ xóa cả trên Cloudinary)`);
    if (!ok) return;

    const ids = Array.from(selected);
    const res = await fetch("/api/photos/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ? String(data.error) : "Bulk delete failed");
      return;
    }

    setItems((prev) => prev.filter((p) => !selected.has(p.id)));
    clearSelected();
    router.refresh();
  }

  async function deleteAll() {
    const confirmText = prompt('Gõ DELETE để xác nhận xóa TẤT CẢ ảnh:');
    if (confirmText !== 'DELETE') return;
    const ok = confirm('Bạn chắc chắn muốn xóa TẤT CẢ ảnh? Hành động này không thể hoàn tác.');
    if (!ok) return;

    const res = await fetch('/api/photos/delete-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ? String(data.error) : 'Delete all failed');
      return;
    }

    setItems([]);
    clearSelected();
    router.refresh();
  }

  const summary = useMemo(() => {
    const parts = [];
    if (q) parts.push(`search: “${q}”`);
    if (category) parts.push(`cat: ${category}`);
    if (tag) parts.push(`#${tag}`);
    return parts.length ? parts.join(" · ") : "All photos";
  }, [q, tag, category]);

  const columns = useColumns();
  const gap = 16;
  // Dùng grid masonry cho mọi breakpoint để mobile cũng “lệch” như desktop.
  const useGridMasonry = true;
  const rowH = 10;

  const adminMenuItems: ActionMenuItem[] = useMemo(() => {
    if (!isAdmin) return [];
    return [
      {
        type: "action",
        label: "Select all (loaded)",
        icon: CheckSquare,
        disabled: items.length === 0,
        onClick: selectAllLoaded,
      },
      {
        type: "action",
        label: "Clear selection",
        icon: Square,
        disabled: selectedCount === 0,
        onClick: clearSelected,
      },
      { type: "separator" },
      {
        type: "action",
        label: `Delete selected (${selectedCount})`,
        icon: Trash2,
        danger: true,
        disabled: selectedCount === 0,
        onClick: deleteSelected,
      },
      {
        type: "action",
        label: "Delete ALL",
        icon: Trash2,
        danger: true,
        onClick: deleteAll,
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, items.length, selectedCount, q, tag, category]);

  return (
    <div>
      <div className="mb-4 text-xs text-zinc-500">{summary} · {items.length}</div>

      {isAdmin ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700">
            Selected: <span className="text-zinc-900">{selectedCount}</span>
          </span>

          <ActionMenu
            openOnHover
            items={adminMenuItems}
            trigger={
              <span className="grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50">
                <MoreVertical className="h-5 w-5" />
              </span>
            }
          />
        </div>
      ) : null}

      {useGridMasonry ? (
        // Masonry grid theo pattern (ổn định, phá cách) cho mọi breakpoint
        <div
          className="relative"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: `${gap}px`,
            gridAutoRows: `${rowH}px`,
            gridAutoFlow: "row dense",
          }}
        >
          {items.map((p, i) => {
            const span = spanForCols(p.id, i, columns);
            return (
              <div key={p.id} className="group relative" style={{ gridRowEnd: `span ${span}` }}>
                {isAdmin ? (
                  <div className="absolute right-2 top-2 z-30">
                    <ActionMenu
                      openOnHover
                      align="right"
                      items={[
                        {
                          type: "action",
                          label: selected.has(p.id) ? "Unselect" : "Select",
                          icon: selected.has(p.id) ? CheckSquare : Square,
                          onClick: () => toggleSelected(p.id),
                        },
                        { type: "separator" },
                        {
                          type: "action",
                          label: "Delete",
                          icon: Trash2,
                          danger: true,
                          onClick: () => deleteOne(p.id),
                        },
                      ]}
                      trigger={
                        <span
                          className={
                            "relative grid h-10 w-10 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-900 shadow-sm hover:bg-zinc-50 " +
                            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                          }
                          title="Actions"
                        >
                          <MoreVertical className="h-5 w-5" />
                          {selected.has(p.id) ? (
                            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-emerald-600 ring-2 ring-white" />
                          ) : null}
                        </span>
                      }
                    />
                  </div>
                ) : null}

                <PhotoCard photo={p} href={`${basePath}/p/${p.id}`} isAdmin={isAdmin} variant="grid" />
              </div>
            );
          })}
        </div>
      ) : null}

      <div ref={sentinelRef} className="h-12" />

      <div className="mt-4 flex items-center justify-center">
        {loading ? (
          <div className="text-sm text-zinc-400">Loading more…</div>
        ) : hasMore ? (
          <Button variant="secondary" onClick={() => loadMore(false)}>
            Load more
          </Button>
        ) : (
          <div className="text-sm text-zinc-500">Hết ảnh rồi.</div>
        )}
      </div>
    </div>
  );
}
