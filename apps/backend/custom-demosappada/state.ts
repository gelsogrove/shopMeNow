// Per-session state. In-RAM Map, same pattern as custom-demorobot/state.ts.
// Production: Redis/DB with the same API.

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }


export interface SessionState {
  // Operational — the only customer fact this module collects. There is no
  // intake, no case, no device: a tourist asks a question and gets an answer.
  name?: string

  // Open ISO 2-letter language code — decided by the LLM via the ⟦LANG:xx⟧
  // trailer, never a regex detector on user text (CLAUDE.md §14).
  language?: string

  // True while `language` is only a hint seeded from the host rather than a
  // language the LLM has actually replied in. Cleared for good the first
  // time commitLanguageFromReply runs.
  languageIsSeed?: boolean

  // Set once at session init so the LLM knows which of welcomeMessage /
  // welcomeBackMessage to open with, without re-deciding it every hop.
  greeting?: 'new' | 'returning' | 'none'

  // True once the presentation video has been sent in this session. The video
  // belongs to the first turn only; a second one is spam.
  videoSent?: boolean

  // How many turns in a row an intake question was dictated without the model
  // actually putting it to the guest. A question is only retired once it has
  // reached them, so this is the escape hatch: after two failed attempts it is
  // retired anyway, rather than blocking the queue for the rest of the stay.
  intakeMisses?: Record<string, number>

  // The intake question the guest LAST saw — set when it goes out. The
  // answer-capture writes the guest's words into a field only when the
  // pending question is this one: capturing into whatever happened to be
  // dictated NEXT filed "2 bambini di 8 e 10 anni" under `constraints`
  // (2026-08-25).
  lastAskedKey?: string
}

export type PatchKey = 'name' | 'language' | 'phone'

export interface CustomerPatch {
  key: PatchKey
  value: string
}

interface SessionEntry {
  state: SessionState
  patches: CustomerPatch[]
  turnCount: number
  recentMessageTimestamps: number[]
  /** Per-field ask counters, used to bound repeated questions. Per-process. */
  askedCounts: Record<string, number>
}

const sessions = new Map<string, SessionEntry>()

function entry(sessionId: string): SessionEntry {
  let e = sessions.get(sessionId)
  if (!e) {
    e = {
      state: {},
      patches: [],
      turnCount: 0,
      recentMessageTimestamps: [],
      askedCounts: {},
    }
    sessions.set(sessionId, e)
  }
  return e
}

export function registerFieldRequest(sessionId: string, field: string): number {
  const e = entry(sessionId)
  e.askedCounts[field] = (e.askedCounts[field] ?? 0) + 1
  return e.askedCounts[field]
}

export function getAskedCounts(sessionId: string): Readonly<Record<string, number>> {
  return entry(sessionId).askedCounts
}

export function getState(sessionId: string): SessionState {
  return entry(sessionId).state
}

const MIRRORED_KEYS: ReadonlyArray<keyof SessionState> = ['name', 'language']

