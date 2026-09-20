-- =====================================================================
--  تطبيق كامل: المخطط + RPC + RLS fixes + بيانات أولية + أول مدير
--  يُلصق مرة واحدة في Supabase → SQL Editor → Run
-- =====================================================================

-- <<< Start of 0001_initial.sql >>>
-- ---------- جداول ----------
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

create table if not exists public.attempt_questions (
  id                      uuid primary key default gen_random_uuid(),
  attempt_id              uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id             uuid not null references public.questions(id),
  question_text_snapshot  text not null,
  category_id             uuid not null,
  category_name           text not null,
  explanation_snapshot    text,
  correct_option_id       uuid not null,
  option_order            jsonb not null,
  display_order           int  not null
);

create table if not exists public.attempt_answers (
  id                   uuid primary key default gen_random_uuid(),
  attempt_question_id  uuid not null references public.attempt_questions(id) on delete cascade,
  chosen_option_id     uuid references public.question_options(id),
  is_correct           boolean,
  answered_at          timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  created_at timestamptz not null default now()
);

-- ---------- فهارس ----------
create index if not exists idx_questions_category  on public.questions(category_id);
create index if not exists idx_options_question    on public.question_options(question_id);
create index if not exists idx_attempt_questions   on public.attempt_questions(attempt_id);
create index if not exists idx_attempt_answers     on public.attempt_answers(attempt_question_id);
create index if not exists idx_attempts_created    on public.quiz_attempts(created_at desc);
create index if not exists idx_settings_category   on public.quiz_settings(category_id);

-- ---------- Views عامة بلا إجابات ----------
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

-- ---------- create_attempt ----------
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
        select o.id, o.option_text, o.sort_order
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

-- ---------- get_attempt ----------
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

-- ---------- RLS ----------
alter table public.categories       enable row level security;
alter table public.questions        enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_settings    enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.attempt_answers   enable row level security;
alter table public.admin_users      enable row level security;

drop policy if exists "admin manages categories" on public.categories;
create policy "admin manages categories" on public.categories
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin manages questions" on public.questions;
create policy "admin manages questions" on public.questions
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin manages options" on public.question_options;
create policy "admin manages options" on public.question_options
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin manages settings" on public.quiz_settings;
create policy "admin manages settings" on public.quiz_settings
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin reads attempts" on public.quiz_attempts;
create policy "admin reads attempts" on public.quiz_attempts
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin reads attempt questions" on public.attempt_questions;
create policy "admin reads attempt questions" on public.attempt_questions
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin reads attempt answers" on public.attempt_answers;
create policy "admin reads attempt answers" on public.attempt_answers
  for select to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

grant execute on function public.create_attempt(text[], int[], int), public.get_attempt(uuid) to anon, authenticated;

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

-- <<< End of 0001 >>>

