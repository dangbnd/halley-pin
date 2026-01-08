import type { NextConfig } from "next";

function getHostnameFromEnv(v?: string) {
  try {
    if (!v) return null;
    return new URL(v).hostname;
  } catch {
    return null;
  }
}

const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL || process.env.R2_PUBLIC_BASE_URL;
const publicHost = getHostnameFromEnv(publicBase);

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  // Cloudflare R2 public endpoints (if you use r2.dev)
  { protocol: "https", hostname: "**.r2.dev" },
  // Sometimes used for direct access (if enabled)
  { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
];

// Custom domain connected to the bucket (recommended)
if (publicHost) {
  remotePatterns.push({ protocol: "https", hostname: publicHost });
}

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns,
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920, 2560, 3200],
  },
};

export default nextConfig;
