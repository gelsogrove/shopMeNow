// Payment-related guards: cambio (Caso 4, 7), pagado-no-usado (Caso 6),
// código de descuento (Caso 8), tarjeta de fidelización (Caso 10), recarga
// (Caso 11).

import { t } from '../localization.js'
import { getFaqs } from '../runtime.js'
import { resolveKnownLocation, resolveKnownLocationFuzzy } from '../message-parsing.js'
import type { Guard } from '../../models/index.js'
import { lang, notInActiveSubFlow } from './helpers.js'

/** G1 — Caso 7 step 1: customer said "He pagado pero no he podido usar" → ask cambio. */
export const guardCaso7AskCambio: Guard = (ar) => {
  if (
    ar.state.pendingFlow === 'caso7-ask-cambio' &&
    ar.state.location &&
    !ar.state.machineNumber &&
    !ar.state.displayState &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    ar.state.pendingFlow = 'caso7-await-display'
    return {
      reply: t('centralReturnedChange', lang(ar)),
      reason: 'caso7-ask-cambio',
    }
  }
  return null
}

// REMOVED: guardCaso7AwaitDisplay — was a Spanish-only regex classifying
// the customer's yes/no answer to "central returned change?". Intent
// detection across 6 languages is the LLM's job. After
// guardCaso7AskCambio sets pendingFlow='caso7-await-display', the LLM
// reads the sticky-state + the prompt rule "if customer confirms change
// returned, ask the display next" and continues the dialogue in any
// language. See architecture doc: regex must NOT classify intent.

/** Caso 4 step 4 — after location + tipo + numero, ask
 *  "¿La central te ha devuelto el cambio?". */
export const guardCaso4AskCambio: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso4-ask-cambio' ||
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'caso4-await-cambio'
  return { reply: t('centralReturnedChange', lang(ar)), reason: 'caso4-ask-cambio' }
}

// REMOVED: guardCaso4AwaitCambio + guardCaso4AwaitConfirmation —
// these classified yes/no in Spanish (with token-level imports from a
// few other languages) and escalated to a human operator on negative
// matches. They suffered from the same bug as Caso 5 (regex misses any
// non-enumerated phrasing → wrong escalation).
//
// The dialogue from caso4-ask-cambio onward is now driven by the LLM:
//   1. guardCaso4AskCambio asks "¿La central te ha devuelto el cambio?"
//   2. LLM reads pendingFlow='caso4-await-cambio', interprets the
//      customer's yes/no semantically, calls mark_resolved or
//      escalate_to_operator depending on outcome.
//   3. The retry instruction (centralRetryAfterReview) is given by the
//      LLM as part of the conversation, not a deterministic step.

/** Caso 6 step 1 — after location, ask "¿has podido lavar/secar?" */
export const guardCaso6AskPodidoLavar: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso6-ask-podido-lavar' ||
    !ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'caso6-ask-relato'
  return { reply: t('caso6AskPodidoLavar', lang(ar)), reason: 'caso6-ask-podido-lavar' }
}

/** Caso 6 step 2 — after "¿has podido lavar?", ask the step-by-step relato. */
export const guardCaso6AskRelato: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso6-ask-relato' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.issueSummary = `double charge — used service: ${userMessage.trim()}`
  ar.state.pendingFlow = 'caso6-ask-4-digitos'
  return { reply: t('caso6AskRelato', lang(ar)), reason: 'caso6-ask-relato' }
}

/** Caso 6 step 3 — after relato, ask the last 4 card digits. */
export const guardCaso6Ask4Digitos: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso6-ask-4-digitos' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (ar.state.issueSummary?.startsWith('double charge')) {
    ar.state.issueSummary = `${ar.state.issueSummary} — narrative: ${userMessage.trim()}`
  }
  ar.state.pendingFlow = 'caso6-ask-captura'
  return { reply: t('caso6Ask4Digitos', lang(ar)), reason: 'caso6-ask-4-digitos' }
}

