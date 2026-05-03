// Deterministic guards executed BEFORE the LLM call in agentTurn.
//
// Each guard is a pure function that decides whether to short-circuit the
// turn and produce a deterministic reply (e.g. "¿En qué calle de Mataró?",
// "¿Qué aparece en la pantalla?", "Pasamos tu caso a revisión...").
//
// Pipeline order is meaningful: earlier guards win. Each guard returns either
//   - { reply, reason }  → the agentTurn returns this reply immediately
//   - null               → fall through to the next guard, then the LLM
//
// The `reason` is a short label for debug traces ("guard:caso7-ask-cambio").

import type { AgentRuntime } from './agent-types.js'
import { t, tt } from './localization.js'
import { getFaqs } from './runtime.js'
import { resolveKnownLocation, resolveKnownLocationFuzzy } from './message-parsing.js'

export interface GuardOutcome {
  reply: string
  reason: string
}

export type Guard = (ar: AgentRuntime, userMessage: string) => GuardOutcome | null

// ── Helpers ───────────────────────────────────────────────────────────────────

const RECOVERABLE_DISPLAYS = new Set([
  'SEL', 'PUSH', 'PR', 'DOOR', 'ALM/DOOR', 'PRICE', 'BLANK',
])

function lang(ar: AgentRuntime) {
  return ar.state.language || ar.runtime.settings.defaultLanguage
}

function isMataro(ar: AgentRuntime): boolean {
  return /^matar[oó]$/i.test(ar.state.location.trim())
}

function notInActiveSubFlow(ar: AgentRuntime): boolean {
  return (
    !ar.state.activeFlowId &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested
  )
}

// ── Guards ────────────────────────────────────────────────────────────────────

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

/** Generic FAQ closure: after a non-troubleshooting FAQ (Caso 9 factura,
 *  Caso 10 tarjeta, Caso 11 recarga, Caso 12 horarios) the customer typically
 *  acknowledges with a short "gracias / entendido / perfecto". We must NOT
 *  switch to machine gather; just close politely. */
