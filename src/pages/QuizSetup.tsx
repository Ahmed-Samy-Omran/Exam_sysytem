import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { Badge, Button, Card, Field, PageHeader, Spinner } from '@/components/ui'
import { categoryBadgeClass } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { Category } from '@/types'

interface CategoryExt extends Category {
  defaultCount: number
  timeLimit: number | null
}

export function QuizSetupPage() {
  const nav = useNavigate()
  const [cats, setCats] = useState<CategoryExt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'all' | 'single'>('all')
  const [selectedSlug, setSelectedSlug] = useState<string>('')
  const [timerMin, setTimerMin] = useState<string>('30')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const repo = getRepository()
        const [catsData, settings] = await Promise.all([repo.getPublicCategories(), repo.getSettingsBySlug()])
        const ext = catsData.map((c) => ({
          ...c,
          defaultCount: settings[c.slug]?.question_count_default ?? 10,
          timeLimit: settings[c.slug]?.time_limit_minutes ?? null,
        }))
        setCats(ext)
        setSelectedSlug(ext[0]?.slug ?? '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'فشل تحميل البيانات')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const activeCats = useMemo(() => cats.filter((c) => c.is_active), [cats])

  const counts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of cats) map[c.slug] = c.defaultCount
    return map
  }, [cats])

  const setCount = (slug: string, v: number) => {
    setCats((prev) => prev.map((c) => (c.slug === slug ? { ...c, defaultCount: Math.max(1, Math.min(50, v)) } : c)))
  }

  const total = mode === 'all' ? activeCats.reduce((s, c) => s + counts[c.slug], 0) : counts[selectedSlug] ?? 0
  const timeoutValue = timerMin.trim() === '' ? null : Number(timerMin)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const items =
        mode === 'all'
          ? activeCats.map((c) => ({ slug: c.slug, count: counts[c.slug] }))
          : [{ slug: selectedSlug, count: counts[selectedSlug] ?? 1 }]
      const quiz = await getRepository().createAttempt(items, timeoutValue)
      nav(`/quiz/${quiz.attempt_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر إنشاء الاختبار')
      setBusy(false)
    }
  }

  if (loading) return <Spinner />
  if (error && !cats.length) return <p className="p-10 text-center text-destructive">{error}</p>

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="إعداد الاختبار" subtitle="اختر الأقسام وعدد الأسئلة ثم ابدأ" />

      <Card className="p-5">
        <h2 className="mb-3 font-bold">نوع الاختبار</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('all')}
            className={`cursor-pointer rounded-xl border p-4 text-start transition-colors ${
              mode === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
            }`}
          >
            <p className="font-bold">اختبار شامل</p>
            <p className="mt-1 text-sm text-muted-foreground">جميع الأقسام الثلاثة بأسئلة من كل قسم</p>
          </button>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`cursor-pointer rounded-xl border p-4 text-start transition-colors ${
              mode === 'single' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
            }`}
          >
            <p className="font-bold">قسم واحد</p>
            <p className="mt-1 text-sm text-muted-foreground">نركّز على قسم واحد فقط</p>
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {mode === 'single' && (
            <Field label="القسم">
              <select className="input cursor-pointer" value={selectedSlug} onChange={(e) => setSelectedSlug(e.target.value)}>
                {activeCats.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div>
            <label className="label">عدد الأسئلة لكل قسم</label>
            <div className="space-y-3">
              {(mode === 'all' ? activeCats : activeCats.filter((c) => c.slug === selectedSlug)).map((c) => (
                <div key={c.slug} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center gap-2">
                    <Badge className={categoryBadgeClass(c.slug)}>{c.name}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`إنقاص أسئلة ${c.name}`}
                      onClick={() => setCount(c.slug, counts[c.slug] - 1)}
                      className="h-8 w-8 cursor-pointer rounded-lg border border-border hover:bg-muted"
                    >
                      −
                    </button>
                    <span className="w-10 text-center font-bold">{counts[c.slug]}</span>
                    <button
                      type="button"
                      aria-label={`زيادة أسئلة ${c.name}`}
                      onClick={() => setCount(c.slug, counts[c.slug] + 1)}
                      className="h-8 w-8 cursor-pointer rounded-lg border border-border hover:bg-muted"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field
            label="المؤقت (بالدقائق)"
            hint="اتركه فارغًا بدون مؤقت"
          >
            <input
              className="input"
              type="number"
              min={1}
              max={180}
              value={timerMin}
              onChange={(e) => setTimerMin(e.target.value)}
              placeholder="مثال: 30"
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="inline-flex items-center gap-2 font-bold text-muted-foreground">
            <ClipboardList className="h-5 w-5 text-primary" />
            إجمالي الأسئلة: {total}
          </p>
          <Button onClick={start} disabled={busy || total < 1}>
            {busy ? 'جارٍ تجهيز الاختبار…' : 'ابدأ الاختبار'}
          </Button>
        </div>
        {error ? <p role="alert" className="mt-3 text-sm font-bold text-destructive">{error}</p> : null}
      </Card>
    </main>
  )
}