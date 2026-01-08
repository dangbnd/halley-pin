import { NextResponse } from "next/server";
import { isAdminServer } from "@/lib/admin-auth";

export async function GET() {
  return NextResponse.json({ isAdmin: await isAdminServer() });
}
