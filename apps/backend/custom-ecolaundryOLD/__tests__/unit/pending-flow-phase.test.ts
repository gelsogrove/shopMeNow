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
  '"no-change-ask" → not awaiting (still gathering)',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'no-change-ask' }) === false,
)
check(
  '"discount-code-ask" → not awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'discount-code-ask' }) === false,
)

// -await- phase → LLM is interpreting
check(
  '"no-change-await-confirm" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'no-change-await-confirm' }) === true,
)
check(
  '"no-change-await-confirmation" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'no-change-await-confirmation' }) === true,
)
check(
  '"discount-code-await-name" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'discount-code-await-name' }) === true,
)
check(
  '"paid-not-used-await-display" → awaiting',
  isAwaitingPendingFlow({ ...createInitialState(), pendingFlow: 'paid-not-used-await-display' }) === true,
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
  notInActiveSubFlow(makeAr({ activeFlowId: 'al001-sequence-error' })) === false,
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
  'pendingFlow=no-change-ask → guards may fire (still gathering)',
  notInActiveSubFlow(makeAr({ pendingFlow: 'no-change-ask' })) === true,
)

// pendingFlow await-phase BLOCKS (LLM has the floor)
check(
  'pendingFlow=no-change-await-confirm → guards stop (LLM is interpreting)',
  notInActiveSubFlow(makeAr({ pendingFlow: 'no-change-await-confirm' })) === false,
)
check(
  'pendingFlow=paid-not-used-await-display → guards stop',
  notInActiveSubFlow(makeAr({ pendingFlow: 'paid-not-used-await-display' })) === false,
)

// display-reask-pending does NOT block gather guards (intentional: at Phase C
// all facts are already known, so gather guards won't fire regardless).
check(
  'pendingFlow=display-reask-pending → guards may fire (all facts already set at this point)',
  notInActiveSubFlow(makeAr({ pendingFlow: 'display-reask-pending' })) === true,
)

console.log(`\n${pass} passed, ${fail} failed (out of ${pass + fail})`)
if (fail > 0) process.exit(1)
