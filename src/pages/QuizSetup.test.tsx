import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuizSetupPage } from './QuizSetup'
import { getRepository } from '@/lib/repository/factory'
import { MockRepository } from '@/lib/repository/mock'

vi.mock('@/lib/repository/factory', () => ({
  getRepository: vi.fn(),
  getMode: vi.fn(() => 'mock'),
  resetRepository: vi.fn(),
}))

describe('QuizSetupPage — إنشاء رابط امتحان للمتقدمين', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ينشئ الامتحان ويعرض رابط المشاركة في نافذة بدل دخول الامتحان', async () => {
    const repo = new MockRepository()
    vi.mocked(getRepository).mockReturnValue(repo)

    render(
      <MemoryRouter>
        <QuizSetupPage />
      </MemoryRouter>,
    )

    const button = await screen.findByRole('button', { name: /إنشاء رابط الامتحان/ })
    await waitFor(() => expect(button).not.toBeDisabled())

    button.click()

    expect(await screen.findByText('تم إنشاء الامتحان')).toBeInTheDocument()
    const linkInput = await screen.findByDisplayValue(/exam=quick-/)
    expect(linkInput).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /نسخ الرابط/ })).toBeInTheDocument()

    const slug = (linkInput as HTMLInputElement).value.split('exam=')[1]
    const exam = await repo.getExamBySlug(slug)
    expect(exam).not.toBeNull()
    expect(exam?.title).toBe('اختبار سريع شامل')
  })
})