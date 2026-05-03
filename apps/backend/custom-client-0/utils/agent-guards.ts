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

/** Caso 26 — cliente esige devolución. Step 1: raccoglie dati. Step 2 (in
 *  caso il cliente insista) escala senza promettere. Doc 01usecaases.md
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
  // Step 1: first time we see the demand → ask for data.
  if (!ar.state.refundDataAsked) {
    ar.state.refundDataAsked = true
    return {
      reply: t('caso26AskRefundData', lang(ar)),
      reason: 'caso26-ask-refund-data',
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
 *  seguro" → escalare per relato contradictorio. Doc 01usecaases.md Caso 28. */
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
  // Need a prior incident hint: a payment/double-charge flow is in progress.
  const hasIncidentContext =
    !!ar.state.pendingFlow.startsWith('caso6-') ||
    ar.state.nonTroubleshootingIncident === 'datafono-wrong-amount' ||
    ar.state.nonTroubleshootingIncident === 'card-payment'
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
 *  contestualmente). Doc 01usecaases.md Caso 10. */
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

  const baseAnswer = getFaqs()['loyaltyCard'] || ''
  const override = ar.state.location
    ? (ar.runtime.locations?.locations?.[ar.state.location] as { faqOverrides?: Record<string, string> } | undefined)?.faqOverrides?.['buy-loyalty-card']
    : null

  if (isTarjetaQuery && !ar.state.location) {
    // Step 1 — base answer.
    ar.state.faqTopic = 'buy-loyalty-card'
    return { reply: baseAnswer, reason: 'caso10-tarjeta-base' }
  }
  if (askedTarjeta && ar.state.location) {
    // Step 2 — location-aware override.
    ar.state.faqTopic = ''
    return { reply: override || baseAnswer, reason: 'caso10-tarjeta-override' }
  }
  if (isTarjetaQuery && ar.state.location && override) {
    return { reply: override, reason: 'caso10-tarjeta-override-direct' }
  }
  return null
}

/** Caso 12 — Horarios y precios FAQ. Risposta deterministica con eccezione
 *  L'Escala (7:00–23:00). Doc 01usecaases.md Caso 12. */
const HORARIOS_TOPIC = /(\bhorario\b|\bhorarios\b|qu[eé]\s+horas?|a\s+qu[eé]\s+hora|cu[aá]ndo\s+abr|cu[aá]ndo\s+cierr|opening\s+hours)/i

export const guardCaso12Horarios: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!HORARIOS_TOPIC.test(userMessage)) return null
  // L'Escala has an exception (7:00-23:00). Other locations follow the general
  // 8:00-22:00 schedule.
  const isEscala = /^l['']?escala/i.test(ar.state.location)
  const reply = isEscala
    ? 'En L\'Escala, las máquinas se pueden utilizar de 7:00 a 23:00.'
    : 'El horario general de atención al público es de 8:00 a 22:00 cada día del año.'
  return { reply, reason: 'caso12-horarios' }
}

/** Caso 25 — cliente arrabbiato / esige soluzione: empatia + chiede location.
 *  Doc 01usecaases.md Caso 25. */
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

/** Caso 31 — cliente dice "no lo sé / no sé / no me acuerdo" quando no
 *  sappiamo ancora dove si trova → insistere chiedendo la lavandería.
 *  Per doc 01usecaases.md Caso 31. */
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

/** Caso 5 — AL001: after location + machineType, ask "what did you do just
 *  before?" instead of going straight to escalation. Per doc 01usecaases.md
 *  Caso 5 the bot must explore the cause before deciding. */
export const guardCaso5Al001AskBefore: Guard = (ar) => {
  const display = ar.state.displayState.toUpperCase().replace(/\s+/g, '')
  if (
    display !== 'AL001' ||
    !ar.state.location ||
    !ar.state.machineType ||
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
  ar.pendingEscalation = null
  ar.state.activeFlowId = 'caso5-al001'
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

/** Caso 17 step 1 — customer cannot read the display. After location +
 *  machineType are known, ask for a photo. */
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
  ar.state.pendingFlow = 'caso17-await-photo'
  ar.state.photoRequested = true
  return { reply: t('caso17AskPhoto', lang(ar)), reason: 'caso17-ask-photo' }
}

/** Caso 17 step 2 — customer says they can't send a photo → escalate. */
export const guardCaso17NoPhoto: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'caso17-await-photo') return null
  const reply = userMessage.trim().toLowerCase()
  const noPhoto = /^(no\s+puedo|non\s+posso|i\s+can'?t|no\s+tengo|no,?\s*no\s+puedo)/i.test(reply) ||
    /(no\s+puedo\s+(?:hacer|sacar|enviar)\s+(?:la\s+)?foto|sin\s+foto|sin\s+c[aá]mara)/i.test(userMessage)
  if (!noPhoto) {
    return null
  }
  ar.state.pendingFlow = ''
  ar.state.escalationReason = 'Caso 17 — customer cannot read display, no photo available'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('caso17NoPhotoEscalate', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso17-no-photo' }
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
 *  confronting (per doc: "hay una información que necesitamos revisar"). */
export const guardNumericCodeNoLetters: Guard = (ar, userMessage) => {
  if (ar.state.pendingFlow !== 'numeric-code-await-answer') return null
  ar.state.pendingFlow = ''
  const reply = userMessage.trim().toLowerCase()
  const noLetters = /^(no|nope|non|nada|ninguna|sin\s+letras|nessuna|no\s+letters)\b/i.test(reply)
  if (!noLetters) {
    // Customer said "yes" or something ambiguous. Fall through to LLM.
    return null
  }
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

/** G9 — Non-troubleshooting incidents (datáfono / cámaras / etc.).
 *  After we have a location, escalate with the canonical "no confrontar"
 *  message. Only triggers when nonTroubleshootingIncident is set AND
 *  location is known. */
export const guardEscalateNonTroubleshooting: Guard = (ar) => {
  if (
    !ar.state.nonTroubleshootingIncident ||
    !ar.state.location ||
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
  guardCaso7AskCambio,
  guardCaso7AwaitDisplay,
  guardNumericCodeAskLetters,
  guardNumericCodeNoLetters,
  guardCaso10Tarjeta,
  guardCaso12Horarios,
  guardCaso25Empathic,
  guardCaso28Contradictory,
  guardCaso6AskPodidoLavar,
  guardCaso6AskRelato,
  guardCaso6Ask4Digitos,
  guardCaso6AskCaptura,
  guardCaso17AskPhoto,
  guardCaso17NoPhoto,
  guardCaso31InsistLocation,
  guardCaso26Refund,
  guardCaso5Al001AskBefore,
  guardCaso14AlmDoorEscalate,
  guardCaso14AlmDoor,
  guardPostInstructionFailure,
  guardEscalateNonTroubleshooting,
  guardForceMachineType,
  guardForceDisplay,
  guardForceMachineNumber,
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
