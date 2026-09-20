import type {
  AnswerMap,
  AttemptRow,
  Category,
  Question,
  QuestionDraft,
  Quiz,
  QuizResult,
  QuizSettings,
} from '@/types'
import type { ExamRepository, QuestionFilter, QuizSetupItem, Stats } from '@/lib/repository'
import { createQuiz, gradeQuiz } from '@/lib/quiz-engine'
import { MOCK_CATEGORIES, MOCK_QUESTIONS, MOCK_SETTINGS } from '@/lib/mock/seedData'

const DEMO_ADMIN = { email: 'admin@example.com', password: 'admin123' }

interface MockExamSection {
  category_id: string
  question_count: number
}

interface MockExam {
  id: string
  title: string
  description: string | null
  instructions: string
  slug: string
  is_active: boolean
  passing_score: number
  time_limit_minutes: number | null
  allow_retakes: boolean
  sections: MockExamSection[]
}

interface MockAttempt {
  attemptId: string
  quiz: Quiz
  correctByQuestion: Record<string, string>
  explanations: Record<string, string>
  status: 'in_progress' | 'submitted'
  score: number | null
  submittedAt: string | null
  candidateName?: string
  candidateEmail?: string
  examId?: string
}

export class MockRepository implements ExamRepository {
  private categories: Category[] = JSON.parse(JSON.stringify(MOCK_CATEGORIES))
  private questions: Question[] = JSON.parse(JSON.stringify(MOCK_QUESTIONS))
  private settings: QuizSettings[] = JSON.parse(JSON.stringify(MOCK_SETTINGS))
  private attempts = new Map<string, MockAttempt>()
  private exams = new Map<string, MockExam>()
  private examsById = new Map<string, MockExam>()
  private session = false

  // يجب تهيئة امتحان افتراضي واحد للاختبارات
  constructor() {
    this.seedDefaultExam()
  }

  private seedDefaultExam() {
    const exam: MockExam = {
      id: 'exam-default',
      title: 'اختبار تدريبي شامل',
      description: 'اختبار يغطي المحاسبة والذكاء و Excel',
      instructions: 'أجب على الأسئلة في الوقت المحدد. يمكنك المراجعة بعد التسليم.',
      slug: 'demo-exam',
      is_active: true,
      passing_score: 70,
      time_limit_minutes: null,
      allow_retakes: true,
      sections: [
        { category_id: 'cat-acc', question_count: 10 },
        { category_id: 'cat-iq', question_count: 10 },
        { category_id: 'cat-ex', question_count: 10 },
      ],
    }
    this.exams.set(exam.slug, exam)
    this.examsById.set(exam.id, exam)
  }

  private get correctByQuestion(): Record<string, string> {
    const map: Record<string, string> = {}
    for (const q of this.questions) {
      const correct = q.options?.find((o) => o.is_correct)
      if (correct) map[q.id] = correct.id
    }
    return map
  }

  private get explanations(): Record<string, string> {
    const map: Record<string, string> = {}
    for (const q of this.questions) map[q.id] = q.explanation ?? ''
    return map
  }

  // ---------- عام ----------

  async getPublicCategories(): Promise<Category[]> {
    return this.categories.filter((c) => c.is_active)
  }

  async getSettingsBySlug(): Promise<Record<string, QuizSettings>> {
    const out: Record<string, QuizSettings> = {}
    for (const s of this.settings) {
      const cat = this.categories.find((c) => c.id === s.category_id)
      if (cat) out[cat.slug] = s
    }
    return out
  }

  async createAttempt(setup: QuizSetupItem[], timeLimitMin: number | null): Promise<Quiz> {
    const counts: Record<string, number> = {}
    for (const s of setup) {
      const cat = this.categories.find((c) => c.slug === s.slug)
      counts[cat?.id ?? s.slug] = s.count
    }
    const questions = createQuiz(this.questions, counts)
    const attemptId = crypto.randomUUID()
    const quiz: Quiz = {
      attempt_id: attemptId,
      questions,
      time_limit_min: timeLimitMin,
      created_at: new Date().toISOString(),
    }
    this.attempts.set(attemptId, {
      attemptId,
      quiz,
      correctByQuestion: this.correctByQuestion,
      explanations: this.explanations,
      status: 'in_progress',
      score: null,
      submittedAt: null,
    })
    return quiz
  }

