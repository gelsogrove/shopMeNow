// Payment-related guards: cambio (Caso 4, 7), pagado-no-usado (Caso 6),
// código de descuento (Caso 8), tarjeta de fidelización (Caso 10), recarga
// (Caso 11).

import { t } from '../localization.js'
import { getFaqs } from '../runtime.js'
import { resolveKnownLocation, resolveKnownLocationFuzzy } from '../message-parsing.js'
import type { Guard } from '../../models/index.js'
import { lang, notInActiveSubFlow } from './helpers.js'
import { buildEscalationSummary, extractEscalationContext } from '../escalation.js'
import { validateCustomerName } from '../customer-name.js'

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

// =============================================================================
// Caso 8 — Tengo un código de importe menor (NEW flow per cliente comment)
// =============================================================================
//
// Format expected for a valid discount code: `^([A-Z]{3})(\d{2})(\d{2})(\d{2})(\d+)$`
//   - 3 uppercase letters         (e.g. SAU)
//   - 6 digits date DDMMYY        (e.g. 290426 → 2026-04-29)
//   - 1+ digits amount            (e.g. 6)
// Example: SAU2904266
//
// Steps:
//   1. ask-code        bot asks "dime el código exacto"
//   2. await-code      user types code → validate format
//                        - valid   → ask-name
//                        - invalid → escalate (formato no reconocido)
//   3. await-name      user types name → ask-pueblo (skip if location known)
//   4. await-pueblo    user types pueblo → ask-machine-number (skip if known)
//   5. await-machine   user types number → ask-puerta
//   6. await-puerta    user confirms door closed → final closure + escalation

const CASO8_CODE_RE = /^([A-Z]{3})(\d{2})(\d{2})(\d{2})(\d+)$/

function parseCaso8Code(raw: string): { letters: string; fechaIso: string; importe: string } | null {
  const cleaned = raw.trim().toUpperCase().replace(/[\s.,!?¿¡-]/g, '')
  const m = cleaned.match(CASO8_CODE_RE)
  if (!m) return null
  const [, letters, dd, mm, yy, importe] = m
  return { letters, fechaIso: `20${yy}-${mm}-${dd}`, importe }
}

/** Caso 8 step 1 — bot asks the customer for the exact code. */
export const guardCaso8AskCode: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'caso8-ask-code' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'caso8-await-code'
  return { reply: t('caso8AskCode', lang(ar)), reason: 'caso8-ask-code' }
}

/** Caso 8 step 2 — customer typed the code: validate format, branch. */
export const guardCaso8AwaitCode: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso8-await-code' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const raw = userMessage.trim().replace(/[.,!?¿¡]/g, '').trim()
  if (raw) ar.state.faqCodeValue = raw

  // Numeric-only codes go to the existing "did the code have letters?" flow
  // (Caso 18 — handled by display.ts guards).
  if (/^\d{3,}$/.test(raw)) {
    ar.state.pendingFlow = 'numeric-code-ask-letters'
    return null
  }

  const parsed = parseCaso8Code(raw)
  if (!parsed) {
    // Format invalid → escalate, ask customer name.
    ar.state.pendingFlow = ''
    ar.state.escalationReason = 'Caso 8 — código con formato no reconocido'
    ar.state.operatorRequested = true
    ar.state.customerNameRequested = true
    ar.pendingEscalation = { reason: ar.state.escalationReason }
    const escalate = t('caso8FormatInvalid', lang(ar))
    const nameAsk = t('customerNameAsk', lang(ar))
    return { reply: `${escalate} ${nameAsk}`, reason: 'caso8-escalate' }
  }

  ar.state.caso8Data.letters = parsed.letters
  ar.state.caso8Data.fechaIso = parsed.fechaIso
  ar.state.caso8Data.importe = parsed.importe
  ar.state.pendingFlow = 'caso8-await-name'
  return { reply: t('caso8AskName', lang(ar)), reason: 'caso8-ask-name' }
}

/** Caso 8 step 3 — capture customer name, then ask pueblo (or skip).
 *  Rejects confirmation words ("si"/"vale"/"gracias"), numeric-only tokens
 *  and 1-char strings via the shared `validateCustomerName` helper, then
 *  re-asks the name on a fresh turn instead of poisoning the state. */
export const guardCaso8AwaitName: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'caso8-await-name') return null
  const validation = validateCustomerName(userMessage)
  if (!validation.valid) {
    return { reply: t('customerNameAsk', lang(ar)), reason: 'caso8-await-name-reask' }
  }
  ar.state.customerName = validation.name
  if (ar.state.location) {
    if (ar.state.machineNumber) {
      ar.state.pendingFlow = 'caso8-await-puerta'
      return { reply: t('caso8AskPuerta', lang(ar)), reason: 'caso8-ask-puerta' }
    }
    ar.state.pendingFlow = 'caso8-await-machine-number'
    return { reply: t('caso8AskMachineNumber', lang(ar)), reason: 'caso8-ask-machine-number' }
  }
  ar.state.pendingFlow = 'caso8-await-pueblo'
  return { reply: t('caso8AskPueblo', lang(ar)), reason: 'caso8-ask-pueblo' }
}

/** Caso 8 step 4 — capture pueblo (or accept the raw text as location). */
export const guardCaso8AwaitPueblo: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'caso8-await-pueblo') return null
  const raw = userMessage.trim()
  const matched = resolveKnownLocation(raw) || resolveKnownLocationFuzzy(raw) || raw
  ar.state.location = matched
  if (ar.state.machineNumber) {
    ar.state.pendingFlow = 'caso8-await-puerta'
    return { reply: t('caso8AskPuerta', lang(ar)), reason: 'caso8-ask-puerta' }
  }
  ar.state.pendingFlow = 'caso8-await-machine-number'
  return { reply: t('caso8AskMachineNumber', lang(ar)), reason: 'caso8-ask-machine-number' }
}

/** Caso 8 step 5 — capture machine number. */
export const guardCaso8AwaitMachineNumber: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'caso8-await-machine-number') return null
  ar.state.machineNumber = userMessage.trim()
  ar.state.pendingFlow = 'caso8-await-puerta'
  return { reply: t('caso8AskPuerta', lang(ar)), reason: 'caso8-ask-puerta' }
}

/** Caso 8 step 6 — door confirmation, then escalate to internal operator. */
export const guardCaso8AwaitPuerta: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'caso8-await-puerta') return null
  const reply = userMessage.trim().toLowerCase()
  // Permissive yes/no — store both yes and no, escalate either way (operator decides).
  ar.state.caso8Data.doorClosed = !/^(no|nope|non|nada|nein|nao|n[aã]o)\b/i.test(reply)
  ar.state.pendingFlow = ''
  ar.state.escalationReason = 'Caso 8 — código válido, derivado al operador para activación remota'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = false
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  ar.state.pendingClosure = 'escalated'

  const closing = t('caso8FinalEscalate', lang(ar))
  const ctx = extractEscalationContext(ar.state, ar.state.customerName)
  const summary = buildEscalationSummary(ctx)
  ar.pendingEscalation = null
  return { reply: `${closing}\n\n**👤 Human Support message**\n${summary}`, reason: 'caso8-final' }
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
