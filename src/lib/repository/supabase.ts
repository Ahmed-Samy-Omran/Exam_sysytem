import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AnswerMap,
  AttemptRow,
  Category,
  Question,
  QuestionDraft,
  Quiz,
  QuizOption,
  QuizResult,
  QuizSettings,
} from '@/types'
import type { Database } from '@/types/supabase'
import type {
  ExamRepository,
  QuestionFilter,
  QuizSetupItem,
  Stats,
} from '@/lib/repository'

interface AttemptResponse {
  attempt_id: string
  total?: number
  time_limit_min: number | null
  questions: {
    question_id: string
    question_text: string
    category_id: string
    category_name: string
    difficulty: string
    options: { option_id: string; option_text: string }[]
  }[]
}

interface ReviewItem {
  question_id: string
  question_text: string
  category_id: string
  category_name: string
  options: QuizOption[]
  chosen_option_id: string | null
  correct_option_id: string
  explanation: string | null
  is_correct: boolean
  answered: boolean
}

interface SubmitResponse {
  attempt_id: string
  total: number
  correct: number
  wrong: number
  unanswered: number
  score_percent: number
  passed: boolean
  passing_score: number
  by_category: Record<string, { correct: number; total: number }>
  review: ReviewItem[]
}

interface ExamRow {
  id: string
  title: string
  description: string | null
  instructions: string
  slug: string
  is_active: boolean
  passing_score: number
  time_limit_minutes: number | null
  allow_retakes: boolean
}

export class SupabaseRepository implements ExamRepository {
  private readonly sb: SupabaseClient<Database>

  constructor(sb: SupabaseClient<Database>) {
    this.sb = sb
  }

  // ---------- عام ----------

  async getPublicCategories(): Promise<Category[]> {
    const { data, error } = await this.sb.from('public_categories').select('*').order('name')
    if (error) throw error
    return (data ?? []).map((c) => ({
      ...(c as unknown as Category),
      accent_color: c.accent_color || '#0D9488',
      is_active: true,
      updated_at: c.created_at ?? '',
    }))
  }

  async getSettingsBySlug(): Promise<Record<string, QuizSettings>> {
    const cats = await this.getPublicCategories()
    const { data, error } = await this.sb.from('quiz_settings').select('*')
    if (error) throw error
    const byId = new Map(cats.map((c) => [c.id, c]))
    const out: Record<string, QuizSettings> = {}
    for (const s of data ?? []) {
      const cat = byId.get(s.category_id as string)
      if (cat) out[cat.slug] = s as QuizSettings
    }
    return out
  }

  async createAttempt(setup: QuizSetupItem[], timeLimitMin: number | null): Promise<Quiz> {
    const { data, error } = await this.sb.rpc('create_attempt', {
      cat_filter: setup.map((s) => s.slug),
      counts: setup.map((s) => s.count),
      time_limit_min: timeLimitMin,
    })
    if (error) throw error
    const parsed = data as unknown as AttemptResponse
    return this.toQuiz(parsed)
  }

  async getAttempt(attemptId: string): Promise<Quiz> {
    const { data, error } = await this.sb.rpc('get_attempt', { a_id: attemptId })
    if (error) throw error
    return this.toQuiz(data as unknown as AttemptResponse)
  }

  async submitAttempt(attemptId: string, answers: AnswerMap, passingScore: number): Promise<QuizResult> {
    const payload = Object.entries(answers).map(([questionId, optionId]) => ({
      question_id: questionId,
      option_id: optionId,
    }))
    const { data, error } = await this.sb.rpc('submit_attempt', {
      a_id: attemptId,
      p_answers: payload,
      passing_score: passingScore,
    })
    if (error) throw error
    const r = data as unknown as SubmitResponse
    const byCategory: QuizResult['by_category'] = {}
    for (const [key, v] of Object.entries(r.by_category ?? {})) {
      byCategory[key] = {
        correct: v.correct,
        total: v.total,
        percent: v.total ? Number(((v.correct / v.total) * 100).toFixed(2)) : 0,
      }
    }
    return {
      attempt_id: r.attempt_id,
      total: r.total,
      correct: r.correct,
      wrong: r.wrong,
      unanswered: r.unanswered,
      score_percent: r.score_percent,
      passed: r.passed,
      by_category: byCategory,
      review: (r.review ?? []).map((item) => ({
        question: {
          question_id: item.question_id,
          category_id: item.category_id,
          question_text: item.question_text,
          difficulty: 'medium' as const,
          options: Array.isArray(item.options) ? item.options : [],
          category_name: item.category_name,
        },
        chosen_option_id: item.chosen_option_id,
        correct_option_id: item.correct_option_id,
        explanation: item.explanation ?? '',
        is_correct: item.is_correct,
        answered: item.answered,
      })),
    }
  }

