// Per-session state. In-RAM Map, same pattern as custom-demowash/state.ts.
// Production: Redis/DB with the same API.

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface SessionState {
  // Retrieval / flow attachment (analisi.md §10, specs/demorobot-chatbot-runtime)
  activeModelId?: string
  activeFlowId?: string
  activeFlowHash?: string
  activeFlowPromptSnapshot?: string

  // Facts collected along the attached flow, keyed by FlowNode.fieldKey.
  // No currentNode/pendingQuestion — position is inferred by the LLM every
  // turn from compiledPrompt + history + collectedData (design.md Decision 13).
  collectedData?: Record<string, JsonValue>

  // Operational
  name?: string
  serialNumber?: string

  // Open ISO 2-letter language code — decided by the LLM via the ⟦LANG:xx⟧
  // trailer, never a regex detector on user text (CLAUDE.md §14).
  language?: string

  // True while `language` is only a hint seeded from the host (registration
  // form / customer record) rather than a language the LLM has actually
  // replied in. A seeded language must not lock the conversation: a customer
  // who registered as "en" and then writes "hola" must get Spanish back.
  // Cleared for good the first time commitLanguageFromReply runs.
  languageIsSeed?: boolean
}

export type PatchKey = 'name' | 'language' | 'serialNumber'

export interface CustomerPatch {
  key: PatchKey
  value: string
}

interface SessionEntry {
  state: SessionState
  patches: CustomerPatch[]
  turnCount: number
  recentMessageTimestamps: number[]
  escalatedReasons: Set<string>
  /** How many times escalation has been held back to ask for the customer name. */
  nameRequestCount: number
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
      escalatedReasons: new Set(),
      nameRequestCount: 0,
    }
    sessions.set(sessionId, e)
  }
  return e
}

/**
 * Counts the attempts to escalate while the customer name is still unknown.
 *
 * Andrea 2026-08-02: the bot asks for a name before handing over to an
 * operator, but must not hold the customer hostage over it. Counting the
 * attempts lets it ask once and give up on the second try — no phrase
 * detection on user text is involved (CLAUDE.md §14), so "no", "preferisco
 * non dirlo" and silence all behave the same.
 */
export function registerNameRequest(sessionId: string): number {
  const e = entry(sessionId)
  e.nameRequestCount += 1
  return e.nameRequestCount
}

export function getState(sessionId: string): SessionState {
  return entry(sessionId).state
}

const MIRRORED_KEYS: ReadonlyArray<keyof SessionState> = ['name', 'language', 'serialNumber']

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

// Merge semantics for collectedData (specs/demorobot-chatbot-runtime
// implicit via the `remember` tool contract) — never a blind replace, since
// facts accumulate across turns as the flow progresses.
export function mergeCollectedData(sessionId: string, patch: Record<string, JsonValue>): SessionState {
  const e = entry(sessionId)
  e.state.collectedData = { ...(e.state.collectedData ?? {}), ...patch }
  return e.state
}

// specs/demorobot-chatbot-runtime "Flow snapshot isolates in-flight
// conversations from edits": attach a flow by freezing its compiled content
// into the session, so a later edit to the Flow row never changes an
// in-progress conversation's prompt.
export function attachFlow(sessionId: string, flowId: string, hash: string, promptSnapshot: string): void {
  updateState(sessionId, { activeFlowId: flowId, activeFlowHash: hash, activeFlowPromptSnapshot: promptSnapshot }, { mirror: false })
}

export function detachFlow(sessionId: string): void {
  const e = entry(sessionId)
  e.state.activeFlowId = undefined
  e.state.activeFlowHash = undefined
  e.state.activeFlowPromptSnapshot = undefined
}

export function resetState(sessionId: string): void {
  sessions.delete(sessionId)
}

// ── Persistence ───────────────────────────────────────────────────────────
// Andrea 2026-08-01: the Map above is per-process. Heroku restarts dynos daily
// and runs more than one, so a customer used to lose their serial number,
// language and in-flight flow mid-conversation. State is now mirrored into
// ChatSession.context (an existing Json column — no migration needed).
//
// The public API stays synchronous on purpose: making getState/updateState
// async would change every call site in agent.ts and the tool handlers. The
// host instead hydrates once before a turn and flushes once after it, so the
// hot path keeps reading from RAM.
//
// Only durable facts are persisted. turnCount, rate-limit timestamps and
// escalatedReasons are per-process guards and are intentionally left out:
// re-hydrating them across dynos would give a false sense of enforcement.

/** Shape stored under ChatSession.context.demorobot. */
interface PersistedState {
  state: SessionState
  patches: CustomerPatch[]
}

