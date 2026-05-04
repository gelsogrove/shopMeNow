// Resilient fetch helper for OpenRouter calls.
//
// Adds two safety nets the bare `fetch` does not have:
//
//  1. **Hard timeout** — Node's fetch has no default timeout, so a stalled
//     OpenRouter connection would block the agent loop indefinitely. We
//     abort after `LLM_TIMEOUT_MS` (default 20s, env-tunable).
//
//  2. **Retry on transient upstream errors** — OpenRouter regularly returns
//     502/503/504 when an underlying provider is rate-limited or briefly
//     unavailable. Without retries a single bad second wipes the whole turn.
//     We retry up to `MAX_ATTEMPTS` times with exponential backoff (200ms,
//     400ms, 800ms). Non-transient errors (4xx other than 408/429) are
//     thrown immediately — no point retrying a malformed request.
//
// All errors are wrapped into `LlmFetchError` with a `category` flag so the
// caller can decide whether to surface a graceful fallback to the user
// vs. log the failure as a real bug.

import process from 'node:process'

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

/**
 * Run `fetch(url, init)` with timeout + retry on transient upstream errors.
 *
 * On success returns the parsed JSON body.
 * On failure throws `LlmFetchError`.
 */
export async function fetchLlmJson<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const timeoutMs = getTimeoutMs()
  let lastError: LlmFetchError | null = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)

      if (response.ok) {
        return (await response.json()) as T
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
      if (category !== 'transient_upstream') {
        throw lastError
      }
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof LlmFetchError) {
        // Permanent upstream error — bail without retry.
        if (err.category !== 'transient_upstream') throw err
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
  throw (
    lastError ||
    new LlmFetchError('OpenRouter call failed for unknown reason', 'network')
  )
}
