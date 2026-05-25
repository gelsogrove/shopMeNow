// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Step 1 of autoExtractFacts: detect FAQ pause + payment-method question.
// Sets state.faqPause / state.lastResolvedIntent + state.lastFaqKey hints
// for the L5 polish layer and the router.

import type { AgentRuntime } from '../../models/index.js'
import { detectFaqPause, detectPaymentMethodQuestion } from '../intent.js'

export function extractFaqPauseAndPaymentQuestion(ar: AgentRuntime, trimmed: string): void {
  const state = ar.state

  // F28 — FAQ pause: customer interrupts an active trouble-machine flow
  // with a brief FAQ. Setting state.faqPause = true tells the L5 polish
  // layer to append a "¿Sigamos con tu problema?" prompt.
  const hasTroubleContext = !!(state.pendingFlow || state.displayState || state.machineNumber)
  if (hasTroubleContext && detectFaqPause(trimmed)) {
    state.faqPause = true
  } else if (state.faqPause) {
    // Customer's next message after the FAQ — clear so the prompt does not
    // re-append on the resumed turn.
    state.faqPause = false
  }

  // Detect payment-method questions early (before router LLM). Sets a hint
  // — the router LLM still owns final routing.
  if (detectPaymentMethodQuestion(trimmed) && !state.pendingFlow) {
    state.lastResolvedIntent = 'faq'
    state.lastFaqKey = 'paymentMethods'
  }
}
