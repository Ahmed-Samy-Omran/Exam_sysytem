import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Clock, Mail, User } from 'lucide-react'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { categoryBadgeClass, formatDate, formatPercent, formatTime } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { AdminAttemptDetails } from '@/types'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'مكتمل', cls: 'badge-success' },
  in_progress: { label: 'قيد التنفيذ', cls: 'badge-muted' },
  abandoned: { label: 'متوقف', cls: 'badge-destructive' },
}

export function AdminAttemptDetailsPage() {
  const { attemptId = '' } = useParams()
  const [details, setDetails] = useState<AdminAttemptDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const d = await getRepository().getAdminAttemptDetails(attemptId)
        if (!cancelled) setDetails(d)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'تعذر تحميل تفاصيل المحاولة')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [attemptId])

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="تفاصيل المحاولة" />
        <Card className="p-8 text-center">
          <p className="font-bold text-destructive">{error}</p>
          <Link to="/admin" className="btn btn-primary mt-6">
            <ArrowRight className="h-4 w-4" />
            العودة للوحة التحكم
          </Link>
        </Card>
      </div>
    )
  }
  if (!details) return <Spinner />

  const passed = details.score_percent != null && details.passing_score != null && details.score_percent >= details.passing_score
  const status = STATUS_LABEL[details.status] ?? STATUS_LABEL.submitted!

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="تفاصيل المحاولة"
        subtitle={details.exam_title ?? 'امتحان سريع'}
        actions={
          <Link to="/admin" className="btn btn-ghost">
            <ArrowRight className="h-4 w-4" />
            لوحة التحكم
          </Link>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2 font-bold">
            <User className="h-4 w-4 text-primary" />
            {details.candidate_name || '—'}
          </span>
          {details.candidate_email ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground" dir="ltr">
              <Mail className="h-4 w-4 text-primary" />
              {details.candidate_email}
            </span>
          ) : null}
          <span className={`badge ${status.cls}`}>{status.label}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            بداية: {formatDate(details.started_at)} {formatTime(details.started_at)}
          </span>
          {details.submitted_at ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              تسليم: {formatDate(details.submitted_at)} {formatTime(details.submitted_at)}
            </span>
          ) : null}
          {details.time_limit_min != null ? <span>الحد الزمني: {details.time_limit_min} دقيقة</span> : null}
        </div>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-3xl font-extrabold">{details.score_percent != null ? formatPercent(details.score_percent) : '—'}</p>
          <div className="flex flex-wrap items-center gap-2">
            {details.passing_score != null ? (
              <span className="text-sm text-muted-foreground">درجة النجاح {formatPercent(details.passing_score)}</span>
            ) : null}
            {details.score_percent != null ? (
              <span className={`badge ${passed ? 'badge-success' : 'badge-destructive'}`}>{passed ? 'ناجح' : 'راسب'}</span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="صحيح" value={details.correct_count} tone="text-[#15803d]" />
          <Stat label="خاطئ" value={details.wrong_count} tone="text-[#b91c1c]" />
          <Stat label="غير مجاب" value={details.unanswered_count} tone="text-muted-foreground" />
          <Stat label="الإجمالي" value={details.review.length} tone="text-foreground" />
        </div>
      </Card>

      <section aria-label="مراجعة الإجابات">
        <h3 className="mb-4 mt-8 text-lg font-extrabold">مراجعة الإجابات ({details.review.length})</h3>
        {details.review.length === 0 ? (
          <EmptyState title="لا توجد أسئلة مرفقة بهذه المحاولة" />
        ) : (
          <div className="space-y-4">
          {details.review.map((item, i) => {
            const statusClass = item.is_correct ? 'badge-success' : item.answered ? 'badge-destructive' : 'badge-muted'
            const statusLabel = item.is_correct ? 'صحيح' : item.answered ? 'خطأ' : 'غير مجاب'
            return (
              <Card key={`${item.question.question_id}-${i}`} className="overflow-hidden">
                <div className="flex items-start justify-between gap-3 p-5 pb-3">
                  <p className="font-bold leading-relaxed">{i + 1}. {item.question.question_text}</p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.question.category_name ? (
                      <Badge className={categoryBadgeClass(item.question.category_name)}>{item.question.category_name}</Badge>
                    ) : null}
                    <Badge className={`badge ${statusClass}`}>{statusLabel}</Badge>
                  </div>
                </div>
                <div className="space-y-1 px-5 pb-3">
                  {item.question.options.map((o) => {
                    const isCorrect = o.option_id === item.correct_option_id
                    const isChosen = o.option_id === item.chosen_option_id
                    let cls = 'border-border'
                    if (isCorrect) cls = 'border-success bg-success/10'
                    else if (isChosen) cls = 'border-destructive bg-destructive/10'
                    const optionIndex = item.question.options.findIndex((x) => x.option_id === o.option_id)
                    return (
                      <div
                        key={o.option_id}
                        className={`rounded-lg border px-3 py-2 text-sm ${isCorrect || isChosen ? 'font-bold' : ''} ${cls}`}
                      >
                        <span className="me-2">{String.fromCharCode(65 + Math.max(0, optionIndex))}.</span>
                        {o.option_text}
                        {isCorrect ? <span className="ms-2 text-[#15803d]">✓</span> : null}
                        {isChosen && !isCorrect ? <span className="ms-2 text-[#b91c1c]">✗</span> : null}
                      </div>
                    )
                  })}
                </div>
                {item.explanation ? (
                  <div className="border-t border-border bg-muted/50 px-5 py-3 text-sm leading-relaxed">
                    <span className="font-bold text-primary">التصحيح: </span>
                    {item.explanation}
                  </div>
                ) : null}
              </Card>
            )
          })}
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className={`text-2xl font-extrabold ${tone}`}>{value}</p>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  )
}