/**
 * Load previously persisted state into the in-RAM map. Call once at the start
 * of a turn, before any getState/updateState. Existing in-memory state wins:
 * if this process already handled a turn for the session, its data is fresher
 * than what was flushed earlier.
 */
export function hydrateState(sessionId: string, persisted: unknown): void {
  if (!persisted || typeof persisted !== 'object') return

  const p = persisted as Partial<PersistedState>
  if (!p.state || typeof p.state !== 'object') return

  const e = entry(sessionId)
  // Merge, never overwrite: keys already set in this process are newer.
  for (const k of Object.keys(p.state) as Array<keyof SessionState>) {
    if ((e.state as Record<string, unknown>)[k] === undefined) {
      ;(e.state as Record<string, unknown>)[k] = (p.state as Record<string, unknown>)[k]
    }
  }
  if (Array.isArray(p.patches) && e.patches.length === 0) {
    e.patches = p.patches
  }
}

/**
 * Snapshot the durable part of the session, to be written by the host into
 * ChatSession.context. Returns null when there is nothing worth storing, so
 * the caller can skip the write entirely.
 */
export function dehydrateState(sessionId: string): PersistedState | null {
  const e = sessions.get(sessionId)
  if (!e) return null
  if (Object.keys(e.state).length === 0 && e.patches.length === 0) return null
  return { state: e.state, patches: e.patches }
}

export function markEscalationOnce(sessionId: string, reason: string): boolean {
  const e = entry(sessionId)
  if (e.escalatedReasons.has(reason)) return false
  e.escalatedReasons.add(reason)
  return true
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

// ── Language: identical mechanism to custom-demowash/state.ts ──────────────
// Sticky-language sentinel trailer, extended with 'da' (Danish) per
// analisi.md §11. See custom-demowash/state.ts for the full rationale
// (iron rule: no regex language detector on user text).

const DEFAULT_LANGUAGE = 'en'

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
  // The LLM has now replied in this language, so it is no longer a mere hint
  // from the customer profile — from here on it is sticky.
  if (state.languageIsSeed) {
    entry(sessionId).state.languageIsSeed = undefined
  }
}

/**
 * Seeds the conversation language from what the host already knows (widget
 * registration form, customer record). Marked as a seed, NOT a decision: the
 * prompt treats it as a hint until the LLM commits a language of its own.
 *
 * Never overwrites a language already present — a real one from a previous
 * turn always wins.
 */
export function seedLanguageIfNeeded(sessionId: string, seed?: string | null): string {
  const state = getState(sessionId)
  if (state.language) return state.language
  const resolved = seed && isValidIso(seed) ? seed.toLowerCase() : DEFAULT_LANGUAGE
  updateState(sessionId, { language: resolved }, { mirror: false })
  entry(sessionId).state.languageIsSeed = true
  return resolved
}

export function formatStateForPrompt(state: SessionState): string {
  const fields: string[] = []
  if (state.name) fields.push(`Customer name: ${state.name}`)
  if (state.serialNumber) fields.push(`Serial number: ${state.serialNumber}`)
  if (state.activeModelId) fields.push(`Resolved robot model: ${state.activeModelId}`)
  if (state.collectedData && Object.keys(state.collectedData).length > 0) {
    fields.push(`Collected data: ${JSON.stringify(state.collectedData)}`)
  }
  if (state.language) {
    fields.push(`Current language: ${state.language} (keep this if the new message is too short/ambiguous to tell)`)
  }

  const seed = state.language ?? DEFAULT_LANGUAGE
  // A language that came from the registration form / customer record is only
  // a HINT: the customer may well write in another one. It becomes binding
  // once the LLM has actually replied in it and committed it via ⟦LANG:xx⟧.
  const hasLang = !!state.language && !state.languageIsSeed
  const languageBlock = [
    '## LANGUAGE (authoritative — overrides any language instruction above)',
    hasLang
      ? `- The conversation language is already **${state.language}**. KEEP replying in ${state.language}.`
      : state.languageIsSeed
        ? `- The customer's profile suggests **${state.language}**, but that is only a hint. Detect the language from THIS message and reply in it — even a single word is enough. Use ${seed} only when the message carries no language signal at all.`
        : `- No language is set yet (this is the first message). Detect the language from the customer's message — even a single word is enough. If the message carries NO language signal at all (a bare number, a name, "ok"), use ${seed}.`,
    hasLang
      ? `- ONLY switch away from ${state.language} if the customer's latest message is a REAL sentence (roughly 3+ meaningful words) clearly written in another language.`
      : `- English ("en") is the business default when the very first message is genuinely undecidable.`,
    '- A serial number or error code the customer reads off the robot is DATA, not language — it never changes the conversation language.',
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
