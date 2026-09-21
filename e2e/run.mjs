import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const ADMIN_USER = 'omar@exam.com'
const ADMIN_PASS = 'omar369@'
const SLUG = 'e2e-qa'
const EXAM_LINK = `${BASE}/#/exam/start?exam=${SLUG}`
const TITLE = 'اختبار القبول QA'
const CAND1 = 'محمد المتقدم'
const CAND2 = 'منى المختبرة'

const env = {}
for (const line of readFileSync('/home/ahmed-omran/projects/exam_website/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([^=#]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim()
}
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const results = []
function step(name, ok, extra = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}${extra ? ' | ' + extra : ''}`)
}
function must(cond, name, extra = '') {
  if (!cond) throw new Error(`ASSERT failed: ${name} ${extra}`)
}
const visible = (loc, t) => loc.waitFor({ state: 'visible', timeout: 20000 })

async function adminCleanup() {
  const s = await sb.auth.signInWithPassword({ email: ADMIN_USER, password: ADMIN_PASS })
  if (s.error) throw new Error('admin signin for cleanup: ' + s.error.message)
  const { data: ex } = await sb.from('exams').select('id').eq('slug', SLUG)
  for (const e of ex ?? []) {
    try { await sb.from('exams').delete().eq('id', e.id) } catch { /* ignore */ }
  }
  await sb.auth.signOut()
}

async function verifyScoring(attemptId, expectedTotal) {
  const s = await sb.auth.signInWithPassword({ email: ADMIN_USER, password: ADMIN_PASS })
  must(!s.error, 'programmatic admin signin for scoring check')
  const { data: attempt } = await sb.from('quiz_attempts').select('*').eq('id', attemptId).single()
  must(attempt, 'attempt row exists for scoring check', attemptId)
  const { data: aqs } = await sb.from('attempt_questions').select('id, question_id, correct_option_id').eq('attempt_id', attemptId)
  const aqIds = (aqs ?? []).map((q) => q.id)
  const { data: ans } = await sb.from('attempt_answers').select('attempt_question_id, chosen_option_id').in('attempt_question_id', aqIds)
  must(aqs && aqs.length === expectedTotal, `attempt_questions count == ${expectedTotal}`, `got ${aqs?.length}`)
  const byAq = Object.fromEntries((ans ?? []).map((a) => [a.attempt_question_id, a.chosen_option_id]))
  let correct = 0, wrong = 0, unanswered = 0
  for (const q of aqs) {
    const chosen = byAq[q.id] ?? null
    if (chosen == null) unanswered++
    else if (chosen === q.correct_option_id) correct++
    else wrong++
  }
  const pct = Math.round((correct / expectedTotal) * 100)
  const dbPct = Math.round(Number(attempt.score_percent))
  step(`backend scoring recompute ${attemptId}`, correct + wrong + unanswered === expectedTotal && pct === dbPct && Number(attempt.correct_count) === correct && Number(attempt.wrong_count) === wrong && Number(attempt.unanswered_count) === unanswered,
    `recomputed ${correct}/${wrong}/${unanswered}=${pct}% vs DB ${attempt.correct_count}/${attempt.wrong_count}/${attempt.unanswered_count}=${dbPct}%`)
  await sb.auth.signOut()
  return { correct, wrong, unanswered, pct }
}

const browser = await chromium.launch()
const admin = await browser.newContext()
const adminPage = await admin.newPage()

try {
  await adminCleanup()

  // ================= ADMIN: LOGIN =================
  step('admin: load /admin/login', true)
  await adminPage.goto(`${BASE}/#/admin/login`)
  await visible(adminPage.getByText('لوحة الإدارة'))
  await adminPage.locator('input[placeholder="omar@exam.com"]').fill(ADMIN_USER)
  await adminPage.locator('input[type="password"]').fill(ADMIN_PASS)
  await adminPage.getByRole('button', { name: /دخول/ }).click()
  await adminPage.waitForURL(/#\/admin$/, { timeout: 20000 })
  step('admin: login with omar@exam.com', true, `url=${adminPage.url()}`)

  // ================= ADMIN: CREATE EXAM =================
  await adminPage.goto(`${BASE}/#/admin/exams`)
  await visible(adminPage.getByText('إدارة الامتحانات'))
  await adminPage.getByRole('button', { name: /امتحان جديد/ }).click()
  await adminPage.getByPlaceholder('مثال: اختبار المحاسبة للمبتدئين').fill(TITLE)
  await adminPage.getByPlaceholder('مثال: accounting-basics').fill(SLUG)
  await adminPage.getByPlaceholder('وصف مختصر للامتحان').fill('امتحان شامل تم إنشاؤه بواسطة اختبارات E2E')
  await adminPage.getByPlaceholder('مثال: أجب على جميع الأسئلة. لا يمكن التراجع بعد التسليم.').fill('أجب على جميع الأسئلة. لا يمكن التراجع بعد التسليم.')
  await adminPage.locator('input[type="number"]').nth(0).fill('60')
  await adminPage.locator('input[type="number"]').nth(1).fill('3')
  await adminPage.locator('#retakes').uncheck()
  await adminPage.locator('input[type="number"]').nth(2).fill('4')
  await adminPage.getByRole('button', { name: /إنشاء الامتحان/ }).click()
  await visible(adminPage.getByText('تم إنشاء الامتحان'))
  await visible(adminPage.getByRole("cell", { name: TITLE }))
  await visible(adminPage.getByRole('cell', { name: SLUG }))
  step('admin: create+publish exam', true, `slug=${SLUG} active`)

  // ================= CANDIDATE 1: full flow =================
  const ctx1 = await browser.newContext()
  const p1 = await ctx1.newPage()
  await p1.goto(EXAM_LINK)
  await visible(p1.getByRole("heading", { name: TITLE }))
  await visible(p1.getByText('أجب على جميع الأسئلة. لا يمكن التراجع بعد التسليم.'))
  await visible(p1.getByText('دخول كضيف'))
  step('candidate1: opens valid exam link, sees instructions/badges', true)

  await p1.getByRole('button', { name: /ابدأ الاختبار/ }).click()
  await visible(p1.getByRole('alert'))
  const emptyErr = (await p1.getByRole('alert').innerText()).trim()
  step('candidate1: empty name blocked', emptyErr.includes('الاسم مطلوب'), emptyErr)

  await p1.locator('input[name="name"]').fill(CAND1)
  await p1.locator('input[name="email"]').fill('mohamed@example.com')
  await p1.getByRole('button', { name: /ابدأ الاختبار/ }).click()
  await p1.waitForURL(/\/quiz\/[0-9a-f-]+$/, { timeout: 30000 })
  const quizUrl = p1.url()
  const attemptId = quizUrl.split('/quiz/')[1].split(/[?#]/)[0]
  step('candidate1: starts attempt', true, `attemptId=${attemptId}`)

  await visible(p1.getByText('1 / 4'))
  const timerTxt = await p1.getByText(/\d\d:\d\d/).innerText().catch(() => '')
  step('candidate1: timer visible (03:00 limit)', /^\d\d:\d\d$/.test(timerTxt), timerTxt)

  // answer all 4 (first option each)
  for (let i = 0; i < 4; i++) {
    if (i > 0) await p1.getByRole('button', { name: /التالي/ }).click()
    const radios = p1.locator('input[type="radio"]')
    await radios.first().check()
  }
  await visible(p1.getByText('أجبت على 4 من 4'))
  step('candidate1: answers all questions', true)

  await p1.getByRole('button', { name: /تسليم الاختبار/ }).click()
  await visible(p1.getByText('تأكيد التسليم'))
  await p1.getByRole('button', { name: /تسليم نهائي/ }).click()
  await p1.waitForURL(/\/result$/, { timeout: 30000 })
  await visible(p1.getByRole('heading', { name: 'نتيجة الاختبار' }))
  step('candidate1: submission -> result page', true, `url=${p1.url()}`)

  const scoreTxt = (await p1.locator('h2').innerText()).replace('%', '').trim()
  const score1 = Number(scoreTxt)
  await visible(p1.getByText('مراجعة الإجابات'))
  const reviewBlocks = await p1.locator('main .space-y-1').count()
  step('candidate1: review section with 4 question blocks', reviewBlocks >= 4, `blocks=${reviewBlocks}`)
  const { correct: c1, wrong: w1, unanswered: u1, pct: pct1 } = await verifyScoring(attemptId, 4)
  step('candidate1: displayed score matches backend', score1 === pct1, `page=${score1}% backend=${pct1}% (c${c1}/w${w1}/u${u1})`)

  // resume blocked: reopen link, same name -> completed notice (no retakes)
  await p1.goto(EXAM_LINK)
  await visible(p1.getByRole("heading", { name: TITLE }))
  await p1.locator('input[name="name"]').fill(CAND1)
  await p1.getByRole('button', { name: /ابدأ الاختبار/ }).click()
  await visible(p1.locator('[role="alert"]'))
  const notice = await p1.locator('[role="alert"]').innerText()
  step('candidate1: retake blocked after completion (no retakes)', notice.includes('لا يُسمح بإعادة المحاولة'), notice.slice(0, 60))
  const { data: dup } = await sb.from('quiz_attempts').select('id').eq('candidate_name', CAND1).eq('status', 'in_progress').eq('exam_id', (await sb.from('exams').select('id').eq('slug', SLUG).single()).data.id)
  step('candidate1: no duplicate in-progress attempt created', (dup ?? []).length === 0)

  // refresh-during-quiz + resume
  const ctx2 = await browser.newContext()
  const p2 = await ctx2.newPage()
  await p2.goto(EXAM_LINK)
  await visible(p2.getByRole("heading", { name: TITLE }))
  await p2.locator('input[name="name"]').fill(CAND2)
  await p2.getByRole('button', { name: /ابدأ الاختبار/ }).click()
  await p2.waitForURL(/\/quiz\/[0-9a-f-]+$/, { timeout: 30000 })
  await visible(p2.getByText('1 / 4'))
  await p2.locator('input[type="radio"]').first().check()
  await p2.getByRole('button', { name: /التالي/ }).click()
  await p2.locator('input[type="radio"]').first().check()
  await visible(p2.getByText('أجبت على 2 من 4'))

  await p2.reload()
  await visible(p2.getByText('1 / 4').or(p2.getByText('2 / 4')))
  const restored = await p2.getByText('أجبت على 2 من 4').isVisible()
  const radioRestored = await p2.locator('input[type="radio"]').first().isChecked()
  step('candidate2: refresh preserves answers', restored && radioRestored)

  // resume via new tab (fresh sessionStorage -> same in-progress attempt)
  const p2b = await ctx2.newPage()
  await p2b.goto(EXAM_LINK)
  await visible(p2b.getByRole("heading", { name: TITLE }))
  await p2b.locator('input[name="name"]').fill(CAND2)
  await p2b.getByRole('button', { name: /ابدأ الاختبار/ }).click()
  await p2b.waitForURL(/\/quiz\/[0-9a-f-]+$/, { timeout: 30000 })
  const id2a = p2.url().match(/\/quiz\/([0-9a-f-]+)/)?.[1]
  const id2b = p2b.url().match(/\/quiz\/([0-9a-f-]+)/)?.[1]
  step('candidate2: opening link again resumes same attempt (new tab)', true, `url=${p2b.url()}`)
  step('candidate2: resumed attempt id matches', id2b === id2a, `${id2b} / ${id2a}`)
  await p2b.close()

  await p2.getByRole('button', { name: /التالي/ }).click()
  await p2.locator('input[type="radio"]').first().check()
  await p2.getByRole('button', { name: /التالي/ }).click()
  await p2.locator('input[type="radio"]').first().check()
  await visible(p2.getByText('أجبت على 4 من 4'))
  await p2.getByRole('button', { name: /تسليم الاختبار/ }).click()
  await p2.getByRole('button', { name: /تسليم نهائي/ }).click()
  await p2.waitForURL(/\/result$/, { timeout: 30000 })
  step('candidate2: completes exam normally', true)

  // ================= ADMIN: results =================
  await adminPage.goto(`${BASE}/#/admin`)
  await visible(adminPage.getByText('آخر الاختبارات المكتملة'))
  const dash = await adminPage.locator('main, body').innerText({ timeout: 20000 })
  step('admin: dashboard lists candidate1 results', dash.includes(CAND1) && dash.includes('mohamed@example.com') && dash.includes(TITLE) && (dash.includes('ناجح') || dash.includes('راسب')))
  const dashLines = dash.split('\n').filter((l) => l.includes(CAND1) || l.includes(CAND2) || l.includes(TITLE))
  step('admin: dashboard lists candidate2 results', dash.includes(CAND2))

  // ================= INACTIVE EXAM =================
  await adminPage.goto(`${BASE}/#/admin/exams`)
  await visible(adminPage.getByRole("cell", { name: TITLE }))
  await adminPage.getByRole('button', { name: /نشط/ }).first().click()
  await visible(adminPage.getByText('تم إيقاف الامتحان'))
  const ctx3 = await browser.newContext()
  const p3 = await ctx3.newPage()
  await p3.goto(EXAM_LINK)
  await visible(p3.getByText('عذراً، لا يمكن الوصول إلى هذا الامتحان'))
  step('candidate: inactive exam link -> error page', true, await p3.getByText('عذراً، لا يمكن الوصول إلى هذا الامتحان').innerText())
  await p3.close(); await ctx3.close()
  await adminPage.getByRole('button', { name: /غير نشط/ }).first().click()
  await visible(adminPage.getByText('تم تفعيل الامتحان'))
  step('admin: exam re-activated', true)

  // ================= INVALID LINK =================
  const p4 = await (await browser.newContext()).newPage()
  await p4.goto(`${BASE}/#/exam/start?exam=no-such-exam`)
  await visible(p4.getByText(/رابط الامتحان غير صحيح أو غير موجود/))
  step('candidate: invalid slug -> clear error', true)

} catch (e) {
  console.error('\nE2E interrupted by failure:', e.message)
  process.exitCode = 1
} finally {
  await browser.close()
}

const fails = results.filter((r) => !r.ok)
console.log(`\n==== E2E SUMMARY: ${results.length - fails.length}/${results.length} passed ====`)
if (fails.length) {
  console.log('FAILED:')
  for (const f of fails) console.log('  -', f.name)
  process.exitCode = 1
}