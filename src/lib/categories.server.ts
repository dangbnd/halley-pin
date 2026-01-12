import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CATEGORIES, type CategoryItem } from "@/lib/categories";

let _seedPromise: Promise<void> | null = null;

async function ensureSeeded() {
  const count = await prisma.category.count();
  if (count > 0) return;

  // Seed a sensible default set. `skipDuplicates` makes it safe under concurrent calls.
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      order: c.order,
      isActive: c.isActive,
    })),
    skipDuplicates: true,
  });
}

export const getCategoriesServer = cache(async function getCategoriesServer(opts?: { activeOnly?: boolean }) {
  _seedPromise ??= ensureSeeded();
  await _seedPromise;
  const activeOnly = opts?.activeOnly ?? true;

  const rows = await prisma.category.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ order: "asc" }, { label: "asc" }],
  });

  return rows.map(
    (r) =>
      ({
        key: r.key,
        label: r.label,
        order: r.order,
        isActive: r.isActive,
      }) satisfies CategoryItem
  );
});

export const getCategoryLabelMapServer = cache(async function getCategoryLabelMapServer(opts?: { activeOnly?: boolean }) {
  const cats = await getCategoriesServer(opts);
  return new Map<string, string>(cats.map((c) => [c.key, c.label]));
});
