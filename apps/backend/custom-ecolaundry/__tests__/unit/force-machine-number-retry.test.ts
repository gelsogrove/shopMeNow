// Standalone unit test (NO LLM) — guardForceMachineNumber retry counter +
// escalation path when the customer can't / won't give a machine number.
//
// SCENARIO (Andrea, 2026-05-09):
//   Real chat from production:
//     bot: "¿Es una lavadora o una secadora?"
//     usr: "lavadora"
//     bot: "¿Cuál es el número de la lavadora?"
//     usr: "auh no lo he selecioda"   ← typo for "aún no lo he seleccionado"
//     bot: "¿Cuál es el número de la lavadora?"  ← LOOP, no recovery
//     usr: "no la he selecionada"
//     bot: "¿Cuál es el número de la lavadora?"  ← still looping
//
//   The customer is signalling "I don't have a number yet". The bot must:
//     1. detect the boundary signal (utils/intent.ts:detectIDontKnowReply)
//     2. break out of the canonical re-ask via the guard's retry counter
//     3. give a guidance message ("the number is stuck on the machine
//        itself, usually above or next to the screen — can you check?")
//     4. escalate to a human operator after 3 strikes
//
//   This test pins step 2 → 4 of the architectural fix. The detector
//   coverage lives in `__tests__/unit/intent.test.ts:detectIDontKnowReply`.
//
//   Architectural pattern (rule #10 corollary): every gather step has a
//   retry+escalate ladder mirroring guardForceDisplay. The counter lives
//   on `state.machineNumberAskAttempts` and is reset by `resetMachineFacts`
//   when the customer eventually provides a number.
//
// Run with:
//   node --import tsx __tests__/unit/force-machine-number-retry.test.ts

import { guardForceMachineNumber } from '../../utils/guards/force-gather.js'
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
  // Gather complete except machineNumber: location + type set.
  ar.state.location = 'Goya'
  ar.state.machineType = 'washer'
  ar.state.turnCount = 4
  return ar
}

interface Case {
  name: string
  run: () => void
}

const cases: Case[] = [
  {
    name: 'attempt 1 (counter=0) → asks number via canonical "machineNumberWasher", increments counter',
    run: () => {
      const ar = makeAr()
      const out = guardForceMachineNumber(ar, '')
      if (!out) throw new Error('guard must fire on first attempt')
      if (out.reason !== 'force-machine-number') {
        throw new Error(`expected reason "force-machine-number", got "${out.reason}"`)
      }
      if (ar.state.machineNumberAskAttempts !== 1) {
        throw new Error(
          `counter must be 1 after first ask, got ${ar.state.machineNumberAskAttempts}`,
        )
      }
    },
  },
  {
    name: 'attempt 1 with dryer → asks "machineNumberDryer" (type-aware)',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = 'dryer'
      const out = guardForceMachineNumber(ar, '')
      if (!out) throw new Error('guard must fire on first attempt')
      // Reply must mention "secadora" (ES dryer wording).
      if (!/secadora/i.test(out.reply)) {
        throw new Error(`reply must mention "secadora" for dryer: ${out.reply}`)
      }
    },
  },
  {
    name: 'attempt 2 (counter=1) → re-asks with guidance "machineNumberRetry", increments counter',
    run: () => {
      const ar = makeAr()
      ar.state.machineNumberAskAttempts = 1
      const out = guardForceMachineNumber(ar, '')
      if (!out) throw new Error('guard must fire on second attempt')
      if (out.reason !== 'machine-number-unrecognized-reask') {
        throw new Error(
          `expected reason "machine-number-unrecognized-reask", got "${out.reason}"`,
        )
      }
      // F37 (Andrea 2026-05-11) PDF-aligned: the "pegado en la propia
      // máquina, al lado de la pantalla" hint was an invented detail not
      // present in the PDF Playbook §5.4. Reverted to the strict PDF wording
      // ("¿Podrías comprobar el número de la máquina y decírmelo?"). The
      // assertion now only checks that the reply re-asks the number.
      if (!/comprobar.*n[uú]mero|n[uú]mero.*m[áa]quina/i.test(out.reply)) {
        throw new Error(
          `reply must re-ask the machine number: ${out.reply}`,
        )
      }
      if (ar.state.machineNumberAskAttempts !== 2) {
        throw new Error(
          `counter must be 2 after second ask, got ${ar.state.machineNumberAskAttempts}`,
        )
      }
    },
  },
  {
    name: 'attempt 3 (counter=2) → escalates with reaffirmEscalate + asks customer name + resets counter',
    run: () => {
      const ar = makeAr()
      ar.state.machineNumberAskAttempts = 2
      const out = guardForceMachineNumber(ar, '')
      if (!out) throw new Error('guard must escalate on third attempt')
      if (out.reason !== 'machine-number-unrecognized-escalate') {
        throw new Error(
          `expected reason "machine-number-unrecognized-escalate", got "${out.reason}"`,
        )
      }
      if (!ar.state.operatorRequested) {
        throw new Error('operatorRequested must be set on escalation')
      }
      if (!ar.state.customerNameRequested) {
        throw new Error('customerNameRequested must be set so the bot asks the name')
      }
      if (ar.state.machineNumberAskAttempts !== 0) {
        throw new Error(
          `counter must reset to 0 on escalation, got ${ar.state.machineNumberAskAttempts}`,
        )
      }
    },
  },
  {
    name: 'precondition: location empty → null (forceLocation handles it earlier)',
    run: () => {
      const ar = makeAr()
      ar.state.location = ''
      const out = guardForceMachineNumber(ar, '')
      if (out !== null) throw new Error('must skip when location is missing')
    },
  },
  {
    name: 'precondition: machineType empty → null (forceMachineType asks first)',
    run: () => {
      const ar = makeAr()
      ar.state.machineType = null
      const out = guardForceMachineNumber(ar, '')
      if (out !== null) throw new Error('must skip when machineType is missing')
    },
  },
  {
    name: 'precondition: machineNumber already set → null (no need to ask)',
    run: () => {
      const ar = makeAr()
      ar.state.machineNumber = '5'
      const out = guardForceMachineNumber(ar, '')
      if (out !== null) throw new Error('must skip when machineNumber already captured')
    },
  },
  {
    name: 'precondition: nonTroubleshootingIncident set → null (different flow)',
    run: () => {
      const ar = makeAr()
      ar.state.nonTroubleshootingIncident = 'datafono-wrong-amount'
      const out = guardForceMachineNumber(ar, '')
      if (out !== null) throw new Error('must skip on non-troubleshooting incident')
    },
  },
  {
    name: 'precondition: customerNameRequested already set → null (escalation in progress)',
    run: () => {
      const ar = makeAr()
      ar.state.customerNameRequested = true
      const out = guardForceMachineNumber(ar, '')
      if (out !== null) throw new Error('must skip while name capture is pending')
    },
  },
  {
    name: 'full sequence: 0 → 1 → 2 → escalate (counter advances correctly across calls)',
    run: () => {
      const ar = makeAr()
      const r1 = guardForceMachineNumber(ar, '')
      if (r1?.reason !== 'force-machine-number') {
        throw new Error('1st must be force-machine-number')
      }
      const r2 = guardForceMachineNumber(ar, '')
      if (r2?.reason !== 'machine-number-unrecognized-reask') {
        throw new Error('2nd must be machine-number-unrecognized-reask')
      }
      const r3 = guardForceMachineNumber(ar, '')
      if (r3?.reason !== 'machine-number-unrecognized-escalate') {
        throw new Error('3rd must be machine-number-unrecognized-escalate')
      }
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
