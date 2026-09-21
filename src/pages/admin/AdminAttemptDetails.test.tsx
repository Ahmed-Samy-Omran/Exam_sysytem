import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminAttemptDetailsPage } from './AdminAttemptDetails'
import { getRepository } from '@/lib/repository/factory'
import { MockRepository } from '@/lib/repository/mock'

vi.mock('@/lib/repository/factory', () => ({
  getRepository: vi.fn(),
  getMode: vi.fn(() => 'mock'),
  resetRepository: vi.fn(),
}))

function renderPage(attemptId: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/attempts/${attemptId}`]}>
      <Routes>
        <Route path="/admin/attempts/:attemptId" element={<AdminAttemptDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminAttemptDetailsPage — تفاصيل محاولة المتقدم', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('يعرض بيانات المتقدم والدرجة والمراجعة الكاملة', async () => {
    const repo = new MockRepository()
    vi.mocked(getRepository).mockReturnValue(repo)

    const result = await repo.createCandidateAttempt('أحمد', 'ahmed@example.com', 'exam-default')
    const quiz = await repo.getAttempt(result.attempt_id)
    const q = quiz.questions[0]!
    const answers = { [q.question_id]: q.options[1]!.option_id }
    await repo.submitAttempt(result.attempt_id, answers, 70)

    renderPage(result.attempt_id)

    expect(await screen.findByText('أحمد')).toBeInTheDocument()
    expect(screen.getByText('تفاصيل المحاولة')).toBeInTheDocument()
    expect(screen.getByText(/مراجعة الإجابات/)).toBeInTheDocument()
    expect(screen.getAllByText(/\d+\.\s/).length).toBeGreaterThan(0)
    const reviewSection = screen.getByRole('region', { name: 'مراجعة الإجابات' })
    expect(within(reviewSection).getAllByText(/^(صحيح|خطأ|غير مجاب)$/).length).toBe(quiz.questions.length)
  })

  it('يعرض رسالة واضحة عند محاولة غير موجودة', async () => {
    const repo = new MockRepository()
    vi.mocked(getRepository).mockReturnValue(repo)

    renderPage('missing-id')
    expect(await screen.findByText(/المحاولة غير موجودة/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /العودة للوحة التحكم/ })).toBeInTheDocument()
  })
})