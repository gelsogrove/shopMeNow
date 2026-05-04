// Thin wrapper around OpenRouter chat completions for the agent.
// Sends the conversation + tools schema, returns the assistant message
// (which may include tool_calls to be executed by the dispatcher).
//
// Resilience: OpenRouter is a multi-provider gateway and frequently returns
// 502/504 when a backend provider blips. We delegate the HTTP call to
// `fetchLlmJson()` which adds timeout + retry-with-backoff so a single bad
// second doesn't ruin the customer's turn.

import process from 'node:process'

import { API_KEY, resolveModel } from './llm.js'
import { TOOLS } from './agent-tools.js'
import { fetchLlmJson } from './llm-fetch.js'
import type { AgentMessage } from './agent-types.js'
import type { Runtime } from './runtime.js'

const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'

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
      'X-Title': 'Cliente-0 Agent',
    },
    body: JSON.stringify({
      model: resolveModel(runtime),
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 800,
    }),
  })
  return data.choices?.[0]?.message || { role: 'assistant', content: '' }
}
