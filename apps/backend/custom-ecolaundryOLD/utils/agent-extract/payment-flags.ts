// approved-by-andrea: REFACTOR ONLY — extracted from utils/agent-extract.ts
// as part of the iron rule #3 split. Zero behavioural change. Iron rule #5
// not applicable (depth-2 file).
//
// Iron rule #4 alignment: mutates state.paymentCompleted and
// state.paymentRequested. Neither is in rule #4's protected set
// (pendingClosure / operatorRequested / pendingEscalation /
// customerNameRequested / escalationReason). Moved verbatim from source.
//
// Step 7 of autoExtractFacts. Two sub-steps:
//   1. Explicit yes/no payment signal — bare answers honored only when
//      state.paymentRequested is true (catches the "¿has pagado?" turn).
//   2. Inferred payment from a recoverable display code (PUSH/SEL/DOOR/…).

import type { AgentRuntime } from '../../models/index.js'
import { parseExplicitPaymentSignal } from '../message-parsing.js'
import { RECOVERABLE_DISPLAYS } from '../guards/helpers.js'

export function extractPaymentFlags(ar: AgentRuntime, trimmed: string): void {
  const state = ar.state

  // 7.1 — Explicit signal first, then bare yes/no after a payment ask.
  if (state.paymentCompleted === null) {
    const paid = parseExplicitPaymentSignal(trimmed)
    if (paid !== null) {
      state.paymentCompleted = paid
    } else if (state.paymentRequested) {
      const lower = trimmed.toLowerCase().replace(/[.,!?¿¡]/g, '').trim()
      if (/^(s[ií]|yes|oui|sim|ok|vale|claro|por\s+supuesto)(\s|$)/.test(lower)) state.paymentCompleted = true
      else if (/^(no|non|nope|nao)(\s|$)/.test(lower)) state.paymentCompleted = false
    }
    if (state.paymentCompleted !== null) state.paymentRequested = false
  }

  // 7.2 — Inferred from recoverable display. PUSH/SEL/DOOR/PRICE/BLANK
  // only appear AFTER payment is processed by the central; treat the
  // payment as completed so the dryer flow skips step_0.
  if (
    state.paymentCompleted === null &&
    state.displayState &&
    RECOVERABLE_DISPLAYS.has(state.displayState.toUpperCase())
  ) {
    state.paymentCompleted = true
  }
}
