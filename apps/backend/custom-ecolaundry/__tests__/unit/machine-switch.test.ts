// Standalone unit test (NO LLM) — machine switch within the same session.
//
// SCENARIO: customer is at Goya, finished sorting out the washer, now reports
// a problem on the DRYER. We must:
//   1. Update machineType/machineNumber/displayState to the NEW machine.
//   2. Preserve location and customerName (same person, same laundry).
//
// Equivalent scenario: customer is on washer #5, but realizes they meant
// washer #7 → machineNumber must update from 5 to 7.
//
// Run with:
//   node --import tsx __tests__/unit/machine-switch.test.ts

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
    name: 'washer→dryer switch after washer resolved: facts updated, location preserved',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.customerName = 'Andrea'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'
      ar.state.pendingClosure = 'resolved'
      ar.state.turnCount = 6

      autoExtractFacts(ar, 'ahora la secadora 7 no funciona')

      assertEq(ar.state.machineType, 'dryer', 'machineType updated to dryer')
      assertEq(ar.state.machineNumber, '7', 'machineNumber updated to 7')
      assertEq(ar.state.displayState, '', 'old displayState wiped (no new code)')
      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.customerName, 'Andrea', 'customerName preserved')
    },
  },
  {
    name: 'first turn — customer mentions machineType + number directly',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1

      autoExtractFacts(ar, 'no me funciona la secadora 3')

      assertEq(ar.state.machineType, 'dryer', 'machineType extracted')
      assertEq(ar.state.machineNumber, '3', 'machineNumber extracted')
    },
  },
  {
    name: 'first turn — typo on machine type ("lavaroda 5") still extracts both facts',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1

      autoExtractFacts(ar, 'la lavaroda 5 no funciona')

      assertEq(ar.state.machineType, 'washer', 'machineType extracted via fuzzy')
      assertEq(ar.state.machineNumber, '5', 'machineNumber extracted')
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
