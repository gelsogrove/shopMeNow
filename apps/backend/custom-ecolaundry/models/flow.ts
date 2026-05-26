// Flow-engine + LLM request types.

import type { FlowNode } from './runtime.js'

export type Route =
  | 'washer'
  | 'dryer'
  | 'faq'
  | 'operator'
  | 'reset'
  | 'greeting'
  | 'unknown'

export type FlowEngineResult = {
  flowId: string
  stepId: string
  prompt: string
  type: FlowNode['type']
  isTerminal: boolean
  action?: 'escalate'
}

export type LlmRequest = {
  systemPrompt?: string
  userPrompt: string
  json?: boolean
  maxTokens?: number
  temperature?: number
  /** Optional OpenRouter model id. When omitted, the default from
   *  llm.ts:resolveModel() is used (env var or hard-coded fallback). */
  model?: string
  /** When true AND `systemPrompt` is large enough (>= ~1024 tokens, the
   *  Anthropic minimum for prefix caching), the system message is sent as
   *  a content-block array with `cache_control: { type: 'ephemeral' }`.
   *  Providers that support prompt caching (Anthropic, Gemini, recent OpenAI)
   *  reuse the prefix across turns. Providers that ignore the field receive
   *  a still-valid chat-completions request (no-op).
   *  See `agent-llm.ts:withSystemPromptCache` for the canonical pattern. */
  cacheSystemPrompt?: boolean
  /** Observability tag — identifies which subsystem triggered the call.
   *  Logged when LLM_DEBUG=1. See `LlmCaller` in utils/llm-fetch-observability.ts. */
  caller?:
    | 'router'
    | 'rephrase'
    | 'operator-briefing'
    | 'language-detect'
    | 'flow-engine'
}
