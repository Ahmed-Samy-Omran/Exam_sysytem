-- منصة اختبارات Accounting / IQ / Excel
-- Migration 0001: Initial schema

-- ---------- 1) جداول ----------

create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  description  text,
  accent_color text not null default '#0D9488',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.questions (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid not null references public.categories(id),
  question_text text not null,
  explanation   text,
  difficulty    text not null default 'medium' check (difficulty in ('easy','medium','hard')),
  is_active     boolean not null default true,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  is_correct  boolean not null default false,
  sort_order  int  not null default 0
);

-- إجابة صحيحة واحدة فقط لكل سؤال (قيد على مستوى قاعدة البيانات)
create unique index if not exists unique_correct_option
  on public.question_options (question_id) where is_correct;

create table if not exists public.quiz_settings (
  id                      uuid primary key default gen_random_uuid(),
  category_id             uuid not null references public.categories(id) on delete cascade,
  question_count_default  int  not null default 10,
  time_limit_minutes      int,
  passing_score           numeric(5,2) not null default 70.00,
  updated_at              timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id               uuid primary key default gen_random_uuid(),
  category_filter  text[] not null default '{all}',
  time_limit_min   int,
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  status           text not null default 'in_progress'
                   check (status in ('in_progress','submitted','abandoned')),
  score_percent    numeric(5,2),
  correct_count    int not null default 0,
  wrong_count      int not null default 0,
  unanswered_count int not null default 0,
  created_at       timestamptz not null default now()
);

-- لقطة السؤال وقت إنشاء المحاولة (ثبات النتيجة مهما تغيّر بنك الأسئلة)
create table if not exists public.attempt_questions (
  id                      uuid primary key default gen_random_uuid(),
  attempt_id              uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id             uuid not null references public.questions(id),
  question_text_snapshot  text not null,
  category_id             uuid not null,
  category_name           text not null,
  explanation_snapshot    text,
  correct_option_id       uuid not null,                     -- داخل DB فقط، لا يُصدر للعميل
  option_order            jsonb not null,                    -- [{option_id, option_text, display_order}]
  display_order           int  not null
);

create table if not exists public.attempt_answers (
  id                   uuid primary key default gen_random_uuid(),
  attempt_question_id  uuid not null references public.attempt_questions(id) on delete cascade,
  chosen_option_id     uuid references public.question_options(id),
  is_correct           boolean,
  answered_at          timestamptz not null default now()
);

-- أول مدير + أعضاء الإدارة
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- 2) فهارس ----------

create index if not exists idx_questions_category  on public.questions(category_id);
create index if not exists idx_options_question    on public.question_options(question_id);
create index if not exists idx_attempt_questions   on public.attempt_questions(attempt_id);
create index if not exists idx_attempt_answers     on public.attempt_answers(attempt_question_id);
create index if not exists idx_attempts_created    on public.quiz_attempts(created_at desc);
create index if not exists idx_settings_category   on public.quiz_settings(category_id);

-- ---------- 3) Views عامة بلا إجابات ----------

create or replace view public.public_categories as
  select id, name, slug, description, accent_color, created_at
  from public.categories
  where is_active = true;

create or replace view public.public_questions as
  select q.id, q.category_id, q.question_text, q.difficulty, c.slug as category_slug
  from public.questions q
  join public.categories c on c.id = q.category_id
  where q.is_active = true and c.is_active = true;

create or replace view public.public_question_options as
  select o.id, o.question_id, o.option_text, o.sort_order
  from public.question_options o
  join public.questions q on q.id = o.question_id
  join public.categories c on c.id = q.category_id
  where q.is_active = true and c.is_active = true;

grant select on public.public_categories, public.public_questions, public.public_question_options to anon, authenticated;

-- ---------- 4) دوال (RPC) ----------

