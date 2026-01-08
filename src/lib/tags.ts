import "server-only";
import { prisma } from "@/lib/prisma";

export function normalizeTagName(t: string) {
  return t.trim().toLowerCase().replace(/\s+/g, "-");
}

export async function connectTagsToPhoto(photoId: string, tags: string[]) {
  const clean = Array.from(
    new Set(tags.map(normalizeTagName).filter((x) => x && x.length <= 40))
  );
  if (!clean.length) return;

  await prisma.photo.update({
    where: { id: photoId },
    data: {
      tags: {
        connectOrCreate: clean.map((name) => ({
          where: { name },
          create: { name },
        })),
      },
    },
  });
}
