import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, ListChecks, Percent, Tags, Timer } from 'lucide-react'
import { Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { formatDate, formatPercent } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { Stats } from '@/lib/repository'
import type { AttemptRow } from '@/types'

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
    ...(stats.attempts > 0 ? [{ label: 'محاولات مكتملة', value: stats.attempts, icon: Timer }] : []),
    ...(stats.avgScore != null ? [{ label: 'متوسط الدرجات', value: formatPercent(stats.avgScore), icon: Percent }] : []),
  ]

  return (
    <div>
      <PageHeader title="نظرة عامة" subtitle="ملخص لوحة تحكم المدير" />
      <div className="grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            className="flex w-full max-w-full items-center gap-2.5 p-2.5 sm:gap-3 sm:p-5"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
              <c.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold leading-tight sm:text-2xl">{c.value}</p>
              <p className="text-xs font-bold leading-snug text-muted-foreground sm:text-sm sm:truncate">{c.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 mt-5 text-lg font-extrabold sm:mb-3 sm:mt-8">آخر الاختبارات المكتملة</h2>
      {recent.length === 0 ? (
        <EmptyState title="لا توجد محاولات حتى الآن" hint="عندما يبدأ المتقدمون الاختبارات وتُسلم نتائجهم تظهر هنا" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-3 text-start font-bold">المتقدم</th>
                <th className="p-3 text-start font-bold">الامتحان</th>
                <th className="p-3 text-start font-bold">الدرجة</th>
                <th className="p-3 text-start font-bold">النتيجة</th>
                <th className="p-3 text-start font-bold">تاريخ التسليم</th>
                <th className="p-3 text-start font-bold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-bold">{a.candidate_name || '—'}</td>
                  <td className="p-3">{a.exam_title || 'امتحان سريع'}</td>
                  <td className="p-3">{a.score_percent == null ? '—' : formatPercent(Number(a.score_percent))}</td>
                  <td className="p-3">
                    {a.score_percent == null ? (
                      <span className="badge badge-muted">—</span>
                    ) : (
                      <span className={passed(a) ? 'badge badge-success' : 'badge badge-destructive'}>
                        {passed(a) ? 'ناجح' : 'راسب'}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{formatDate(a.submitted_at ?? a.started_at)}</td>
                  <td className="p-3">
                    <Link to={`/admin/attempts/${a.id}`} className="btn btn-outline px-3 py-1 text-sm">
                      <Eye className="h-4 w-4" />
                      عرض
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}

function passed(a: AttemptRow): boolean {
  if (a.score_percent == null) return false
  return Number(a.score_percent) >= (a.passing_score ?? 70)
}