-- <<< Start of 0002_submit_attempt.sql >>>
create or replace function public.submit_attempt(
  a_id uuid,
  p_answers jsonb,
  passing_score numeric default 70.00
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  att public.quiz_attempts;
  aq_rec record;
  chosen uuid;
  ok boolean;
  correct_count int := 0;
  wrong_count int := 0;
  unans_count int := 0;
  total_count int := 0;
  review jsonb := '[]'::jsonb;
  cat_totals jsonb := '{}'::jsonb;
  cat_key text;
  cat_info jsonb;
  pct numeric(5,2);
  passed boolean;
begin
  select * into att from public.quiz_attempts where id = a_id;
  if att is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if att.status <> 'in_progress' then
    raise exception 'تم تسليم هذه المحاولة من قبل';
  end if;

  for aq_rec in
    select aq.*
    from public.attempt_questions aq
    where aq.attempt_id = a_id
    order by aq.display_order
  loop
    total_count := total_count + 1;
    chosen := null;

    select (a->>'option_id')::uuid into chosen
    from jsonb_array_elements(p_answers) a
    where (a->>'question_id')::uuid = aq_rec.question_id
    limit 1;

    if chosen is null then
      ok := false;
      unans_count := unans_count + 1;
    elsif chosen = aq_rec.correct_option_id then
      ok := true;
      correct_count := correct_count + 1;
    else
      ok := false;
      wrong_count := wrong_count + 1;
    end if;

    insert into public.attempt_answers (attempt_question_id, chosen_option_id, is_correct)
    values (aq_rec.id, chosen, ok);

    cat_key := aq_rec.category_id::text;
    cat_info := cat_totals->cat_key;
    if cat_info is null then
      cat_totals := jsonb_set(cat_totals, array[cat_key],
        jsonb_build_object('correct', 0, 'total', 0));
    end if;
    cat_info := cat_totals->cat_key;
    cat_totals := jsonb_set(cat_totals, array[cat_key, 'total'],
      to_jsonb((cat_info->>'total')::int + 1));
    if ok then
      cat_info := cat_totals->cat_key;
      cat_totals := jsonb_set(cat_totals, array[cat_key, 'correct'],
        to_jsonb((cat_info->>'correct')::int + 1));
    end if;

    review := review || jsonb_build_object(
      'question_id', aq_rec.question_id,
      'question_text', aq_rec.question_text_snapshot,
      'category_id', aq_rec.category_id,
      'category_name', aq_rec.category_name,
      'options', (
        select jsonb_agg(jsonb_build_object(
          'option_id', (o->>'option_id')::uuid,
          'option_text', o->>'option_text'
        ) order by (o->>'display_order')::int)
        from jsonb_array_elements(aq_rec.option_order) o
      ),
      'chosen_option_id', chosen,
      'correct_option_id', aq_rec.correct_option_id,
      'explanation', aq_rec.explanation_snapshot,
      'is_correct', ok,
      'answered', chosen is not null
    );
  end loop;

  pct := case when total_count = 0 then 0 else round((correct_count::numeric / total_count) * 100, 2) end;
  passed := pct >= passing_score;

  update public.quiz_attempts
  set status = 'submitted',
      submitted_at = now(),
      score_percent = pct,
      correct_count = correct_count,
      wrong_count = wrong_count,
      unanswered_count = unans_count
  where id = a_id;

  return jsonb_build_object(
    'attempt_id', a_id,
    'total', total_count,
    'correct', correct_count,
    'wrong', wrong_count,
    'unanswered', unans_count,
    'score_percent', pct,
    'passed', passed,
    'passing_score', passing_score,
    'by_category', cat_totals,
    'review', review
  );
end;
$$;

grant execute on function public.submit_attempt(uuid, jsonb, numeric) to anon, authenticated;
-- <<< End of 0002 >>>

-- <<< Start of 0003_rls_fixes.sql >>>
drop policy if exists "anon reads settings" on public.quiz_settings;
create policy "anon reads settings" on public.quiz_settings
  for select to anon, authenticated
  using (true);

drop policy if exists "users view own admin row" on public.admin_users;
create policy "users view own admin row" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());
-- <<< End of 0003 >>>

-- ============================================================
-- <<< Start of 0004_candidate_flow.sql >>>
-- ============================================================
-- ---------- الأعمدة ----------
alter table public.quiz_attempts
  add column if not exists candidate_name text,
  add column if not exists candidate_email text;

-- ---------- منع التكرار (حماية سباقية) ----------
create unique index if not exists idx_cand_no_dup_in_progress
  on public.quiz_attempts (lower(candidate_name), lower(coalesce(candidate_email, '')))
  where status = 'in_progress' and candidate_name is not null and candidate_name <> '';

-- ---------- دالة الإنشاء (v1) ----------
drop function if exists public.create_candidate_attempt(text, text);

