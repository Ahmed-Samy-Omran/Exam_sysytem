import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Eye, ListChecks, Percent, Tags, Timer } from 'lucide-react'
import { Card, EmptyState, PageHeader, Spinner } from '@/components/ui'
import { formatDate, formatPercent } from '@/lib/format'
import { getRepository } from '@/lib/repository/factory'
import type { ExamAttemptSummary, Stats } from '@/lib/repository'
import type { AttemptRow } from '@/types'

export function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<AttemptRow[]>([])
  const [exams, setExams] = useState<ExamAttemptSummary[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const repo = getRepository()
        const [s, r, e] = await Promise.all([repo.getStats(), repo.getRecentAttempts(10), repo.getExamAttemptSummaries()])
        setStats(s)
        setRecent(r)
        setExams(e)
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
            className="flex w-full max-w-full items-center gap-3 p-3 sm:p-5"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
              <c.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-extrabold leading-tight sm:text-2xl">{c.value}</p>
              <p className="text-sm font-bold leading-snug text-muted-foreground sm:truncate">{c.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mb-3 mt-6 flex items-center gap-2 sm:mt-8">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-extrabold">الامتحانات ونشاط المتقدمين</h2>
      </div>
      {exams.length === 0 ? (
        <EmptyState title="لا توجد امتحانات منشورة بعد" hint="أنشئ امتحانًا من صفحة إدارة الامتحانات" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((exam) => (
            <Card key={exam.id} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-extrabold leading-relaxed">{exam.title}</p>
                <span className={`badge shrink-0 ${exam.is_active ? 'badge-success' : 'badge-muted'}`}>
                  {exam.is_active ? 'نشط' : 'غير نشط'}
                </span>
              </div>
              {exam.attempts === 0 ? (
                <p className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-bold text-muted-foreground">
                  لم يبدأ أحد هذا الامتحان بعد
                </p>
              ) : (
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <p>
                    <span className="text-2xl font-extrabold">{exam.attempts}</span>{' '}
                    <span className="font-bold text-muted-foreground">محاولة مكتملة</span>
                  </p>
                  <p>
                    <span className="text-2xl font-extrabold text-[#15803d]">{exam.passed}</span>{' '}
                    <span className="font-bold text-muted-foreground">ناجح</span>
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-6 text-lg font-extrabold sm:mt-8">آخر الاختبارات المكتملة</h2>
      {recent.length === 0 ? (
        <EmptyState title="لا توجد محاولات حتى الآن" hint="عندما يبدأ المتقدمون الاختبارات وتُسلم نتائجهم تظهر هنا" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-muted-foreground">
                <th className="p-3 text-start font-bold">المتقدم</th>
                <th className="p-3 text-start font-bold">البريد</th>
                <th className="p-3 text-start font-bold">الامتحان</th>
                <th className="p-3 text-start font-bold">الدرجة</th>
                <th className="p-3 text-start font-bold">النتيجة</th>
                <th className="p-3 text-start font-bold">تاريخ البدء</th>
                <th className="p-3 text-start font-bold">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-bold">{a.candidate_name || '—'}</td>
                  <td className="p-3 text-muted-foreground" dir="ltr">{a.candidate_email || '—'}</td>
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
                  <td className="p-3 text-muted-foreground">{formatDate(a.started_at)}</td>
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