import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { SiteHeader } from "@/components/layout/site-header";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BLUR } from "@/lib/photos";
import { blurDataUrlFromKey } from "@/lib/blur";
import { r2PublicUrl } from "@/lib/r2-url";
import { isAdminServer } from "@/lib/admin-auth";
import { getCategoryLabelMapServer } from "@/lib/categories.server";
import { tagsToText } from "@/lib/tag-utils";
import { BackButton } from "@/components/nav/back-button";

import { CakeInfoClient } from "./cake-info-client";
import { RelatedSection, RelatedSectionFallback } from "./related-section";

export const runtime = "nodejs";

export default async function PinDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const photo = await prisma.photo.findUnique({
    where: { id },
    include: {
      tags: { where: { isActive: true }, select: { key: true, label: true } },
    },
  });

  if (!photo) notFound();

  const isAdmin = await isAdminServer();
  if (isAdmin) redirect(`/admin/p/${id}`);

  // Guests must not see inactive products.
  if (!photo.active) notFound();

  const catMap = await getCategoryLabelMapServer({ activeOnly: true });
  const catLabel = catMap.get(photo.finalCategory) ?? photo.finalCategory;

  return (
    <div className="grain min-h-screen">
      <SiteHeader initialIsAdmin={isAdmin} />

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Detail card */}
        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_420px]">
            {/* LEFT: image block (bo 4 góc) */}
            <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-100 md:max-w-[780px] md:justify-self-center">
                <div className="absolute left-4 top-4 z-20">
                  <BackButton fallbackHref="/gallery" />
                </div>
              <div className="relative w-full aspect-[4/5]">
                <Image
                  src={
                    // Keep a stable 4:5 box via CSS and let the image "contain" inside.
                    // Cloudinary "pad" transforms are nice in theory, but in practice
                    // they can 400-out depending on account/transform settings.
                    r2PublicUrl(photo.displayKey)
                  }
                  alt={photo.title}
                  fill
                  priority
                  unoptimized
                  placeholder="blur"
                  blurDataURL={blurDataUrlFromKey(photo.displayKey) ?? DEFAULT_BLUR}
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 55vw"
                />
              </div>
            </div>

            {/* RIGHT: minimal info */}
            <div className="min-w-0 py-1">
              {/* One clean row: title left, category right */}
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h1 className="min-w-0 truncate text-2xl font-semibold text-zinc-900">{photo.title}</h1>
                <div className="shrink-0 inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 ring-1 ring-black/5">
                  {catLabel}
                </div>
              </div>

              <CakeInfoClient
                photoId={photo.id}
                isAdmin={isAdmin}
                initial={{
                  userCategory: photo.userCategory,
                  finalCategory: photo.finalCategory,
                  adminNote: "",
                  adminNotePublic: false,
                  tagsText: tagsToText(photo.tags.map((t: any) => t.label ?? t.key)),
                }}
              />

              {/* Public info (customers can see) */}
              <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="text-sm font-semibold text-zinc-900">Thông tin</div>

                <div className="mt-3 space-y-3 text-sm text-zinc-800">
                  {photo.priceVisibility === "public" && photo.priceBySize ? (
                    <div>
                      <div className="text-xs font-medium text-zinc-600">Giá (theo size)</div>
                      <div className="mt-1 whitespace-pre-wrap">{photo.priceBySize}</div>
                    </div>
                  ) : null}

                  {photo.descriptionVisibility === "public" && photo.description ? (
                    <div>
                      <div className="text-xs font-medium text-zinc-600">Mô tả</div>
                      <div className="mt-1 whitespace-pre-wrap">{photo.description}</div>
                    </div>
                  ) : null}

                  {photo.tags.length ? (
                    <div>
                      <div className="text-xs font-medium text-zinc-600">Tags</div>
                      <div className="mt-1 text-zinc-800">{tagsToText(photo.tags.map((t: any) => t.label ?? t.key))}</div>
                    </div>
                  ) : null}

                  {!photo.tags.length && !photo.priceBySize && !photo.description ? (
                    <div className="text-zinc-500">Chưa có thông tin.</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Related (streamed, non-blocking for first paint) */}
        <Suspense fallback={<RelatedSectionFallback />}>
          <RelatedSection photoId={photo.id} finalCategory={photo.finalCategory} activeOnly basePath="" />
        </Suspense>
      </main>
    </div>
  );
}
