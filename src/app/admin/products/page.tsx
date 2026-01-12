import { redirect } from "next/navigation";

import { isAdminServer } from "@/lib/admin-auth";
import ProductsClient from "@/app/admin/products/products-client";

export const runtime = "nodejs";

export default async function AdminProductsPage() {
  if (!(await isAdminServer())) redirect("/admin");
  return <ProductsClient />;
}
