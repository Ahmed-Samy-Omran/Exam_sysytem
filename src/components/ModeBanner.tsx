import { getMode } from '@/lib/repository/factory'

/** شريط رفيع يوضح وضع التشغيل (حقيقي/تجريبي) — يُزال بعد إعداد Supabase */
export function ModeBanner() {
  const mode = getMode()
  if (mode === 'supabase') return null
  return (
    <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs font-bold text-amber-800">
      وضع تجريبي (بيانات محلية) — أضف مفاتيح Supabase في ملف .env للتبديل للوضع الحقيقي
    </div>
  )
}