-- إنشاء محاولة: اختيار عشوائي + لقطة كاملة، دون تسريب أي إجابة
create or replace function public.create_attempt(
  cat_filter text[],
  counts int[],
  time_limit_min int default null
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  a_id uuid := gen_random_uuid();
  total_questions int := 0;
  avail int;
  i int;
  q_rec record;
  opt_rec record;
  opts jsonb := '[]'::jsonb;
  disp int;
  q_list jsonb := '[]'::jsonb;
begin
  if cat_filter is null or cardinality(cat_filter) = 0 then
    raise exception 'يجب تحديد الأقسام';
  end if;

  for i in 1..cardinality(cat_filter) loop
    select count(*) into avail
    from public.questions q
    join public.categories c on c.id = q.category_id
    where c.slug = cat_filter[i] and q.is_active and c.is_active;

    if avail < counts[i] then
      raise exception 'عدد الأسئلة المتاحة في قسم % غير كافٍ (المتاح % والمطلوب %)', cat_filter[i], avail, counts[i];
    end if;
  end loop;

  insert into public.quiz_attempts (id, category_filter, time_limit_min)
  values (a_id, cat_filter, time_limit_min);

  disp := 0;
  for i in 1..cardinality(cat_filter) loop
    for q_rec in
      select q.*, c.name as cat_name
      from public.questions q
      join public.categories c on c.id = q.category_id
      where c.slug = cat_filter[i] and q.is_active and c.is_active
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

      q_list := q_list || jsonb_build_object(
        'question_id', q_rec.id,
        'question_text', q_rec.question_text,
        'category_id', q_rec.category_id,
        'category_name', q_rec.cat_name,
        'difficulty', q_rec.difficulty,
        'options', opts
      );
      disp := disp + 1;
      total_questions := total_questions + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'attempt_id', a_id,
    'total', total_questions,
    'time_limit_min', time_limit_min,
    'questions', q_list
  );
end;
$$;

-- استرجاع محاولة قيد التنفيذ (عند تحديث الصفحة) — بدون أي إجابات صحيحة
create or replace function public.get_attempt(a_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
stable
as $$
declare
  att public.quiz_attempts;
  q_list jsonb := '[]'::jsonb;
begin
  select * into att from public.quiz_attempts where id = a_id;
  if att is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if att.status <> 'in_progress' then
    raise exception 'هذه المحاولة أُرسلت بالفعل';
  end if;

  select coalesce(jsonb_agg(row order by row->>'display_order'), '[]'::jsonb) into q_list
  from (
    select jsonb_build_object(
      'question_id', aq.question_id,
      'question_text', aq.question_text_snapshot,
      'category_id', aq.category_id,
      'category_name', aq.category_name,
      'difficulty', 'medium',
      'display_order', aq.display_order,
      'options', (
        select jsonb_agg(jsonb_build_object(
          'option_id', (o->>'option_id')::uuid,
          'option_text', o->>'option_text'
        ) order by (o->>'display_order')::int)
        from jsonb_array_elements(aq.option_order) o
      )
    ) as row
    from public.attempt_questions aq
    where aq.attempt_id = a_id
    order by aq.display_order
  ) t;

  return jsonb_build_object(
    'attempt_id', att.id,
    'total', (select count(*) from public.attempt_questions where attempt_id = att.id),
    'time_limit_min', att.time_limit_min,
    'questions', q_list
  );
end;
$$;

-- ---------- ملاحظة ----------
-- دالة submit_attempt الكاملة (مع تمرير الإجابات والتصحيح) في:
-- supabase/migrations/0002_submit_attempt.sql

-- ---------- 5) RLS ----------

alter table public.categories       enable row level security;
alter table public.questions        enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_settings    enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.attempt_answers   enable row level security;
alter table public.admin_users      enable row level security;

-- anon: قراءة فقط من الـ Views (بلا is_correct)
-- (تم منحها أعلاه)

-- admin (عضو admin_users): إدارة كاملة
create policy "admin manages categories" on public.categories
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "admin manages questions" on public.questions
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "admin manages options" on public.question_options
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "admin manages settings" on public.quiz_settings
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- النتائج: للقراءة من admin فقط (الكتابة عبر دوال security definer)
create policy "admin reads attempts" on public.quiz_attempts
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "admin reads attempt questions" on public.attempt_questions
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

create policy "admin reads attempt answers" on public.attempt_answers
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- وظائف RPC متاحة للجميع (anon تنفيذ، لكن البيانات محمية security definer)
grant execute on function public.create_attempt, public.get_attempt to anon, authenticated;

-- تشغيل chrono للتحديث التلقائي updated_at (بسيط)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_categories_touch on public.categories;
create trigger trg_categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_questions_touch on public.questions;
create trigger trg_questions_touch before update on public.questions
  for each row execute function public.touch_updated_at();