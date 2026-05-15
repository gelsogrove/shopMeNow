// Standalone unit test (NO LLM) — F59 FAQ-context gate for force-gather guards.
//
// SCENARIO (Andrea's CLI mixed-flow test 2026-05-15):
//   Customer asks "cuanto cuesta lavare la roba?" → "Goya" → "sí" (sees dryer
//   prices). Then customer says "secadora" as a bare token. Pre-F59 pipeline:
//   autoExtractFacts sets state.machineType='dryer' from the mention, location+
//   type+!number signature triggers guardForceMachineNumber → bot wrongly asks
//   "qué número tiene la máquina?" as if it were a trouble report.
//
// FIX (F59):
//   Each of the 3 force-gather guards (machineType, machineNumber, display)
//   now skips when state.lastResolvedIntent === 'faq' AND state.pendingFlow is
//   empty OR starts with 'faq-'. Real trouble flows (no-change-*, double-charge-*,
//   discount-code-*, invoice-*, photo-await-*, etc.) arm their own pendingFlow,
//   so the guards still fire normally inside legitimate trouble paths.
//
// CONTRACT pinned by this test:
//   A) FAQ context + bare machine-type mention → guards skip.
//   B) FAQ context + faq-* pendingFlow → guards skip (e.g. mid-FAQ).
//   C) Trouble flow active (pendingFlow starts with non-faq prefix) →
//      guards fire normally (no regression on trouble paths).
//   D) Outside FAQ context (lastResolvedIntent != 'faq') → guards fire
//      normally (default behaviour preserved).
//
// Run with:
//   node --import tsx __tests__/unit/force-gather-faq-gate.test.ts

