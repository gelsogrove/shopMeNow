// Thin wrapper around OpenRouter chat completions for the agent.
// Sends the conversation + tools schema, returns the assistant message
// (which may include tool_calls to be executed by the dispatcher).

import process from 'node:process'

import { API_KEY, resolveModel } from './llm.js'
import { TOOLS } from './agent-tools.js'
import type { AgentMessage } from './agent-types.js'
import type { Runtime } from './runtime.js'

const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'

export async function callAgentLLM(
  messages: AgentMessage[],
  runtime?: Runtime,
): Promise<AgentMessage> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing')
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://echatbot.ai',
      'X-Title': 'Cliente-0 Agent CLI',
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
  if (!response.ok) {
    throw new Error(`OpenRouter error ${response.status}: ${await response.text()}`)
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: AgentMessage }>
  }
  return data.choices?.[0]?.message || { role: 'assistant', content: '' }
}
