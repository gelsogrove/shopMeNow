// Per-session state. In-RAM Map for POC. Production: Redis/DB with same API.

export interface SessionState {
  // Operational
  name?:        string
  location?:    string
  machineType?: 'washer' | 'dryer'
  machine?:     number
  displayCode?: string
  language?:    'es' | 'ca' | 'en' | 'it' | 'fr' | 'pt'

  // Profile (also mirrored to backend Customers via patches)
  companyName?: string
  address?:     string
  phone?:       string
  notes?:       string

  // PII — server-only, NEVER mirrored to patches, NEVER re-emitted in LLM input
  // unless captured by the customer in the current turn (initial pre-scan).
  email?:       string
  cif?:         string
  nif?:         string
  iban?:        string
  cardFull?:    string
  cardLast4?:   string
}

// Patches that the backend should persist into the Customers table.
// Accumulated during a turn (via `remember`) and drained by `chatbotFn`
// to return to the host app.
export type PatchKey = 'name' | 'language' | 'phone' | 'company' | 'address' | 'notes'

export interface CustomerPatch {
  key: PatchKey
  value: string
}

interface SessionEntry {
  state: SessionState
  patches: CustomerPatch[]
  turnCount: number
  recentMessageTimestamps: number[]
}

const sessions = new Map<string, SessionEntry>()

function entry(sessionId: string): SessionEntry {
  let e = sessions.get(sessionId)
  if (!e) {
    e = { state: {}, patches: [], turnCount: 0, recentMessageTimestamps: [] }
    sessions.set(sessionId, e)
  }
  return e
}

export function getState(sessionId: string): SessionState {
  return entry(sessionId).state
}

export function updateState(sessionId: string, patch: Partial<SessionState>): SessionState {
  const e = entry(sessionId)
  for (const k of Object.keys(patch) as Array<keyof SessionState>) {
    const v = patch[k]
    if (v !== undefined && v !== null && v !== '') {
      const prev = (e.state as Record<string, unknown>)[k]
      if (prev !== v) {
        (e.state as Record<string, unknown>)[k] = v
        // Mirror to backend-persistable patches when the key has a Customers
        // column. Keep last-write-wins by overwriting any earlier patch of
        // the same key.
        // IMPORTANT: PII fields (email, cif, nif, iban, cardFull, cardLast4)
        // are deliberately NOT mirrored to patches — they are server-only,
        // captured by the pre-scan layer (pii.ts), and travel separately
        // (e.g. via escalation email payloads, never via Customers profile).
        const MIRRORED_KEYS: ReadonlyArray<keyof SessionState> = [
          'name', 'language', 'companyName', 'address', 'phone', 'notes',
        ]
        if (MIRRORED_KEYS.includes(k)) {
          const patchKey = k as PatchKey
          e.patches = e.patches.filter((p) => p.key !== patchKey)
          e.patches.push({ key: patchKey, value: String(v) })
        }
      }
    }
  }
  return e.state
}

export function resetState(sessionId: string): void {
  sessions.delete(sessionId)
}

export function drainPatches(sessionId: string): CustomerPatch[] {
  const e = entry(sessionId)
  const out = e.patches
  e.patches = []
  return out
}

export function incrementTurn(sessionId: string): number {
  const e = entry(sessionId)
  e.turnCount += 1
  return e.turnCount
}

export function getTurnCount(sessionId: string): number {
  return entry(sessionId).turnCount
}

export function registerMessageTimestamp(sessionId: string, now: number, windowMs: number): number {
  const e = entry(sessionId)
  e.recentMessageTimestamps = e.recentMessageTimestamps.filter((t) => now - t < windowMs)
  e.recentMessageTimestamps.push(now)
  return e.recentMessageTimestamps.length
}

// ── Deterministic language detection ─────────────────────────────────────────
// Scoring heuristic over distinctive words per language. Called by the
// orchestrator BEFORE the LLM turn so the model never has to emit a
// `remember({language})` tool call — that used to cause the T1 empty-reply
// bug (model "completed the task" with the tool, then produced empty text
// at hop 2).
//
// Policy (decided 2026-05-28 with Andrea):
//   1. Default language = 'es' (business operates in Spain).
//   2. Re-evaluate on every turn (no permanent lock). This fixes the bug
//      where "Hola" → es, then a Catalan reply stayed in Spanish forever.
//   3. Sticky on 0-match: if the current turn has no marker hits and a
//      language is already set, keep it (so "ok"/"👍" don't reset to es).
//   4. Tie-break: if the current language ties with another at the top,
//      keep the current one (sticky). Otherwise default to 'es'.

type Lang = NonNullable<SessionState['language']>

const DEFAULT_LANGUAGE: Lang = 'es'

