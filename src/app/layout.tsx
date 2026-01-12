import type { Metadata } from "next";
import "./globals.css";
import { CategoriesProvider } from "@/components/providers/categories-provider";
import NextTopLoader from "nextjs-toploader";

export const metadata: Metadata = {
  title: "Photo Gallery Ultimate",
  description: "Masonry gallery + pro upload + lightbox + free AI categorize (Cloudinary + Prisma)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <NextTopLoader showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
