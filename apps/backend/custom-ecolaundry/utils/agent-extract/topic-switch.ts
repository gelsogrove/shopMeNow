// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Iron rule #4 alignment: this file mutates state.nonTroubleshootingIncident
// and state.location. Those fields are NOT in rule #4's protected set, which
// per check-architecture.sh covers exactly: pendingClosure, operatorRequested,
// pendingEscalation, customerNameRequested, escalationReason. The mutations
// below are the same ones present in the source utils/agent-extract.ts —
// moved verbatim. resetPostEscalationFlags is the named transition for the
// rule #4 fields, called via state-transitions.ts as required.
//
// Step 3 of autoExtractFacts: topic-switch reset + runtime topic-switch
// detection. Two independent triggers:
//   1. Pending escalation OR resetable narrow flow + topic-switch detector
//   2. Runtime nlu-pattern topic switch (Bug #13.6 / MIX 1)

import type { AgentRuntime } from '../../models/index.js'
import {
  detectDoubleChargeIntent,
  detectDiscountCodeIntent,
  detectTopicSwitchDuringEscalation,
  extractDisplayState,
  extractExplicitLocation,
} from '../intent.js'
import { resolveKnownLocation, resolveKnownLocationFuzzy } from '../message-parsing.js'
import { matchPattern } from '../nlu.js'
import { resetMachineFacts } from '../state.js'
import { resetPostEscalationFlags } from '../state-transitions.js'
import { detectTopicSwitch } from './helpers.js'

// pendingFlow values from which a customer pivot is legitimate (narrow
// non-machine flows that block the rest of the pipeline on a strict answer).
const FLOWS_RESETABLE_ON_TOPIC_SWITCH = new Set<string>([
  'discount-code-await',
  'discount-code-await-name',
  'discount-code-await-location',
  'discount-code-await-machine',
  'discount-code-await-door',
  'numeric-code-ask-letters',
  'numeric-code-await-answer',
])

export function extractTopicSwitch(
  ar: AgentRuntime,
  trimmed: string,
  userMessage: string,
): void {
  const state = ar.state

  const inResetableFlow = FLOWS_RESETABLE_ON_TOPIC_SWITCH.has(state.pendingFlow)
  const inPendingEscalation =
    state.operatorRequested && state.customerNameRequested
  // While awaiting the customer's name, a display code like "PUSH PROG" is
  // NOT a topic switch — the customer is just repeating what they see.
  const isNameAwaitTopicSwitch =
    inPendingEscalation &&
    !detectDoubleChargeIntent(trimmed) &&
    !detectDiscountCodeIntent(trimmed) &&
    extractDisplayState(trimmed) !== null
  if (
    !isNameAwaitTopicSwitch &&
    (inPendingEscalation || inResetableFlow) &&
    detectTopicSwitchDuringEscalation(trimmed)
  ) {
    resetPostEscalationFlags(ar)
    resetMachineFacts(state)
  }

  // Runtime nlu-pattern topic switch — resets stale machine facts and tags
  // the new nonTroubleshootingIncident kind.
  if (detectTopicSwitch(ar.runtime, state, userMessage)) {
    resetMachineFacts(state)
    if (matchPattern(ar.runtime, 'topicPayment', userMessage)) {
      state.nonTroubleshootingIncident = 'datafono-wrong-amount'
    } else if (matchPattern(ar.runtime, 'topicOps', userMessage)) {
      state.nonTroubleshootingIncident = 'cameras-or-ajax'
    } else if (matchPattern(ar.runtime, 'topicDryerMinutes', userMessage)) {
      state.nonTroubleshootingIncident = 'dryer-minutes-not-credited'
    } else if (matchPattern(ar.runtime, 'topicCardFail', userMessage)) {
      state.nonTroubleshootingIncident = 'card-payment'
    }
    // Allow location override on topic switch.
    const explicitNew = extractExplicitLocation(trimmed)
    if (explicitNew) {
      const known = resolveKnownLocation(explicitNew) || resolveKnownLocationFuzzy(explicitNew)
      state.location = known || explicitNew
    }
  }
}