  private toQuiz(resp: AttemptResponse): Quiz {
    return {
      attempt_id: resp.attempt_id,
      time_limit_min: resp.time_limit_min ?? null,
      created_at: new Date().toISOString(),
      questions: (resp.questions ?? []).map((item) => ({
        question_id: item.question_id,
        category_id: item.category_id,
        question_text: item.question_text,
        difficulty: (['easy', 'medium', 'hard'].includes(item.difficulty)
          ? item.difficulty
          : 'medium') as 'easy' | 'medium' | 'hard',
        options: (item.options ?? []).map((o) => ({ option_id: o.option_id, option_text: o.option_text })),
        category_name: item.category_name,
      })),
    }
  }

  // ---------- Candidate entry ----------

  async createCandidateAttempt(
    name: string,
    email?: string,
    examId?: string,
  ): Promise<{ attempt_id: string; candidate_name: string; candidate_email: string; status: string; started_at: string }> {
    const { data, error } = await this.sb.rpc('create_candidate_attempt', {
      p_name: name.trim(),
      p_email: email?.trim() || null,
      p_exam_id: examId ?? null,
    })
    if (error) throw error
    const row = (data ?? {}) as {
      attempt_id?: string
      candidate_name?: string
      candidate_email?: string
      status?: string
      started_at?: string
    }
    return {
      attempt_id: row.attempt_id ?? '',
      candidate_name: row.candidate_name ?? name.trim(),
      candidate_email: row.candidate_email ?? '',
      status: row.status ?? 'in_progress',
      started_at: row.started_at ?? new Date().toISOString(),
    }
  }

  async getExamBySlug(slug: string): Promise<ExamRow | null> {
    const { data, error } = await this.sb
      .from('exams')
      .select('id, title, description, instructions, slug, is_active, passing_score, time_limit_minutes, allow_retakes')
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as ExamRow | null
  }

  async getExamById(id: string): Promise<ExamRow | null> {
    const { data, error } = await this.sb
      .from('exams')
      .select('id, title, description, instructions, slug, is_active, passing_score, time_limit_minutes, allow_retakes')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return (data ?? null) as ExamRow | null
  }

  // ---------- إدارة ----------

  async isAdmin(): Promise<boolean> {
    const { data } = await this.sb.auth.getUser()
    if (!data.user) return false
    const { data: rows } = await this.sb.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle()
    return Boolean(rows)
  }

  async signInAdmin(email: string, password: string): Promise<void> {
    const { error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error('بيانات الدخول غير صحيحة')
  }

  async signOutAdmin(): Promise<void> {
    await this.sb.auth.signOut()
  }

  async listCategoriesAdmin(): Promise<Category[]> {
    const { data, error } = await this.sb.from('categories').select('*').order('name')
    if (error) throw error
    return (data ?? []) as Category[]
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
      const { data, error } = await this.sb
        .from('categories')
        .update({ name: cat.name, slug: cat.slug, description: cat.description, accent_color: cat.accent_color, is_active: cat.is_active })
        .eq('id', cat.id)
        .select('*')
        .single()
      if (error) throw error
      return data as Category
    }
    const { data, error } = await this.sb
      .from('categories')
      .insert({ name: cat.name, slug: cat.slug, description: cat.description, accent_color: cat.accent_color, is_active: cat.is_active })
      .select('*')
      .single()
    if (error) throw error
    return data as Category
  }

