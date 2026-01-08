"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/photos";

import { Check, ChevronDown, Search } from "lucide-react";

type Info = {
  userCategory: string | null;
  finalCategory: string;
  adminNote: string;
  adminNotePublic: boolean;
};

export function CakeInfoClient({
  photoId,
  isAdmin,
  initial,
}: {
  photoId: string;
  isAdmin: boolean;
  initial: Info;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<Info>(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/photos/${photoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userCategory: info.userCategory,
          adminNote: info.adminNote,
          adminNotePublic: info.adminNotePublic,
        }),
      });

      if (!res.ok) {
        if (res.status === 401) alert("Bạn cần đăng nhập admin để sửa thông tin.");
        else alert("Lưu thất bại");
        return;
      }

      const data = await res.json().catch(() => null);
      // keep local state in sync + refresh server bits (title/category badge)
      setInfo((p) => ({
        ...p,
        userCategory: typeof data?.userCategory === "string" ? data.userCategory : null,
        finalCategory: typeof data?.finalCategory === "string" ? data.finalCategory : p.finalCategory,
        adminNote: typeof data?.adminNote === "string" ? data.adminNote : p.adminNote,
        adminNotePublic: Boolean(data?.adminNotePublic),
      }));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  // Guest view: do not render any internal info.
  if (!isAdmin) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="text-sm font-semibold text-zinc-900">Thông tin bánh</div>

      <div className="mt-3 space-y-3">
        {/* Category (single place to edit) */}
        <div>
          <div className="mb-1 text-xs font-medium text-zinc-600">Category</div>
          <CategoryPicker
            value={info.userCategory}
            onChange={(v) => setInfo((p) => ({ ...p, userCategory: v }))}
          />
        </div>

        {/* Public toggle */}
        <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={info.adminNotePublic}
            onChange={(e) => setInfo((p) => ({ ...p, adminNotePublic: e.target.checked }))}
            className="mt-1 h-4 w-4"
          />
          <div className="min-w-0">
            <div className="text-sm font-medium text-zinc-900">Cho khách xem thông tin bánh</div>
            <div className="text-xs text-zinc-500">Tắt = khách sẽ không thấy phần này.</div>
          </div>
        </label>

        {/* Note */}
        <textarea
          value={info.adminNote}
          onChange={(e) => setInfo((p) => ({ ...p, adminNote: e.target.value }))}
          rows={7}
          className="w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-black/15"
          placeholder="VD: Cốt vanilla, kem bơ, trang trí Noel, gợi ý biến thể…"
        />

        <div className="flex justify-end">
          <Button variant="primary" className="rounded-full px-5" onClick={save} disabled={saving}>
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const currentLabel = useMemo(() => {
    if (!value) return "(Tự động)";
    return CATEGORIES.find((c) => c.key === value)?.label ?? value;
  }, [value]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return CATEGORIES;
    return CATEGORIES.filter((c) => c.label.toLowerCase().includes(qq));
  }, [q]);

  // close on outside click / ESC
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 shadow-sm outline-none hover:bg-zinc-50 focus:ring-2 focus:ring-black/15"
      >
        <span className="min-w-0 truncate">{currentLabel}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <Search className="h-4 w-4 text-zinc-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm category…"
              className="h-9 w-full bg-transparent text-sm outline-none"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-auto p-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <span>(Tự động)</span>
              {!value ? <Check className="h-4 w-4 text-zinc-900" /> : null}
            </button>

            {filtered.map((c) => {
              const active = value === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    onChange(c.key);
                    setOpen(false);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-zinc-50"
                >
                  <span className="truncate">{c.label}</span>
                  {active ? <Check className="h-4 w-4 text-zinc-900" /> : null}
                </button>
              );
            })}

            {!filtered.length ? (
              <div className="px-3 py-2 text-sm text-zinc-500">Không tìm thấy.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

