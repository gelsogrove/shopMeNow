// Standalone unit test (NO LLM) — guardPostInstructionFailure Phase C pivot.
//
// SCENARIO (TODO #5 — display change mid-flow during Phase C):
//   The customer is in DOOR flow → bot gives instruction → "no funciona" →
//   Phase B re-asks "¿qué pantalla aparece?". Two outcomes:
//
//     - SAME display ("DOOR" again)        → Phase C escalates (existing).
//     - DIFFERENT display ("SEL" instead)  → PIVOT: reset flow state, set
//                                            new displayState, return null.
//                                            Downstream pipeline routes the
//                                            new display through its proper
//                                            guard. NO escalation.
//
// This file pins the pivot path so the bot does not escalate the wrong
// flow when the customer reports a new display token after the first
// instruction failed.
//
// Run with:
//   node --import tsx __tests__/unit/post-instruction-failure-pivot.test.ts

import { guardPostInstructionFailure } from '../../utils/guards/display.js'
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
  {
    name: 'PIVOT: DOOR re-ask → customer types "SEL" → reset + set new display, no escalation',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Hortes'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '2'
      ar.state.displayState = 'DOOR'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_door'
      ar.state.lastPresentedStepId = 'case_door'
      ar.state.turnCount = 6
      ar.state.pendingFlow = 'display-reask-pending'

      const result = guardPostInstructionFailure(ar, 'SEL')

      if (result !== null) {
        throw new Error(`expected null (pivot), got reply: ${result.reply}`)
      }
      if (ar.state.displayState !== 'SEL') {
        throw new Error(`displayState must be SEL, got ${ar.state.displayState}`)
      }
      if (ar.state.pendingFlow !== '') {
        throw new Error(`pendingFlow must be cleared, got ${ar.state.pendingFlow}`)
      }
      if (ar.state.activeFlowId !== null) {
        throw new Error(`activeFlowId must be null, got ${ar.state.activeFlowId}`)
      }
      if (ar.state.activeStepId !== null) {
        throw new Error(`activeStepId must be null, got ${ar.state.activeStepId}`)
      }
      if (ar.state.operatorRequested) {
        throw new Error('operatorRequested must NOT be set on pivot')
      }
      if (ar.pendingEscalation !== null) {
        throw new Error('pendingEscalation must NOT be set on pivot')
      }
    },
  },
  {
    name: 'PIVOT: SEL re-ask → customer types "AL001" → reset + alarm code as new display',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_sel'
      ar.state.turnCount = 6
      ar.state.pendingFlow = 'display-reask-pending'

      const result = guardPostInstructionFailure(ar, 'ahora me sale AL001')

      if (result !== null) {
        throw new Error(`expected null (pivot), got reply: ${result.reply}`)
      }
      if (ar.state.displayState !== 'AL001') {
        throw new Error(`displayState must be AL001, got ${ar.state.displayState}`)
      }
      if (ar.state.pendingFlow !== '') {
        throw new Error('pendingFlow must be cleared')
      }
      if (ar.pendingEscalation !== null) {
        throw new Error('no escalation must fire on pivot')
      }
    },
  },
  {
    name: 'NO PIVOT: DOOR re-ask → customer types "DOOR" again → Phase C escalates as before',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Hortes'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '2'
      ar.state.displayState = 'DOOR'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_door'
      ar.state.lastPresentedStepId = 'case_door'
      ar.state.turnCount = 6
      ar.state.pendingFlow = 'display-reask-pending'

      const result = guardPostInstructionFailure(ar, 'DOOR')

      if (!result) throw new Error('expected escalation reply, got null')
      if (result.reason !== 'post-instruction-failure-escalate') {
        throw new Error(`expected post-instruction-failure-escalate, got ${result.reason}`)
      }
      if (!ar.state.operatorRequested) {
        throw new Error('operatorRequested must be set on Phase C escalation')
      }
      if (!ar.state.customerNameRequested) {
        throw new Error('customerNameRequested must be set on Phase C escalation')
      }
    },
  },
  {
    name: 'NO PIVOT: re-ask → ambiguous "no, no funciona" (no display token) → escalate as before',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'PUSH'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_push'
      ar.state.turnCount = 6
      ar.state.pendingFlow = 'display-reask-pending'

      const result = guardPostInstructionFailure(ar, 'no, no funciona')

      if (!result) throw new Error('expected escalation reply, got null')
      if (result.reason !== 'post-instruction-failure-escalate') {
        throw new Error(`expected post-instruction-failure-escalate, got ${result.reason}`)
      }
    },
  },
  {
    name: 'PIVOT: case-insensitive — "door" lower-case still recognised',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Hortes'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '2'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_sel'
      ar.state.turnCount = 6
      ar.state.pendingFlow = 'display-reask-pending'

      const result = guardPostInstructionFailure(ar, 'door')

      if (result !== null) throw new Error('expected pivot (null), got escalation')
      if (ar.state.displayState !== 'DOOR') {
        throw new Error(`expected canonical DOOR, got ${ar.state.displayState}`)
      }
    },
  },

  // ── Phase B detection: enforced ES failure patterns ──────────────────────
  // These tests pin the deterministic failure-pattern coverage so Phase B
  // fires consistently on common ES variants. If a new pattern is added or
  // an existing one regresses, these tests catch it.
  {
    name: 'Phase B: "no me ha funcionado" → re-ask (perfect-tense pattern)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'PUSH'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_push'
      ar.state.lastPresentedStepId = 'case_push'
      ar.state.turnCount = 6

      const result = guardPostInstructionFailure(ar, 'no me ha funcionado')

      if (!result) throw new Error('Phase B should fire on "no me ha funcionado"')
      if (result.reason !== 'post-instruction-failure-reask') {
        throw new Error(`expected reask reason, got ${result.reason}`)
      }
      if (ar.state.pendingFlow !== 'display-reask-pending') {
        throw new Error('pendingFlow should be display-reask-pending')
      }
    },
  },
  {
    name: 'Phase B: "no se ha activado" → re-ask (passive perfect)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_sel'
      ar.state.lastPresentedStepId = 'case_sel'
      ar.state.turnCount = 6

      const result = guardPostInstructionFailure(ar, 'no se ha activado')

      if (!result) throw new Error('Phase B should fire on "no se ha activado"')
      if (result.reason !== 'post-instruction-failure-reask') {
        throw new Error(`expected reask reason, got ${result.reason}`)
      }
    },
  },
  {
    name: 'Phase B: "tampoco funciona" → re-ask (alternative negation)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'DOOR'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_door'
      ar.state.lastPresentedStepId = 'case_door'
      ar.state.turnCount = 6

      const result = guardPostInstructionFailure(ar, 'tampoco funciona')

      if (!result) throw new Error('Phase B should fire on "tampoco funciona"')
    },
  },
  {
    name: 'Phase B: positive feedback "ahora sí funciona" → null (do NOT re-ask)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'PUSH'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_push'
      ar.state.lastPresentedStepId = 'case_push'
      ar.state.turnCount = 6

      const result = guardPostInstructionFailure(ar, 'ahora sí funciona')

      if (result !== null) {
        throw new Error(`positive feedback must NOT fire Phase B, got: ${result.reply}`)
      }
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
