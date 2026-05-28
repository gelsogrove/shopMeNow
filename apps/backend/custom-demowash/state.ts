// Per-session state. In-RAM Map for POC. Production: Redis/DB with same API.

export interface SessionState {
  // Operational
  name?:        string
  location?:    string
  machineType?: 'washer' | 'dryer'
  machine?:     number
  displayCode?: string
  // Open ISO 2-letter language code. The deterministic detector below
  // only recognizes a handful of common languages — for everything else
  // the prompt instructs the LLM to detect and respond natively.
  language?:    string

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

// `KnownLang` is the closed set of languages with a deterministic regex
// detector below. `state.language` is intentionally wider (`string`) so
// the LLM can detect and reply in ANY language Claude supports — the
// prompt handles the long tail (Japanese, Russian, Hindi, etc.).
type KnownLang =
  | 'es' | 'ca' | 'en' | 'it' | 'fr' | 'pt' | 'de'
  | 'ar' | 'zh'
  | 'da' | 'uk' | 'pl' | 'fi' | 'el' | 'tr'

const DEFAULT_LANGUAGE: KnownLang = 'es'

// Each language has a single dense regex of distinctive words. Many tokens
// overlap across Romance languages on purpose — the winner is whoever
// accumulates more hits across the message. See language-detection.spec.ts.
//
// Arabic & Chinese use a different strategy: \b word boundary does not
// work for non-Latin scripts in JS regex, so we match any run of script-
// exclusive Unicode characters. Both scripts are exclusive — any run is a
// strong signal of that language.
//   - Arabic: ؀-ۿ block
//   - Chinese: CJK Unified Ideographs 一-鿿. NB: this overlaps with
//     Japanese kanji, but plain CJK ideograph runs (no hiragana/katakana)
//     are overwhelmingly Chinese in our context.
const LANG_MARKERS: Record<KnownLang, RegExp> = {
  it: /\b(che|non|sono|della|dello|delle|degli|gli|le|un|una|uno|perché|cosa|come|dove|quando|oggi|ieri|lavatrice|sapone)\b/i,
  es: /\b(hola|que|no|son|de|del|los|las|un|una|uno|porque|qué|cómo|dónde|cuándo|hoy|ayer|lavadora|jabón)\b/i,
  en: /\b(the|and|is|are|was|were|you|i|we|they|it|what|how|where|when|today|yesterday|washing|machine|soap)\b/i,
  ca: /\b(el|la|els|les|un|una|uns|unes|i|que|no|és|som|tenim|aquest|aquesta|aquests|aquestes|perquè|què|com|on|quan|avui|ahir|rentadora|sabó|hola)\b/i,
  pt: /\b(o|a|os|as|um|uma|uns|umas|e|que|não|é|são|está|estão|porque|como|onde|quando|hoje|ontem|máquina|sabão|olá|você|vocês)\b/i,
  fr: /\b(le|la|les|un|une|des|et|que|ne|pas|est|sont|j'ai|tu|nous|vous|ils|elles|pourquoi|comment|où|quand|aujourd'hui|hier|machine|savon|bonjour|merci|oui|non|qu'est-ce|c'est)\b/i,
  // German: high-signal closed-class words + a few domain nouns (Waschmaschine
  // / Waschsalon / Seife). Includes umlauts plus their ASCII fallbacks
  // (ae/oe/ue/ss) because German text is frequently typed without diacritics
  // on non-DE keyboards.
  de: /\b(der|die|das|den|dem|des|und|oder|nicht|ist|sind|war|waren|ich|du|wir|ihr|sie|es|was|wie|wo|wann|warum|heute|gestern|waschmaschine|waschsalon|seife|hallo|danke|ja|nein|für|fuer|ueber|über)\b/i,
  ar: /[؀-ۿ]+/,
  zh: /[一-鿿]+/,
  // Danish: closed-class words distinctive vs Norwegian/Swedish where possible
  // (hvad vs hva, hvornår vs når/när, sæbe vs såpe/tvål). Some overlap with
  // Norwegian Bokmål is unavoidable — accept it for the POC.
  da: /\b(jeg|ikke|hvad|hvordan|hvornår|tak|hej|også|sæbe|vaskemaskine|noget|meget|skal|vil|mig|dig|hvis|godt|sådan|hvor|må|får|går)\b/i,
  // Ukrainian: distinctive Cyrillic letters that Russian does not use
  // (і, ї, є, ґ). Any single occurrence is a strong signal.
  uk: /[іїєґІЇЄҐ]/,
  // Polish: closed-class words + Polish-specific diacritic letters
  // (ą, ć, ę, ł, ń, ś, ź, ż). The diacritics alone are enough to
  // distinguish from other Slavic Latin-script languages.
  pl: /\b(jest|nie|tak|czy|jak|gdzie|kiedy|dziś|wczoraj|pralka|mydło|cześć|dziękuję|witaj|który|tylko|bardzo|dobrze|już|jeszcze|teraz|dzień|dobry|przepraszam)\b|[ąćęłńśźż]/i,
  // Finnish: distinctive agglutinative words + ä/ö doublings. ei/on/joka
  // are very high-frequency Finnish closed-class words.
  fi: /\b(ei|on|olen|olet|joka|mitä|missä|milloin|miten|kuinka|tänään|eilen|pesukone|saippua|hei|kiitos|kyllä|minä|sinä|tämä|että|kun|jos|mutta|hyvä|paljon|jotain)\b/i,
  // Greek: Greek + Greek Extended Unicode blocks. Greek script is
  // exclusive — any run of these characters is a strong signal.
  el: /[Ͱ-Ͽἀ-῿]+/,
  // Turkish: high-frequency closed-class words + Turkish-specific letters
  // (ş, ğ, dotless ı). Distinguishes from German which shares ö/ü/ä.
  tr: /\b(ve|bir|bu|şu|değil|evet|hayır|nasıl|nerede|bugün|dün|çamaşır|sabun|merhaba|teşekkürler|lütfen|iyi|kötü|var|yok|istiyorum)\b|[şğı]/i,
}

const LANG_ORDER: KnownLang[] = [
  'es', 'it', 'en', 'ca', 'fr', 'pt', 'de',
  'ar', 'zh',
  'da', 'uk', 'pl', 'fi', 'el', 'tr',
]

/**
 * Score each language by counting marker matches in the text.
 * Exposed for testing.
 */
export function scoreLanguages(text: string): Record<KnownLang, number> {
  const normalized = (text || '').toLowerCase()
  const scores: Record<KnownLang, number> = {
    es: 0, it: 0, en: 0, ca: 0, fr: 0, pt: 0, de: 0,
    ar: 0, zh: 0,
    da: 0, uk: 0, pl: 0, fi: 0, el: 0, tr: 0,
  }
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
export function detectLanguageHeuristic(text: string): KnownLang | null {
  const scores = scoreLanguages(text)
  let best: KnownLang | null = null
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
export function updateLanguageOnTurn(sessionId: string, text: string): string {
  const state = getState(sessionId)
  // `current` is widened to `string` because state.language now accepts any
  // ISO 2-letter code (the LLM can reply in languages outside the closed
  // KnownLang set). When the current language is unknown to our regex
  // detector, we still apply the sticky/default policy below using the
  // string value verbatim.
  const current = state.language

  const scores = scoreLanguages(text)
  const maxScore = Math.max(...LANG_ORDER.map((l) => scores[l]))

  // No marker hits this turn → sticky on current, otherwise default.
  if (maxScore === 0) {
    const resolved: string = current ?? DEFAULT_LANGUAGE
    if (!current) updateState(sessionId, { language: resolved })
    return resolved
  }

  // Collect all languages tied at the top.
  const topLangs = LANG_ORDER.filter((l) => scores[l] === maxScore)

  // Tie-break: if the current language is one of the deterministic top
  // candidates, keep it (sticky). Otherwise default to 'es' if it's in
  // the top, else the first by LANG_ORDER.
  let winner: KnownLang
  if (current && (topLangs as readonly string[]).includes(current)) {
    winner = current as KnownLang
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
export function seedLanguageIfNeeded(sessionId: string, text: string): string {
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
