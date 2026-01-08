import { redirect } from "next/navigation";
import { isAdminServer } from "@/lib/admin-auth";
import SyncClient from "@/app/sync/sync-client";

export const runtime = "nodejs";

export default async function AdminSyncPage() {
  if (!(await isAdminServer())) redirect("/admin");
  return <SyncClient />;
}
