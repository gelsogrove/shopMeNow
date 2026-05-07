// FAQ + non-troubleshooting guards: closure, factura (Caso 9), precio/horarios
// (Caso 12), arrabbiato (Caso 25), refund/compensation (Caso 26/27),
// contradictory (Caso 28), generic non-troubleshooting escalation.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { parseRelativeDate } from '../relative-date.js'
import { buildEscalationSummary, extractEscalationContext } from '../escalation.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Generic FAQ closure: after a non-troubleshooting FAQ, customer
 *  acknowledges with a short "gracias / entendido". Close politely. */
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

/** Caso 9 — Factura: multi-step data collection then escalation.
 *
 * Flow:
 *   1. lavandería  (skip if state.location already set)
 *   2. machineType (skip if state.machineType already set)
 *   3. razón social
 *   4. dirección
 *   5. CIF/NIF/NIE
 *   6. fecha de uso  (parsed to ISO when possible, raw kept anyway)
 *   7. email         (validated; retry until valid)
 *   8. nombre        (sets customerName + escalation summary)
 *   9. final reply with name + fecha + email
 */
const FACTURA_TOPIC = /(\bfactura\b|\bfacturas\b|\bfattura\b|\binvoice\b|\bfatura\b|\bfacture\b|quiero\s+(?:una\s+)?factura)/i

function nextCaso9Step(ar: { state: { location: string; machineType: string; pendingFlow: string } }): { reply: string; nextFlow: string } | null {
  // Returns the next question + flow marker, skipping steps whose data is already known.
  if (!ar.state.location) return { reply: 'caso9AskLavanderia', nextFlow: 'caso9-ask-lavanderia' }
  if (!ar.state.machineType) return { reply: 'caso9AskMachineType', nextFlow: 'caso9-ask-machine-type' }
  return null
}

