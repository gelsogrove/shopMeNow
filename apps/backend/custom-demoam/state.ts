// Per-session state. In-RAM Map, same pattern as custom-demorobot/state.ts.
// Production: Redis/DB with the same API.

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

// The runtime shape of one flow node + its outgoing edges, as needed by
// flow-machine.ts's advance(). Mirrors custom-demorobot's FlowGraphNodeSnapshot.
export interface FlowGraphNodeSnapshot {
  id: string
  question: string
  fieldKey?: string | null
  terminalType?: string | null
  outgoingEdges: Array<{ label: string; targetNodeId: string | null; triggersEscalation?: boolean }>
}

/**
 * The turn's intent, decided once by the LLM (steps.md Step 2) and then
 * pinned for the rest of that path — never re-evaluated turn over turn, same
 * "once chosen, stays on that track" rule as custom-demorobot's flow
 * attachment. 'troubleshooting' only applies while a flow from the catalogue
 * is actually attached (currentNodeId set); before that, or when no flow
 * matches, the conversation runs through the shared pre-operator gate same as
 * a complaint.
 */
export type IntentCategory = 'complaint' | 'faq' | 'troubleshooting'

export interface SessionState {
  intent?: IntentCategory

  // Flow attachment (troubleshooting path only) — identical mechanism to
  // custom-demorobot.
  activeFlowId?: string
  activeFlowHash?: string
  activeFlowGraphSnapshot?: FlowGraphNodeSnapshot[]
  currentNodeId?: string

  // Facts collected along the attached flow, keyed by FlowNode.fieldKey.
  collectedData?: Record<string, JsonValue>

  // Operational
  name?: string
  serialNumber?: string

  // True once the FAQ-not-found short-circuit (steps.md 2-B.3) was taken:
  // the pre-operator gate's technical fields were deliberately skipped, so
  // the operator briefing must say so rather than showing them as merely
  // "not provided" — that would read as the customer refused to answer,
  // when in fact the case was never a technical diagnosis.
  skippedTechnicalGate?: boolean

  // Open ISO 2-letter language code — decided by the LLM via the ⟦LANG:xx⟧
  // trailer, never a regex detector on user text (CLAUDE.md §14).
  language?: string

  // True while `language` is only a hint seeded from the host rather than a
  // language the LLM has actually replied in. Cleared for good the first
  // time commitLanguageFromReply runs.
  languageIsSeed?: boolean

  // Set once at session init (steps.md Step 1) so the LLM knows which of
  // welcomeMessage / welcomeBackMessage to open with, without re-deciding it
  // every hop. 'returning' also carries whether the customer was away long
  // enough for welcome-back wording (see WELCOME_BACK_STALE_MS in agent.ts).
  greeting?: 'new' | 'returning' | 'none'
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
  /**
   * How many times escalation has been held back to ask for each field, keyed
   * by field name — per-field, not one shared counter (custom-demorobot
   * state.ts: a single counter let one ignored question open the gate for
   * every remaining field). Also carries the serial-number invalid-format
   * attempt count (key 'serialNumber_invalid'), per-session per steps.md's
   * confirmed decision — not persisted (see dehydrateState below).
   */
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
      escalatedReasons: new Set(),
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

export function mergeCollectedData(sessionId: string, patch: Record<string, JsonValue>): SessionState {
  const e = entry(sessionId)
  e.state.collectedData = { ...(e.state.collectedData ?? {}), ...patch }
  return e.state
}

export function attachFlow(
  sessionId: string,
  flowId: string,
  hash: string,
  graph?: { nodes: FlowGraphNodeSnapshot[]; rootNodeId: string | null },
): void {
  updateState(
    sessionId,
    {
      activeFlowId: flowId,
      activeFlowHash: hash,
      activeFlowGraphSnapshot: graph?.nodes,
      currentNodeId: graph?.rootNodeId ?? undefined,
    },
    { mirror: false },
  )
}

export function detachFlow(sessionId: string): void {
  const e = entry(sessionId)
  e.state.activeFlowId = undefined
  e.state.activeFlowHash = undefined
  e.state.activeFlowGraphSnapshot = undefined
  e.state.currentNodeId = undefined
}

export function resetState(sessionId: string): void {
  sessions.delete(sessionId)
}

// ── Persistence ───────────────────────────────────────────────────────────
// Same rationale as custom-demorobot/state.ts: Heroku restarts dynos daily and
// runs more than one, so durable facts (collectedData, name, serialNumber,
// language, the attached flow) are mirrored into ChatSession.context. Ask
// counters, turnCount and rate-limit timestamps stay per-process on purpose —
// re-hydrating them across dynos would give a false sense of enforcement
// (steps.md's confirmed decision: the 3-attempt serial counter is
// per-session, i.e. also per-process, not persisted).

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
 * - Empty history + unknown name  -> 'new'       (first contact ever)
 * - Empty history + known name    -> 'returning' (known customer, new chat)
 * - Last message older than staleMs -> 'returning' (came back after a while)
 * - Otherwise                     -> 'none'      (conversation in progress)
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
  const { historyLength, lastMessageAtMs, hasKnownName, nowMs, staleMs } = params

  if (historyLength === 0) {
    return hasKnownName ? 'returning' : 'new'
  }
  if (lastMessageAtMs !== undefined && nowMs - lastMessageAtMs > staleMs) {
    return 'returning'
  }
  return 'none'
}

export function formatStateForPrompt(state: SessionState): string {
  const fields: string[] = []
  if (state.name) fields.push(`Customer name: ${state.name}`)
  if (state.serialNumber) fields.push(`Serial number: ${state.serialNumber}`)
  if (state.intent) fields.push(`Classified intent: ${state.intent}`)
  if (state.collectedData && Object.keys(state.collectedData).length > 0) {
    fields.push(`Collected data: ${JSON.stringify(state.collectedData)}`)
  }
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
        : `- No language is set yet (this is the first message). Detect the language from the customer's message — even a single word is enough. If the message carries NO language signal at all (a bare number, a name, "ok"), use ${seed}.`,
    hasLang
      ? `- ONLY switch away from ${state.language} if the customer's latest message is a REAL sentence (roughly 3+ meaningful words) clearly written in another language.`
      : `- The workspace default is the fallback when the very first message is genuinely undecidable.`,
    '- A serial number or error code the customer reads off is DATA, not language — it never changes the conversation language.',
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
