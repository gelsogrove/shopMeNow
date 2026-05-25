// REFACTOR ONLY — pure move of detectDoubleChargeIntent from utils/intent.ts
// into a barrel-split cassette. Zero behavioural change. The regex bodies
// below are byte-identical to the originals in utils/intent.ts and remain
// exempt from iron rule #6 under the same "tracked exemption" recorded in
// CLAUDE.md and check-architecture.sh (Rule #6 exemption: topic-classifier
// fast-paths kept until ES is stable in production).
//
// History (regression catalogue): F15, F19, F31.
// Full design rationale and multi-language coverage plan: docs/usecases.md.

export function detectDoubleChargeIntent(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    /\bcobrad[ao]\s+(?:dos\s+veces|2\s+veces|m[aá]s\s+de\s+una\s+vez|el\s+doble|dos\s+cargos)\b/i.test(trimmed) ||
    /\bdoble\s+(?:cobro|cargo|cobr[ao]|pago)\b/i.test(trimmed) ||
    /\bcobr[oó]\s+dos\s+veces\b/i.test(trimmed) ||
    /\bcobraron\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\bcobraste\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\btarjeta\s+(?:cobrad[ao]|cargad[ao])\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\bdescontad[ao]\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\bcobro\s+(?:me\s+)?(?:ha\s+)?llegad[ao]\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\bllegad[ao]\s+(?:el\s+)?cobro\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\b2\s+(?:cargos|cobros)\b/i.test(trimmed) ||
    /\bme\s+(?:hizo|hicieron|han\s+hecho|ha\s+hecho)\s+pagar\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\bpag(?:u[eé]|ado|ar)\s+(?:dos\s+veces|2\s+veces)\b/i.test(trimmed) ||
    /\baddebitat[ao]\s+due\s+volte\b/i.test(trimmed) ||
    /\bdoppio\s+(?:addebito|pagamento)\b/i.test(trimmed) ||
    /\b(?:fatt[oa]|fatti)\s+pagare\s+(?:due\s+volte|2\s+volte)\b/i.test(trimmed) ||
    /\bpag(?:ato|are|hi)\s+(?:due\s+volte|2\s+volte)\b/i.test(trimmed) ||
    /\bcharged\s+(?:me\s+)?twice\b/i.test(trimmed) ||
    /\bcharged\s+(?:me\s+)?two\s+times\b/i.test(trimmed) ||
    /\bdouble\s+(?:charge|payment)\b/i.test(trimmed) ||
    /\bpaid\s+twice\b/i.test(trimmed) ||
    /\bmade\s+me\s+pay\s+twice\b/i.test(trimmed) ||
    /\bcobrad[ao]\s+(?:duas\s+vezes|2\s+vezes)\b/i.test(trimmed) ||
    /\bcobran[çc]a\s+dupla\b/i.test(trimmed) ||
    /\bpag(?:uei|o|ar)\s+(?:duas\s+vezes|2\s+vezes)\b/i.test(trimmed) ||
    /\bcobrat\s+(?:dues\s+vegades|2\s+vegades)\b/i.test(trimmed) ||
    /\bcobrament\s+doble\b/i.test(trimmed) ||
    /\bpagat\s+(?:dues\s+vegades|2\s+vegades)\b/i.test(trimmed) ||
    /\bd[eé]bit[eé]\s+deux\s+fois\b/i.test(trimmed) ||
    /\bdouble\s+(?:d[eé]bit|paiement)\b/i.test(trimmed) ||
    /\bpay[eé]\s+deux\s+fois\b/i.test(trimmed)
  )
}
