"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 rounded-full border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none shadow-sm focus:ring-2 focus:ring-black/15 focus:ring-offset-2 focus:ring-offset-white",
        className
      )}
      {...props}
    />
  );
}
