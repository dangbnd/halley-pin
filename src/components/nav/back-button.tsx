"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { withViewTransition } from "@/lib/view-transition";

export function BackButton({
  fallbackHref = "/gallery",
  className = "",
}: {
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();

  // Warm up the cache so fallback navigation feels instant.
  useEffect(() => {
    router.prefetch(fallbackHref);
  }, [router, fallbackHref]);

  return (
    <button
      type="button"
      onClick={() => {
        const go = () => {
          // Nếu có history thì back, còn không thì fallback
          if (window.history.length > 1) router.back();
          else router.push(fallbackHref);
        };

        // Wrap in a View Transition (if supported) for a smoother back.
        withViewTransition(go);
      }}
      className={
        "grid h-10 w-10 place-items-center rounded-full bg-white/90 shadow-sm ring-1 ring-black/10 hover:bg-white " +
        className
      }
      aria-label="Back"
    >
      <ArrowLeft className="h-5 w-5 text-zinc-900" />
    </button>
  );
}
