// The Anthropic plumbing: one HTTP client, the message shapes it speaks, and
// the env configuration. Nothing in here knows about tourism, intake or
// guards — it sends messages and returns what the model said.
//
// Switched from OpenRouter to the first-party Anthropic API (Andrea,
// 2026-08-28: "al posto di usare openrouter usiamo la key di anthropic e
// puntiamo sempre ad anthropic"). The agent still speaks the OpenAI-ish
// message shape it always has (role/content/tool_calls/tool) — the whole
// translation to Anthropic's Messages API lives HERE, so the switch is one
// file and agent.ts is untouched (iron rule 3: one file, one responsibility).
// The other custom-* modules still ride OpenRouter; migrating them is a
// separate, deliberate job.

import type { Settings } from './agent.js'

// ANTHROPIC_API_KEY is the standard name every Anthropic SDK reads.
const API_KEY = process.env.ANTHROPIC_API_KEY
// Required by identity-linked API keys (the Console ties them to a user):
// those requests must also say WHICH Anthropic workspace they act in. A
// standard workspace-scoped key does not need it — the header is only sent
// when the env var is present.
const WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID
const BASE_URL = process.env.LLM_BASE_URL || 'https://api.anthropic.com'
const ANTHROPIC_VERSION = '2023-06-01'
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

/**
 * The tenant configures the model in the backoffice (workspace column →
 * settings.json, §1D) and may paste either the OpenRouter spelling
 * ("anthropic/claude-haiku-4.5") or the first-party id ("claude-haiku-4-5").
 * Both normalize to the first-party id; anything that is not a Claude model
 * is a configuration error and is said out loud — never silently swapped for
 * a default (CLAUDE.md §1: no fallbacks).
 */
function normalizeModel(raw: string): string {
  const bare = raw.includes('/') ? raw.slice(raw.lastIndexOf('/') + 1) : raw
  const id = bare.replace(/\./g, '-')
  if (!id.startsWith('claude')) {
    throw new Error(
      `Model "${raw}" is not an Anthropic model: this module now calls the Anthropic API directly. ` +
        'Set a Claude model (e.g. "claude-haiku-4-5") in the backoffice chatbot settings.',
    )
  }
  return id
}

/**
 * Sampling parameters were REMOVED on the 4.6+ generation (Sonnet 5, Opus
 * 5/4.8/4.7/4.6, Sonnet 4.6, Fable 5): sending `temperature` there returns a
 * 400. Haiku 4.5 and older still accept it, and it is a tenant knob — so it
 * is sent exactly where it is still legal, dropped where it would break the
 * request.
 */
function samplingRemoved(model: string): boolean {
  return /^claude-(sonnet-5|opus-5|fable-5|mythos-5|opus-4-[678]|sonnet-4-6)/.test(model)
}

interface AnthropicContentBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: unknown
}

/**
 * The agent's OpenAI-ish history → Anthropic Messages shape.
 *
 * - the leading `system` message becomes the top-level `system` string;
 * - assistant `tool_calls` become `tool_use` content blocks (arguments
 *   parsed back to the object the API expects);
 * - `tool` messages become `tool_result` blocks in a USER message, with
 *   consecutive tool messages merged into ONE user message — parallel tool
 *   results split across messages silently degrade the model's willingness
 *   to call tools in parallel;
 * - an assistant message with no text and no tool calls (a retry
 *   placeholder) is skipped: Anthropic rejects empty content.
 */
function toAnthropicPayload(messages: Message[]): {
  system: string | undefined
  messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
} {
  let system: string | undefined
  const out: Array<{ role: 'user' | 'assistant'; content: unknown }> = []

  for (const m of messages) {
    if (m.role === 'system') {
      if (system === undefined) system = m.content ?? ''
      else out.push({ role: 'user', content: m.content ?? '' })
      continue
    }
    if (m.role === 'tool') {
      const block = {
        type: 'tool_result',
        tool_use_id: m.tool_call_id ?? '',
        content: m.content ?? '',
      }
      const last = out[out.length - 1]
      if (last && last.role === 'user' && Array.isArray(last.content) && (last.content[0] as AnthropicContentBlock)?.type === 'tool_result') {
        ;(last.content as unknown[]).push(block)
      } else {
        out.push({ role: 'user', content: [block] })
      }
      continue
    }
    if (m.role === 'assistant') {
      const blocks: unknown[] = []
      if (m.content && m.content.trim()) blocks.push({ type: 'text', text: m.content })
      for (const call of m.tool_calls ?? []) {
        blocks.push({
          type: 'tool_use',
          id: call.id ?? `call_${blocks.length}`,
          name: call.function.name,
          input: safeParseArgs(call.function.arguments),
        })
      }
      if (blocks.length === 0) continue
      out.push({ role: 'assistant', content: blocks })
      continue
    }
    out.push({ role: 'user', content: m.content ?? '' })
  }

  return { system, messages: out }
}

/** OpenAI-style tool definitions → Anthropic's {name, description, input_schema}. */
function toAnthropicTools(tools: unknown[]): unknown[] {
  return tools.map((t) => {
    const fn = (t as { function?: { name?: string; description?: string; parameters?: unknown } }).function
    if (!fn?.name) return t
    return { name: fn.name, description: fn.description ?? '', input_schema: fn.parameters ?? { type: 'object' } }
  })
}

export async function callLLM(messages: Message[], settings: Settings, tools: unknown[]): Promise<LlmResult> {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  if (!settings.model) throw new Error('settings.model is not set')
  if (!settings.maxTokens) throw new Error('settings.maxTokens is not set')

  const model = normalizeModel(settings.model)
  const { system, messages: anthropicMessages } = toAnthropicPayload(messages)

  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
      ...(WORKSPACE_ID ? { 'anthropic-workspace-id': WORKSPACE_ID } : {}),
    },
    body: JSON.stringify({
      model,
      max_tokens: settings.maxTokens,
      ...(system ? { system } : {}),
      ...(settings.temperature !== undefined && !samplingRemoved(model)
        ? { temperature: settings.temperature }
        : {}),
      messages: anthropicMessages,
      ...(tools.length > 0 ? { tools: toAnthropicTools(tools) } : {}),
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LLM HTTP ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    content?: AnthropicContentBlock[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }

  let content = ''
  const toolCalls: ToolCall[] = []
  for (const block of data.content ?? []) {
    if (block.type === 'text' && block.text) content += block.text
    else if (block.type === 'tool_use' && block.name) {
      toolCalls.push({
        id: block.id,
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      })
    }
  }

  return {
    content,
    toolCalls,
    tokensUsed: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
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
