import { describe, expect, it } from 'vitest'
import { MockRepository } from './mock'

describe('MockRepository — تدفق دخول المتقدم', () => {
  it('ينشئ محاولة كاملة بالاسم ويُمكن قراءتها والاستمرار فيها', async () => {
    const repo = new MockRepository()
    const result = await repo.createCandidateAttempt('أحمد')

    expect(result.status).toBe('in_progress')
    expect(result.candidate_name).toBe('أحمد')
    expect(result.candidate_email).toBe('')
    expect(result.attempt_id).toBeTruthy()

    const quiz = await repo.getAttempt(result.attempt_id)
    expect(quiz.attempt_id).toBe(result.attempt_id)
    expect(quiz.questions.length).toBeGreaterThan(0)
  })

  it('يحفظ البريد الاختياري', async () => {
    const repo = new MockRepository()
    const result = await repo.createCandidateAttempt('أحمد', 'ahmed@example.com')
    expect(result.candidate_email).toBe('ahmed@example.com')
  })

  it('يعيد نفس المحاولة القيد-التنفيذ عند التكرار بدل إنشاء أخرى', async () => {
    const repo = new MockRepository()
    const first = await repo.createCandidateAttempt('سارة', 'sara@example.com')
    const second = await repo.createCandidateAttempt('سارة', 'sara@example.com')

    expect(second.attempt_id).toBe(first.attempt_id)
    expect((await repo.getAttempt(first.attempt_id)).questions.length).toBeGreaterThan(0)
  })

  it('يرفض الاسم الفارغ أو الفراغات فقط', async () => {
    const repo = new MockRepository()
    await expect(repo.createCandidateAttempt('   ')).rejects.toThrow(/الاسم مطلوب/)
    await expect(repo.createCandidateAttempt('')).rejects.toThrow(/الاسم مطلوب/)
  })

  it('لا يؤثر تدفق المتقدم على مسار الاختبار الحالي (إنشاء → استرجاع → تصحيح)', async () => {
    const repo = new MockRepository()
    const cats = await repo.getPublicCategories()
    const settings = await repo.getSettingsBySlug()

    const setup = cats.map((c) => ({ slug: c.slug, count: settings[c.slug]?.question_count_default ?? 10 }))
    const quiz = await repo.createAttempt(setup, 30)
    const fetched = await repo.getAttempt(quiz.attempt_id)
    expect(fetched.questions).toHaveLength(quiz.questions.length)

    const q = fetched.questions[0]!
    const correct = q.options[0]!.option_id
    const answers = { [q.question_id]: correct }
    const result = await repo.submitAttempt(quiz.attempt_id, answers, 70)

    expect(result.attempt_id).toBe(quiz.attempt_id)
    expect(result.score_percent).toBeGreaterThanOrEqual(0)
    expect(result.review.length).toBe(quiz.questions.length)

    const stats = await repo.getStats()
    expect(stats.attempts).toBe(1)
  })
})

describe('MockRepository — تفاصيل المحاولات للمدير', () => {
  it('يحسب ملخص نشاط الامتحانات بعد محاولات مكتملة', async () => {
    const repo = new MockRepository()
    const result = await repo.createCandidateAttempt('أحمد', 'a@example.com', 'exam-default')
    const quiz = await repo.getAttempt(result.attempt_id)
    const answers = { [quiz.questions[0]!.question_id]: quiz.questions[0]!.options[0]!.option_id }
    await repo.submitAttempt(result.attempt_id, answers, 70)

    const summaries = await repo.getExamAttemptSummaries()
    const exam = summaries.find((e) => e.id === 'exam-default')
    expect(exam?.attempts).toBe(1)
    expect(exam?.title).toBeTruthy()
  })

  it('يعيد تفاصيل محاولة كاملة بمراجعة سؤال-بسؤال', async () => {
    const repo = new MockRepository()
    const result = await repo.createCandidateAttempt('سارة', 's@example.com', 'exam-default')
    const quiz = await repo.getAttempt(result.attempt_id)
    const q = quiz.questions[0]!
    const answers = { [q.question_id]: q.options[1]!.option_id }
    await repo.submitAttempt(result.attempt_id, answers, 70)

    const details = await repo.getAdminAttemptDetails(result.attempt_id)
    expect(details.candidate_name).toBe('سارة')
    expect(details.candidate_email).toBe('s@example.com')
    expect(details.review.length).toBe(quiz.questions.length)
    expect(details.review[0]!.question.category_name).toBeTruthy()
    expect(details.score_percent).toBeGreaterThanOrEqual(0)
  })

  it('يرمي خطأ لتفاصيل محاولة غير موجودة', async () => {
    const repo = new MockRepository()
    await expect(repo.getAdminAttemptDetails('missing-id')).rejects.toThrow(/المحاولة غير موجودة/)
  })
})