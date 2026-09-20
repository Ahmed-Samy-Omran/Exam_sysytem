import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { ExamStartPage } from './ExamStartPage'
import { getRepository } from '@/lib/repository/factory'
import { MockRepository } from '@/lib/repository/mock'

vi.mock('@/lib/repository/factory', () => ({
  getRepository: vi.fn(),
  getMode: vi.fn(() => 'mock'),
  resetRepository: vi.fn(),
}))

const STORAGE_KEY = 'active_exam_attempt'

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}{loc.search}</div>
}

function renderPage(Exam: string = 'demo-exam') {
  return render(
    <MemoryRouter initialEntries={['/exam/start?exam=' + Exam]}>
      <LocationProbe />
      <ExamStartPage />
    </MemoryRouter>,
  )
}

const nameInput = () => screen.getByPlaceholderText('اكتب اسمك الكامل')
const emailInput = () => screen.getByPlaceholderText('example@domain.com')
const startButton = () => screen.getByRole('button', { name: /ابدأ الاختبار/ })

function useRepo() {
  const repo = new MockRepository()
  vi.mocked(getRepository).mockReturnValue(repo)
  return repo
}

async function fillForm(value: string, email?: string) {
  renderPage()
  await screen.findByPlaceholderText('اكتب اسمك الكامل')
  fireEvent.change(nameInput(), { target: { value } })
  if (email !== undefined) fireEvent.change(emailInput(), { target: { value: email } })
}

async function clickStartAndNavigate() {
  fireEvent.click(startButton())
  // wait for either navigation or error alert (both resolve the test)
  await waitFor(
    () => {
      const loc = screen.getByTestId('location')
      if (loc.textContent?.includes('/quiz/')) return
      if (screen.queryByRole('alert')) return
      throw new Error('not yet')
    },
    { timeout: 5000 },
  )
}

describe('ExamStartPage — تدفق دخول المتقدم', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('يرفض الاسم المفقود أو الفارغ ولا ينشئ محاولة', async () => {
    const repo = useRepo()
    const spy = vi.spyOn(repo, 'createCandidateAttempt')

    await fillForm('   ')
    fireEvent.click(startButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('الاسم مطلوب')
    expect(spy).not.toHaveBeenCalled()
  })

  it('ينشئ محاولة واحدة بالاسم الصحيح ويوجه إلى صفحة الاختبار', async () => {
    const repo = useRepo()
    const spy = vi.spyOn(repo, 'createCandidateAttempt')

    await fillForm('  أحمد  ')
    await clickStartAndNavigate()

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('أحمد', undefined, 'exam-default')

    const attemptId = (await spy.mock.results[0].value).attempt_id
    expect(screen.getByTestId('location')).toHaveTextContent(`/quiz/${attemptId}`)
  })

  it('يحفظ البريد الاختياري مرسلاً بشكل صحيح', async () => {
    const repo = useRepo()
    const spy = vi.spyOn(repo, 'createCandidateAttempt')

    await fillForm('أحمد', 'ahmed@example.com')
    await clickStartAndNavigate()

    expect(spy).toHaveBeenCalledWith('أحمد', 'ahmed@example.com', 'exam-default')
  })

  it('يمنع النقر المزدوج على زر البدء من إصدار طلبين', async () => {
    const repo = useRepo()
    let resolveFn!: (value: { attempt_id: string; candidate_name: string; candidate_email: string; status: string; started_at: string }) => void
    const pending = new Promise<{ attempt_id: string; candidate_name: string; candidate_email: string; status: string; started_at: string }>((resolve) => {
      resolveFn = resolve
    })
    const spy = vi.spyOn(repo, 'createCandidateAttempt').mockImplementationOnce(() => pending)

    await fillForm('أحمد')
    const button = startButton()
    await act(async () => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /جارٍ إنشاء المحاولة/ })).toBeDisabled()

    await act(() =>
      resolveFn({ attempt_id: 'single-1', candidate_name: 'أحمد', candidate_email: '', status: 'in_progress', started_at: '2026-09-19T00:00:00Z' }),
    )
  })

  it('يعرض أخطاء RPC بوضوح ويعيد تفعيل الزر', async () => {
    const repo = useRepo()
    const spy = vi.spyOn(repo, 'createCandidateAttempt')
    spy.mockRejectedValueOnce(new Error('فشل الاتصال بقاعدة البيانات'))

    await fillForm('أحمد')
    fireEvent.click(startButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('فشل الاتصال بقاعدة البيانات')
    await waitFor(() => expect(startButton()).not.toBeDisabled())
  })

  it('إعادة فتح الصفحة مع محاولة قيد التنفيذ تعيد التوجيه دون محاولة جديدة', async () => {
    const spy = vi.spyOn(useRepo(), 'createCandidateAttempt')
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ attempt_id: 'restored-1', status: 'in_progress' }))

    renderPage()
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/quiz/restored-1'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('محاولة منتهية في الجلسة تُمسح وتُعرض صفحة البداية من جديد', async () => {
    const spy = vi.spyOn(useRepo(), 'createCandidateAttempt')
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ attempt_id: 'done-1', status: 'submitted' }))

    renderPage()
    await screen.findByPlaceholderText('اكتب اسمك الكامل')
    await waitFor(() => expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull())
    expect(screen.getByTestId('location')).toHaveTextContent('/exam/start?exam=demo-exam')
    expect(spy).not.toHaveBeenCalled()
  })

  it('يعرض خطأ إذا كان رابط الامتحان غير صحيح', async () => {
    renderPage('non-existent-exam')
    await screen.findByText(/رابط الامتحان غير صحيح/)
    expect(screen.getByRole('button', { name: /العودة للرئيسية/ })).toBeInTheDocument()
  })
})
