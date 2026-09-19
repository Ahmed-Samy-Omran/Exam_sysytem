export function NotFoundPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-muted-foreground/40">404</p>
      <h1 className="mt-2 text-2xl font-extrabold">الصفحة غير موجودة</h1>
      <p className="mt-2 text-muted-foreground">الصفحة التي تبحث عنها غير متوفرة أو تم نقلها.</p>
      <a href="#/" className="btn btn-primary mt-6">
        العودة للرئيسية
      </a>
    </main>
  )
}