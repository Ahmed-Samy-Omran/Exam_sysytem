import type {
  AnswerMap,
  CategoryResult,
  OptionId,
  Question,
  QuestionDraftOption,
  QuestionId,
  QuizQuestion,
  QuizResult,
} from '@/types'

/** فيشر-يتس لخلط المصفوفات (لا يعدّل الأصل) */
export function shuffle<T>(input: readonly T[]): T[] {
  const arr = [...input]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

interface QuizBuildInput {
  question_id: QuestionId
  category_id: string
  question_text: string
  difficulty: 'easy' | 'medium' | 'hard'
  options: { option_id: OptionId; option_text: string }[]
}

export function toQuizQuestions(
  questions: readonly Question[],
  countsByCategory: Record<string, number>,
): QuizQuestion[] {
  const assembled: QuizBuildInput[] = []

  for (const [categoryId, wanted] of Object.entries(countsByCategory)) {
    const available = questions
      .filter((x) => x.is_active !== false && x.category_id === categoryId && x.options && x.options.length >= 2)
      .map((x) => x as Question)

    if (available.length < wanted) {
      throw new Error(
        `عدد الأسئلة المتاحة في قسم ${categoryId} غير كافٍ (المتاح ${available.length} والمطلوب ${wanted})`,
      )
    }

    const picked = shuffle(available).slice(0, wanted)
    for (const q of picked) {
      assembled.push({
        question_id: q.id,
        category_id: q.category_id,
        question_text: q.question_text,
        difficulty: q.difficulty,
        options: shuffle(q.options!).map((o) => ({ option_id: o.id, option_text: o.option_text })),
      })
    }
  }

  // خلط ترتيب الأسئلة الكلي بعد التجميع
  return shuffle(assembled)
}

export function createQuiz(
  questions: readonly Question[],
  countsByCategory: Record<string, number>,
): QuizQuestion[] {
  if (!questions.length) throw new Error('لا توجد أسئلة مفعّلة بعد')
  return toQuizQuestions(questions, countsByCategory)
}

/** توزيع أسئلة القسم حسب الصعوبة (سهل / متوسط / متقدم) */
export interface QuestionDifficultyPlan {
  easy: number
  medium: number
  hard: number
}

/**
 * إنشاء اختبار بسحب متدرج الصعوبة: يسحب عدداً محدداً من أسئلة المستوى السهل ثم
 * المتوسط ثم المتقدم لكل قسم (بدون خلط كلي) بحيث تتصاعد صعوبة الأسئلة.
 * الأقسام دون خطة صعوبة تُسحب بالسلوك المختلط المعتاد.
 */
export function createQuizStaged(
  questions: readonly Question[],
  countsByCategory: Record<string, number>,
  difficultyPlans?: Partial<Record<string, QuestionDifficultyPlan>>,
): QuizQuestion[] {
  if (!questions.length) throw new Error('لا توجد أسئلة مفعّلة بعد')

  const staged = Object.keys(countsByCategory).some((categoryId) => difficultyPlans?.[categoryId] != null)
  const assembled: QuizBuildInput[] = []
  const levels = ['easy', 'medium', 'hard'] as const
  const LEVEL_AR_NAMES: Record<(typeof levels)[number], string> = { easy: 'السهل', medium: 'المتوسط', hard: 'المتقدم' }

  for (const [categoryId, wanted] of Object.entries(countsByCategory)) {
    const available = questions
      .filter((x) => x.is_active !== false && x.category_id === categoryId && x.options && x.options.length >= 2)
      .map((x) => x as Question)
    const plan = difficultyPlans?.[categoryId]

    if (plan) {
      for (const level of levels) {
        const req = plan[level] ?? 0
        if (req <= 0) continue
        const pool = available.filter((q) => q.difficulty === level)
        if (pool.length < req) {
          throw new Error(
            `عدد الأسئلة في قسم ${categoryId} (المستوى ${LEVEL_AR_NAMES[level]}) غير كافٍ (المتاح ${pool.length} والمطلوب ${req})`,
          )
        }
        for (const q of shuffle(pool).slice(0, req)) {
          assembled.push({
            question_id: q.id,
            category_id: q.category_id,
            question_text: q.question_text,
            difficulty: q.difficulty,
            options: shuffle(q.options!).map((o) => ({ option_id: o.id, option_text: o.option_text })),
          })
        }
      }
    } else {
      if (available.length < wanted) {
        throw new Error(
          `عدد الأسئلة المتاحة في قسم ${categoryId} غير كافٍ (المتاح ${available.length} والمطلوب ${wanted})`,
        )
      }
      for (const q of shuffle(available).slice(0, wanted)) {
        assembled.push({
          question_id: q.id,
          category_id: q.category_id,
          question_text: q.question_text,
          difficulty: q.difficulty,
          options: shuffle(q.options!).map((o) => ({ option_id: o.id, option_text: o.option_text })),
        })
      }
    }
  }

  // التدرج: نُبقي ترتيب الصعوبة تصاعدياً (سهل ← متوسط ← متقدم)
  return staged ? assembled : shuffle(assembled)
}

export interface GradeParams {
  questions: QuizQuestion[]
  correctByQuestion: Record<QuestionId, OptionId>
  answerMap: AnswerMap
  passingScore: number
  explanations?: Record<QuestionId, string>
}

export function gradeQuiz(params: GradeParams): QuizResult {
  const { questions, correctByQuestion, answerMap, passingScore, explanations } = params
  const total = questions.length

  const byCategory: Record<string, CategoryResult> = {}
  let correct = 0
  let wrong = 0
  let unanswered = 0

  const review = questions.map((question) => {
    const chosen = answerMap[question.question_id] ?? null
    const chosenIsValid = chosen !== null && question.options.some((o) => o.option_id === chosen)
    const correctOptionId = correctByQuestion[question.question_id]
    const isCorrect = chosenIsValid && chosen === correctOptionId

    if (!chosenIsValid) unanswered += 1
    else if (isCorrect) correct += 1
    else wrong += 1

    const cat = (byCategory[question.category_id] ??= { correct: 0, total: 0, percent: 0 })
    cat.total += 1
    if (isCorrect) cat.correct += 1

    return {
      question,
      chosen_option_id: chosenIsValid ? chosen : null,
      correct_option_id: correctOptionId,
      explanation: explanations?.[question.question_id] ?? '',
      is_correct: isCorrect,
      answered: chosenIsValid,
    }
  })

  for (const cat of Object.values(byCategory)) {
    cat.percent = cat.total ? Number(((cat.correct / cat.total) * 100).toFixed(2)) : 0
  }

  const scorePercent = total ? Number(((correct / total) * 100).toFixed(2)) : 0

  return {
    attempt_id: '',
    total,
    correct,
    wrong,
    unanswered,
    score_percent: scorePercent,
    passed: scorePercent >= passingScore,
    by_category: byCategory,
    review,
  }
}

export interface ValidateQuestionDraft {
  category_id: string
  question_text: string
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  options: QuestionDraftOption[]
}

/** قواعد قبول السؤال قبل الحفظ (ترجع قائمة أخطاء) */
export function validateQuestion(draft: ValidateQuestionDraft): string[] {
  const errors: string[] = []

  if (!draft.category_id) errors.push('يجب اختيار القسم')
  if (!draft.question_text.trim()) errors.push('نص السؤال مطلوب')
  if (draft.options.length < 2 || draft.options.length > 5) {
    errors.push('يجب أن يكون عدد الخيارات من 2 إلى 5')
  }
  if (draft.options.some((o) => !o.option_text.trim())) {
    errors.push('كل الخيارات يجب ألا تكون فارغة')
  }
  const correctCount = draft.options.filter((o) => o.is_correct).length
  if (correctCount !== 1) {
    errors.push('يجب اختيار إجابة صحيحة واحدة بالضبط')
  }

  return errors
}