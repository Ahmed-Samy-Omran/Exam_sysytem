import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Home, RotateCcw, XCircle } from 'lucide-react'
import { Badge, Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { categoryBadgeClass, formatPercent } from '@/lib/format'
import type { QuizResult } from '@/types'

function resultKey(attemptId: string) {
  return `quiz-result-${attemptId}`
}

export function QuizResultPage() {
  const { attemptId = '' } = useParams()
  const nav = useNavigate()
  const [result, setResult] = useState<QuizResult | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem(resultKey(attemptId))
    if (!raw) {
      nav('/', { replace: true })
      return
    }
    try {
      setResult(JSON.parse(raw) as QuizResult)
    } catch {
      nav('/', { replace: true })
    }
  }, [attemptId, nav])

  if (!result) return <Spinner />
  const passed = result.passed
  const categoryNames = new Map<string, string>()
  for (const item of result.review) {
    if (item.question.category_name) {
      categoryNames.set(item.question.category_id, item.question.category_name)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="نتيجة الاختبار" />

      <Card className={`p-8 text-center ${passed ? '' : 'border-destructive/40'}`}>
        <div
          className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full border-4 ${
            passed ? 'border-success bg-success/10' : 'border-destructive bg-destructive/10'
          }`}
        >
          {passed ? <CheckCircle2 className="h-12 w-12 text-[#15803d]" /> : <XCircle className="h-12 w-12 text-[#b91c1c]" />}
        </div>
        <h2 className={`mt-4 text-3xl font-extrabold ${passed ? 'text-[#15803d]' : 'text-[#b91c1c]'}`}>{formatPercent(result.score_percent)}</h2>
        <p className="mt-1 font-bold text-muted-foreground">{passed ? 'ممتاز! نجحت في الاختبار' : 'لم تصل لدرجة النجاح'}</p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="صحيح" value={result.correct} tone="text-[#15803d]" />
          <Stat label="خاطئ" value={result.wrong} tone="text-[#b91c1c]" />
          <Stat label="غير مجاب" value={result.unanswered} tone="text-muted-foreground" />
          <Stat label="الإجمالي" value={result.total} tone="text-foreground" />
        </div>
      </Card>

      {Object.keys(result.by_category).length > 0 && (
        <Card className="mt-4 p-5">
          <h3 className="mb-3 font-bold">النتيجة حسب القسم</h3>
          <div className="space-y-3">
            {Object.entries(result.by_category).map(([catId, cat]) => {
              const catName = categoryNames.get(catId) ?? catId
              return (
                <div key={catId} className="flex items-center justify-between">
                  <Badge className={categoryBadgeClass(catName)}>{catName}</Badge>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">
                      {cat.correct} / {cat.total}
                    </span>
                    <span className="w-16 text-end font-bold">{formatPercent(cat.percent)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {passed ? (
          <>
            <Link to="/" className="btn btn-primary">
              <RotateCcw className="h-4 w-4" />
              استعرض الامتحانات
            </Link>
            <Link to="/" className="btn btn-ghost">
              الرئيسية
            </Link>
          </>
        ) : (
          <Link to="/" className="btn btn-primary">
            <Home className="h-4 w-4" />
            العودة إلى الرئيسية
          </Link>
        )}
      </div>

      <h3 className="mt-10 mb-4 text-lg font-extrabold">مراجعة الإجابات</h3>
      {result.review.length === 0 ? (
        <EmptyState title="لا توجد أسئلة للمراجعة" />
      ) : (
        <div className="space-y-4">
          {result.review.map((item) => (
            <Card key={item.question.question_id} className="overflow-hidden">
              <div className="flex items-start justify-between gap-3 p-5 pb-3">
                <p className="font-bold leading-relaxed">{item.question.question_text}</p>
                <Badge className={item.is_correct ? 'badge-success' : 'badge-destructive'}>
                  {item.is_correct ? 'صحيح' : item.answered ? 'خطأ' : 'غير مجاب'}
                </Badge>
              </div>
              <div className="space-y-1 px-5 pb-3">
                {item.question.options.map((o) => {
                  const isCorrect = o.option_id === item.correct_option_id
                  const isChosen = o.option_id === item.chosen_option_id
                  let cls = 'border-border'
                  if (isCorrect) cls = 'border-success bg-success/10'
                  else if (isChosen) cls = 'border-destructive bg-destructive/10'
                  return (
                    <div
                      key={o.option_id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        isCorrect || isChosen ? 'font-bold' : ''
                      } ${cls}`}
                    >
                      <span className="me-2">{String.fromCharCode(65 + getOptionIndex(item.question.options, o.option_id))}.</span>
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
          ))}
        </div>
      )}
    </main>
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

function getOptionIndex(options: { option_id: string }[], optionId: string): number {
  return Math.max(0, options.findIndex((o) => o.option_id === optionId))
}