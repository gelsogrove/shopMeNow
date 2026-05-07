// Standalone unit test (NO LLM) for the pendingFlow ask-vs-await convention.
// Pins the contract of `isAwaitingPendingFlow` and `notInActiveSubFlow`,
// which decide whether gather guards may preempt the LLM.
//
// Run: node --import tsx __tests__/unit/pending-flow-phase.test.ts

import { isAwaitingPendingFlow, notInActiveSubFlow } from '../../utils/guards/helpers.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime, SessionState } from '../../models/index.js'

let pass = 0
let fail = 0

function check(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ✓ ${label}`)
    pass += 1
  } else {
    console.log(`  ✗ ${label}`)
    fail += 1
  }
}

function makeAr(stateOverrides: Partial<SessionState> = {}): AgentRuntime {
  return {
    state: { ...createInitialState(), ...stateOverrides },
    runtime: {} as never,
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
}

console.log('isAwaitingPendingFlow')

// -ask- phase → still gathering, NOT awaiting
check('"" → not awaiting', isAwaitingPendingFlow(createInitialState()) === false)
check(
  '"caso4-ask-cambio" → not awaiting (still gathering)',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'caso4-ask-cambio' }) === false,
)
check(
  '"caso8-ask-code" → not awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'caso8-ask-code' }) === false,
)

// -await- phase → LLM is interpreting
check(
  '"caso4-await-cambio" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'caso4-await-cambio' }) === true,
)
check(
  '"caso4-await-confirmation" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'caso4-await-confirmation' }) === true,
)
check(
  '"caso8-await-name" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'caso8-await-name' }) === true,
)
check(
  '"caso7-await-display" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'caso7-await-display' }) === true,
)

console.log('\nnotInActiveSubFlow')

// Idle session
check(
  'fresh session → guards may fire',
  notInActiveSubFlow(makeAr()) === true,
)

// activeFlowId blocks
check(
  'activeFlowId set → guards stop',
  notInActiveSubFlow(makeAr({ activeFlowId: 'caso5-al001' })) === false,
)

// operatorRequested blocks
check(
  'operatorRequested → guards stop',
  notInActiveSubFlow(makeAr({ operatorRequested: true })) === false,
)

// customerNameRequested blocks
check(
  'customerNameRequested → guards stop',
  notInActiveSubFlow(makeAr({ customerNameRequested: true })) === false,
)

// pendingFlow ask-phase does NOT block (gathering may proceed)
check(
  'pendingFlow=caso4-ask-cambio → guards may fire (still gathering)',
  notInActiveSubFlow(makeAr({ pendingFlow: 'caso4-ask-cambio' })) === true,
)

// pendingFlow await-phase BLOCKS (LLM has the floor)
check(
  'pendingFlow=caso4-await-cambio → guards stop (LLM is interpreting)',
  notInActiveSubFlow(makeAr({ pendingFlow: 'caso4-await-cambio' })) === false,
)
check(
  'pendingFlow=caso7-await-display → guards stop',
  notInActiveSubFlow(makeAr({ pendingFlow: 'caso7-await-display' })) === false,
)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
