"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, CloudUpload, ImageIcon, Loader2, Trash2, X } from "lucide-react";

type SignResp = { key: string; uploadUrl: string };

type Item = {
  id: string;
  file: File;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  progress: number;
  message?: string;
};

function formatBytes(bytes: number) {
  const units = ["B","KB","MB","GB"];
  let i = 0, v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function getSignature(fileName: string, contentType: string): Promise<SignResp> {
  const sigRes = await fetch("/api/r2/sign-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, contentType }),
    cache: "no-store"
  });
  if (!sigRes.ok) throw new Error(await sigRes.text());
  return sigRes.json();
}


async function saveMeta(payload: { originalKey: string; title: string; tags: string[]; }) {
  const saveRes = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!saveRes.ok) throw new Error(await saveRes.text());
}

export default function UploadPage({ isAdmin = false }: { isAdmin?: boolean } = {}) {
  const pathname = usePathname();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "";
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const queuedCount = useMemo(() => items.filter((i) => i.status === "queued").length, [items]);
  const doneCount = useMemo(() => items.filter((i) => i.status === "done").length, [items]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const next: Item[] = acceptedFiles
      .filter((f) => f.type.startsWith("image/"))
      .map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "queued",
        progress: 0,
      }));
    setItems((prev) => [...next, ...prev].slice(0, 50));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { "image/*": [] }, multiple: true });

  function clearAll() {
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
  }

  function removeOne(id: string) {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }
  async function uploadItem(item: Item) {
    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "uploading", progress: 0 } : x)));

    const sig = await getSignature(item.file.name, item.file.type || "application/octet-stream");

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", sig.uploadUrl);
      if (item.file.type) xhr.setRequestHeader("Content-Type", item.file.type);
      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const p = Math.round((evt.loaded / evt.total) * 100);
        setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, progress: p } : x)));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(xhr.responseText || ("Upload failed (" + xhr.status + ")")));
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(item.file);
    });

    await saveMeta({
      originalKey: sig.key,
      title: item.file.name,
      tags: [],
    });

    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: "done", progress: 100 } : x)));
  }

  async function uploadAll() {
    if (busy) return;
    const queue = items.filter((i) => i.status === "queued");
    if (!queue.length) return;

    setBusy(true);
    try {
      for (const it of queue) {
        try { await uploadItem(it); }
        catch (err: any) {
          setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: "error", message: err?.message ?? "Upload failed" } : x)));
        }
      }
    } finally { setBusy(false); }
  }

  return (
    <div className="grain min-h-screen">
      <SiteHeader initialIsAdmin={isAdmin} />
      <main className="mx-auto max-w-screen-xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">Upload</h1>
            <p className="mt-2 text-sm text-zinc-500">
              Drag & drop + preview + progress. Upload lên Cloudflare R2, lưu DB, và auto-categorize (free) nếu bật.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-xs text-zinc-600">
              Queued: <span className="text-zinc-900">{queuedCount}</span> · Done: <span className="text-zinc-900">{doneCount}</span> · Total: <span className="text-zinc-900">{items.length}</span>
            </div>

            <Button variant="secondary" onClick={uploadAll} disabled={busy || queuedCount === 0}>
              {busy ? (<><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>) : (<><CloudUpload className="h-4 w-4" /> Upload all</>)}
            </Button>

            <Button variant="ghost" onClick={clearAll} disabled={busy || items.length === 0}>
              <Trash2 className="h-4 w-4" /> Clear
            </Button>

            <Link href={`${basePath}/gallery`}><Button variant="ghost">Về Gallery</Button></Link>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            "group relative rounded-3xl border border-zinc-200  bg-white/30 p-10 transition hover:bg-white/45",
            isDragActive && "border-zinc-600 bg-white"
          )}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center text-center">
            <div className="mb-4 grid h-14 w-14 place-items-center rounded-3xl border border-zinc-200 bg-white">
              <ImageIcon className="h-6 w-6 text-zinc-800" />
            </div>
            <div className="text-base font-semibold text-zinc-900">{isDragActive ? "Thả ảnh vào đây" : "Kéo thả ảnh vào đây"}</div>
            <div className="mt-2 text-sm text-zinc-500">hoặc click để chọn file. Hỗ trợ nhiều ảnh.</div>
            <div className="mt-5"><Button variant="secondary" type="button">Chọn ảnh</Button></div>
            <div className="mt-3 text-xs text-zinc-500">Tip: Classify chạy nền (job). Nếu muốn bật local CLIP (nặng) hãy set ENABLE_CLASSIFICATION=true và ENABLE_LOCAL_CLIP=true. Muốn tắt hoàn toàn: ENABLE_CLASSIFICATION=false.</div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <div key={it.id} className="relative overflow-hidden rounded-3xl border border-zinc-200  bg-white/35">
              <div className="relative aspect-[4/3]">
                <Image src={it.previewUrl} alt={it.file.name} fill className="object-cover" unoptimized />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
                <button
                  onClick={() => removeOne(it.id)}
                  disabled={busy && it.status === "uploading"}
                  className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                  aria-label="Remove"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-900">{it.file.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">{formatBytes(it.file.size)} · {it.file.type || "image"}</div>
                  </div>

                  <span className={cn(
                    "shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium",
                    it.status === "queued" && "border-zinc-200 bg-white text-zinc-600",
                    it.status === "uploading" && "border-zinc-700 bg-zinc-50 text-zinc-950",
                    it.status === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                    it.status === "error" && "border-red-200 bg-red-50 text-red-700"
                  )}>
                    {it.status}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full border border-zinc-200 bg-white">
                    <div
                      className={cn(
                        "h-full transition-all",
                        it.status === "done" && "bg-zinc-50",
                        it.status === "uploading" && "bg-zinc-300",
                        it.status === "error" && "bg-red-500/80",
                        it.status === "queued" && "bg-zinc-700"
                      )}
                      style={{ width: `${it.progress}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                    <span>
                      {it.status === "queued" && "Chờ upload"}
                      {it.status === "uploading" && `Đang upload… ${it.progress}%`}
                      {it.status === "done" && "Hoàn tất (đã lưu DB)"}
                      {it.status === "error" && (it.message || "Lỗi")}
                    </span>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => uploadItem(it)}
                      disabled={busy || it.status !== "queued"}
                      className="h-9 rounded-2xl px-3"
                    >
                      <CloudUpload className="h-4 w-4" /> Upload
                    </Button>
                  </div>

                  {it.status === "done" ? (
                    <div className="mt-3 flex items-center gap-2 text-xs text-zinc-600">
                      <Check className="h-4 w-4" /> Done
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {items.length === 0 ? (
          <div className="mt-10 text-center text-sm text-zinc-500">
            Chưa có file nào. Kéo thả vài tấm cho nó có không khí.
          </div>
        ) : null}
      </main>
    </div>
  );
}
