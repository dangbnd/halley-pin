import { SiteHeader } from "@/components/layout/site-header";
import { GalleryClient } from "./gallery-client";
import { isAdminServer } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export default async function GalleryPage() {
  const isAdmin = await isAdminServer();
  if (isAdmin) redirect("/admin/gallery");
  return (
    <div className="grain min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <GalleryClient isAdmin={isAdmin} basePath="" />
      </main>
    </div>
  );
}