import {
  guardForceMachineType,
  guardForceMachineNumber,
  guardForceDisplay,
} from '../../utils/guards/force-gather.js'
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
  // ── A) FAQ context + bare machine-type → guards skip ──────────────────
  {
    name: 'F59 — guardForceMachineNumber skips when lastResolvedIntent=faq + no trouble pendingFlow (real CLI bug)',
    run: () => {
      // Reproduces Andrea's CLI mixed-flow 2026-05-15:
      // post-FAQ closure, customer says "secadora" → autoExtract sets
      // machineType=dryer, pipeline must NOT call guardForceMachineNumber.
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'dryer'
      ar.state.machineNumber = ''
      ar.state.lastResolvedIntent = 'faq'
      ar.state.pendingFlow = ''
      ar.state.turnCount = 5
      const out = guardForceMachineNumber(ar, 'secadora')
      if (out !== null) {
        throw new Error(`F59: guard MUST skip in FAQ context, got reply: "${out.reply}"`)
      }
    },
  },
  {
    name: 'F59 — guardForceMachineType skips when lastResolvedIntent=faq + no trouble pendingFlow',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = ''
      ar.state.lastResolvedIntent = 'faq'
      ar.state.pendingFlow = ''
      ar.state.turnCount = 3
      const out = guardForceMachineType(ar, 'secadora')
      if (out !== null) {
        throw new Error(`F59: guardForceMachineType MUST skip in FAQ context, got: "${out.reply}"`)
      }
    },
  },
  {
    name: 'F59 — guardForceDisplay skips when lastResolvedIntent=faq + no trouble pendingFlow',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'dryer'
      ar.state.machineNumber = '5'
      ar.state.displayState = ''
      ar.state.lastResolvedIntent = 'faq'
      ar.state.pendingFlow = ''
      ar.state.turnCount = 4
      const out = guardForceDisplay(ar, 'secadora')
      if (out !== null) {
        throw new Error(`F59: guardForceDisplay MUST skip in FAQ context, got: "${out.reply}"`)
      }
    },
  },

  // ── B) FAQ context + faq-* pendingFlow → guards skip ──────────────────
  {
    name: 'F59 — guardForceMachineNumber skips during faq-prices-await-dryer-confirm (mid-FAQ)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'dryer'
      ar.state.machineNumber = ''
      ar.state.lastResolvedIntent = 'faq'
      ar.state.pendingFlow = 'faq-prices-await-dryer-confirm'
      ar.state.turnCount = 3
      const out = guardForceMachineNumber(ar, 'secadora')
      if (out !== null) throw new Error('F59: must skip during faq-* pendingFlow')
    },
  },

  // ── C) Trouble flow with non-faq pendingFlow → guards fire normally ───
  {
    name: 'F59 — guardForceMachineNumber FIRES inside no-change-ask trouble flow (no regression)',
    run: () => {
      // Caso 4 trouble flow: pendingFlow armed by detectPaidNotActivatedIntent.
      // Even if lastResolvedIntent was 'faq' from earlier, the trouble pendingFlow
      // overrides → guard must fire normally.
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = ''
      ar.state.lastResolvedIntent = 'faq' // stale from earlier
      ar.state.pendingFlow = 'no-change-ask' // trouble path active
      ar.state.turnCount = 3
      const out = guardForceMachineNumber(ar, 'algo')
      if (out === null) {
        throw new Error('F59: guard MUST fire inside no-change-ask trouble flow even with stale faq intent')
      }
      if (out.reason !== 'force-machine-number') {
        throw new Error(`F59: expected reason force-machine-number, got "${out.reason}"`)
      }
    },
  },
  {
    // F59 boundary signal: customer pivots FAQ → trouble with "no funciona".
    // Gate must NOT skip — let guardForceMachineType fire (MIX 0 contract).
    name: 'F59 — boundary signal "no funciona" lets guardForceMachineType FIRE in FAQ context (MIX 0)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = ''
      ar.state.lastResolvedIntent = 'faq' // still set after FAQ closure
      ar.state.pendingFlow = ''
      ar.state.turnCount = 5
      const out = guardForceMachineType(ar, 'no funciona')
      if (out === null) {
        throw new Error('F59: trouble signal "no funciona" must override the FAQ gate')
      }
      if (out.reason !== 'force-machine-type') {
        throw new Error(`F59: expected force-machine-type, got "${out.reason}"`)
      }
    },
  },
  {
    name: 'F59 — boundary signals cover 6 languages (non funziona / doesn\'t work / ne fonctionne pas / não funciona)',
    run: () => {
      const inputs = [
        'no funciona',
        'no arranca',
        'non funziona',
        'non parte',
        "doesn't work",
        'broken',
        'não funciona',
        'ne fonctionne pas',
        'ne marche pas',
      ]
      for (const msg of inputs) {
        const ar = makeAr()
        ar.state.location = 'Goya'
        ar.state.machineType = ''
        ar.state.lastResolvedIntent = 'faq'
        ar.state.pendingFlow = ''
        ar.state.turnCount = 3
        const out = guardForceMachineType(ar, msg)
        if (out === null) {
          throw new Error(`F59: trouble boundary signal "${msg}" must override FAQ gate`)
        }
      }
    },
  },

  // ── D) Outside FAQ context → guards fire normally ─────────────────────
  {
    name: 'F59 — guardForceMachineNumber FIRES when lastResolvedIntent != faq (default behaviour preserved)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = ''
      ar.state.lastResolvedIntent = null
      ar.state.pendingFlow = ''
      ar.state.turnCount = 3
      const out = guardForceMachineNumber(ar, 'secadora')
      if (out === null) {
        throw new Error('F59: guard MUST fire normally outside FAQ context (regression)')
      }
      if (out.reason !== 'force-machine-number') {
        throw new Error(`F59: expected reason force-machine-number, got "${out.reason}"`)
      }
    },
  },
  {
    name: 'F59 — guardForceMachineType FIRES outside FAQ context (default behaviour preserved)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = ''
      ar.state.lastResolvedIntent = null
      ar.state.pendingFlow = ''
      ar.state.turnCount = 3
      const out = guardForceMachineType(ar, 'secadora')
      if (out === null) {
        throw new Error('F59: guardForceMachineType MUST fire normally outside FAQ context')
      }
      if (out.reason !== 'force-machine-type') {
        throw new Error(`F59: expected reason force-machine-type, got "${out.reason}"`)
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
