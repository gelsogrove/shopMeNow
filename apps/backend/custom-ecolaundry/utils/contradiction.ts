// Contradiction detector for the LLM-generated reply.
//
// The LLM occasionally produces a reply that contains BOTH a resolution
// marker ("incidencia resuelta", "all fixed") AND an escalation marker
// ("vamos a revisar tu caso manualmente"). This is logically incoherent —
// the case is either resolved or being escalated, not both.
//
// `detectResolutionEscalationContradiction` is pure and language-agnostic
// at the keyword level. The post-processor uses it to:
//   1. Detect the contradiction
//   2. Strip the resolution wording (the customer reported a NEW issue)
//   3. Log a warning for observability

const RESOLUTION_MARKERS = [
  // ES
  'incidencia resuelta',
  'caso resuelto',
  'todo resuelto',
  'ya está resuelto',
  // IT
  'incidenza risolta',
  'caso risolto',
  'tutto risolto',
  // EN
  'issue resolved',
  'case resolved',
  'all fixed',
  'all resolved',
  // CA
  'incidència resolta',
  'cas resolt',
  // PT
  'incidência resolvida',
  'caso resolvido',
  // FR
  'incident résolu',
  "cas résolu",
] as const

const ESCALATION_MARKERS = [
  // ES
  'revisar tu caso manualmente',
  'revisaremos tu caso',
  // IT
  'controlleremo il tuo caso',
  'rivedremo il tuo caso',
  // EN
  'review your case manually',
  'review the case manually',
  // CA
  'revisarem el teu cas',
  // PT
  'rever o teu caso',
  'rever o seu caso',
  // FR
  'examiner ton cas',
  'examiner votre cas',
] as const

function buildAnyMatchRegex(phrases: readonly string[]): RegExp {
  const escaped = phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`(${escaped.join('|')})`, 'iu')
}

const RESOLUTION_RE = buildAnyMatchRegex(RESOLUTION_MARKERS)
const ESCALATION_RE = buildAnyMatchRegex(ESCALATION_MARKERS)

export interface ContradictionReport {
  detected: boolean
  resolutionPhrase?: string
  escalationPhrase?: string
}

/** True iff the reply contains both a resolution AND an escalation marker. */
export function detectResolutionEscalationContradiction(
  reply: string,
): ContradictionReport {
  if (typeof reply !== 'string' || !reply) return { detected: false }
  const r = RESOLUTION_RE.exec(reply)
  if (!r) return { detected: false }
  const e = ESCALATION_RE.exec(reply)
  if (!e) return { detected: false }
  return { detected: true, resolutionPhrase: r[0], escalationPhrase: e[0] }
}

/**
 * True iff the reply contains a resolution marker (any language). Used as
 * a deterministic backstop when the LLM emits a closure phrase but forgets
 * to call the `mark_resolved` tool — the post-processor sets
 * `state.pendingClosure='resolved'` so the conversation state matches the
 * customer-facing message. CLAUDE.md regla #2: "tool refuses, LLM corrects"
 * has its companion: "LLM forgets, post-processor compensates".
 */
export function replyContainsResolutionMarker(reply: string): boolean {
  if (typeof reply !== 'string' || !reply) return false
  return RESOLUTION_RE.test(reply)
}

/**
 * Strip the resolution-marker sentence(s) from the reply. Splitting on
 * sentence terminators (.!?) keeps surrounding context intact and only
 * removes the offending sentence(s). Returns the cleaned reply.
 */
export function stripResolutionSentences(reply: string): string {
  if (typeof reply !== 'string' || !reply) return reply
  // Split on sentence terminators while keeping them attached to the
  // preceding chunk (lookbehind on [.!?]). Then drop chunks containing a
  // resolution marker.
  const sentences = reply.split(/(?<=[.!?])\s+/)
  const kept = sentences.filter((s) => !RESOLUTION_RE.test(s))
  if (kept.length === sentences.length) return reply
  return kept.join(' ').trim()
}
