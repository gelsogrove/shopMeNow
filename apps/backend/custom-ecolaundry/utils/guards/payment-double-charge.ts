// Caso 6 — Doble cobro pero el cliente ha podido usar el servicio.
//
// 4-step gather flow: ¿lavar/secar? → relato → últimos 4 dígitos →
// captura del pago + closure. Final step escalates with a request for
// the customer name (collected on the next turn by the standard flow).

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

/** Caso 6 step 1 — after location, ask "¿has podido lavar/secar?" */
export const guardDoubleChargeAskUsed: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-used' ||
    !ar.state.location ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = 'double-charge-ask-narrative'
  return { reply: t('doubleChargeAskUsed', lang(ar)), reason: 'double-charge-ask-used' }
}

/** Caso 6 step 2 — after "¿has podido lavar?", ask the step-by-step relato. */
export const guardDoubleChargeAskNarrative: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-narrative' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.issueSummary = `double charge — used service: ${userMessage.trim()}`
  ar.state.pendingFlow = 'double-charge-ask-card-digits'
  return { reply: t('doubleChargeAskNarrative', lang(ar)), reason: 'double-charge-ask-narrative' }
}

/** Caso 6 step 3 — after relato, ask the last 4 card digits. */
export const guardDoubleChargeAskCardDigits: Guard = (ar, userMessage) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-card-digits' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (ar.state.issueSummary?.startsWith('double charge')) {
    ar.state.issueSummary = `${ar.state.issueSummary} — narrative: ${userMessage.trim()}`
  }
  ar.state.pendingFlow = 'double-charge-ask-receipt'
  return { reply: t('doubleChargeAskCardDigits', lang(ar)), reason: 'double-charge-ask-card-digits' }
}

/** Caso 6 step 4 — after 4 digits, ask the payment screenshot + closure. */
export const guardDoubleChargeAskReceipt: Guard = (ar) => {
  if (
    ar.state.pendingFlow !== 'double-charge-ask-receipt' ||
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  ar.state.pendingFlow = ''
  if (!ar.state.issueSummary?.startsWith('double charge')) {
    ar.state.issueSummary = 'double charge'
  }
  escalate(ar, 'Double charge incident — review with refund form')
  requireCustomerName(ar)
  const captura = t('doubleChargeAskReceipt', lang(ar))
  const closure = t('doubleChargeClosure', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${captura}\n\n${closure} ${nameAsk}`, reason: 'double-charge-ask-receipt' }
}
