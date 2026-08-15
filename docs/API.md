# مرجع API

همه مسیرها زیر `/api` هستند. به‌جز health و readiness، cookie نشست لازم است. bodyهای mutation باید `Content-Type: application/json` داشته باشند.

## احراز هویت

| روش | مسیر | توضیح |
|---|---|---|
| `POST` | `/auth/login` | body: `{username,password}`؛ cookie نشست صادر می‌کند |
| `GET` | `/auth/me` | کاربر نشست فعلی |
| `POST` | `/auth/logout` | حذف نشست فعلی |
| `POST` | `/auth/password` | body: `{currentPassword,newPassword}`؛ حداقل رمز جدید ۱۲ نویسه |

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
