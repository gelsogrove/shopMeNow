// Standalone unit test (NO LLM) — display-change mid-flow.
//
// SCENARIO (real CLI session reported by Andrea):
//   1. Customer is mid-flow: location=Goya, washer #5, displayState=SEL,
//      activeFlowId=non_parte, activeStepId=case_sel.
//   2. Bot has just given the canonical SEL answer ("comprueba el número").
//   3. Customer replies "No, ahora me dice PUSH PROG".
//      → This is PROGRESS (display advanced from SEL to PUSH), NOT failure.
//   4. Bot must NOT escalate. It must update state.displayState to "PUSH"
//      and let the next stage answer with the canonical PUSH instruction.
//
// CURRENT BUG: today the flow engine treats this as "PUSH persists" and
// routes to case_push_persist (terminal escalation). This test proves the
// extractor must catch the new display BEFORE the flow engine sees the
// "no" classification.
//
// Run with:
//   node --import tsx __tests__/unit/display-change-mid-flow.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
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
    name: 'SEL→PUSH mid-flow: extractor updates displayState, preserves other facts',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_sel'
      ar.state.turnCount = 5

      autoExtractFacts(ar, 'No, ahora me dice PUSH PROG')

      assertEq(ar.state.displayState, 'PUSH', 'displayState updated SEL → PUSH')
      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.machineType, 'washer', 'machineType preserved')
      assertEq(ar.state.machineNumber, '5', 'machineNumber preserved')
      assertEq(ar.pendingEscalation, null, 'no escalation pending')
    },
  },
  {
    name: 'SEL→DOOR mid-flow: same rule applies',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '3'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_sel'
      ar.state.turnCount = 5

      autoExtractFacts(ar, 'ahora me dice DOOR')

      assertEq(ar.state.displayState, 'DOOR', 'displayState updated SEL → DOOR')
      assertEq(ar.state.location, 'Pineda', 'location preserved')
      assertEq(ar.pendingEscalation, null, 'no escalation pending')
    },
  },
  {
    name: 'SEL repeated (no change): displayState stays SEL — flow engine handles persist',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_sel'
      ar.state.turnCount = 5

      // Customer says "no" without naming a different display — same SEL still showing.
      autoExtractFacts(ar, 'no, sigue igual')

      assertEq(ar.state.displayState, 'SEL', 'displayState unchanged (no new code in msg)')
      // Note: escalation in this case is legitimate and handled by the flow
      // engine + guards, not by the extractor. We only assert the extractor
      // did not LIE about the display.
    },
  },
  {
    name: 'PUSH→AL001 mid-flow: alarm code recognized as new displayState',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'PUSH'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_push'
      ar.state.turnCount = 6

      autoExtractFacts(ar, 'ahora me sale AL001')

      assertEq(ar.state.displayState, 'AL001', 'displayState updated to alarm code')
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
