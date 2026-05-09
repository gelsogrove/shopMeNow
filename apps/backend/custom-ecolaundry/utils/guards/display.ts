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
import { extractDisplayState } from '../intent.js'

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
    // PIVOT — if the customer's reply contains a NEW display token, they
    // are reporting a different problem (e.g. previous flow was PUSH,
    // re-ask got "SEL"). Reset the flow state and let the next pipeline
    // pass route the new display through the proper guard. Do NOT escalate
    // on the old flow.
    //
    // Use displayReaskPrevCode (saved by Phase B) rather than the current
    // state.displayState: autoExtractFacts already ran this turn and may
    // have overwritten displayState with the very token we're about to
    // classify as "changed", making the comparison always look like "same".
    const newDisplay = extractDisplayState(userMessage)
    const prevCode = (ar.state.displayReaskPrevCode || '').toUpperCase()
    ar.state.displayReaskPrevCode = ''
    if (newDisplay && newDisplay.toUpperCase() !== prevCode) {
      ar.state.pendingFlow = ''
      ar.state.activeFlowId = null
      ar.state.activeStepId = null
      ar.state.lastPresentedStepId = null
      ar.state.displayState = newDisplay
      return null
    }
    ar.state.pendingFlow = ''
    ar.state.activeFlowId = null
    escalate(ar, 'Customer reports the instruction did not resolve the issue')
    requireCustomerName(ar)
    const escalateText = t('reaffirmEscalate', lang(ar))
    return { reply: escalateText, reason: 'post-instruction-failure-escalate' }
  }

  const reply = userMessage.trim().toLowerCase()
  // ES failure patterns. Multi-language coverage is deferred per the
  // ES-first scope (CLAUDE.md rule #8 exemption). When a 2nd language
  // ships, mirror these patterns or move them to nlu-patterns.json.
  const failure =
    // "sigue + igual / sin <verb> / saliendo"
    /(sigue\s+(?:igual|sin\s+(?:arrancar|funcionar|responder|empezar)|saliendo\b)|sigue\s+(?:sin|igual))/i.test(reply) ||
    // "no <verb>" — direct present-tense
    /no\s+(?:responde|arranca|empieza|funciona|desaparece)/i.test(reply) ||
    // "no me ha <past-participle>" / "no se ha <past-participle>" — perfect tense.
    // Catches "no me ha funcionado", "no se ha activado", "no ha respondido".
    /no\s+(?:me\s+|se\s+)?(?:ha|han)\s+(?:funcionado|respondido|arrancado|empezado|activado|desaparecido)/i.test(reply) ||
    // "tampoco <verb>" — alternative negation
    /tampoco\s+(?:funciona|arranca|responde|empieza)/i.test(reply) ||
    // "todavía/aun + (no/sale/sigue)"
    /todav[ií]a\s+(?:no|sale|sigue)/i.test(reply) ||
    /aun\s+(?:no|sale|sigue)/i.test(reply) ||
    // "el mensaje sigue / no desaparece"
    /el\s+mensaje\s+(?:sigue|no\s+desaparece)/i.test(reply) ||
    // Customer is uncertain (treat as failure → re-ask for explicit code)
    /no\s+lo\s+s[eé]\s+bien|no\s+estoy\s+seguro/i.test(reply) ||
    // Bare "no" / "nada" at the start of the reply
    /^(no|nada)\b/i.test(reply) ||
    // "he pulsado/probado X y no responde/funciona"
    /(?:he\s+pulsado|pulsado|he\s+probado).+no\s+(?:responde|funciona)/i.test(reply)
  if (!failure) return null

  // Phase B — first failure: ask the customer to confirm the exact code
  // before escalating. This avoids escalating on an ambiguous "no funciona"
  // when the customer might just have not tried yet.
  // Save current displayState so Phase C can detect a genuine code change
  // even after autoExtractFacts has updated state.displayState next turn.
  ar.state.displayReaskPrevCode = ar.state.displayState || ''
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