  async getAttempt(attemptId: string): Promise<Quiz> {
    const att = this.attempts.get(attemptId)
    if (!att) throw new Error('هذه المحاولة غير موجودة أو أُرسلت بالفعل')
    return att.quiz
  }

  async submitAttempt(attemptId: string, answers: AnswerMap, passingScore: number): Promise<QuizResult> {
    const att = this.attempts.get(attemptId)
    if (!att) throw new Error('المحاولة غير موجودة')
    if (att.status === 'submitted') throw new Error('تم تسليم هذه المحاولة من قبل')
    const result = gradeQuiz({
      questions: att.quiz.questions,
      correctByQuestion: att.correctByQuestion,
      answerMap: answers,
      passingScore,
      explanations: att.explanations,
    })
    result.attempt_id = attemptId
    att.status = 'submitted'
    att.score = result.score_percent
    att.submittedAt = new Date().toISOString()
    return result
  }

  // ---------- Candidate entry ----------

  async createCandidateAttempt(
    name: string,
    email?: string,
    examId?: string,
  ): Promise<{ attempt_id: string; candidate_name: string; candidate_email: string; status: string; started_at: string }> {
    const candidateName = name.trim()
    const candidateEmail = email?.trim() || ''
    if (!candidateName) {
      throw new Error('الاسم مطلوب')
    }

    const existing = [...this.attempts.values()].find(
      (a) =>
        a.candidateName === candidateName &&
        a.candidateEmail === candidateEmail &&
        a.status === 'in_progress' &&
        (examId ? a.examId === examId : true),
    )
    if (existing) {
      return {
        attempt_id: existing.attemptId,
        candidate_name: existing.candidateName ?? candidateName,
        candidate_email: existing.candidateEmail ?? '',
        status: existing.status,
        started_at: existing.quiz.created_at,
      }
    }

    const counts: Record<string, number> = {}
    if (examId && this.examsById.has(examId)) {
      const exam = this.examsById.get(examId)!
      for (const sec of exam.sections) {
        counts[sec.category_id] = sec.question_count
      }
    } else {
      for (const cat of this.categories.filter((c) => c.is_active)) {
        const setting = this.settings.find((s) => s.category_id === cat.id)
        counts[cat.id] = setting?.question_count_default ?? 10
      }
    }

    if (Object.keys(counts).length === 0) {
      throw new Error('لا توجد أقسام نشطة')
    }

    const questions = createQuiz(this.questions, counts)
    const attemptId = crypto.randomUUID()
    const now = new Date().toISOString()
    const quiz: Quiz = {
      attempt_id: attemptId,
      questions,
      time_limit_min: null,
      created_at: now,
    }
    this.attempts.set(attemptId, {
      attemptId,
      quiz,
      correctByQuestion: this.correctByQuestion,
      explanations: this.explanations,
      status: 'in_progress',
      score: null,
      submittedAt: null,
      candidateName,
      candidateEmail,
      examId: examId || null,
    })
    return {
      attempt_id: attemptId,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      status: 'in_progress',
      started_at: now,
    }
  }

