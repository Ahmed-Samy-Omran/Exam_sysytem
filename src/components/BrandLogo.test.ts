import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * شعار SDG: حارس ضد مسارات الأصول وأبعادها.
 *
 * الفشل الذي نحرسه هنا وارد فعلًا: خطأ واحد في بادئة "assets/" يجعل كل
 * شعار 404، وإعادة توليد الأصول بنسب مختلفة يفرض تحديث جدول النسب يدويًا.
 */

const ASSETS = resolve(process.cwd(), 'public/assets')

/** يقرأ العرض والارتفاع من ترويسة PNG (IHDR) بدون أي مكتبة. */
function pngSize(file: string): { width: number; height: number } {
  const buf = readFileSync(resolve(ASSETS, file))
  const signature = '89504e470d0a1a0a'
  if (buf.subarray(0, 8).toString('hex') !== signature) {
    throw new Error(`${file} ليس ملف PNG صالحًا`)
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

// نفس جدول النسب في BrandLogo.tsx
const EXPECTED: Record<string, { width: number; height: number }> = {
  'logo.png': { width: 415, height: 512 },
  'logo-dark.png': { width: 415, height: 512 },
  'logo-horizontal.png': { width: 564, height: 192 },
  'logo-horizontal-dark.png': { width: 564, height: 192 },
  'logo-mark.png': { width: 360, height: 320 },
  'logo-mark-dark.png': { width: 360, height: 320 },
  'logo-favicon.png': { width: 203, height: 180 },
}

describe('شعار SDG — الأصول', () => {
  it('كل ملف مذكور في الاختبار موجود على القرص', () => {
    for (const file of Object.keys(EXPECTED)) {
      expect(() => pngSize(file), `${file} مفقود`).not.toThrow()
    }
  })

  it('أبعاد الملفات تطابق ما يعتمد عليه المكوّن', () => {
    for (const [file, want] of Object.entries(EXPECTED)) {
      expect(pngSize(file), file).toEqual(want)
    }
  })

  it('النسخة الداكنة لها نفس أبعاد النسخة الفاتحة', () => {
    const pairs: [string, string][] = [
      ['logo.png', 'logo-dark.png'],
      ['logo-horizontal.png', 'logo-horizontal-dark.png'],
      ['logo-mark.png', 'logo-mark-dark.png'],
    ]
    for (const [light, dark] of pairs) {
      expect(pngSize(dark), dark).toEqual(pngSize(light))
    }
  })

  it('الأفقية أفقية فعلًا و ليس مربعًا', () => {
    const h = pngSize('logo-horizontal.png')
    expect(h.width / h.height).toBeGreaterThan(2)
  })
})

describe('BrandLogo — مسارات الأصول', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/components/BrandLogo.tsx'), 'utf8')

  it('كل مسار في المكوّن يبدأ ببادئة assets/', () => {
    const paths = source.match(/'(assets\/[^']+)'/g) ?? []
    expect(paths.length).toBeGreaterThanOrEqual(6)
    for (const p of paths) {
      expect(p, `المسار ${p} بلا بادئة assets/`).toMatch(/^'assets\//)
    }
  })

  it('كل مسار يشير إلى ملف موجود فعلًا', () => {
    const paths = [...new Set(source.match(/'(assets\/[^']+)'/g) ?? [])]
    for (const p of paths) {
      // pngSize يضيف public/ بالفعل، فنقتطع بادئة assets/ من مسار المكوّن.
      const file = p.slice(1, -1).replace(/^assets\//, '')
      expect(() => pngSize(file), `${file} غير موجود`).not.toThrow()
    }
  })

  it('لا يشير المكوّن إلى logo.jpeg (الأصل الخام ليس للعرض)', () => {
    expect(source).not.toContain('logo.jpeg')
  })

  it('index.html يستخدم %BASE_URL% لا مسارًا مطلقًا', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toContain('%BASE_URL%assets/logo-favicon.png')
    expect(html).not.toMatch(/href="\/assets\//)
  })
})