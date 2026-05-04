// Standalone unit test (NO LLM) — autoExtractFacts contract.
//
// PURPOSE: pin down the contract of the deterministic extractor:
//   - Multi-fact extraction in a single message (R5)
//   - Idempotency: applying the extractor twice on the same message
//     yields the same state (R4)
//   - Sticky preservation: location / customerName / language are
//     immutable once set (R1)
//   - Display state always updates if a new code is present
//   - First-mention semantics: machineType/machineNumber stick once set,
//     are not overwritten by intent guesses (R2 — intent is LLM)
//
// Run with:
//   node --import tsx __tests__/unit/extract-facts.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'

function makeAr(): AgentRuntime {
  return {
    state: createInitialState(),
    runtime: {} as never,
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
  // ── R5: Multi-fact extraction ───────────────────────────────────────────
  {
    name: 'R5: single message with multiple facts → all extracted',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1
      autoExtractFacts(ar, 'estoy en Goya con la lavadora 5 y aparece SEL')

      assertEq(ar.state.location, 'Goya', 'location extracted')
      assertEq(ar.state.machineType, 'washer', 'machineType extracted')
      assertEq(ar.state.machineNumber, '5', 'machineNumber extracted')
      assertEq(ar.state.displayState, 'SEL', 'displayState extracted')
    },
  },
  {
    name: 'R5: italian multi-fact ("a Goya con la lavatrice 7 SEL")',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1
      autoExtractFacts(ar, 'sono a Goya con la lavatrice 7 e mi appare SEL')

      assertEq(ar.state.location, 'Goya', 'location from IT')
      assertEq(ar.state.machineType, 'washer', 'machineType from "lavatrice"')
      assertEq(ar.state.machineNumber, '7', 'machineNumber from IT')
      assertEq(ar.state.displayState, 'SEL', 'displayState from IT')
    },
  },

  // ── R4: Idempotency ─────────────────────────────────────────────────────
  {
    name: 'R4: applying the extractor twice on same message → same state',
    run: () => {
      const ar = makeAr()
      ar.state.turnCount = 1

      autoExtractFacts(ar, 'lavadora 5 a Goya con SEL')
      const snapshot1 = JSON.stringify({
        loc: ar.state.location,
        mt: ar.state.machineType,
        mn: ar.state.machineNumber,
        ds: ar.state.displayState,
      })

      autoExtractFacts(ar, 'lavadora 5 a Goya con SEL')
      const snapshot2 = JSON.stringify({
        loc: ar.state.location,
        mt: ar.state.machineType,
        mn: ar.state.machineNumber,
        ds: ar.state.displayState,
      })

      assertEq(snapshot1, snapshot2, 'state unchanged after re-extract')
    },
  },

  // ── R1: Sticky preservation ─────────────────────────────────────────────
  {
    name: 'R1: location is immutable once set (a second location name does NOT overwrite)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'

      // Customer message later mentions Pineda — location must not change.
      // (Real machine switching across laundries is not a flow we support;
      // the customer is in ONE laundry per session. If they truly mean a
      // different one, the LLM gathers the correction explicitly.)
      autoExtractFacts(ar, 'no funciona la lavadora en Pineda')

      assertEq(ar.state.location, 'Goya', 'location preserved')
    },
  },
  {
    name: 'R1: customerName preserved across extractions',
    run: () => {
      const ar = makeAr()
      ar.state.customerName = 'Andrea'
      ar.state.location = 'Goya'

      autoExtractFacts(ar, 'la secadora 3 no calienta')

      assertEq(ar.state.customerName, 'Andrea', 'customerName preserved')
      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.machineType, 'dryer', 'new machineType extracted')
      assertEq(ar.state.machineNumber, '3', 'new machineNumber extracted')
    },
  },

  // ── displayState updates on every new code ──────────────────────────────
  {
    name: 'displayState updates when a NEW code is in the message',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'

      autoExtractFacts(ar, 'ahora me dice DOOR')

      assertEq(ar.state.displayState, 'DOOR', 'displayState updated SEL → DOOR')
    },
  },
  {
    name: 'displayState stays put when message has no display code',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'

      autoExtractFacts(ar, 'sigue sin funcionar')

      assertEq(ar.state.displayState, 'SEL', 'displayState unchanged')
    },
  },

  // ── machineType/machineNumber: first-mention sticky ─────────────────────
  {
    name: 'machineType is set on first mention; subsequent mentions do not overwrite',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'

      // The customer says "secadora" later in the conversation. The
      // extractor does NOT guess this is a switch — that intent decision
      // belongs to the LLM, which calls mark_resolved + set_machine_facts.
      autoExtractFacts(ar, 'la secadora también no anda')

      assertEq(ar.state.machineType, 'washer', 'machineType not overwritten by extractor')
      assertEq(ar.state.machineNumber, '5', 'machineNumber not overwritten')
    },
  },

  // ── Empty / whitespace input ────────────────────────────────────────────
  {
    name: 'empty / whitespace input → no-op, state unchanged',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'

      autoExtractFacts(ar, '   ')
      autoExtractFacts(ar, '')

      assertEq(ar.state.location, 'Goya', 'no change on empty input')
      assertEq(ar.state.machineType, 'washer', 'no change on whitespace')
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
