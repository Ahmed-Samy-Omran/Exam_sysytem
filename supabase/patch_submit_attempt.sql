-- Fix: submit_attempt failed with "42702 column reference correct_count is ambiguous"
-- Root cause: PL/pgSQL local variables `correct_count`/`wrong_count` shadow the
-- quiz_attempts columns of the same name inside `UPDATE public.quiz_attempts`.
-- Fix: renamed locals to v_correct_count / v_wrong_count, recurring everywhere.
-- Run this in the Supabase SQL Editor (or re-run supabase/apply_all.sql which now includes it).

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
      v_correct_count := v_correct_count + 1;
    else
      ok := false;
      v_wrong_count := v_wrong_count + 1;
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
    'by_category', cat_totals,
    'review', review
  );
end;
$$;

grant execute on function public.submit_attempt(uuid, jsonb, numeric) to anon, authenticated;