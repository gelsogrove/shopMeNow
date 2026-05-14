// Smoke test E2E — Caso 12 from raw user message to bot reply (no LLM).
//
// Verifies the new guards from Andrea 2026-05-14 produce the expected
// dialogue across T1 → T2, and that the legacy "Tengo que revisarlo"
// deflection is dead.
//
// Run with:
//   node --import tsx __tests__/unit/smoke-caso-12-e2e.test.ts

import { runGuardPipeline } from '../../utils/guards/index.js'
import { autoExtractFacts } from '../../utils/agent-extract.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

await loadTestRuntime()
const here = path.dirname(fileURLToPath(import.meta.url))
const locationsRaw = JSON.parse(
  await readFile(path.join(here, '..', '..', 'json', 'locations.json'), 'utf8'),
)

// Build a Runtime that includes the REAL locations.json so the formatters
// produce realistic strings — closest possible to production behaviour.
const baseRuntime = getCachedTestRuntime()
const runtime = {
  ...baseRuntime,
  locations: locationsRaw as typeof baseRuntime.locations,
} as typeof baseRuntime

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime,
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

function turn(ar: AgentRuntime, userMessage: string): { reply: string; reason: string } {
  autoExtractFacts(ar, userMessage)
  const outcome = runGuardPipeline(ar, userMessage)
  if (!outcome) return { reply: '<<LLM FALLBACK — guard pipeline returned null>>', reason: 'fallback' }
  return { reply: outcome.reply, reason: outcome.reason }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'Caso 12.2 T1: "cuanto costa lavare la roba?" → bot asks location',
    run: () => {
      const ar = makeAr()
      const r = turn(ar, 'cuanto costa lavare la roba?')
      console.log(`\n    REASON: ${r.reason}`)
      console.log(`    REPLY:  ${r.reply}`)
      if (r.reason === 'fallback') throw new Error('guard did not fire (LLM fallback)')
      if (!/lavandería|pueblo/i.test(r.reply)) throw new Error('expected location-ask reply')
      // CRITICAL: legacy deflection MUST NOT appear.
      if (/Tengo que revisarlo/.test(r.reply)) {
        throw new Error('LEGACY DEFLECTION STILL FIRES — pricing FAQ not updated')
      }
    },
  },
  {
    name: 'Caso 12.2 T2: user replies "Platja d\'Aro" → bot returns real washer prices',
    run: () => {
      const ar = makeAr()
      // T1
      turn(ar, '¿cuánto cuesta la lavadora?')
      // T2 — customer provides location
      const r = turn(ar, "Platja d'Aro")
      console.log(`\n    REASON: ${r.reason}`)
      console.log(`    REPLY:  ${r.reply.slice(0, 200)}...`)
      if (r.reason === 'fallback') throw new Error('guard did not fire at T2')
      if (!/\*\*L1\*\*/.test(r.reply)) throw new Error('expected bold L1 in washer prices')
      if (!/20kg/.test(r.reply)) throw new Error('expected L1 weight 20kg')
      if (!/Platja d'Aro/.test(r.reply)) throw new Error('expected location header in reply')
    },
  },
  {
    name: 'Caso 12.1 T1: "¿cuáles son los horarios?" → bot asks location',
    run: () => {
      const ar = makeAr()
      const r = turn(ar, '¿cuáles son los horarios?')
      console.log(`\n    REASON: ${r.reason}`)
      console.log(`    REPLY:  ${r.reply}`)
      if (r.reason === 'fallback') throw new Error('hours guard did not fire')
      if (!/pueblo|lavandería/i.test(r.reply)) throw new Error('expected location ask')
    },
  },
  {
    name: 'Caso 12.1 T2: "L\'Escala" → bot returns 7:00-23:00 (exception location)',
    run: () => {
      const ar = makeAr()
      turn(ar, '¿hasta qué hora estáis abiertos?')
      const r = turn(ar, "L'Escala")
      console.log(`\n    REASON: ${r.reason}`)
      console.log(`    REPLY:  ${r.reply}`)
      if (r.reason === 'fallback') throw new Error('hours T2 guard did not fire')
      if (!/7:00.*23:00/.test(r.reply)) throw new Error("expected L'Escala extended hours 7:00-23:00")
    },
  },
  {
    name: 'Sanity: faqs.json:pricing no longer contains the legacy "Tengo que revisarlo" string',
    run: async () => {
      const faqsRaw = JSON.parse(
        await readFile(path.join(here, '..', '..', 'json', 'faqs.json'), 'utf8'),
      ) as Record<string, string>
      if (/Tengo que revisarlo/.test(faqsRaw.pricing || '')) {
        throw new Error('faqs.json:pricing STILL contains legacy deflection text')
      }
    },
  },
]

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
