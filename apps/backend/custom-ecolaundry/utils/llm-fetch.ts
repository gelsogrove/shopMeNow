// Resilient fetch helper for OpenRouter: hard timeout (LLM_TIMEOUT_MS, 20s
// default) + exponential-backoff retry on transient upstream (408/429/5xx)
// up to MAX_ATTEMPTS. Errors wrap in `LlmFetchError`. Observability lives
// in `llm-fetch-observability.ts`.

import process from 'node:process'

import {
  extractCacheUsage,
  logCallFailure,
  logCallSuccess,
  type LlmCaller,
} from './llm-fetch-observability.js'

export type { LlmCaller } from './llm-fetch-observability.js'

const DEFAULT_TIMEOUT_MS = 20_000
const MAX_ATTEMPTS = 3
const BACKOFF_BASE_MS = 200
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504])

export type LlmFetchErrorCategory =
  | 'timeout'
  | 'network'
  | 'transient_upstream'
  | 'permanent_upstream'
  | 'auth'

export class LlmFetchError extends Error {
  constructor(
    message: string,
    public readonly category: LlmFetchErrorCategory,
    public readonly status?: number,
    public readonly attempts?: number,
  ) {
    super(message)
    this.name = 'LlmFetchError'
  }
}

function getTimeoutMs(): number {
  const raw = Number(process.env.LLM_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS
}

function categoryForStatus(status: number): LlmFetchErrorCategory {
  if (status === 401 || status === 403) return 'auth'
  if (TRANSIENT_STATUS.has(status)) return 'transient_upstream'
  return 'permanent_upstream'
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Run `fetch(url, init)` with timeout + retry; throws `LlmFetchError` on
 *  failure. `caller` is logged when LLM_DEBUG=1. */
export async function fetchLlmJson<T>(
  url: string,
  init: RequestInit,
  caller?: LlmCaller,
): Promise<T> {
  const timeoutMs = getTimeoutMs()
  const startedAt = Date.now()
  const callerId: LlmCaller | 'unknown' = caller ?? 'unknown'
  let lastError: LlmFetchError | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)

      if (response.ok) {
        const parsed = (await response.json()) as T
        logCallSuccess({
          caller: callerId,
          status: response.status,
          latencyMs: Date.now() - startedAt,
          attempts: attempt,
          ...extractCacheUsage(parsed),
        })
        return parsed
      }

      const body = await response.text().catch(() => '')
      const category = categoryForStatus(response.status)
      lastError = new LlmFetchError(
        `OpenRouter ${response.status} (attempt ${attempt}/${MAX_ATTEMPTS}): ${body || response.statusText}`,
        category,
        response.status,
        attempt,
      )

      // Auth or schema bugs: do not retry.
      if (category !== 'transient_upstream') throw lastError
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof LlmFetchError) {
        // Permanent upstream error — bail without retry.
        if (err.category !== 'transient_upstream') {
          logCallFailure({
            caller: callerId,
            category: err.category,
            status: err.status,
            attempts: err.attempts ?? attempt,
            latencyMs: Date.now() - startedAt,
          })
          throw err
        }
        lastError = err
      } else if (err instanceof Error && err.name === 'AbortError') {
        lastError = new LlmFetchError(
          `OpenRouter timed out after ${timeoutMs}ms (attempt ${attempt}/${MAX_ATTEMPTS})`,
          'timeout',
          undefined,
          attempt,
        )
      } else {
        // Network-level error (DNS, TCP reset, …). Worth retrying.
        const message = err instanceof Error ? err.message : String(err)
        lastError = new LlmFetchError(
          `OpenRouter network error (attempt ${attempt}/${MAX_ATTEMPTS}): ${message}`,
          'network',
          undefined,
          attempt,
        )
      }
    }

    if (attempt < MAX_ATTEMPTS) {
      await delay(BACKOFF_BASE_MS * 2 ** (attempt - 1))
    }
  }

  // All attempts exhausted — re-throw the last error.
  const finalError =
    lastError ||
    new LlmFetchError('OpenRouter call failed for unknown reason', 'network')
  logCallFailure({
    caller: callerId,
    category: finalError.category,
    status: finalError.status,
    attempts: finalError.attempts ?? MAX_ATTEMPTS,
    latencyMs: Date.now() - startedAt,
  })
  throw finalError
}
