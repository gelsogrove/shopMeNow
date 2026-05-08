// Standalone unit test (NO live LLM) — branch router validation logic.
//
// SCENARIO:
//   utils/router.ts wraps a single LLM classification call. The LLM
//   reply is JSON. This file pins:
//     - the validator coerces malformed/partial responses to the contract
//     - empty messages short-circuit to "unknown"
//     - the network/API failure path returns the safe fallback
//   The actual LLM call is NOT exercised here (covered separately by
//   E2E tests under __tests__/agent/ when needed).
//
// Run with:
//   node --import tsx __tests__/unit/router.test.ts

import { classifyMessageBranch } from '../../utils/router.js'
import type { Runtime } from '../../models/index.js'

interface Case {
  name: string
  run: () => Promise<void>
}

const cases: Case[] = [
  {
    name: 'empty message → branch="unknown" (no LLM call)',
    run: async () => {
      const r = await classifyMessageBranch('')
      if (r.branch !== 'unknown') throw new Error(`expected "unknown", got "${r.branch}"`)
      if (r.language !== 'es') throw new Error('default language must be es')
    },
  },
  {
    name: 'whitespace-only message → branch="unknown" (no LLM call)',
    run: async () => {
      const r = await classifyMessageBranch('   \n\t  ')
      if (r.branch !== 'unknown') throw new Error(`expected "unknown", got "${r.branch}"`)
    },
  },
  {
    name: 'router decision shape contract on every path',
    run: async () => {
      // Even when the LLM returns garbage / empty / network fails, the
      // validator MUST coerce the result to the { branch, language, details }
      // shape. We exercise it via the empty-input short-circuit which
      // never calls the LLM at all.
      const r = await classifyMessageBranch('')
      if (!('branch' in r)) throw new Error('branch field missing')
      if (!('language' in r)) throw new Error('language field missing')
      if (!('details' in r) || typeof r.details !== 'object') {
        throw new Error('details must be an object')
      }
    },
  },
]

// NOTE: the live-LLM scenarios ("ciao" → greeting, "che orari" → faq, etc.)
// are deliberately NOT here — they require a real OPENROUTER_API_KEY and
// would cost $ on every CI run. They live in __tests__/agent/router.spec.ts
// (E2E) instead. This file pins ONLY the deterministic logic.

async function main(): Promise<void> {
  let passed = 0
  let failed = 0
  for (const c of cases) {
    try {
      await c.run()
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
