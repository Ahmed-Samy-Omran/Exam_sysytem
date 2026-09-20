import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { ClipboardList, Loader2, Mail, User, AlertCircle, Check, Copy } from 'lucide-react'
import { Badge, Button, Card, Field, PageHeader, Spinner } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'

const STORAGE_KEY = 'active_exam_attempt'

interface StoredAttempt {
  attempt_id: string
  status: string
}

interface ExamMeta {
  id: string
  title: string
  description: string | null
  instructions: string
  is_active: boolean
  passing_score: number
  time_limit_minutes: number | null
}

export function ExamStartPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const params = useParams()
  const examSlugOrId = searchParams.get('exam') ?? params.exam?.replace(/^exam-/, '') ?? null

  const [exam, setExam] = useState<ExamMeta | null>(null)
  const [examLoading, setExamLoading] = useState(true)
  const [examError, setExamError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const busyRef = useRef(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // استعادة محاولة قيد التنفيذ من الجلسة (تحسين UX فقط)
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
    }
  }, [navigate])

  // تحميل بيانات الامتحان من الرابط
  useEffect(() => {
    ;(async () => {
      setExamLoading(true)
      setExamError(null)
      try {
        const repo = getRepository()
        let loaded: ExamMeta | null = null

        if (examSlugOrId) {
          // محاولة التحميل كـ slug أولاً
          let bySlug = await repo.getExamBySlug(examSlugOrId)
          if (bySlug) {
            loaded = bySlug
          } else {
            // محاولة كـ UUID
            bySlug = await repo.getExamById(examSlugOrId)
            if (bySlug) loaded = bySlug
          }
        }

        if (!loaded) {
          setExamError('رابط الامتحان غير صحيح أو غير موجود. تأكد من الرابط أو تواصل مع مسؤول المنصة.')
        } else if (!loaded.is_active) {
          setExamError('هذا الامتحان غير نشط حاليًا. سيصدره المسؤول عند توفره.')
        } else {
          setExam(loaded)
        }
      } catch (e) {
        setExamError(e instanceof Error ? e.message : 'فشل تحميل بيانات الامتحان')
      } finally {
        setExamLoading(false)
      }
    })()
  }, [examSlugOrId])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busyRef.current) return
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('الاسم مطلوب')
      nameRef.current?.focus()
      return
    }
    if (!exam) {
      setError('لا يمكن بدء الامتحان. حاول تحديث الصفحة.')
      return
    }

    busyRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const repo = getRepository()
      const result = await repo.createCandidateAttempt(trimmedName, email.trim() || undefined, exam.id)
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ attempt_id: result.attempt_id, status: result.status }),
      )
      navigate(`/quiz/${result.attempt_id}`, { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل إنشاء محاولة الاختبار، حاول مجددًا'
      setError(msg)
      busyRef.current = false
      setSubmitting(false)
    }
  }

  function copyLink() {
    const url = window.location.href
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  const [copied, setCopied] = useState(false)

  if (examLoading) return <Spinner />

  if (examError) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <div className="card p-8">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-xl font-extrabold">عذراً، لا يمكن الوصول إلى هذا الامتحان</h2>
          <p className="mt-2 text-sm text-muted-foreground">{examError}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/', { replace: true })}>
              العودة للرئيسية
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (!exam) return <Spinner />

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <PageHeader title={exam.title} subtitle={exam.description ?? ''} />

      {exam.instructions ? (
        <Card className="p-4 border-border bg-muted/30">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">تعليمات سريعة</h3>
          <p className="mt-2 text-sm leading-relaxed">{exam.instructions}</p>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <Card className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/10 text-primary">
              <ClipboardList className="h-4 w-4" />
              {exam.title}
            </Badge>
            {exam.time_limit_minutes ? (
              <Badge className="bg-muted/20 text-muted-foreground">
                <Loader2 className="h-4 w-4" />
                {exam.time_limit_minutes} دقيقة
              </Badge>
            ) : null}
            <Badge className="bg-muted/20 text-muted-foreground">
              <User className="h-4 w-4" />
              دخول كضيف
            </Badge>
          </div>

          <Field label="الاسم الكامل" hint="مطلوب للمتابعة">
            <input
              ref={nameRef}
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

      {/* رابط المشاركة — يمكن نسخه */}
      <Card className="mt-4 p-4 border-border bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-muted-foreground">رابط المشاركة:</span>
          <div className="flex items-center gap-2">
            <input
              readOnly
              className="input flex-1 text-xs font-mono"
              value={window.location.href}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button variant="outline" onClick={copyLink} disabled={copied}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'تم النسخ' : 'نسخ'}
            </Button>
          </div>
        </div>
      </Card>
    </main>
  )
}
