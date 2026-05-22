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
    name: 'PUSH PROG: reply contains 4-program list in bold + descriptions + loopback (F40)',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'PUSH'
      const out = guardAutoStartMachineFlow(ar, '')
      if (!out) throw new Error('expected reply')
      const reply = out.reply
      // F40 (Andrea 2026-05-11) — REVERSE of F37: usecases.md ahora exige
      // mostrar los 4 programas con descripciones y números en bold.
      // "Desviación documentada respecto al Playbook PDF" — el cliente
      // necesita información explícita en chat (no puede leer ambient
      // signage), prioridad UX sobre alignment estricto al PDF.
      if (!/pulsa.*programa/i.test(reply)) {
        throw new Error(`reply must ask the customer to press a program: ${reply}`)
      }
      // F40 positive assertions: 4 programs present (bold numbers OR bold names)
      // F81 NOTE: when locations.json has metadata.programs for the location,
      // buildPushProgList injects a dynamic list in format "**N** — Name (temp)".
      // The hardcoded list in washer_hs60xx.json uses "**60º** Name" format.
      // Either format must contain all 4 temperature references.
      if (!/60[°º]/i.test(reply)) throw new Error('F40: missing 60º temperature')
      if (!/40[°º]/i.test(reply)) throw new Error('F40: missing 40º temperature')
      if (!/30[°º]/i.test(reply)) throw new Error('F40: missing 30º temperature')
      if (!/frí[o]/i.test(reply) && !/frio/i.test(reply)) throw new Error('F40/F41: missing Frío / FRÍO')
      if (!/muy caliente|caliente|templado|suave|delicad/i.test(reply)) {
        throw new Error(`F40: missing program name descriptions: ${reply}`)
      }
      if (!/comenzado\s+a\s+funcionar|arrancad|funcion/i.test(reply)) {
        throw new Error(`reply must close with a loopback question: ${reply}`)
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
