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

// F25 (Andrea 2026-05-10 audit): added "tarjeta de descuento" and "quiero la
// tarjeta" patterns from usecases.md riga 1113 ("Quiero la tarjeta de
// descuento") which the legacy regex missed.
const TARJETA_TOPIC = /(tarjeta\s+(?:de\s+)?(?:fidelizaci[oó]n|fidelidad|descuento)|loyalty\s+card|c[oó]mo\s+(?:consigo|comprar|recargar)\s+(?:la\s+)?tarjeta|(?:quiero|necesito|me\s+gustar[ií]a)\s+(?:la\s+|una\s+)?tarjeta)/i

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
