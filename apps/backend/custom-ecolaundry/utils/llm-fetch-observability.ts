// Optional debug logging for OpenRouter calls performed by `llm-fetch.ts`.
//
// Activated by `LLM_DEBUG=1` in the environment (or `--debug` on the demo
// CLI, which sets the env var). When OFF (the default) all helpers are
// no-ops so production and the test suite remain silent.
//
// Emits two log lines per call:
//   - `llm.call`         (logger.info)  on success
//   - `llm.call.failed`  (logger.warn)  on final / permanent failure
//
// Both lines carry { caller, status?, latencyMs, attempts, category? } so
// the demo transcript or a piped `jq` filter can show the per-turn LLM
// flow at coarse granularity (one label per concern, no per-hop noise).

import process from 'node:process'

import { logger } from './logger.js'

/** The 6 entry-points in this repo that reach OpenRouter via
 *  `fetchLlmJson`. Coarse-grained by design — no per-hop sub-context. */
export type LlmCaller =
  | 'agent-main'
  | 'router'
  | 'rephrase'
  | 'operator-briefing'
  | 'language-detect'
  | 'flow-engine'

export function debugEnabled(): boolean {
  return process.env.LLM_DEBUG === '1' || process.env.LLM_DEBUG === 'true'
}

export interface SuccessFields {
  caller: LlmCaller | 'unknown'
  status: number
  latencyMs: number
  attempts: number
  [key: string]: unknown
}

export interface FailureFields {
  caller: LlmCaller | 'unknown'
  category: string
  status?: number
  attempts: number
  latencyMs: number
  [key: string]: unknown
}

export function logCallSuccess(fields: SuccessFields): void {
  if (!debugEnabled()) return
  logger.info('llm.call', fields)
}

/** Extract prompt-cache usage from a parsed OpenRouter chat-completions
 *  response. Different providers surface cache stats under different keys:
 *
 *    • Anthropic — `usage.cache_read_input_tokens`,
 *                  `usage.cache_creation_input_tokens`
 *    • OpenAI   — `usage.prompt_tokens_details.cached_tokens`
 *    • Others   — no cache fields → returns an empty object
 *
 *  Returned shape is merged into the `llm.call` log line under stable keys
 *  so `--debug` transcripts and downstream filters can see at a glance
 *  whether the prompt cache hit. Zero values are still emitted (signals
 *  "asked, missed") to distinguish from "feature not supported by provider"
 *  (key absent). */
export function extractCacheUsage(parsed: unknown): Record<string, number> {
  if (!parsed || typeof parsed !== 'object') return {}
  const usage = (parsed as { usage?: Record<string, unknown> }).usage
  if (!usage || typeof usage !== 'object') return {}
  const out: Record<string, number> = {}

  const cacheRead = usage.cache_read_input_tokens
  if (typeof cacheRead === 'number') out.cacheRead = cacheRead

  const cacheCreated = usage.cache_creation_input_tokens
  if (typeof cacheCreated === 'number') out.cacheCreated = cacheCreated

  const ptd = (usage as { prompt_tokens_details?: { cached_tokens?: unknown } })
    .prompt_tokens_details
  if (ptd && typeof ptd.cached_tokens === 'number') {
    // Prefer Anthropic key if both present (avoid double-counting).
    if (out.cacheRead === undefined) out.cacheRead = ptd.cached_tokens
  }

  return out
}

export function logCallFailure(fields: FailureFields): void {
  if (!debugEnabled()) return
  logger.warn('llm.call.failed', fields)
}
