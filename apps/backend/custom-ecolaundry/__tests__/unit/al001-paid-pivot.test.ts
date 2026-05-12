// F47 — Standalone unit test (NO LLM) for the AL001 → Caso 4 pivot.
//
// PURPOSE
// =======
// Andrea, 2026-05-12 real chat:
//   usr: AL001
//   bot: ¿En qué pueblo está la lavandería?     ← Caso 5 gather
//   usr: Pineda
//   bot: ¿Es una lavadora o una secadora?
//   usr: lavadora
//   bot: ¿Cuál es el número de la máquina?
//   usr: 3
//   bot: Ese aviso suele aparecer cuando…       ← al001-sequence-error flow active
//   usr: He pagado y apretado el numero…        ← payment signal — PIVOT TRIGGER
//   bot: ¿La central te ha devuelto el cambio?  ← deterministic Caso 4 (was LLM-improvised before F47)
//   usr: si
//   bot: Vamos a revisar tu caso manualmente. ¿Cómo te llamas?   ← Caso 4.2 escalate
//
// Pre-F47: the pivot was blocked by `activeBranch !== 'trouble-machine'` in
// agent-extract.ts:458 → state.pendingFlow never became 'no-change-ask' →
// guardNoChangeYesButBroken inert → LLM improvised 2 instructions before
// escalating tardily.
//
// Post-F47: the new branch in agent-extract.ts detects
// `activeFlowId === 'al001-sequence-error'` AND `detectPaidNotActivatedIntent`
// → calls `pivotToNoChangeAsk(ar)` (atomic state transition, Iron rule #4
// compliant) → Caso 4 guards own the rest.
//
// SCOPE: pure state-level checks (the transition + the extract branch).
// Cross-guard E2E behaviour lives in __tests__/agent/05-al001-paid-pivot
// (LLM-driven, runs under test:agent only).
//
// Run with:
//   node --import tsx __tests__/unit/al001-paid-pivot.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { pivotToNoChangeAsk } from '../../utils/state-transitions.js'
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
  // ── pivotToNoChangeAsk — atomic transition ────────────────────────────
  {
    name: 'pivotToNoChangeAsk clears activeFlowId + sets pendingFlow=no-change-ask',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeStepId = 'step-1'
      ar.state.lastPresentedStepId = 'step-1'
      ar.state.pendingFlow = ''
      pivotToNoChangeAsk(ar)
      if (ar.state.activeFlowId !== null) throw new Error('activeFlowId must be null after pivot')
      if (ar.state.activeStepId !== null) throw new Error('activeStepId must be null after pivot')
      if (ar.state.lastPresentedStepId !== null) throw new Error('lastPresentedStepId must be null after pivot')
      if (ar.state.pendingFlow !== 'no-change-ask') throw new Error('pendingFlow must be no-change-ask')
    },
  },
  {
    name: 'pivotToNoChangeAsk preserves sticky customer facts (name, location, machineType, machineNumber)',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.customerName = 'Andrea'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      pivotToNoChangeAsk(ar)
      if (ar.state.customerName !== 'Andrea') throw new Error('customerName must be preserved')
      if (ar.state.location !== 'Pineda') throw new Error('location must be preserved')
      if (ar.state.machineType !== 'washer') throw new Error('machineType must be preserved')
      if (ar.state.machineNumber !== '3') throw new Error('machineNumber must be preserved')
    },
  },
  {
    name: 'pivotToNoChangeAsk clears escalation half-state inherited from the abandoned flow',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.operatorRequested = true
      ar.state.customerNameRequested = true
      ar.state.escalationReason = 'al001 stale'
      pivotToNoChangeAsk(ar)
      if (ar.state.operatorRequested !== false) throw new Error('operatorRequested must be cleared')
      if (ar.state.customerNameRequested !== false) throw new Error('customerNameRequested must be cleared')
      if (ar.state.escalationReason !== '') throw new Error('escalationReason must be cleared')
    },
  },

  // ── agent-extract.ts F47 branch — AL001 + payment signal ──────────────
  // The condition in agent-extract.ts:
  //   if (detectPaidNotActivatedIntent(msg)) {
  //     if (!pendingFlow && activeBranch !== 'trouble-machine')  → set pendingFlow (legacy path)
  //     else if (!pendingFlow && activeFlowId === 'al001-sequence-error') → pivot (F47)
  //   }
  {
    name: 'F47 — AL001 active + "He pagado…" → pendingFlow becomes no-change-ask',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'He pagado y apretado el numero de la lavadora')
      if (ar.state.pendingFlow !== 'no-change-ask') {
        throw new Error(`F47: AL001 + payment signal must pivot to no-change-ask, got "${ar.state.pendingFlow}"`)
      }
      if (ar.state.activeFlowId !== null) {
        throw new Error(`F47: pivot must clear activeFlowId, got "${ar.state.activeFlowId}"`)
      }
    },
  },
  {
    name: 'F47 — AL001 active + "He pagado…" preserves location/machine for Caso 4 gather',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'He pagado y apretado el numero')
      // The Caso 4 guards (`guardNoChangeAsk`) require these facts to emit
      // `centralReturnedChange` — losing them on pivot would force a re-gather.
      if (ar.state.location !== 'Pineda') throw new Error('location must survive the pivot')
      if (ar.state.machineType !== 'washer') throw new Error('machineType must survive the pivot')
      if (ar.state.machineNumber !== '3') throw new Error('machineNumber must survive the pivot')
    },
  },
  // Multi-language coverage of the F47 trigger (Iron rule #8).
  // detectPaidNotActivatedIntent already ships 6-lang patterns — these pins
  // assert the AL001 branch fires for each.
  {
    name: 'F47 — IT pivot: AL001 active + "ho pagato e premuto il numero"',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'ho pagato e premuto il numero ma non si attiva')
      if (ar.state.pendingFlow !== 'no-change-ask') throw new Error('IT pivot must fire')
    },
  },
  {
    name: 'F47 — EN pivot: AL001 active + "I paid and pressed the number but it didn\'t activate"',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, "I paid and the machine didn't activate")
      if (ar.state.pendingFlow !== 'no-change-ask') throw new Error('EN pivot must fire')
    },
  },

  // ── Negative cases — pivot must NOT fire when conditions don't match ───
  {
    name: 'F47 negative — Caso 3 (SEL) + "he pagado" must NOT pivot to no-change-ask',
    run: () => {
      // The pre-F47 check `activeBranch !== 'trouble-machine'` blocked Caso 3
      // pivots intentionally (display-code incidents shouldn't divert to
      // Caso 4 just because the trigger phrase overlaps). F47 preserves that
      // — only `al001-sequence-error` activates the new branch.
      const ar = makeAr()
      ar.state.activeFlowId = 'sel-select-program' // any non-AL001 display flow id
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'He pagado pero no funciona')
      if (ar.state.pendingFlow === 'no-change-ask') {
        throw new Error('F47: non-AL001 display flow must NOT pivot — would break Caso 3/SEL gather')
      }
      if (ar.state.activeFlowId !== 'sel-select-program') {
        throw new Error('F47: non-matching activeFlowId must be preserved')
      }
    },
  },
  {
    name: 'F47 negative — AL001 active + non-payment message must NOT pivot',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeBranch = 'trouble-machine'
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'No sé qué hacer')
      if (ar.state.pendingFlow === 'no-change-ask') {
        throw new Error('F47: AL001 without payment signal must stay in al001-sequence-error flow')
      }
      if (ar.state.activeFlowId !== 'al001-sequence-error') {
        throw new Error('F47: AL001 flow must persist when no payment signal')
      }
    },
  },
  {
    name: 'F47 negative — AL001 active + payment signal but pendingFlow already set → no double pivot',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.activeBranch = 'trouble-machine'
      ar.state.pendingFlow = 'discount-code-ask' // some other flow already started
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'He pagado pero no funciona')
      if (ar.state.pendingFlow !== 'discount-code-ask') {
        throw new Error('F47: pivot must respect the !pendingFlow guard — cannot stomp another active sub-flow')
      }
    },
  },
  {
    name: 'F47 legacy path — no activeFlowId, non-trouble-machine + "He pagado" → original behaviour (set pendingFlow)',
    run: () => {
      const ar = makeAr()
      ar.state.activeFlowId = null
      ar.state.activeBranch = 'greeting' // not trouble-machine
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      autoExtractFacts(ar, 'He pagado y no se ha activado')
      if (ar.state.pendingFlow !== 'no-change-ask') {
        throw new Error('F47: legacy entry (non-trouble-machine + payment) must still set pendingFlow')
      }
    },
  },
]

async function main(): Promise<void> {
  await loadTestRuntime()
  let passed = 0
  let failed = 0
  const failures: Array<{ name: string; reason: string }> = []
  for (const c of cases) {
    try {
      c.run()
      passed += 1
      console.log(`  \x1b[32m✓\x1b[0m ${c.name}`)
    } catch (err) {
      failed += 1
      const reason = err instanceof Error ? err.message : String(err)
      failures.push({ name: c.name, reason })
      console.log(`  \x1b[31m✗\x1b[0m ${c.name}\n      ${reason}`)
    }
  }
  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
