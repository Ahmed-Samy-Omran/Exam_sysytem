import { describe, expect, it } from 'vitest'
import { groupAttemptsByExam } from './exam-activity'

describe('groupAttemptsByExam', () => {
  it('يجمع محاولات متعددة لنفس الامتحان في سجل واحد فقط', () => {
    const grouped = groupAttemptsByExam([
      { id: 'a1', exam_id: 'e1', status: 'submitted', score_percent: 58, passing_score: 60, started_at: '2026-01-01T10:00:00Z', submitted_at: '2026-01-01T10:05:00Z' },
      { id: 'a2', exam_id: 'e1', status: 'submitted', score_percent: 90, passing_score: 60, started_at: '2026-01-02T10:00:00Z', submitted_at: '2026-01-02T10:05:00Z' },
      { id: 'a3', exam_id: 'e2', status: 'submitted', score_percent: 50, passing_score: 60, started_at: '2026-01-03T10:00:00Z', submitted_at: '2026-01-03T10:05:00Z' },
      { id: 'a4', exam_id: null, status: 'submitted', score_percent: 80, passing_score: 60, started_at: '2026-01-04T10:00:00Z', submitted_at: '2026-01-04T10:05:00Z' },
    ])

    expect(grouped.size).toBe(2)

    const e1 = grouped.get('e1')!
    expect(e1.totalAttempts).toBe(2)
    expect(e1.completed).toBe(2)
    expect(e1.passed).toBe(1)
    expect(e1.failed).toBe(1)
    expect(e1.avgScore).toBe(74)
    expect(e1.lastAttemptAt).toBe('2026-01-02T10:00:00Z')

    expect(grouped.get('e2')!.totalAttempts).toBe(1)
  })

  it('لا يعد المحاولات الجارية مكتملة ولا تُدخل في المتوسط', () => {
    const grouped = groupAttemptsByExam([
      { id: 'a1', exam_id: 'e1', status: 'submitted', score_percent: 58, passing_score: 60, started_at: '2026-01-01T10:00:00Z', submitted_at: '2026-01-01T10:05:00Z' },
      { id: 'a2', exam_id: 'e1', status: 'in_progress', score_percent: null, passing_score: 60, started_at: '2026-01-02T10:00:00Z', submitted_at: null },
    ])

    const e1 = grouped.get('e1')!
    expect(e1.totalAttempts).toBe(2)
    expect(e1.completed).toBe(1)
    expect(e1.inProgress).toBe(1)
    expect(e1.passed).toBe(0)
    expect(e1.failed).toBe(1)
    expect(e1.avgScore).toBe(58)
    expect(e1.lastAttemptAt).toBe('2026-01-02T10:00:00Z')
  })

  it('يتجاهل المحاولات بدون exam_id ولا يُنشئ لها سجلات', () => {
    const grouped = groupAttemptsByExam([
      { id: 'x', exam_id: '', status: 'submitted', score_percent: 90, passing_score: 60, started_at: '2026-01-01T10:00:00Z', submitted_at: '2026-01-01T10:05:00Z' },
    ])
    expect(grouped.size).toBe(0)
  })

  it('يعيد سجلات فارغة للدرجات null والمحاولات المتوقفة', () => {
    const grouped = groupAttemptsByExam([
      { id: 'a1', exam_id: 'e1', status: 'abandoned', score_percent: null, passing_score: 60, started_at: '2026-01-01T10:00:00Z', submitted_at: null },
      { id: 'a2', exam_id: 'e1', status: 'submitted', score_percent: null, passing_score: 60, started_at: '2026-01-02T10:00:00Z', submitted_at: '2026-01-02T10:05:00Z' },
    ])

    const e1 = grouped.get('e1')!
    expect(e1.totalAttempts).toBe(2)
    expect(e1.completed).toBe(1)
    expect(e1.inProgress).toBe(0)
    expect(e1.passed).toBe(0)
    expect(e1.failed).toBe(0)
    expect(e1.avgScore).toBeNull()
  })
})