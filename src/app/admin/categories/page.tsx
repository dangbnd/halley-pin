import { redirect } from "next/navigation";

import { isAdminServer } from "@/lib/admin-auth";
import CategoriesClient from "@/app/admin/categories/categories-client";

export const runtime = "nodejs";

export default async function AdminCategoriesPage() {
  if (!(await isAdminServer())) redirect("/admin");
  return <CategoriesClient />;
}