export function updateState(
  sessionId: string,
  patch: Partial<SessionState>,
  opts: { mirror?: boolean } = {},
): SessionState {
  const { mirror = true } = opts
  const e = entry(sessionId)
  for (const k of Object.keys(patch) as Array<keyof SessionState>) {
    const v = patch[k]
    if (v !== undefined && v !== null && v !== '') {
      const prev = (e.state as Record<string, unknown>)[k]
      if (prev !== v) {
        ;(e.state as Record<string, unknown>)[k] = v
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

// ── Persistence ───────────────────────────────────────────────────────────
// Same rationale as custom-demorobot/state.ts: Heroku restarts dynos daily and
// runs more than one, so durable facts (name, language, greeting, videoSent)
// are mirrored into ChatSession.context. Ask counters, turnCount and
// rate-limit timestamps stay per-process on purpose — re-hydrating them
// across dynos would give a false sense of enforcement.

interface PersistedState {
  state: SessionState
  patches: CustomerPatch[]
}

export function hydrateState(sessionId: string, persisted: unknown): void {
  if (!persisted || typeof persisted !== 'object') return

  const p = persisted as Partial<PersistedState>
  if (!p.state || typeof p.state !== 'object') return

  const e = entry(sessionId)
  for (const k of Object.keys(p.state) as Array<keyof SessionState>) {
    if ((e.state as Record<string, unknown>)[k] === undefined) {
      ;(e.state as Record<string, unknown>)[k] = (p.state as Record<string, unknown>)[k]
    }
  }
  if (Array.isArray(p.patches) && e.patches.length === 0) {
    e.patches = p.patches
  }
}

export function dehydrateState(sessionId: string): PersistedState | null {
  const e = sessions.get(sessionId)
  if (!e) return null
  if (Object.keys(e.state).length === 0 && e.patches.length === 0) return null
  return { state: e.state, patches: e.patches }
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

// ── Language: identical mechanism to custom-demorobot/state.ts ─────────────
// Sticky-language sentinel trailer. Iron rule: no regex language detector on
// user text (CLAUDE.md §14) — the LLM decides and commits via ⟦LANG:xx⟧.

const VALID_ISO = new Set<string>([
  'en', 'it', 'es', 'da',
  'ar', 'zh', 'uk', 'pl', 'fi', 'el', 'tr', 'ca', 'pt', 'fr', 'de',
  'nl', 'ru', 'ja', 'ko', 'hi', 'sv', 'no', 'cs', 'ro', 'hu',
])

function isValidIso(lang: string): boolean {
  return VALID_ISO.has(lang.toLowerCase())
}

const LANG_TRAILER = /⟦LANG:([a-z]{2})⟧\s*$/i
const LANG_TRAILER_GLOBAL = /⟦LANG:[a-z]{2}⟧/gi

export function extractLanguage(raw: string): { reply: string; lang: string | null } {
  const text = raw || ''
  const m = text.match(LANG_TRAILER)
  const lang = m ? m[1].toLowerCase() : null
  const reply = text.replace(LANG_TRAILER_GLOBAL, '').trim()
  return { reply, lang }
}

export function commitLanguageFromReply(sessionId: string, lang: string | null): void {
  if (!lang || !isValidIso(lang)) return
  const state = getState(sessionId)
  if (lang !== state.language) {
    updateState(sessionId, { language: lang })
  }
  if (state.languageIsSeed) {
    entry(sessionId).state.languageIsSeed = undefined
  }
}

/**
 * Seeds the conversation language from what the host already knows, but only
 * when it is in `enabledLanguages` — otherwise falls back to `defaultLanguage`
 * (steps.md Step 1.4). Never overwrites a language already present.
 */
export function seedLanguageIfNeeded(
  sessionId: string,
  seed: string | null | undefined,
  enabledLanguages: readonly string[],
  defaultLanguage: string,
): string {
  const state = getState(sessionId)
  if (state.language) return state.language

  const normalizedSeed = seed && isValidIso(seed) ? seed.toLowerCase() : null
  const resolved =
    normalizedSeed && enabledLanguages.includes(normalizedSeed) ? normalizedSeed : defaultLanguage

  updateState(sessionId, { language: resolved }, { mirror: false })
  entry(sessionId).state.languageIsSeed = true
  return resolved
}

/**
 * Filters an LLM-detected reply language against `enabledLanguages` before
 * committing it (steps.md Step 1.4: "solo se presente in enabledLanguages,
 * altrimenti defaultLanguage"). Distinct from commitLanguageFromReply's own
 * ISO validity check — this is the enabled-language gate on top of it.
 */
export function resolveEnabledLanguage(
  lang: string,
  enabledLanguages: readonly string[],
  defaultLanguage: string,
): string {
  const normalized = lang.toLowerCase()
  return enabledLanguages.includes(normalized) ? normalized : defaultLanguage
}

// ── Greeting: decided by CODE from facts the host already provides ─────────
// steps.md Step 1.2/1.3: new customer -> welcomeMessage, known customer away
// for longer than the staleness threshold -> welcomeBackMessage, otherwise
// no greeting (mid-conversation). Derived from the history the host already
// passes (entries carry ISO timestamps) plus whether we know the customer's
// name — no new host plumbing, no LLM guessing which greeting applies.

export type Greeting = 'new' | 'returning' | 'none'

/**
 * Pure function: which greeting is due right now.
 *
 * - Empty history                   -> 'new'       (first contact)
 * - Last message older than staleMs -> 'returning' (came back after a while)
 * - Otherwise                       -> 'none'      (conversation in progress)
 *
 * What separates "new" from "returning" is having CONVERSED before, not being
 * known by name. The support modules this descends from keyed it on the name,
 * which works when the name arrives from an existing customer record — but
 * here the tourist types their name into the widget's registration form
 * seconds before the first message. That made a brand-new visitor "returning",
 * so they got the welcome-back line and never saw the welcome or the
 * presentation video (Andrea, 2026-08-23: "al welcome non lo vedo").
 *
 * `hasKnownName` stays in the signature: the caller passes it, and the
 * welcome-back copy is addressed by name when we have one.
 */
export function resolveGreeting(params: {
  historyLength: number
  /** Epoch ms of the last history entry, when the history carries timestamps. */
  lastMessageAtMs?: number
  /** Whether the customer is already known by name (session state or host). */
  hasKnownName: boolean
  nowMs: number
  staleMs: number
}): Greeting {
  const { historyLength, lastMessageAtMs, nowMs, staleMs } = params

  if (historyLength === 0) return 'new'
  if (lastMessageAtMs !== undefined && nowMs - lastMessageAtMs > staleMs) {
    return 'returning'
  }
  return 'none'
}

export function formatStateForPrompt(state: SessionState): string {
  const fields: string[] = []
  if (state.name) fields.push(`Customer name: ${state.name}`)
  if (state.language) {
    fields.push(`Current language: ${state.language} (keep this if the new message is too short/ambiguous to tell)`)
  }

  const seed = state.language ?? 'en'
  const hasLang = !!state.language && !state.languageIsSeed
  const languageBlock = [
    '## LANGUAGE (authoritative — overrides any language instruction above)',
    hasLang
      ? `- The conversation language is already **${state.language}**. KEEP replying in ${state.language}.`
      : state.languageIsSeed
        ? `- The customer's profile suggests **${state.language}**, but that is only a hint. Detect the language from THIS message and reply in it — even a single word is enough. Use ${seed} only when the message carries no language signal at all.`
        : `- No language is set yet (this is the first message). 🚨 Detect the language from the customer's OWN WORDS and reply in THAT language — "hola", "guten Tag", "hello" is already enough, and the workspace default must NEVER override a clear signal in the message. A guest who wrote in Spanish and was answered in Italian has been told, in effect, that nobody read what they wrote. Use ${seed} ONLY when the message carries no language signal at all (a bare number, a name, an emoji).`,
    hasLang
      ? `- ONLY switch away from ${state.language} if the customer's latest message is a REAL sentence (roughly 3+ meaningful words) clearly written in another language.`
      : `- The workspace default is the fallback when the very first message is genuinely undecidable.`,
    '- A place name, a phone number or a price the customer reads off is DATA, not language — it never changes the conversation language.',
    '- Only reply in a language actually enabled for this workspace; if the customer writes in an unsupported language, reply in the workspace default and continue.',
    '',
    '## OUTPUT FORMAT (mandatory, every turn)',
    '1. Write your normal reply to the customer, in the language chosen above.',
    '2. Then, on a NEW LINE by itself after the reply, output exactly:',
    '   ⟦LANG:xx⟧',
    '   where xx is the ISO 639-1 code of the language you just replied in.',
    '- The ⟦LANG:xx⟧ line is a control marker: it is removed before the customer sees it. Never describe it, never translate it, never put anything after it.',
    '- NEVER output ⟦LANG:xx⟧ on its own — it must always follow a real, non-empty reply.',
  ].join('\n')

  const stateBlock = fields.length > 0 ? ['', '═══ SESSION STATE ═══', ...fields].join('\n') : ''
  return [stateBlock, '', languageBlock, ''].join('\n')
}

export function formatStateOneLine(state: SessionState): string {
  const parts: string[] = []
  for (const k of Object.keys(state) as Array<keyof SessionState>) {
    const v = state[k]
    if (v !== undefined && v !== null && v !== '') {
      parts.push(`${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`)
    }
  }
  return parts.join(' ') || '(empty)'
}