create or replace function public.create_candidate_attempt(p_name text, p_email text default null)
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

  -- إعادة استخدام محاولة قيد التنفيذ لنفس المتقدم (تحديث صفحة / نقر مزدوج)
  select * into existing
  from public.quiz_attempts
  where status = 'in_progress'
    and lower(candidate_name) = lower(c_name)
    and lower(coalesce(candidate_email, '')) = lower(c_email)
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

  -- الأقسام النشطة بإعداداتها الافتراضية (اختبار شامل)
  for q_rec in
    select c.slug, c.id, coalesce(qs.question_count_default, 10) as cnt
    from public.categories c
    left join public.quiz_settings qs on qs.category_id = c.id
    where c.is_active = true
    order by c.name
  loop
    cat_list := cat_list || q_rec.slug;
    counts := counts || q_rec.cnt;
  end loop;

  if cardinality(cat_list) = 0 then
    raise exception 'لا توجد أقسام نشطة';
  end if;

  for i in 1..cardinality(cat_list) loop
    select count(*) into avail
    from public.questions q
    join public.categories c on c.id = q.category_id
    where c.slug = cat_list[i] and q.is_active and c.is_active;

    if avail < counts[i] then
      raise exception 'عدد الأسئلة المتاحة في قسم % غير كافٍ', cat_list[i];
    end if;
  end loop;

  -- إنشاء المحاولة (الكتابة عبر security definer فقط)
  a_id := gen_random_uuid();
  insert into public.quiz_attempts (id, category_filter, candidate_name, candidate_email, status)
  values (a_id, cat_list, c_name, c_email, 'in_progress');

  -- لقطة الأسئلة (ثبات النتيجة)
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
        select o.id, o.option_text, o.sort_order
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

-- معاملة متزامنة لنفس المتقدم: إعادة الاسترجاع بدل تكرار المحاولة
exception when unique_violation then
  select * into existing
  from public.quiz_attempts
  where status = 'in_progress'
    and lower(candidate_name) = lower(c_name)
    and lower(coalesce(candidate_email, '')) = lower(c_email)
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

  raise;
end;
$$;

grant execute on function public.create_candidate_attempt(text, text) to anon, authenticated;
-- <<< End of 0004 >>>

-- <<< Start of 0005_public_grants.sql >>>
grant select on public.quiz_settings to anon, authenticated;

grant select, insert, update, delete on public.categories       to authenticated;
grant select, insert, update, delete on public.questions        to authenticated;
grant select, insert, update, delete on public.question_options to authenticated;
grant select, insert, update, delete on public.quiz_settings    to authenticated;

grant select on public.quiz_attempts      to authenticated;
grant select on public.attempt_questions  to authenticated;
grant select on public.attempt_answers    to authenticated;

grant select on public.admin_users to authenticated;
-- <<< End of 0005 >>>

-- ============================================================
-- <<< Start of 0006_exams.sql >>>
-- ============================================================
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

alter table public.quiz_attempts
  add column if not exists passing_score numeric(5,2) default 70.00;

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
        select o.id, o.option_text, o.sort_order
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
drop policy if exists "anon reads active exams" on public.exams;
create policy "anon reads active exams" on public.exams
  for select to anon, authenticated
  using (is_active = true);

drop policy if exists "anon reads exam sections via exam" on public.exam_sections;
create policy "anon reads exam sections via exam" on public.exam_sections
  for select to anon, authenticated
  using (exists (select 1 from public.exams e where e.id = exam_id and e.is_active = true));

drop policy if exists "admin manages exams" on public.exams;
create policy "admin manages exams" on public.exams
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

drop policy if exists "admin manages exam sections" on public.exam_sections;
create policy "admin manages exam sections" on public.exam_sections
  for all to authenticated
  using (exists (select 1 from public.admin_users au where au.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users au where au.user_id = auth.uid()));

-- ---------- 6) Grants ----------
grant select on public.exams to anon, authenticated;
grant select on public.exam_sections to anon, authenticated;

grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.exam_sections to authenticated;

grant execute on function public.create_candidate_attempt(text, text, uuid) to anon, authenticated;
-- <<< End of 0006 >>>

