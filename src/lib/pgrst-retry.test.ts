import { describe, expect, it, vi } from 'vitest'
import { fetchWithPgrst303Retry } from '@/lib/pgrst-retry'

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    body: null,
    json: async () => body,
    clone: () => jsonResponse(status, body),
  } as unknown as Response
}

const pgrst303 = () => jsonResponse(401, { code: 'PGRST303', message: 'JWT issued at future' })

describe('fetchWithPgrst303Retry', () => {
  it('يعيد النجاح من أول محاولة دون تأخير', async () => {
    const ok = jsonResponse(200, { rows: [] })
    const impl = vi.fn().mockResolvedValue(ok)

    const res = await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/admin_users', undefined, [0])

    expect(res).toBe(ok)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('يعيد المحاولة عند PGRST303 ثم ينجح', async () => {
    const ok = jsonResponse(200, { rows: [] })
    const impl = vi.fn().mockResolvedValueOnce(pgrst303()).mockResolvedValueOnce(pgrst303()).mockResolvedValue(ok)

    const res = await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/admin_users', { method: 'POST', body: '{}' }, [0, 0])

    expect(res.status).toBe(200)
    expect(impl).toHaveBeenCalledTimes(3)
    expect(impl.mock.calls[1][1]).toEqual({ method: 'POST', body: '{}' })
  })

  it('يستنفد المحاولات ثم يعيد آخر استجابة كما هي', async () => {
    const impl = vi.fn().mockImplementation(async () => pgrst303())

    const res = await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/exams', undefined, [0, 0])

    expect(res.status).toBe(401)
    expect(impl).toHaveBeenCalledTimes(3)
  })

  it('لا يعيد المحاولة لخطأ 401 آخر', async () => {
    const forbidden = jsonResponse(401, { code: 'PGRST301', message: 'JWT expired' })
    const impl = vi.fn().mockResolvedValue(forbidden)

    const res = await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/exams', undefined, [0, 0])

    expect(res).toBe(forbidden)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('لا يعيد المحاولة عند أخطاء لا تحمل الكود PGRST303', async () => {
    const impl = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'RLS denied' }))

    await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/exams', undefined, [0, 0])

    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('لا يعيد المحاولة حين يكون جسم الطلب غير قابل لإعادة الإرسال', async () => {
    const stream = new ReadableStream()
    const impl = vi.fn().mockResolvedValue(pgrst303())

    const res = await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/exams', { method: 'POST', body: stream }, [0, 0])

    expect(res.status).toBe(401)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('لا يعيد المحاولة بعد إلغاء الطلب', async () => {
    const controller = new AbortController()
    controller.abort()
    const impl = vi.fn().mockResolvedValue(pgrst303())

    const res = await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/exams', { signal: controller.signal }, [0, 0])

    expect(res.status).toBe(401)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it('يعيد الاستجابة غير JSON كما هي دون إعادة', async () => {
    const html = { status: 401, body: null, json: async () => { throw new Error('not json') }, clone: () => html } as unknown as Response
    const impl = vi.fn().mockResolvedValue(html)

    const res = await fetchWithPgrst303Retry(impl, 'https://x/rest/v1/exams', undefined, [0, 0])

    expect(res).toBe(html)
    expect(impl).toHaveBeenCalledTimes(1)
  })
})
