"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

export type CommentDTO = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CommentsClient({ photoId, initialComments }: { photoId: string; initialComments: CommentDTO[] }) {
  const [comments, setComments] = useState<CommentDTO[]>(initialComments);
  const [name, setName] = useState("Ẩn danh");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const countLabel = useMemo(() => {
    const n = comments.length;
    return n === 0 ? "Chưa có bình luận" : `${n} bình luận`;
  }, [comments.length]);

  async function submit() {
    const text = content.trim();
    if (!text) return;
    setPosting(true);
    setErr(null);
    try {
      const res = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: name.trim(), content: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ? String(data.error) : `Post failed (${res.status})`);
      }
      const data = (await res.json()) as { item: CommentDTO };
      setComments((prev) => [data.item, ...prev]);
      setContent("");
    } catch (e: any) {
      setErr(e?.message || "Không thể gửi bình luận.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">{countLabel}</div>
      </div>

      {/* Composer (Pinterest-ish) */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-800">
            {(name || "?").trim().slice(0, 1).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên (tuỳ chọn)"
              className="h-9 w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:bg-white focus:ring-2 focus:ring-black/10"
              maxLength={50}
            />

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Viết bình luận..."
              className="mt-2 min-h-[88px] w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-black/10"
              maxLength={1000}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">Enter xuống dòng · Ctrl/⌘+Enter để gửi</div>
              <Button
                variant="primary"
                onClick={submit}
                disabled={posting || !content.trim()}
                className="h-9 px-5"
              >
                {posting ? "Đang gửi…" : "Gửi"}
              </Button>
            </div>

            {err ? <div className="mt-2 text-sm text-red-700">{err}</div> : null}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {comments.map((c) => {
          const initial = (c.authorName || "?").trim().slice(0, 1).toUpperCase();
          return (
            <div key={c.id} className="flex gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-800">
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <div className="font-semibold text-zinc-900">{c.authorName}</div>
                  <div className="text-xs text-zinc-500">{formatTime(c.createdAt)}</div>
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-800">{c.content}</div>
              </div>
            </div>
          );
        })}

        {comments.length === 0 ? <div className="text-sm text-zinc-500">Hãy là người đầu tiên bình luận.</div> : null}
      </div>
    </section>
  );
}
