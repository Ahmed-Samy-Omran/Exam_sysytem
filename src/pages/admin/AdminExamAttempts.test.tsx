import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminExamAttemptsPage } from './AdminExamAttempts'
import { getRepository } from '@/lib/repository/factory'
import { MockRepository } from '@/lib/repository/mock'

vi.mock('@/lib/repository/factory', () => ({
  getRepository: vi.fn(),
  getMode: vi.fn(() => 'mock'),
  resetRepository: vi.fn(),
}))

function renderPage(examId: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/exams/${examId}/attempts`]}>
      <Routes>
        <Route path="/admin/exams/:examId/attempts" element={<AdminExamAttemptsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminExamAttemptsPage — محاولات امتحان محدد', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('يعرض محاولات الامتحان مع النتيجة والحالة', async () => {
    const repo = new MockRepository()
    vi.mocked(getRepository).mockReturnValue(repo)

    const result = await repo.createCandidateAttempt('أحمد', 'ahmed@example.com', 'exam-default')
    const quiz = await repo.getAttempt(result.attempt_id)
    const answers = { [quiz.questions[0]!.question_id]: quiz.questions[0]!.options[1]!.option_id }
    await repo.submitAttempt(result.attempt_id, answers, 70)

    renderPage('exam-default')

    expect(await screen.findByText('أحمد')).toBeInTheDocument()
    expect(screen.getByText('اختبار تدريبي شامل')).toBeInTheDocument()
    expect(screen.getByText('مكتمل')).toBeInTheDocument()
  })

  it('يعرض رسالة عند عدم وجود محاولات', async () => {
    const repo = new MockRepository()
    vi.mocked(getRepository).mockReturnValue(repo)

    renderPage('exam-default')

    expect(await screen.findByText(/لا توجد محاولات لهذا الامتحان بعد/)).toBeInTheDocument()
  })
})