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
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

// AgentRuntime built from real JSON-backed config (no LLM stack), so the
// extractor's regex-driven detectors can run as in production.
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
    name: 'no pendingClosure: machine facts NEVER reset by the extractor (intent is LLM job)',
    run: () => {
      const ar = makeAr()
      // Pre-condition: state has machine facts but pendingClosure is NOT
      // 'resolved'. The extractor must NOT guess "is this a new incident"
      // from the message — that decision belongs to the LLM, which expresses
      // it via mark_resolved (which sets pendingClosure='resolved').
      ar.state.location = 'Goya'
      ar.state.machineType = 'washer'
      ar.state.machineNumber = '5'
      ar.state.displayState = 'SEL'
      ar.state.pendingClosure = null

      // A message that LOOKS like a new incident — but until the LLM marks
      // the previous one resolved, the extractor stays out of intent.
      autoExtractFacts(ar, 'no funciona la secadora')

      // Sticky facts unchanged: machineType stays washer (the extractor
      // is idempotent — only fills empty slots), machineNumber stays 5,
      // displayState stays SEL. The LLM, looking at this state on the
      // next turn, will call mark_resolved on the previous case and
      // set_machine_facts for the new one.
      assertEq(ar.state.location, 'Goya', 'location preserved')
      assertEq(ar.state.machineType, 'washer', 'machineType not overwritten')
      assertEq(ar.state.machineNumber, '5', 'machineNumber not overwritten')
      assertEq(ar.state.displayState, 'SEL', 'displayState not overwritten')
    },
  },
  {
    name: 'first message extracts facts even if it sounds like a "new incident" phrase',
    run: () => {
      const ar = makeAr()
      // Empty state — first turn. Phrases like "no funciona la lavadora"
      // are NOT special markers, just normal first-message content. The
      // extractor must do its job: pull machineType from the message.
      autoExtractFacts(ar, 'no funciona la lavadora')

      assertEq(ar.state.machineType, 'washer', 'machineType extracted on first turn')
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

async function main(): Promise<void> {
  await loadTestRuntime()
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
}

main()
