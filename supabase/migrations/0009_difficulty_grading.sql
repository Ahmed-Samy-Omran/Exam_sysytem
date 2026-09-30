-- =====================================================================
-- Migration 0009: تدرج الصعوبة + إلغاء تفعيل IQ/Excel + قسم محاسبة فقط
-- =====================================================================
-- 1) exam_sections.difficulty_counts jsonb: {"easy":n,"medium":n,"hard":n}
--    عند وجوده، يسحب create_candidate_attempt عدداً محدداً من كل مستوى
--    بالترتيب: سهل ← متوسط ← متقدم (تدرّج الصعوبة داخل الاختبار).
--    عند غيابه (null) يبقى السلوك القديم: سحب مختلط عشوائي.
-- 2) إلغاء تفعيل قسمي IQ و Excel (مع إبقاء بنوك أسئلتهم كما هي
--    ليعاد تفعيلها لاحقاً).
-- 3) إعادة ضبط الأقسام: قسم المحاسبة فقط بتوزيع 10 سهل / 5 متوسط / 3 متقدم.

begin;

-- ---------- 1) عمود توزيع الصعوبة ----------
alter table public.exam_sections
  add column if not exists difficulty_counts jsonb;

alter table public.exam_sections
  drop constraint if exists chk_exam_sections_difficulty_counts;

alter table public.exam_sections
  add constraint chk_exam_sections_difficulty_counts check (
    difficulty_counts is null or (
      jsonb_typeof(difficulty_counts) = 'object'
      and difficulty_counts ? 'easy'
      and difficulty_counts ? 'medium'
      and difficulty_counts ? 'hard'
      and (difficulty_counts->>'easy') ~ '^[0-9]+$'
      and (difficulty_counts->>'medium') ~ '^[0-9]+$'
      and (difficulty_counts->>'hard') ~ '^[0-9]+$'
      and ((difficulty_counts->>'easy')::int + (difficulty_counts->>'medium')::int + (difficulty_counts->>'hard')::int) > 0
    )
  );

-- ---------- 2) إلغاء تفعيل IQ و Excel ----------
update public.categories
set is_active = false
where slug in ('iq', 'excel');

-- ---------- 3) قسم المحاسبة فقط من الامتحانات + توزيع الصعوبة ----------
update public.exam_sections es
set difficulty_counts = '{"easy":10,"medium":5,"hard":3}'::jsonb,
    question_count    = 18
from public.categories c
where c.id = es.category_id
  and c.slug = 'accounting';

delete from public.exam_sections es
using public.categories c
where c.id = es.category_id
  and c.slug in ('iq', 'excel');

-- ---------- 4) create_candidate_attempt: سحب متدرج الصعوبة ----------
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
  diff_counts jsonb[] := '{}'::jsonb[];
  exam_rec public.exams;
  s_rec record;
  spec record;
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
    select * into exam_rec from public.exams where id = p_exam_id;
    if exam_rec.id is null then
      raise exception 'الامتحان غير موجود';
    end if;
    if not exam_rec.is_active then
      raise exception 'هذا الامتحان غير نشط أو غير متاح حاليًا';
    end if;

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
      if existing.status = 'submitted' and not exam_rec.allow_retakes then
        return jsonb_build_object(
          'attempt_id', existing.id,
          'candidate_name', c_name,
          'candidate_email', c_email,
          'status', 'submitted',
          'started_at', existing.started_at
        );
      end if;
    end if;
  else
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

  -- تحديد الأقسام (مع توزيع الصعوبة عند توفره)
  if p_exam_id is not null then
    for s_rec in
      select es.question_count, es.difficulty_counts, c.slug
      from public.exam_sections es
      join public.categories c on c.id = es.category_id
      where es.exam_id = p_exam_id
      order by c.name
    loop
      cat_list := cat_list || s_rec.slug;
      counts := counts || s_rec.question_count;
      diff_counts := diff_counts || coalesce(s_rec.difficulty_counts, null);
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
      diff_counts := diff_counts || null;
    end loop;

    if cardinality(cat_list) = 0 then
      raise exception 'لا توجد أقسام نشطة';
    end if;
  end if;

  -- التحقق من توفر الأسئلة (اختيار مختلط فقط؛ التوزيع يُفحص أثناء السحب)
  for i in 1..cardinality(cat_list) loop
    if diff_counts[i] is not null then
      continue;
    end if;
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

  if p_exam_id is not null then
    update public.quiz_attempts
    set time_limit_min = exam_rec.time_limit_minutes,
        passing_score  = exam_rec.passing_score
    where id = a_id;
  end if;

  -- لقطة الأسئلة
  disp := 0;
  for i in 1..cardinality(cat_list) loop
    if diff_counts[i] is not null then
      -- سحب متدرج: سهل ثم متوسط ثم متقدم
      for spec in
        select v.level, v.req
        from (values
          ('easy',   coalesce((diff_counts[i]->>'easy')::int, 0)),
          ('medium', coalesce((diff_counts[i]->>'medium')::int, 0)),
          ('hard',   coalesce((diff_counts[i]->>'hard')::int, 0))
        ) as v(level, req)
        where v.req > 0
      loop
        select count(*) into avail
        from public.questions q
        join public.categories c on c.id = q.category_id
        where c.slug = cat_list[i] and q.is_active and q.difficulty = spec.level;

        if avail < spec.req then
          raise exception 'عدد الأسئلة في قسم % (المستوى %) غير كافٍ (المتاح % والمطلوب %)', cat_list[i], spec.level, avail, spec.req;
        end if;

        for q_rec in
          select q.*, c.name as cat_name
          from public.questions q
          join public.categories c on c.id = q.category_id
          where c.slug = cat_list[i] and q.is_active and q.difficulty = spec.level
          order by random()
          limit spec.req
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
    else
      -- السلوك القديم: عدد محدد عشوائي من القسم (مختلط المستويات)
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
    end if;
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

-- ---------- 5) Grants (drop/create revokes EXECUTE) ----------
grant execute on function public.create_candidate_attempt(text, text, uuid) to anon, authenticated;

commit;