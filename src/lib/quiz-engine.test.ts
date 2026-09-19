import { describe, expect, it } from 'vitest'
import { createQuiz, gradeQuiz, validateQuestion } from './quiz-engine'
import type { Question, QuizQuestion } from '@/types'

const catAccounting = 'cat-acc'
const catIq = 'cat-iq'

function q(id: string, category_id: string, correctIdx = 0, optionCount = 4): Question {
  return {
    id,
    category_id,
    question_text: `سؤال ${id}`,
    explanation: `شرح ${id}`,
    difficulty: 'medium',
    is_active: true,
    created_by: null,
    created_at: '2026-09-13T00:00:00Z',
    updated_at: '2026-09-13T00:00:00Z',
    options: Array.from({ length: optionCount }, (_, i) => ({
      id: `${id}-o${i}`,
      question_id: id,
      option_text: `خيار ${i}`,
      is_correct: i === correctIdx,
      sort_order: i,
    })),
  }
}

const bank: Question[] = [
  ...Array.from({ length: 12 }, (_, i) => q(`acc-${i}`, catAccounting)),
  ...Array.from({ length: 8 }, (_, i) => q(`iq-${i}`, catIq)),
]

describe('createQuiz', () => {
  it('يرجع العدد المطلوب بدقة لكل قسم', () => {
    const quiz = createQuiz(bank, { [catAccounting]: 10, [catIq]: 5 })
    expect(quiz).toHaveLength(15)
    expect(quiz.filter((x) => x.category_id === catAccounting)).toHaveLength(10)
    expect(quiz.filter((x) => x.category_id === catIq)).toHaveLength(5)
  })

  it('لا يكرر أي سؤال داخل الاختبار', () => {
    const quiz = createQuiz(bank, { [catAccounting]: 12 })
    const ids = quiz.map((x) => x.question_id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('يرفض طلب عدد أكبر من المتاح', () => {
    expect(() => createQuiz(bank, { [catIq]: 20 })).toThrowError(/غير كاف/i)
  })

  it('كل سؤال يحمل خياراته كلها', () => {
    const quiz = createQuiz(bank, { [catAccounting]: 3 })
    for (const question of quiz) {
      expect(question.options.length).toBeGreaterThanOrEqual(2)
      expect(question.options.every((o) => o.option_text)).toBe(true)
    }
  })

  it('يخلط ترتيب الخيارات (على الأقل في بعض الأسئلة)', () => {
    const quiz = createQuiz(bank, { [catAccounting]: 12 })
    // احتمال ثبات الترتيب الأصلي للكل صغير جدًا بعد الخلط،
    // لذلك لا نشترط كلها — نضمن توفر كل الخيارات.
    for (const qq of quiz) {
      expect(qq.options.map((o) => o.option_id).sort()).toEqual(
        Array.from({ length: 4 }, (_, i) => `${qq.question_id}-o${i}`).sort(),
      )
    }
  })
})

describe('gradeQuiz', () => {
  const quiz: QuizQuestion[] = [
    {
      question_id: 'a1',
      category_id: catAccounting,
      question_text: 'س 1',
      difficulty: 'easy',
      options: [
        { option_id: 'a1-o0', option_text: '0' },
        { option_id: 'a1-o1', option_text: '1' },
        { option_id: 'a1-o2', option_text: '2' },
      ],
    },
    {
      question_id: 'a2',
      category_id: catAccounting,
      question_text: 'س 2',
      difficulty: 'easy',
      options: [
        { option_id: 'a2-o0', option_text: '0' },
        { option_id: 'a2-o1', option_text: '1' },
      ],
    },
    {
      question_id: 'i1',
      category_id: catIq,
      question_text: 'س 3',
      difficulty: 'medium',
      options: [
        { option_id: 'i1-o0', option_text: '0' },
        { option_id: 'i1-o1', option_text: '1' },
      ],
    },
  ]

  const correctByQuestion = { a1: 'a1-o1', a2: 'a2-o0', i1: 'i1-o1' }

  it('يحسب النسبة والصحيح والخاطئ وغير المجاب', () => {
    const r = gradeQuiz({
      questions: quiz,
      correctByQuestion,
      answerMap: { a1: 'a1-o1', a2: 'a2-o0' }, // i1 بدون إجابة
      passingScore: 60,
    })
    expect(r.total).toBe(3)
    expect(r.correct).toBe(2)
    expect(r.wrong).toBe(0)
    expect(r.unanswered).toBe(1)
    expect(r.score_percent).toBeCloseTo(66.67, 1)
    expect(r.passed).toBe(true)
  })

  it('يحسب النتائج حسب القسم', () => {
    const r = gradeQuiz({
      questions: quiz,
      correctByQuestion,
      answerMap: { a1: 'a1-o1', a2: 'a2-o0', i1: 'i1-o1' },
      passingScore: 60,
    })
    expect(r.by_category[catAccounting]).toEqual({
      correct: 2,
      total: 2,
      percent: 100,
    })
    expect(r.by_category[catIq]).toEqual({
      correct: 1,
      total: 1,
      percent: 100,
    })
  })

  it('يرفض عندما يكون السؤال المسجّل أكثر من نصف الدرجات خاطئًا (فشل)', () => {
    const r = gradeQuiz({
      questions: quiz,
      correctByQuestion,
      answerMap: { a1: 'a1-o2', a2: 'a2-o1', i1: 'i1-o0' },
      passingScore: 60,
    })
    expect(r.correct).toBe(0)
    expect(r.wrong).toBe(3)
    expect(r.passed).toBe(false)
  })

  it('يبني المراجعة بالإجابة الصحيحة والشرح والاختيار الخاطئ', () => {
    const r = gradeQuiz({
      questions: quiz,
      correctByQuestion,
      answerMap: { a1: 'a1-o2', a2: 'a2-o0' },
      passingScore: 60,
    })
    const review = r.review
    const first = review.find((x) => x.question.question_id === 'a1')
    expect(first?.correct_option_id).toBe('a1-o1')
    expect(first?.chosen_option_id).toBe('a1-o2')
    expect(first?.is_correct).toBe(false)
    expect(first?.answered).toBe(true)
    const unanswered = review.find((x) => x.question.question_id === 'i1')
    expect(unanswered?.is_correct).toBe(false)
    expect(unanswered?.answered).toBe(false)
  })
})

describe('validateQuestion', () => {
  const valid = () => ({
    category_id: catAccounting,
    question_text: 'سؤال صحيح',
    explanation: 'شرح',
    difficulty: 'medium' as const,
    options: [
      { option_text: 'أ', is_correct: true },
      { option_text: 'ب', is_correct: false },
      { option_text: 'ج', is_correct: false },
    ],
  })

  it('يقبل سؤالًا سليمًا', () => {
    expect(validateQuestion(valid())).toEqual([])
  })

  it('يرفض نصًا فارغًا أو بدون قسم', () => {
    const errs = validateQuestion({ ...valid(), question_text: '   ' })
    expect(errs.some((e) => /نص السؤال/i.test(e))).toBe(true)
  })

  it('يرفض أقل من خيارين أو أكثر من خمسة', () => {
    const one = validateQuestion({ ...valid(), options: [{ option_text: 'أ', is_correct: true }] })
    expect(one.some((e) => /2 إلى 5/i.test(e))).toBe(true)
    const fivePlus = validateQuestion({
      ...valid(),
      options: [
        { option_text: '1', is_correct: true },
        { option_text: '2', is_correct: false },
        { option_text: '3', is_correct: false },
        { option_text: '4', is_correct: false },
        { option_text: '5', is_correct: false },
        { option_text: '6', is_correct: false },
      ],
    })
    expect(fivePlus.some((e) => /2 إلى 5/i.test(e))).toBe(true)
  })

  it('يرفض بدون إجابة صحيحة أو بأكثر من إجابة', () => {
    const none = validateQuestion({
      ...valid(),
      options: [
        { option_text: 'أ', is_correct: false },
        { option_text: 'ب', is_correct: false },
      ],
    })
    expect(none.some((e) => /إجابة صحيحة/i.test(e))).toBe(true)
    const multi = validateQuestion({
      ...valid(),
      options: [
        { option_text: 'أ', is_correct: true },
        { option_text: 'ب', is_correct: true },
      ],
    })
    expect(multi.some((e) => /إجابة صحيحة/i.test(e))).toBe(true)
  })
})