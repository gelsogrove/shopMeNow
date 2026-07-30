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
}

const sessions = new Map<string, SessionEntry>()

function entry(sessionId: string): SessionEntry {
  let e = sessions.get(sessionId)
  if (!e) {
    e = { state: {}, patches: [], turnCount: 0, recentMessageTimestamps: [], escalatedReasons: new Set() }
    sessions.set(sessionId, e)
  }
  return e
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
}

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
  if (state.serialNumber) fields.push(`Serial number: ${state.serialNumber}`)
  if (state.activeModelId) fields.push(`Resolved robot model: ${state.activeModelId}`)
  if (state.collectedData && Object.keys(state.collectedData).length > 0) {
    fields.push(`Collected data: ${JSON.stringify(state.collectedData)}`)
  }
  if (state.language) {
    fields.push(`Current language: ${state.language} (keep this if the new message is too short/ambiguous to tell)`)
  }

  const seed = state.language ?? DEFAULT_LANGUAGE
  const hasLang = !!state.language
  const languageBlock = [
    '## LANGUAGE',
    hasLang
      ? `- The conversation language is already **${state.language}**. KEEP replying in ${state.language}.`
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