-- ============================================================
-- <<< Start of 0007_retakes_and_passing.sql >>>
-- ============================================================
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

  if p_exam_id is not null then
    -- الامتحان: تحقق من قبل سياسة إعادة المحاولة
    select * into exam_rec from public.exams where id = p_exam_id;
    if exam_rec.id is null then
      raise exception 'الامتحان غير موجود';
    end if;
    if not exam_rec.is_active then
      raise exception 'هذا الامتحان غير نشط أو غير متاح حاليًا';
    end if;

    -- أحدث محاولة لنفس المتقدم في هذا الامتحان
    select * into existing
    from public.quiz_attempts
    where exam_id = p_exam_id
      and lower(candidate_name) = lower(c_name)
      and lower(coalesce(candidate_email, '')) = lower(c_email)
    order by started_at desc, created_at desc
    limit 1;

    if existing.id is not null then
      if existing.status = 'in_progress' then
        return jsonb_build_object(
          'attempt_id', existing.id,
          'candidate_name', c_name,
          'candidate_email', c_email,
          'status', existing.status,
          'started_at', existing.started_at
        );
      end if;
      -- منتهية ولا يُسمح بإعادة المحاولة → عدم إنشاء محاولة جديدة
      if existing.status = 'submitted' and not exam_rec.allow_retakes then
        return jsonb_build_object(
          'attempt_id', existing.id,
          'candidate_name', c_name,
          'candidate_email', c_email,
          'status', 'submitted',
          'started_at', existing.started_at
        );
      end if;
      -- submitted + allow_retakes، أو abandoned → إنشاء محاولة جديدة أدناه
    end if;
  else
    -- السلوك القديم بدون امتحان: استئناف محاولة قيد التنفيذ لنفس المتقدم
    select * into existing
    from public.quiz_attempts
    where status = 'in_progress'
      and lower(candidate_name) = lower(c_name)
      and lower(coalesce(candidate_email, '')) = lower(c_email)
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
  end if;

  -- تحديد الأقسام
  if p_exam_id is not null then
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
  begin
    insert into public.quiz_attempts (id, category_filter, exam_id, candidate_name, candidate_email, status)
    values (a_id, cat_list, p_exam_id, c_name, c_email, 'in_progress');

    exception when unique_violation then
      -- مكالمتان متزامنتان لنفس المتقدم: العودة للمحاولة القائمة
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
      raise;
  end;

  -- تخزين زمن الامتحان ودرجة النجاح إن وجد
  if p_exam_id is not null then
    update public.quiz_attempts
    set time_limit_min = exam_rec.time_limit_minutes,
        passing_score  = exam_rec.passing_score
    where id = a_id;
  end if;

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
        select o.id, o.option_text, o.sort_order
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

drop function if exists public.get_attempt(uuid);

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
    'passing_score', att.passing_score,
    'exam_title', (select e.title from public.exams e where e.id = att.exam_id),
    'questions', q_list
  );
end;
$$;

grant execute on function public.create_candidate_attempt(text, text, uuid) to anon, authenticated;
grant execute on function public.get_attempt(uuid) to anon, authenticated;
-- <<< End of 0007 >>>

-- <<< Start of seed.sql >>>
create or replace function public.seed_question(cat uuid, q text, expl text, opts text[], correct_idx int)
returns void language plpgsql as $$
declare
  qid uuid;
  i int;
begin
  insert into public.questions (category_id, question_text, explanation, difficulty)
  values (cat, q, expl, 'medium') returning id into qid;
  for i in 1..array_length(opts, 1) loop
    insert into public.question_options (question_id, option_text, is_correct, sort_order)
    values (qid, opts[i], (i - 1 = correct_idx), i - 1);
  end loop;
end;
$$;

do $$
declare
  cat_acc uuid;
  cat_iq  uuid;
  cat_ex  uuid;
  fresh   boolean := false;
