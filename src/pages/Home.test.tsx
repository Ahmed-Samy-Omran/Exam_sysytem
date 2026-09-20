import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from './Home'
import { getRepository } from '@/lib/repository/factory'
import { MockRepository } from '@/lib/repository/mock'

vi.mock('@/lib/repository/factory', () => ({
  getRepository: vi.fn(),
  getMode: vi.fn(() => 'mock'),
  resetRepository: vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe('HomePage — قائمة الامتحانات المنشورة', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('يعرض الامتحانات النشطة كروابط مباشرة إلى صفحة البدء', async () => {
    const repo = new MockRepository()
    vi.mocked(getRepository).mockReturnValue(repo)

    renderPage()
    const link = await screen.findByRole('link', { name: /اختبار تدريبي شامل/ })
    expect(link).toHaveAttribute('href', '#/exam/start?exam=demo-exam')
  })

  it('لا يعرض روابط امتحانات عندما تكون كل الامتحانات غير نشطة', async () => {
    const repo = new MockRepository()
    const exam = await repo.getExamBySlug('demo-exam')
    ;(repo as unknown as { examsById: Map<string, { is_active: boolean }> }).examsById.get(exam!.id)!.is_active = false
    vi.mocked(getRepository).mockReturnValue(repo)

    renderPage()
    await screen.findByText('لا توجد امتحانات متاحة حاليًا')
    expect(screen.queryByRole('link', { name: /اختبار تدريبي شامل/ })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('link', { name: /ابدأ الاختبار/ })).not.toBeInTheDocument())
  })
})