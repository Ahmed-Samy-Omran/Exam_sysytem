-- =====================================================================
-- Migration 0007: Retake policy + passing score + per-exam timer
-- =====================================================================
-- 1) create_candidate_attempt:
--    - Retake-aware: a completed attempt is returned as 'submitted' when
--      the exam disallows retakes (no new attempt is created).
--    - Resume an existing in_progress attempt for the same candidate+exam.
--    - Capture exam.time_limit_minutes + exam.passing_score on the attempt.
--    - Handle concurrent duplicate submissions via idx_cand_no_dup_in_progress.
-- 2) get_attempt: return passing_score + exam_title so the runner and
--    dashboards can use the admin-configured threshold.
-- 3) Re-grant EXECUTE (drop + create revokes grants).

-- ---------- 0) column needed by this migration ----------
alter table public.quiz_attempts
  add column if not exists passing_score numeric(5,2) default 70.00;

-- ---------- 1) create_candidate_attempt ----------
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

-- ---------- 2) get_attempt: passing_score + exam_title ----------
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

-- ---------- 3) Grants (drop/create revokes EXECUTE) ----------
grant execute on function public.create_candidate_attempt(text, text, uuid) to anon, authenticated;
grant execute on function public.get_attempt(uuid) to anon, authenticated;