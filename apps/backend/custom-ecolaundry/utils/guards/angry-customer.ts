// Angry customer — Cliente arrabbiato (empathic + gather + escalate).

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

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
