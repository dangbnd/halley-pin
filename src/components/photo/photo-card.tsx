"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/photos";

// ✅ Cache ảnh đã load để khi back về gallery không bị nháy
const LOADED_SRC = new Set<string>();

function StatusPill({ photo }: { photo: Photo }) {
  if (photo.classifyStatus === "queued" || photo.classifyStatus === "processing") {
    return (
      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-zinc-900 shadow-sm ring-1 ring-black/10">
        classifying…
      </span>
    );
  }
  if (photo.classifyStatus === "failed") {
    return (
      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-red-700 shadow-sm ring-1 ring-black/10">
        classify failed
      </span>
    );
  }
  if (photo.userCategory) {
    return (
      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-emerald-700 shadow-sm ring-1 ring-black/10">
        manual
      </span>
    );
  }
  return (
    <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-zinc-900 shadow-sm ring-1 ring-black/10">
      ai {Math.round((photo.aiConfidence ?? 0) * 100)}%
    </span>
  );
}

export function PhotoCard({
  photo,
  href,
  isAdmin = false,
  variant = "grid",
}: {
  photo: Photo;
  href: string;
  isAdmin?: boolean;
  variant?: "grid" | "columns";
}) {
  const router = useRouter();

  const isColumns = variant === "columns";
  const w = photo.width && photo.width > 0 ? photo.width : 1200;
  const h = photo.height && photo.height > 0 ? photo.height : 1200;

  // Feed/grid dùng thumbnail để nhẹ mạng (fallback về ảnh lớn nếu thiếu)
  const imgSrc = photo.thumbSrc || photo.src;

  // ✅ Chỉ blur cho columns (ít item hơn). Grid thì bỏ blur để nhẹ.
  const enableBlur = isColumns && Boolean(photo.blurDataURL);

  // ✅ Nếu ảnh đã từng load trước đó => loaded luôn => back không nháy
  const [loaded, setLoaded] = useState(() => LOADED_SRC.has(imgSrc));

  const handleLoaded = () => {
    LOADED_SRC.add(imgSrc);
    setLoaded(true);
  };
  const preloadFull = () => {
  const src = photo.src; // ảnh full dùng ở detail
    if (!src) return;
    const img = new window.Image();
    img.src = src;
  };
  
  return (
    <div
      className={
        "group relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md hover:ring-black/10 " +
        (isColumns ? "w-full" : "h-full w-full")
      }
      // Help the browser skip rendering offscreen cards for smoother scrolling.
      style={isColumns ? undefined : ({ contentVisibility: "auto", containIntrinsicSize: "300px 400px" } as any)}
    >
      {/* Link overlay + prefetch */}
      <Link
        href={href}
        //prefetch={false} 
        className="absolute inset-0 z-10"
        aria-label={photo.title}
        //onMouseEnter={() => router.prefetch(href)}
        //onTouchStart={() => router.prefetch(href)}
        onPointerDown={preloadFull}
        onTouchStart={preloadFull}
      />
      

      {/* Image */}
      <div className={"relative w-full " + (isColumns ? "" : "h-full")}>
        {/* ✅ Skeleton nền, fade-out khi ảnh load */}
        <div
          className={[
            "absolute inset-0 bg-gray-100 transition-opacity duration-300",
            loaded ? "opacity-0" : "opacity-100 animate-pulse",
          ].join(" ")}
        />

        {isColumns ? (
          <Image
            src={imgSrc}
            alt={photo.title}
            width={w}
            height={h}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            placeholder={enableBlur ? "blur" : "empty"}
            blurDataURL={enableBlur ? photo.blurDataURL : undefined}
            unoptimized
            onLoad={handleLoaded}
            className={[
              "h-auto w-full object-cover transition duration-300 group-hover:scale-[1.02]",
              "transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        ) : (
          <Image
            src={imgSrc}
            alt={photo.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            placeholder={enableBlur ? "blur" : "empty"}
            blurDataURL={enableBlur ? photo.blurDataURL : undefined}
            unoptimized
            onLoad={handleLoaded}
            className={[
              "object-cover transition duration-300 group-hover:scale-[1.02]",
              "transition-opacity duration-300",
              loaded ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        )}

        {/* Overlay gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity duration-200 md:group-hover:opacity-100 md:group-focus-within:opacity-100" />

        {/* Title + category (chỉ hiện khi hover/focus) */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 p-4 opacity-0 transition-opacity duration-200 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <div className="truncate text-sm font-semibold text-white drop-shadow-sm">{photo.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-zinc-900 shadow-sm ring-1 ring-black/10">
              {photo.finalCategory}
            </span>

            {isAdmin ? (
              <>
                <StatusPill photo={photo} />
                {photo.tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] text-zinc-900 shadow-sm ring-1 ring-black/10"
                  >
                    {t}
                  </span>
                ))}
              </>
            ) : null}
          </div>
        </div>

        {/* Tiny dim on hover so the image doesn't fight the text */}
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
      </div>
    </div>
  );
}
