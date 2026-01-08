import { redirect } from "next/navigation";
import { isAdminServer } from "@/lib/admin-auth";

export const runtime = "nodejs";

export default async function UploadPage() {
  if (!(await isAdminServer())) redirect("/admin");
  // Keep admin URLs under /admin/*
  redirect("/admin/upload");
}
