"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { PhotoCard } from "@/components/photo/photo-card";
import type { Photo } from "@/lib/photos";

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

// Pattern span: desktop giữ y như cũ. Mobile/tablet cũng dùng pattern để vibe “lệch” giống desktop.
const SPANS_DESKTOP = [15, 21, 17, 23, 16, 22];
const SPANS_TABLET = [13, 18, 14, 19, 15, 17];
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



export function RelatedMasonryClient({
  photos,
  basePath = "",
}: {
  photos: Photo[];
  /** When rendered under /admin, pass basePath="/admin" so detail links stay in admin area. */
  basePath?: string;
}) {
  const cols = useColumns();
  const gap = 16;
  // Giữ layout “Pinterest” cho mọi breakpoint, kể cả mobile.
  const useGridMasonry = true;
  const rowH = 10;

  const templateColumns = useMemo(
    () => `repeat(${cols}, minmax(0, 1fr))`,
    [cols]
  );

  return useGridMasonry ? (
    <div
      className="grid"
      style={{
        gap: `${gap}px`,
        gridTemplateColumns: templateColumns,
        gridAutoRows: `${rowH}px`,
        gridAutoFlow: "row dense",
      }}
    >
      {photos.map((p, idx) => {
        const span = spanForCols(p.id, idx, cols);
        return (
          <div key={p.id} className="min-w-0" style={{ gridRowEnd: `span ${span}` }}>
            <div className="h-full w-full">
              <PhotoCard photo={p} href={`${basePath}/p/${p.id}`} isAdmin={false} variant="grid" />
            </div>
          </div>
        );
      })}
    </div>
  ) : (
    // unreachable, nhưng giữ lại để tránh diff quá bự nếu bạn đổi ý.
    <div className="hidden" />
  );
}
