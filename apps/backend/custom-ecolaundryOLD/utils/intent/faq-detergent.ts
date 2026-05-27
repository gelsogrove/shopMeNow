// approved-by-andrea: REFACTOR ONLY — file split of utils/intent.ts per
// iron rule #3 (>150 lines). Zero behavioural change. Every regex below is
// moved BYTE-IDENTICAL from utils/intent.ts:detectDetergentFaqIntent. The
// new file location does not change rule #6 status: the original function
// was already a tracked-exemption FAQ topic guard (F67) — same status
// applies post-move. Tests (intent.test.ts) verify zero diff.

import { POST_CYCLE_FOAM_RE, FOAM_WORD_RE, DETERGENT_NEGATIVE_MARKER_RE, DETERGENT_WORD_RE, DETERGENT_NO_SHORTHAND_RE } from '../patterns.js'

export function detectDetergentFaqIntent(message: string): boolean {
  const trimmed = message.toLowerCase().trim()
  if (!trimmed) return false

  if (POST_CYCLE_FOAM_RE.test(trimmed) && FOAM_WORD_RE.test(trimmed)) return false

  if (DETERGENT_NEGATIVE_MARKER_RE.test(trimmed) && DETERGENT_WORD_RE.test(trimmed)) return true
  if (DETERGENT_NO_SHORTHAND_RE.test(trimmed)) return true

  if (/(hay\s+(?:jab[oó]n|detergente?|suavizante)|traigo\s+(?:jab[oó]n|detergente?|suavizante)|(?:jab[oó]n|detergente?|suavizante)\s+(?:incluido|viene|hay)|c'[eè]\s+(?:il\s+)?(?:sapone|detersivo|ammorbidente?)|(?:devo|bisogna|occorre)\s+portare\s+(?:il\s+)?(?:sapone|detersivo|ammorbidente?)|(?:sapone|detersivo|ammorbidente?)\s+(?:inclus[oa]|[eè]\s+compres[oa])|is\s+there\s+(?:soap|detergent|softener)|(?:soap|detergent|softener)\s+included|do\s+I\s+(?:need\s+to\s+bring|have\s+to\s+bring)\s+(?:soap|detergent)|tem\s+sab[aã]o|preciso\s+(?:de\s+)?trazer\s+(?:sab[aã]o|detergente?)|sab[aã]o\s+incluído|hi\s+ha\s+sab[oó]|cal\s+(?:portar|dur)\s+detergent|y\s+a[-\s]t[-\s]il\s+(?:du\s+)?(?:savon|lessive)|(?:apporter|amener)\s+(?:du\s+)?(?:savon|lessive|d[eé]tergent))/i.test(trimmed)) return true

  if (/^\s*[¿¡]?\s*(?:el?\s+|la\s+|lo\s+|il\s+|o\s+|les?\s+)?(?:jab[oó]n|detergente?|suavizante|sapone|detersivo|ammorbidente?|soap|detergent|softener|sab[aã]o|sab[oó]|savon|lessive|assouplissant)[?!.]*\s*$/.test(trimmed)) return true

  return false
}