export const guardCaso9Factura: Guard = (ar, userMessage) => {
  const trimmed = userMessage.trim()
  const flow = ar.state.pendingFlow
  const isCaso9Flow = flow.startsWith('caso9-')

  // Block if already in operator handoff for an unrelated case.
  if (!isCaso9Flow && (ar.state.operatorRequested || ar.state.customerNameRequested)) {
    return null
  }

  // Entry point: customer mentions invoice and we are not already in the flow.
  if (!isCaso9Flow) {
    if (!FACTURA_TOPIC.test(userMessage)) return null
    ar.state.lastResolvedIntent = 'faq'
    ar.state.faqTopic = 'invoice'
    // Decide which step to start from based on already-known sticky facts.
    const skipped = nextCaso9Step(ar)
    if (skipped) {
      ar.state.pendingFlow = skipped.nextFlow as typeof ar.state.pendingFlow
      return { reply: t(skipped.reply, lang(ar)), reason: 'caso9-factura' }
    }
    ar.state.pendingFlow = 'caso9-ask-razon-social'
    return { reply: t('caso9AskRazonSocial', lang(ar)), reason: 'caso9-factura' }
  }

  // In-flow: each step consumes the user message as the answer.
  switch (flow) {
    case 'caso9-ask-lavanderia': {
      // Location auto-extracted by autoExtractFacts before this guard runs.
      // If it still didn't set location, store the raw answer as location anyway.
      if (!ar.state.location) ar.state.location = trimmed
      ar.state.pendingFlow = 'caso9-ask-machine-type'
      return { reply: t('caso9AskMachineType', lang(ar)), reason: 'caso9-factura' }
    }
    case 'caso9-ask-machine-type': {
      if (!ar.state.machineType) {
        // Lightweight heuristic: only "lavadora/secadora" tokens. The autoExtractor
        // normally handles this before the guard, so this is a fallback.
        const low = trimmed.toLowerCase()
        if (/\b(lavadora|washer|lavatrice|laveuse|machine\s+a\s+laver)\b/.test(low)) ar.state.machineType = 'washer'
        else if (/\b(secadora|dryer|asciugatrice|s[èe]che[- ]linge)\b/.test(low)) ar.state.machineType = 'dryer'
        else ar.state.machineType = 'washer' // accept any text, default washer; raw message is in history for the operator
      }
      ar.state.pendingFlow = 'caso9-ask-razon-social'
      return { reply: t('caso9AskRazonSocial', lang(ar)), reason: 'caso9-factura' }
    }
    case 'caso9-ask-razon-social': {
      ar.state.invoiceData.razonSocial = trimmed
      ar.state.pendingFlow = 'caso9-ask-direccion'
      return { reply: t('caso9AskDireccion', lang(ar)), reason: 'caso9-factura' }
    }
    case 'caso9-ask-direccion': {
      ar.state.invoiceData.direccion = trimmed
      ar.state.pendingFlow = 'caso9-ask-cif'
      return { reply: t('caso9AskCif', lang(ar)), reason: 'caso9-factura' }
    }
    case 'caso9-ask-cif': {
      ar.state.invoiceData.cif = trimmed
      ar.state.pendingFlow = 'caso9-ask-fecha'
      return { reply: t('caso9AskFecha', lang(ar)), reason: 'caso9-factura' }
    }
    case 'caso9-ask-fecha': {
      ar.state.invoiceData.fecha = trimmed
      ar.state.invoiceData.fechaIso = parseRelativeDate(trimmed, ar.state.language)
      ar.state.pendingFlow = 'caso9-ask-email'
      return { reply: t('caso9AskEmail', lang(ar)), reason: 'caso9-factura' }
    }
    case 'caso9-ask-email': {
      if (!EMAIL_RE.test(trimmed)) {
        // Stay on the same step until a valid email arrives.
        return { reply: t('caso9AskEmailRetry', lang(ar)), reason: 'caso9-factura' }
      }
      ar.state.invoiceData.email = trimmed
      ar.state.pendingFlow = 'caso9-ask-name'
      ar.state.customerNameRequested = true
      return { reply: t('caso9AskName', lang(ar)), reason: 'caso9-factura' }
    }
    case 'caso9-ask-name': {
      // Accept the raw input as the customer's name (no validation per Andrea's rules).
      ar.state.customerName = trimmed
      ar.state.customerNameRequested = false
      escalate(ar, 'Caso 9 — invoice request, data collected')
      ar.state.pendingFlow = ''
      ar.state.pendingClosure = 'escalated'
      const fechaDisplay = ar.state.invoiceData.fechaIso || ar.state.invoiceData.fecha
      const customerReply = t('caso9Final', lang(ar))
        .replace('{name}', ar.state.customerName)
        .replace('{fecha}', fechaDisplay)
        .replace('{email}', ar.state.invoiceData.email)
      // Append the operator handoff summary in-place: guard outcomes short-circuit
      // agent.ts before the auto-escalation block runs, so we mirror that block here.
      const ctx = extractEscalationContext(ar.state, ar.state.customerName)
      const summary = buildEscalationSummary(ctx)
      ar.pendingEscalation = null
      const final = `${customerReply}\n\n**👤 Human Support message**\n${summary}`
      return { reply: final, reason: 'caso9-factura-final' }
    }
  }
  return null
}

/** Caso 12C — Precio no confirmado. */
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
    reply: t('caso12Precio', lang(ar)),
    reason: 'caso12-precio',
  }
}

/** Caso 12 — Horarios. */
const HORARIOS_TOPIC = /(\bhorario\b|\bhorarios\b|qu[eé]\s+horas?|a\s+qu[eé]\s+hora|cu[aá]ndo\s+abr|cu[aá]ndo\s+cierr|opening\s+hours)/i

