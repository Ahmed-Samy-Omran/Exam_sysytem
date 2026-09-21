import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, Send } from 'lucide-react'
import { Badge, Button, Card, Modal, ProgressBar, Spinner } from '@/components/ui'
import { categoryBadgeClass, elapsedLabel } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { AnswerMap, Quiz } from '@/types'

const PASSING = 70

function storageKey(attemptId: string) {
  return `quiz-attempt-${attemptId}`
}
function resultKey(attemptId: string) {
  return `quiz-result-${attemptId}`
}
function activeAttemptStorageKey() {
  return 'active_exam_attempt'
}

interface SavedState {
  answers: AnswerMap
  index: number
}

export function QuizRunnerPage() {
  const { attemptId = '' } = useParams()
  const nav = useNavigate()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const answersRef = useRef<AnswerMap>({})

  const load = useCallback(async () => {
    try {
      const attempt = await getRepository().getAttempt(attemptId)
      setQuiz(attempt)
      if (attempt.time_limit_min) setRemaining(attempt.time_limit_min * 60)
      const raw = sessionStorage.getItem(storageKey(attemptId))
      if (raw) {
        const saved = JSON.parse(raw) as SavedState
        answersRef.current = saved.answers
        setAnswers(saved.answers)
        setIndex(Math.min(saved.index ?? 0, attempt.questions.length - 1))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل الاختبار')
    }
  }, [attemptId])

  useEffect(() => {
    void load()
  }, [load])

  // حفظ دوري في الجلسة
  useEffect(() => {
    if (!quiz) return
    const data: SavedState = { answers, index }
    sessionStorage.setItem(storageKey(attemptId), JSON.stringify(data))
  }, [answers, index, quiz, attemptId])

  // المؤقت
  useEffect(() => {
    if (remaining == null) return
    if (remaining <= 0) {
      setRemaining(0)
      setConfirmOpen(true)
      return
    }
    const t = setTimeout(() => setRemaining((r) => (r == null ? r : r - 1)), 1000)
    return () => clearTimeout(t)
  }, [remaining])

  if (error) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="font-bold text-destructive">{error}</p>
        <a href="#/" className="btn btn-primary mt-6">العودة للرئيسية</a>
      </main>
    )
  }
  if (!quiz) return <Spinner />

  const questions = quiz.questions
  const current = questions[index]
  const answeredCount = Object.values(answers).filter(Boolean).length
  const progress = questions.length ? (answeredCount / questions.length) * 100 : 0

  function choose(optionId: string) {
    const next = { ...answersRef.current, [current.question_id]: optionId }
    answersRef.current = next
    setAnswers(next)
  }

  function goTo(i: number) {
    setIndex(Math.max(0, Math.min(questions.length - 1, i)))
  }

  async function submit() {
    if (submitting) return
    if (!quiz) return
    setSubmitting(true)
    setConfirmOpen(false)
    try {
      const passing = quiz.passing_score ?? PASSING
      const result = await getRepository().submitAttempt(attemptId, answersRef.current, passing)
      sessionStorage.setItem(resultKey(attemptId), JSON.stringify(result))
      sessionStorage.removeItem(storageKey(attemptId))
      sessionStorage.removeItem(activeAttemptStorageKey())
      nav(`/quiz/${attemptId}/result`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل التسليم')
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge className={categoryBadgeClass(current.category_name ?? current.category_id)}>{current.category_name ?? 'سؤال'}</Badge>
          <span className="text-sm font-bold text-muted-foreground">
            {index + 1} / {questions.length}
          </span>
        </div>
        {remaining != null ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-bold ${
              remaining <= 60 ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-border bg-card'
            }`}
            dir="ltr"
          >
            <Clock className="h-4 w-4" />
            {elapsedLabel(remaining)}
          </span>
        ) : null}
      </div>

      <ProgressBar value={progress} label={`أجبت على ${answeredCount} من ${questions.length}`} className="mb-6" />

      <Card className="p-5">
        <p className="text-lg font-bold leading-relaxed">{current.question_text}</p>
        <div role="radiogroup" aria-label="الاختيارات" className="mt-5 space-y-3">
          {current.options.map((opt) => {
            const selected = answers[current.question_id] === opt.option_id
            return (
              <label
                key={opt.option_id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                }`}
              >
                <input
                  type="radio"
                  name={`q-${current.question_id}`}
                  className="mt-1 h-4 w-4 accent-primary"
                  checked={selected}
                  onChange={() => choose(opt.option_id)}
                />
                <span className="font-medium leading-relaxed">{opt.option_text}</span>
              </label>
            )
          })}
        </div>
      </Card>

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => goTo(index - 1)} disabled={index === 0}>
          السابق
        </Button>
        <Button variant="ghost" onClick={() => setConfirmOpen(true)} disabled={submitting}>
          <Send className="h-4 w-4" />
          تسليم الاختبار
        </Button>
        <Button variant="outline" onClick={() => goTo(index + 1)} disabled={index === questions.length - 1}>
          التالي
        </Button>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-bold text-muted-foreground">انتقال سريع</p>
        <div className="flex flex-wrap gap-1.5">
          {questions.map((q, i) => {
            const done = Boolean(answers[q.question_id])
            const isCurrent = i === index
            return (
              <button
                key={q.question_id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`السؤال ${i + 1}${done ? ' (أُجيب)' : ''}`}
                className={`h-9 w-9 cursor-pointer rounded-lg border text-sm font-bold transition-colors ${
                  isCurrent
                    ? 'border-primary bg-primary text-on-primary'
                    : done
                      ? 'border-success bg-success/10 text-[#15803d]'
                      : 'border-border bg-card hover:bg-muted'
                }`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
      </div>

      <Modal
        open={confirmOpen}
        title="تأكيد التسليم"
        onClose={() => (remaining === 0 ? undefined : setConfirmOpen(false))}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={remaining === 0}>
              مراجعة
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'جارٍ التسليم…' : 'تسليم نهائي'}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          أنت على وشك تسليم الاختبار. <span className="font-bold">{answeredCount}</span> من{' '}
          {questions.length} سؤال تمت الإجابة عنها.
        </p>
        {remaining === 0 ? <p className="mt-2 text-sm font-bold text-amber-700">انتهى الوقت المحدد.</p> : null}
        <p className="mt-1 text-xs text-muted-foreground">
          <CheckCircle2 className="inline h-4 w-4" /> لا يمكن التراجع بعد التسليم.
        </p>
      </Modal>
    </main>
  )
}