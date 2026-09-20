-- =====================================================================
-- Migration 0006: Exams table + exam-scoped candidate flow
-- =====================================================================
-- 1) exams table: admin configures a named, publishable exam
-- 2) exam_sections: which categories + question counts belong to an exam
-- 3) exam_id column on quiz_attempts
-- 4) Update create_candidate_attempt to accept p_exam_id (optional, backward-compatible)
-- 5) RLS: anon may read published/active exams only; admins manage all
-- 6) Grants

-- ---------- 1) exams table ----------
create table if not exists public.exams (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  instructions text not null default '',
  slug         text not null unique,
  is_active    boolean not null default false,
  passing_score numeric(5,2) not null default 70.00,
  time_limit_minutes int,
  allow_retakes boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.exams enable row level security;

create index if not exists idx_exams_slug on public.exams(slug);
create index if not exists idx_exams_active on public.exams(is_active) where is_active = true;

-- ---------- 2) exam_sections (exam ↔ categories + per-section question count) ----------
create table if not exists public.exam_sections (
  id               uuid primary key default gen_random_uuid(),
  exam_id          uuid not null references public.exams(id) on delete cascade,
  category_id      uuid not null references public.categories(id) on delete cascade,
  question_count   int not null default 5 check (question_count >= 1),
  unique(exam_id, category_id)
);

alter table public.exam_sections enable row level security;

create index if not exists idx_exam_sections_exam on public.exam_sections(exam_id);

-- ---------- 3) exam_id on quiz_attempts ----------
alter table public.quiz_attempts
  add column if not exists exam_id uuid references public.exams(id) on delete set null;

create index if not exists idx_attempts_exam on public.quiz_attempts(exam_id) where exam_id is not null;

-- ---------- 4) Updated create_candidate_attempt (backward-compatible) ----------
drop function if exists public.create_candidate_attempt(text, text, uuid);

