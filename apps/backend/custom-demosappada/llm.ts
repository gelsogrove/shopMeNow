// The OpenRouter plumbing: one HTTP client, the message shapes it speaks,
// and the env configuration. Nothing in here knows about tourism, intake or
// guards — it sends messages and returns what the model said.

import type { Settings } from './agent.js'

const API_KEY = process.env.OPENROUTER_API_KEY
const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
export const LLM_DEBUG = process.env.LLM_DEBUG === '1'

export interface ToolCall {
  id?: string
  function: { name: string; arguments?: string }
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface LlmResult {
  content: string
  toolCalls: ToolCall[]
  tokensUsed: number
}

export async function callLLM(messages: Message[], settings: Settings, tools: unknown[]): Promise<LlmResult> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY is not set')

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages,
      tools,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LLM HTTP ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>
    usage?: { total_tokens?: number }
  }

  const message = data.choices?.[0]?.message
  return {
    content: message?.content ?? '',
    toolCalls: message?.tool_calls ?? [],
    tokensUsed: data.usage?.total_tokens ?? 0,
  }
}

export function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
