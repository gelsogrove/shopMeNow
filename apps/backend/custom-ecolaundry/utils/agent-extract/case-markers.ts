// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Iron rule #4 alignment: mutates state.pendingFlow, state.displayUnreadable,
// state.faqCodeValue, state.customerName plus calls the named transitions
// pivotToNoChangeAsk + resetPostEscalationFlags from state-transitions.ts.
// state.customerNameRequested is set to false inline when the name capture
// succeeds — this mirrors the original source. The protected fields covered
// by check-architecture.sh rule #4 are only mutated via the named transitions
// (per the source).
//
// Step 8 of autoExtractFacts. Order matters: customerName capture must run
// BEFORE the Caso markers so a name typed in the same turn as a new incident
// claim is recorded before the case markers clear state. The original source
// runs them in the order Caso 4 → AL001 pivot → name capture → Caso 8/17/6/18.
// We preserve that order verbatim.

import type { AgentRuntime } from '../../models/index.js'
import {
  detectPaidNotActivatedIntent,
  detectPaymentMention,
  detectDiscountCodeIntent,
  detectDisplayUnreadableIntent,
  detectDoubleChargeIntent,
  detectNumericCodeIntent,
} from '../intent.js'
import { pivotToNoChangeAsk, resetPostEscalationFlags } from '../state-transitions.js'
import {
  NAME_LOOKS_LIKE_ANSWER_RE,
  NAME_IS_PURE_NUMBER_RE,
  NAME_IS_LIKELY_NAME_RE,
} from '../patterns.js'

export function applyCaseMarkers(
  ar: AgentRuntime,
  userMessage: string,
  trimmed: string,
): void {
  const state = ar.state

  // 8.1 — Caso 4 paid-not-activated marker. Skip when router has already
  // classified as trouble-machine (display-code incidents take precedence).
  if (!state.pendingFlow && ar.state.activeBranch !== 'trouble-machine' && detectPaidNotActivatedIntent(userMessage)) {
    state.pendingFlow = 'no-change-ask'
    resetPostEscalationFlags(ar)
  }

  // 8.2 — F47 AL001 → Caso 4 pivot. Bare payment mention is enough because
  // the failure is implicit from the al001-sequence-error active flow.
  if (
    !state.pendingFlow &&
    ar.state.activeFlowId === 'al001-sequence-error' &&
    detectPaymentMention(userMessage)
  ) {
    pivotToNoChangeAsk(ar)
  }

  // 8.3 — Customer name deterministic fallback. Persist a single-word name
  // when the bot has explicitly asked for it.
  if (state.customerNameRequested && !state.customerName) {
    const cleaned = trimmed.replace(/[.,!?¿¡]/g, '').trim()
    const nameToken = cleaned.split(/\s+/)[0] || ''
    const lowered = nameToken.toLowerCase()
    const looksLikeAnswer = NAME_LOOKS_LIKE_ANSWER_RE.test(lowered)
    const isPureNumber = NAME_IS_PURE_NUMBER_RE.test(nameToken)
    const isShortToken = nameToken.length < 2
    const isLikelyName = NAME_IS_LIKELY_NAME_RE.test(nameToken)
    if (!looksLikeAnswer && !isPureNumber && !isShortToken && isLikelyName) {
      state.customerName = nameToken
      state.customerNameRequested = false
    }
  }

  // 8.4 — Caso 8 discount-code marker. Inline numeric code (e.g.
  // "Tengo un código: 23432023") is Caso 18, not Caso 8 — skip here.
  const inlineCodeValue = userMessage.match(/c[oó]digo[\s:.,-]+([A-Za-z0-9-]{3,})/i)?.[1] || ''
  const inlineNumericCode = inlineCodeValue && /^\d{3,}$/.test(inlineCodeValue)
  if (
    !state.pendingFlow &&
    !inlineNumericCode &&
    detectDiscountCodeIntent(userMessage)
  ) {
    state.pendingFlow = 'discount-code-ask'
    resetPostEscalationFlags(ar)
  }

  // 8.5 — Caso 17 display-unreadable marker.
  if (!state.pendingFlow && detectDisplayUnreadableIntent(userMessage)) {
    state.pendingFlow = 'photo-await-decision'
    state.displayUnreadable = true
    resetPostEscalationFlags(ar)
  }

  // 8.6 — Caso 6 double-charge marker.
  if (!state.pendingFlow && detectDoubleChargeIntent(userMessage)) {
    state.pendingFlow = 'double-charge-ask-used'
    resetPostEscalationFlags(ar)
  }

  // 8.7 — Caso 18 numeric-code marker.
  if (!state.pendingFlow) {
    const numericCode = detectNumericCodeIntent(userMessage)
    if (numericCode) {
      state.faqCodeValue = numericCode
      state.pendingFlow = 'numeric-code-ask-letters'
      resetPostEscalationFlags(ar)
    }
  }
}
