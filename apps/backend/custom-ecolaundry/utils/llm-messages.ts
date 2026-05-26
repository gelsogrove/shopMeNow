// Wire-format helper for OpenRouter chat-completions `messages` arrays.
//
// Two shapes:
//   • plain        — { role: 'system', content: string } + user
//   • cached       — { role: 'system', content: [{type:'text', text, cache_control:{type:'ephemeral'}}] } + user
//
// The cached shape is used when LlmRequest.cacheSystemPrompt is true AND
// the system prompt is at least PROMPT_CACHE_MIN_CHARS long. Providers that
// support prefix caching (Anthropic, Gemini, recent OpenAI) reuse the prefix
// across turns; providers that ignore the field still accept the request as
// a normal chat-completions payload.
//
// Why this module exists (separately from llm.ts):
//   iron rule #3 — one file, one responsibility. llm.ts owns transport
//   (auth header, fetch, response parsing). This module owns the wire shape
//   of the `messages` array. Splitting keeps llm.ts below the 150-line ceiling
//   and makes the helper independently testable.

import type { LlmRequest } from '../models/index.js'

/** Anthropic's prompt-cache prefix has a minimum size (~1024 tokens). Below
 *  that threshold the provider ignores `cache_control`, so the wrapper adds
 *  only payload overhead with zero benefit. We approximate tokens as
 *  chars/4 (conservative for Latin text) and gate caching on this floor. */
export const PROMPT_CACHE_MIN_CHARS = 4000

/** Build the `messages` array for the chat-completions request, optionally
 *  wrapping the system prompt in a content-block array with
 *  `cache_control: { type: 'ephemeral' }` so caching-capable providers can
 *  reuse the prefix across turns. Mirrors `agent-llm.ts:withSystemPromptCache`
 *  but for the single-shot `callOpenRouter` shape (string system + user). */
export function buildMessages(params: LlmRequest): unknown[] {
  const userMsg = { role: 'user', content: params.userPrompt }
  if (!params.systemPrompt) return [userMsg]

  const shouldCache =
    params.cacheSystemPrompt === true &&
    params.systemPrompt.length >= PROMPT_CACHE_MIN_CHARS

  if (!shouldCache) {
    return [{ role: 'system', content: params.systemPrompt }, userMsg]
  }

  return [
    {
      role: 'system',
      content: [
        {
          type: 'text',
          text: params.systemPrompt,
          cache_control: { type: 'ephemeral' },
        },
      ],
    },
    userMsg,
  ]
}