/** Caso 6 step 4 — after 4 digits, ask the payment screenshot + closure. */
export const guardCaso6AskCaptura: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso6-ask-captura' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = ''
  ar.state.escalationReason = 'Caso 6 doble cobro — review with refund form'
  if (!ar.state.issueSummary?.startsWith('double charge')) {
    ar.state.issueSummary = 'double charge'
  }
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const captura = t('caso6AskCaptura', lang(ar))
  const closure = t('caso6Closure', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${captura}\n\n${closure} ${nameAsk}`, reason: 'caso6-ask-captura' }
}

/** Caso 8 step 1 — customer mentioned they have a code → ask the exact code. */
export const guardCaso8AskCode: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso8-ask-code' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'caso8-await-location'
  return { reply: t('caso8AskCode', lang(ar)), reason: 'caso8-ask-code' }
}

/** Caso 8 step 2 — after the customer typed the code, ask the location. */
export const guardCaso8AwaitLocation: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso8-await-location' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const code = userMessage.trim().replace(/[.,!?]/g, '').trim()
  if (code) ar.state.faqCodeValue = code
  if (/^\d{3,}$/.test(code)) {
    ar.state.pendingFlow = 'numeric-code-ask-letters'
    return null
  }
  ar.state.pendingFlow = 'caso8-ask-amount'
  return {
    reply: t('caso8AskLocation', lang(ar)),
    reason: 'caso8-await-location',
  }
}

/** Caso 8 step 3 — after location, ask if missing a small amount or code
 *  covers a bigger amount. */
export const guardCaso8AskAmount: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso8-ask-amount' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!ar.state.location) {
    const fuzzy = resolveKnownLocationFuzzy(userMessage)
    if (fuzzy) {
      ar.state.location = fuzzy
    } else {
      ar.state.pendingFlow = 'caso8-confirm-location'
      return { reply: t('caso8ConfirmLocation', lang(ar)), reason: 'caso8-confirm-location' }
    }
  }
  ar.state.pendingFlow = 'caso8-await-amount'
  return { reply: t('caso8AskAmount', lang(ar)), reason: 'caso8-ask-amount' }
}

/** Caso 8 step 3b — customer's reply after we asked to confirm the location. */
export const guardCaso8ConfirmLocation: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso8-confirm-location' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const exact = resolveKnownLocation(userMessage)
  const matched = exact || resolveKnownLocationFuzzy(userMessage)
  if (!matched) {
    ar.state.pendingFlow = ''
    ar.state.escalationReason = 'Caso 8 — lavandería no reconocida'
    ar.state.operatorRequested = true
    ar.state.customerNameRequested = true
    ar.pendingEscalation = { reason: ar.state.escalationReason }
    const escalate = t('doubleChargeReview', lang(ar))
    const nameAsk = t('customerNameAsk', lang(ar))
    return { reply: `${escalate} ${nameAsk}`, reason: 'caso8-escalate-location' }
  }
  ar.state.location = matched
  ar.state.pendingFlow = 'caso8-await-amount'
  return { reply: t('caso8AskAmount', lang(ar)), reason: 'caso8-ask-amount' }
}

/** Caso 8 step 4 — after amount answer, give the instruction. */
export const guardCaso8AwaitAmount: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso8-await-amount' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'caso8-await-confirmation'
  return { reply: t('caso8Instruction', lang(ar)), reason: 'caso8-instruction' }
}

// REMOVED: guardCaso8AwaitConfirmation — same monolingual yes/no regex
// problem. After caso8-await-amount sets pendingFlow='caso8-await-
// confirmation' and gives the instruction, the LLM reads the customer's
// reply ("ya funciona", "ora va", "now it works", "ainda no"…) in any
// language, calls mark_resolved or escalate_to_operator accordingly.

/** Caso 10 — Tarjeta de fidelización. */
const TARJETA_TOPIC = /(tarjeta\s+(?:de\s+)?fidelizaci[oó]n|tarjeta\s+(?:de\s+)?fidelidad|loyalty\s+card|c[oó]mo\s+(?:consigo|comprar|recargar)\s+(?:la\s+)?tarjeta)/i

export const guardCaso10Tarjeta: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isTarjetaQuery = TARJETA_TOPIC.test(userMessage)
  const askedTarjeta = ar.state.faqTopic === 'buy-loyalty-card'
  if (!isTarjetaQuery && !askedTarjeta) return null

  const override = ar.state.location
    ? (ar.runtime.locations?.locations?.[ar.state.location] as { faqOverrides?: Record<string, string> } | undefined)?.faqOverrides?.['buy-loyalty-card']
    : null
  const baseAnswer = t('caso10TarjetaBase', lang(ar))
  const fullFaq = getFaqs()['loyaltyCard'] || baseAnswer

  if (isTarjetaQuery && !ar.state.location) {
    ar.state.faqTopic = 'buy-loyalty-card'
    return { reply: baseAnswer, reason: 'caso10-tarjeta-base' }
  }
  if (askedTarjeta && ar.state.location) {
    ar.state.faqTopic = ''
    ar.state.lastResolvedIntent = 'faq'
    return { reply: override || fullFaq, reason: 'caso10-tarjeta-override' }
  }
  if (isTarjetaQuery && ar.state.location && override) {
    ar.state.lastResolvedIntent = 'faq'
    return { reply: override, reason: 'caso10-tarjeta-override-direct' }
  }
  return null
}

/** Caso 11 — Cliente pide come recargar la tarjeta. */
const RECARGA_TOPIC = /(c[oó]mo\s+recargo|recargar\s+(?:la\s+)?tarjeta|recarga\s+(?:de\s+)?(?:la\s+)?tarjeta|how\s+(?:do\s+i\s+|to\s+)?(?:re)?charge\s+(?:the\s+)?(?:loyalty\s+)?card)/i

export const guardCaso11Recarga: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!RECARGA_TOPIC.test(userMessage)) return null
  ar.state.lastResolvedIntent = 'faq'
  return { reply: t('caso11Recarga', lang(ar)), reason: 'caso11-recarga' }
}
