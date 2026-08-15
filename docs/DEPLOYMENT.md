# راهنمای استقرار

## پیش‌نیاز

Node.js 24 یا جدیدتر برای اجرای مستقیم، یا Docker/Compose برای اجرای کانتینری لازم است. یک نام دامنه، گواهی TLS و یک secret حداقل ۱۲ نویسه‌ای برای رمز اولیه تهیه کنید.

## Docker Compose

```bash
copy .env.example .env
```

در `.env` این مقادیر را با مقدار واقعی جایگزین کنید:

```dotenv
APP_ORIGIN=https://tools.example.com
COOKIE_SECURE=true
TRUST_PROXY=true
TOOLMANAGER_INITIAL_PASSWORD=<unique-secret>
```

سپس:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

volume `toolmanager_data` تنها محل نوشتن سرویس است. `read_only` بودن root filesystem، پورت loopback و healthcheck در Compose فعال‌اند.

## Reverse proxy

نمونه حداقلی Nginx:

```nginx
server {
  listen 443 ssl http2;
  server_name tools.example.com;
  ssl_certificate /etc/letsencrypt/live/tools.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/tools.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

HTTP را به HTTPS redirect کنید. مقدار `APP_ORIGIN` باید دقیقاً scheme، host و port عمومی را شامل شود.

## اجرای مستقیم

```bash
npm ci
npm ci --prefix server
npm ci --prefix client
npm run build
NODE_ENV=production APP_ORIGIN=https://tools.example.com COOKIE_SECURE=true TOOLMANAGER_INITIAL_PASSWORD=<secret> npm start
```

در Windows، متغیرها را از `.env` یا سرویس مدیریت فرآیند تنظیم کنید؛ از قرار دادن secret در command history خودداری کنید.

## ایجاد و مدیریت حساب

در اولین database چهار حساب seed ساخته می‌شود: `ali`، `maryam`، `hossein` و `zahra`. همه رمز اولیه env را می‌گیرند و باید بعد از نخستین ورود رمز را تغییر دهند. نسخه فعلی پنل مدیریت کاربر ندارد؛ افزودن یا غیرفعال‌سازی حساب باید به‌عنوان تغییر کنترل‌شده داده/کد و با backup انجام شود. برای سازمان دارای directory مرکزی، OIDC/SSO مسیر توسعه پیشنهادی است.

## ارتقا

1. از volume داده backup بگیرید.
2. image جدید را build کنید.
3. `docker compose up -d --build` را اجرا کنید.
4. `/api/ready` و ورود کاربر را بررسی کنید.

مهاجرت schema در startup انجام می‌شود و داده موجود حفظ می‌شود. در استقرار چند replica، تا زمان جایگزینی لایه state با database server مستقل، فقط یک replica اجرا کنید.
