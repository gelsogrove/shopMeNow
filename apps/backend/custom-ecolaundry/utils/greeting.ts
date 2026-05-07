// Pure greeting detector — boundary signal, not intent.
// Used by the greeting guard to short-circuit the LLM on turn 1 when the
// customer sends only a salutation and no operational content.
//
// Covers all 6 supported languages: es, it, en, ca, pt, fr.
// Rule #6: phrase detection is allowed for BOUNDARY SIGNALS (greetings,
// mixed-signals, contrast connectors). This is one of those cases.

const PURE_GREETING_RE =
  /^(¡?hola|buenos?\s+d[ií]as?|buenas(\s+tardes?|\s+noches?)?|ciao|buongiorno|buonasera|buonanotte|salve|hi|hello|hey|good\s+(morning|afternoon|evening)|ol[aá]|oi|bom\s+dia|boa\s+tarde|bonjour|bonsoir|bon\s+dia|bona\s+tarda|salut|bonne\s+nuit)[!,.\s]*$/i

/** True when the entire message is just a greeting with no operational content. */
export function isPureGreeting(message: string): boolean {
  return PURE_GREETING_RE.test(message.trim())
}
