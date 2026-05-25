// Display-unreadable intent detection — customer reports the pantalla
// cannot be read. Triggers the photo-or-escalate path.
// Code moved verbatim from utils/intent.ts (zero behavioural change).
// See docs/usecases.md and docs/f-log.md (F20) for the design rationale,
// multi-language coverage plan, and regression history.

export function detectDisplayUnreadableIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  if (!lower) return false
  return (
    /\bno\s+s[eé]\s+(?:qu[eé]|que)\s+(?:pone|sale|aparece|dice|est[áa]\s+escrito)\b/i.test(lower) ||
    /\bno\s+veo\s+(?:bien\s+)?(?:la\s+pantalla|lo\s+que)\b/i.test(lower) ||
    /\bno\s+puedo\s+leer\s+la\s+pantalla\b/i.test(lower) ||
    /\bpero\s+no\s+s[eé]\s+qu[eé]\b/i.test(lower) ||
    /\bpantalla\s+(?:apagad[ao]|rot[ao]|borros[ao]|negr[ao]|estropead[ao]|defectuos[ao]|en\s+blanco|sin\s+luz|no\s+funciona|no\s+enciende|no\s+se\s+ve)\b/i.test(lower) ||
    /\b(?:la\s+)?pantalla\s+est[áa]\s+(?:apagad[ao]|rot[ao]|borros[ao]|negr[ao]|estropead[ao]|defectuos[ao]|en\s+blanco|rayad[ao])\b/i.test(lower) ||
    /\best[áa]\s+(?:en\s+blanco|apagad[ao]|negr[ao]|borros[ao])\b/i.test(lower) ||
    /\bno\s+(?:puedo|s[eé])\s+(?:leer|ver|entender)\s+(?:bien\s+)?(?:el\s+|la\s+)?display\b/i.test(lower) ||
    /\bno\s+se\s+(?:ve|entiende)\s+(?:bien\s+|nada\s+)?(?:en\s+)?(?:la\s+)?pantalla\b/i.test(lower) ||
    /\bno\s+entiendo\s+(?:lo\s+que\s+)?(?:pone|aparece|dice|sale)\b/i.test(lower) ||
    /\b(?:est[áa]|esta)\s+(?:toda\s+)?(?:rayad[ao]|rot[ao]|estropead[ao]|borros[ao])\s+la\s+pantalla\b/i.test(lower)
  )
}
