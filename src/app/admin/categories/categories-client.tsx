"use client";

import { useEffect, useMemo, useState } from "react";

import { DEFAULT_CATEGORIES, isValidCategoryKey, type CategoryItem } from "@/lib/categories";

type CategoryRow = CategoryItem & {
  _originalKey: string;
  _dirty: boolean;
  _saving?: boolean;
  _saved?: boolean;
};

function normalizeKey(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "-");
}

export default function CategoriesClient() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [createLabel, setCreateLabel] = useState("");
  const [createKey, setCreateKey] = useState("");
  const [createOrder, setCreateOrder] = useState(100);
  const [createActive, setCreateActive] = useState(true);
  const [busyCreate, setBusyCreate] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/categories?all=1", { cache: "no-store" });
      const data = await res.json();
      const arr: CategoryItem[] = Array.isArray(data) ? data : DEFAULT_CATEGORIES;
      setRows(
        arr
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((c) => ({ ...c, _originalKey: c.key, _dirty: false }))
      );
    } catch {
      setRows(DEFAULT_CATEGORIES.map((c) => ({ ...c, _originalKey: c.key, _dirty: false })));
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.key.toLowerCase().includes(q) || r.label.toLowerCase().includes(q));
  }, [rows, query]);

  function markSaved(key: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, _saved: true, _dirty: false, _saving: false } : r)));
    setTimeout(() => {
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, _saved: false } : r)));
    }, 1200);
  }

  async function createCategory() {
    const label = createLabel.trim();
    const key = normalizeKey(createKey || createLabel);
    if (!label || !key || !isValidCategoryKey(key)) return;

    setBusyCreate(true);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, order: Number(createOrder) || 0, isActive: createActive }),
    }).catch(() => null);

    setCreateLabel("");
    setCreateKey("");
    setCreateOrder(100);
    setCreateActive(true);
    await refresh();
    setBusyCreate(false);
  }

  async function saveRow(r: CategoryRow) {
    const key = normalizeKey(r.key);
    const label = r.label.trim();
    if (!key || !label || !isValidCategoryKey(key)) return;

    const originalKey = r._originalKey;
    setRows((prev) => prev.map((x) => (x._originalKey === originalKey ? { ...x, _saving: true } : x)));

    const res = await fetch(`/api/categories/${encodeURIComponent(originalKey)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, label, order: Number(r.order) || 0, isActive: r.isActive }),
    }).catch(() => null);

    if (!res || !(res as any).ok) {
      setRows((prev) => prev.map((x) => (x._originalKey === originalKey ? { ...x, _saving: false } : x)));
      alert("Save failed. Check key format / duplicate key.");
      return;
    }

    // Reload to keep things consistent (also updates _originalKey if key changed)
    await refresh();
    markSaved(key);
  }

  async function deleteRow(r: CategoryRow) {
    if (r.key === "uncategorized") return;
    if (!window.confirm(`Xóa category "${r.label}"? Ảnh đang dùng category này sẽ reset về "uncategorized".`)) return;

    setRows((prev) => prev.map((x) => (x.key === r.key ? { ...x, _saving: true } : x)));
    await fetch(`/api/categories/${encodeURIComponent(r.key)}`, { method: "DELETE" }).catch(() => null);
    await refresh();
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Categories</h1>
          <p className="mt-1 text-sm text-zinc-500">Thêm/sửa/xóa category. Key (slug) lưu trong DB và dùng để gán ảnh.</p>
        </div>

        <div className="w-full sm:w-80">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo key hoặc label..."
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-zinc-900">Thêm category</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-4">
            <div className="text-xs font-medium text-zinc-600">Label</div>
            <input
              value={createLabel}
              onChange={(e) => {
                const v = e.target.value;
                setCreateLabel(v);
                if (!createKey) setCreateKey(normalizeKey(v));
              }}
              placeholder="Ví dụ: Bánh kem"
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div className="sm:col-span-4">
            <div className="text-xs font-medium text-zinc-600">Key (slug)</div>
            <input
              value={createKey}
              onChange={(e) => setCreateKey(normalizeKey(e.target.value))}
              placeholder="vd: banh-kem"
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
            <div className="mt-1 text-[11px] text-zinc-500">Chỉ chữ thường/số và dấu gạch ngang.</div>
          </div>

          <div className="sm:col-span-2">
            <div className="text-xs font-medium text-zinc-600">Order</div>
            <input
              type="number"
              value={createOrder}
              onChange={(e) => setCreateOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          <div className="sm:col-span-1">
            <div className="text-xs font-medium text-zinc-600">Active</div>
            <label className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={createActive} onChange={(e) => setCreateActive(e.target.checked)} />
              <span className="text-xs">on</span>
            </label>
          </div>

          <div className="sm:col-span-1 sm:flex sm:justify-end">
            <button
              type="button"
              onClick={createCategory}
              disabled={busyCreate || !createLabel.trim() || !isValidCategoryKey(normalizeKey(createKey || createLabel))}
              className="w-full rounded-2xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 sm:w-auto"
            >
              Tạo
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="text-sm font-semibold text-zinc-900">Danh sách</div>
          <div className="text-xs text-zinc-500">
            {filtered.length} / {rows.length}
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-zinc-500">Đang tải…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">Chưa có category.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Key</th>
                  <th className="px-5 py-3 font-semibold">Label</th>
                  <th className="px-5 py-3 font-semibold">Order</th>
                  <th className="px-5 py-3 font-semibold">Active</th>
                  <th className="px-5 py-3 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const reserved = r._originalKey === "uncategorized";
                  const dirty = r._dirty;
                  const saving = !!r._saving;
                  return (
                    <tr key={r._originalKey} className="border-t border-zinc-100">
                      <td className="px-5 py-3">
                        <input
                          value={r.key}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x._originalKey === r._originalKey
                                  ? { ...x, key: normalizeKey(e.target.value), _dirty: true, _saved: false }
                                  : x
                              )
                            )
                          }
                          disabled={reserved}
                          className="w-64 rounded-2xl border border-zinc-200 px-3 py-2 text-xs font-mono text-zinc-800 outline-none focus:ring-2 focus:ring-black/10 disabled:bg-zinc-50"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          value={r.label}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x._originalKey === r._originalKey ? { ...x, label: e.target.value, _dirty: true, _saved: false } : x
                              )
                            )
                          }
                          className="w-full min-w-[260px] rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          value={r.order}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x._originalKey === r._originalKey
                                  ? { ...x, order: Number(e.target.value), _dirty: true, _saved: false }
                                  : x
                              )
                            )
                          }
                          className="w-28 rounded-2xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <label className="inline-flex items-center gap-2 text-sm text-zinc-700">
                          <input
                            type="checkbox"
                            checked={r.isActive}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x) =>
                                  x._originalKey === r._originalKey
                                    ? { ...x, isActive: e.target.checked, _dirty: true, _saved: false }
                                    : x
                                )
                              )
                            }
                          />
                          <span className="text-xs">on</span>
                        </label>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r._saved ? (
                          <span className="mr-3 inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">đã lưu</span>
                        ) : reserved ? (
                          <span className="mr-3 inline-flex items-center rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">reserved</span>
                        ) : dirty ? (
                          <span className="mr-3 inline-flex items-center rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">chưa lưu</span>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => saveRow(r)}
                          disabled={saving || !r.label.trim() || !isValidCategoryKey(normalizeKey(r.key))}
                          className="mr-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          {saving ? "Đang lưu…" : "Lưu"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRow(r)}
                          disabled={saving || reserved}
                          className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
