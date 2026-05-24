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
// F-Caso11 (Andrea 2026-05-23): real chat "Com puc recarregar la targeta?" — Catalan
// uses double-r "recarregar/recarrego/recarrega" which the ES "recarg(ar|o|a)" pattern
// missed; routed to trouble-machine asking for location. Added explicit CA branch +
// modal forms (com puc/vull/necessito recarregar). Iron rule #8: multi-language by design.
// F99 (Andrea demo CLI 2026-05-24): IT "Come posso ricaricare la tessera?" and EN
// "How can I recharge my loyalty card?" were NOT matched — bot routed to wrong
// guard (trouble-machine for IT, loyaltyCardBuy for EN). RECARGA_TOPIC covered ES/CA
// but missed IT (ricaricare/ricarico + tessera), EN "recharge" standalone variants
// (only "how do I/to charge" worked, not "how can I recharge"), PT (recarregar + cartão),
// and FR (recharger + carte). Iron rule #8: coverage extended to all 6 languages.
const RECARGA_TOPIC = /(c[oó]mo\s+(?:puedo\s+|se\s+)?recarg[ao]|(?:puedo|quiero|necesito|quisiera)\s+recargar|(?:re)?cargar(?:la|lo)?\s+(?:la\s+)?tar[gj]eta|recarga(?:r|rla|rlo)?\s+(?:de\s+)?(?:la\s+)?tar[gj]eta|recargarla|recargarlo|no\s+s[eé]\s+(?:c[oó]mo\s+)?recargar(?:la|lo)?|how\s+(?:(?:do|can|to)\s+(?:i\s+)?|to\s+)?(?:re)?charge\s+(?:(?:my|the|a)\s+)?(?:loyalty\s+)?card|recharge\s+(?:(?:my|the|a)\s+)?(?:loyalty\s+)?card|(?:i\s+(?:want|need)|i'd\s+like)\s+to\s+recharge|com\s+(?:puc\s+|vull\s+|necessito\s+|voldria\s+)?recarregar|recarreg(?:ar|o|a|ar-la|ar-lo)\s+(?:la\s+)?tar[gj]eta|no\s+s[ée]\s+com\s+recarregar|ricaric(?:are|o|a|hi)\s+(?:(?:la|il|una?)\s+)?(?:tess?era|carta(?:\s+fedelt[aà])?)|come\s+(?:posso|si\s+)?ricaric(?:are|a)|voglio\s+ricaricare|ho\s+bisogno\s+di\s+ricaricare|recarregar\s+(?:(?:o|a|meu|minha)\s+)?cart[aã]o|como\s+(?:posso\s+)?recarregar|recharg(?:er|ez|e)\s+(?:(?:ma|la|une?)\s+)?carte)/i

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
