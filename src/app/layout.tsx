import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Photo Gallery Ultimate",
  description: "Masonry gallery + pro upload + lightbox + free AI categorize (Cloudinary + Prisma)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
