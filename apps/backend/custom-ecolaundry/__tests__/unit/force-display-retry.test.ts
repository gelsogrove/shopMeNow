// Standalone unit test (NO LLM) — guardForceDisplay retry counter +
// escalation path for unrecognised display codes.
//
// SCENARIO (Andrea, 2026-05-09):
//   The customer types a typo or free text that doesn't match any known
//   display code (e.g. "USH PROG" with missing P, "asdf", "no sé"). Today
//   `extractDisplayState`'s fuzzy fallback catches the most common typos,
//   but truly unrecognised input ends up with `state.displayState` empty.
//   Without retry+escalate, the bot either loops on "qué aparece en la
//   pantalla" forever or hands off to the LLM for improvisation.
//
//   The retry path is:
//     1st miss (counter == 0)  → ask "qué aparece en la pantalla"
//     2nd miss (counter == 1)  → re-ask politely with i18n key
//                                `displayUnrecognizedReask`
//     3rd miss (counter >= 2)  → escalate; bot asks the customer name and
//                                hands off to a human operator.
//
// Run with:
//   node --import tsx __tests__/unit/force-display-retry.test.ts

import { guardForceDisplay } from '../../utils/guards/force-gather.js'
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
  // Gather complete except display: location + type + number set.
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
    name: 'attempt 1 (counter=0) → asks display via canonical "displayShort", increments counter',
    run: () => {
      const ar = makeAr()
      const out = guardForceDisplay(ar, '')
      if (!out) throw new Error('guard must fire on first attempt')
      if (out.reason !== 'force-display') {
        throw new Error(`expected reason "force-display", got "${out.reason}"`)
      }
      if (ar.state.displayAskAttempts !== 1) {
        throw new Error(`counter must be 1 after first ask, got ${ar.state.displayAskAttempts}`)
      }
    },
  },
  {
    name: 'attempt 2 (counter=1) → re-asks politely with "displayUnrecognizedReask", increments counter',
    run: () => {
      const ar = makeAr()
      ar.state.displayAskAttempts = 1
      const out = guardForceDisplay(ar, '')
      if (!out) throw new Error('guard must fire on second attempt')
      if (out.reason !== 'display-unrecognized-reask') {
        throw new Error(`expected reason "display-unrecognized-reask", got "${out.reason}"`)
      }
      // Reply must contain the "no reconozco" wording (ES base catalogue).
      if (!/no reconozco/i.test(out.reply)) {
        throw new Error(`reply must contain "no reconozco": ${out.reply}`)
      }
      if (ar.state.displayAskAttempts !== 2) {
        throw new Error(`counter must be 2 after second ask, got ${ar.state.displayAskAttempts}`)
      }
    },
  },
  {
    name: 'attempt 3 (counter=2) → escalates with reaffirmEscalate + asks customer name',
    run: () => {
      const ar = makeAr()
      ar.state.displayAskAttempts = 2
      const out = guardForceDisplay(ar, '')
      if (!out) throw new Error('guard must escalate on third attempt')
      if (out.reason !== 'display-unrecognized-escalate') {
        throw new Error(`expected reason "display-unrecognized-escalate", got "${out.reason}"`)
      }
      if (!ar.state.operatorRequested) {
        throw new Error('operatorRequested must be set on escalation')
      }
      if (!ar.state.customerNameRequested) {
        throw new Error('customerNameRequested must be set so the bot asks the name')
      }
      if (ar.state.displayAskAttempts !== 0) {
        throw new Error(`counter must reset to 0 on escalation, got ${ar.state.displayAskAttempts}`)
      }
    },
  },
  {
    name: 'precondition: location empty → null (forceLocation handles it earlier)',
    run: () => {
      const ar = makeAr()
      ar.state.location = ''
      const out = guardForceDisplay(ar, '')
      if (out !== null) throw new Error('must skip when location is missing')
    },
  },
  {
    name: 'precondition: displayState already set → null (no need to ask)',
    run: () => {
      const ar = makeAr()
      ar.state.displayState = 'PUSH'
      const out = guardForceDisplay(ar, '')
      if (out !== null) throw new Error('must skip when display already captured')
    },
  },
  {
    name: 'precondition: nonTroubleshootingIncident set → null (different flow)',
    run: () => {
      const ar = makeAr()
      ar.state.nonTroubleshootingIncident = 'datafono-wrong-amount'
      const out = guardForceDisplay(ar, '')
      if (out !== null) throw new Error('must skip on non-troubleshooting incident')
    },
  },
  {
    name: 'precondition: customerNameRequested already set → null (escalation in progress)',
    run: () => {
      const ar = makeAr()
      ar.state.customerNameRequested = true
      const out = guardForceDisplay(ar, '')
      if (out !== null) throw new Error('must skip while name capture is pending')
    },
  },
  {
    name: 'full sequence: 0 → 1 → 2 → escalate (counter advances correctly across calls)',
    run: () => {
      const ar = makeAr()
      // Attempt 1
      const r1 = guardForceDisplay(ar, '')
      if (r1?.reason !== 'force-display') throw new Error('1st must be force-display')
      // Attempt 2
      const r2 = guardForceDisplay(ar, '')
      if (r2?.reason !== 'display-unrecognized-reask') {
        throw new Error('2nd must be display-unrecognized-reask')
      }
      // Attempt 3 (escalate)
      const r3 = guardForceDisplay(ar, '')
      if (r3?.reason !== 'display-unrecognized-escalate') {
        throw new Error('3rd must be display-unrecognized-escalate')
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
