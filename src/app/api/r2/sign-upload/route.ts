import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAdminServer } from "@/lib/admin-auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { getR2Bucket, getR2Client } from "@/lib/r2";

export const runtime = "nodejs";

function unauthorized() {
  const r = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}

function sanitizeFileName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80) || "image";
}

export async function POST(req: Request) {
  if (!(await isAdminServer())) return unauthorized();

  const ip = getClientIp(req);
  const rl = rateLimit({ key: `r2:sign:${ip}`, limit: 60, windowMs: 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName : "image";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "application/octet-stream";

  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are allowed" }, { status: 400 });
  }

  const safeName = sanitizeFileName(fileName);
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stamp = now.getTime();
  const rand = crypto.randomUUID();
  const key = `incoming/${y}-${m}/${stamp}_${rand}_${safeName}`;

  const s3 = getR2Client();
  const Bucket = getR2Bucket();

  // Cloudflare recommends generating presigned URLs with AWS SDK v3.
  // ContentType here restricts uploads to the given MIME type.
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }),
    { expiresIn: 10 * 60 }
  );

  const r = NextResponse.json({ key, uploadUrl }, { status: 200 });
  r.headers.set("Cache-Control", "no-store, max-age=0");
  r.headers.set("Vary", "Cookie");
  return r;
}
