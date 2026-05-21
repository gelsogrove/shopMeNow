// Caso 11 — Recargar tarjeta de fidelización (FAQ + escalation if needed).
//
// Boundary regex: catches "¿cómo recargo?" / "recargar tarjeta" /
// "how to (re)charge". Once matched, returns the canonical instruction
// from i18n key `loyaltyCardRecharge`. If the central misbehaves the LLM
// drives the rest (no deterministic follow-up).

import { t } from '../localization.js'
import type { Guard } from '../../models/index.js'
import { lang } from './helpers.js'

// F25 (Andrea 2026-05-10 audit): added "cargar la tarjeta" (without "re-") and
// "recargarla" (verb with attached pronoun) from usecases.md riga 1155-1156.
// F68 (Andrea 2026-05-21): real chat "Como puedo recargar la targeta" — two gaps:
//   (a) pattern required 1st-person "recargo" but missed infinitive after modal
//       "puedo/quiero/necesito recargar"; added modal+infinitive pattern.
//   (b) typo "targeta" (g/j swap, common in ES) not covered; added tar[gj]eta
//       variant throughout so typo-tolerant.
const RECARGA_TOPIC = /(c[oó]mo\s+(?:puedo\s+|se\s+)?recarg[ao]|(?:puedo|quiero|necesito|quisiera)\s+recargar|(?:re)?cargar(?:la|lo)?\s+(?:la\s+)?tar[gj]eta|recarga(?:r|rla|rlo)?\s+(?:de\s+)?(?:la\s+)?tar[gj]eta|recargarla|recargarlo|no\s+s[eé]\s+(?:c[oó]mo\s+)?recargar(?:la|lo)?|how\s+(?:do\s+i\s+|to\s+)?(?:re)?charge\s+(?:the\s+)?(?:loyalty\s+)?card)/i

export const guardLoyaltyCardRecharge: Guard = (ar, userMessage) => {
  if (
    ar.state.operatorRequested ||
    ar.state.customerNameRequested
  ) {
    return null
  }
  if (!RECARGA_TOPIC.test(userMessage)) return null
  ar.state.lastResolvedIntent = 'faq'
  return { reply: t('loyaltyCardRecharge', lang(ar)), reason: 'loyalty-card-recharge' }
}
