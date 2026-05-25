// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Bodies moved verbatim. Iron rule #5 not applicable (depth-2
// file). Coverage in intent.test.ts and extract-facts.test.ts.
//
// All three helpers are deterministic state inspectors / location parsers.
// isLikelyStandaloneLocationInput delegates to allowed boundary signals
// (greeting, short reply, machine-type vocabulary, question marker). The
// rule #6 status of every regex below is "boundary signal" or "lexical
// disqualifier" — none of them route intent to a flow.

import type { SessionState } from '../../models/index.js'
import { hasGreetingIntent } from './greeting.js'
import { isShortContextReply } from './short-reply.js'
import { normalizeMachineType } from './machine.js'

export function isAwaitingLocation(state: SessionState): boolean {
  return !state.location && state.lastMissingFacts.includes('location')
}

export function isLikelyStandaloneLocationInput(state: SessionState, message: string): boolean {
  const trimmed = message.trim()
  if (!(isAwaitingLocation(state) || (!state.location && trimmed.split(/\s+/).length <= 4))) return false
  if (!trimmed || trimmed.length > 60) return false
  if (/^\d+$/.test(trimmed)) return false
  if (isShortContextReply(trimmed)) return false
  if (hasGreetingIntent(trimmed)) return false
  if (normalizeMachineType(trimmed)) return false
  // \b is ASCII-only in JS regex without /u flag — use a non-word lookahead
  // after accented chars ("qué").
  if (/[?¿]/.test(trimmed)) return false
  if (/^(qu[eé]|che|what|cosa|qual|quel|quali|how|c[oó]mo|come|comment|com|when|cu[aá]ndo|quando|quan|onde|d[oó]nde|dove|o[uù]|on)(?=\s|$|[.,!?¿¡])/i.test(trimmed)) return false
  if (/lavatric|washer|lavadora|asciugatric|dryer|secadora|display|alm|door|push|sel|filtro|rotacion|aspiracion/i.test(trimmed)) {
    return false
  }
  // Don't-know phrases must not be captured as location — Caso 31 insists.
  if (/^(no\s+lo\s+s[eé]|no\s+s[eé]|no\s+me\s+acuerdo|ni\s+idea|no\s+tengo\s+idea)(?:\s|$|[.,!?])/i.test(trimmed)) {
    return false
  }
  // FAQ topic keywords disqualify a standalone location capture.
  if (/c[oó]digo|cobr|pag[uoa]|tarjeta|carta\s+fedelt|loyalty|datafono|factura|fattura|invoice|fatura|facture|recargar|ricaric|recharge|fidelizaci[oó]n|fidelit|horario|orario|orari|horaires?|hor[áa]rio|horari|opening|hours|cuesta|costa|cost|prezzo|precio|preu|pre[çc]o|price|prix|devolv|devu[ée]lv|reembolso|rimborso|refund|c[aá]maras|telecamere|cameras|ajax|monedas|monete|coins|dinero|denaro|money|gratis|free|gratuit|compensaci[oó]n|compensazione|compensation/i.test(trimmed)) {
    return false
  }
  return true
}

export function extractExplicitLocation(message: string): string | null {
  const explicit = message.match(/\b(?:sono a|sono in|mi trovo a|estoy en|estoy a|i am in|i'm in|i am at)\s+([A-Za-zÀ-ÿ' -]{2,40})/i)
  if (explicit) return explicit[1].split(/[.,!?]/)[0].trim()
  // Inline "en/a <Location>" pattern — single word after the preposition
  // (avoids eating sentences like "en realidad").
  const trailing = message.match(/\b(?:en|a)\s+([A-ZÀ-ÿ][a-zà-ÿ']{2,20})\b/i)
  if (trailing) {
    const candidate = trailing[1].split(/[.,!?]/)[0].trim()
    if (!/^(realidad|verdad|cuanto|qu[eé]|la|el|los|las|este|esta|cu[aá]l|que)$/i.test(candidate)) {
      return candidate
    }
  }
  return null
}
