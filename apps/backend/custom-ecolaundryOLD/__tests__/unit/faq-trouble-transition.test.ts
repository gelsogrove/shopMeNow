// Standalone unit test (NO live LLM) — F60 FAQ→trouble boundary reset.
//
// SCENARIO:
//   When the branch router classifies a turn as `trouble-machine` AND the
//   previous turn closed in FAQ context (state.lastResolvedIntent === 'faq'),
//   the dispatcher MUST clear state.location + lastResolvedIntent + lastFaqKey
//   so the trouble flow starts fresh (asks "¿en qué lavandería?" rather than
//   carrying over a comparison location from the prior FAQ).
//
//   This file pins the helper `clearFaqContextOnTroubleEntry` directly. The
//   dispatcher wiring is pinned in f-log-regression.test.ts (string-grep on
//   utils/branches/index.ts for the F60 call site).
//
// Run with:
//   node --import tsx __tests__/unit/faq-trouble-transition.test.ts

import {
  clearFaqContextOnTroubleEntry,
  releaseBranchOnFaqClosure,
} from '../../utils/state-transitions.js'
import { createInitialState } from '../../utils/state.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'
import type { AgentRuntime } from '../../models/index.js'

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
  {
    name: 'F60 — clearFaqContextOnTroubleEntry wipes location + lastResolvedIntent + lastFaqKey',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.lastResolvedIntent = 'faq'
      ar.state.lastFaqKey = 'pricing'
      clearFaqContextOnTroubleEntry(ar)
      if (ar.state.location !== '') throw new Error(`location not cleared: "${ar.state.location}"`)
      if (ar.state.lastResolvedIntent !== null) {
        throw new Error(`lastResolvedIntent not cleared: "${ar.state.lastResolvedIntent}"`)
      }
      if (ar.state.lastFaqKey !== null) {
        throw new Error(`lastFaqKey not cleared: "${ar.state.lastFaqKey}"`)
      }
    },
  },
  {
    name: 'F60 — clearFaqContextOnTroubleEntry preserves other facts (machineType, customerName)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.lastResolvedIntent = 'faq'
      ar.state.machineType = 'washer'
      ar.state.customerName = 'Andrea'
      ar.state.customerPhone = '+34123456789'
      clearFaqContextOnTroubleEntry(ar)
      // Machine type is preserved on purpose — the customer may have mentioned
      // it ("lavadora") while comparing prices; the trouble-machine guards
      // know how to overwrite it via F55 FAQ-context flip when the type
      // actually changes.
      if (ar.state.machineType !== 'washer') throw new Error('machineType MUST be preserved')
      if (ar.state.customerName !== 'Andrea') throw new Error('customerName MUST be preserved')
      if (ar.state.customerPhone !== '+34123456789') throw new Error('customerPhone MUST be preserved')
    },
  },
  {
    name: 'F60 — clearFaqContextOnTroubleEntry idempotent: no-op when fields already empty',
    run: () => {
      const ar = makeAr()
      clearFaqContextOnTroubleEntry(ar)
      if (ar.state.location !== '') throw new Error('location must remain empty string')
      if (ar.state.lastResolvedIntent !== null) throw new Error('lastResolvedIntent must remain null')
      if (ar.state.lastFaqKey !== null) throw new Error('lastFaqKey must remain null')
    },
  },
  {
    name: 'F63 — releaseBranchOnFaqClosure moves activeBranch to previousBranch',
    run: () => {
      const ar = makeAr()
      ar.state.activeBranch = 'faq'
      ar.state.previousBranch = null
      releaseBranchOnFaqClosure(ar)
      if (ar.state.activeBranch !== null) {
        throw new Error(`activeBranch must be null after release, got "${ar.state.activeBranch}"`)
      }
      if (ar.state.previousBranch !== 'faq') {
        throw new Error(`previousBranch must record the released branch, got "${ar.state.previousBranch}"`)
      }
    },
  },
  {
    name: 'F63 — releaseBranchOnFaqClosure idempotent when activeBranch already null',
    run: () => {
      const ar = makeAr()
      ar.state.activeBranch = null
      releaseBranchOnFaqClosure(ar)
      if (ar.state.activeBranch !== null) throw new Error('activeBranch must stay null')
      if (ar.state.previousBranch !== null) {
        throw new Error(`previousBranch must stay null when nothing was sticky, got "${ar.state.previousBranch}"`)
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
