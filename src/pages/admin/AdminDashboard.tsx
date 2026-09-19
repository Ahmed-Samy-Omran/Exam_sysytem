import { useEffect, useState } from 'react'
import { ListChecks, Percent, Tags, Timer } from 'lucide-react'
import { Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { formatDate, formatPercent } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { AttemptRow } from '@/types'
import type { Stats } from '@/lib/repository'

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<AttemptRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const repo = getRepository()
        const [s, r] = await Promise.all([repo.getStats(), repo.getRecentAttempts(10)])
        setStats(s)
        setRecent(r)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'تعذر تحميل الإحصائيات')
      }
    })()
  }, [])

  if (error) return <p className="text-destructive">{error}</p>
  if (!stats) return <Spinner />

  const cards = [
    { label: 'الأقسام', value: stats.categories, icon: Tags },
    { label: 'أسئلة نشطة', value: stats.activeQuestions, icon: ListChecks },
    { label: 'محاولات مكتملة', value: stats.attempts, icon: Timer },
    { label: 'متوسط الدرجات', value: stats.avgScore == null ? '—' : formatPercent(stats.avgScore), icon: Percent },
  ]

  return (
    <div>
      <PageHeader title="نظرة عامة" subtitle="ملخص لوحة تحكم المدير" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <c.icon className="h-6 w-6 text-primary" />
            <p className="mt-3 text-2xl font-extrabold">{c.value}</p>
            <p className="text-sm font-bold text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-extrabold">آخر الاختبارات المكتملة</h2>
      {recent.length === 0 ? (
        <EmptyState title="لا توجد اختبارات مكتملة بعد" hint="بعد أداء المتقدمين للاختبارات تظهر النتائج هنا" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-3 text-start font-bold">المحاولة</th>
                <th className="p-3 text-start font-bold">الدرجة</th>
                <th className="p-3 text-start font-bold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-bold" dir="ltr">{a.id.slice(0, 8)}</td>
                  <td className="p-3">{a.score_percent == null ? '—' : formatPercent(Number(a.score_percent))}</td>
                  <td className="p-3 text-muted-foreground">{formatDate(a.started_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}