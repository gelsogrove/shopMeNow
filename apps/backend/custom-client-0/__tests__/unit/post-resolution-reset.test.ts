// Standalone unit test (NO LLM) for the post-resolution reset bug.
//
// SCENARIO (reproduced from a real CLI session reported by Andrea):
//   1. Customer reports "no funciona la lavadora"
//   2. Bot gathers location=Goya, machineType=washer, machineNumber=5,
//      displayState=SEL → flow runs → customer says "si funciona" → resolved.
//   3. Customer immediately reports a NEW incident on the dryer:
//      "ora me da push prog il display e non funciona la secadora"
//   4. The bot WAS re-asking "¿Dónde está la lavandería?" because stale
//      machine facts (machineType, machineNumber, displayState, activeFlowId)
//      from the resolved case were polluting the context.
//
// FIX (what this test exercises):
//   `autoExtractFacts` now wipes machine facts (preserving location /
//   customerName / language) when either:
//     (a) `pendingClosure === 'resolved'`, or
//     (b) the customer reports a NEW incident AND the previous case had
//         complete machine facts AND no flow is currently active.
//
// Run with:
//   node --import tsx __tests__/unit/post-resolution-reset.test.ts

import { autoExtractFacts } from '../../utils/agent-extract.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'

// Minimal AgentRuntime shim — autoExtractFacts only reads `ar.state` and
// writes `ar.resolved`, so a real `runtime` is not needed.
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
  {
    name: 'pendingClosure=resolved + new message → wipes machine facts, preserves location',
    run: () => {
      const ar = makeAr()
      // Pre-condition: previous case has been resolved, machine facts populated.
      ar.state.location = 'Goya'
      ar.state.customerName = 'Andrea'
      ar.state.language = 'es'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'
      ar.state.paymentCompleted = true
      ar.state.pendingClosure = 'resolved'
      ar.resolved = true

      // Customer sends a new (unrelated-looking) message.
      autoExtractFacts(ar, 'gracias')

      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.customerName, 'Andrea', 'customerName preserved')
      assertEq(ar.state.language, 'es', 'language preserved')
      assertEq(ar.state.machineType, '', 'machineType wiped')
      assertEq(ar.state.machineNumber, '', 'machineNumber wiped')
      assertEq(ar.state.displayState, '', 'displayState wiped')
      assertEq(ar.state.paymentCompleted, null, 'paymentCompleted wiped')
      assertEq(ar.state.pendingClosure, null, 'pendingClosure cleared')
      assertEq(ar.resolved, false, 'ar.resolved cleared')
    },
  },
  {
    name: 'new incident regex match (push prog dryer) after completed case → wipes facts',
    run: () => {
      const ar = makeAr()
      // Pre-condition: previous case resolved IMPLICITLY (LLM wrote
      // "Perfecto, incidencia resuelta" without firing mark_resolved, so
      // pendingClosure stays null but activeFlowId/pendingFlow are clear).
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = null
      ar.state.pendingFlow = ''

      autoExtractFacts(ar, 'ora me da push prog il display e non funciona la secadora')

      // After reset, the extractor re-runs on the same message and pulls in
      // fresh facts:
      //   - "secadora"  → machineType=dryer
      //   - "push prog" → displayState=PUSH
      // The OLD washer/5/SEL are gone (reset wiped them) and only the NEW
      // incident's facts survive. machineNumber stays empty because the
      // message has no number. That is exactly the desired behaviour.
      assertEq(ar.state.location, 'Goya', 'location preserved on heuristic reset')
      assertEq(ar.state.machineType, 'dryer', 'machineType updated to NEW incident (dryer)')
      assertEq(ar.state.machineNumber, '', 'old machineNumber wiped (no new number in msg)')
      assertEq(ar.state.displayState, 'PUSH', 'displayState updated to NEW incident (PUSH)')
    },
  },
  {
    name: 'new incident keywords (no funciona) but no previous facts → does NOT reset',
    run: () => {
      const ar = makeAr()
      // First-message scenario: customer just opened the chat, no prior
      // machine facts. The heuristic must NOT misfire here.
      ar.state.location = ''
      ar.state.machineType = ''
      ar.state.machineNumber = ''
      ar.state.displayState = ''

      autoExtractFacts(ar, 'no funciona la lavadora')

      // location may now be set if the message contained one (it doesn't
      // here), but no spurious resets should have fired.
      assertEq(ar.state.machineType, 'washer', 'machineType extracted from "lavadora"')
    },
  },
  {
    name: 'active flow in progress (activeFlowId set) → does NOT reset even if incident keyword present',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_sel'

      // Customer mid-flow says "no funciona" again — must NOT wipe state,
      // the flow engine handles it via retry logic.
      autoExtractFacts(ar, 'no funciona')

      assertEq(ar.state.machineType, 'washer', 'machineType preserved (flow still active)')
      assertEq(ar.state.machineNumber, '5', 'machineNumber preserved (flow still active)')
      assertEq(ar.state.activeFlowId, 'non_parte', 'activeFlowId preserved')
    },
  },
]

// ── Tiny assertion helper ────────────────────────────────────────────────────

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `[${label}] expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

// ── Runner ───────────────────────────────────────────────────────────────────

let passed = 0
let failed = 0
const failures: Array<{ name: string; reason: string }> = []

for (const c of cases) {
  try {
    c.run()
    passed += 1
    console.log(`\x1b[32m  ✓\x1b[0m ${c.name}`)
  } catch (err) {
    failed += 1
    const reason = err instanceof Error ? err.message : String(err)
    failures.push({ name: c.name, reason })
    console.log(`\x1b[31m  ✗\x1b[0m ${c.name}\n      ${reason}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed (out of ${cases.length})\n`)
if (failed > 0) {
  process.exit(1)
}
