/** بيانات محاولة خام يُمرر لدالة التجميع (exam_id هو مفتاح التجميع الأساسي) */
export interface AttemptActivityInput {
  id: string
  exam_id: string | null
  status: 'in_progress' | 'submitted' | 'abandoned'
  score_percent: number | null
  passing_score: number | null
  started_at: string
  submitted_at: string | null
}

/** ملخص نشاط مُجمّع لامتحان واحد (سجل واحد لكل exam_id فريد) */
export interface ExamActivity {
  totalAttempts: number
  completed: number
  inProgress: number
  passed: number
  failed: number
  avgScore: number | null
  lastAttemptAt: string | null
}

const ZERO: ExamActivity = {
  totalAttempts: 0,
  completed: 0,
  inProgress: 0,
  passed: 0,
  failed: 0,
  avgScore: null,
  lastAttemptAt: null,
}

/**
 * تجميع المحاولات حسب exam_id.
 * - لا يتم احتساب المحاولات الجارية (in_progress) ضمن المكتملة/الناجحين/الراسبين.
 * - المتوسط يُحسب من المحاولات المكتملة ذات الدرجة فقط.
 * - المحاولات بدون exam_id تُتجاهل.
 */
export function groupAttemptsByExam(attempts: AttemptActivityInput[]): Map<string, ExamActivity> {
  const map = new Map<string, ExamActivity>()
  const sumByExam = new Map<string, { sum: number; count: number }>()

  for (const a of attempts) {
    if (!a.exam_id) continue
    const cur = map.get(a.exam_id) ?? { ...ZERO }
    const acc = sumByExam.get(a.exam_id) ?? { sum: 0, count: 0 }

    cur.totalAttempts += 1

    if (a.status === 'submitted') {
      cur.completed += 1
      const score = a.score_percent == null ? NaN : Number(a.score_percent)
      if (Number.isFinite(score)) {
        const passing = a.passing_score == null ? 70 : Number(a.passing_score)
        if (score >= passing) cur.passed += 1
        else cur.failed += 1
        acc.sum += score
        acc.count += 1
        sumByExam.set(a.exam_id, acc)
      }
    } else if (a.status === 'in_progress') {
      cur.inProgress += 1
    }

    if (a.started_at && (!cur.lastAttemptAt || a.started_at > cur.lastAttemptAt)) {
      cur.lastAttemptAt = a.started_at
    }

    map.set(a.exam_id, cur)
  }

  for (const [examId, acc] of sumByExam) {
    const cur = map.get(examId)!
    cur.avgScore = acc.count ? Number((acc.sum / acc.count).toFixed(2)) : null
    map.set(examId, cur)
  }

  return map
}