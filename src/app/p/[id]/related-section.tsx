import { prisma } from "@/lib/prisma";
import { r2PublicUrl } from "@/lib/r2-url";
import type { Photo } from "@/lib/photos";

import { RelatedMasonryClient } from "./related-masonry";

const RELATED_TAKE = 24;

function toRelatedPhoto(p: {
  id: string;
  title: string;
  width: number;
  height: number;
  displayKey: string;
  thumbKey: string;
  finalCategory: string;
}): Photo {
  return {
    id: p.id,
    src: r2PublicUrl(p.displayKey),
    thumbSrc: r2PublicUrl(p.thumbKey),
    width: p.width,
    height: p.height,
    title: p.title,
    tags: [],
    // Intentionally omit blurDataURL for related lists to keep HTML/RSC payload tiny.
    blurDataURL: undefined,
    aiCategory: null,
    aiConfidence: 0,
    userCategory: null,
    finalCategory: p.finalCategory,
    classifyStatus: null,
    classifyError: null,
  };
}

export async function RelatedSection({
  photoId,
  finalCategory,
  activeOnly,
  basePath = "",
}: {
  photoId: string;
  finalCategory: string;
  activeOnly: boolean;
  basePath?: string;
}) {
  if (!finalCategory) {
    return (
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <div className="text-sm font-semibold text-zinc-900">Gợi ý cùng chủ đề</div>
          <div className="text-xs text-zinc-500">0 ảnh</div>
        </div>
        <div className="text-sm text-zinc-500">Chưa có ảnh liên quan.</div>
      </section>
    );
  }

  const relatedRaw = await prisma.photo.findMany({
    where: {
      id: { not: photoId },
      finalCategory,
      ...(activeOnly ? { active: true } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RELATED_TAKE,
    select: {
      id: true,
      title: true,
      width: true,
      height: true,
      displayKey: true,
      thumbKey: true,
      finalCategory: true,
    },
  });

  const related = relatedRaw.map(toRelatedPhoto);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <div className="text-sm font-semibold text-zinc-900">Gợi ý cùng chủ đề</div>
        <div className="text-xs text-zinc-500">{related.length} ảnh</div>
      </div>

      {related.length ? (
        <RelatedMasonryClient photos={related} basePath={basePath} />
      ) : (
        <div className="text-sm text-zinc-500">Chưa có ảnh liên quan.</div>
      )}
    </section>
  );
}

export function RelatedSectionFallback() {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between">
        <div className="text-sm font-semibold text-zinc-900">Gợi ý cùng chủ đề</div>
        <div className="text-xs text-zinc-500">…</div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="h-40 w-full animate-pulse rounded-2xl bg-zinc-100 ring-1 ring-black/5"
          />
        ))}
      </div>
    </section>
  );
}
