import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = {}
for (const line of readFileSync('/home/ahmed-omran/projects/exam_website/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^=#]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const attemptId = process.argv[2]
const s = await sb.auth.signInWithPassword({ email: 'omar@exam.com', password: 'omar369@' })
if (s.error) throw s.error.message

const { data: aqs, error: e1 } = await sb.from('attempt_questions').select('id, question_id, correct_option_id, option_order, display_order').eq('attempt_id', attemptId).order('display_order')
console.log('attempt_questions:', e1 ? `${e1.code}|${e1.message}` : `${(aqs ?? []).length} rows`)

const answers = {}
const picked = {}
for (const q of aqs ?? []) {
  const opts = (typeof q.option_order === 'string' ? JSON.parse(q.option_order) : q.option_order)
  const first = opts.find((o) => o && o.option_id) ?? {}
  answers[q.question_id] = first.option_id
  picked[q.question_id] = first.option_id === q.correct_option_id ? 'CORRECT' : 'WRONG'
}
console.log('picked (first option each):', JSON.stringify(picked, null, 0).slice(0, 300))

const r = await sb.rpc('submit_attempt', { a_id: attemptId, p_answers: Object.entries(answers).map(([qid, oid]) => ({ question_id: qid, option_id: oid })), passing_score: 60 })
if (r.error) {
  console.log('submit_attempt ERROR:', r.error.code, '|', r.error.message.trim())
  console.log('hint:', r.error.hint ?? '')
  console.log('details:', r.error.details ?? '')
} else {
  console.log('submit_attempt OK score_percent:', r.data?.score_percent, 'passed:', r.data?.passed, JSON.stringify({ correct: r.data?.correct, wrong: r.data?.wrong, unanswered: r.data?.unanswered, total: r.data?.total }))
}
process.exit(0)