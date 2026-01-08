# Photo Gallery Ultimate

Gallery ảnh + upload **Cloudflare R2** + Prisma + hệ thống **classification chạy nền** (không block API).

## Vì sao bản này “chạy ổn” hơn?
- Không commit `.next`, `.env`, DB thật.
- Không chạy AI trong API request (tránh timeout/OOM).
- Tags many-to-many (query nhanh, đúng chuẩn).
- Category rõ ràng:
  - `userCategory` (manual override)
  - `aiCategory` (gợi ý)
  - `finalCategory = userCategory ?? aiCategory ?? "uncategorized"`
- Gallery virtualized (không render vô hạn DOM).

## 1) Yêu cầu
- Node.js >= 20
- Postgres (prod) + Cloudflare R2 bucket + custom domain (khuyến nghị)

## 2) Cài đặt
```bash
npm install
cp .env.example .env
```
Điền env theo `.env.example` (DB + R2 + admin secrets).

## 3) DB + Prisma
```bash
npx prisma migrate dev
npx prisma generate
```

## 4) Chạy app
```bash
npm run dev
```
- Gallery: `http://localhost:3000/gallery`
- Upload (admin-only): `http://localhost:3000/upload`

## 5) Chạy worker (classification jobs)
```bash
npm run worker
```

## Notes
- Upload dùng **presigned PUT**: browser upload thẳng lên R2, server chỉ xử lý resize + lưu DB.
- Để ảnh load nhanh và cache tốt, app tự tạo 2 size (`full.webp`, `thumb.webp`) và set cache headers.
