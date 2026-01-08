# Hướng dẫn chạy / deploy (VI) — Cloudflare R2 + Vercel

Tài liệu này hướng dẫn **setup – chạy local – deploy Vercel – lưu ảnh trên Cloudflare R2** theo cách: *tối ưu, đơn giản, nhanh, gọn, mượt, free-tier-friendly*.

## Kiến trúc upload hiện tại (đã tối ưu cho Vercel)
1) Admin gọi API `/api/r2/sign-upload` ⇒ server tạo **presigned PUT URL** (10 phút).
2) Browser upload file **trực tiếp lên R2** bằng `PUT` (không đi qua Vercel).
3) Browser gọi `/api/photos` (admin-only) với `{ originalKey, title, tags }`.
4) Server (Vercel Function) download 1 lần từ R2, tạo **2 size webp**:
   - `full.webp` (max width 2200)
   - `thumb.webp` (max width 720)
   rồi upload lại lên R2 và lưu DB.
5) Xóa object `incoming/...` để tránh lộ ảnh gốc chưa xử lý.

> **Vì sao hợp lý cho 5.000–10.000 ảnh?**
> - Upload không tốn bandwidth Vercel.
> - Ảnh đã resize + webp ⇒ load nhanh, cache lâu.
> - Key ngẫu nhiên (UUID) ⇒ khó đoán đường dẫn.

---

## 1) Tạo Cloudflare R2 (free tier)
### 1.1 Tạo bucket
- Cloudflare Dashboard → R2 → **Create bucket**.
- Đặt tên bucket (ví dụ `my-gallery`).

### 1.2 Bật public access để hiển thị ảnh
Bạn có 2 lựa chọn:
- **Khuyến nghị:** gán **Custom Domain** vào bucket (ví dụ `images.yourdomain.com`).
- Hoặc bật `r2.dev` (dễ nhưng không đẹp, ít kiểm soát).

### 1.3 Tạo Access Keys
- R2 → **Manage R2 API tokens / Access keys**
- Tạo key pair và lưu lại:
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`
- Lấy `Account ID` (Cloudflare account)

---

## 2) Database cho Vercel
Vercel serverless **không hợp** với SQLite file.
- Dùng Postgres (Neon / Supabase / Railway…).
- Lấy `DATABASE_URL`.

---

## 3) Env vars cần set
Xem `.env.example`. Bắt buộc:
- `DATABASE_URL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`  (ví dụ `https://images.yourdomain.com`)
- `ADMIN_PASSWORD`
- `ADMIN_COOKIE_SECRET`

Tuỳ chọn:
- `KEEP_ORIGINAL="true"` nếu muốn lưu ảnh gốc (mặc định **false**).
- `ENABLE_CLASSIFICATION` nếu muốn chạy AI classify.

---

## 4) Chạy local
```bash
npm i
cp .env.example .env
# điền env
npx prisma migrate dev
npm run dev
```
Mở:
- `http://localhost:3000/gallery`
- `http://localhost:3000/admin`

---

## 5) Deploy Vercel
1) Push repo lên GitHub.
2) Vercel → New Project → import repo.
3) Add Environment Variables (giống `.env`).
4) Build & Deploy.

### Prisma migrate trên production
Chạy:
```bash
npx prisma migrate deploy
```
(đặt trong CI hoặc Vercel Deploy Hook/Workflow).

---

## 6) Bảo mật / “đừng để lộ gì hết”
### 6.1 Admin-only API
- `/api/r2/sign-upload` và `/api/photos` là **admin-only**.
- Cookies admin là HttpOnly, server mới đọc được.

### 6.2 Ảnh public nhưng khó đoán
- Ảnh phải public để guest xem.
- URL chứa key random (`uuid`) + không lộ list ⇒ người ngoài **khó** đoán.

### 6.3 Không lộ metadata nhạy cảm
- App trả về cho guest **không có** tags/adminNote/userCategory/aiCategory.

### 6.4 EXIF
- Sharp `.rotate()` sẽ áp dụng orientation.
- Nếu bạn muốn **strip EXIF triệt để**, ta có thể bật `withMetadata(false)` (hiện tại sharp output webp mặc định không giữ metadata; thường đã sạch).

---

## 7) Mẹo tối ưu cho 5k–10k ảnh
- Luôn dùng `thumb.webp` cho grid, chỉ load `full.webp` khi mở detail/lightbox.
- Cache CDN lâu: code đã set `Cache-Control: public, max-age=31536000, immutable`.
- Nếu sau này muốn “siêu tối ưu”:
  - đưa phần resize sang Cloudflare Workers/Queues (processing async),
  - hoặc dùng Cloudflare Images (paid) để khỏi tự resize.
