import "server-only";
import { prisma } from "@/lib/prisma";
import { keyToLabelFallback, parseTagsInput } from "@/lib/tag-utils";

export async function connectTagsToPhoto(photoId: string, tags: string[]) {
  const clean = parseTagsInput(tags);
  if (!clean.length) return;

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      tags: {
        connectOrCreate: clean.map((t) => ({
          where: { key: t.key },
          create: { key: t.key, label: t.label || keyToLabelFallback(t.key) },
        })),
      },
    },
  });
}

/**
 * Replace all tags of a photo with a new set (creating missing tags).
 */
export async function setTagsForPhoto(photoId: string, tags: string[]) {
  const clean = parseTagsInput(tags);

  await prisma.$transaction(async (tx) => {
    // ensure tags exist
    for (const t of clean) {
      await tx.tag.upsert({
        where: { key: t.key },
        create: { key: t.key, label: t.label || keyToLabelFallback(t.key) },
        update: t.label ? { label: t.label } : {},
      });
    }

    await tx.photo.update({
      where: { id: photoId },
      data: {
        tags: { set: clean.map((t) => ({ key: t.key })) },
      },
    });
  });
}
