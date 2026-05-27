// Standalone unit test (NO LLM) — payment-no-change guards.
//
// SCENARIO:
//   utils/guards/payment-no-change.ts owns Caso 4 deterministic logic:
//     - guardNoChangeAsk: when pendingFlow="no-change-ask" + 3 facts
//                         known, ask "¿la central te ha devuelto el cambio?"
//     - guardNoChangeYesButBroken: when pendingFlow="no-change-await-confirm"
//                                  + customer says "yes" + still-broken signal,
//                                  escalate (uniform with Scenario 4.2).
//
// This file pins the deterministic boundary signals across 6 supported
// languages and the absence of false positives on bare yes / bare no.
//
// Run with:
//   node --import tsx __tests__/unit/payment-no-change.test.ts

import {
  guardNoChangeAsk,
  guardNoChangeNoCambio,
  guardNoChangeYesButBroken,
} from '../../utils/guards/payment-no-change.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { getCachedTestRuntime, loadTestRuntime } from './_helpers.js'

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
  // ── guardNoChangeAsk ──────────────────────────────────────────────────────
  {
    name: 'guardNoChangeAsk: requires pendingFlow="no-change-ask" + 3 facts',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '4'
      ar.state.pendingFlow = 'no-change-ask'
      const out = guardNoChangeAsk(ar, '')
      if (!out) throw new Error('guard should fire when all preconditions are met')
      if (ar.state.pendingFlow !== 'no-change-await-confirm') {
        throw new Error(`pendingFlow must transition to "no-change-await-confirm", got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'guardNoChangeAsk: skips when pendingFlow !== "no-change-ask"',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '4'
      // pendingFlow is empty
      const out = guardNoChangeAsk(ar, '')
      if (out !== null) throw new Error('guard must skip when pendingFlow is wrong')
    },
  },
  {
    name: 'guardNoChangeAsk: skips when machine facts missing',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.pendingFlow = 'no-change-ask'
      // machineType + machineNumber missing
      const out = guardNoChangeAsk(ar, '')
      if (out !== null) throw new Error('guard must wait for all 3 facts')
    },
  },

  // ── guardNoChangeYesButBroken ─────────────────────────────────────────────
  {
    name: 'yes-but-broken: "Sí, pero la máquina no arranca" → escalate (ES)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'Sí, pero la máquina no arranca')
      if (!out) throw new Error('guard must fire on "Sí + no arranca"')
      if (ar.state.pendingFlow !== '') throw new Error('pendingFlow must be cleared')
      if (ar.state.escalationReason !== 'No-change incident — cambio devuelto pero máquina no se activa') {
        throw new Error(`unexpected escalation reason: ${ar.state.escalationReason}`)
      }
    },
  },
  {
    name: 'yes-but-broken: handles accented "Sí" (no \\b ASCII issue)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      // Tests the regression where /\b/ failed after "í" (ASCII boundary).
      const out = guardNoChangeYesButBroken(ar, 'Sí, no arranca')
      if (!out) throw new Error('accented "Sí" must match the yes-affirmation')
    },
  },
  {
    name: 'F39: bare "Sí" → escalate (still-broken is implicit from trigger context)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'Sí')
      if (!out) {
        throw new Error('bare "Sí" must escalate (Caso 4.2 — central refunded, machine still broken)')
      }
      if (ar.state.pendingFlow !== '') throw new Error('pendingFlow must be cleared')
      if (!ar.state.escalationReason.includes('No-change incident')) {
        throw new Error(`unexpected escalation reason: ${ar.state.escalationReason}`)
      }
    },
  },
  {
    name: 'F39: bare "si" (lowercase) → escalate',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'si')
      if (!out) throw new Error('bare "si" lowercase must escalate (Caso 4.2)')
    },
  },
  {
    name: 'yes-but-broken: "No" → null (different branch, LLM gives retry instruction)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'No')
      if (out !== null) throw new Error('"No" must NOT trigger yes-but-broken')
    },
  },
  {
    name: 'yes-but-broken: "Sí, ahora arranca" → null (positive resolution)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'Sí, ahora arranca')
      if (out !== null) {
        throw new Error('"Sí + ahora arranca" must NOT escalate (no still-broken)')
      }
    },
  },
  {
    name: 'yes-but-broken: skipped when pendingFlow is something else',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = ''
      const out = guardNoChangeYesButBroken(ar, 'Sí, no arranca')
      if (out !== null) {
        throw new Error('guard must only fire inside no-change-await-confirm')
      }
    },
  },
  {
    name: 'yes-but-broken: IT "Sì, la lavatrice non parte" → escalate (multilingual)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, 'Sì, la lavatrice non parte')
      if (!out) throw new Error('IT "Sì + non parte" must trigger yes-but-broken')
    },
  },
  {
    name: 'yes-but-broken: EN "Yes, the washer doesn\'t start" → escalate (multilingual)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeYesButBroken(ar, "Yes, the washer doesn't start")
      if (!out) throw new Error('EN "Yes + doesn\'t start" must trigger yes-but-broken')
    },
  },

  // ── guardNoChangeNoCambio ────────────────────────────────────────────────
  {
    name: 'no-cambio: bare "No" → retry instruction + transition to await-confirmation',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeNoCambio(ar, 'No')
      if (!out) throw new Error('bare "No" must fire the retry-instruction guard')
      if (ar.state.pendingFlow !== 'no-change-await-confirmation') {
        throw new Error(`pendingFlow must transition to "no-change-await-confirmation", got "${ar.state.pendingFlow}"`)
      }
    },
  },
  {
    name: 'no-cambio: "no me ha devuelto" → retry instruction (long phrasing ES)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeNoCambio(ar, 'No me ha devuelto')
      if (!out) throw new Error('"No me ha devuelto" must fire the retry-instruction guard')
    },
  },
  {
    name: 'no-cambio: "ningún cambio" → retry instruction',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeNoCambio(ar, 'Ningún cambio')
      if (!out) throw new Error('"Ningún cambio" must fire the retry-instruction guard')
    },
  },
  {
    name: 'no-cambio: IT "non" → retry instruction (multilingual)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeNoCambio(ar, 'Non')
      if (!out) throw new Error('IT "Non" must fire the retry-instruction guard')
    },
  },
  {
    name: 'no-cambio: "Sí" → null (different branch — yes goes elsewhere)',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = 'no-change-await-confirm'
      const out = guardNoChangeNoCambio(ar, 'Sí')
      if (out !== null) throw new Error('"Sí" must NOT trigger no-cambio')
    },
  },
  {
    name: 'no-cambio: skipped when pendingFlow is something else',
    run: () => {
      const ar = makeAr()
      ar.state.pendingFlow = ''
      const out = guardNoChangeNoCambio(ar, 'No')
      if (out !== null) throw new Error('guard must only fire inside no-change-await-confirm')
    },
  },
]

async function main(): Promise<void> {
  await loadTestRuntime()
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
}

main()