export const guardCaso12Horarios: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isHorarioFollowUp =
    ar.state.lastResolvedIntent === 'faq' &&
    /^[¿¡]?\s*(?:y|and|e)\s+(?:en\s+)?(goya|pineda|l['']?escala|alemanya|hortes|matar[oó])/i.test(userMessage.trim())
  if (!HORARIOS_TOPIC.test(userMessage) && !isHorarioFollowUp) return null
  const followUpLocationMatch = userMessage.match(/(goya|pineda|l['']?escala|alemanya|hortes|matar[oó])/i)
  const inlineLocation = followUpLocationMatch?.[1] || ''
  const checkLocation = inlineLocation || ar.state.location
  // Data-driven: use faqOverrides.openingHours from locations.json when available,
  // fall back to the default general hours string. This avoids hardcoding
  // location-specific hours and keeps L'Escala's extended schedule in one place.
  const locData = checkLocation
    ? (ar.runtime.locations?.locations?.[checkLocation] as { faqOverrides?: Record<string, string> } | undefined)
    : null
  const reply = locData?.faqOverrides?.['openingHours'] ?? t('caso12HorariosDefault', lang(ar))
  ar.state.lastResolvedIntent = 'faq'
  return { reply, reason: 'caso12-horarios' }
}

/** Caso 25 — cliente arrabbiato: empatia + chiede location. */
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
  const text = userMessage.trim()
  const exclamations = (text.match(/!/g) || []).length
  const angryWords = /(siempre\s+falla|quiero\s+(?:una\s+)?soluci[oó]n\s+ya|esto\s+es\s+un\s+desastre|qu[ée]\s+verg[uü]enza|estoy\s+harto|harta|cansad[ao])/i.test(text)
  if (exclamations < 2 && !angryWords) return null
  ar.state.empathicResponseSent = true
  return { reply: t('caso25Empathic', lang(ar)), reason: 'caso25-empathic' }
}

/** Caso 25 step 2 — after empathic + gather, escalate directly. */
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
  escalate(ar, 'Caso 25 — cliente muy enfadado, escalado tras recogida de datos mínimos')
  requireCustomerName(ar)
  const escalateText = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalateText} ${nameAsk}`, reason: 'caso25-escalate' }
}

/** Caso 26 — cliente esige devolución. Step 1: raccoglie dati. Step 2: escala. */
export const guardCaso26Refund: Guard = (ar, _userMessage) => {
  const incident = ar.state.nonTroubleshootingIncident
  if (
    (incident !== 'refund-demand' && incident !== 'compensation-demand') ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!ar.state.refundDataAsked) {
    ar.state.refundDataAsked = true
    const replyKey = incident === 'compensation-demand' ? 'caso27Review' : 'caso26AskRefundData'
    return {
      reply: t(replyKey, lang(ar)),
      reason: incident === 'compensation-demand' ? 'caso27-review' : 'caso26-ask-refund-data',
    }
  }
  escalate(ar, 'Caso 26 — refund/compensation demand, escalated without promise')
  requireCustomerName(ar)
  const escalateText = t('caso26EscalateNoPromise', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${escalateText} ${nameAsk}`,
    reason: 'caso26-escalate',
  }
}

/** Caso 28 — relato contradictorio. */
export const guardCaso28Contradictory: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested ||
    ar.state.turnCount < 2
  ) {
    return null
  }
  const reply = userMessage.trim().toLowerCase()
  const uncertain = /(no\s+lo\s+s[eé]\s+bien|no\s+estoy\s+seguro|no\s+me\s+acuerdo\s+bien|creo\s+que.*no\s+s[eé])/i.test(reply)
  if (!uncertain) return null
  const hasIncidentContext =
    !!ar.state.pendingFlow.startsWith('caso6-') ||
    ar.state.nonTroubleshootingIncident === 'datafono-wrong-amount' ||
    ar.state.nonTroubleshootingIncident === 'card-payment' ||
    ar.state.nonTroubleshootingIncident === 'contradictory-narrative'
  if (!hasIncidentContext) return null
  escalate(ar, 'Caso 28 — contradictory narrative')
  requireCustomerName(ar)
  const escalateText = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalateText} ${nameAsk}`, reason: 'caso28-contradictory' }
}

/** Generic non-troubleshooting escalation (datáfono / cámaras / etc.). */
export const guardEscalateNonTroubleshooting: Guard = (ar) => {
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
  escalate(ar, `Non-troubleshooting incident: ${ar.state.nonTroubleshootingIncident}`)
  requireCustomerName(ar)
  const incoherenceLine = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${incoherenceLine} ${nameAsk}`,
    reason: 'escalate-non-troubleshooting',
  }
}
