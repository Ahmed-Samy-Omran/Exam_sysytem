import { useEffect, useState } from 'react'
import { Calculator, Brain, Table2, ClipboardList, Play } from 'lucide-react'
import { Card, LinkButton, Spinner } from '@/components/ui'
import { getRepository } from '@/lib/repository/factory'

const features = [
  {
    icon: Calculator,
    title: 'Accounting',
    desc: 'مبادئ محاسبية، قوائم مالية، قيود وتسويات.',
    cls: 'badge-accounting',
    border: 'border-[#16A34A]/40',
    iconText: 'text-[#15803d]',
    bg: 'bg-[#16A34A]/10',
  },
  {
    icon: Brain,
    title: 'IQ',
    desc: 'ألغاز منطقية ومتسلسلات وقياس سرعة التفكير.',
    cls: 'badge-iq',
    border: 'border-[#7C3AED]/40',
    iconText: 'text-[#6d28d9]',
    bg: 'bg-[#7C3AED]/10',
  },
  {
    icon: Table2,
    title: 'Excel',
    desc: 'دوال، معادلات، مراجع خلوية وتنسيق الجداول.',
    cls: 'badge-excel',
    border: 'border-[#EA580C]/40',
    iconText: 'text-[#c2410c]',
    bg: 'bg-[#EA580C]/10',
  },
]

const arrow = <span className="transition-transform group-hover:translate-x-1">←</span>

export function HomePage() {
  const [exams, setExams] = useState<{ id: string; title: string; slug: string; description: string | null }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getRepository()
      .getActivePublicExams()
      .then((list) => {
        if (!cancelled) setExams(list)
      })
      .catch(() => {
        if (!cancelled) setError('تعذر تحميل قائمة الامتحانات المتاحة.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <section className="text-center">
        <span className="badge badge-muted mb-4">منصة تدريب ومراجعة</span>
        <h1 className="text-4xl font-extrabold sm:text-5xl">اختبر معلوماتك في ثلاث مجالات</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          اختبار عشوائي من أسئلة المحاسبة والذكاء و Excel، مع نتيجة فورية ومراجعة مفصلة للأخطاء
          وشرح الإجابة الصحيحة.
        </p>
      </section>

      <section className="mt-8">
        {error ? (
          <p role="alert" className="text-center text-sm font-bold text-destructive">{error}</p>
        ) : exams === null ? (
          <Spinner label="جاري تحميل الامتحانات…" />
        ) : exams.length > 0 ? (
          <div className="mx-auto grid max-w-2xl gap-4">
            {exams.map((exam) => (
              <LinkButton
                key={exam.id}
                to={`/exam/start?exam=${encodeURIComponent(exam.slug || exam.id)}`}
                className="group flex w-full items-center justify-between gap-3 !py-4 !px-5"
              >
                <span className="flex items-center gap-3 text-right">
                  <Play className="h-5 w-5 shrink-0" />
                  <span className="flex flex-col items-start gap-1">
                    <span className="font-extrabold">{exam.title}</span>
                    {exam.description ? (
                      <span className="text-sm font-normal text-white/80">{exam.description}</span>
                    ) : null}
                  </span>
                </span>
                {arrow}
              </LinkButton>
            ))}
          </div>
        ) : (
          <Card className="mx-auto max-w-xl text-center p-8">
            <p className="font-bold">لا توجد امتحانات متاحة حاليًا</p>
            <p className="mt-1 text-sm text-muted-foreground">ستظهر الامتحانات المنشورة هنا بمجرد توفرها.</p>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <LinkButton to="/about" variant="outline" className="w-full sm:w-auto">
          عن المنصة
        </LinkButton>
      </section>

      <section className="mt-14 grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className={`border ${f.border} p-5`}>
            <span className={`inline-flex rounded-xl p-3 ${f.bg}`}>
              <f.icon className={`h-6 w-6 ${f.iconText}`} />
            </span>
            <h2 className="mt-4 text-lg font-extrabold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            <span className={`badge ${f.cls} mt-4`}>{f.title}</span>
          </Card>
        ))}
      </section>

      <section className="card mt-10 flex flex-col items-center gap-3 p-8 text-center">
        <ClipboardList className="h-8 w-8 text-primary" />
        <p className="font-bold">كيف يعمل؟</p>
        <p className="max-w-lg text-sm text-muted-foreground">
          افتح رابط الامتحان، أدخل اسمك ثم ابدأ. بعد التسليم تحصل على النتيجة والمراجعة الكاملة مع
          الإجابة الصحيحة والتصحيح لكل خطأ.
        </p>
      </section>
    </main>
  )
}