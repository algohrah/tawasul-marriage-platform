# منصة تواصل للزواج

نسخة تطوير خاصة تعمل حاليًا دون Supabase أو Vercel. البيانات التجريبية تُحفظ محليًا داخل IndexedDB مع طبقة توافق للواجهة الحالية.

## التشغيل المحلي

```bash
npm install
npm run dev
```

ثم افتح `http://localhost:3000`.

للتشغيل المحلي باستخدام البيانات المحلية:

```env
VITE_DATABASE_PROVIDER=local
```

ولتشغيل API Routes مع Supabase، انسخ `.env.example` إلى `.env` وأضف مفتاح Supabase العام في `VITE_SUPABASE_ANON_KEY`. لا تضع مفتاح `service_role` في الواجهة أو في GitHub.

## حساب الإدارة التجريبي

- البريد: `admin@tawafok.com`
- كلمة المرور: `password123`

> حساب تجريبي فقط. لا تستخدم هذه البيانات في الإنتاج.

## وضع البيانات

```env
VITE_DATABASE_PROVIDER=local
```

بيانات كل متصفح مستقلة، وقد يؤدي حذف بيانات الموقع إلى حذفها.

## إعداد Supabase للإنتاج

تم تجهيز المستودع لقاعدة مشروع Supabase `Tawafok` عبر الإعدادات التالية:

```env
VITE_DATABASE_PROVIDER=api
VITE_SUPABASE_URL=https://lzseyykpkputgfvgnddc.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://lzseyykpkputgfvgnddc.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabase publishable/anon key>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<server-only key>
```

ضع هذه القيم في إعدادات الاستضافة (مثل Netlify)، وليس داخل ملفات GitHub. قيمة `SUPABASE_SERVICE_ROLE_KEY` خادمية فقط ولا يجوز كشفها للمتصفح.

> ملاحظة: قاعدة `Tawafok` كانت فارغة وقت إعداد الربط. أُضيف مخطط الجداول والسياسات الأساسية، لكن يجب مراجعة سياسات RLS التفصيلية قبل فتح الوصول المباشر من المتصفح.

## النشر على Netlify

المشروع يستخدم Netlify Functions موحّدة لمسارات `/api/*`. ملف `netlify.toml` يضبط البناء، إعادة التوجيه، ووظيفة API تلقائيًا.

في إعدادات الموقع على Netlify أضف:

```env
VITE_DATABASE_PROVIDER=api
VITE_SUPABASE_URL=https://lzseyykpkputgfvgnddc.supabase.co
VITE_SUPABASE_ANON_KEY=<Supabase publishable/anon key>
NEXT_PUBLIC_SUPABASE_URL=https://lzseyykpkputgfvgnddc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase publishable/anon key>
SUPABASE_SERVICE_ROLE_KEY=<server-only key>
```

بعد الحفظ نفّذ **Deploy site** أو أعد نشر آخر commit. اختبر بعدها:

- `/api/health`
- `/api/members`

يجب أن تعيد المسارات JSON بدل صفحة 404.

## معاينة GitHub Pages

بعد كل تحديث للفرع `main` ينفذ سير العمل `.github/workflows/pages.yml` بناء المعاينة ونشرها. من إعدادات المستودع اختر **Pages → GitHub Actions** كمصدر النشر.

تظل معاينة GitHub Pages مضبوطة على `VITE_DATABASE_PROVIDER=local` لأنها موقع ثابت ولا يشغّل خادم API. استخدم Netlify لتشغيل الربط الكامل مع Supabase.

## الإنتاج لاحقًا

تُحفظ القيم السرية في إعدادات الاستضافة فقط، وليس داخل GitHub.
