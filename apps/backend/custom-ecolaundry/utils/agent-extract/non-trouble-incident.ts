// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Iron rule #4 alignment: mutates state.nonTroubleshootingIncident only,
// which is NOT in rule #4's protected set (pendingClosure /
// operatorRequested / pendingEscalation / customerNameRequested /
// escalationReason). Moved verbatim from utils/agent-extract.ts.
//
// Step 4 of autoExtractFacts: first-message non-trouble incident classifier.
// Runs only when state has no incident tag and turnCount <= 1.

import type { AgentRuntime } from '../../models/index.js'
import { matchPattern } from '../nlu.js'

export function extractNonTroubleIncident(ar: AgentRuntime, userMessage: string): void {
  const state = ar.state
  if (state.nonTroubleshootingIncident || state.turnCount > 1) return

  if (matchPattern(ar.runtime, 'topicPayment', userMessage)) {
    state.nonTroubleshootingIncident = 'datafono-wrong-amount'
  } else if (matchPattern(ar.runtime, 'topicOps', userMessage)) {
    state.nonTroubleshootingIncident = 'cameras-or-ajax'
  } else if (matchPattern(ar.runtime, 'topicDryerMinutes', userMessage)) {
    state.nonTroubleshootingIncident = 'dryer-minutes-not-credited'
  } else if (matchPattern(ar.runtime, 'topicCardFail', userMessage)) {
    state.nonTroubleshootingIncident = 'card-payment'
  } else if (matchPattern(ar.runtime, 'topicRefundDemand', userMessage)) {
    state.nonTroubleshootingIncident = 'refund-demand'
  } else if (matchPattern(ar.runtime, 'topicCompensation', userMessage)) {
    state.nonTroubleshootingIncident = 'compensation-demand'
  } else if (matchPattern(ar.runtime, 'topicContradictoryNarrative', userMessage)) {
    state.nonTroubleshootingIncident = 'contradictory-narrative'
  }
}
