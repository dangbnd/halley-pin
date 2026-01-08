"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type ItemBase = {
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
  danger?: boolean;
};

export type ActionMenuItem =
  | (ItemBase & {
      type?: "action";
      onClick: () => void | Promise<void>;
    })
  | (ItemBase & {
      type: "link";
      href: string;
    })
  | {
      type: "separator";
    };

export function ActionMenu({
  trigger,
  items,
  align = "right",
  openOnHover = false,
}: {
  trigger: ReactNode;
  items: ActionMenuItem[];
  align?: "left" | "right";
  openOnHover?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  // Close on outside click + ESC
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!open) return;
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={
        openOnHover
          ? () => {
              // ignore hover-open on coarse pointers (touch)
              if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return;
              setOpen(true);
            }
          : undefined
      }
      onMouseLeave={
        openOnHover
          ? () => {
              if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return;
              setOpen(false);
            }
          : undefined
      }
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex"
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className={
            "absolute z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg " +
            (align === "right" ? "right-0" : "left-0")
          }
          onClick={(e) => {
            // prevent Link overlay / parent click
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {items.map((it, idx) => {
            if (it.type === "separator") {
              return <div key={`sep-${idx}`} className="my-1 h-px bg-zinc-100" />;
            }

            const Icon = (it as any).icon as LucideIcon | undefined;
            const danger = (it as any).danger;
            const disabled = (it as any).disabled;
            const rowCls =
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition " +
              (danger ? "text-red-600 hover:bg-red-50" : "text-zinc-900 hover:bg-zinc-50") +
              (disabled ? " pointer-events-none opacity-50" : "");

            if ((it as any).type === "link") {
              const link = it as Extract<ActionMenuItem, { type: "link" }>;
              return (
                <Link
                  key={`${link.href}-${idx}`}
                  role="menuitem"
                  href={link.href}
                  className={rowCls}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                >
                  {Icon ? <Icon className="h-4 w-4" /> : null}
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            }

            const action = it as Extract<ActionMenuItem, { onClick: any }>;
            return (
              <button
                key={`${action.label}-${idx}`}
                role="menuitem"
                type="button"
                disabled={disabled}
                className={rowCls}
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setOpen(false);
                  await action.onClick();
                }}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
