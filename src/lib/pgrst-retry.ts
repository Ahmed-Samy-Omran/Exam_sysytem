const DEFAULT_DELAYS_MS = [300, 900]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readErrorCode(res: Response): Promise<unknown> {
  try {
    const body = (await res.clone().json()) as { code?: unknown }
    return body?.code
  } catch {
    return undefined
  }
}

export function fetchWithPgrst303Retry(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init?: RequestInit,
  delaysMs: number[] = DEFAULT_DELAYS_MS,
): Promise<Response> {
  return retry(fetchImpl, input, init, delaysMs)
}

async function retry(
  fetchImpl: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  delaysMs: number[],
): Promise<Response> {
  const bodyReplayable = init?.body == null || typeof init.body === 'string'
  let attempt = 0
  for (;;) {
    const res = await fetchImpl(input, init)
    if (attempt >= delaysMs.length || res.status !== 401) return res
    if (!bodyReplayable || init?.signal?.aborted) return res
    if ((await readErrorCode(res)) !== 'PGRST303') return res
    await sleep(delaysMs[attempt])
    attempt += 1
    if (init?.signal?.aborted) return res
    await res.body?.cancel().catch(() => undefined)
  }
}
