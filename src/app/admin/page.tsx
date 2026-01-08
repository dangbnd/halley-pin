import AdminLoginClient from "./ui";
import { isAdminServer } from "@/lib/admin-auth";
import { redirect } from "next/navigation";

export default async function AdminPage() {
  // If already logged in, go straight to admin area.
  if (await isAdminServer()) redirect("/admin/gallery");

  return (
    <div className="grain min-h-screen">
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-semibold text-zinc-900">Admin login</h1>
        <p className="mt-2 text-sm text-zinc-500">Chỉ 1 tài khoản admin duy nhất.</p>
        <div className="mt-6">
          <AdminLoginClient />
        </div>
      </main>
    </div>
  );
}
