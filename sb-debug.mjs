import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('/home/ahmed-omran/projects/exam_website/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^=#]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const pe = (e) => `${e.code} | ${e.message}`

console.log('=== 1) create_attempt ===')
const created = await sb.rpc('create_attempt', { cat_filter: ['accounting', 'iq', 'excel'], counts: [2, 2, 2], time_limit_min: null })
if (created.error) { console.log('FAIL', pe(created.error)); process.exit(1) }
const attempt = created.data
console.log('OK attempt_id:', attempt?.attempt_id)
console.log('questions:', attempt?.total, 'first q keys:', Object.keys(attempt?.questions?.[0] ?? {}))

const attemptId = attempt?.attempt_id

console.log('=== 2) get_attempt ===')
const got = await sb.rpc('get_attempt', { a_id: attemptId })
if (got.error) { console.log('FAIL', pe(got.error)); process.exit(1) }
const quiz = got.data
console.log('OK total:', quiz?.total, 'time_limit_min:', quiz?.time_limit_min, 'passing_score:', quiz?.passing_score, 'exam_title:', quiz?.exam_title)
console.log('q1 options sample:', JSON.stringify(quiz?.questions?.[0]?.options?.[0]))

const answers = (quiz?.questions ?? []).map((q) => {
  const opt = q.options?.[0]
  return opt ? { question_id: q.question_id, option_id: opt.option_id } : null
}).filter(Boolean)

console.log('=== 3) submit_attempt ===')
const sub = await sb.rpc('submit_attempt', { a_id: attemptId, p_answers: answers, passing_score: 70 })
if (sub.error) { console.log('FAIL', pe(sub.error)); process.exit(1) }
const res = sub.data
console.log('OK total:', res?.total, 'correct:', res?.correct, 'score_percent:', res?.score_percent, 'passed:', res?.passed)
console.log('review length:', res?.review?.length, 'by_category:', JSON.stringify(res?.by_category))

console.log('=== 4) dashboard queries ===')
const stats = await sb.from('quiz_attempts').select('score_percent', { count: 'exact' }).eq('status', 'submitted')
console.log('attempts count:', stats.error ? pe(stats.error) : stats.count)
const recent = await sb.from('quiz_attempts')
  .select('id, status, score_percent, candidate_name, candidate_email, started_at, exams ( title, passing_score )')
  .order('started_at', { ascending: false }).limit(10)
console.log('recent:', recent.error ? pe(recent.error) : `rows=${(recent.data ?? []).length}`)

process.exit(0)