import type {
  AdminAttemptDetails,
  AnswerMap,
  AttemptRow,
  Category,
  Question,
  QuestionDraft,
  Quiz,
  QuizResult,
  QuizSettings,
} from '@/types'

export interface QuizSetupItem {
  slug: string
  count: number
}

/** بيانات امتحان منشور يُنشأ من لوحة الإدارة ليرسله المدير للمتقدمين */
export interface PublishedExamInput {
  title: string
  slug: string
  description: string | null
  instructions: string
  passing_score: number
  time_limit_minutes: number | null
  allow_retakes: boolean
  sections: { category_id: string; question_count: number }[]
}

export interface Stats {
  categories: number
  activeQuestions: number
  attempts: number
  avgScore: number | null
}

export interface QuestionFilter {
  category?: string
  status?: 'active' | 'archived'
  search?: string
}

/** ملخص النشاط لكل امتحان منشور للوحة الإدارة (سجل واحد لكل امتحان فريد) */
export interface ExamAttemptSummary {
  id: string
  title: string
  slug: string
  is_active: boolean
  /** إجمالي المحاولات (المكتملة + الجارية + المتوقفة) */
  attempts: number
  /** المحاولات المكتملة */
  completed: number
  /** المحاولات الجارية (لم تُحتسب في الناجحين/الراسبين) */
  inProgress: number
  passed: number
  failed: number
  /** متوسط درجات المحاولات المكتملة */
  avgScore: number | null
  /** زمن آخر محاولة (أي حالة) */
  lastAttemptAt: string | null
}

/** بوابة البيانات: تنفيذ Supabase، أو تنفيذ محلي للتطوير/الاختبار */
export interface ExamRepository {
  // ---- عام (المتقدم) ----
  getPublicCategories(): Promise<Category[]>
  getSettingsBySlug(): Promise<Record<string, QuizSettings>>
  createAttempt(setup: QuizSetupItem[], timeLimitMin: number | null): Promise<Quiz>
  getAttempt(attemptId: string): Promise<Quiz>
  submitAttempt(attemptId: string, answers: AnswerMap, passingScore: number): Promise<QuizResult>

  // ---- إدارة (المدير) ----
  isAdmin(): Promise<boolean>
  signInAdmin(username: string, password: string): Promise<void>
  signOutAdmin(): Promise<void>
  listCategoriesAdmin(): Promise<Category[]>
  saveCategory(cat: { id?: string; name: string; slug: string; description: string; accent_color: string; is_active: boolean }): Promise<Category>
  listQuestions(filter: QuestionFilter, page: number, pageSize: number): Promise<{ rows: Question[]; total: number }>
  saveQuestion(draft: QuestionDraft, id?: string): Promise<Question>
  setQuestionActive(id: string, active: boolean): Promise<void>
  getSettingsAdmin(): Promise<QuizSettings[]>
  saveSettings(s: QuizSettings[]): Promise<void>
  getStats(): Promise<Stats>
  getRecentAttempts(limit: number): Promise<AttemptRow[]>
  getExamAttemptSummaries(): Promise<ExamAttemptSummary[]>
  getAttemptsByExam(examId: string): Promise<AttemptRow[]>
  getAdminAttemptDetails(attemptId: string): Promise<AdminAttemptDetails>

  // ---- Candidate entry ----
  createCandidateAttempt(name: string, email?: string, examId?: string): Promise<{ attempt_id: string; candidate_name: string; candidate_email: string; status: string; started_at: string }>
  getExamBySlug(slug: string): Promise<{ id: string; title: string; description: string | null; instructions: string; is_active: boolean; passing_score: number; time_limit_minutes: number | null; allow_retakes: boolean } | null>
  getExamById(id: string): Promise<{ id: string; title: string; description: string | null; instructions: string; is_active: boolean; passing_score: number; time_limit_minutes: number | null; allow_retakes: boolean } | null>
  getActivePublicExams(): Promise<{ id: string; title: string; slug: string; description: string | null }[]>
  createPublishedExam(input: PublishedExamInput): Promise<{ id: string; title: string; slug: string }>
}
