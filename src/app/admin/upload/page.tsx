import { redirect } from "next/navigation";
import { isAdminServer } from "@/lib/admin-auth";
import UploadClient from "@/app/upload/upload-client";

export const runtime = "nodejs";

export default async function AdminUploadPage() {
  if (!(await isAdminServer())) redirect("/admin");
  return <UploadClient />;
}