export const guardFaqClosure: Guard = (ar, userMessage) => {
  if (
    ar.state.lastResolvedIntent !== 'faq' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase().replace(/[.,!?¿¡]/g, '').trim()
  const isAcknowledgment = /^(gracias|grazie|thanks|thank\s+you|perfecto|perfect|perfetto|entendido|entendut|capito|got\s+it|ok|okay|vale|claro|de\s+acuerdo|d'accordo|adelante)(\s|$)/i.test(lower)
  if (!isAcknowledgment) return null
  ar.state.lastResolvedIntent = null
  return { reply: t('faqClosure', lang(ar)), reason: 'faq-closure' }
}

/** Caso 5 step 2 — customer described what happened. We give the standard
 *  guidance (sequence: payment first, program second) and ask them to
 *  retry and report what appears on the screen. */
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

/** Caso 5 step 3 — customer reports the screen state after the retry.
 *  - Display empty / "ya funciona" / "no aparece nada" → resolved.
 *  - AL001 still / different code / "sigue igual" → escalate. */
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

/** Caso 4 step 5 — customer answered yes/no on cambio.
 *  Yes → cambio devuelto: not the Caso 4 scenario, escalate generic.
 *  No  → give the "marca bien el numero" instruction and await confirmation. */
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
 *  re-mark instruction. Yes → resolved. No → escalate. */
export const guardCaso4AwaitConfirmation: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'caso4-await-confirmation' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const lower = userMessage.trim().toLowerCase()
  // Negative signals beat positive: "sigue sin / no funciona / no se ha
  // activado" must escalate even if the message also contains "ya".
  const negative = /\b(no\s+(funciona|va|arranca|se\s+(ha\s+)?activad|empieza|ha\s+arrancad)|sigue\s+(sin|igual)|no\s+responde|nada)\b/i.test(lower)
  const resolved = !negative && /^(s[ií]|yes|ok|vale|perfecto|funciona|ya\s+va|va\s+bien|en\s+marcha|se\s+ha\s+puesto|ha\s+arranc|ahora\s+(s[ií]|funciona|va))/i.test(lower)
  ar.state.pendingFlow = ''
  if (resolved) {
    ar.resolved = true
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

/** Caso 26 — cliente esige devolución. Step 1: raccoglie dati. Step 2 (in
 *  caso il cliente insista) escala senza promettere. Doc usecases.md
 *  Caso 26. Riusato anche per "compensation-demand" (Caso 27). */
export const guardCaso26Refund: Guard = (ar, userMessage) => {
  const incident = ar.state.nonTroubleshootingIncident
  if (
    (incident !== 'refund-demand' && incident !== 'compensation-demand') ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  // Step 1: first time we see the demand → reply differently for Caso 26
  // (refund: ask 4 dígitos + captura) vs Caso 27 (compensation: just review).
  if (!ar.state.refundDataAsked) {
    ar.state.refundDataAsked = true
    const replyKey = incident === 'compensation-demand' ? 'caso27Review' : 'caso26AskRefundData'
    return {
      reply: t(replyKey, lang(ar)),
      reason: incident === 'compensation-demand' ? 'caso27-review' : 'caso26-ask-refund-data',
    }
  }
  // Step 2: customer insists → escalate without promising.
  ar.state.escalationReason = 'Caso 26 — refund/compensation demand, escalated without promise'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('caso26EscalateNoPromise', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${escalate} ${nameAsk}`,
    reason: 'caso26-escalate',
  }
}

/** Caso 28 — relato contradictorio: il cliente, durante un possibile flow di
 *  doble cobro o un'altra incidencia, risponde "no lo sé bien", "no estoy
 *  seguro" → escalare per relato contradictorio. Doc usecases.md Caso 28. */
export const guardCaso28Contradictory: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.turnCount < 2
  ) {
    return null
  }
  const reply = userMessage.trim().toLowerCase()
  // Trigger only if customer expresses uncertainty about their own narrative
  // (not just when they don't know the location — that's Caso 31).
  const uncertain = /(no\s+lo\s+s[eé]\s+bien|no\s+estoy\s+seguro|no\s+me\s+acuerdo\s+bien|creo\s+que.*no\s+s[eé])/i.test(reply)
  if (!uncertain) return null
  // Need a prior incident hint: a payment/double-charge flow is in progress
  // OR the previous turn already showed contradictory clues.
  const hasIncidentContext =
    !!ar.state.pendingFlow.startsWith('caso6-') ||
    ar.state.nonTroubleshootingIncident === 'datafono-wrong-amount' ||
    ar.state.nonTroubleshootingIncident === 'card-payment' ||
    ar.state.nonTroubleshootingIncident === 'contradictory-narrative'
  if (!hasIncidentContext) return null
  ar.state.escalationReason = 'Caso 28 — contradictory narrative'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso28-contradictory' }
}

/** Caso 10 — Tarjeta de fidelización: risposta deterministica con base FAQ +
 *  override location-aware (se la location è già nota o viene fornita
 *  contestualmente). Doc usecases.md Caso 10. */
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
  // Per doc usecases.md Caso 10 the base reply is short and ends with a
  // location request. The full FAQ in faqs.json (with all locations listed
  // inline) is reserved as a fallback when no override exists.
  const baseAnswer = t('caso10TarjetaBase', lang(ar))
  const fullFaq = getFaqs()['loyaltyCard'] || baseAnswer

  if (isTarjetaQuery && !ar.state.location) {
    // Step 1 — short canonical answer + ask location.
    ar.state.faqTopic = 'buy-loyalty-card'
    return { reply: baseAnswer, reason: 'caso10-tarjeta-base' }
  }
  if (askedTarjeta && ar.state.location) {
    // Step 2 — location-aware override (or full FAQ if no override).
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

/** Caso 15 — Display 001 / AL001 (originato da pure "001"): risposta in 2
 *  step. Step 1 (display=AL001 + location nota): spiegazione educativa.
 *  Step 2 (cliente fa una nuova domanda dopo): escalation senza richiesta
 *  di numero macchina. Doc usecases.md Caso 15. */
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
  // Disarm any premature escalation set by the LLM and provide the doc's
  // educational reply.
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.pendingEscalation = null
  ar.state.activeFlowId = 'caso15-001-explained'
  return { reply: t('caso15Explain', lang(ar)), reason: 'caso15-explain' }
}

/** Caso 15 step 2 — after the educational explanation, any follow-up
 *  question or "qué hago?" triggers the escalation. */
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

/** Caso 8 step 1 — customer mentioned they have a code → ask the exact
 *  code as it appears on the receipt. Doc usecases.md Caso 8. */
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
  // Persist the code value for the eventual escalation summary.
  const code = userMessage.trim().replace(/[.,!?]/g, '').trim()
  if (code) ar.state.faqCodeValue = code
  // If the code is purely numeric, hand off to the Caso 18 flow.
  if (/^\d{3,}$/.test(code)) {
    ar.state.pendingFlow = 'numeric-code-ask-letters'
    return null  // let the next pipeline pass / next turn run guardNumericCodeAskLetters
  }
  ar.state.pendingFlow = 'caso8-ask-amount'
  return {
    reply: 'Gracias. ¿En qué lavandería lo quieres usar?',
    reason: 'caso8-await-location',
  }
}

/** Caso 8 step 3 — after location, ask if missing a small amount or code
 *  covers a bigger amount. If the location wasn't recognized by the fact
 *  extractor, try a conservative fuzzy match before escalating; if that
 *  also fails, ask the customer to confirm from the known list. */
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

/** Caso 8 step 3b — customer's reply after we asked to confirm the location.
 *  Try exact resolve first, then fuzzy. If still no match, escalate. */
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

/** Caso 8 step 4 — after amount answer, give the instruction and wait for
 *  the customer's confirmation that the machine started (or didn't). */
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

/** Caso 8 step 5 — customer replies whether the machine started.
 *  Yes → close the case with a positive confirmation.
 *  No / anything else → escalate to a human operator. */
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

/** Caso 11 — Cliente pide come recargar la tarjeta. Risposta deterministica
 *  breve + invito a riferire eventuali messaggi strani. Doc usecases.md
 *  Caso 11. */
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

/** Caso 9 — Cliente pide factura. Risposta deterministica con e-mail e
 *  campi richiesti. Doc usecases.md Caso 9. */
const FACTURA_TOPIC = /(\bfactura\b|\bfacturas\b|\bfattura\b|\binvoice\b|\bfatura\b|\bfacture\b|quiero\s+(?:una\s+)?factura)/i

export const guardCaso9Factura: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!FACTURA_TOPIC.test(userMessage)) return null
  ar.state.lastResolvedIntent = 'faq'
  return { reply: t('caso9Factura', lang(ar)), reason: 'caso9-factura' }
}

/** Caso 12C — Precio no confirmado. Doc usecases.md Caso 12: cliente
 *  chiede "¿Cuánto cuesta esta máquina?" → bot dice "Tengo que revisarlo
 *  antes de confirmarte ese importe." (NO inventa prezzi). */
const PRECIO_TOPIC = /(cu[aá]nto\s+cuesta|qu[eé]\s+precio|cu[aá]l\s+es\s+el\s+precio|how\s+much\s+(?:does\s+it\s+)?cost)/i

export const guardCaso12Precio: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!PRECIO_TOPIC.test(userMessage)) return null
  return {
    reply: 'Tengo que revisarlo antes de confirmarte ese importe.',
    reason: 'caso12-precio',
  }
}

/** Caso 12 — Horarios y precios FAQ. Risposta deterministica con eccezione
 *  L'Escala (7:00–23:00). Doc usecases.md Caso 12. */
const HORARIOS_TOPIC = /(\bhorario\b|\bhorarios\b|qu[eé]\s+horas?|a\s+qu[eé]\s+hora|cu[aá]ndo\s+abr|cu[aá]ndo\s+cierr|opening\s+hours)/i

export const guardCaso12Horarios: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  // Triggered when the message mentions horario keywords OR when the bot has
  // just answered a horarios FAQ and the customer asks a follow-up about a
  // different location ("¿Y en L'Escala?"). The follow-up branch reuses the
  // same canned reply scoped to the new location.
  const isHorarioFollowUp =
    ar.state.lastResolvedIntent === 'faq' &&
    /^[¿¡]?\s*(?:y|and|e)\s+(?:en\s+)?(goya|pineda|l['']?escala|alemanya|hortes|matar[oó])/i.test(userMessage.trim())
  if (!HORARIOS_TOPIC.test(userMessage) && !isHorarioFollowUp) return null
  // For follow-ups like "¿Y en L'Escala?" capture the inline location so the
  // exception check below picks the right schedule.
  const followUpLocationMatch = userMessage.match(/(goya|pineda|l['']?escala|alemanya|hortes|matar[oó])/i)
  const inlineLocation = followUpLocationMatch?.[1] || ''
  // L'Escala has an exception (7:00-23:00). Other locations follow the general
  // 8:00-22:00 schedule.
  const checkLocation = inlineLocation || ar.state.location
  const isEscala = /^l['']?escala/i.test(checkLocation)
  const reply = isEscala
    ? 'En L\'Escala, las máquinas se pueden utilizar de 7:00 a 23:00.'
    : 'El horario general de atención al público es de 8:00 a 22:00 cada día del año.'
  ar.state.lastResolvedIntent = 'faq'
  return { reply, reason: 'caso12-horarios' }
}

/** Caso 25 — cliente arrabbiato / esige soluzione: empatia + chiede location.
 *  Doc usecases.md Caso 25. */
export const guardCaso25Empathic: Guard = (ar, userMessage) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.empathicResponseSent ||
    ar.state.turnCount > 1
  ) {
    return null
  }
  // Detect anger via uppercase, multiple "!" or explicit demand patterns.
  const text = userMessage.trim()
  const exclamations = (text.match(/!/g) || []).length
  const angryWords = /(siempre\s+falla|quiero\s+(?:una\s+)?soluci[oó]n\s+ya|esto\s+es\s+un\s+desastre|qu[ée]\s+verg[uü]enza|estoy\s+harto|harta|cansad[ao])/i.test(text)
  if (exclamations < 2 && !angryWords) return null
  ar.state.empathicResponseSent = true
  return { reply: t('caso25Empathic', lang(ar)), reason: 'caso25-empathic' }
}

/** Caso 25 step 2 — after empathic opener and gather (location + tipo +
 *  numero), escalate directly. The angry customer doesn't need a display
 *  step; the operator will sort it out. */
export const guardCaso25Escalate: Guard = (ar) => {
  if (
    !ar.state.empathicResponseSent ||
    !ar.state.location ||
    !ar.state.machineType ||
    !ar.state.machineNumber ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.escalationReason = 'Caso 25 — cliente muy enfadado, escalado tras recogida de datos mínimos'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso25-escalate' }
}

/** Caso 31bis — cliente fornisce un nome non valido (es. "Girona", che è una
 *  provincia, non una nostra lavandería). Insistere chiedendo nome di una
 *  delle 6 lavanderie effettive. Doc reglas.md: solo 6 lavanderie. */
export const guardUnknownLocation: Guard = (ar) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    !ar.state.locationClarificationCount ||
    ar.state.turnCount < 2 ||
    // If we're already inside a multi-turn flow or we know this is a non-machine
    // incident, don't ask for the location: those flows have their own turn
    // sequence (e.g. Caso 18 ask-letters, Caso 26 refund step 2 escalate).
    ar.state.pendingFlow ||
    ar.state.nonTroubleshootingIncident
  ) {
    return null
  }
  return {
    reply: 'No reconozco esa ubicación. Nuestras lavanderías son: Goya, Pineda, L\'Escala, Alemanya, Hortes y Mataró. ¿En cuál de ellas estás?',
    reason: 'unknown-location',
  }
}

/** Caso 31 — cliente dice "no lo sé / no sé / no me acuerdo" quando no
 *  sappiamo ancora dove si trova → insistere chiedendo la lavandería.
 *  Per doc usecases.md Caso 31. */
export const guardCaso31InsistLocation: Guard = (ar, userMessage) => {
  if (
    ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.turnCount < 2
  ) {
    return null
  }
  const reply = userMessage.trim().toLowerCase()
  const dontKnow = /^(no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea)(?:\s|$|[.,!?])/i.test(reply)
  if (!dontKnow) return null
  return {
    reply: t('caso31InsistLocation', lang(ar)),
    reason: 'caso31-insist-location',
  }
}

/** Caso 5 — AL001: after location + machineType + machineNumber, ask
 *  "what did you do just before?" instead of going straight to escalation.
 *  Per doc usecases.md Caso 5 the bot must explore the cause before deciding,
 *  then guide the customer with the correct sequence and verify the display. */
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
  // The LLM may have prematurely flagged escalation (calling escalate_to_operator
  // on first sight of AL001). Caso 5 wants us to explore the cause first, so we
  // disarm the premature escalation here.
  ar.state.operatorRequested = false
  ar.state.customerNameRequested = false
  ar.pendingEscalation = null
  ar.state.activeFlowId = 'caso5-al001'
  ar.state.pendingFlow = 'caso5-await-relato'
  return { reply: t('caso5Al001AskBefore', lang(ar)), reason: 'caso5-al001-ask-before' }
}

/** Caso 14 — ALM DOOR display: deterministic instruction (open door, check
 *  for caught garments). Triggered after location + machineNumber known. */
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

/** Post-instruction failure: customer received an instruction (case_push,
 *  case_sel, case_door, case_alm_door, ...) and says "sigue igual / no
 *  responde / no funciona / no, no funciona". Escalate. Triggered when the
 *  flow engine has presented an instruction (state.activeFlowId set or
 *  state.lastPresentedStepId set) and the user message is a clear failure. */
export const guardPostInstructionFailure: Guard = (ar, userMessage) => {
  // We have given an instruction if the LLM either started a flow, presented a
  // step, or just received a recoverable display from a complete fact set
  // (location + type/number + display) on a turn where it has already replied
  // at least once after the display. The third condition covers cases where
  // the LLM gives an instruction inline without calling start_machine_flow
  // (e.g. DOOR, ALM/DOOR).
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
  // Match failure signals anywhere in the message: "ya lo he hecho pero sigue
  // igual", "sigue sin arrancar", "no funciona", "no desaparece", etc.
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

/** Caso 14 — ALM DOOR escalation: customer says "no desaparece" after the
 *  initial instruction → escalate. */
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

/** Caso 17 — customer cannot read the display. Photo upload is NOT a
 *  feature we support today (Andrea's product decision), so we escalate
 *  directly to the operator instead of asking for a photo. The doc's
 *  "envíame una foto" branch is kept in `caso17AskPhoto` for future use
 *  but not invoked. */
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

/** Caso 17 step 2 — kept for backward compat but never reached now: photo
 *  flow is disabled (see comment on guardCaso17AskPhoto). */
export const guardCaso17NoPhoto: Guard = () => null

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
  // The user reply to "¿has podido lavar/secar?" is "sí" / "no" / a short
  // sentence. Keep it as part of the eventual summary narrative.
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
  // Capture the customer's narrative (paso a paso explanation) into the
  // issueSummary so the operator handover can include it.
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
  // Don't overwrite issueSummary if it was already enriched in step 2/3 with
  // narrative + last4 details.
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

/** G2.5 — Mataró street: as soon as the customer names Mataró as location,
 *  ask the street BEFORE asking machine type/number/display. Mataró is the
 *  only location with multiple streets so this is its dedicated guard. */
export const guardMataroStreet: Guard = (ar) => {
  if (
    isMataro(ar) &&
    !ar.state.locationStreet &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested
  ) {
    ar.state.locationStreetRequested = true
    return {
      reply: t('mataroStreet', lang(ar)),
      reason: 'mataro-street',
    }
  }
  return null
}

/** G3 — Force "lavadora o secadora?" when location is known but type is not.
 *  Skipped for non-machine incidents (datáfono / cámaras / refund / etc.). */
export const guardForceMachineType: Guard = (ar) => {
  if (
    ar.state.location &&
    !ar.state.machineType &&
    !ar.state.displayState &&
    !ar.state.machineNumber &&
    !ar.state.nonTroubleshootingIncident &&
    !ar.state.operatorRequested &&
    !ar.state.customerNameRequested &&
    ar.state.turnCount >= 2
  ) {
    return {
      reply: t('machineType', lang(ar)),
      reason: 'force-machine-type',
    }
  }
  return null
}

/** G4a — Force "¿Has podido realizar el pago?" when local+type+number
 *  known and we still don't know whether the customer has paid. The doc
 *  (Caso 1, 2, 3, …) asks payment BEFORE display, so this guard runs
 *  before guardForceDisplay. Skipped if payment status is already known
 *  or for non-machine incidents (doble cobro, refund, etc.). */
export const guardForcePayment: Guard = (ar) => {
  if (
    ar.state.location &&
    ar.state.machineType &&
    ar.state.machineNumber &&
    !ar.state.displayState &&
    ar.state.paymentCompleted === null &&
    !ar.state.nonTroubleshootingIncident &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    ar.state.paymentRequested = true
    return {
      reply: t('paymentAsk', lang(ar)),
      reason: 'force-payment',
    }
  }
  return null
}

/** G4 — Force "qué aparece en la pantalla?" when local+type+number known.
 *  Skipped for non-machine incidents. */
export const guardForceDisplay: Guard = (ar) => {
  if (
    ar.state.location &&
    ar.state.machineType &&
    ar.state.machineNumber &&
    !ar.state.displayState &&
    !ar.state.nonTroubleshootingIncident &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    return {
      reply: t('displayShort', lang(ar)),
      reason: 'force-display',
    }
  }
  return null
}

/** G5 — Force "cuál es el número?" when local+type known but number missing.
 *  Skipped for non-machine incidents. */
export const guardForceMachineNumber: Guard = (ar) => {
  if (
    ar.state.location &&
    ar.state.machineType &&
    !ar.state.machineNumber &&
    !ar.state.displayState &&
    !ar.state.nonTroubleshootingIncident &&
    notInActiveSubFlow(ar) &&
    ar.state.turnCount >= 2
  ) {
    // Skip if we still need the Mataró street.
    if (isMataro(ar) && !ar.state.locationStreet) return null
    const numKey = ar.state.machineType === 'dryer' ? 'machineNumberDryer' : 'machineNumberWasher'
    return {
      reply: t(numKey, lang(ar)),
      reason: 'force-machine-number',
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

/** G8 — Caso 18 step 2: customer answered "no" to letters → escalate without
 *  confronting. If "yes" → transition to Caso 8 flow asking for the exact
 *  alphanumeric code. */
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
    // Customer says there are letters. Move to Caso 8 step 2 (await location)
    // since we now consider the previously typed code (with letters) valid.
    // Reset faqCodeValue so the customer can provide the full code.
    ar.state.faqCodeValue = ''
    ar.state.pendingFlow = 'caso8-await-location'
    return {
      reply: t('caso8AskCode', lang(ar)),
      reason: 'numeric-code-yes-letters',
    }
  }

  // Ambiguous answer — fall through to LLM.
  return null
}

/** G9 — Non-troubleshooting incidents (datáfono / cámaras / etc.).
 *  After we have a location, escalate with the canonical "no confrontar"
 *  message. Only triggers when nonTroubleshootingIncident is set AND
 *  location is known. */
/** Caso 21-24 location-gated escalation. Data-driven via locations.json
 *  metadata flags `dryerMinutesIncreaseIssue` and `cardPaymentUnreliable`.
 *  When the metadata flag is true for the customer's location, fall through
 *  to the standard escalation (the doc documents this pattern there).
 *  When the flag is false (or undefined), reply with "no tenemos registrado
 *  este tipo de incidencia en X" — adding/removing a location with this
 *  issue is now just a JSON edit. */
export const guardCaso2124LocationMismatch: Guard = (ar) => {
  const incident = ar.state.nonTroubleshootingIncident
  if (
    !ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerName ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isDryerMinutes = incident === 'dryer-minutes-not-credited'
  const isCardPayment = incident === 'card-payment'
  if (!isDryerMinutes && !isCardPayment) return null

  const meta = (ar.runtime.locations?.locations?.[ar.state.location]?.metadata || {}) as Record<string, unknown>
  const flag = isDryerMinutes ? 'dryerMinutesIncreaseIssue' : 'cardPaymentUnreliable'
  if (meta[flag] === true) return null  // location has the documented issue → standard escalation

  // Location not in the doc's known list — escalate with a different message
  // explaining that we don't have this issue documented here.
  ar.state.escalationReason = `${incident} reported at ${ar.state.location} (not documented)`
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const line = tt('caso2124NotDocHere', lang(ar), { location: ar.state.location })
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${line} ${nameAsk}`,
    reason: 'caso21-24-location-mismatch',
  }
}

export const guardEscalateNonTroubleshooting: Guard = (ar) => {
  // Most non-troubleshooting incidents need a location for the operator,
  // but `cameras-or-ajax` (Caso 29) is escalated immediately per doc — the
  // operator will pull the customer's data from the cameras anyway.
  const skipLocationCheck = ar.state.nonTroubleshootingIncident === 'cameras-or-ajax'
  if (
    !ar.state.nonTroubleshootingIncident ||
    (!skipLocationCheck && !ar.state.location) ||
    ar.state.operatorRequested ||
    ar.state.customerName ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.escalationReason = `Non-troubleshooting incident: ${ar.state.nonTroubleshootingIncident}`
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  // Reuse the "incoherence" line: it's neutral, no accusation, mentions
  // manual review — exactly what the doc asks for these cases.
  const incoherenceLine = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${incoherenceLine} ${nameAsk}`,
    reason: 'escalate-non-troubleshooting',
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

/**
 * Ordered pipeline of guards. The first guard that returns a non-null outcome
 * wins. Order matters:
 *   - Caso 7 markers come first (they set up multi-turn state).
 *   - Forced gather questions follow in canonical order: type → display → number.
 *   - Unknown-display escalation is last because it requires all gather facts.
 */
export const GUARD_PIPELINE: Guard[] = [
  // Mataró street is asked FIRST whenever location is Mataró and street is
  // missing — Mataró has multiple streets and this disambiguation must
  // happen before any case-specific flow (caso 6, caso 14, etc.) starts.
  guardMataroStreet,
  guardFaqClosure,
  guardCaso7AskCambio,
  guardCaso7AwaitDisplay,
  guardCaso4AskCambio,
  guardCaso4AwaitCambio,
  guardCaso4AwaitConfirmation,
  guardCaso5AwaitRelato,
  guardCaso5AwaitDisplay,
  guardCaso8AskCode,
  guardCaso8AwaitLocation,
  guardCaso8AskAmount,
  guardCaso8ConfirmLocation,
  guardCaso8AwaitAmount,
  guardCaso8AwaitConfirmation,
  guardNumericCodeAskLetters,
  guardNumericCodeNoLetters,
  guardCaso9Factura,
  guardCaso11Recarga,
  guardCaso10Tarjeta,
  guardCaso12Precio,
  guardCaso12Horarios,
  guardCaso25Empathic,
  guardCaso25Escalate,
  guardCaso28Contradictory,
  guardCaso6AskPodidoLavar,
  guardCaso6AskRelato,
  guardCaso6Ask4Digitos,
  guardCaso6AskCaptura,
  guardCaso17AskPhoto,
  guardCaso17NoPhoto,
  guardCaso31InsistLocation,
  guardUnknownLocation,
  guardCaso26Refund,
  guardCaso5Al001AskBefore,
  guardCaso15Escalate001,
  guardCaso15Explain001,
  guardCaso14AlmDoorEscalate,
  guardCaso14AlmDoor,
  guardPostInstructionFailure,
  guardCaso2124LocationMismatch,
  guardEscalateNonTroubleshooting,
  guardForceMachineType,
  guardForceMachineNumber,
  guardForceDisplay,
  guardEscalateUnknownDisplay,
]

/**
 * Runs the pipeline. Returns the first non-null outcome, or null if no guard fired.
 */
export function runGuardPipeline(ar: AgentRuntime, userMessage: string): GuardOutcome | null {
  for (const guard of GUARD_PIPELINE) {
    const outcome = guard(ar, userMessage)
    if (outcome) return outcome
  }
  return null
}
