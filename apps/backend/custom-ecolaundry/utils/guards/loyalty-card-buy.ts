// Caso 10 — Tarjeta de fidelización (purchase / overrides per location).
//
// LLM is allowed to detect the topic via free-text (boundary signal — the
// regex below catches the canonical phrasing across the 6 supported
// languages so the deterministic answer can fire without an extra LLM
// hop). Once topic is known, the answer is read from `getFaqs()` (Tier 1
// system FAQ key `loyaltyCard`) and from per-location `faqOverrides`.

import { t } from '../localization.js'
import { getFaqs } from '../runtime.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'

const TARJETA_TOPIC = /(tarjeta\s+(?:de\s+)?fidelizaci[oó]n|tarjeta\s+(?:de\s+)?fidelidad|loyalty\s+card|c[oó]mo\s+(?:consigo|comprar|recargar)\s+(?:la\s+)?tarjeta)/i

export const guardLoyaltyCardBuy: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  const isTarjetaQuery = TARJETA_TOPIC.test(userMessage)
  const askedTarjeta = ar.state.faqTopic === 'buy-loyalty-card'
  if (!isTarjetaQuery && !askedTarjeta) return null

  const override = ar.state.location
    ? (ar.runtime.locations?.locations?.[ar.state.location] as { faqOverrides?: Record<string, string> } | undefined)?.faqOverrides?.['buy-loyalty-card']
    : null
  const baseAnswer = t('loyaltyCardBuyBase', lang(ar))
  const fullFaq = getFaqs()['loyaltyCard'] || baseAnswer

  if (isTarjetaQuery && !ar.state.location) {
    ar.state.faqTopic = 'buy-loyalty-card'
    return { reply: baseAnswer, reason: 'loyalty-card-buy-base' }
  }
  if (askedTarjeta && ar.state.location) {
    ar.state.faqTopic = ''
    ar.state.lastResolvedIntent = 'faq'
    return { reply: override || fullFaq, reason: 'loyalty-card-buy-override' }
  }
  if (isTarjetaQuery && ar.state.location && override) {
    ar.state.lastResolvedIntent = 'faq'
    return { reply: override, reason: 'loyalty-card-buy-override-direct' }
  }
  return null
}
