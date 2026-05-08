// Caso 26 + 27 — Refund demand / compensation demand (no promise, escalate).
//
// Both incidents share the same flow shape: step 1 collects refund data
// (4 dígitos / captura / breve resumen), step 2 escalates without
// promising. The branch on `incident` chooses the right reply key.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

export const guardRefundOrCompensation: Guard = (ar, _userMessage) => {
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
    const replyKey = incident === 'compensation-demand' ? 'compensationReview' : 'refundAskData'
    return {
      reply: t(replyKey, lang(ar)),
      reason: incident === 'compensation-demand' ? 'compensation-review' : 'refund-ask-data',
    }
  }
  escalate(ar, 'Refund/compensation — refund/compensation demand, escalated without promise')
  requireCustomerName(ar)
  const escalateText = t('refundEscalateNoPromise', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${escalateText} ${nameAsk}`,
    reason: 'refund-escalate',
  }
}
