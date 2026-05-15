// Standalone unit test (NO live LLM) — F61 re-arm on FAQ location switch.
//
// SCENARIO:
//   After a price/hours render, state.lastFaqKey records the FAQ subtype.
//   When the customer pivots location ("e a Pineda?") in FAQ context,
//   autoExtractFacts (F51 block) must:
//     1. switch state.location to the new resolved location, AND
//     2. RE-ARM pendingFlow = 'faq-{prices,hours}-await-location' so the
//        deterministic guard pipeline renders the new location's answer on
//        the next pass — without re-arm, the pipeline falls through to the
//        LLM rephrase which improvises a non-canonical reply (Bug A in
//        Andrea's 2026-05-15 mixed-flow chat).
//
// Run with:
//   node --import tsx __tests__/unit/faq-location-rearm.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { createInitialState } from '../../utils/state.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'
import type { AgentRuntime } from '../../models/index.js'

await loadTestRuntime()

// Inject a real-shaped locations fixture so resolveKnownLocation can match
// the location names the test messages mention. Keys are the canonical
// short names used by state.location across the codebase.
const baseRuntime = getCachedTestRuntime()
const runtimeWithLocations = {
  ...baseRuntime,
  locations: {
    locations: {
      Goya: { pueblo: 'Mataró', displayName: 'Goya' },
      Pineda: { pueblo: 'Pineda de Mar', displayName: 'Calle Pineda (Pineda de Mar)' },
    },
  },
} as typeof baseRuntime

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: runtimeWithLocations,
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'F61 — "e a Pineda?" after price render re-arms faq-prices-await-location',
    run: () => {
      const ar = makeAr()
      // Simulate state AFTER a successful price render for Goya:
      //   - lastResolvedIntent='faq' (set by renderPrices)
      //   - lastFaqKey='pricing' (F61 marker)
      //   - pendingFlow='' (cleared after render)
      ar.state.location = 'Goya'
      ar.state.lastResolvedIntent = 'faq'
      ar.state.lastFaqKey = 'pricing'
      ar.state.pendingFlow = ''

      autoExtractFacts(ar, 'e a Pineda?')

      if (ar.state.location !== 'Pineda') {
        throw new Error(`expected location switched to Pineda, got "${ar.state.location}"`)
      }
      if (ar.state.pendingFlow !== 'faq-prices-await-location') {
        throw new Error(
          `expected pendingFlow re-armed to faq-prices-await-location, got "${ar.state.pendingFlow}"`,
        )
      }
    },
  },
  {
    name: 'F61 — "e a Pineda?" after hours render re-arms faq-hours-await-location',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.lastResolvedIntent = 'faq'
      ar.state.lastFaqKey = 'openingHours'
      ar.state.pendingFlow = ''

      autoExtractFacts(ar, 'e a Pineda?')

      if (ar.state.location !== 'Pineda') {
        throw new Error(`expected location switched to Pineda, got "${ar.state.location}"`)
      }
      if (ar.state.pendingFlow !== 'faq-hours-await-location') {
        throw new Error(
          `expected pendingFlow re-armed to faq-hours-await-location, got "${ar.state.pendingFlow}"`,
        )
      }
    },
  },
  {
    name: 'F61 — location switch with dryer-confirm armed: clear confirm + re-arm prices-await-location',
    run: () => {
      const ar = makeAr()
      // Bot just rendered Goya washer + dryer hint → pendingFlow=dryer-confirm
      ar.state.location = 'Goya'
      ar.state.lastResolvedIntent = 'faq'
      ar.state.lastFaqKey = 'pricing'
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'

      autoExtractFacts(ar, 'e a Pineda?')

      if (ar.state.location !== 'Pineda') {
        throw new Error(`expected location=Pineda, got "${ar.state.location}"`)
      }
      // The dryer-confirm flag MUST be cleared (stale) and re-armed as
      // prices-await-location for the fresh Pineda render.
      if (ar.state.pendingFlow !== 'faq-prices-await-location') {
        throw new Error(
          `expected pendingFlow=faq-prices-await-location, got "${ar.state.pendingFlow}"`,
        )
      }
    },
  },
  {
    name: 'F61 — no re-arm when not in FAQ context (lastFaqKey=null)',
    run: () => {
      const ar = makeAr()
      // Customer is mid-trouble flow with location already set — a stray
      // "e a Pineda?" must NOT re-arm a FAQ flow.
      ar.state.location = 'Goya'
      ar.state.lastResolvedIntent = null
      ar.state.lastFaqKey = null
      ar.state.pendingFlow = ''

      autoExtractFacts(ar, 'e a Pineda?')

      // F51 only fires when lastResolvedIntent === 'faq' OR pendingFlow is a
      // faq-* state; here neither holds, so location and pendingFlow stay put.
      if (ar.state.location !== 'Goya') {
        throw new Error(`location must NOT switch outside FAQ context, got "${ar.state.location}"`)
      }
      if (ar.state.pendingFlow !== '') {
        throw new Error(`pendingFlow must remain empty, got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'F64 — explicit location in trouble entry after FAQ closure overrides sticky location',
    run: () => {
      const ar = makeAr()
      // Simulate state AFTER F62 closure + F63 release:
      //   - location='Pineda' (sticky from FAQ comparison)
      //   - lastResolvedIntent=null (F62 cleared)
      //   - lastFaqKey=null (F62 cleared)
      //   - previousBranch='faq' (F63 set)
      //   - activeBranch=null (F63 cleared)
      ar.state.location = 'Pineda'
      ar.state.lastResolvedIntent = null
      ar.state.lastFaqKey = null
      ar.state.previousBranch = 'faq'
      ar.state.activeBranch = null
      ar.state.pendingFlow = ''

      autoExtractFacts(ar, 'no funciona la lavadora 6 a Goya')

      if (ar.state.location !== 'Goya') {
        throw new Error(`F64: location must override to Goya from explicit "a Goya", got "${ar.state.location}"`)
      }
    },
  },
  {
    name: 'F61 — same location: no-op (no re-arm, no spurious mutation)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.lastResolvedIntent = 'faq'
      ar.state.lastFaqKey = 'pricing'
      ar.state.pendingFlow = ''

      autoExtractFacts(ar, 'e a Pineda?')

      // Resolved location matches current → F51 inner block does NOT trigger.
      if (ar.state.location !== 'Pineda') {
        throw new Error(`location must stay Pineda, got "${ar.state.location}"`)
      }
      if (ar.state.pendingFlow !== '') {
        throw new Error(`same-location must not re-arm, got "${ar.state.pendingFlow}"`)
      }
    },
  },
]

let passed = 0
let failed = 0
for (const c of cases) {
  try {
    c.run()
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
