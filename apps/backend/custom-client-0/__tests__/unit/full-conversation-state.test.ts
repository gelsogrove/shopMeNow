// Standalone unit test (NO LLM) — full multi-turn conversation state.
//
// PURPOSE: simulate realistic CLI dialogs by feeding messages through
// `autoExtractFacts` turn by turn, and assert that sticky state evolves
// correctly across the entire conversation. This catches regressions
// that single-message tests miss (e.g. state pollution across turns,
// missed re-extraction of facts after a switch).
//
// All assertions test STATE only — the actual LLM reply is irrelevant
// here, we only care that when the LLM is invoked, sticky facts are
// correct.
//
// Run with:
//   node --import tsx __tests__/unit/full-conversation-state.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime, SessionState } from '../../models/index.js'

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: {} as never,
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

/**
 * Simulate a single customer turn: increment turnCount, run the extractor.
 * The LLM/guards layer is stubbed — we only verify the deterministic
 * state machinery works correctly turn after turn.
 */
function customerTurn(ar: AgentRuntime, msg: string): void {
  ar.state.turnCount += 1
  autoExtractFacts(ar, msg)
}

/** Mimic what the flow engine does on a terminal-success node. */
function flowResolved(state: SessionState): void {
  state.activeFlowId = null
  state.activeStepId = null
  state.pendingClosure = 'resolved'
}

/** Mimic the LLM setting an active flow after gathering all facts. */
function flowStarted(state: SessionState, flowId: string, stepId: string): void {
  state.activeFlowId = flowId
  state.activeStepId = stepId
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1 — Display advances 3 times in a row (SEL → DOOR → PUSH)
  // This is the exact CLI scenario Andrea just verified manually.
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'TEST 1 — SEL → DOOR → PUSH: 3 consecutive display advances',
    run: () => {
      const ar = makeAr()

      // Turn 1: customer reports the problem
      customerTurn(ar, 'no me funciona la lavadora')
      assertEq(ar.state.machineType, 'washer', 'T1: washer extracted')

      // Turn 2: location
      customerTurn(ar, 'Goya')
      assertEq(ar.state.location, 'Goya', 'T2: location=Goya')

      // Turn 3: number
      customerTurn(ar, '5')
      assertEq(ar.state.machineNumber, '5', 'T3: machineNumber=5')

      // Turn 4: first display
      customerTurn(ar, 'SEL')
      assertEq(ar.state.displayState, 'SEL', 'T4: displayState=SEL')
      flowStarted(ar.state, 'non_parte', 'case_sel')

      // Turn 5: display advances to DOOR
      customerTurn(ar, 'ahora me dice DOOR')
      assertEq(ar.state.displayState, 'DOOR', 'T5: displayState updated SEL→DOOR')
      assertEq(ar.state.machineNumber, '5', 'T5: machineNumber preserved')
      assertEq(ar.state.location, 'Goya', 'T5: location preserved')
      assertEq(ar.pendingEscalation, null, 'T5: NO escalation triggered')

      // Turn 6: display advances to PUSH
      customerTurn(ar, 'aun no me dice push prog')
      assertEq(ar.state.displayState, 'PUSH', 'T6: displayState updated DOOR→PUSH')
      assertEq(ar.state.machineNumber, '5', 'T6: machineNumber preserved')
      assertEq(ar.pendingEscalation, null, 'T6: NO escalation triggered')
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2 — Resolved washer, then customer reports new dryer problem
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'TEST 2 — Washer resolved, customer switches to dryer (same laundry)',
    run: () => {
      const ar = makeAr()

      // Setup: washer #5 SEL flow completed successfully
      customerTurn(ar, 'no me funciona la lavadora')
      customerTurn(ar, 'Goya')
      customerTurn(ar, '5')
      customerTurn(ar, 'SEL')
      flowStarted(ar.state, 'non_parte', 'case_sel')

      // Bot gave canonical answer, customer confirms it works
      flowResolved(ar.state)

      // NEW PROBLEM on the dryer
      customerTurn(ar, 'ahora la secadora 7 no calienta')

      assertEq(ar.state.location, 'Goya', 'location preserved across resolution')
      assertEq(ar.state.machineType, 'dryer', 'machineType switched to dryer')
      assertEq(ar.state.machineNumber, '7', 'machineNumber switched to 7')
      assertEq(ar.state.displayState, '', 'old SEL displayState wiped')
      assertEq(ar.state.activeFlowId, null, 'old flow cleared')
      assertEq(ar.state.pendingClosure, null, 'pendingClosure consumed')
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3 — Typo on machineType in first message
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'TEST 3 — Typo "lavaroda" recognized as washer on turn 1',
    run: () => {
      const ar = makeAr()

      customerTurn(ar, 'non me funciona la lavaroda')

      assertEq(ar.state.machineType, 'washer', 'fuzzy match recognized "lavaroda"')
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4 — FAQ tangent mid-flow does NOT clear flow state
  // (the extractor should leave activeFlowId untouched on a FAQ-like msg)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'TEST 4 — FAQ tangent mid-flow ("y los horarios?") preserves flow state',
    run: () => {
      const ar = makeAr()

      customerTurn(ar, 'no me funciona la lavadora')
      customerTurn(ar, 'Goya')
      customerTurn(ar, '5')
      customerTurn(ar, 'SEL')
      flowStarted(ar.state, 'non_parte', 'case_sel')

      // Customer asks a tangential FAQ — extractor must not clobber state
      customerTurn(ar, 'y los horarios?')

      assertEq(ar.state.activeFlowId, 'non_parte', 'activeFlowId preserved during FAQ tangent')
      assertEq(ar.state.activeStepId, 'case_sel', 'activeStepId preserved')
      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.machineType, 'washer', 'machineType preserved')
      assertEq(ar.state.machineNumber, '5', 'machineNumber preserved')
      assertEq(ar.state.displayState, 'SEL', 'displayState preserved')
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5 — Cross-language input still extracts facts (extractor is
  // language-agnostic; LLM handles the reply language separately)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'TEST 5 — Italian message "non parte la lavatrice 3" extracts facts',
    run: () => {
      const ar = makeAr()

      customerTurn(ar, 'non parte la lavatrice 3')
      assertEq(ar.state.machineType, 'washer', 'IT lavatrice → washer')
      assertEq(ar.state.machineNumber, '3', 'machineNumber=3 from IT message')
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6 — Display change after a documented alarm (PUSH → AL001)
  // Should still update; the extractor doesn't escalate, the prompt does.
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: 'TEST 6 — PUSH → AL001 alarm: extractor accepts new alarm code',
    run: () => {
      const ar = makeAr()

      customerTurn(ar, 'no me funciona la lavadora')
      customerTurn(ar, 'Goya')
      customerTurn(ar, '5')
      customerTurn(ar, 'PUSH PROG')
      assertEq(ar.state.displayState, 'PUSH', 'initial PUSH')

      customerTurn(ar, 'ahora me sale AL001')
      assertEq(ar.state.displayState, 'AL001', 'displayState updated to alarm')
      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.machineNumber, '5', 'machineNumber preserved')
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
