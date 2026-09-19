import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Loader2, Mail, User } from 'lucide-react'
import { Badge, Button, Card, Field, PageHeader, Spinner } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'

const STORAGE_KEY = 'active_exam_attempt'

interface StoredAttempt {
  attempt_id: string
  status: string
}

export function ExamStartPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const busyRef = useRef(false)

  // استعادة محاولة قيد التنفيذ من الجلسة (تحسين UX فقط —
  // المصدر الموثوق لقبول/رفض إعادة الدخول هو get_attempt داخل صفحة الاختبار).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const stored = JSON.parse(raw) as StoredAttempt
        if (stored.status === 'in_progress' && stored.attempt_id) {
          navigate(`/quiz/${stored.attempt_id}`, { replace: true })
        } else {
          sessionStorage.removeItem(STORAGE_KEY)
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY)
    } finally {
      setRestoring(false)
    }
  }, [navigate])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busyRef.current) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('الاسم مطلوب')
      return
    }

    busyRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const result = await getRepository().createCandidateAttempt(trimmedName, email.trim() || undefined)
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ attempt_id: result.attempt_id, status: result.status }),
      )
      navigate(`/quiz/${result.attempt_id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشل إنشاء محاولة الاختبار، حاول مجددًا')
      busyRef.current = false
      setSubmitting(false)
    }
  }

  if (restoring) return <Spinner />

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <PageHeader title="ابدأ اختبارك" subtitle="أدخل بياناتك ثم اضغط زر البدء" />

      <form onSubmit={handleSubmit} noValidate>
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary">
              <ClipboardList className="h-4 w-4" />
              اختبار تدريبي
            </Badge>
            <Badge className="bg-muted/20 text-muted-foreground">
              <User className="h-4 w-4" />
              دخول كضيف
            </Badge>
          </div>

          <Field label="الاسم" hint="مطلوب للمتابعة">
            <input
              className="input"
              name="name"
              type="text"
              value={name}
              autoFocus
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
              placeholder="اكتب اسمك الكامل"
            />
          </Field>

          <Field label="البريد الإلكتروني" hint="اختياري">
            <input
              className="input"
              name="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
            />
          </Field>

          {error ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-bold text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ إنشاء المحاولة…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                ابدأ الاختبار
              </span>
            )}
          </Button>
        </Card>
      </form>
    </main>
  )
}