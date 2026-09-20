export type CategoryId = string
export type QuestionId = string
export type OptionId = string
export type AttemptId = string

export type Difficulty = 'easy' | 'medium' | 'hard'

/** لقطة سؤال داخل محاولة — تُعرض للمتقدم بلا إجابة صحيحة */
export interface QuizOption {
  option_id: OptionId
  option_text: string
}

export interface QuizQuestion {
  question_id: QuestionId
  category_id: CategoryId
  question_text: string
  difficulty: Difficulty
  options: QuizOption[]
  /** يُملأ من جدول الأقسام إن توفر */
  category_name?: string
}

export interface Quiz {
  attempt_id: AttemptId
  questions: QuizQuestion[]
  time_limit_min: number | null
  created_at: string
  /** درجة النجاح المحددة من إعدادات الامتحان (تقصير 70) */
  passing_score?: number
  /** عنوان الامتحان إن كانت المحاولة عبر امتحان منشور */
  exam_title?: string | null
}

export type AnswerMap = Partial<Record<QuestionId, OptionId>>

export interface QuestionReview {
  question: QuizQuestion
  chosen_option_id: OptionId | null
  correct_option_id: OptionId
  explanation: string
  is_correct: boolean
  answered: boolean
}

export interface CategoryResult {
  correct: number
  total: number
  percent: number
}

export interface QuizResult {
  attempt_id: AttemptId
  total: number
  correct: number
  wrong: number
  unanswered: number
  score_percent: number
  passed: boolean
  by_category: Record<string, CategoryResult>
  review: QuestionReview[]
}

// ---------- أنواع الإدارة ----------

export interface Category {
  id: CategoryId
  name: string
  slug: string
  description: string | null
  accent_color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface QuestionOption {
  id: OptionId
  question_id: QuestionId
  option_text: string
  is_correct: boolean
  sort_order: number
}

export interface Question {
  id: QuestionId
  category_id: CategoryId
  question_text: string
  explanation: string | null
  difficulty: Difficulty
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  category?: Category
  options?: QuestionOption[]
}

export interface QuizSettings {
  id: string
  category_id: CategoryId
  question_count_default: number
  time_limit_minutes: number | null
  passing_score: number
  updated_at: string
}

export interface AttemptRow {
  id: AttemptId
  status: 'in_progress' | 'submitted' | 'abandoned'
  score_percent: number | null
  correct_count: number
  wrong_count: number
  unanswered_count: number
  started_at: string
  submitted_at: string | null
  candidate_name?: string | null
  candidate_email?: string | null
  exam_title?: string | null
  passing_score?: number | null
}

export interface QuestionDraftOption {
  option_text: string
  is_correct: boolean
}

/** نموذج إنشاء/تعديل سؤال من لوحة الإدارة */
export interface QuestionDraft {
  category_id: CategoryId
  question_text: string
  explanation: string | null
  difficulty: Difficulty
  options: QuestionDraftOption[]
}