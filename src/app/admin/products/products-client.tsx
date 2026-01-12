"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Check, Loader2, RefreshCw, Save, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CategoryItem } from "@/lib/categories";
import { tagsToText } from "@/lib/tag-utils";

type Visibility = "public" | "private";

type ProductRow = {
  id: string;
  active: boolean;
  thumbSrc: string;
  name: string;
  userCategory: string | null;
  finalCategory: string;
  priceBySize: string;
  priceVisibility: Visibility;
  description: string;
  descriptionVisibility: Visibility;
  tags: string[];
  createdAt: string; // ISO
};

type ApiResp = { items: ProductRow[]; nextCursor: string | null };

type TagSuggestion = { key: string; label: string; count: number };

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // Make the textarea grow with content (like a sheet cell) – no internal scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reset height so shrink also works.
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      // overflow hidden prevents the little scrollbar/scroll buttons inside the cell
      className={cn(className, "overflow-hidden")}
    />
  );
}

function fmtDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function fmtDateShort(iso: string) {
  try {
    const d = new Date(iso);
    // YYYY-MM-DD for compact sheet view
    return d.toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function normalizeToken(s: string) {
  return s.trim().toLowerCase();
}

function TagsInput({
  value,
  onChange,
  suggestions,
  inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const parts = useMemo(() => value.split(/[,\n]/g), [value]);
  const last = parts.length ? parts[parts.length - 1] : "";
  const token = normalizeToken(last);

  const filtered = useMemo(() => {
    if (!token) return suggestions.slice(0, 12);
    return suggestions.filter((t) => t.toLowerCase().includes(token)).slice(0, 12);
  }, [suggestions, token]);

  // Auto-grow height so long tag lists are fully visible (sheet-like)
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function applySuggestion(tag: string) {
    const base = parts
      .slice(0, -1)
      .map((p) => p.trim())
      .filter(Boolean);
    const next = [...base, tag].join(", ");
    onChange(next + ", ");
    setOpen(false);
    setActiveIdx(0);

    // Keep focus in the cell (sheet-like)
    window.setTimeout(() => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }, 0);
  }

  return (
    <div
      className="relative"
      ref={ref}
      onBlur={() => {
        // Small delay so click can register
        window.setTimeout(() => setOpen(false), 120);
      }}
    >
      <textarea
        ref={taRef}
        value={value}
        rows={1}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Prevent creating newlines in the sheet cell
            e.preventDefault();
            if (open && filtered[activeIdx]) {
              applySuggestion(filtered[activeIdx]);
            }
            return;
          }

          if (!open) return;
          if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          }
        }}
        placeholder="vd: 100k, basic, lay ngay, sale"
        className={cn(
          "min-h-8 w-full resize-none rounded-none border-0 bg-transparent px-1 py-1 text-[12px] leading-4 outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300 overflow-hidden",
          inputClassName
        )}
      />

      {open && filtered.length ? (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="max-h-48 overflow-auto p-1">
            {filtered.map((t, idx) => (
              <button
                key={t}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-50",
                  idx === activeIdx && "bg-zinc-50"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applySuggestion(t)}
              >
                <span className="truncate">{t}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ProductsClient() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [category, setCategory] = useState<string>("");

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);

  // Zoom so the whole sheet can fit on one screen width (no horizontal scroll)
  const [zoom, setZoom] = useState<0.7 | 0.8 | 0.9 | 1>(0.9);

  // per-row save state
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    // Rows have dynamic height (auto-grow textareas), so we give a small estimate
    // and let the virtualizer measure real heights via measureElement.
    estimateSize: () => 44,
    overscan: 8,
  });

  async function fetchMeta() {
    // categories
    const catRes = await fetch("/api/categories?all=1", { cache: "no-store" });
    if (catRes.ok) {
      const cats = (await catRes.json()) as CategoryItem[];
      setCategories(Array.isArray(cats) ? cats : []);
    }

    // tags
    const tagRes = await fetch("/api/tags", { cache: "no-store" });
    if (tagRes.ok) {
      const tags = (await tagRes.json()) as TagSuggestion[];
      const labels = Array.isArray(tags) ? tags.map((t) => t.label ?? t.key) : [];
      setTagSuggestions(labels);
    }
  }

  async function load(reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "120");
      if (!reset && cursor) params.set("cursor", cursor);
      if (q.trim()) params.set("q", q.trim());
      if (activeFilter !== "all") params.set("active", activeFilter);
      if (category) params.set("category", category);

      const res = await fetch(`/api/products?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
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
    }
  }

  useEffect(() => {
    fetchMeta();
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setCursor(null);
      setHasMore(true);
      setDirty({});
      setSaved({});
      load(true);
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, activeFilter, category]);

  function updateRow(id: string, patch: Partial<ProductRow>) {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setDirty((d) => ({ ...d, [id]: true }));
    setSaved((s) => ({ ...s, [id]: false }));
  }

  async function saveRow(id: string) {
    const row = items.find((x) => x.id === id);
    if (!row) return;

    setSaving((s) => ({ ...s, [id]: true }));
    try {
      const res = await fetch(`/api/photos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: row.name,
          active: row.active,
          userCategory: row.userCategory,
          priceBySize: row.priceBySize,
          priceVisibility: row.priceVisibility,
          description: row.description,
          descriptionVisibility: row.descriptionVisibility,
          tags: row.tags,
        }),
      });
      if (!res.ok) throw new Error("Save failed");

      setDirty((d) => ({ ...d, [id]: false }));
      setSaved((s) => ({ ...s, [id]: true }));
      window.setTimeout(() => setSaved((s) => ({ ...s, [id]: false })), 1800);
    } finally {
      setSaving((s) => ({ ...s, [id]: false }));
    }
  }

  const categoryOptions = useMemo(() => {
    const sorted = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return sorted;
  }, [categories]);

  const colTemplate =
    "grid-cols-[10%_4%_5%_12%_9%_12%_6%_14%_6%_14%_5%_3%]";
  const headerCell =
    "border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 text-[11px] font-semibold text-zinc-600 tracking-wide";
  const cell = "border-b border-r border-zinc-200 px-2 py-1.5 text-[12px] text-zinc-800";
  const input =
    "h-8 w-full rounded-none border-0 bg-transparent px-1 text-[12px] outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300";
  const textarea =
    // Auto-grow textarea: no internal scroll; height is controlled via AutoGrowTextarea.
    "min-h-8 w-full resize-none rounded-none border-0 bg-transparent px-1 py-1 text-[12px] leading-4 outline-none focus:bg-white focus:ring-1 focus:ring-zinc-300";

  // Only scale horizontally so virtualized Y positions remain correct
  const scaleStyle = useMemo(
    () =>
      ({
        transform: `scaleX(${zoom})`,
        transformOrigin: "0 0",
        width: `${Math.round((100 / zoom) * 1000) / 1000}%`,
      }) as React.CSSProperties,
    [zoom]
  );

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-white">
      <div className="flex h-full flex-col">
        {/* Top bar */}
        <div className="shrink-0 border-b border-zinc-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <h1 className="text-base font-semibold text-zinc-900">Products</h1>
              <span className="text-xs text-zinc-500">Sheet view • save theo từng dòng</span>
              <span className="text-xs text-zinc-400">Loaded: {items.length}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search id / name / tag"
                  className="h-9 w-64 rounded-lg border border-zinc-200 bg-white pl-8 pr-2 text-[12px] outline-none focus:border-zinc-300"
                />
              </div>

              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value as any)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-[12px] outline-none focus:border-zinc-300"
              >
                <option value="all">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-[12px] outline-none focus:border-zinc-300"
              >
                <option value="">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>

              <select
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value) as any)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-[12px] outline-none focus:border-zinc-300"
                title="Zoom (fit columns)"
              >
                <option value={1}>100%</option>
                <option value={0.9}>90%</option>
                <option value={0.8}>80%</option>
                <option value={0.7}>70%</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setActiveFilter("all");
                  setCategory("");
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] text-zinc-700 hover:bg-zinc-50"
                title="Reset filters"
              >
                <X className="h-4 w-4" /> Reset
              </button>

              <button
                type="button"
                onClick={() => load(true)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-[12px] text-zinc-700 hover:bg-zinc-50"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>

              <button
                type="button"
                onClick={() => load(false)}
                disabled={!hasMore || loading}
                className={cn(
                  "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[12px]",
                  !hasMore || loading
                    ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                )}
                title="Load more"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                More
              </button>
            </div>
          </div>
        </div>

        {/* Sheet */}
        <div className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col overflow-hidden bg-white">
            {/* Header row (sheet-style) */}
            <div style={scaleStyle} className={cn("grid", colTemplate, "border-l border-t border-zinc-200")}
            >
              <div className={headerCell}>id</div>
              <div className={headerCell}>active</div>
              <div className={headerCell}>thumb</div>
              <div className={headerCell}>name</div>
              <div className={headerCell}>category</div>
              <div className={headerCell}>priceBySize</div>
              <div className={headerCell}>priceVis</div>
              <div className={headerCell}>description</div>
              <div className={headerCell}>descVis</div>
              <div className={headerCell}>tags</div>
              <div className={headerCell}>createdAt</div>
              <div className={cn(headerCell, "text-right")}>save</div>
            </div>

            {/* Body (virtualized) */}
            <div ref={parentRef} className="flex-1 overflow-y-auto overflow-x-hidden">
              {/* scale horizontally (and compensate width) so columns stay on one screen */}
              <div style={scaleStyle}>
                <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const r = items[vRow.index];
              if (!r) return null;
              const isDirty = Boolean(dirty[r.id]);
              const isSaving = Boolean(saving[r.id]);
              const isSaved = Boolean(saved[r.id]);

              return (
                <div
                  key={r.id}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${vRow.start}px)`,
                  }}
                    className={cn(
                      "grid border-l border-zinc-200",
                      colTemplate,
                      vRow.index % 2 === 1 ? "bg-zinc-50/40" : "bg-white",
                      isDirty && "bg-amber-50/40"
                    )}
                >
                    {/* id */}
                    <div className={cn(cell, "truncate font-mono text-[11px] text-zinc-700")}>{r.id}</div>

                    {/* active */}
                    <div className={cn(cell, "flex items-center justify-center")}
                    >
                      <input
                        type="checkbox"
                        checked={r.active}
                        onChange={(e) => updateRow(r.id, { active: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-300"
                        title="active"
                      />
                    </div>

                    {/* thumb */}
                    <div className={cn(cell, "flex items-center justify-center")}
                    >
                      <img
                        src={r.thumbSrc}
                        alt={r.name}
                        loading="lazy"
                        className="h-9 w-9 rounded-md object-cover"
                      />
                    </div>

                    {/* name */}
                    <div className={cell}>
                      <input
                        value={r.name}
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        className={input}
                      />
                    </div>

                    {/* category */}
                    <div className={cell}>
                      <select
                        value={r.userCategory ?? ""}
                        onChange={(e) => updateRow(r.id, { userCategory: e.target.value ? e.target.value : null })}
                        className={cn(input, "h-8")}
                        title="category"
                      >
                        <option value="">(auto) {r.finalCategory}</option>
                        {categoryOptions.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* priceBySize */}
                    <div className={cell}>
                      <AutoGrowTextarea
                        value={r.priceBySize}
                        onChange={(v) => updateRow(r.id, { priceBySize: v })}
                        className={textarea}
                        placeholder="10cm:100k\n12cm:150k"
                      />
                    </div>

                    {/* priceVisibility */}
                    <div className={cell}>
                      <select
                        value={r.priceVisibility}
                        onChange={(e) => updateRow(r.id, { priceVisibility: e.target.value as Visibility })}
                        className={cn(input, "h-8")}
                        title="price visibility"
                      >
                        <option value="public">public</option>
                        <option value="private">private</option>
                      </select>
                    </div>

                    {/* description */}
                    <div className={cell}>
                      <AutoGrowTextarea
                        value={r.description}
                        onChange={(v) => updateRow(r.id, { description: v })}
                        className={textarea}
                        placeholder="mô tả..."
                      />
                    </div>

                    {/* descriptionVisibility */}
                    <div className={cell}>
                      <select
                        value={r.descriptionVisibility}
                        onChange={(e) => updateRow(r.id, { descriptionVisibility: e.target.value as Visibility })}
                        className={cn(input, "h-8")}
                        title="description visibility"
                      >
                        <option value="public">public</option>
                        <option value="private">private</option>
                      </select>
                    </div>

                    {/* tags */}
                    <div className={cell}>
                      <TagsInput
                        value={tagsToText(r.tags)}
                        onChange={(txt) => {
                          const next = txt
                            .split(/[,\n]/g)
                            .map((s) => s.trim())
                            .filter(Boolean);
                          updateRow(r.id, { tags: next });
                        }}
                        suggestions={tagSuggestions}
                        // Don't force a fixed height: allow the cell to auto-grow like a sheet
                        inputClassName="rounded-none border-0 bg-transparent px-1 py-1 focus:ring-1 focus:ring-zinc-300"
                      />
                    </div>

                    {/* createdAt */}
                    <div className={cn(cell, "text-[11px] text-zinc-600")}>{fmtDateShort(r.createdAt)}</div>

                    {/* save */}
                    <div className={cn(cell, "flex items-center justify-end")}
                    >
                      <button
                        type="button"
                        onClick={() => saveRow(r.id)}
                        disabled={!isDirty || isSaving}
                        className={cn(
                          "inline-flex h-8 items-center justify-center rounded-md px-2",
                          !isDirty || isSaving
                            ? "text-zinc-400"
                            : "text-zinc-900 hover:bg-zinc-50"
                        )}
                        title="Save row"
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </button>
                      {isSaved ? (
                        <span className="ml-1 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700 ring-1 ring-emerald-200">
                          <Check className="mr-0.5 h-3 w-3" /> ok
                        </span>
                      ) : null}
                    </div>
                </div>
              );
            })}
                </div>
              </div>
              {items.length === 0 && !loading ? (
                <div className="p-8 text-center text-sm text-zinc-500">Chưa có dữ liệu.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
