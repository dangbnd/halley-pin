import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-50";

  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-[#e60023] text-white hover:bg-[#ad081b]",
    secondary: "bg-zinc-200 text-zinc-900 hover:bg-zinc-300",
    ghost: "bg-transparent text-zinc-700 hover:bg-black/5",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm: "h-9 px-4 text-sm",
    md: "h-10 px-5 text-sm",
    lg: "h-11 px-6 text-base",
  };

  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
