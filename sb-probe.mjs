import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync('/home/ahmed-omran/projects/exam_website/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^=#]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const cats = await sb.from('public_categories').select('id, slug, name')
const qs = await sb.from('public_questions').select('id, category_id')
const per = {}
for (const q of qs.data ?? []) per[q.category_id] = (per[q.category_id] ?? 0) + 1
for (const c of cats.data ?? []) console.log(`${c.slug.padEnd(18)} ${c.name.padEnd(30)} active=${per[c.id] ?? 0}`)

const { data: acts } = await sb.auth.signInWithPassword({ email: 'omar@exam.com', password: 'omar369@' })
const { data: attempts } = await sb.from('quiz_attempts').select('candidate_name, status, exam_id, score_percent, created_at').order('created_at', { ascending: true })
console.log('\nattempts:')
for (const a of attempts ?? []) console.log(`  ${a.status.padEnd(12)} ${a.candidate_name?.padEnd(25) ?? '—'} exam=${a.exam_id ?? '—'} score=${a.score_percent}`) 
process.exit(0)