import { redirect } from "next/navigation";
import { isAdminServer } from "@/lib/admin-auth";

export default async function HomePage() {
  // Keep URLs explicit: guests use /gallery, admin works under /admin/*
  if (await isAdminServer()) redirect("/admin/gallery");
  redirect("/gallery");
}