  async getExamBySlug(slug: string): Promise<{
    id: string
    title: string
    description: string | null
    instructions: string
    is_active: boolean
    passing_score: number
    time_limit_minutes: number | null
    allow_retakes: boolean
  } | null> {
    const exam = this.exams.get(slug)
    if (!exam) return null
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      instructions: exam.instructions,
      is_active: exam.is_active,
      passing_score: exam.passing_score,
      time_limit_minutes: exam.time_limit_minutes,
      allow_retakes: exam.allow_retakes,
    }
  }

  async getExamById(id: string): Promise<{
    id: string
    title: string
    description: string | null
    instructions: string
    is_active: boolean
    passing_score: number
    time_limit_minutes: number | null
    allow_retakes: boolean
  } | null> {
    const exam = this.examsById.get(id)
    if (!exam) return null
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      instructions: exam.instructions,
      is_active: exam.is_active,
      passing_score: exam.passing_score,
      time_limit_minutes: exam.time_limit_minutes,
      allow_retakes: exam.allow_retakes,
    }
  }

  // ---------- إدارة ----------

  async isAdmin(): Promise<boolean> {
    return this.session
  }

  async signInAdmin(email: string, password: string): Promise<void> {
    if (email === DEMO_ADMIN.email && password === DEMO_ADMIN.password) {
      this.session = true
      return
    }
    throw new Error('بيانات الدخول غير صحيحة')
  }

  async signOutAdmin(): Promise<void> {
    this.session = false
  }

  async listCategoriesAdmin(): Promise<Category[]> {
    return JSON.parse(JSON.stringify(this.categories))
  }

  async saveCategory(cat: {
    id?: string
    name: string
    slug: string
    description: string
    accent_color: string
    is_active: boolean
  }): Promise<Category> {
    if (cat.id) {
      const found = this.categories.find((c) => c.id === cat.id)!
      Object.assign(found, cat, { updated_at: new Date().toISOString() })
      return found
    }
    const created: Category = {
      id: crypto.randomUUID(),
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      accent_color: cat.accent_color,
      is_active: cat.is_active,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    this.categories.push(created)
    return created
  }

  async listQuestions(filter: QuestionFilter, page: number, pageSize: number): Promise<{ rows: Question[]; total: number }> {
    let rows = this.questions
    if (filter.category) rows = rows.filter((q) => q.category_id === filter.category)
    if (filter.status === 'active') rows = rows.filter((q) => q.is_active)
    if (filter.status === 'archived') rows = rows.filter((q) => !q.is_active)
    if (filter.search) {
      const term = filter.search.toLowerCase()
      rows = rows.filter((q) => q.question_text.toLowerCase().includes(term))
    }
    const total = rows.length
    const start = (page - 1) * pageSize
    const pageRows = rows.slice(start, start + pageSize).map((q) => {
      const cat = this.categories.find((c) => c.id === q.category_id)
      return { ...JSON.parse(JSON.stringify(q)), category: cat }
    })
    return { rows: pageRows, total }
  }

  async saveQuestion(draft: QuestionDraft, id?: string): Promise<Question> {
    if (id) {
      const q = this.questions.find((x) => x.id === id)!
      q.category_id = draft.category_id
      q.question_text = draft.question_text
      q.explanation = draft.explanation
      q.difficulty = draft.difficulty
      q.updated_at = new Date().toISOString()
      q.options = draft.options.map((o, i) => ({
        id: `${id}-o${i}`,
        question_id: id,
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: i,
      }))
      return JSON.parse(JSON.stringify(q))
    }
    const created: Question = {
      id: crypto.randomUUID(),
      category_id: draft.category_id,
      question_text: draft.question_text,
      explanation: draft.explanation,
      difficulty: draft.difficulty,
      is_active: true,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      options: draft.options.map((o, i) => ({
        id: `${crypto.randomUUID()}`,
        question_id: '',
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: i,
      })),
    }
    created.options!.forEach((o) => (o.question_id = created.id))
    this.questions.push(created)
    return JSON.parse(JSON.stringify(created))
  }

  async setQuestionActive(id: string, active: boolean): Promise<void> {
    const q = this.questions.find((x) => x.id === id)!
    q.is_active = active
    q.updated_at = new Date().toISOString()
  }

  async getSettingsAdmin(): Promise<QuizSettings[]> {
    return JSON.parse(JSON.stringify(this.settings))
  }

  async saveSettings(s: QuizSettings[]): Promise<void> {
    this.settings = JSON.parse(JSON.stringify(s))
  }

  async getStats(): Promise<Stats> {
    const submitted = [...this.attempts.values()].filter((a) => a.status === 'submitted')
    const scores = submitted.filter((a) => a.score !== null).map((a) => a.score!)
    return {
      categories: this.categories.length,
      activeQuestions: this.questions.filter((q) => q.is_active).length,
      attempts: submitted.length,
      avgScore: scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null,
    }
  }

  async getRecentAttempts(limit: number): Promise<AttemptRow[]> {
    return [...this.attempts.values()]
      .filter((a) => a.status === 'submitted')
      .slice(-limit)
      .reverse()
      .map((a) => ({
        id: a.attemptId,
        status: 'submitted' as const,
        score_percent: a.score,
        correct_count: 0,
        wrong_count: 0,
        unanswered_count: 0,
        started_at: a.quiz.created_at,
        submitted_at: a.submittedAt,
      }))
  }
}
