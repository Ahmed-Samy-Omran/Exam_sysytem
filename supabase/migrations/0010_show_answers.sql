-- =====================================================================
-- Migration 0010: إخفاء مراجعة الإجابات بعد التسليم (اختياري لكل امتحان)
-- =====================================================================
-- 1) exams.show_answers: خيار المدير في كل امتحان.
--    true  = السلوك القديم (مراجعة كاملة بعد التسليم).
--    false = المتقدم يرى النتيجة فقط، بلا إجابات ولا تصحيح.
-- 2) submit_attempt: عند false لا تُبنى قائمة المراجعة إطلاقًا، فلا تغادر
--    الإجابة الصحيحة (correct_option_id) ولا التصحيح (explanation) إلى
--    المتصفح — الإغلاق هنا على الخادم لا على الواجهة.
-- 3) أسماء الأقسام تُرجَع منفصلةً (category_names) حتى تبقى بطاقة
--    "النتيجة حسب القسم" مقروءة عندما تكون المراجعة معطّلة.
-- 4) إعادة منح EXECUTE (drop + create يسقطان المنح السابقة).
--
-- ملاحظة: المحاولات القديمة التي بلا exam_id تُعامل كـ show_answers = true.

begin;

-- ---------- 1) عمود الإعداد ----------
alter table public.exams
  add column if not exists show_answers boolean not null default true;

comment on column public.exams.show_answers is
  'عرض مراجعة الإجابات (الإجابة الصحيحة والتصحيح) للمتقدم بعد التسليم';

-- ---------- 2) submit_attempt: احترام الإعداد ----------
drop function if exists public.submit_attempt(uuid, jsonb, numeric);

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
  v_correct_count int := 0;
  v_wrong_count int := 0;
  unans_count int := 0;
  total_count int := 0;
  review jsonb := '[]'::jsonb;
  cat_totals jsonb := '{}'::jsonb;
  cat_names jsonb := '{}'::jsonb;
  cat_key text;
  cat_info jsonb;
  pct numeric(5,2);
  passed boolean;
  v_show_answers boolean;
begin
  select * into att from public.quiz_attempts where id = a_id;
  if att is null then
    raise exception 'المحاولة غير موجودة';
  end if;
  if att.status <> 'in_progress' then
    raise exception 'تم تسليم هذه المحاولة من قبل';
  end if;

  -- إعداد الامتحان: المراجعة تُبنى فقط إن سمح المدير (محاولة بلا امتحان = true)
  v_show_answers := coalesce(
    (select e.show_answers from public.exams e where e.id = att.exam_id),
    true);

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
      v_correct_count := v_correct_count + 1;
    else
      ok := false;
      v_wrong_count := v_wrong_count + 1;
    end if;

    insert into public.attempt_answers (attempt_question_id, chosen_option_id, is_correct)
    values (aq_rec.id, chosen, ok);

    -- تجميع النتائج حسب القسم
    cat_key := aq_rec.category_id::text;
    cat_info := cat_totals->cat_key;
    if cat_info is null then
      cat_totals := jsonb_set(cat_totals, array[cat_key],
        jsonb_build_object('correct', 0, 'total', 0));
      -- اسم القسم يُخزَّن مرة واحدة (يصلح مربّع "النتيجة حسب القسم" بلا مراجعة)
      cat_names := jsonb_set(cat_names, array[cat_key],
        to_jsonb(coalesce(aq_rec.category_name, '')));
    end if;
    cat_info := cat_totals->cat_key;
    cat_totals := jsonb_set(cat_totals, array[cat_key, 'total'],
      to_jsonb((cat_info->>'total')::int + 1));
    if ok then
      cat_info := cat_totals->cat_key;
      cat_totals := jsonb_set(cat_totals, array[cat_key, 'correct'],
        to_jsonb((cat_info->>'correct')::int + 1));
    end if;

    -- بناء المراجعة (بعد التسليم فقط، وحسب إعداد exams.show_answers)
    if v_show_answers then
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
    end if;
  end loop;

  pct := case when total_count = 0 then 0 else round((v_correct_count::numeric / total_count) * 100, 2) end;
  passed := pct >= passing_score;

  update public.quiz_attempts
  set status = 'submitted',
      submitted_at = now(),
      score_percent = pct,
      correct_count = v_correct_count,
      wrong_count = v_wrong_count,
      unanswered_count = unans_count
  where id = a_id;

  return jsonb_build_object(
    'attempt_id', a_id,
    'total', total_count,
    'correct', v_correct_count,
    'wrong', v_wrong_count,
    'unanswered', unans_count,
    'score_percent', pct,
    'passed', passed,
    'passing_score', passing_score,
    'show_answers', v_show_answers,
    'category_names', cat_names,
    'by_category', cat_totals,
    'review', review
  );
end;
$$;

grant execute on function public.submit_attempt(uuid, jsonb, numeric) to anon, authenticated;

commit;