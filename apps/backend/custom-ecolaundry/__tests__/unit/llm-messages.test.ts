// Standalone unit test (NO LLM) — llm.ts prompt-caching opt-in.
//
// Verifies the wire format sent to OpenRouter when LlmRequest.cacheSystemPrompt
// is set. We stub globalThis.fetch to capture the outgoing request body and
// assert the shape of `messages[0]`:
//
//   • cacheSystemPrompt unset                      → messages[0].content is a string
//   • cacheSystemPrompt=true + small system prompt → still string (under
//                                                    PROMPT_CACHE_MIN_CHARS)
//   • cacheSystemPrompt=true + large system prompt → content is an array
//                                                    [{type:'text', text, cache_control:{type:'ephemeral'}}]
//   • no systemPrompt                              → messages array has only the user turn
//
// Rationale: routing (`router.txt` ~21KB) and rephrase (`rephrase.txt` ~8KB)
// both opt-in to caching. Sending the `cache_control` block to providers that
// don't support it is harmless, but sending it on prompts that fall below the
// Anthropic prefix-cache minimum (~1024 tokens) only adds payload bytes
// without ever producing a cache hit — so the helper gates on size.
//
// Run with:
//   node --import tsx __tests__/unit/llm-prompt-cache.test.ts

import process from 'node:process'

import { callOpenRouter } from '../../utils/llm.js'
import { PROMPT_CACHE_MIN_CHARS } from '../../utils/llm-messages.js'

// ── fetch stub ───────────────────────────────────────────────────────────────

interface CapturedRequest {
  url: string
  body: Record<string, unknown>
}

function stubFetch(): {
  captured: CapturedRequest[]
  restore: () => void
} {
  const captured: CapturedRequest[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    const rawBody = typeof init?.body === 'string' ? init.body : ''
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(rawBody)
    } catch {
      // Non-JSON body — leave empty so assertions fail loudly downstream.
    }
    captured.push({ url, body })
    return new Response(
      JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof globalThis.fetch
  return {
    captured,
    restore: () => {
      globalThis.fetch = realFetch
    },
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFirstMessage(req: CapturedRequest): Record<string, unknown> {
  const messages = req.body.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('messages array missing or empty')
  }
  return messages[0] as Record<string, unknown>
}

interface Case {
  name: string
  run: () => Promise<void>
}

const ORIG_API_KEY = process.env.OPENROUTER_API_KEY
process.env.OPENROUTER_API_KEY = 'test-key-fixture'

const SHORT_PROMPT = 'You are a helpful assistant.'
// 5000-char filler: comfortably above PROMPT_CACHE_MIN_CHARS (4000).
const LARGE_PROMPT = 'A'.repeat(PROMPT_CACHE_MIN_CHARS + 1000)

const cases: Case[] = [
  {
    name: 'cacheSystemPrompt unset → system message is a plain string',
    run: async () => {
      const fetchStub = stubFetch()
      try {
        await callOpenRouter({
          systemPrompt: LARGE_PROMPT,
          userPrompt: 'hello',
          caller: 'router',
        })
      } finally {
        fetchStub.restore()
      }
      const first = getFirstMessage(fetchStub.captured[0])
      if (first.role !== 'system') {
        throw new Error(`expected system message first, got role=${String(first.role)}`)
      }
      if (typeof first.content !== 'string') {
        throw new Error(`expected string content when cacheSystemPrompt is unset, got ${typeof first.content}`)
      }
    },
  },
  {
    name: 'cacheSystemPrompt=true + large system prompt → content is array with cache_control ephemeral',
    run: async () => {
      const fetchStub = stubFetch()
      try {
        await callOpenRouter({
          systemPrompt: LARGE_PROMPT,
          userPrompt: 'hello',
          caller: 'router',
          cacheSystemPrompt: true,
        })
      } finally {
        fetchStub.restore()
      }
      const first = getFirstMessage(fetchStub.captured[0])
      if (first.role !== 'system') {
        throw new Error(`expected system message first, got role=${String(first.role)}`)
      }
      if (!Array.isArray(first.content)) {
        throw new Error(`expected array content when caching large prompt, got ${typeof first.content}`)
      }
      const block = first.content[0] as Record<string, unknown>
      if (block.type !== 'text') throw new Error(`expected type='text', got ${String(block.type)}`)
      if (block.text !== LARGE_PROMPT) throw new Error('text payload mismatch')
      const cc = block.cache_control as Record<string, unknown> | undefined
      if (!cc || cc.type !== 'ephemeral') {
        throw new Error(`expected cache_control={type:'ephemeral'}, got ${JSON.stringify(cc)}`)
      }
    },
  },
  {
    name: 'cacheSystemPrompt=true + small system prompt → still a plain string (under min size)',
    run: async () => {
      const fetchStub = stubFetch()
      try {
        await callOpenRouter({
          systemPrompt: SHORT_PROMPT,
          userPrompt: 'hello',
          caller: 'router',
          cacheSystemPrompt: true,
        })
      } finally {
        fetchStub.restore()
      }
      const first = getFirstMessage(fetchStub.captured[0])
      if (typeof first.content !== 'string') {
        throw new Error(
          `small prompts must skip the cache wrapper to avoid no-op overhead; got ${typeof first.content}`,
        )
      }
    },
  },
  {
    name: 'no systemPrompt → messages contains only the user turn',
    run: async () => {
      const fetchStub = stubFetch()
      try {
        await callOpenRouter({
          userPrompt: 'hello',
          caller: 'router',
          cacheSystemPrompt: true,
        })
      } finally {
        fetchStub.restore()
      }
      const messages = fetchStub.captured[0].body.messages as Array<Record<string, unknown>>
      if (messages.length !== 1) {
        throw new Error(`expected exactly 1 message (user only), got ${messages.length}`)
      }
      if (messages[0].role !== 'user') {
        throw new Error(`expected role='user', got ${String(messages[0].role)}`)
      }
    },
  },
]

async function main(): Promise<void> {
  let passed = 0
  let failed = 0
  const failures: Array<{ name: string; reason: string }> = []

  for (const c of cases) {
    try {
      await c.run()
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      failures.push({ name: c.name, reason })
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }

  if (ORIG_API_KEY === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = ORIG_API_KEY

  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
