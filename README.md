# 🧮 TOÁN CÙNG EM - WEBSITE HỌC TOÁN TIỂU HỌC (KHỐI LỚP 2)

Hệ thống website học toán tương tác kết hợp trí tuệ nhân tạo (AI) dành cho Giáo viên và Học sinh tiểu học Lớp 2.

## 🚀 Công nghệ sử dụng
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS v4, Lucide Icons, Framer Motion, Canvas Confetti.
- **Backend & Database:** Supabase (Auth, PostgreSQL DB, Storage, RLS).
- **Trí tuệ nhân tạo (AI):** Google Gemini API / OpenAI API.
- **Excel:** `xlsx` (SheetJS) hỗ trợ nhập/xuất danh sách học sinh.

---

## 🛠️ Hướng dẫn Chạy Cục Bộ (Local)

### 1. Cài đặt thư viện
```bash
npm install
```

### 2. Cấu hình file `.env`
Tạo file `.env` từ mẫu `.env.example`:
```env
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_GEMINI_API_KEY=your-gemini-api-key
```

### 3. Chạy Server Dev
```bash
npm run dev
```
Mở trình duyệt tại: `http://localhost:5173`

---

## 💾 Hướng dẫn Cấu hình Supabase Database

1. Truy cập [Supabase Dashboard](https://supabase.com).
2. Vào mục **SQL Editor**.
3. Sao chép toàn bộ nội dung từ file `supabase_schema.sql` và nhấn **RUN**.
4. Vào mục **Storage** -> Tạo 2 bucket public:
   - `materials`
   - `question-images`

---

## ☁️ Hướng dẫn Deploy lên Vercel

1. Push mã nguồn dự án lên GitHub Repository.
2. Truy cập [Vercel Dashboard](https://vercel.com) -> Nhấn **Add New Project**.
3. Chọn Repository `TOANCUNGEM`.
4. Điền các thông số trong **Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`
5. Nhấn **Deploy**!
