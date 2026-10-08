import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'

/**
 * الشريط العلوي لصفحات المتقدم.
 *
 * ملاحظات تصميمية:
 * - الشعار أفقي (وليس الرسم المكدّس) لأن الرسم المكدّس يتحول إلى بكلة عند
 *   ارتفاع ~40px، وهذا هو الحل القياسي للشريط العلوي.
 * - `sticky` مع خلفية شبه صلبة + `backdrop-blur` لإبقاء السؤال ظاهرًا أثناء
 *   التمرير دون حجب القراءة.
 * - الرابط الرئيسي قابل للتركيز وله `focus-visible` من `index.css`، فلا
 *   نقتل حلقة التركيز إلى img.
 */
export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="flex shrink-0 items-center rounded-lg"
          aria-label="SDG — الصفحة الرئيسية"
        >
          <BrandLogo variant="horizontal" height={40} />
        </Link>

        <span className="h-6 w-px bg-brand-orange/70" aria-hidden />

        <span className="min-w-0">
          <span className="block truncate text-sm leading-tight font-extrabold">
            منصة التقييم للتوظيف
          </span>
          <span className="block truncate text-xs leading-tight font-bold text-muted-foreground">
            Smart Distribution Group
          </span>
        </span>
      </div>
    </header>
  )
}