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
// F44 — Andrea 2026-05-11: extended the intent-verb pattern to allow an
// optional action verb (comprar/tener/conseguir/sacar/adquirir) AND an
// optional adjective ("nueva", "otra") between the intent verb and
// "tarjeta". Catches "quiero comprar una nueva tarjeta" / "necesito sacar
// la tarjeta" / "me gustaría tener una tarjeta nueva" that the previous
// pattern missed.
export const TARJETA_TOPIC = /(tarjeta\s+(?:de\s+)?(?:fidelizaci[oó]n|fidelidad|descuento)|loyalty\s+card|c[oó]mo\s+(?:consigo|comprar|recargar|saco|adquiero|tengo)\s+(?:la\s+|una\s+)?tarjeta|(?:quiero|necesito|me\s+gustar[ií]a|quisiera)\s+(?:comprar\s+|tener\s+|conseguir\s+|sacar\s+|adquirir\s+)?(?:una?\s+|la\s+|mi\s+|otra\s+)?(?:nueva\s+|nuevita\s+)?tarjeta)/i

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

  // usecases.md Caso 10 criterio 4: never ask for location proactively.
  // Respond immediately with the global FAQ. If a per-location override
  // exists (location already known), use it instead.
  const override = ar.state.location
    ? (ar.runtime.locations?.locations?.[ar.state.location] as { faqOverrides?: Record<string, string> } | undefined)?.faqOverrides?.['buy-loyalty-card']
    : null
  const fullFaq = getFaqs()['loyaltyCard'] || t('loyaltyCardBuyBase', lang(ar))

  ar.state.faqTopic = ''
  ar.state.lastResolvedIntent = 'faq'
  return { reply: override || fullFaq, reason: 'loyalty-card-buy' }
}
