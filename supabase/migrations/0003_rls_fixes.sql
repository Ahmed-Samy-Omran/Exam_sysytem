-- Migration 0003: إصلاحات RLS
-- 1) قراءة الإعدادات العامة (anon/authenticated) للمتقدم على صفحة الإعداد
-- 2) قراءة صف المدير الخاص بالمستخدم نفسه فقط (لتفعيل فحص is_admin) — لا يُكشف بريد غيره

-- anyone reads settings
drop policy if exists "anon reads settings" on public.quiz_settings;
create policy "anon reads settings" on public.quiz_settings
  for select to anon, authenticated
  using (true);

-- مستخدم يرى صف الإدارة الخاص به فقط
drop policy if exists "users view own admin row" on public.admin_users;
create policy "users view own admin row" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());