begin
  insert into public.categories (name, slug, description, accent_color)
  values ('Accounting', 'accounting', 'أسئلة المبادئ المحاسبية والقوائم المالية', '#16A34A')
  on conflict (slug) do nothing
  returning id into cat_acc;
  if cat_acc is not null then fresh := true; end if;
  select id into cat_acc from public.categories where slug = 'accounting';

  insert into public.categories (name, slug, description, accent_color)
  values ('IQ', 'iq', 'أسئلة الذكاء والتحليل المنطقي', '#7C3AED')
  on conflict (slug) do nothing
  returning id into cat_iq;
  if cat_iq is not null then fresh := true; end if;
  select id into cat_iq from public.categories where slug = 'iq';

  insert into public.categories (name, slug, description, accent_color)
  values ('Excel', 'excel', 'دوال Excel والمعادلات وتنسيق الجداول', '#EA580C')
  on conflict (slug) do nothing
  returning id into cat_ex;
  if cat_ex is not null then fresh := true; end if;
  select id into cat_ex from public.categories where slug = 'excel';

  insert into public.quiz_settings (category_id, question_count_default, time_limit_minutes, passing_score)
  select cat_acc, 10, null, 70
  where not exists (select 1 from public.quiz_settings where category_id = cat_acc);
  insert into public.quiz_settings (category_id, question_count_default, time_limit_minutes, passing_score)
  select cat_iq, 10, null, 70
  where not exists (select 1 from public.quiz_settings where category_id = cat_iq);
  insert into public.quiz_settings (category_id, question_count_default, time_limit_minutes, passing_score)
  select cat_ex, 10, null, 70
  where not exists (select 1 from public.quiz_settings where category_id = cat_ex);

  if fresh then

  perform public.seed_question(cat_acc, 'ما المبدأ المحاسبي الذي يقضي بتسجيل العمليات وقت حدوثها وليس وقت السداد؟', 'مبدأ الاستحقاق (Accrual) يسجل الإيراد عند تحققّه والمصروف عند استحقاقه.', array['مبدأ الاستحقاق', 'الأساس النقدي', 'مبدأ الحيطة والحذر', 'مبدأ التكلفة التاريخية'], 0);
  perform public.seed_question(cat_acc, 'ما القيد الذي يساوي فيه إجمالي الجانب المدين إجمالي الجانب الدائن؟', 'القيد المزدوج يقتضي تسجيل كل عملية بقيد مدين ودائن متساويين.', array['قيد شراء نقدي فقط', 'قيد مزدوج', 'قيد المقاصة', 'قيود الافتتاح فقط'], 1);
  perform public.seed_question(cat_acc, 'أي قائمة تعرض الأصول والمطلوبات وحقوق الملكية في لحظة معينة؟', 'الميزانية العمومية (Balance Sheet) تمثل الوضع المالي في تاريخ محدد.', array['قائمة الدخل', 'قائمة التدفقات النقدية', 'الميزانية العمومية', 'قائمة التغير في حقوق الملكية'], 2);
  perform public.seed_question(cat_acc, 'أي الأصول يُستهلك على مدى عمره الإنتاجي؟', 'الأصول الثابتة الملموسة مثل المعدات تُستهلك، بينما الأراضي لا تُستهلك.', array['الأرض', 'المخزون', 'المعدات الصناعية', 'الحسابات المدينة'], 2);
  perform public.seed_question(cat_acc, 'ماذا تعني المعادلة المحاسبية الأساسية؟', 'المعادلة: الأصول = المطلوبات + حقوق الملكية.', array['الأصول = المطلوبات - حقوق الملكية', 'الأصول = المطلوبات + حقوق الملكية', 'المطلوبات = الأصول + حقوق الملكية', 'حقوق الملكية = الأصول + المطلوبات'], 1);
  perform public.seed_question(cat_acc, 'أي حساب يُصنَّف ضمن الأصول المتداولة؟', 'الحسابات المدينة أصل متداول يُتوقع تحصيله خلال الدورة التشغيلية.', array['الأصول الثابتة', 'قروض طويلة الأجل', 'الحسابات المدينة', 'رأس المال'], 2);
  perform public.seed_question(cat_acc, 'ما أثر عملية شراء بضاعة نقديًا؟', 'تزيد الأصول (المخزون) وتنخفض الأصول (النقد) بنفس المقدار.', array['زيادة المطلوبات', 'زيادة حقوق الملكية', 'لا تغير في إجمالي الأصول', 'نقص في إجمالي الأصول'], 2);
  perform public.seed_question(cat_acc, 'أي دفتر يسجل العمليات أولًا بأول حسب تاريخها؟', 'اليومية (Journal) تسجل العمليات أولًا بأول ثم تُرحّل إلى الأستاذ.', array['دفتر الأستاذ', 'ميزان المراجعة', 'اليومية العامة', 'دفتر المخزون'], 2);
  perform public.seed_question(cat_acc, 'ما النتيجة عند انخفاض رصيد الصندوق المكتشف بالجرد؟', 'عجز الصندوق يُحمّل على حساب الفروق أو الصندوق حسب السياسة.', array['يُعد إيرادًا', 'يُعالج كعجز ويُحمّل على المسؤول', 'يُضاف لحقوق الملكية', 'يُسجل كمطلوب'], 1);
  perform public.seed_question(cat_acc, 'ما المقصود بمصطلح الاستهلاك (Depreciation)؟', 'توزيع تكلفة الأصل الثابت على عمره الإنتاجي.', array['انخفاض قيمة المخزون', 'توزيع تكلفة الأصل على عمره الإنتاجي', 'زيادة قيمة الأصل', 'نفقات التمويل'], 1);

  perform public.seed_question(cat_iq, 'أكمل المتسلسلة: 2، 6، 12، 20، ؟', 'الفرق يزداد: +4، +6، +8، +10 ⇒ 20 + 10 = 30.', array['26', '28', '30', '32'], 2);
  perform public.seed_question(cat_iq, 'إذا كان كل الأزرار بيضاء، وبعض الأزرار دائرية، إذن؟', 'لا يمكن الجزم بأن أي زر أبيض دائري أو العكس — الاستنتاج الصحيح "لاشيء مما سبق".', array['كل الأزرار الدائرية بيضاء', 'بعض الأزرار البيضاء ليست دائرية', 'كل الأزرار البيضاء دائرية', 'لا يمكن استنتاج شيء مؤكد'], 3);
  perform public.seed_question(cat_iq, 'علاقة كلمة "قلم: كتابة" مثل "ساعة: ؟"', 'القلم أداة للكتابة، والساعة أداة لقياس الوقت.', array['يد', 'وقت', 'عقارب', 'معصم'], 1);
  perform public.seed_question(cat_iq, 'ما الرقم المختلف؟ 4، 9، 16، 21، 25', 'الأعداد 4، 9، 16، 25 مربعات كاملة، أما 21 فليس مربعًا كاملًا.', array['4', '9', '16', '21'], 3);
  perform public.seed_question(cat_iq, 'إذا كانت أم عمر أكبر من عمره بـ 25 سنة، ومجموع عمريهما 45، فكم عمر عمر؟', '2ع + 25 = 45 ⇒ ع = 10.', array['10', '15', '20', '12'], 0);
  perform public.seed_question(cat_iq, 'في صفّ من 10 طلاب، إذا كان سامي في الترتيب 4 من الأمام، فما ترتيبه من الخلف؟', '10 - 4 + 1 = 7.', array['6', '7', '5', '8'], 1);
  perform public.seed_question(cat_iq, 'أي الأشكال يكمل الأنماط: مثلث، مربع، دائرة، مثلث، مربع، ؟', 'النمط يتكرر كل ثلاثة: مثلث، مربع، دائرة.', array['مربع', 'مثلث', 'دائرة', 'نجمة'], 2);
  perform public.seed_question(cat_iq, 'ما هو الرقم المفقود؟ 8 × 7 = 56، 6 × 9 = 54، 7 × 8 = ؟', '7 × 8 = 56 (نفس عملية الضرب الأولى لأن الضرب تبديلي).', array['54', '56', '64', '48'], 1);
  perform public.seed_question(cat_iq, 'إذا كانت 3 أقلام = 9 ريال، فكم ثمن 5 أقلام؟', 'سعر القلم = 3 ريال ⇒ 5 × 3 = 15.', array['12', '15', '18', '10'], 1);
  perform public.seed_question(cat_iq, 'أي الكلمات لا تنتمي للمجموعة؟ موز، برتقال، خيار، تفاح', 'الخيار خضار وليس فاكهة.', array['موز', 'برتقال', 'خيار', 'تفاح'], 2);

  perform public.seed_question(cat_ex, 'ما نتيجة الدالة =SUM(A1:A3) إذا كانت القيم 5، 10، 15؟', '5 + 10 + 15 = 30.', array['15', '30', '25', '35'], 1);
  perform public.seed_question(cat_ex, 'أي دالة تعيد أكبر قيمة ضمن نطاق؟', '=MAX تنفّذ أعلى قيمة.', array['=AVERAGE', '=MAX', '=LARGE', '=RANK'], 1);
  perform public.seed_question(cat_ex, 'ما الصيغة الصحيحة للبحث عن قيمة في عمود وإرجاع نظيرتها من عمود آخر؟', 'VLOOKUP تبحث عن القيمة وترجع من عمود محدد.', array['=INDEX', '=MATCH', '=VLOOKUP', '=IF'], 2);
  perform public.seed_question(cat_ex, 'ما ترتيب العمليات الحسابية في Excel؟', 'الأقواس أولًا ثم الضرب والقسمة ثم الجمع والطرح.', array['الضرب قبل الأقواس', 'الأقواس أولًا', 'الجمع أولًا', 'القسمة بعد الجمع'], 1);
  perform public.seed_question(cat_ex, 'ما اختصار الطباعة السريع في Excel؟', 'Ctrl+P هو اختصار الطباعة.', array['Ctrl+S', 'Ctrl+P', 'Ctrl+F', 'Ctrl+N'], 1);
  perform public.seed_question(cat_ex, 'ما الدالة التي ترجع اليوم؟', '=TODAY() ترجع تاريخ اليوم.', array['=NOW()', '=DATE()', '=TODAY()', '=DAY()'], 2);
  perform public.seed_question(cat_ex, 'ما معنى الخطأ #DIV/0! ؟', 'محاولة القسمة على صفر.', array['قيمة خاطئة', 'القسمة على صفر', 'مرجع دائري', 'نص غير صالح'], 1);
  perform public.seed_question(cat_ex, 'كيف تجمع فقط خلايا تحقق شرطًا محددًا؟', 'SUMIF تجمع الخلايا المطابقة لشرط.', array['=SUMIF', '=SUM', '=IF', '=COUNTIF'], 0);
  perform public.seed_question(cat_ex, 'ما نوع المرجع في $A$1؟', 'مرجع مطلق يقفل العمود والصف عند النسخ.', array['مطلق', 'نسبي', 'مختلط', 'مسمّى'], 0);
  perform public.seed_question(cat_ex, 'ما الدالة التي تحسب عدد الخلايا غير الفارغة؟', 'COUNTA تحسب الخلايا غير الفارغة.', array['=COUNT', '=COUNTA', '=IF', '=SUM'], 1);
  else
    raise notice 'الأقسام موجودة مسبقًا — تم تخطي إدراج الأسئلة التجريبية';
  end if;
end $$;

drop function public.seed_question(uuid, text, text, text[], int);
-- <<< End of seed.sql >>>

-- =====================================================================
--  ربط حساب المدير كأول مدير (أنشئه أولًا: omar@exam.com / omar369@)
--  Dashboard → Authentication → Users → Add user (Auto Confirm)
-- =====================================================================
insert into public.admin_users (user_id, email)
select id, email from auth.users where email = 'omar@exam.com'
on conflict (user_id) do nothing;

-- تفقد سريع:
select 'categories' as what, count(*) from public.categories
union all select 'questions', count(*) from public.questions
union all select 'options', count(*) from public.question_options;