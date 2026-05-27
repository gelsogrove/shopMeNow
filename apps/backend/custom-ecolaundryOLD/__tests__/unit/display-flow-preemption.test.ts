// Standalone unit test (NO LLM) — display-flow start + preemption contract.
//
// PURPOSE: lock down two architectural guarantees of guardDisplayFlowStart:
//
//   1. Natural-language variants of AL001 ("alarm 001", "alarma 001", "AL 001")
//      are extracted into state.displayState as the canonical "AL001", so the
//      JSON-driven flow engine recognises them as the same incident.
//
//   2. Preemption: when a different display-flow is already active and the
//      customer reports a NEW display that maps to a different documented
//      flow, the new flow takes over. The previous flow's activeFlowId is
//      replaced; the new guidance is emitted. This prevents the bot from
//      staying stuck on a stale flow when the customer corrects/updates the
//      display they see.
//
// REGRESSION CONTEXT: a customer wrote "me sale el alarm 001" → the regex
// missed the natural-language form, so state.displayState stayed empty.
// Several turns later the customer finally typed "AL001" but the bot was
// already on the SEL flow (from washer_hs60xx.json), so the AL001 guidance
// (Caso 5 — 6 steps) never fired. Bot escalated immediately instead.
//
// Run with:
//   node --import tsx __tests__/unit/display-flow-preemption.test.ts

