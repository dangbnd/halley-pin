import { redirect } from "next/navigation";

import { isAdminServer } from "@/lib/admin-auth";
import TagsClient from "@/app/admin/tags/tags-client";

export const runtime = "nodejs";

export default async function AdminTagsPage() {
  if (!(await isAdminServer())) redirect("/admin");
  return <TagsClient />;
}
