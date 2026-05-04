// FAQ + non-troubleshooting guards: closure, factura (Caso 9), precio/horarios
// (Caso 12), arrabbiato (Caso 25), refund/compensation (Caso 26/27),
// contradictory (Caso 28), generic non-troubleshooting escalation.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'

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

/** Caso 9 — Factura. */
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
    reply: 'Tengo que revisarlo antes de confirmarte ese importe.',
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
  const isEscala = /^l['']?escala/i.test(checkLocation)
  const reply = isEscala
    ? 'En L\'Escala, las máquinas se pueden utilizar de 7:00 a 23:00.'
    : 'El horario general de atención al público es de 8:00 a 22:00 cada día del año.'
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
  ar.state.escalationReason = 'Caso 25 — cliente muy enfadado, escalado tras recogida de datos mínimos'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso25-escalate' }
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
  ar.state.escalationReason = 'Caso 28 — contradictory narrative'
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const escalate = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalate} ${nameAsk}`, reason: 'caso28-contradictory' }
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
  ar.state.escalationReason = `Non-troubleshooting incident: ${ar.state.nonTroubleshootingIncident}`
  ar.state.operatorRequested = true
  ar.state.customerNameRequested = true
  ar.pendingEscalation = { reason: ar.state.escalationReason }
  const incoherenceLine = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${incoherenceLine} ${nameAsk}`,
    reason: 'escalate-non-troubleshooting',
  }
}
