import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-10 w-full rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-500 shadow-sm focus:ring-2 focus:ring-black/15 focus:ring-offset-2 focus:ring-offset-white",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
