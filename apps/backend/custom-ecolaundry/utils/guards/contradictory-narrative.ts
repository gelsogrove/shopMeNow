// Contradictory narrative — Relato contradictorio (uncertainty markers in incident context).

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { escalate, requireCustomerName } from '../state-transitions.js'

export const guardContradictoryNarrative: Guard = (ar, userMessage) => {
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
    !!ar.state.pendingFlow.startsWith('double-charge-') ||
    ar.state.nonTroubleshootingIncident === 'datafono-wrong-amount' ||
    ar.state.nonTroubleshootingIncident === 'card-payment' ||
    ar.state.nonTroubleshootingIncident === 'contradictory-narrative'
  if (!hasIncidentContext) return null
  escalate(ar, 'Contradictory narrative — contradictory narrative')
  requireCustomerName(ar)
  const escalateText = t('numericCodeIncoherence', lang(ar))
  const nameAsk = t('customerNameAsk', lang(ar))
  return { reply: `${escalateText} ${nameAsk}`, reason: 'contradictory-narrative' }
}
