// Generic non-troubleshooting escalation: datáfono incoherente,
// cámaras/AJAX, card-payment requests, etc. The `nonTroubleshootingIncident`
// state field is set by the LLM via tool call when the customer reports
// something that does not fit a machine flow but still needs escalation.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

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
  // compensation-demand gets a warmer opening (usecases.md §27 F65).
  // All other non-troubleshooting incidents use the generic incoherence line.
  const isCompensation = ar.state.nonTroubleshootingIncident === 'compensation-demand'
  const openingLine = isCompensation
    ? t('compensationReview', lang(ar))
    : t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return {
    reply: `${openingLine} ${nameAsk}`,
    reason: 'escalate-non-troubleshooting',
  }
}
