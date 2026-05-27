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
  // ES uncertainty markers
  const uncertainES = /(no\s+lo\s+s[eé]\s+bien|no\s+estoy\s+seguro|no\s+me\s+acuerdo\s+bien|creo\s+que.*no\s+s[eé]|no\s+s[eé]\s+exactamente)/i.test(reply)
  // CA uncertainty markers
  const uncertainCA = /(no\s+ho\s+s[eé]|no\s+estic\s+segur|no\s+recordo|crec\s+que.*no\s+[hs][oé]|no\s+[hs]o\s+exactament)/i.test(reply)
  // EN uncertainty markers
  const uncertainEN = /(not\s+sure|don'?t\s+(?:know|remember)|can'?t\s+recall|not\s+entirely|unsure|not\s+quite|fairly|think|maybe|perhaps)\b/i.test(reply)
  // IT uncertainty markers
  const uncertainIT = /(non\s+lo\s+so|non\s+sono\s+sicuro|non\s+ricordo|penso\s+che.*non|non\s+esattamente)/i.test(reply)
  const uncertain = uncertainES || uncertainCA || uncertainEN || uncertainIT
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
