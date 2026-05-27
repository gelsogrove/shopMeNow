// Standalone unit test (NO LLM) — Phase B pivot in guardPostInstructionFailure.
//
// SCENARIO (Andrea, 2026-05-09 marathon Caso 32.1):
//   The customer is mid-flow with displayState=SEL after the bot gave the
//   SEL instruction. They reply "No, ahora aparece PUSH PROG" — a SINGLE
//   message containing BOTH a failure signal ("No") AND a new display token
//   ("PUSH PROG"). Today the guard fires Phase B (re-ask displayShort),
//   ignoring the new display. With this fix the guard pivots: it lets the
//   pipeline route to the new display's flow on the next pass, mirroring
//   what Phase C already does on the second turn.
//
// SHAPE OF THE FIX:
//   At start-of-turn agent.ts snapshots `state.displayStateAtTurnStart`.
//   autoExtractFacts then updates `state.displayState` to the new code.
//   guardPostInstructionFailure (Phase B) early-exits when:
//     - displayState is set (recognised display)
//     - displayState !== displayStateAtTurnStart (CHANGED in this turn)
//     - displayStateAtTurnStart !== '' (was set BEFORE this turn — i.e.
//       this is a real change, not the first capture)
//   On pivot the guard clears pendingFlow/activeFlowId/activeStepId/
//   lastPresentedStepId so the next pipeline pass routes the new display.
//
// Run with:
//   node --import tsx __tests__/unit/display-pivot-phase-b.test.ts

import { guardPostInstructionFailure } from '../../utils/guards/display.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

function makeAr(): AgentRuntime {
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  // Mid-flow: SEL instruction was given on previous turn.
  ar.state.location = 'Goya'
  ar.state.machineType = 'washer'
  ar.state.machineNumber = '5'
  ar.state.activeFlowId = 'non_parte'
  ar.state.activeStepId = 'case_sel'
  ar.state.lastPresentedStepId = 'case_sel'
  ar.state.turnCount = 5
  return ar
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    // PIVOT path: customer volunteered a new display together with "no".
    // turnStart=SEL (saved by agent.ts before autoExtract), displayState=PUSH
    // (updated by autoExtract). Phase B detects the change and returns null,
    // clearing flow markers so the next pipeline pass can route PUSH.
    name: 'pivot: SEL → PUSH with "No, ahora aparece PUSH PROG" → guard returns null + clears flow markers',
    run: () => {
      const ar = makeAr()
      // Simulate agent.ts snapshot + autoExtract sequence:
      ar.state.displayStateAtTurnStart = 'SEL' // before autoExtract
      ar.state.displayState = 'PUSH'           // after autoExtract recognised PUSH PROG

      const result = guardPostInstructionFailure(ar, 'No, ahora aparece PUSH PROG')

      assertEq(result, null, 'guard returns null (pivot, no re-ask emitted)')
      assertEq(ar.state.pendingFlow, '', 'pendingFlow cleared')
      assertEq(ar.state.activeFlowId, null, 'activeFlowId cleared')
      assertEq(ar.state.activeStepId, null, 'activeStepId cleared')
      assertEq(ar.state.lastPresentedStepId, null, 'lastPresentedStepId cleared')
      // displayState stays PUSH for the next pipeline pass
      assertEq(ar.state.displayState, 'PUSH', 'displayState preserved for re-route')
    },
  },
  {
    // PRESERVED Phase B re-ask: customer says "no responde" without naming a
    // new display. autoExtract didn't change displayState (no token in msg).
    // Phase B fires as before: saves displayReaskPrevCode and emits displayShort.
    name: 'preserved: "no responde" without new display → guard re-asks (existing Phase B path)',
    run: () => {
      const ar = makeAr()
      // No new display — turnStart and displayState match.
      ar.state.displayStateAtTurnStart = 'SEL'
      ar.state.displayState = 'SEL'

      const result = guardPostInstructionFailure(ar, 'no responde')

      assertNotNull(result, 'guard fires (does not pivot)')
      assertEq(result!.reason, 'post-instruction-failure-reask', 'Phase B re-ask emitted')
      assertEq(ar.state.displayReaskPrevCode, 'SEL', 'prev code saved for Phase C')
      assertEq(ar.state.pendingFlow, 'display-reask-pending', 'pendingFlow set to reask')
    },
  },
  {
    // PIVOT must NOT fire on initial capture: turnStart was '' (first time
    // the display is being recognised), so even though `displayState !==
    // turnStart`, this is not a "change" — it's the first capture. The
    // pivot guard requires `turnStart !== ''`, so it does NOT short-circuit
    // and the rest of Phase B runs normally (re-ask emitted).
    name: 'no-pivot on initial capture: turnStart empty → guard does NOT short-circuit, Phase B re-asks',
    run: () => {
      const ar = makeAr()
      // Active instruction shown (via fallback: 5+ turns + facts known).
      ar.state.activeFlowId = null
      ar.state.activeStepId = null
      ar.state.lastPresentedStepId = null
      ar.state.turnCount = 5
      // Critical: turnStart is empty (this is the first display capture).
      ar.state.displayStateAtTurnStart = ''
      ar.state.displayState = 'PUSH'

      const result = guardPostInstructionFailure(ar, 'No, PUSH PROG')

      // Pivot would have returned null + cleared flow markers. Instead we
      // expect Phase B to fire normally (the "No" matches /^(no|nada)\b/).
      assertNotNull(result, 'guard fires Phase B (pivot must NOT short-circuit on initial capture)')
      assertEq(result!.reason, 'post-instruction-failure-reask', 'Phase B re-ask emitted, not pivot')
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

function assertNotNull<T>(value: T | null, label: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(`[${label}] expected non-null, got ${JSON.stringify(value)}`)
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
