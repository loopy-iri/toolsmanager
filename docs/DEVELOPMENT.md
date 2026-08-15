# راهنمای توسعه

## ساختار

- `client/src/App.vue`: shell، صفحه ورود، داشبورد، موجودی، درخواست‌ها و پنل مدیریت کاربران.
- `client/src/style.css`: design tokens، RTL layout، responsive و حالت‌های دسترسی.
- `server/src/index.js`: Express، احراز هویت، مجوز نقش، state transition، SQLite و static serving.
- `server/test/logic.test.js`: آزمون‌های API با Node test runner و database موقت.

## مدل داده

SQLite سه جدول دارد: `app_state` برای snapshot ساختاری کاربران/ابزارها/درخواست‌ها/audit، `accounts` برای نام کاربری، hash رمز، قفل ورود و الزام تغییر رمز، و `sessions` برای token hash و زمان انقضا. تمام mutationهای عملیاتی و مدیریت حساب با `BEGIN IMMEDIATE` اجرا می‌شوند؛ این مدل برای یک نمونه کوچک مناسب است و سقف آن یک replica و اندازه state است.

## جریان توسعه

```bash
npm install
npm run install:all
npm run dev
npm test
npm run build
```

در توسعه Vite مسیر `/api` را به `127.0.0.1:3000` proxy می‌کند. در production، Express فایل‌های `client/dist` را سرو می‌کند.

## قراردادها و اعتبارسنجی

هویت mutation از cookie نشست خوانده می‌شود. `requesterId` و `actorId` نباید از کلاینت اعتماد شوند. transitionهای وضعیت در API متمرکز بمانند و برای هر تغییر audit ثبت شود. خطاهای قابل انتظار با status چهارصد/چهارصد و نه و پیام فارسی برگردند.

مسیرهای `/api/admin/users` فقط نقش `supervisor` را می‌پذیرند. برای حفظ یکپارچگی تاریخچه، حذف کاربر به غیرفعال‌سازی تبدیل شده است. تغییرات این حوزه باید دست‌کم مجوز نقش، آخرین سرپرست، یکتایی نام کاربری و ابطال نشست را در `server/test/logic.test.js` پوشش دهند.

## UI و دسترسی

از عناصر native، label قابل مشاهده، focus ring، `aria-label` برای کنترل‌های آیکونی، target حداقل ۴۴ پیکسل و `prefers-reduced-motion` استفاده کنید. مسیرهای اصلی با hash deep-link می‌شوند و جست‌وجو/فیلتر نباید state را بی‌دلیل reset کند.

## سقف‌های شناخته‌شده

برای چند replica، audit حجیم، گزارش‌گیری پیچیده یا SSO باید snapshot را به PostgreSQL/Oracle و صف/کش را به سرویس مناسب منتقل کرد؛ تا آن زمان این سادگی عمدی است.
