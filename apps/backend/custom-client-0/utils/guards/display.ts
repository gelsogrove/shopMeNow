// Display-state guards: AL001 (Caso 5), C001 (Caso 15), ALM/DOOR (Caso 14),
// no-photo (Caso 17), numeric codes (Caso 18), post-instruction failure,
// unknown-display escalation.

import { t, tt } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang, RECOVERABLE_DISPLAYS } from './helpers.js'

/** Caso 5 step 2 — customer described what happened. */
export const guardCaso5AwaitRelato: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso5-await-relato' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'caso5-await-display'
  return { reply: t('caso5GuideRetry', lang(ar)), reason: 'caso5-guide-retry' }
}

/** Caso 5 step 3 — customer reports the screen state after the retry. */
export const guardCaso5AwaitDisplay: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso5-await-display' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  const stillBroken = /\b(al\s*0*0?1|sigue|persiste|no\s+(funciona|va|arranca)|igual|mismo)/i.test(lower)
  const resolved = !stillBroken && /^(s[ií]|funciona|ya\s+(va|funciona)|ahora\s+(s[ií]|funciona)|nada|en\s+blanco|vacío|gracias|perfect)/i.test(lower)
  ar.state.pendingFlow = ''
  if (resolved) {
    ar.resolved = true
    ar.state.pendingClosure = 'resolved'
    return { reply: t('caso5Resolved', lang(ar)), reason: 'caso5-resolved' }
  }
  ar.state.escalationReason = 'Caso 5 — AL001 persiste tras la guía de secuencia correcta'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso5-escalate' }
}

/** Caso 5 — AL001: after location + machineType + machineNumber, ask
 *  "what did you do just before?" instead of going straight to escalation. */
export const guardCaso5Al001AskBefore: Guard = (ar) => {
  const display = ar.state.displayState.toUpperCase().replace(/\s+/g, '')
  if (
    display !== 'AL001' ||
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.activeFlowId === 'caso5-al001' ||
    ar.state.customerName ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.pendingEscalation = null
  ar.state.activeFlowId = 'caso5-al001'
  ar.state.pendingFlow = 'caso5-await-relato'
  return { reply: t('caso5Al001AskBefore', lang(ar)), reason: 'caso5-al001-ask-before' }
}

/** Caso 14 — ALM DOOR display: deterministic instruction. */
export const guardCaso14AlmDoor: Guard = (ar) => {
  const display = ar.state.displayState.toUpperCase().replace(/\s+/g, '')
  if (
    display !== 'ALM/DOOR' ||
    !ar.state.location ||
    !ar.state.machineNumber ||
    ar.state.activeFlowId ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.activeFlowId = 'caso14-alm-door'
  return { reply: t('caso14AlmDoor', lang(ar)), reason: 'caso14-alm-door' }
}

/** Caso 14 — ALM DOOR escalation: customer says "no desaparece" → escalate. */
export const guardCaso14AlmDoorEscalate: Guard = (ar, userMessage) => {
  if (
    ar.state.activeFlowId !== 'caso14-alm-door' ||
    ar.state.customerName ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const reply = userMessage.trim().toLowerCase()
  const persists = /(no\s+desaparece|sigue\s+(?:igual|sin\s+arrancar|saliendo)|continua|todav[ií]a\s+sale|aun\s+sale)/i.test(reply) ||
    /^(no|nope)\b/i.test(reply)
  if (!persists) return null
  ar.state.activeFlowId = null
  ar.state.escalationReason = 'Caso 14 — ALM DOOR persists after retry'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso14-alm-door-escalate' }
}

/** Caso 15 step 1 — Display 001/AL001 (originated from "001"): educational reply. */
export const guardCaso15Explain001: Guard = (ar) => {
  const display = ar.state.displayState.toUpperCase().replace(/\s+/g, '')
  if (
    display !== 'C001' ||
    !ar.state.location ||
    ar.state.activeFlowId === 'caso15-001-explained' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.pendingEscalation = null
  ar.state.activeFlowId = 'caso15-001-explained'
  return { reply: t('caso15Explain', lang(ar)), reason: 'caso15-explain' }
}

/** Caso 15 step 2 — after the educational explanation, escalate. */
export const guardCaso15Escalate001: Guard = (ar) => {
  if (
    ar.state.activeFlowId !== 'caso15-001-explained' ||
    ar.state.customerName ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.activeFlowId = null
  ar.state.escalationReason = 'Caso 15 — display 001 always escalated'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('caso15Escalate', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso15-escalate' }
}

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

/** Caso 17 step 2 — kept for backward compat but never reached now. */
export const guardCaso17NoPhoto: Guard = () => null

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
  const failure = /(sigue\s+(?:igual|sin\s+(?:arrancar|funcionar|responder|empezar))|sigue\s+(?:sin|igual)|no\s+(?:responde|arranca|empieza|funciona|desaparece)|todav[ií]a\s+(?:no|sale|sigue)|aun\s+(?:no|sale|sigue)|el\s+mensaje\s+(?:sigue|no\s+desaparece)|no\s+lo\s+s[eé]\s+bien|no\s+estoy\s+seguro|^(no|nada))/i.test(reply)
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
    ar.state.pendingFlow = 'caso8-await-location'
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
    ar.state.customerNameRequested
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
