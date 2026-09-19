import { useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { Button, Card, PageHeader, Spinner } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'
import type { QuizSettings } from '@/types'
import type { Category } from '@/types'

export function AdminSettingsPage() {
  const [cats, setCats] = useState<Category[]>([])
  const [rows, setRows] = useState<QuizSettings[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const repo = getRepository()
    const [c, s] = await Promise.all([repo.listCategoriesAdmin(), repo.getSettingsAdmin()])
    setCats(c)
    setRows(s)
  }, [])

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : 'فشل التحميل'))
  }, [load])

  function patch(id: string, patch: Partial<QuizSettings>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setSaved(false)
  }

  async function saveAll() {
    setBusy(true)
    setError(null)
    try {
      await getRepository().saveSettings(rows)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setBusy(false)
    }
  }

  if (rows.length === 0) return <Spinner />

  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? id

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="الإعدادات" subtitle="تخصيص عدد الأسئلة ودرجة النجاح والوقت لكل قسم" />

      {error ? <p className="mb-4 text-destructive">{error}</p> : null}

      <Card className="space-y-4 p-5">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-4">
            <p className="min-w-28 font-bold">{catName(r.category_id)}</p>
            <label className="flex items-center gap-2 text-sm font-bold">
              عدد الأسئلة
              <input
                type="number"
                className="input w-20"
                min={1}
                max={100}
                value={r.question_count_default}
                onChange={(e) => patch(r.id, { question_count_default: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              درجة النجاح %
              <input
                type="number"
                className="input w-20"
                min={0}
                max={100}
                value={r.passing_score}
                onChange={(e) => patch(r.id, { passing_score: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              الوقت (دقيقة)
              <input
                type="number"
                className="input w-20"
                min={0}
                placeholder="بلا حد"
                value={r.time_limit_minutes ?? ''}
                onChange={(e) => patch(r.id, { time_limit_minutes: e.target.value === '' ? null : Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
          </div>
        ))}

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          {saved ? <span className="text-sm font-bold text-success">تم الحفظ</span> : null}
          <Button onClick={saveAll} disabled={busy}>
            <Save className="h-4 w-4" />
            {busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </Card>
    </div>
  )
}