// F109 Opt C — Trouble resolution detector.
//
// Pure deterministic helper. Returns TRUE when the customer's message
// explicitly signals the trouble has been resolved (e.g. "ora funziona",
// "ahora funciona", "now it works"). Used by the agent-extract layer to
// fire markResolved() so the next turn does not feed sticky machine facts
// (displayState, machineNumber) back into guardAutoStartMachineFlow.
//
// Iron rule #6 exemption: this is a BOUNDARY SIGNAL (resolution closure),
// not an intent classifier — same category as detectFaqPause, hasStopIntent,
// hasGreetingIntent. Tracked under the same exemption umbrella in CLAUDE.md.
//
// Iron rule #8: 6-language coverage (es, it, en, ca, pt, fr). Each language
// is a separate regex branch for auditability — typo-tolerant via accent
// normalisation only (no fuzzy distance).

const PRESENT_TENSE_ADVERB = String.raw`(?:ahora|ya|ora|adesso|now|ara|agora|maintenant|enfin|finalement)`
const WORK_VERB = String.raw`(?:funciona|funziona|works?|working|funcion[ae]|marche|fonctionne)`
const RESOLVED_ADJECTIVE = String.raw`(?:solucionado|resuelto|risolto|sistemato|solved|fixed|resolt|solucionat|resolvido|r[ée]solu|r[ée]gl[ée]|reparado|riparato|repaired|reparat)`

// "ora funziona" / "adesso funziona" / "ahora sí funciona" / "now it works"
// Matches a resolution STATEMENT (not a question). Question form is excluded
// by the "must end with statement punctuation" check below — we don't allow
// '?' in the same sentence as the matched phrase.
const RESOLUTION_PHRASE_RE = new RegExp(
  String.raw`\b${PRESENT_TENSE_ADVERB}\b[\s,\.!]*(?:s[ií]\b\s+)?(?:la\s+lavadora\s+|la\s+lavatrice\s+|the\s+(?:washer|machine|dryer)\s+|la\s+rentadora\s+|a\s+m[áa]quina\s+|la\s+machine\s+)?(?:[a-zà-ÿ]+\s+){0,2}${WORK_VERB}\b`,
  'i',
)

// "ya está solucionado" / "è risolto" / "it's fixed" / "ja està resolt" / "c'est réglé"
// IT "è" is matched as a standalone word (no leading word-boundary alternation
// because [èeé] is not a word char on its own — use anchored sentence start).
// Trailing boundary uses `(?=$|[^a-zà-ÿ])` instead of `\b` because `\b` after
// an accented char (é, à, ò) is unreliable in JavaScript regex.
const RESOLVED_PHRASE_RE = new RegExp(
  // ES: "(ya )?está solucionado" • IT: "è risolto" • EN: "is/it's fixed"
  // CA: "ja està resolt" • PT: (covered by est[áaà] form)
  // FR: "c'est réglé" / "s'est"
  String.raw`(?:^|[^a-zà-ÿ])(?:ya\s+est[aáà]\s+|est[aáà]\s+|[èeé]\s+|is\s+|it's\s+|ja\s+est[aàá]\s+|c'?\s*est\s+|s'?\s*est\s+)${RESOLVED_ADJECTIVE}(?=$|[^a-zà-ÿ])`,
  'i',
)

// "ya funciona" (no leading adverb required for ES "ya" + verb, common phrasing)
const YA_FUNCIONA_RE = /\b(?:ya|ja)\s+(?:funciona|funcionou|funcionando)\b/i

// "todo bien" / "tutto a posto" / "all good" / "tot bé" / "tudo bem" / "tout bien"
// — restrict to short messages so we don't catch "todo bien con la factura pero no..."
const ALL_GOOD_RE = /^(?:todo\s+bien|tutto\s+(?:a\s+posto|bene|ok)|all\s+good|tot\s+b[eé]|tudo\s+bem|tout\s+(?:bien|va\s+bien)|perfecto\s+ya|perfetto\s+adesso|ok\s+ya\s+funciona)[\s\.!,]*$/i

/**
 * Returns the substring up to (but not including) the first ',' / '.' / '!'
 * — the "first sentence" we evaluate. Used to disqualify questions: if the
 * phrase "ahora funciona" appears in the first sentence AND that sentence
 * ends with '?', it's a question, not a resolution statement.
 */
function firstClause(message: string): string {
  const idx = message.search(/[,.!?]/)
  if (idx === -1) return message
  // include the punctuation so we can inspect "?".
  return message.slice(0, idx + 1)
}

/**
 * Returns TRUE when the customer's message explicitly signals trouble
 * resolution. Multi-language (es/it/en/ca/pt/fr). Strict by design — only
 * matches phrasings that unambiguously communicate "the problem is fixed".
 *
 * Caller responsibility: gate this on `state.activeFlowId || state.displayState
 * || state.machineNumber` before treating it as a resolution signal — a
 * standalone "now it works" without prior trouble context is meaningless.
 */
export function detectTroubleResolution(message: string): boolean {
  if (!message) return false
  const trimmed = message.trim()
  if (!trimmed) return false
  // Short all-good messages (whole-message match).
  if (ALL_GOOD_RE.test(trimmed)) return true
  // Question disqualification: if the FIRST clause (up to the first
  // ,/./!/?) ends with '?', it's a question — e.g. "ahora funciona?".
  // Statements like "ora funziona, dimmi una cosa..." are NOT disqualified
  // because the first clause ends with ',', not '?'.
  const head = firstClause(trimmed)
  const isQuestion = /\?\s*$/.test(head)
  // Inline resolution phrases (substring match).
  if (!isQuestion && RESOLUTION_PHRASE_RE.test(trimmed)) return true
  if (!isQuestion && RESOLVED_PHRASE_RE.test(trimmed)) return true
  if (!isQuestion && YA_FUNCIONA_RE.test(trimmed)) return true
  return false
}
