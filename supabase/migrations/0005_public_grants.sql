-- Migration 0005: إصلاح الأذونات المفقودة (GRANTs)
-- السياسات (RLS) وُجدت في 0001/0003 لكن غابت أذونات الجداول الأساسية،
-- فترجع الاستعلامات خطأ 42501 (permission denied for table ...) عند استخدام anon/authenticated.

-- إعدادات الأقسام: يحتاجها المتقدم على صفحة "إعداد الاختبار" بدون تسجيل دخول (anon)
grant select on public.quiz_settings to anon, authenticated;

-- جداول الإدارة: للمصادَّق (عضو admin_users عبر سياسات RLS) — قراءة وكتابة
grant select, insert, update, delete on public.categories       to authenticated;
grant select, insert, update, delete on public.questions        to authenticated;
grant select, insert, update, delete on public.question_options to authenticated;
grant select, insert, update, delete on public.quiz_settings    to authenticated;

-- نتائج ومحاولات: قراءة المدير فقط (الكتابة عبر دوال security definer)
grant select on public.quiz_attempts      to authenticated;
grant select on public.attempt_questions  to authenticated;
grant select on public.attempt_answers    to authenticated;

-- صف المدير الخاص بالمستخدم فقط (سياسة "users view own admin row")
grant select on public.admin_users to authenticated;