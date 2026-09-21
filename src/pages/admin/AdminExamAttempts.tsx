import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Eye } from 'lucide-react'
import { Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { formatDate, formatPercent } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { AttemptRow } from '@/types'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'مكتمل', cls: 'badge-success' },
  in_progress: { label: 'قيد التنفيذ', cls: 'badge-muted' },
  abandoned: { label: 'متوقف', cls: 'badge-destructive' },
}

export function AdminExamAttemptsPage() {
  const { examId = '' } = useParams()
  const [attempts, setAttempts] = useState<AttemptRow[] | null>(null)
  const [examTitle, setExamTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const repo = getRepository()
        const [rows, exam] = await Promise.all([repo.getAttemptsByExam(examId), repo.getExamById(examId)])
        if (cancelled) return
        setAttempts(rows)
        setExamTitle(exam?.title ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'تعذر تحميل المحاولات')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [examId])

  if (error) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="محاولات الامتحان" />
        <Card className="p-8 text-center">
          <p className="font-bold text-destructive">{error}</p>
          <Link to="/admin/exams" className="btn btn-primary mt-6">
            <ArrowRight className="h-4 w-4" />
            العودة لإدارة الامتحانات
          </Link>
        </Card>
      </div>
    )
  }
  if (!attempts) return <Spinner />

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="محاولات الامتحان"
        subtitle={examTitle ?? undefined}
        actions={
          <Link to="/admin/exams" className="btn btn-ghost">
            <ArrowRight className="h-4 w-4" />
            إدارة الامتحانات
          </Link>
        }
      />
      {attempts.length === 0 ? (
        <EmptyState title="لا توجد محاولات لهذا الامتحان بعد" hint="عندما يبدأ المتقدمون الامتحان وتُسلم نتائجهم تظهر هنا" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-3 text-start font-bold">المتقدم</th>
                <th className="p-3 text-start font-bold">البريد</th>
                <th className="p-3 text-start font-bold">الحالة</th>
                <th className="p-3 text-start font-bold">الدرجة</th>
                <th className="p-3 text-start font-bold">النتيجة</th>
                <th className="p-3 text-start font-bold">تاريخ البدء</th>
                <th className="p-3 text-start font-bold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const status = STATUS_LABEL[a.status] ?? STATUS_LABEL.submitted!
                const pct = a.score_percent == null ? null : Number(a.score_percent)
                const passedNow = pct != null && pct >= (a.passing_score ?? 70)
                return (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-bold">{a.candidate_name || '—'}</td>
                    <td className="p-3 text-muted-foreground" dir="ltr">{a.candidate_email || '—'}</td>
                    <td className="p-3">
                      <span className={`badge ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="p-3">{pct == null ? '—' : formatPercent(pct)}</td>
                    <td className="p-3">
                      {pct == null ? (
                        <span className="badge badge-muted">—</span>
                      ) : (
                        <span className={`badge ${passedNow ? 'badge-success' : 'badge-destructive'}`}>
                          {passedNow ? 'ناجح' : 'راسب'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(a.started_at)}</td>
                    <td className="p-3">
                      <Link to={`/admin/attempts/${a.id}`} className="btn btn-outline px-3 py-1 text-sm">
                        <Eye className="h-4 w-4" />
                        عرض
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}