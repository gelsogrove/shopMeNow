// Angry customer — Cliente arrabbiato (empathic + gather + escalate).

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

/**
 * Caso 6 / Caso 25 fast-path — cliente claramente enfadado Y pide operador
 * explícitamente en el mismo mensaje. Escala al instante (sin gather).
 *
 * Boundary signal — rule #6: not intent classification, but a "customer wants
 * out NOW" signal that overrides the gather pipeline. Without this, the
 * customer falls through to guardForceLocation and the bot asks "¿en qué
 * lavandería estás?" while the customer is screaming for an operator.
 *
 * Both rage marker AND explicit operator request must be present. A plain
 * angry message without operator request → guardAngryCustomerEmpathic
 * (gather first). A plain operator request without anger → handled by the
 * LLM's escalate_to_operator tool with a softer flow.
 */
export const guardAngryCustomerExplicit: Guard = (ar, userMessage) => {
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return null
  const text = userMessage.toLowerCase()
  const angryMarker = /muy\s+(?:enfadad|molest|cabread|enfurec|frustad|irritad)|estoy\s+(?:muy\s+)?(?:enfadad|molest|harto|harta|cabread|cansad|frustad)|esto\s+es\s+un\s+desastre|qu[eé]\s+verg[uü]enza|siempre\s+falla|\bharto\b|\bharta\b|estoy\s+furios|me\s+est[aá]is\s+tomando\s+el\s+pelo/i
  const operatorRequest = /(?:quiero|necesito|exijo|d[eé]jame|quisiera|p[oó]ngame|p[aá]same|me\s+pasas?|me\s+pase)\s+(?:hablar\s+(?:con\s+)?)?(?:un\s+|una\s+|el\s+|la\s+)?(?:operador|persona|humano|encargado|alguien|responsable|atendedor)|(?:hablar|hable)\s+con\s+(?:un\s+|una\s+|el\s+)?(?:operador|persona|humano|encargado|responsable)|operador\s+(?:humano|ahora|ya)|with\s+(?:an?\s+)?(?:operator|human|person|agent)|parl(?:are|er)\s+con\s+(?:un\s+)?(?:operator|operatore|umano|persona)/i
  if (!angryMarker.test(text) || !operatorRequest.test(text)) return null
  escalate(ar, 'Angry customer — cliente muy enfadado, exige operador, escalado al instante')
  requireCustomerName(ar)
  const escalateText = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalateText} ${nameAsk}`, reason: 'angry-customer-explicit-escalate' }
}

/** Caso 25 step 1 — empathic acknowledgment + ask location. */
export const guardAngryCustomerEmpathic: Guard = (ar, userMessage) => {
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
  return { reply: t('angryCustomerEmpathic', lang(ar)), reason: 'angry-customer-empathic' }
}

/** Caso 25 step 2 — after empathic + gather, escalate directly. */
export const guardAngryCustomerEscalate: Guard = (ar) => {
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
  escalate(ar, 'Angry customer — cliente muy enfadado, escalado tras recogida de datos mínimos')
  requireCustomerName(ar)
  const escalateText = t('doubleChargeReview', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalateText} ${nameAsk}`, reason: 'angry-customer-escalate' }
}
