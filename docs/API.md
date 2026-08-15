# مرجع API

همه مسیرها زیر `/api` هستند. به‌جز health و readiness، cookie نشست لازم است. bodyهای mutation باید `Content-Type: application/json` داشته باشند.

## احراز هویت

| روش | مسیر | توضیح |
|---|---|---|
| `POST` | `/auth/login` | body: `{username,password}`؛ cookie نشست صادر می‌کند |
| `GET` | `/auth/me` | کاربر نشست فعلی |
| `POST` | `/auth/logout` | حذف نشست فعلی |
| `POST` | `/auth/password` | body: `{currentPassword,newPassword}`؛ حداقل رمز جدید ۱۲ نویسه |

فیلد `mustChangePassword` در پاسخ login و `/auth/me` مشخص می‌کند حساب هنوز از رمز موقت استفاده می‌کند.

## مدیریت کاربران

همه مسیرهای این بخش فقط برای نقش `supervisor` مجازند.

| روش | مسیر | توضیح |
|---|---|---|
| `GET` | `/admin/users` | فهرست کاربران همراه وضعیت قفل، نیاز به تغییر رمز و تعداد نشست فعال |
| `POST` | `/admin/users` | ایجاد حساب با `name`, `username`, `team`, `role`, `active`, `training`, `password` |
| `PATCH` | `/admin/users/:id` | ویرایش مشخصات، نقش، آموزش‌ها و وضعیت فعال حساب |
| `POST` | `/admin/users/:id/reset-password` | body: `{password}`؛ ثبت رمز موقت و ابطال تمام نشست‌های کاربر |
| `POST` | `/admin/users/:id/unlock` | پاک‌کردن قفل و شمارنده ورود ناموفق |

نام کاربری باید ۳ تا ۳۲ نویسه از حروف لاتین، عدد، `.`, `_` یا `-` باشد و رمز موقت حداقل ۱۲ نویسه داشته باشد. حذف فیزیکی کاربر انجام نمی‌شود؛ غیرفعال‌سازی نشست‌ها را باطل و ارتباط audit و درخواست‌های قبلی را حفظ می‌کند. حساب سرپرست جاری و آخرین سرپرست فعال قابل تنزل یا غیرفعال‌سازی نیستند.

## عملیات

| روش | مسیر | نقش | توضیح |
|---|---|---|---|
| `GET` | `/state` | همه کاربران واردشده | snapshot داشبورد |
| `POST` | `/requests` | همه کاربران واردشده | body: `toolId, quantity, purpose, neededUntil, priority` و در اضطراری `emergencyReason` |
| `POST` | `/requests/:id/action` | انباردار/سرپرست | action یکی از `approve`, `reject`, `checkout`, `return`; بازگشت condition و notes دارد |
| `POST` | `/tools/:id/service` | انباردار/سرپرست | body: `{quantity}` برای آزادسازی ابزار تعمیرشده |

## سلامت

`GET /health` فقط زنده بودن فرایند را می‌سنجد. `GET /ready` با اجرای query روی SQLite آماده بودن سرویس را بررسی می‌کند.

## خطاها

پاسخ خطا شکل `{ "error": "..." }` دارد. `400` ورودی نامعتبر، `401` نشست نامعتبر/منقضی، `403` مبدأ یا نقش نامعتبر، `404` منبع ناموجود، `409` transition یا موجودی ناسازگار و `429` محدودیت ورود است. هدر `X-Request-Id` برای پیگیری log برگردانده می‌شود.

نمونه ثبت درخواست:

```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/requests \
  -H 'Content-Type: application/json' \
  -d '{"toolId":"t1","quantity":1,"purpose":"تعویض موتور","neededUntil":"2030-01-01T12:00","priority":"normal"}'
```
