-- Migration 0004: تدفق دخول المتقدم (candidate entry flow)
-- 1) عمودا المرشح على quiz_attempts
-- 2) دالة create_candidate_attempt (security definer) — المصدر الموثوق لإنشاء المحاولة
-- 3) منع تكرار محاولة "قيد التنفيذ" لنفس المتقدم على مستوى قاعدة البيانات
-- 4) RLS تُترك مفعّلة: المتقدم يكتب فقط عبر الدالة، ولا يقرأ أي بيانات نتائج/إجابات

-- ---------- 1) الأعمدة ----------
alter table public.quiz_attempts
  add column if not exists candidate_name text,
  add column if not exists candidate_email text;

-- ---------- 2) منع التكرار (حماية سباقية) ----------
-- مؤشر فريد جزئي: محاولة واحدة فقط بحالة in_progress لنفس (الاسم, البريد)
create unique index if not exists idx_cand_no_dup_in_progress
  on public.quiz_attempts (lower(candidate_name), lower(coalesce(candidate_email, '')))
  where status = 'in_progress' and candidate_name is not null and candidate_name <> '';

-- ---------- 3) دالة الإنشاء ----------
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

  -- لقطة الأسئلة (ثبات النتيجة — كما في create_attempt)
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

-- ---------- 4) الوصول ----------
grant execute on function public.create_candidate_attempt(text, text) to anon, authenticated;