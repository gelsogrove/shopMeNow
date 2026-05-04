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
      reply: '¿La central te ha devuelto el cambio?',
      reason: 'caso7-ask-cambio',
    }
  }
  return null
}

/** G2 — Caso 7 step 2: customer answered "sí" to cambio → ask display. */
export const guardCaso7AwaitDisplay: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'caso7-await-display') return null
  ar.state.pendingFlow = ''
  const reply = userMessage.trim().toLowerCase()
  const cambioYes = /^(s[ií]|claro|por supuesto|s[ií]\s+lo\s+ha\s+devuelto|me\s+ha\s+devuelto)/i.test(reply)
  if (!cambioYes) return null
  return {
    reply: '¿Qué aparece exactamente en la pantalla de la máquina?',
    reason: 'caso7-await-display',
  }
}

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

/** Caso 4 step 5 — customer answered yes/no on cambio. */
export const guardCaso4AwaitCambio: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso4-await-cambio' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  const cambioYes = /^(s[ií]|yes|oui|sim|me\s+ha\s+devuelto|s[ií]\s+lo\s+ha\s+devuelto)/i.test(lower)
  if (cambioYes) {
    ar.state.pendingFlow = ''
    ar.state.escalationReason = 'Caso 4 — central ha devuelto el cambio pero la máquina no se activa'
    ar.state.operatorRequested = true
    ar.state.customerNameRequested = true
    ar.pendingEscalation = { reason: ar.state.escalationReason }
    const escalate = t('doubleChargeReview', lang(ar))
    const nameAsk = t('customerNameAsk', lang(ar))
    return { reply: `${escalate} ${nameAsk}`, reason: 'caso4-escalate-cambio-yes' }
  }
  ar.state.pendingFlow = 'caso4-await-confirmation'
  return { reply: t('centralRetryAfterReview', lang(ar)), reason: 'caso4-instruction' }
}

/** Caso 4 step 6 — customer replies whether the machine started after the
 *  re-mark instruction. */
export const guardCaso4AwaitConfirmation: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso4-await-confirmation' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  const negative = /\b(no\s+(funciona|va|arranca|se\s+(ha\s+)?activad|empieza|ha\s+arrancad)|sigue\s+(sin|igual)|no\s+responde|nada)\b/i.test(lower)
  const resolved = !negative && /^(s[ií]|yes|ok|vale|perfecto|funciona|ya\s+va|va\s+bien|en\s+marcha|se\s+ha\s+puesto|ha\s+arranc|ahora\s+(s[ií]|funciona|va))/i.test(lower)
  ar.state.pendingFlow = ''
  if (resolved) {
    ar.resolved = true
    ar.state.pendingClosure = 'resolved'
    return { reply: t('caso4Resolved', lang(ar)), reason: 'caso4-resolved' }
  }
  ar.state.escalationReason = 'Caso 4 — máquina sigue sin activar tras corregir el número en la central'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso4-escalate' }
}

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
    reply: 'Gracias. ¿En qué lavandería lo quieres usar?',
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

/** Caso 8 step 5 — customer replies whether the machine started. */
export const guardCaso8AwaitConfirmation: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso8-await-confirmation' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  const resolved = /^(s[ií]|yes|ok|okay|vale|perfecto|funciona|ya\s+va|va\s+bien|genial|gracias|tutto\s+ok|ha\s+funcionado|funcion[oó])\b/.test(lower)
  ar.state.pendingFlow = ''
  if (resolved) {
    ar.resolved = true
    ar.state.pendingClosure = 'resolved'
    return { reply: t('caso8Resolved', lang(ar)), reason: 'caso8-resolved' }
  }
  ar.state.escalationReason = 'Caso 8 — código de descuento, máquina no arrancó tras el ingreso'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso8-escalate' }
}

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
