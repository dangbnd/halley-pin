import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { GalleryClient } from "@/app/gallery/gallery-client";
import { isAdminServer } from "@/lib/admin-auth";

export default async function AdminGalleryPage() {
  if (!(await isAdminServer())) redirect("/admin");

  return (
    <div className="grain min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <GalleryClient isAdmin basePath="/admin" />
      </main>
    </div>
  );
}
