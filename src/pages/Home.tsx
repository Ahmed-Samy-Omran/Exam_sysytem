import { Calculator, Brain, Table2, ClipboardList, Play } from 'lucide-react'
import { Card } from '@/components/ui'
import { LinkButton } from '@/components/ui'

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

export function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <section className="text-center">
        <span className="badge badge-muted mb-4">منصة تدريب ومراجعة</span>
        <h1 className="text-4xl font-extrabold sm:text-5xl">اختبر معلوماتك في ثلاث مجالات</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          اختبار عشوائي من أسئلة المحاسبة والذكاء و Excel، مع نتيجة فورية ومراجعة مفصلة للأخطاء
          وشرح الإجابة الصحيحة.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <LinkButton to="/quiz/setup">
            <Play className="h-5 w-5" />
            ابدأ الاختبار
          </LinkButton>
          <LinkButton to="/about" variant="outline">
            عن المنصة
          </LinkButton>
        </div>
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
          اختر الأقسام وعدد الأسئلة، ثم أجب عن الأسئلة واحدة تلو الأخرى. بعد التسليم تحصل على
          النتيجة والمراجعة الكاملة مع الإجابة الصحيحة والتصحيح لكل خطأ.
        </p>
      </section>
    </main>
  )
}