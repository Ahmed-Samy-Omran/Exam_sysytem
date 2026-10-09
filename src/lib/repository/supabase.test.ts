import { describe, expect, it } from 'vitest'
import { toError } from '@/lib/repository/supabase'

/**
 * Supabase/PostgREST يرجع الخطأ ككائن عادي. تحرس هذه الاختبارات مبدأً
 * واحدًا: كل خطأ يخرج من طبقة المستودع يجب أن يكون `instanceof Error`،
 * وإلا عرضت الواجهة نصًا عامًا وأخفت السبب الحقيقي.
 */
describe('toError', () => {
  it('يحوّل كائن PostgrestError إلى Error حقيقي', () => {
    const pgError = { message: 'column exams.show_answers does not exist', code: '42703' }
    const err = toError(pgError)

    expect(err).toBeInstanceOf(Error)
    expect(err.message).toContain('column exams.show_answers does not exist')
    expect(err.message).toContain('42703')
  })

  it('يحافظ على Error الأصلي كما هو', () => {
    const original = new Error('فشل أصلي')
    expect(toError(original)).toBe(original)
  })

  it('يستخدم details/hint حين تكون message فارغة', () => {
    expect(toError({ message: '', details: 'violates check constraint' }).message).toContain(
      'violates check constraint',
    )
    expect(toError({ message: null, hint: 'استخدم RLS' }).message).toContain('استخدم RLS')
  })

  it('يبني رسالة مفهومة للقيم غير المعروفة', () => {
    expect(toError('boom').message).toBe('boom')
    expect(toError(null).message).toContain('خطأ غير معروف')
    expect(toError({}).message).toContain('قاعدة البيانات')
  })

  it('يضيف سياق العملية قبل الرسالة', () => {
    expect(toError({ message: 'permission denied', code: '42501' }, 'إنشاء الامتحان').message).toBe(
      'إنشاء الامتحان: permission denied (42501)',
    )
  })

  it('يحول PGRST303 إلى رسالة ودّية بدل النص الإنجليزي الخام', () => {
    const err = toError({ message: 'JWT issued at future', code: 'PGRST303' })

    expect(err.message).toContain('انزياح مؤقت في التوقيت')
    expect(err.message).toContain('أعد المحاولة')
    expect(err.message).toContain('PGRST303')
    expect(err.message).not.toContain('JWT issued at future')
    expect((err as Error & { code?: string }).code).toBe('PGRST303')
  })

  it('يحول PGRST303 مع سياق العملية مع الاحتفاظ بالسبب', () => {
    const err = toError({ message: 'JWT issued at future', code: 'PGRST303' }, 'إحصاءات اللوحة')

    expect(err.message).toContain('إحصاءات اللوحة')
    expect(err.message).toContain('PGRST303')
    expect(err.message).not.toContain('JWT issued at future')
  })
})