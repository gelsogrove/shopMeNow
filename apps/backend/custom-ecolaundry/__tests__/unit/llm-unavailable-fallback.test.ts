// F85 — When OpenRouter is unreachable (key revoked / credits exhausted /
// rate-limit / timeout / network), chatbotFn must return
// { reply: null, error: 'llm_unavailable' } so the host app can serve the
// workspace WIP message instead of a generic "agent_error".
//
// SCENARIO
// ========
// The customer types a non-greeting message that does NOT trigger any
// deterministic guard (so the pipeline reaches `runLlmLoop` and calls
// OpenRouter). We intercept `globalThis.fetch` to simulate each failure
// category surfaced by `utils/llm-fetch.ts:categoryForStatus`:
//
//   - 401  → category 'auth'                (no retry, throws immediately)
//   - 402  → category 'permanent_upstream'  (no retry, throws immediately)
//   - 429  → category 'transient_upstream'  (retries 3x, then throws)
//   - network reject → category 'network'   (retries 3x, then throws)
//
// All four must surface as `error: 'llm_unavailable'`. Cost note: the test
// never reaches real OpenRouter — fetch is mocked at the global level.
//
// Run with:
//   node --import tsx __tests__/unit/llm-unavailable-fallback.test.ts

import { chatbotFn, __testing } from '../../index.js'
import type { ChatbotInput } from '../../models/index.js'

interface Case {
  name: string
  installMock: () => void
  expectedError: string
}

function makeInput(sessionId: string, userMessage: string): ChatbotInput {
  return {
    userMessage,
    userName: 'Test',
    channel: 'web',
    config: {
      workspaceId: 'test-ws',
      debugChannel: false,
      isPlayground: false,
      language: 'es',
    },
    context: {
      sessionId,
      history: [],
    },
  }
}

function mockFetchStatus(status: number, body = ''): void {
  ;(globalThis as { fetch: typeof fetch }).fetch = (async () => {
    return new Response(body, { status, statusText: `HTTP ${status}` })
  }) as typeof fetch
}

function mockFetchNetworkError(): void {
  ;(globalThis as { fetch: typeof fetch }).fetch = (async () => {
    throw new TypeError('fetch failed: ECONNREFUSED')
  }) as typeof fetch
}

const originalFetch = globalThis.fetch

const cases: Case[] = [
  // ── Auth failure (401) — invalid / revoked API key ───────────────────────
  {
    name: "F85 — fetch 401 (auth) → chatbotFn returns error='llm_unavailable'",
    installMock: () => mockFetchStatus(401, 'invalid api key'),
    expectedError: 'llm_unavailable',
  },

  // ── Permanent upstream (402) — credits exhausted ─────────────────────────
  {
    name: "F85 — fetch 402 (credits exhausted) → error='llm_unavailable'",
    installMock: () => mockFetchStatus(402, 'insufficient credits'),
    expectedError: 'llm_unavailable',
  },

  // ── Transient upstream (429) — rate limit, after retry exhaustion ────────
  {
    name: "F85 — fetch 429 (rate limit, retries exhausted) → error='llm_unavailable'",
    installMock: () => mockFetchStatus(429, 'rate limited'),
    expectedError: 'llm_unavailable',
  },

  // ── Network error — DNS/TCP, after retry exhaustion ──────────────────────
  {
    name: "F85 — fetch network error → error='llm_unavailable'",
    installMock: () => mockFetchNetworkError(),
    expectedError: 'llm_unavailable',
  },
]

async function runCase(c: Case, idx: number): Promise<void> {
  // Fresh session per case so cached state never leaks across categories.
  __testing.sessionCache.clear()
  const sessionId = `f84-session-${idx}`
  // Install mock BEFORE any chatbotFn call: with `useBranchRouter=true`
  // (tenant config), the very first turn calls the router LLM, so a
  // fresh-session message is enough to exercise the OpenRouter failure
  // path end-to-end (router → throw LlmFetchError → catch in chatbotFn
  // → error='llm_unavailable').
  c.installMock()
  try {
    const out = await chatbotFn(
      makeInput(sessionId, 'cuánto cuesta lavar un edredón grande de plumas'),
    )
    if (out.reply !== null) {
      throw new Error(`expected reply=null on LLM failure, got: ${JSON.stringify(out.reply)}`)
    }
    if (out.error !== c.expectedError) {
      throw new Error(
        `expected error='${c.expectedError}', got: ${JSON.stringify(out.error)}`,
      )
    }
    if (out.shouldEscalate !== false) {
      throw new Error(`expected shouldEscalate=false, got: ${out.shouldEscalate}`)
    }
  } finally {
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  }
}

async function main(): Promise<void> {
  // Speed up the 429 / network cases — without a tiny timeout the retry
  // backoff (200+400+800ms) inflates the suite to ~1.5s per case. Override
  // unconditionally because the parent test runner may have inherited a
  // larger value from .env that would make this single file dominate the
  // total suite runtime.
  process.env.LLM_TIMEOUT_MS = '500'

  let passed = 0
  let failed = 0
  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i]
    try {
      await runCase(c, i)
      passed += 1
      console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
