// Thin wrapper around OpenRouter chat completions for the agent.
// Sends the conversation + tools schema, returns the assistant message
// (which may include tool_calls to be executed by the dispatcher).
//
// Resilience: OpenRouter is a multi-provider gateway and frequently returns
// 502/504 when a backend provider blips. We delegate the HTTP call to
// `fetchLlmJson()` which adds timeout + retry-with-backoff so a single bad
// second doesn't ruin the customer's turn.
//
// Prompt caching: the system prompt is large (agent.txt + reglas.md +
// sticky state + settings) and identical across all turns within a session.
// We mark the system message with `cache_control: { type: 'ephemeral' }`
// so providers that support prefix caching (Anthropic, Gemini, recent
// OpenAI) skip re-tokenising it. On providers that ignore the field the
// payload remains a valid chat-completions request — no-op, not an error.

import process from 'node:process'

import { API_KEY, resolveModel } from './llm.js'
import { TOOLS } from './agent-tools.js'
import { fetchLlmJson } from './llm-fetch.js'
import type { AgentMessage, Runtime } from '../models/index.js'

const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
const DEFAULT_MAX_TOKENS = 800

/** Wrap the system message's text content in a cache-control block so
 *  providers that support prefix caching can reuse the work across turns.
 *  The remaining messages (history + new user turn) are passed through as-is. */
function withSystemPromptCache(messages: AgentMessage[]): unknown[] {
  if (!messages.length || messages[0].role !== 'system' || typeof messages[0].content !== 'string') {
    return messages
  }
  const [system, ...rest] = messages
  return [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: system.content,
          cache_control: { type: 'ephemeral' },
        },
      ],
    },
    ...rest,
  ]
}

export async function callAgentLLM(
  messages: AgentMessage[],
  runtime?: Runtime,
): Promise<AgentMessage> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing')
  const data = await fetchLlmJson<{
    choices?: Array<{ message?: AgentMessage }>
  }>(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://echatbot.ai',
      'X-Title': 'Ecolaundry Agent',
    },
    body: JSON.stringify({
      model: resolveModel(runtime),
      messages: withSystemPromptCache(messages),
      tools: TOOLS,
      tool_choice: 'auto',
      // Tenant-tunable via `settings.agentTemperature`. Falls back to 0.3 to
      // preserve previous behaviour when settings doesn't define the value.
      temperature: runtime?.settings?.agentTemperature ?? 0.3,
      // Tenant-tunable via `settings.agentMaxTokens`. Default 800 preserves
      // prior behaviour.
      max_tokens: runtime?.settings?.agentMaxTokens ?? DEFAULT_MAX_TOKENS,
    }),
  })
  return data.choices?.[0]?.message || { role: 'assistant', content: '' }
}
