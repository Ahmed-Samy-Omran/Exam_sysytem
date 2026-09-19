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