// Each language has a single dense regex of distinctive words. Many tokens
// overlap across Romance languages on purpose — the winner is whoever
// accumulates more hits across the message. See language-detection.spec.ts.
const LANG_MARKERS: Record<Lang, RegExp> = {
  it: /\b(che|non|sono|della|dello|delle|degli|gli|le|un|una|uno|perché|cosa|come|dove|quando|oggi|ieri|lavatrice|sapone)\b/i,
  es: /\b(hola|que|no|son|de|del|los|las|un|una|uno|porque|qué|cómo|dónde|cuándo|hoy|ayer|lavadora|jabón)\b/i,
  en: /\b(the|and|is|are|was|were|you|i|we|they|it|what|how|where|when|today|yesterday|washing|machine|soap)\b/i,
  ca: /\b(el|la|els|les|un|una|uns|unes|i|que|no|és|som|tenim|aquest|aquesta|aquests|aquestes|perquè|què|com|on|quan|avui|ahir|rentadora|sabó|hola)\b/i,
  pt: /\b(o|a|os|as|um|uma|uns|umas|e|que|não|é|são|está|estão|porque|como|onde|quando|hoje|ontem|máquina|sabão|olá|você|vocês)\b/i,
  fr: /\b(le|la|les|un|une|des|et|que|ne|pas|est|sont|j'ai|tu|nous|vous|ils|elles|pourquoi|comment|où|quand|aujourd'hui|hier|machine|savon|bonjour|merci|oui|non|qu'est-ce|c'est)\b/i,
}

const LANG_ORDER: Lang[] = ['es', 'it', 'en', 'ca', 'fr', 'pt']

/**
 * Score each language by counting marker matches in the text.
 * Exposed for testing.
 */
export function scoreLanguages(text: string): Record<Lang, number> {
  const normalized = (text || '').toLowerCase()
  const scores: Record<Lang, number> = { es: 0, it: 0, en: 0, ca: 0, fr: 0, pt: 0 }
  if (!normalized.trim()) return scores
  for (const lang of LANG_ORDER) {
    const re = new RegExp(LANG_MARKERS[lang].source, LANG_MARKERS[lang].flags + 'g')
    const matches = normalized.match(re)
    if (matches) scores[lang] = matches.length
  }
  return scores
}

/**
 * Stateless detection: returns the highest-scoring language, or null if
 * nothing matches. Used internally by `updateLanguageOnTurn` and exposed
 * for tests. Tie-break here is deterministic by LANG_ORDER (es first) —
 * the sticky/default policy is applied one level up.
 */
export function detectLanguageHeuristic(text: string): Lang | null {
  const scores = scoreLanguages(text)
  let best: Lang | null = null
  let bestScore = 0
  for (const lang of LANG_ORDER) {
    if (scores[lang] > bestScore) {
      best = lang
      bestScore = scores[lang]
    }
  }
  return bestScore >= 1 ? best : null
}

/**
 * Per-turn language update with the policy described in the file header.
 * Returns the language that should be used for the current turn.
 *
 * - If the message has no marker hits: keep current (or default to 'es' if
 *   no language was ever set).
 * - If the message has hits: pick the top scorer. On tie with the current
 *   language, stay sticky. Otherwise switch.
 *
 * `seedLanguageIfNeeded` is kept as a backward-compatible alias so callers
 * in agent.ts don't need to change.
 */
export function updateLanguageOnTurn(sessionId: string, text: string): Lang {
  const state = getState(sessionId)
  const current = state.language

  const scores = scoreLanguages(text)
  const maxScore = Math.max(...LANG_ORDER.map((l) => scores[l]))

  // No marker hits this turn → sticky on current, otherwise default.
  if (maxScore === 0) {
    const resolved: Lang = current ?? DEFAULT_LANGUAGE
    if (!current) updateState(sessionId, { language: resolved })
    return resolved
  }

  // Collect all languages tied at the top.
  const topLangs = LANG_ORDER.filter((l) => scores[l] === maxScore)

  // Tie-break: if the current language is among the top, keep it (sticky).
  // Otherwise default to 'es' if it's in the top, else the first by LANG_ORDER.
  let winner: Lang
  if (current && topLangs.includes(current)) {
    winner = current
  } else if (topLangs.includes(DEFAULT_LANGUAGE)) {
    winner = DEFAULT_LANGUAGE
  } else {
    winner = topLangs[0]
  }

  if (winner !== current) {
    updateState(sessionId, { language: winner })
  }
  return winner
}

/**
 * @deprecated Backward-compatible alias for `updateLanguageOnTurn`.
 * Kept so agent.ts:814 keeps working without modification.
 */
export function seedLanguageIfNeeded(sessionId: string, text: string): Lang {
  return updateLanguageOnTurn(sessionId, text)
}

export function formatStateForPrompt(state: SessionState): string {
  const fields: string[] = []
  if (state.name) fields.push(`Customer name: ${state.name}`)
  if (state.location) fields.push(`Active location: ${state.location}`)
  if (state.machine !== undefined) {
    const type = state.machineType ? ` (${state.machineType})` : ''
    fields.push(`Machine: ${state.machine}${type}`)
  } else if (state.machineType) {
    fields.push(`Machine type: ${state.machineType}`)
  }
  if (state.displayCode) fields.push(`Display: ${state.displayCode}`)
  if (state.language) fields.push(`Language: ${state.language}`)
  if (fields.length === 0) return ''
  return ['', '═══ SESSION STATE ═══', ...fields, ''].join('\n')
}

export function formatStateOneLine(state: SessionState): string {
  // PII fields are redacted in the debug output too — never log real values.
  const PII_KEYS = new Set<keyof SessionState>(['email', 'cif', 'nif', 'iban', 'cardFull', 'cardLast4', 'phone'])
  const parts: string[] = []
  for (const k of Object.keys(state) as Array<keyof SessionState>) {
    const v = state[k]
    if (v !== undefined && v !== null && v !== '') {
      const display = PII_KEYS.has(k) ? '[REDACTED]' : v
      parts.push(`${k}=${display}`)
    }
  }
  return parts.join(' ') || '(empty)'
}
