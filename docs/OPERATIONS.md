# عملیات و نگه‌داری

## پایش

- `GET /api/health`: liveness فرایند؛ بدون احراز هویت.
- `GET /api/ready`: دسترسی به SQLite؛ برای readiness و healthcheck استفاده شود.
- log خروجی JSON شامل زمان، method، مسیر، status، مدت و `X-Request-Id` است.

خطاهای ۵۰۰ همراه stack در log ثبت می‌شوند؛ رمز، کوکی و body درخواست log نمی‌شوند.

## backup

SQLite در حالت WAL اجرا می‌شود. پیش از کپی فایل، سرویس را متوقف کنید:

```bash
docker compose stop app
docker run --rm -v toolmanager_toolmanager_data:/data -v "$PWD/backups:/backup" alpine sh -c 'tar czf /backup/toolmanager-$(date +%Y%m%d-%H%M).tgz -C /data .'
docker compose start app
```

حداقل یک backup روزانه و یک کپی خارج از میزبان نگه دارید. restore را ابتدا روی محیط آزمایشی بررسی کنید:

```bash
docker compose stop app
docker run --rm -v toolmanager_toolmanager_data:/data -v "$PWD/backups:/backup" alpine sh -c 'rm -rf /data/* && tar xzf /backup/<file>.tgz -C /data'
docker compose start app
```

نام volume را با `docker volume ls` تطبیق دهید؛ از حذف volume بدون backup خودداری کنید.

## چرخش secret و رمزها

`TOOLMANAGER_INITIAL_PASSWORD` فقط در ایجاد database جدید مصرف می‌شود. کاربران باید پس از ورود رمز را از UI عوض کنند. تغییر مقدار env به‌تنهایی رمز حساب‌های موجود را تغییر نمی‌دهد.

سرپرست می‌تواند از پنل مدیریت، رمز موقت جدید ثبت کند؛ این کار تمام نشست‌های کاربر را باطل می‌کند. برای قطع فوری دسترسی نیز حساب را غیرفعال کنید. در رخداد قفل ناشی از ورود ناموفق، پس از احراز هویت فرد از گزینه «باز کردن قفل» استفاده کنید و علت تلاش‌ها را در log و reverse proxy بررسی کنید.

## عیب‌یابی

ابتدا `docker compose ps`، سپس `docker compose logs --tail=200 app` و بعد `/api/ready` را بررسی کنید. اگر cookie امن روی HTTP ارسال نمی‌شود، استقرار را پشت HTTPS ببرید یا فقط در محیط محلی `COOKIE_SECURE=false` تنظیم کنید. در خطای قفل SQLite، تک‌نمونه بودن سرویس و سلامت volume را بررسی کنید.
