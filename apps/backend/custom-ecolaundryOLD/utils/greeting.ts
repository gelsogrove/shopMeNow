// Pure greeting detector — boundary signal, not intent.
// Used by the greeting guard to short-circuit the LLM on turn 1 when the
// customer sends only a salutation and no operational content.
//
// Covers all 6 supported languages: es, it, en, ca, pt, fr.
// Rule #6: phrase detection is allowed for BOUNDARY SIGNALS (greetings,
// mixed-signals, contrast connectors). This is one of those cases.

import { PURE_GREETING_RE } from './patterns.js'

/** True when the entire message is just a greeting with no operational content. */
export function isPureGreeting(message: string): boolean {
  return PURE_GREETING_RE.test(message.trim())
}