create or replace function public.create_candidate_attempt(p_name text, p_email text default null, p_exam_id uuid default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c_name text := trim(p_name);
  c_email text := coalesce(trim(p_email), '');
  existing public.quiz_attempts;
  a_id uuid;
  cat_list text[] := '{}'::text[];
  counts int[] := '{}'::int[];
  exam_rec public.exams;
  s_rec record;
  i int;
  avail int;
  q_rec record;
  opt_rec record;
  opts jsonb := '[]'::jsonb;
  disp int;
  total_questions int := 0;
begin
  if c_name = '' then
    raise exception 'الاسم مطلوب';
  end if;

  -- استعادة محاولة قيد التنفيذ لنفس المتقدم (نفس السياسة القديمة + exam_id إن وُجد)
  select * into existing
  from public.quiz_attempts
  where status = 'in_progress'
    and lower(candidate_name) = lower(c_name)
    and lower(coalesce(candidate_email, '')) = lower(c_email)
    and (p_exam_id is null or exam_id = p_exam_id)
  order by started_at
  limit 1;

  if existing.id is not null then
    return jsonb_build_object(
      'attempt_id', existing.id,
      'candidate_name', c_name,
      'candidate_email', c_email,
      'status', existing.status,
      'started_at', existing.started_at
    );
  end if;

  -- تحديد الأقسام
  if p_exam_id is not null then
    -- استخدام إعدادات الامتحان المحدد
    select * into exam_rec from public.exams where id = p_exam_id;
    if exam_rec.id is null then
      raise exception 'الامتحان غير موجود';
    end if;
    if not exam_rec.is_active then
      raise exception 'هذا الامتحان غير نشط أو غير متاح حاليًا';
    end if;

    for s_rec in
      select es.question_count, c.slug
      from public.exam_sections es
      join public.categories c on c.id = es.category_id
      where es.exam_id = p_exam_id
      order by c.name
    loop
      cat_list := cat_list || s_rec.slug;
      counts := counts || s_rec.question_count;
    end loop;

    if cardinality(cat_list) = 0 then
      raise exception 'هذا الامتحان لا يحتوي على أقسام';
    end if;
  else
    -- السلوك القديم: جميع الأقسام النشطة بإعداداتها الافتراضية
    for s_rec in
      select c.slug, c.id, coalesce(qs.question_count_default, 10) as cnt
      from public.categories c
      left join public.quiz_settings qs on qs.category_id = c.id
      where c.is_active = true
      order by c.name
    loop
      cat_list := cat_list || s_rec.slug;
      counts := counts || s_rec.cnt;
    end loop;

    if cardinality(cat_list) = 0 then
      raise exception 'لا توجد أقسام نشطة';
    end if;
  end if;

  -- التحقق من توفر الأسئلة
  for i in 1..cardinality(cat_list) loop
    select count(*) into avail
    from public.questions q
    join public.categories c on c.id = q.category_id
    where c.slug = cat_list[i] and q.is_active and c.is_active;

    if avail < counts[i] then
      raise exception 'عدد الأسئلة المتاحة في قسم % غير كافٍ (المتاح % والمطلوب %)', cat_list[i], avail, counts[i];
    end if;
  end loop;

  -- إنشاء المحاولة
  a_id := gen_random_uuid();
  insert into public.quiz_attempts (id, category_filter, exam_id, candidate_name, candidate_email, status)
  values (a_id, cat_list, p_exam_id, c_name, c_email, 'in_progress');

  -- لقطة الأسئلة
  disp := 0;
  for i in 1..cardinality(cat_list) loop
    for q_rec in
      select q.*, c.name as cat_name
      from public.questions q
      join public.categories c on c.id = q.category_id
      where c.slug = cat_list[i] and q.is_active and c.is_active
      order by random()
      limit counts[i]
    loop
      opts := '[]'::jsonb;
      for opt_rec in
        select o.id, o.option_text
        from public.question_options o
        where o.question_id = q_rec.id
        order by random()
      loop
        opts := opts || jsonb_build_object(
          'option_id', opt_rec.id,
          'option_text', opt_rec.option_text,
          'display_order', opt_rec.sort_order
        );
      end loop;

      insert into public.attempt_questions
        (attempt_id, question_id, question_text_snapshot, category_id, category_name,
         explanation_snapshot, correct_option_id, option_order, display_order)
      values
        (a_id, q_rec.id, q_rec.question_text, q_rec.category_id, q_rec.cat_name,
         q_rec.explanation, (select o.id from public.question_options o
                             where o.question_id = q_rec.id and o.is_correct limit 1),
         opts, disp);

      disp := disp + 1;
      total_questions := total_questions + 1;
    end loop;
  end loop;

  if total_questions = 0 then
    raise exception 'لا توجد أسئلة متاحة للاختبار';
  end if;

  return jsonb_build_object(
    'attempt_id', a_id,
    'candidate_name', c_name,
    'candidate_email', c_email,
    'status', 'in_progress',
    'started_at', now()
  );
end;
$$;

-- ---------- 5) RLS ----------
-- anon: قراءة الامتحانات النشطة فقط (للعرض)
create policy "anon reads active exams" on public.exams
  for select to anon, authenticated
  using (is_active = true);

-- anon: قراءة أقسام الامتحانات (عبر الامتحان نفسه)
create policy "anon reads exam sections via exam" on public.exam_sections
  for select to anon, authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and e.is_active = true));

-- admin: إدارة كاملة
create policy "admin manages exams" on public.exams
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "admin manages exam sections" on public.exam_sections
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- تحديث quiz_attempts: المحاولات التي تحتوي على candidate_name تُقرأ عبر الدوال فقط
-- (RLS موجود بالفعل من Migration 0001/0003 - نتركه)

-- ---------- 6) Grants ----------
grant select on public.exams to anon, authenticated;
grant select on public.exam_sections to anon, authenticated;

grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.exam_sections to authenticated;

-- منح تنفيذ الدالة المحدثة لـ anon و authenticated
grant execute on function public.create_candidate_attempt(text, text, uuid) to anon, authenticated;