  async listQuestions(filter: QuestionFilter, page: number, pageSize: number): Promise<{ rows: Question[]; total: number }> {
    let query = this.sb.from('questions').select('*', { count: 'exact' }) as any
    if (filter.category) query = query.eq('category_id', filter.category)
    if (filter.status === 'active') query = query.eq('is_active', true)
    if (filter.status === 'archived') query = query.eq('is_active', false)
    if (filter.search) query = query.ilike('question_text', `%${filter.search}%`)
    const from = (page - 1) * pageSize
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1)
    if (error) throw error
    const ids = (data ?? []).map((q: any) => q.id)
    let opts: any[] = []
    if (ids.length) {
      const { data: options, error: optsErr } = await this.sb.from('question_options').select('*').in('question_id', ids)
      if (optsErr) throw optsErr
      opts = options ?? []
    }
    const rows = (data ?? []).map((q: any) => ({
      ...q,
      options: opts.filter((o) => o.question_id === q.id).sort((a, b) => a.sort_order - b.sort_order) as any,
    })) as Question[]
    return { rows, total: count ?? 0 }
  }

  async saveQuestion(draft: QuestionDraft, id?: string): Promise<Question> {
    if (id) {
      const { data: upd, error } = await this.sb
        .from('questions')
        .update({ category_id: draft.category_id, question_text: draft.question_text, explanation: draft.explanation, difficulty: draft.difficulty })
        .eq('id', id)
        .select('*')
        .single()
      if (error) throw error
      await this.sb.from('question_options').delete().eq('question_id', id)
      const insertOpts = draft.options.map((o, i) => ({
        question_id: id,
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: i,
      }))
      const { error: optErr } = await this.sb.from('question_options').insert(insertOpts)
      if (optErr) throw optErr
      const { data: full } = await this.sb.from('questions').select('*').eq('id', id).single()
   return {
        ...(upd ?? (full as Question)),
        options: draft.options.map((o, i) => ({
            id: `${id}-o${i}`,
            question_id: id,
            option_text: o.option_text,
            is_correct: o.is_correct,
            sort_order: i,
        })),
    };
    }
    const user = (await this.sb.auth.getUser()).data.user
    const { data, error } = await this.sb
      .from('questions')
      .insert({
        category_id: draft.category_id,
        question_text: draft.question_text,
        explanation: draft.explanation,
        difficulty: draft.difficulty,
        created_by: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    const qid = data.id
    const insertOpts = draft.options.map((o, i) => ({
      question_id: qid,
      option_text: o.option_text,
      is_correct: o.is_correct,
      sort_order: i,
    }))
    const { error: optErr } = await this.sb.from('question_options').insert(insertOpts)
    if (optErr) throw optErr
    return {
      ...(data as Question),
      options: draft.options.map((o, i) => ({
        id: `${qid}-o${i}`,
        question_id: qid,
        option_text: o.option_text,
        is_correct: o.is_correct,
        sort_order: i,
      })),
    }
  }

  async setQuestionActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.sb.from('questions').update({ is_active: active }).eq('id', id)
    if (error) throw error
  }

  async getSettingsAdmin(): Promise<QuizSettings[]> {
    const { data, error } = await this.sb.from('quiz_settings').select('*')
    if (error) throw error
    return (data ?? []) as QuizSettings[]
  }

  async saveSettings(s: QuizSettings[]): Promise<void> {
    for (const item of s) {
      const { error } = await this.sb
        .from('quiz_settings')
        .upsert({
          id: item.id,
          category_id: item.category_id,
          question_count_default: item.question_count_default,
          time_limit_minutes: item.time_limit_minutes,
          passing_score: item.passing_score,
        })
      if (error) throw error
    }
  }

  async getStats(): Promise<Stats> {
    const { count: categories } = await this.sb.from('categories').select('*', { count: 'exact', head: true })
    const { count: activeQuestions } = await this.sb.from('public_questions').select('*', { count: 'exact', head: true })
    const { data: attempts, count: attemptsCount } = await this.sb
      .from('quiz_attempts')
      .select('score_percent', { count: 'exact' })
      .eq('status', 'submitted')
    const scores = (attempts ?? []).map((a) => Number(a.score_percent)).filter((n) => Number.isFinite(n))
    const avg = scores.length ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)) : null
    return {
      categories: categories ?? 0,
      activeQuestions: activeQuestions ?? 0,
      attempts: attemptsCount ?? 0,
      avgScore: avg,
    }
  }

  async getRecentAttempts(limit: number): Promise<AttemptRow[]> {
    const { data, error } = await this.sb
      .from('quiz_attempts')
      .select('id, status, score_percent, correct_count, wrong_count, unanswered_count, started_at, submitted_at')
      .order('started_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as AttemptRow[]
  }
}
