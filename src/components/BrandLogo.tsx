/**
 * شعار SDG — Smart Distribution Group.
 *
 * الأصول مولّدة من الملف الأصلي عبر `scripts/prepare_logo.py`:
 * خلفية شفافة حقيقية + نسخة داكنة (الحبر الأسود → أبيض) + نسخة أفقية
 * للشريط العلوي. تبديل النسخة يتم عبر `<picture>` مع
 * `prefers-color-scheme` في CSS، فيعمل تلقائيًا بلا JS ودون وميض عند التحميل.
 *
 * ملاحظة: أي مسار في `public/` يُبنى على جذر الموقع، لذا نعتمد
 * `import.meta.env.BASE_URL` حتى يعمل النشر على GitHub Pages (base = '/repo/').
 */

type LogoVariant = 'stacked' | 'horizontal' | 'mark'

const SOURCES: Record<LogoVariant, { light: string; dark: string }> = {
  stacked: { light: 'logo.png', dark: 'logo-dark.png' },
  horizontal: { light: 'logo-horizontal.png', dark: 'logo-horizontal-dark.png' },
  mark: { light: 'logo-mark.png', dark: 'logo-mark-dark.png' },
}

/** الارتفاع بالبكسل الساعي؛ العرض مشتق من النسبة الأصلية للصورة. */
const HEIGHTS: Record<LogoVariant, number> = {
  stacked: 128,
  horizontal: 40,
  mark: 40,
}

function assetUrl(file: string) {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${base.endsWith('/') ? '' : '/'}${file}`
}

export function BrandLogo({
  variant = 'stacked',
  height,
  className = '',
}: {
  variant?: LogoVariant
  /** يتجاوز الارتفاع الافتراضي-variant (CSS px). */
  height?: number
  className?: string
}) {
  const files = SOURCES[variant]
  const resolvedHeight = height ?? HEIGHTS[variant]

  return (
    <picture>
      <source srcSet={assetUrl(files.dark)} media="(prefers-color-scheme: dark)" />
      <img
        src={assetUrl(files.light)}
        alt="SDG — Smart Distribution Group"
        width={resolvedHeight}
        height={resolvedHeight}
        style={{ height: `${resolvedHeight}px`, width: 'auto' }}
        className={`object-contain ${className}`}
        decoding="async"
      />
    </picture>
  )
}