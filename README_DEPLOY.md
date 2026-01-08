# Deploy / triển khai

Dự án: Next.js (App Router) + Prisma + **Cloudflare R2** + UI kiểu Pinterest.

## 1) Yêu cầu
- Node.js 18+ (khuyến nghị 20+)
- NPM
- (Production) **Postgres** (Vercel serverless không phù hợp với SQLite file)

## 2) Cấu hình env
Tạo file `.env` từ `.env.example` và điền:

- **DATABASE_URL** (Postgres)
- **R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET**
- **NEXT_PUBLIC_R2_PUBLIC_BASE_URL**
  - khuyến nghị: custom domain trỏ vào bucket (ví dụ: `https://images.yourdomain.com`)

- **Admin login**
  - `ADMIN_PASSWORD`
  - `ADMIN_COOKIE_SECRET` (>= 32 ký tự, random)

> Tuỳ chọn:
> - `ADMIN_TOKEN`, `PHOTO_DELETE_TOKEN`, `ENABLE_CLASSIFICATION`, `KEEP_ORIGINAL`.

## 3) Chạy local
```bash
npm i
npx prisma generate
npx prisma migrate dev
npm run dev
```

Mở:
- Gallery: `http://localhost:3000/gallery`
- Admin login: `http://localhost:3000/admin`

## 4) Deploy production (gợi ý)
### Vercel
- Dùng Postgres (Neon/Supabase/Railway…)
- Set env vars trong dashboard (giống `.env`)
- Build: `npm run build`

**Prisma migration trên Vercel**
- Chạy migrate trong CI/CD trước khi deploy:
  ```bash
  npx prisma migrate deploy
  ```

## 5) Nếu gặp lỗi “table Photo does not exist”
Bạn chưa migrate DB:
```bash
npx prisma migrate dev
```
