// Generic FAQ closure: after a non-troubleshooting FAQ, customer
// acknowledges with a short "gracias / entendido". Close politely.

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'
import { releaseBranchOnFaqClosure } from '../state-transitions.js'

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
  // F63: release sticky branch so T+1 re-routes via dispatchTurnOne.
  releaseBranchOnFaqClosure(ar)
  return { reply: t('faqClosure', lang(ar)), reason: 'faq-closure' }
}
