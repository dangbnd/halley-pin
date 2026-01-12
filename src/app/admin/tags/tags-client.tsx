"use client";

import { useEffect, useMemo, useState } from "react";

import { normalizeTagLabel, slugifyTagKey } from "@/lib/tag-utils";

type TagRow = {
  key: string;
  label: string;
  count: number;
  createdAt: string;
  order?: number;
  isActive?: boolean;
};

export default function TagsClient() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [createValue, setCreateValue] = useState("");
  const [busyName, setBusyName] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/tags", { cache: "no-store" });
    const data = await res.json();
    setRows(Array.isArray(data) ? data : []);
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

  async function createTag() {
    const label = normalizeTagLabel(createValue);
    const key = slugifyTagKey(label);
    if (!key) return;
    setBusyName(key);
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    }).catch(() => null);
    setCreateValue("");
    await refresh();
    setBusyName(null);
  }

  async function deleteTag(key: string) {
    setBusyName(key);
    await fetch(`/api/tags/${encodeURIComponent(key)}`, { method: "DELETE" }).catch(() => null);
    await refresh();
    setBusyName(null);
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Tags</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tags tự tạo khi admin nhập vào ảnh (cách nhau bằng dấu phẩy). Trang này dùng để kiểm tra & dọn dẹp.
          </p>
        </div>

        <div className="w-full sm:w-80">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên tag..."
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <div className="text-xs font-medium text-zinc-600">Thêm tag</div>
            <input
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              placeholder="vd: 100k, lấy ngay, sale"
              className="mt-1 w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/10"
            />
            <div className="mt-1 text-[11px] text-zinc-500">Hệ thống sẽ tự tạo key dạng slug (VD: "lấy ngay" → "lay-ngay"), nhưng khách sẽ thấy label tiếng Việt.</div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={createTag}
              disabled={!slugifyTagKey(createValue) || !!busyName}
              className="rounded-2xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              Tạo
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="text-sm font-semibold text-zinc-900">Danh sách</div>
          <div className="text-xs text-zinc-500">{filtered.length} / {rows.length}</div>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-zinc-500">Đang tải…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">Chưa có tag.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs text-zinc-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Key</th>
                  <th className="px-5 py-3 font-semibold">Label</th>
                  <th className="px-5 py-3 font-semibold">Số ảnh</th>
                  <th className="px-5 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 font-semibold text-right">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const busy = busyName === r.key;
                  return (
                    <tr key={r.key} className="border-t border-zinc-100">
                      <td className="px-5 py-3 font-mono text-xs text-zinc-800">{r.key}</td>
                      <td className="px-5 py-3 text-zinc-800">{r.label}</td>
                      <td className="px-5 py-3 text-zinc-700">{r.count}</td>
                      <td className="px-5 py-3 text-zinc-500">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(r.key)}
                          className="mr-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Xóa tag "${r.label}" (${r.key})? Tag sẽ bị gỡ khỏi tất cả ảnh.`)) {
                              deleteTag(r.key);
                            }
                          }}
                          disabled={busy}
                          className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                        >
                          {busy ? "Đang xóa…" : "Xóa"}
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
