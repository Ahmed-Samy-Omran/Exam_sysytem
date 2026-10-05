type LogoVariant = 'stacked' | 'horizontal' | 'mark'

type Variant = {
  light: string
  dark: string
  aspect: number
  height: number
}

// Paths are relative to public/, so they need the assets/ prefix. Files in
// public/ are copied verbatim to the build root and are not processed by
// Vite, so a bare "logo.png" resolves to /logo.png, not /assets/logo.png.
//
// aspect is the real width/height ratio from each PNG header. Without it the
// browser reserves a 1:1 square, which shifts layout and lets the alt text
// spill out when an image fails to load.
const VARIANTS: Record<LogoVariant, Variant> = {
  stacked: {
    light: 'assets/logo.png',
    dark: 'assets/logo-dark.png',
    aspect: 384 / 512,
    height: 128,
  },
  horizontal: {
    light: 'assets/logo-horizontal.png',
    dark: 'assets/logo-horizontal-dark.png',
    aspect: 532 / 192,
    height: 40,
  },
  mark: {
    light: 'assets/logo-mark.png',
    dark: 'assets/logo-mark-dark.png',
    aspect: 353 / 320,
    height: 40,
  },
}

// Exactly one trailing slash, then join the asset path onto base. Works for a
// root deploy (base "/") and for GitHub Pages (base "/repo-name/").
function assetUrl(file: string) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/*$/, '/')
  return base + file
}

export function BrandLogo({
  variant = 'stacked',
  height,
  className = '',
}: {
  variant?: LogoVariant
  height?: number
  className?: string
}) {
  const config = VARIANTS[variant]
  const pxHeight = height ?? config.height
  const pxWidth = Math.max(1, Math.round(pxHeight * config.aspect))

  return (
    <picture className="inline-flex shrink-0 items-center justify-center">
      <source srcSet={assetUrl(config.dark)} media="(prefers-color-scheme: dark)" />
      <img
        src={assetUrl(config.light)}
        alt="SDG Logo"
        width={pxWidth}
        height={pxHeight}
        loading="lazy"
        decoding="async"
        style={{ height: pxHeight + 'px', width: pxWidth + 'px' }}
        className={'max-w-full object-contain ' + className}
      />
    </picture>
  )
}