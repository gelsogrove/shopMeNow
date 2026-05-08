// Display-state guards: no-photo (Caso 17), numeric codes (Caso 18),
// post-instruction failure, unknown-display escalation.
//
// The "intercept display X → emit guidance → handle resolved/persist" pattern
// (formerly Caso 5 / 14 / 15 hardcoded guards) is now data-driven via
// json/display-flows.json + utils/guards/display-flow.ts. Add new cases there.

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { escalate, requireCustomerName } from '../state-transitions.js'
import { lang, RECOVERABLE_DISPLAYS } from './helpers.js'

/** Caso 17 — customer cannot read the display. Photo upload not supported,
 *  so escalate directly. */
export const guardAskPhoto: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'photo-await-decision' ||
    !ar.state.location ||
    !ar.state.machineType ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = ''
  escalate(ar, 'Display-unreadable — customer cannot read display, no photo feature available')
  requireCustomerName(ar)
  const escalateText = t('noPhotoEscalate', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalateText} ${nameAsk}`, reason: 'no-photo-escalate' }
}

/** Post-instruction failure: customer received an instruction and reports
 *  it didn't work.
 *
 *  Two phases (uniform with display-flow Phase B/C for AL001/ALM-DOOR/C001
 *  and with usecases.md Scenario 1.2 / 5.2-3 / 7.2):
 *
 *    Phase B (first failure)  → ask the customer to confirm the exact
 *                                display code BEFORE escalating. Sets
 *                                pendingFlow='display-reask-pending'.
 *
 *    Phase C (after re-ask)   → whatever the customer types, escalate
 *                                with reaffirmEscalate (contains "operador")
 *                                and ask for the name. The next turn closes
 *                                with the "desactivado" handover line.
 *
 *  Why split into two phases? A bare "no funciona" / "no responde" is
 *  ambiguous: it can mean "didn't try yet" or "still broken". Asking for
 *  the exact code one more time forces the customer to be explicit and
 *  the operator gets a confirmed display token in the handover summary. */
export const guardPostInstructionFailure: Guard = (ar, userMessage) => {
  const hasShownInstruction =
    !!(ar.state.activeFlowId || ar.state.lastPresentedStepId) ||
    (!!ar.state.displayState &&
      !!ar.state.location &&
      !!ar.state.machineNumber &&
      ar.state.turnCount >= 5)
  if (
    !hasShownInstruction ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }

  // Phase C — we already asked for the exact code on the previous turn.
  // Whatever the customer sent now, escalate. (display-flow.ts Phase C
  // covers the JSON-driven flows AL001/ALM-DOOR/C001; this branch covers
  // the washer/dryer flow-engine flows like case_push/case_door/case_sel.)
  if (ar.state.pendingFlow === 'display-reask-pending') {
    ar.state.pendingFlow = ''
    ar.state.activeFlowId = null
    escalate(ar, 'Customer reports the instruction did not resolve the issue')
    requireCustomerName(ar)
    const escalateText = t('reaffirmEscalate', lang(ar))
    return { reply: escalateText, reason: 'post-instruction-failure-escalate' }
  }

  const reply = userMessage.trim().toLowerCase()
  const failure = /(sigue\s+(?:igual|sin\s+(?:arrancar|funcionar|responder|empezar)|saliendo\b)|sigue\s+(?:sin|igual)|no\s+(?:responde|arranca|empieza|funciona|desaparece)|todav[ií]a\s+(?:no|sale|sigue)|aun\s+(?:no|sale|sigue)|el\s+mensaje\s+(?:sigue|no\s+desaparece)|no\s+lo\s+s[eé]\s+bien|no\s+estoy\s+seguro|^(no|nada)|he\s+pulsado.+no\s+responde|pulsado.+no\s+responde|he\s+probado.+no\s+(?:funciona|responde))/i.test(reply)
  if (!failure) return null

  // Phase B — first failure: ask the customer to confirm the exact code
  // before escalating. This avoids escalating on an ambiguous "no funciona"
  // when the customer might just have not tried yet.
  ar.state.pendingFlow = 'display-reask-pending'
  return { reply: t('displayShort', lang(ar)), reason: 'post-instruction-failure-reask' }
}

/** G7 — Caso 18 step 1: customer typed a pure-numeric code → ask if there
 *  are letters in front. */
export const guardNumericCodeAskLetters: Guard = (ar) => {
  if (ar.state.pendingFlow !== 'numeric-code-ask-letters') return null
  ar.state.pendingFlow = 'numeric-code-await-answer'
  return {
    reply: t('numericCodeAskLetters', lang(ar)),
    reason: 'numeric-code-ask-letters',
  }
}

/** G8 — Caso 18 step 2: customer answered "no" to letters → escalate. */
export const guardNumericCodeNoLetters: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'numeric-code-await-answer') return null
  const reply = userMessage.trim().toLowerCase()
  const noLetters = /^(no|nope|non|nada|ninguna|sin\s+letras|nessuna|no\s+letters)\b/i.test(reply)
  const yesLetters = /^(s[ií]|sí|si|yes|yep|claro|por\s+supuesto|exacto|sì|hay\s+letras|tiene\s+letras)\b/i.test(reply)

  if (noLetters) {
    ar.state.pendingFlow = ''
    escalate(ar, `Numeric-only code (${ar.state.faqCodeValue || 'unknown'}) — incoherence`)
    requireCustomerName(ar)
    const incoherenceLine = t('numericCodeIncoherence', lang(ar))
    const nameAsk = t('customerNameAsk', lang(ar))
    return {
      reply: `${incoherenceLine} ${nameAsk}`,
      reason: 'numeric-code-no-letters',
    }
  }

  if (yesLetters) {
    ar.state.faqCodeValue = ''
    ar.state.pendingFlow = 'discount-code-await'
    return {
      reply: t('discountCodeAsk', lang(ar)),
      reason: 'numeric-code-yes-letters',
    }
  }

  return null
}

/** G6 — Display is unknown/undocumented and we have local+type+number → escalate. */
export const guardEscalateUnknownDisplay: Guard = (ar) => {
  const display = ar.state.displayState.toUpperCase()
  if (
    !display ||
    RECOVERABLE_DISPLAYS.has(display) ||
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.operatorRequested ||
    ar.state.customerName ||
    ar.state.customerNameRequested ||
    // Skip when any declarative display-flow is already handling this turn
    // (e.g. al001-sequence-error, alm-door-blocked, code-001-explained). The flow
    // engine in display-flow.ts owns the resolution/escalation lifecycle.
    ar.state.activeFlowId !== null
  ) {
    return null
  }
  escalate(ar, `Unknown display code ${display}`)
  requireCustomerName(ar)
  const escalateLine = tt('unknownDisplayEscalate', lang(ar), { display })
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${escalateLine} ${nameAsk}`,
    reason: 'escalate-unknown-display',
  }
}