import { extractDisplayState } from '../../utils/intent.js'
import { autoExtractFacts } from '../../utils/agent-extract.js'
import { guardDisplayFlowStart, guardDisplayFlowFollowUp } from '../../utils/guards/display-flow.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

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
  // ── extractDisplayState — natural-language AL001 variants ──────────────────
  {
    name: 'extract: "AL001" → AL001',
    run: () => assertEq(extractDisplayState('AL001'), 'AL001', 'canonical form'),
  },
  {
    name: 'extract: "AL 001" with space → AL001',
    run: () => assertEq(extractDisplayState('AL 001'), 'AL001', 'space tolerated'),
  },
  {
    name: 'extract: "ALM 001" → AL001',
    run: () => assertEq(extractDisplayState('ALM 001'), 'AL001', 'ALM prefix'),
  },
  {
    name: 'extract: "alarm 001" (English natural lang) → AL001',
    run: () => assertEq(extractDisplayState('me sale el alarm 001'), 'AL001', 'English alarm word'),
  },
  {
    name: 'extract: "alarma 001" (Spanish natural lang) → AL001',
    run: () => assertEq(extractDisplayState('me sale alarma 001'), 'AL001', 'Spanish alarma word'),
  },
  {
    name: 'extract: "ALARM 001" uppercase → AL001',
    run: () => assertEq(extractDisplayState('ALARM 001'), 'AL001', 'uppercase'),
  },
  {
    name: 'extract: "alarm" alone → null (no number)',
    run: () => assertEq(extractDisplayState('alarm'), null, 'word alone is not a code'),
  },
  {
    name: 'extract: "Alemanya" location → not AL001',
    run: () => {
      const got = extractDisplayState('Alemanya')
      // Either null or some other token — must NOT be AL001.
      assertEq(got !== 'AL001', true, `Alemanya should not match AL001 (got ${got})`)
    },
  },

  // ── autoExtractFacts pipes the natural-language form to state ────────────
  {
    name: 'extract pipeline: "me sale el alarm 001" populates state.displayState=AL001',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'washer' // shouldAcceptAsDisplay requires it
      ar.state.location = 'Mataró'
      ar.state.locationStreet = 'Calle Goya'
      ar.state.machineNumber = '4'
      autoExtractFacts(ar, 'me sale el alarm 001')
      assertEq(ar.state.displayState, 'AL001', 'state.displayState set from natural-language form')
    },
  },

  // ── Phase A: Caso 5 starts when AL001 + prerequisites ────────────────────
  {
    name: 'guardDisplayFlowStart: AL001 + location/type/number → al001-sequence-error fires',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Mataró'
      ar.state.locationStreet = 'Calle Francisco de Goya 117'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '4'
      ar.state.displayState = 'AL001'
      const outcome = guardDisplayFlowStart(ar, 'AL001')
      if (!outcome) throw new Error('expected guard to fire, got null')
      assertEq(ar.state.activeFlowId, 'al001-sequence-error', 'activeFlowId set')
      assertEq(outcome.reason, 'al001-sequence-error', 'reason matches flow id')
      // F37 (Andrea 2026-05-11) PDF-aligned: PDF §5.5 AL001 says
      // *"Aquest avís acostuma a aparèixer quan el procés no s'ha fet en l'ordre
      // correcte. T'ajudo a completar-lo. Digues-me en quin local ets i què
      // has fet just abans que aparegués."* — short ask, no 5-step sequence.
      // Previous version (audit F8-F26) emitted a 5-step educational sequence;
      // F37 removed it for strict PDF alignment.
      const reply = outcome.reply.toLowerCase()
      // Must mention the AL001 root cause hint
      if (!/orden|sequencia|secuencia|orden correcto/i.test(reply)) {
        throw new Error(`reply must mention "orden correcto": ${outcome.reply}`)
      }
      // Must invite the customer to share what they did before AL001 appeared
      if (!/qu[eé]\s+has\s+hecho|antes/i.test(reply)) {
        throw new Error(`reply must invite "qué has hecho antes": ${outcome.reply}`)
      }
    },
  },

  // ── Preemption: different active flow + new display → new flow wins ──────
  {
    name: 'preemption: SEL flow active, customer types AL001 → al001-sequence-error takes over',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Mataró'
      ar.state.locationStreet = 'Calle Francisco de Goya 117'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '4'
      // Simulate the bot already being inside a different flow (SEL guidance
      // emitted by the washer flow-engine). activeFlowId is set; activeStepId
      // is what the engine would have picked.
      ar.state.activeFlowId = 'washer_hs60xx_sel'
      ar.state.activeStepId = 'sel_1'
      // Customer now reports AL001 — extractor sets the new display.
      ar.state.displayState = 'AL001'

      const outcome = guardDisplayFlowStart(ar, 'AL001')
      if (!outcome) throw new Error('expected preemption to fire, got null')
      assertEq(ar.state.activeFlowId, 'al001-sequence-error', 'flow replaced by al001-sequence-error')
      assertEq(ar.state.activeStepId, null, 'activeStepId cleared by preemption')
      assertEq(outcome.reason, 'al001-sequence-error', 'reason matches new flow')
    },
  },

  // ── Idempotency: same flow already active → no re-fire ───────────────────
  {
    name: 'idempotency: al001-sequence-error already active → guard returns null (no double guidance)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Mataró'
      ar.state.locationStreet = 'Calle Francisco de Goya 117'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '4'
      ar.state.displayState = 'AL001'
      ar.state.activeFlowId = 'al001-sequence-error'
      const outcome = guardDisplayFlowStart(ar, 'AL001')
      assertEq(outcome, null, 'no double-fire on same flow')
    },
  },

  // ── customerName already known → guard does not run (escalation in progress) ─
  {
    name: 'guard skips when customerName is already set',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Mataró'
      ar.state.locationStreet = 'Calle Francisco de Goya 117'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '4'
      ar.state.displayState = 'AL001'
      ar.state.customerName = 'Andrea'
      const outcome = guardDisplayFlowStart(ar, 'AL001')
      assertEq(outcome, null, 'customerName gates the guard off')
    },
  },

  // ── F30 — Phase C pivot when customer reports a NEW display ───────────────
  // REGRESSION (Andrea 2026-05-10 21:58 chat): user reported AL001, bot gave
  // sequence guidance, user replied "no funcionó" → bot Phase B re-asked the
  // exact code → user typed "DOOR" (a DIFFERENT display token). Bot escalated
  // instead of pivoting to case_door. Root cause: display-flow.ts Phase C
  // unconditionally escalated regardless of new vs same code.
  {
    name: 'guardDisplayFlowFollowUp Phase C: AL001 active, re-ask reply "DOOR" → pivot (returns null) (F30)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Mataró'
      ar.state.locationStreet = 'Calle Francisco de Goya 117'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'AL001'
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.pendingFlow = 'display-reask-pending'
      const outcome = guardDisplayFlowFollowUp(ar, 'DOOR')
      // Pivot: returns null so the next pipeline pass routes the new display.
      assertEq(outcome, null, 'pivot returns null on new display token')
      assertEq(ar.state.pendingFlow, '', 'pendingFlow cleared')
      assertEq(ar.state.activeFlowId, null, 'activeFlowId cleared')
      assertEq(ar.state.displayState, 'DOOR', 'displayState updated to new code')
      assertEq(ar.state.operatorRequested, false, 'NOT escalated')
      assertEq(ar.state.customerNameRequested, false, 'NO name asked')
    },
  },
  {
    name: 'guardDisplayFlowFollowUp Phase C: AL001 active, re-ask reply confirms "AL001" → escalate (F30)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Mataró'
      ar.state.locationStreet = 'Calle Francisco de Goya 117'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'AL001'
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.pendingFlow = 'display-reask-pending'
      const outcome = guardDisplayFlowFollowUp(ar, 'AL001')
      // Same code → escalate as intended (instruction failed)
      if (!outcome) throw new Error('confirmed-same-code must escalate, not pivot')
      assertEq(outcome.reason, 'al001-sequence-error-reask-escalate', 'escalation reason')
      assertEq(ar.state.operatorRequested, true, 'escalated correctly')
    },
  },
  {
    name: 'guardDisplayFlowFollowUp Phase C: AL001 active, re-ask reply "no responde" (no display) → escalate (F30)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Mataró'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'AL001'
      ar.state.activeFlowId = 'al001-sequence-error'
      ar.state.pendingFlow = 'display-reask-pending'
      const outcome = guardDisplayFlowFollowUp(ar, 'no responde')
      if (!outcome) throw new Error('no display token in reply must escalate')
      assertEq(ar.state.operatorRequested, true, 'escalated when no new display')
    },
  },
]

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `[${label}] expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

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
