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
}
