// Unit test — guardPostInstructionFailure display-change detection
//
// ROOT CAUSE (bug fixed here):
//   autoExtractFacts runs BEFORE the guard pipeline. When the customer reports
//   a NEW display code (e.g. "SEL" after a PUSH flow), autoExtractFacts already
//   updates state.displayState to the new value. Phase C then compares:
//     newDisplay = extractDisplayState(msg)  → "SEL"
//     currentDisplay = state.displayState    → "SEL"  ← already overwritten!
//   They match, so PIVOT does not fire → wrongly escalates.
//
// FIX: Phase B saves state.displayState into state.displayReaskPrevCode.
//      Phase C compares newDisplay against displayReaskPrevCode (the value
//      BEFORE autoExtractFacts overwrote it), which correctly detects the change.
//
// PATTERNS TESTED:
//   A — PUSH flow fails → re-ask → user says "SEL" → PIVOT (give SEL guidance)
//   B — SEL flow fails  → re-ask → user says "SEL"  → ESCALATE (code unchanged)
//   C — PUSH flow fails → re-ask → user says "PUSH" → ESCALATE (code unchanged)
//   D — PUSH flow fails → re-ask → user says "DOOR"  → PIVOT (new code)

import { guardPostInstructionFailure } from '../../utils/guards/display.js'
import { createInitialState } from '../../utils/state.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'
import type { AgentRuntime } from '../../models/index.js'

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

function setupPhaseB(ar: AgentRuntime, displayState: string): void {
  ar.state.location = 'Goya'
  ar.state.machineType = 'washer'
  ar.state.machineNumber = '4'
  ar.state.displayState = displayState
  ar.state.activeFlowId = 'non_parte'
  ar.state.turnCount = 6
  // Simulate Phase B firing: pendingFlow = 'display-reask-pending',
  // displayReaskPrevCode saved by the guard.
  ar.state.displayReaskPrevCode = displayState
  ar.state.pendingFlow = 'display-reask-pending'
  ar.state.activeFlowId = null // Phase B clears this on escalation path — only needed for hasShownInstruction
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    // PATTERN A — user was in PUSH flow, machine still shows SEL after failure re-ask.
    // autoExtractFacts updates state.displayState to "SEL" before guards run.
    // Phase C must detect the change via displayReaskPrevCode ("PUSH") and PIVOT.
    name: 'A: PUSH→SEL on re-ask: PIVOT fires (no escalation)',
    run: () => {
      const ar = makeAr()
      setupPhaseB(ar, 'PUSH')
      // Simulate autoExtractFacts having updated displayState already
      ar.state.displayState = 'SEL'

      const outcome = guardPostInstructionFailure(ar, 'SEL')

      // PIVOT: returns null so pipeline can route SEL to case_sel
      if (outcome !== null) {
        throw new Error(`Expected null (PIVOT), got: ${JSON.stringify(outcome)}`)
      }
      if (ar.state.operatorRequested) {
        throw new Error('PIVOT must NOT set operatorRequested')
      }
      if (ar.state.displayState !== 'SEL') {
        throw new Error(`displayState must be "SEL" after PIVOT, got "${ar.state.displayState}"`)
      }
      if (ar.state.displayReaskPrevCode !== '') {
        throw new Error('displayReaskPrevCode must be cleared after Phase C')
      }
    },
  },
  {
    // PATTERN B — user was in SEL flow, machine STILL shows SEL (no change).
    // autoExtractFacts keeps displayState as "SEL". Phase C must escalate.
    name: 'B: SEL→SEL on re-ask: ESCALATE fires',
    run: () => {
      const ar = makeAr()
      setupPhaseB(ar, 'SEL')
      // autoExtractFacts leaves displayState = "SEL" (no change)
      ar.state.displayState = 'SEL'

      const outcome = guardPostInstructionFailure(ar, 'SEL')

      if (outcome === null) {
        throw new Error('Expected escalation outcome, got null')
      }
      if (!ar.state.operatorRequested) {
        throw new Error('operatorRequested must be true after escalation')
      }
      if (ar.state.displayReaskPrevCode !== '') {
        throw new Error('displayReaskPrevCode must be cleared after Phase C')
      }
    },
  },
  {
    // PATTERN C — user was in PUSH flow, machine STILL shows PUSH.
    // autoExtractFacts keeps displayState = "PUSH". Phase C must escalate.
    name: 'C: PUSH→PUSH on re-ask: ESCALATE fires',
    run: () => {
      const ar = makeAr()
      setupPhaseB(ar, 'PUSH')
      ar.state.displayState = 'PUSH'

      const outcome = guardPostInstructionFailure(ar, 'PUSH PROG')

      if (outcome === null) {
        throw new Error('Expected escalation outcome, got null')
      }
      if (!ar.state.operatorRequested) {
        throw new Error('operatorRequested must be true after escalation')
      }
    },
  },
  {
    // PATTERN D — user was in PUSH flow, now shows DOOR.
    // autoExtractFacts updates displayState to "DOOR". PIVOT must fire.
    name: 'D: PUSH→DOOR on re-ask: PIVOT fires (no escalation)',
    run: () => {
      const ar = makeAr()
      setupPhaseB(ar, 'PUSH')
      ar.state.displayState = 'DOOR'

      const outcome = guardPostInstructionFailure(ar, 'DOOR')

      if (outcome !== null) {
        throw new Error(`Expected null (PIVOT), got: ${JSON.stringify(outcome)}`)
      }
      if (ar.state.operatorRequested) {
        throw new Error('PIVOT must NOT set operatorRequested')
      }
      if (ar.state.displayState !== 'DOOR') {
        throw new Error(`displayState must be "DOOR" after PIVOT, got "${ar.state.displayState}"`)
      }
    },
  },
  {
    // PATTERN E — Phase B correctly saves displayReaskPrevCode
    name: 'E: Phase B saves displayReaskPrevCode = current displayState',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '4'
      ar.state.displayState = 'PUSH'
      ar.state.activeFlowId = 'non_parte'
      ar.state.turnCount = 6

      guardPostInstructionFailure(ar, 'no funciona')

      if (ar.state.displayReaskPrevCode !== 'PUSH') {
        throw new Error(
          `Phase B must save displayReaskPrevCode="PUSH", got "${ar.state.displayReaskPrevCode}"`,
        )
      }
      if (ar.state.pendingFlow !== 'display-reask-pending') {
        throw new Error(`pendingFlow must be "display-reask-pending", got "${ar.state.pendingFlow}"`)
      }
    },
  },
]

function assertPass(name: string): void {
  console.log(`\x1b[32m  ✓\x1b[0m ${name}`)
}
function assertFail(name: string, reason: string): void {
  console.log(`\x1b[31m  ✗\x1b[0m ${name}\n      ${reason}`)
}

async function main(): Promise<void> {
  await loadTestRuntime()
  let passed = 0
  let failed = 0

  for (const c of cases) {
    try {
      c.run()
      passed++
      assertPass(c.name)
    } catch (err) {
      failed++
      assertFail(c.name, err instanceof Error ? err.message : String(err))
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
  if (failed > 0) process.exit(1)
}

main()
