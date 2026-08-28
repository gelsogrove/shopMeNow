// The LLM plumbing: one HTTP client per provider, the message shapes they
// speak, and the env configuration. Nothing in here knows about tourism,
// intake or guards — it sends messages and returns what the model said.
//
// TWO transports, ONE switch (Andrea, 2026-08-28: "deve essere semplice
// cambiarlo"): `LLM_PROVIDER=anthropic` calls the first-party Anthropic API,
// `LLM_PROVIDER=openrouter` (the default — today's working production state)
// calls OpenRouter. One variable instead of two booleans on purpose: two
// flags can contradict each other, one enum cannot.
//
// The agent always speaks the same OpenAI-ish message shape it always has
// (role/content/tool_calls/tool); the Anthropic translation lives entirely
// here, so switching provider is an env change, never a code change
// (iron rule 3: one file, one responsibility). The other custom-* modules
// still ride OpenRouter only.

import type { Settings } from './agent.js'

type Provider = 'anthropic' | 'openrouter'

function resolveProvider(): Provider {
  const raw = (process.env.LLM_PROVIDER ?? 'openrouter').trim().toLowerCase()
  if (raw === 'anthropic' || raw === 'openrouter') return raw
  throw new Error(`LLM_PROVIDER must be "anthropic" or "openrouter", got "${raw}"`)
}

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'

// ANTHROPIC_API_KEY is the standard name every Anthropic SDK reads.
// ANTHROPIC_WORKSPACE_ID is required by identity-linked API keys (the
// Console ties them to a user): those requests must also say WHICH Anthropic
// workspace they act in. The header is only sent when the env var is present.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const ANTHROPIC_WORKSPACE_ID = process.env.ANTHROPIC_WORKSPACE_ID
const ANTHROPIC_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
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
 * Per-call options. `toolChoice: 'required'` forces the model to call one of
 * the tools offered instead of answering in prose — the code's way of taking
 * a freedom away (iron rule 1) on a hop where prose has already proven to be
 * filler. Translated per provider below.
 */
export interface CallOptions {
  toolChoice?: 'required'
}

export async function callLLM(
  messages: Message[],
  settings: Settings,
  tools: unknown[],
  options: CallOptions = {},
): Promise<LlmResult> {
  return resolveProvider() === 'anthropic'
    ? callAnthropic(messages, settings, tools, options)
    : callOpenRouter(messages, settings, tools, options)
}

// ── OpenRouter (OpenAI-compatible; the agent's native shape passes through) ──

async function callOpenRouter(
  messages: Message[],
  settings: Settings,
  tools: unknown[],
  options: CallOptions,
): Promise<LlmResult> {
  if (!OPENROUTER_KEY) throw new Error('OPENROUTER_API_KEY is not set')

  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages,
      tools,
      ...(options.toolChoice === 'required' && tools.length > 0 ? { tool_choice: 'required' } : {}),
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

// ── Anthropic (first-party Messages API; translated from the agent's shape) ──

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
      `Model "${raw}" is not an Anthropic model but LLM_PROVIDER=anthropic. ` +
        'Set a Claude model (e.g. "claude-haiku-4-5") in the backoffice chatbot settings, ' +
        'or switch LLM_PROVIDER back to "openrouter".',
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

async function callAnthropic(
  messages: Message[],
  settings: Settings,
  tools: unknown[],
  options: CallOptions,
): Promise<LlmResult> {
  if (!ANTHROPIC_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  if (!settings.model) throw new Error('settings.model is not set')
  if (!settings.maxTokens) throw new Error('settings.maxTokens is not set')

  const model = normalizeModel(settings.model)
  const { system, messages: anthropicMessages } = toAnthropicPayload(messages)

  const response = await fetch(`${ANTHROPIC_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
      ...(ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': ANTHROPIC_WORKSPACE_ID } : {}),
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
      ...(options.toolChoice === 'required' && tools.length > 0 ? { tool_choice: { type: 'any' } } : {}),
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
