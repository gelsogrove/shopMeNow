/**
 * LLM Retry Utility
 * 
 * Wraps LLM API calls with exponential backoff retry logic.
 * Handles transient failures (rate limits, server errors) gracefully.
 * 
 * Features:
 * - Exponential backoff (1s, 2s, 4s, 8s...)
 * - Configurable max retries
 * - Retries only on retryable errors (429, 500, 502, 503, 504)
 * - Preserves original error on final failure
 * - Zero impact on existing code (wrapper pattern)
 * 
 * @example
 * const result = await withRetry(() => axios.post(url, payload), { maxRetries: 3 })
 * 
 * @architecture Utility - No business logic, pure retry wrapper
 */

import logger from "./logger"

interface RetryOptions {
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in ms (default: 1000) */
  initialDelayMs?: number
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs?: number
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: any) => boolean
  /** Operation name for logging */
  operationName?: string
}

/**
 * Default retryable status codes
 * - 429: Rate limit exceeded
 * - 500: Internal server error
 * - 502: Bad gateway
 * - 503: Service unavailable
 * - 504: Gateway timeout
 */
const DEFAULT_RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]

/**
 * Check if an error is retryable (default implementation)
 */
function defaultIsRetryable(error: any): boolean {
  // Axios errors have response.status
  if (error?.response?.status) {
    return DEFAULT_RETRYABLE_STATUS_CODES.includes(error.response.status)
  }
  
  // Network errors (no response)
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
    return true
  }
  
  // OpenRouter specific error messages
  if (error?.message?.includes('rate limit') || error?.message?.includes('Rate limit')) {
    return true
  }
  
  if (error?.message?.includes('temporarily unavailable') || error?.message?.includes('overloaded')) {
    return true
  }
  
  return false
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute an async function with retry logic
 * 
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 * 
 * @example
 * // Simple usage
 * const result = await withRetry(() => callLLM(params))
 * 
 * // With options
 * const result = await withRetry(
 *   () => axios.post(url, payload),
 *   { maxRetries: 5, operationName: 'ProductSearchLLM' }
 * )
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    isRetryable = defaultIsRetryable,
    operationName = 'LLM call',
  } = options

  let lastError: any
  let delayMs = initialDelayMs

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Don't retry on last attempt
      if (attempt > maxRetries) {
        break
      }

      // Check if error is retryable
      if (!isRetryable(error)) {
        logger.warn(`❌ ${operationName}: Non-retryable error, failing immediately`, {
          attempt,
          errorMessage: error instanceof Error ? error.message : String(error),
          status: (error as any)?.response?.status,
        })
        throw error
      }

      // Log retry attempt
      logger.warn(`🔄 ${operationName}: Retry ${attempt}/${maxRetries} after ${delayMs}ms`, {
        errorMessage: error instanceof Error ? error.message : String(error),
        status: (error as any)?.response?.status,
      })

      // Wait before retry
      await sleep(delayMs)

      // Increase delay for next attempt (exponential backoff)
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs)
    }
  }

  // All retries exhausted
  logger.error(`❌ ${operationName}: All ${maxRetries} retries exhausted`, {
    errorMessage: lastError instanceof Error ? lastError.message : String(lastError),
    status: lastError?.response?.status,
  })

  throw lastError
}

/**
 * Create a retry wrapper for a specific operation
 * Useful for creating pre-configured retry functions
 * 
 * @example
 * const retryLLMCall = createRetryWrapper({ maxRetries: 5, operationName: 'OpenRouter' })
 * const result = await retryLLMCall(() => axios.post(url, payload))
 */
export function createRetryWrapper(defaultOptions: RetryOptions = {}) {
  return function <T>(fn: () => Promise<T>, overrideOptions: RetryOptions = {}): Promise<T> {
    return withRetry(fn, { ...defaultOptions, ...overrideOptions })
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PRE-CONFIGURED RETRY WRAPPERS FOR COMMON USE CASES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Retry wrapper for OpenRouter API calls
 * - 3 retries with exponential backoff
 * - Handles rate limits (429) and server errors (5xx)
 */
export const withOpenRouterRetry = createRetryWrapper({
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  operationName: 'OpenRouter API',
})

/**
 * Retry wrapper for database operations
 * - 2 retries with shorter delays
 * - For transient database connection issues
 */
export const withDatabaseRetry = createRetryWrapper({
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  operationName: 'Database',
  isRetryable: (error: any) => {
    // Prisma connection errors
    if (error?.code === 'P2024' || error?.code === 'P2010') {
      return true
    }
    // Generic connection errors
    if (error?.message?.includes('connection') || error?.message?.includes('timeout')) {
      return true
    }
    return false
  },
})
