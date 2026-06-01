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

export function updateState(
  sessionId: string,
  patch: Partial<SessionState>,
  // When `mirror` is false the state is updated in RAM but NO backend patch is
  // emitted. Use this for DEFAULTS / SEEDS that must not be persisted to the
  // Customers table — e.g. seeding the language from the host's `customer.language`
  // (itself only a phone-prefix guess) or the sticky-default fallback when a turn
  // has no language markers. Only a REAL content detection should write the
  // Customers.language column, otherwise an ambiguous message ("5", "Barcelona")
  // would demote a correctly detected language back to the default.
  opts: { mirror?: boolean } = {},
): SessionState {
  const { mirror = true } = opts
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
        if (mirror && MIRRORED_KEYS.includes(k)) {
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

// ── Language: decided by the LLM, not by regex ───────────────────────────────
// Iron rule #1 (no regex detector on user text). The previous design scored
// the message against per-language word lists; on real production messages it
// was only ~60-65% accurate, because Romance function words (la, no, un, que…)
// collide across es/ca/it/pt/fr. "He pagado pero la máquina no arranca" scored
// ca > es purely on shared words. We removed that detector entirely.
//
// New design (the "sentinel trailer"):
//   • The LLM replies in the customer's language (it judges this natively) and
//     appends a control marker `⟦LANG:xx⟧` on the last line of the SAME reply.
//   • `extractLanguage` splits that marker off the reply text (the marker is
//     NEVER shown to the customer).
//   • `commitLanguageFromReply` writes the code to state — and only a real,
//     valid code mirrors to the Customers table (mirror:true). A missing or
//     invalid marker is a no-op: the prior language stays (sticky), so an
//     ambiguous message ("5", "Barcelona", "ok") never demotes the language.
//
// Why this does NOT bring back the T1 empty-reply bug: the language is plain
// TEXT in the completion, appended AFTER the reply — it is not a tool call, so
// it adds no extra hop and the model cannot "finish" via a tool before writing
// the reply. ZERO extra LLM calls: the code rides along the reply we already
// generate every turn.
//
// Policy: Spanish ('es') is the business default, used only as the seed when no
// language has ever been set for the session.

const DEFAULT_LANGUAGE = 'es'

// ISO 639-1 two-letter codes we accept from the trailer. Kept permissive (the
// LLM may legitimately reply in any of these); anything else is treated as a
// hallucinated code and ignored (no-op, sticky).
const VALID_ISO = new Set<string>([
  'es', 'it', 'en', 'ca', 'pt', 'fr', 'de',
  'ar', 'zh', 'da', 'uk', 'pl', 'fi', 'el', 'tr',
  'nl', 'ru', 'ja', 'ko', 'hi', 'sv', 'no', 'cs', 'ro', 'hu',
])

function isValidIso(lang: string): boolean {
  return VALID_ISO.has(lang.toLowerCase())
}

// The control marker the LLM appends on its own line, e.g. `⟦LANG:es⟧`.
// Anchored to end-of-string and built from rare glyphs (⟦ ⟧) so it can never
// collide with real customer-facing text.
const LANG_TRAILER = /⟦LANG:([a-z]{2})⟧\s*$/i
// Belt-and-suspenders: strip ANY trailer occurrence before sending to the
// customer, even a malformed/mid-text one.
const LANG_TRAILER_GLOBAL = /⟦LANG:[a-z]{2}⟧/gi

/**
 * Split the LLM completion into the customer-facing reply and the language
 * code it declared. Returns `lang: null` when there is no valid trailer.
 * The returned `reply` always has every trailer marker removed.
 */
export function extractLanguage(raw: string): { reply: string; lang: string | null } {
  const text = raw || ''
  const m = text.match(LANG_TRAILER)
  const lang = m ? m[1].toLowerCase() : null
  // Remove the trailing marker (and any stray ones) so the customer never sees it.
  const reply = text.replace(LANG_TRAILER_GLOBAL, '').trim()
  return { reply, lang }
}

/**
 * Persist the language the LLM declared for this turn.
 * - null / invalid code → no-op: the prior language stays (sticky). An
 *   ambiguous message therefore never demotes a correctly known language.
 * - a valid, changed code → updateState with mirroring ON, so it flows through
 *   MIRRORED_KEYS → drainPatches → applyCustomerPatches → Customers.language.
 */
export function commitLanguageFromReply(sessionId: string, lang: string | null): void {
  if (!lang || !isValidIso(lang)) return
  const state = getState(sessionId)
  if (lang !== state.language) {
    updateState(sessionId, { language: lang })
  }
}

/**
 * Seed the session language from a host-provided hint (e.g. customer.language,
 * itself only a phone-prefix guess). Seeds ONLY when nothing is set yet, and
 * with mirror:false so this guess is never written back to the DB. The real
 * value comes later from the LLM trailer via commitLanguageFromReply.
 */
export function seedLanguageIfNeeded(sessionId: string, seed?: string | null): string {
  const state = getState(sessionId)
  if (state.language) return state.language
  const resolved = seed && isValidIso(seed) ? seed.toLowerCase() : DEFAULT_LANGUAGE
  updateState(sessionId, { language: resolved }, { mirror: false })
  return resolved
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
  if (state.language) {
    // The CURRENT language is the one to KEEP when the new message has no
    // language signal (a bare number, a place name, an emoji, "ok"). It is a
    // hint, not a lock — the LLM re-judges the language from the customer's
    // latest message each turn (see the LANGUAGE block below).
    fields.push(`Current language: ${state.language} (keep this if the new message is too short/ambiguous to tell)`)
  }

  // Language is owned by the LLM now (no regex detector). These two blocks are
  // ALWAYS injected (even before any language is set) so the model both replies
  // in the right language AND emits the ⟦LANG:xx⟧ control trailer the host reads.
  const seed = state.language ?? DEFAULT_LANGUAGE
  const hasLang = !!state.language
  const languageBlock = [
    '## LANGUAGE',
    hasLang
      // Language already established → hysteresis: keep it unless the customer
      // CLEARLY switches with a real sentence. A short/isolated token must NOT
      // flip it. This is what stops "Gràcia" / "OPEN DOOR" / "5" from changing
      // an Italian conversation into Spanish/Catalan/English.
      ? `- The conversation language is already **${state.language}**. KEEP replying in ${state.language}.`
      // First message (no language yet) → detect from whatever the customer
      // wrote, even a single word. "Ciao" → it, "merci" → fr, "gracias" → es.
      : `- No language is set yet (this is the first message). Detect the language from the customer's message — even a single word like "Ciao", "merci", "gracias" is enough. If the message carries NO language signal at all (a bare number "5", a name "Andrea", a place name "Barcelona", "ok", a machine/display code like "OPEN DOOR"), use ${seed}.`,
    hasLang
      ? `- ONLY switch away from ${state.language} if the customer's latest message is a REAL sentence (roughly 3+ meaningful words) clearly written in another language. A single word, a name, a place ("Gràcia"/"Eixample"), a number, an emoji, "ok", or a machine/display code ("OPEN DOOR", "ERR-01") is NOT enough to switch — keep ${state.language}.`
      : `- Spanish ("es") is the business default when the very first message is genuinely undecidable.`,
    '- A machine/display CODE the customer reads off the screen ("OPEN DOOR", "OPEN", "ERR-01", "ALERT", "BLOCK") is DATA, not language — it never changes the conversation language.',
    '- ⚠️ The LOCATIONS / data blocks contain Catalan place names and labels used AS DATA. Judge the language ONLY from what the CUSTOMER wrote — never let Catalan data pull your reply into Catalan. Copy data values (prices, hours, machine numbers) but write all labels/sentences in the customer\'s language.',
    '',
    '## OUTPUT FORMAT (mandatory, every turn)',
    '1. Write your normal reply to the customer, in the language chosen above.',
    '2. Then, on a NEW LINE by itself after the reply, output exactly:',
    '   ⟦LANG:xx⟧',
    '   where xx is the ISO 639-1 code of the language you just replied in (es, it, en, ca, pt, fr, de, ar, zh, …).',
    '- The ⟦LANG:xx⟧ line is a control marker: it is removed before the customer sees it. Never describe it, never translate it, never put anything after it.',
    '- NEVER output ⟦LANG:xx⟧ on its own — it must always follow a real, non-empty reply.',
  ].join('\n')

  const stateBlock = fields.length > 0
    ? ['', '═══ SESSION STATE ═══', ...fields].join('\n')
    : ''
  return [stateBlock, '', languageBlock, ''].join('\n')
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
