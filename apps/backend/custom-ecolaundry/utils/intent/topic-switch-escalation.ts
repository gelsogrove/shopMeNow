// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3. Body moved verbatim. Iron rule #5 not applicable (depth-2
// file, out of `find utils -maxdepth 1` scope). Coverage in intent.test.ts.
//
// detectTopicSwitchDuringEscalation is a composite signal: it delegates to
// other detectors (display, payment, discount) — each already under its
// tracked rule #6 exemption. Plus a small set of "ahora me sale X" phrasings
// that are themselves boundary-signal style (allowed under rule #6).

import { extractDisplayState } from './display.js'
import { detectDoubleChargeIntent } from './payment-charge.js'
import { detectDiscountCodeIntent } from './discount-code.js'

export function detectTopicSwitchDuringEscalation(message: string): boolean {
  const trimmed = message.toLowerCase()
  if (!trimmed) return false
  return (
    extractDisplayState(message) !== null ||
    detectDoubleChargeIntent(message) ||
    detectDiscountCodeIntent(message) ||
    /\b(?:ahora\s+(?:me\s+)?(?:sale|aparece|pone|dice)|mi\s+da|me\s+sale|aparece|adesso\s+mi\s+(?:da|appare))\b/i.test(trimmed) ||
    /\b(?:la\s+lavadora|la\s+secadora|the\s+(?:washer|dryer))\s+(?:no\s+(?:funciona|arranca|va)|sigue|otra\s+vez|otra)/i.test(trimmed)
  )
}
