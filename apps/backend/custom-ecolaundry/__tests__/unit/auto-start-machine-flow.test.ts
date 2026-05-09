// Standalone unit test (NO LLM) — guardAutoStartMachineFlow.
//
// SCENARIO: regression for the bug where the LLM, after gathering
// location + machineType + machineNumber + displayState=PUSH, wrote a
// paraphrased one-liner ("pulsa un botón: 1) 60° muy sucia, 2) 40°...")
// instead of the canonical multi-paragraph instruction with bold
// programs and a separate loopback line. Root cause: the LLM was
// supposed to call `start_machine_flow` but skipped it.
//
// This guard runs deterministically after the gather is complete,
// invokes `startFlow`, and emits the canonical `case_push` /
// `case_sel` / `case_door` prompt verbatim. The LLM never gets to
// improvise.
//
// Run with:
//   node --import tsx __tests__/unit/auto-start-machine-flow.test.ts

import { guardAutoStartMachineFlow } from '../../utils/guards/auto-start-machine-flow.js'
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
  // All gather facts populated; only the flow start is missing.
  ar.state.location = 'Goya'
  ar.state.machineType = 'washer'
  ar.state.machineNumber = '5'
  ar.state.turnCount = 4
  return ar
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'PUSH PROG: gather complete → starts non_parte/case_push',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'PUSH'
      const out = guardAutoStartMachineFlow(ar, '')
      if (!out) throw new Error('expected canonical PUSH prompt, got null')
      if (ar.state.activeFlowId !== 'non_parte') {
        throw new Error(`activeFlowId must be non_parte, got ${ar.state.activeFlowId}`)
      }
      if (ar.state.activeStepId !== 'case_push') {
        throw new Error(`activeStepId must be case_push, got ${ar.state.activeStepId}`)
      }
    },
  },
  {
    name: 'PUSH PROG: reply contains canonical 4 programs (bold) + loopback paragraph',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'PUSH'
      const out = guardAutoStartMachineFlow(ar, '')
      if (!out) throw new Error('expected reply')
      const reply = out.reply
      // Bold programs (markdown)
      if (!/\*\*60º\*\*/.test(reply)) throw new Error('reply must contain **60º** in bold')
      if (!/\*\*40º\*\*/.test(reply)) throw new Error('reply must contain **40º**')
      if (!/\*\*30º\*\*/.test(reply)) throw new Error('reply must contain **30º**')
      if (!/\*\*Frío\*\*/.test(reply)) throw new Error('reply must contain **Frío**')
      // No legacy "1." numbering
      if (/^1\.\s+60/m.test(reply)) {
        throw new Error('reply must NOT use "1. 60º" — use **60º** bold instead')
      }
      // Paragraph break before the loopback line
      if (!/Elige uno y púlsalo en la máquina\.\n\nDespués dime/.test(reply)) {
        throw new Error('reply must have \\n\\n between "Elige uno..." and "Después dime..."')
      }
    },
  },
  {
    name: 'SEL: gather complete → starts non_parte/case_sel',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'SEL'
      const out = guardAutoStartMachineFlow(ar, '')
      if (!out) throw new Error('expected canonical SEL prompt')
      if (ar.state.activeStepId !== 'case_sel') {
        throw new Error(`activeStepId must be case_sel, got ${ar.state.activeStepId}`)
      }
    },
  },
  {
    name: 'DOOR: gather complete → starts non_parte/case_door',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'DOOR'
      const out = guardAutoStartMachineFlow(ar, '')
      if (!out) throw new Error('expected canonical DOOR prompt')
      if (ar.state.activeStepId !== 'case_door') {
        throw new Error(`activeStepId must be case_door, got ${ar.state.activeStepId}`)
      }
    },
  },
  {
    name: 'no displayState → null (gather not complete)',
    run: () => {
      const ar = makeAr()
      // displayState left empty
      const out = guardAutoStartMachineFlow(ar, '')
      if (out !== null) throw new Error('must skip when displayState is empty')
    },
  },
  {
    name: 'no location → null (location is mandatory)',
    run: () => {
      const ar = makeAr()
      ar.state.location = ''
      ar.state.displayState = 'PUSH'
      const out = guardAutoStartMachineFlow(ar, '')
      if (out !== null) throw new Error('must skip when location is empty')
    },
  },
  {
    name: 'flow already active → null (do not re-start)',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'PUSH'
      ar.state.activeFlowId = 'non_parte'
      ar.state.activeStepId = 'case_push'
      const out = guardAutoStartMachineFlow(ar, '')
      if (out !== null) throw new Error('must skip when a flow is already active')
    },
  },
  {
    name: 'unknown display (ERR 52) → null (let escalate-unknown-display handle it)',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'ERR 52'
      const out = guardAutoStartMachineFlow(ar, '')
      if (out !== null) {
        throw new Error('non-recoverable displays escalate via guardEscalateUnknownDisplay, not via auto-start')
      }
    },
  },
  {
    name: 'customerNameRequested → null (escalation in progress)',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'PUSH'
      ar.state.customerNameRequested = true
      const out = guardAutoStartMachineFlow(ar, '')
      if (out !== null) throw new Error('must NOT auto-start while name capture is pending')
    },
  },
  {
    name: 'nonTroubleshootingIncident set → null (different flow, not machine-driven)',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'PUSH'
      ar.state.nonTroubleshootingIncident = 'datafono-wrong-amount'
      const out = guardAutoStartMachineFlow(ar, '')
      if (out !== null) throw new Error('must NOT override a non-troubleshooting incident')
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
