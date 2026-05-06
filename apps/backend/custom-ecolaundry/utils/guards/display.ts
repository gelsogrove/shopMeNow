// Display-state guards: no-photo (Caso 17), numeric codes (Caso 18),
// post-instruction failure, unknown-display escalation.
//
// The "intercept display X → emit guidance → handle resolved/persist" pattern
// (formerly Caso 5 / 14 / 15 hardcoded guards) is now data-driven via
// json/display-flows.json + utils/guards/display-flow.ts. Add new cases there.

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang, RECOVERABLE_DISPLAYS } from './helpers.js'

/** Caso 17 — customer cannot read the display. Photo upload not supported,
 *  so escalate directly. */
export const guardCaso17AskPhoto: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso17-ask-photo' ||
    !ar.state.location ||
    !ar.state.machineType ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = ''
  ar.state.escalationReason = 'Caso 17 — customer cannot read display, no photo feature available'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('caso17NoPhotoEscalate', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso17-direct-escalate' }
}

/** Post-instruction failure: customer received an instruction and reports
 *  it didn't work → escalate. */
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
  const reply = userMessage.trim().toLowerCase()
  const failure = /(sigue\s+(?:igual|sin\s+(?:arrancar|funcionar|responder|empezar)|saliendo\b)|sigue\s+(?:sin|igual)|no\s+(?:responde|arranca|empieza|funciona|desaparece)|todav[ií]a\s+(?:no|sale|sigue)|aun\s+(?:no|sale|sigue)|el\s+mensaje\s+(?:sigue|no\s+desaparece)|no\s+lo\s+s[eé]\s+bien|no\s+estoy\s+seguro|^(no|nada))/i.test(reply)
  if (!failure) return null
  ar.state.activeFlowId = null
  ar.state.escalationReason = 'Customer reports the instruction did not resolve the issue'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'post-instruction-failure' }
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
    ar.state.escalationReason = `Numeric-only code (${ar.state.faqCodeValue || 'unknown'}) — incoherence`
    ar.state.operatorRequested = true
    ar.state.customerNameRequested = true
    ar.pendingEscalation = { reason: ar.state.escalationReason }
    const incoherenceLine = t('numericCodeIncoherence', lang(ar))
    const nameAsk = t('customerNameAsk', lang(ar))
    return {
      reply: `${incoherenceLine} ${nameAsk}`,
      reason: 'numeric-code-no-letters',
    }
  }

  if (yesLetters) {
    ar.state.faqCodeValue = ''
    ar.state.pendingFlow = 'caso8-await-code'
    return {
      reply: t('caso8AskCode', lang(ar)),
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
    // (e.g. caso5-al001, caso14-alm-door, caso15-001-explained). The flow
    // engine in display-flow.ts owns the resolution/escalation lifecycle.
    ar.state.activeFlowId !== null
  ) {
    return null
  }
  ar.state.escalationReason = `Unknown display code ${display}`
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalateLine = tt('unknownDisplayEscalate', lang(ar), { display })
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${escalateLine} ${nameAsk}`,
    reason: 'escalate-unknown-display',
  }
}
