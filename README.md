# منصة الاختبارات

منصة تدريبية عربية لأداء اختبار عشوائي من ثلاثة أقسام:
**محاسبة، رياضيات IQ، Excel** — مع تصحيح فوري ومراجعة مفصلة للإجابات، ولوحة تحكم للمدير.

- تصحيح **خادم-مركزي**: الإجابة الصحيحة لا تُرسل للمتصفح أثناء الاختبار (مخزّنة في ملف View لا يعرّضها).
- خلط عشوائي للأسئلة والاختيارات.
- مؤقّت اختياري لكل قسم.
- أرشيف أسئلة + بحث وتصفية في لوحة الإدارة.

## التقنيات

- Vite + React 19 + TypeScript + Tailwind CSS v4
- Supabase (PostgreSQL + Auth) للبيانات
- HashRouter → مناسب للنشر الثابت على GitHub Pages
- Vitest + Testing Library للاختبارات (وحدة محرّك الاختبار)
- oxlint

## التشغيل محليًا

> بدون مفاتيح Supabase تعمل المنصة **في وضع محاكاة (mock)** داخل المتصفح
> مع بيانات تجريبية — يتضح ذلك بشريط برتقالي أعلى الصفحة.

```bash
npm install
npm run dev
```

- المتقدم: `http://localhost:5173`
- لوحة الإدارة (وضع المحاكاة): `http://localhost:5173/#/admin/login`
  - البريد: `admin@example.com` | كلمة المرور: `admin123`

## التحقق

```bash
npm test        # اختبارات الوحدة
npm run lint    # oxlint
npm run build   # typecheck + بناء الإنتاج
```

## إعداد Supabase فعليًا

1. أنشئ مشروعًا جديدًا في [supabase.com](https://supabase.com).
2. نفّذ الملفات التالية (من نافذة "SQL Editor") — أو انسخ محتوى **`supabase/apply_all.sql`** مرة واحدة والصقه ثم Run:
   - `supabase/migrations/0001_initial.sql`
   - `supabase/migrations/0002_submit_attempt.sql`
   - `supabase/migrations/0003_rls_fixes.sql`
   - `supabase/migrations/0004_candidate_flow.sql`
   - `supabase/migrations/0005_public_grants.sql`
   - `supabase/migrations/0006_exams.sql`
   - `supabase/migrations/0007_retakes_and_passing.sql`
   - `supabase/seed.sql`
3. نفّذ `supabase/seed.sql` للبيانات التجريبية (أقسام + أسئلة + إعدادات).
4. أضف أول مدير بأمر SQL (يُطلب من المستخدم تسجيل الدخول من صفحة `/admin/login` ثم تنفيذ السطر الذي يحوّل `auth.uid()` إلى مدير — انظر نهاية `seed.sql`).
5. الإعدادات الكاملة: `docs/setup-supabase.md`.

## النشر على GitHub Pages

```bash
git add .
git commit -m "build: exam platform"
git push origin main
```

تتولى GitHub Actions (`.github/workflows/deploy.yml`) البناء والاختبار والنشر تلقائيًا.
أضف الأسرار في إعدادات المستودع:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## البنية

```
src/
  components/   مكونات واجهة عامة + ModeBanner
  lib/
    quiz-engine.ts        محرّك الاختبار (نقي، مختبَر)
    repository.ts         بوابة البيانات (interface)
    repository/supabase.ts  تنفيذ حقيقي عبر Supabase
    repository/mock.ts      تنفيذ محاكاة للتطوير
    repository/factory.ts   اختيار التنفيذ حسب المتغيرات
  pages/
    Home / QuizSetup / QuizRunner / QuizResult / About / NotFound
  pages/admin/  لوحة الإدارة (سجل دخول، إحصائيات، أسئلة، أقسام، إعدادات)
supabase/
  migrations/   مخطط قاعدة البيانات + RPC التصحيح
  seed.sql      بيانات تجريبية + تعليمات أول مدير
```

## المراجع

- [خطة المنصة — النسخة المُحسّنة](/home/ahmed-omran/Downloads/exam-platform-plan-v2-ar.md)
- تصميمات الأنظمة والواجهات في `design-system/`