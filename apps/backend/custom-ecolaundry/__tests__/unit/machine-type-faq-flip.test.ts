// Standalone unit test (NO LLM) — F55 machineType FAQ-context override.
//
// SCENARIO (real CLI session reported by Andrea 2026-05-15):
//   T1 user: "ma quanto costa asciugare i vestiti?"
//     → FAQ flow, machineType captured as 'dryer' via verb detector (F52).
//   T2 user: "Pineda"
//     → FAQ resolves, lastResolvedIntent='faq', pendingFlow cleared.
//     → state.machineType STILL 'dryer' (sticky).
//   T3 user: "mi lavadora no funciona"
//     → BUG: autoExtractFacts had `if (!state.machineType)` (first-set-wins)
//       so the explicit 'lavadora' did NOT override. State stayed on 'dryer'.
//       Bot then ran dryer_ed340.json flow → replied "secadora ha arrancado"
//       while the customer was talking about the washer.
//
// FIX (F55, mirror of F51 for location):
//   autoExtractFacts now allows the override ONLY when no active flow is
//   running AND we just came from a FAQ context (lastResolvedIntent === 'faq').
//   Inside a trouble flow, first-set-wins is preserved (avoids accidental
//   flips like "ah no scusa la secadora" mid-troubleshoot).
//
// Run with:
//   node --import tsx __tests__/unit/machine-type-faq-flip.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

await loadTestRuntime()

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
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
  // ── F55 happy path ──────────────────────────────────────────────────────
  {
    name: 'F55: FAQ-context override flips machineType dryer→washer when no active flow',
    run: () => {
      const ar = makeAr()
      // Simulate state after FAQ asciugare resolved.
      ar.state.machineType = 'dryer'
      ar.state.location = 'Pineda'
      ar.state.lastResolvedIntent = 'faq'
      ar.state.pendingFlow = ''
      ar.state.activeFlowId = ''
      // Customer pivots to a real trouble report on the WASHER.
      autoExtractFacts(ar, 'mi lavadora no funciona')
      if (ar.state.machineType !== 'washer') {
        throw new Error(
          `F55: expected machineType to flip to 'washer' after FAQ-context, got '${ar.state.machineType}'`,
        )
      }
    },
  },
  {
    name: 'F55: opposite direction — washer→dryer flips when FAQ context allows',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'washer'
      ar.state.location = 'Pineda'
      ar.state.lastResolvedIntent = 'faq'
      autoExtractFacts(ar, 'mi secadora no funciona')
      if (ar.state.machineType !== 'dryer') {
        throw new Error(`F55: expected flip to 'dryer', got '${ar.state.machineType}'`)
      }
    },
  },

  // ── F55 guards: do NOT override inside an active trouble flow ───────────
  {
    name: 'F55 guard: pendingFlow active → NO override (preserve first-set-wins)',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'dryer'
      ar.state.pendingFlow = 'caso4-ask-cambio' // inside trouble flow
      ar.state.lastResolvedIntent = 'faq' // doesn't matter — pendingFlow trumps
      autoExtractFacts(ar, 'mi lavadora no funciona')
      if (ar.state.machineType !== 'dryer') {
        throw new Error(
          `F55: must NOT override mid-trouble (pendingFlow active), got '${ar.state.machineType}'`,
        )
      }
    },
  },
  {
    name: 'F55 guard: activeFlowId set → NO override',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'washer'
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.lastResolvedIntent = 'faq'
      autoExtractFacts(ar, 'la secadora no funciona')
      if (ar.state.machineType !== 'washer') {
        throw new Error(
          `F55: must NOT override during active display flow, got '${ar.state.machineType}'`,
        )
      }
    },
  },
  {
    name: 'F55 guard: lastResolvedIntent NOT faq → NO override (default first-set-wins)',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'dryer'
      ar.state.lastResolvedIntent = '' // never resolved a FAQ in this session
      autoExtractFacts(ar, 'mi lavadora no funciona')
      if (ar.state.machineType !== 'dryer') {
        throw new Error(
          `F55: must NOT override without FAQ context, got '${ar.state.machineType}'`,
        )
      }
    },
  },

  // ── F55 backwards-compat: fresh state still sets type from message ──────
  {
    name: 'F55 backcompat: fresh state with no machineType → still captures from message',
    run: () => {
      const ar = makeAr()
      autoExtractFacts(ar, 'mi lavadora no funciona')
      if (ar.state.machineType !== 'washer') {
        throw new Error(`F55: fresh state should capture 'washer', got '${ar.state.machineType}'`)
      }
    },
  },
  {
    name: 'F55 backcompat: same-type message → no-op (no flip needed)',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'washer'
      ar.state.lastResolvedIntent = 'faq'
      autoExtractFacts(ar, 'la lavadora no funciona') // same type as state
      if (ar.state.machineType !== 'washer') {
        throw new Error(`F55: same-type message should not reset, got '${ar.state.machineType}'`)
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
