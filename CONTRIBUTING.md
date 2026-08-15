# مشارکت در توسعه

پیش‌نیاز توسعه Node.js 24 یا جدیدتر است. وابستگی‌ها را با `npm install` و `npm run install:all` نصب و برنامه را با `npm run dev` اجرا کنید.

پیش از ارسال تغییر:

```bash
npm run check
```

تغییرهای API باید آزمون متناظر در `server/test/` داشته باشند. تغییر رابط باید در عرض‌های 375 و 1440 پیکسل بررسی شود و ناوبری صفحه‌کلید، focus، متن خطا و حالت loading حفظ شود. داده واقعی، `.env`، SQLite، log و خروجی build را commit نکنید.

commitها را کوچک و دستوری بنویسید، برای نمونه `Add password rotation endpoint`. در pull request مسئله، رفتار جدید، روش آزمون و هر اثر مهاجرتی را ذکر کنید.
