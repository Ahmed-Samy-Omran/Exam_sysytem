import { Link } from 'react-router-dom'

export function AboutPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">عن المنصة</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">
        منصة تدريبية تسمح بأداء اختبار عشوائي من ثلاثة أقسام: المحاسبة، الذكاء، و Excel.
        بعد التسليم تحصل على النسبة المئوية ومراجعة مفصلة للإجابات الخاطئة مع التصحيح.
      </p>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        هذه المنصة مناسبة للتدريب والمذاكرة ولا تُعدّ نظام امتحانات رسمي عالي الأمانة.
      </p>
      <Link to="/" className="btn btn-primary mt-6">
        استعرض الامتحانات المتاحة
      </Link>
    </main>
  )
}