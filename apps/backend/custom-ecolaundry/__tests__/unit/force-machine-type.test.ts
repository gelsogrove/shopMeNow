// Standalone unit test (NO LLM) — guardForceMachineType single-step contract.
//
// SCENARIO (Andrea's rule — every step is its own question):
//   The canonical question order from agent.txt enumerates type and number
//   as TWO separate steps (Step 2 = type, Step 3 = number). This guard
//   always asks ONLY the type ("¿lavadora o secadora?"); the number is
//   asked on the next turn by guardForceMachineNumber. Caso 32 (customer
//   volunteers the number) still works because autoExtractFacts populates
//   machineNumber BEFORE the guard runs — when both extracted in the same
//   turn, no guard fires; when only the number is volunteered, this guard
//   asks only the type with no awkward re-ask of the number.
//
// CONTRACT pinned by this test:
//   A) location set, type+number BOTH missing → asks ONLY the type;
//      reason = "force-machine-type", reply uses i18n key `machineType`.
//   B) location set, type missing, number ALREADY in state (extracted in a
//      previous turn or in this very turn by autoExtract) → same behaviour:
//      reply uses the type-only key `machineType`; reason = "force-machine-type".
//   C) Pre-conditions still apply: never fires before turnCount >= 2,
//      never fires when displayState is set, never fires inside a sub-flow.
//
// Run with:
//   node --import tsx __tests__/unit/force-machine-type.test.ts

import { guardForceMachineType } from '../../utils/guards/location.js'
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
    name: 'A) location only, type+number BOTH missing → asks ONLY the type (no combined ask)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.turnCount = 2

      const out = guardForceMachineType(ar, 'Pineda')
      if (!out) throw new Error('expected guard to fire, got null')
      if (out.reason !== 'force-machine-type') {
        throw new Error(`expected reason "force-machine-type", got "${out.reason}"`)
      }
      // ES base catalogue: must include "lavadora/secadora" but NOT "número".
      const reply = out.reply.toLowerCase()
      if (!reply.includes('lavadora') || !reply.includes('secadora')) {
        throw new Error(`reply missing type tokens: ${out.reply}`)
      }
      if (reply.includes('número')) {
        throw new Error(`type-only reply must not ask for the number, got: ${out.reply}`)
      }
    },
  },
  {
    name: 'B) location set, number set, type missing → type-only ask',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.machineNumber = '3'
      ar.state.turnCount = 3

      const out = guardForceMachineType(ar, 'whatever')
      if (!out) throw new Error('expected guard to fire, got null')
      if (out.reason !== 'force-machine-type') {
        throw new Error(`expected reason "force-machine-type", got "${out.reason}"`)
      }
      const reply = out.reply.toLowerCase()
      if (!reply.includes('lavadora') || !reply.includes('secadora')) {
        throw new Error(`reply missing type tokens: ${out.reply}`)
      }
      // The single-ask key MUST NOT include the number question.
      if (reply.includes('número')) {
        throw new Error(`type-only reply must not ask for the number, got: ${out.reply}`)
      }
    },
  },
  {
    name: 'C1) does not fire on turn 1 (welcome turn)',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.turnCount = 1

      const out = guardForceMachineType(ar, 'Pineda')
      if (out) throw new Error(`expected null on turn 1, got: ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'C2) does not fire when displayState is already set',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.displayState = 'PUSH'
      ar.state.turnCount = 3

      const out = guardForceMachineType(ar, 'whatever')
      if (out) throw new Error(`expected null when display set, got: ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'C3) does not fire inside an active sub-flow',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.activeFlowId = 'non_parte'
      ar.state.turnCount = 3

      const out = guardForceMachineType(ar, 'whatever')
      if (out) throw new Error(`expected null inside sub-flow, got: ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'C4) does not fire when machineType is already set',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.machineType = 'washer'
      ar.state.turnCount = 3

      const out = guardForceMachineType(ar, 'whatever')
      if (out) throw new Error(`expected null when type set, got: ${JSON.stringify(out)}`)
    },
  },
  {
    name: 'C5) does not fire when nonTroubleshootingIncident is flagged',
    run: () => {
      const ar = makeAr()
      ar.state.location = 'Pineda'
      ar.state.nonTroubleshootingIncident = 'datafono-wrong-amount'
      ar.state.turnCount = 3

      const out = guardForceMachineType(ar, 'whatever')
      if (out) throw new Error(`expected null on non-troubleshooting incident, got: ${JSON.stringify(out)}`)
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
