import { createClient } from '@supabase/supabase-js'
const URL = 'https://ivimbrghijbzcdbjaqre.supabase.co'
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2aW1icmdoaWpiemNkYmphcXJlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2NjY3NjksImV4cCI6MjEwNTI0Mjc2OX0.IBURAzjB_3DgKQYe_d9yu82d-EBK95WgHdRztJ6yEl8'
const sb = createClient(URL, ANON)
const pe = (e) => `${e.code} | ${e.message.slice(0, 90)}`
await sb.auth.signInWithPassword({ email: 'omar@exam.com', password: 'omar369@' })

const count = async (t) => {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
  return error ? `${t}: ERR ${pe(error)}` : `${t}: ${count ?? '?'}`
}
console.log('=== COUNTS (authenticated admin) ===')
for (const t of ['categories', 'questions', 'question_options', 'quiz_settings', 'quiz_attempts', 'attempt_questions', 'attempt_answers', 'admin_users', 'exams', 'exam_sections']) console.log(await count(t))

console.log('\n=== EXAMS (latest 5) ===')
const { data: ex, error: ee } = await sb.from('exams').select('id,title,slug,is_active,passing_score,time_limit_minutes,allow_retakes,created_at').order('created_at', { ascending: false }).limit(5)
console.log(ee ? pe(ee) : JSON.stringify((ex ?? []).map((e) => ({ slug: e.slug, active: e.is_active, pass: e.passing_score, time: e.time_limit_minutes, retakes: e.allow_retakes })), null, 1))

console.log('\n=== ATTEMPTS (latest 8) ===')
const { data: atts, error: ea } = await sb.from('quiz_attempts').select('id,status,candidate_name,candidate_email,exam_id,score_percent,correct_count,wrong_count,unanswered_count,passing_score,started_at,submitted_at').order('started_at', { ascending: false }).limit(8)
console.log(ea ? pe(ea) : JSON.stringify((atts ?? []).map((a) => ({ name: a.candidate_name, status: a.status, exam: a.exam_id?.slice(0, 8), score: a.score_percent, correct: a.correct_count, wrong: a.wrong_count, unans: a.unanswered_count, pass: a.passing_score })), null, 1))

console.log('\n=== attempt_questions snapshot cols (admin) ===')
const { data: aq, error: eaq } = await sb.from('attempt_questions').select('id,question_id,question_text_snapshot,correct_option_id,option_order,display_order,category_name').limit(2)
console.log(eaq ? pe(eaq) : `${(aq ?? []).length} rows | sample option_order keys: ${JSON.stringify(Object.keys((aq?.[0]?.option_order?.[0]) ?? {}))}`)

console.log('\n=== admin_users ===')
const { data: adm, error: eadm } = await sb.from('admin_users').select('email')
console.log(eadm ? pe(eadm) : JSON.stringify(adm ?? []))
await sb.auth.signOut()
process.exit(0)