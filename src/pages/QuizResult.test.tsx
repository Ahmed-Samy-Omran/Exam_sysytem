import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { QuizResultPage } from './QuizResult'
import type { QuizResult } from '@/types'

/**
 * نتيجة المتقدم تُقرأ من sessionStorage لا من المستودع، لذا نبني الحمولة
 * يدويًا المهم هنا: `show_answers=false` يجب أن يُخفي عنوان القسم
 * وبطاقة "لا تتوفر مراجعة" معًا، لا أن يترك عنوانًا بلا محتوى.
 */
const ATTEMPT = 'att-1'

function makeResult(overrides: Partial<QuizResult> = {}): QuizResult {
  return {
    attempt_id: ATTEMPT,
    total: 5,
    correct: 4,
    wrong: 1,
    unanswered: 0,
    score_percent: 80,
    passed: true,
    by_category: { c1: { correct: 4, total: 5, percent: 80 } },
    category_names: { c1: 'رياضيات' },
    show_answers: true,
    review: [
      {
        question: {
          question_id: 'q1',
          category_id: 'c1',
          category_name: 'رياضيات',
          difficulty: 'easy',
          question_text: 'ما هو ٢ + ٢؟',
          options: [
            { option_id: 'o1', option_text: '٣' },
            { option_id: 'o2', option_text: '٤' },
          ],
        },
        chosen_option_id: 'o2',
        correct_option_id: 'o2',
        is_correct: true,
        answered: true,
        explanation: 'الإجابة الصحيحة أربعة.',
      },
    ],
    ...overrides,
  }
}

function renderWith(result: QuizResult) {
  sessionStorage.setItem(`quiz-result-${ATTEMPT}`, JSON.stringify(result))
  return render(
    <MemoryRouter initialEntries={[`/quiz/${ATTEMPT}/result`]}>
      <Routes>
        <Route path="/quiz/:attemptId/result" element={<QuizResultPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('QuizResultPage — قسم مراجعة الإجابات', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('يعرض عنوان المراجعة وبطاقات الأسئلة عندما يكون الخيار مفعّلًا', async () => {
    renderWith(makeResult())

    expect(await screen.findByRole('heading', { name: 'مراجعة الإجابات' })).toBeInTheDocument()
    expect(screen.getByText('ما هو ٢ + ٢؟')).toBeInTheDocument()
    expect(screen.getByText(/الإجابة الصحيحة أربعة/)).toBeInTheDocument()
  })

  it('يخفي عنوان المراجعة بالكامل عندما يكون show_answers=false', async () => {
    renderWith(makeResult({ show_answers: false }))

    // ننتظر ظهور عنوان الصفحة أولًا حتى ينتهي التحميل قبل التأكيد على الغياب.
    expect(await screen.findByText('نتيجة الاختبار')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'مراجعة الإجابات' })).not.toBeInTheDocument()
  })

  it('لا يعرض بطاقة "لا تتوفر مراجعة" القديمة', async () => {
    renderWith(makeResult({ show_answers: false }))

    await screen.findByText('نتيجة الاختبار')
    expect(screen.queryByText('لا تتوفر مراجعة الإجابات لهذا الامتحان')).not.toBeInTheDocument()
    expect(screen.queryByText(/عُرضت النتيجة فقط بناءً على إعدادات الامتحان/)).not.toBeInTheDocument()
  })

  it('لا يعرض أسئلة المراجعة إطلاقًا عند الإيقاف، حتى لو كانت البيانات موجودة', async () => {
    renderWith(makeResult({ show_answers: false }))

    await screen.findByText('نتيجة الاختبار')
    expect(screen.queryByText('ما هو ٢ + ٢؟')).not.toBeInTheDocument()
    expect(screen.queryByText(/الإجابة الصحيحة أربعة/)).not.toBeInTheDocument()
  })

  it('يُبقي بطاقة "لا توجد أسئلة للمراجعة" عندما يكون الخيار مفعّلًا لكن المراجعة فارغة', async () => {
    renderWith(makeResult({ review: [] }))

    expect(await screen.findByRole('heading', { name: 'مراجعة الإجابات' })).toBeInTheDocument()
    expect(screen.getByText('لا توجد أسئلة للمراجعة')).toBeInTheDocument()
  })

  it('لا يعرض رسالة عدم التوفر حتى لو كانت المراجعة فارغة أيضًا', async () => {
    renderWith(makeResult({ show_answers: false, review: [] }))

    await screen.findByText('نتيجة الاختبار')
    expect(screen.queryByText('لا توجد أسئلة للمراجعة')).not.toBeInTheDocument()
  })
})
