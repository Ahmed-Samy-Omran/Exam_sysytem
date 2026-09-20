# إعداد Supabase

## 1) إنشاء المشروع

- من [dashboard.supabase.com](https://supabase.com/dashboard) أنشئ مشروعًا جديدًا،
  ثم انسخ من صفحة **Project Settings → API** القيمتين:
  - `Project URL` → `VITE_SUPABASE_URL`
  - `anon public` → `VITE_SUPABASE_ANON_KEY`

## 2) تنفيذ المخطط والـ RPC (مرة واحدة)

من **SQL Editor** نفّذ بالترتيب:

- `supabase/migrations/0001_initial.sql`
- `supabase/migrations/0002_submit_attempt.sql`
- `supabase/migrations/0003_rls_fixes.sql`
- `supabase/migrations/0004_candidate_flow.sql` (تدفق دخول المتقدم)
- `supabase/migrations/0005_public_grants.sql` (أذونات الجداول المطلوبة)
- `supabase/migrations/0006_exams.sql` (جدول الامتحانات والنشر)
- `supabase/migrations/0007_retakes_and_passing.sql` (سياسة إعادة المحاولة + درجة النجاح + المؤقت)
- `supabase/seed.sql` (بيانات أولية)

> **البديل الأسهل:** انسخ محتوى ملف **`supabase/apply_all.sql`** مرة واحدة والصقه في SQL Editor ثم Run —
> يطبّق كل ما سبق (المخطط + التصحيح + RLS + البيانات + ربط حساب أول مدير).

## 3) البيانات الأولية

نفّذ `supabase/seed.sql`:

- 3 أقسام (accounting / iq / excel) بإعدادات ديناميكية.
- ~30 سؤالًا موزعًا على الأقسام.
- صفوف `quiz_settings` (عدد افتراضي، درجة النجاح 70، وقت اختياري).

> جميع البيانات تُعالج داخل `seed_question()` مؤقّتة تُحذف بعد التنفيذ.

## 4) إضافة أول مدير

1. من صفحة `/admin/login` سجّل دخولًا بأي بريد باستخدام **Email Auth**.
2. من SQL Editor شغّل الناتج التالي وتعويض `'you@example.com'`:

```sql
insert into public.admin_users (user_id, email)
values ((select id from auth.users where email = 'you@example.com'), 'you@example.com')
on conflict (user_id) do nothing;
```

يتحقق التطبيق من جدول `admin_users` — ولو بعدّة أسطر.
> ملاحظة أمنية: اشترط إنشاء حساب واحد فقط مسبقًا بواسطة "Confirm email" أو إنهماكة الدعوات.
> لإغلاق التسجيل الذاتي: Authentication → Providers → Email →
> إيقاف **Enable Sign ups**.

## 5) إعدادات Auth (مهم)

- **Site URL**: ضع رابط الموقع (مثل `https://ahmed.github.io/exam-website/`).
- **Redirect URLs**: أضف نفس الرابط.
- هذا ضروري حتى ينجح تسجيل الدخول للمدير بعد تسليم النشر.

## 6) ملف البيئة والنشر

```bash
# محليًا
cp .env.example .env.local
# ضع القيمتين ثم:
npm run dev
```

عند النشر عبر GitHub Pages أضف مفتاحين في أسرار المستودع
(**Settings → Secrets and variables → Actions**):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 7) RLS — قرار الوصول

طُبِّقت الحماية التالية:

| الجدول            | من يُقرأ؟                              | من يكتب؟                                |
| ----------------- | -------------------------------------- | --------------------------------------- |
| `categories`      | العامة (عبر View) + المدير             | المدير (سجّل الدخول) فقط                |
| `questions`       | العامة عبر View بدون `is_correct`      | المدير فقط (كل المدير = مستخدم Auth في الجدول) |
| `question_options`| العامة عبر View بدون `is_correct`      | المدير فقط                              |
| `quiz_attempts`   | كل متقدم (لنفسه فقط للRPC)             | عبر RPC فقط                             |
| `quiz_settings`   | العامة                              | المدير فقط                              |
| `admin_users`     | من يكتب سطر نفسه                      | (يدويًا عبر SQL)                       |

> `submit_attempt` يعيد المراجعة كاملة لكن **الصواب/الخاطئ** يُحسب في البريد؛
> لا يوجد عمود `is_correct` في أي View عام.

## الاختبار السريع

من SQL Editor:

```sql
select * from public.vw_attempt_review
where attempt_id = (select id from quiz_attempts order by started_at desc limit 1);
```