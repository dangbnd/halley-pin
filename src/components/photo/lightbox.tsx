"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Photo } from "@/lib/photos";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/photos";

function IconButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-11 w-11 place-items-center rounded-2xl border border-zinc-800 bg-zinc-950/55 text-zinc-200 backdrop-blur transition hover:bg-zinc-900/70 active:scale-[0.98]"
    >
      {children}
    </button>
  );
}

export function Lightbox({
  open,
  onOpenChange,
  photo,
  onPrev,
  onNext,
  onPhotoPatched,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  photo: Photo | null;
  onPrev: () => void;
  onNext: () => void;
  onPhotoPatched: (patch: Partial<Photo>) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onPrev();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onPrev, onNext, onOpenChange]);

  const [saving, setSaving] = useState(false);

  async function setUserCategory(next: string) {
    if (!photo) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/photos/${photo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userCategory: next || null }),
      });
      const data = await res.json();
      onPhotoPatched({ userCategory: data.userCategory, finalCategory: data.finalCategory });
    } finally {
      setSaving(false);
    }
  }

  const aiLine = `${photo?.aiCategory ?? "unknown"} (${Math.round(((photo?.aiConfidence ?? 0) * 100))}%)`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(92vh,900px)] w-[min(96vw,1600px)] overflow-hidden p-0">
        <div className="relative h-full w-full bg-zinc-950/70">
          <div className="relative z-20 flex flex-col gap-4 border-b border-zinc-900/70 px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-zinc-50">{photo?.title ?? ""}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="rounded-full border border-zinc-800 bg-zinc-950/40 px-3 py-1">
                  {photo ? `${photo.width}×${photo.height}` : ""}
                </span>
                <span className="rounded-full border border-zinc-800 bg-zinc-950/30 px-3 py-1 text-zinc-300">
                  AI: {aiLine}
                </span>
                {photo?.classifyStatus === "queued" || photo?.classifyStatus === "processing" ? (
                  <span className="rounded-full border border-zinc-800 bg-zinc-950/30 px-3 py-1 text-zinc-400">classifying…</span>
                ) : null}
                {photo?.classifyStatus === "failed" ? (
                  <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-red-200">failed</span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="text-xs text-zinc-400">Category</div>
                <Select
                  value={photo?.userCategory ?? ""}
                  onChange={(e) => setUserCategory(e.target.value)}
                  disabled={!photo || saving}
                  className="h-10"
                >
                  <option value="">Auto (AI)</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                {saving ? <div className="text-xs text-zinc-500">saving…</div> : null}
              </div>

              <IconButton onClick={() => onOpenChange(false)} label="Close">
                <X className="h-5 w-5" />
              </IconButton>
            </div>
          </div>

          <div className="relative h-[calc(100%-120px)] w-full px-4 pb-3 pt-3 sm:h-[calc(100%-76px)] sm:px-6 sm:pb-4 sm:pt-4">
            <div className="relative h-full w-full overflow-hidden rounded-3xl border border-zinc-900/60 bg-black/30">
              <div className="absolute inset-0 z-10 hidden items-center justify-between px-4 sm:flex">
                <IconButton onClick={onPrev} label="Previous">
                  <ChevronLeft className="h-5 w-5" />
                </IconButton>
                <IconButton onClick={onNext} label="Next">
                  <ChevronRight className="h-5 w-5" />
                </IconButton>
              </div>

              <div className="absolute inset-0 grid place-items-center">
                {photo ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={photo.src}
                      alt={photo.title}
                      fill
                      sizes="(max-width: 640px) 96vw, (max-width: 1280px) 92vw, 2000px"
                      quality={100}
                      placeholder="blur"
                      blurDataURL={photo.blurDataURL}
                      className="object-contain"
                      priority
                    />
                  </div>
                ) : null}
              </div>

              <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between gap-3">
                <div className="text-[11px] text-zinc-400">Tip: ← → để chuyển ảnh, Esc để đóng</div>
                <div className="rounded-full border border-zinc-800 bg-zinc-950/50 px-3 py-1 text-[11px] text-zinc-300">
                  Final: {photo?.finalCategory ?? "—"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 sm:hidden">
              <IconButton onClick={onPrev} label="Previous">
                <ChevronLeft className="h-5 w-5" />
              </IconButton>
              <IconButton onClick={onNext} label="Next">
                <ChevronRight className="h-5 w-5" />
              </IconButton>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
