// Web entrypoint — wraps `agent.ts:agentTurn` in the ChatbotInput/Output shape
// the CustomClientChatbotService expects. Behaviour stays identical to the CLI.

import { agentTurn, createAgentSession } from './agent.js'
import { autoExtractFacts } from './utils/agent-extract.js'
import { extractEscalationContext, buildEscalationSummary } from './utils/escalation.js'
import { logger } from './utils/logger.js'
import { sanitizePhoneNumber } from './utils/input-sanitize.js'

import type {
  AgentSession,
  ChatbotInput,
  ChatbotOutput,
  HistoryEntry,
} from './models/index.js'

// Fallbacks used only when settings.json omits the corresponding field.
const DEFAULT_HISTORY_RESET_TTL_MS = 60 * 60 * 1000
const DEFAULT_SESSION_IDLE_TTL_MS = 30 * 60 * 1000

const MAX_CACHED_SESSIONS = Math.max(
  100,
  parseInt(process.env.AGENT_SESSION_CACHE_MAX || '10000', 10) || 10000,
)

// Cap how many history entries we replay on cold start. Without this a malicious
// or buggy caller could pass tens of thousands of entries and force O(n)
// extraction work on the request thread (DoS).
const MAX_HISTORY_REPLAY = Math.max(
  10,
  parseInt(process.env.AGENT_MAX_HISTORY_REPLAY || '200', 10) || 200,
)

/**
 * Per-session cache keyed by sessionId. On multi-dyno deployments each process
 * holds its own cache; sticky state lost across dynos is reconstructed from
 * `input.context.history`. Production code MUST go through
 * `getOrCreateSession()` so cache caps and locks are honoured — direct access
 * is reserved for unit tests via the `__testing` export below.
 */
const sessionCache = new Map<
  string,
  { session: AgentSession; lastUsedAt: number }
>()

/**
 * Test-only handle on the internal cache. The `__testing` prefix marks it as
 * not part of the public API; production code must NOT import it.
 */
export const __testing = {
  sessionCache,
}

// Updated by getOrCreateSession() to the tenant-configured TTL so that
// evictIdleSessions() (which has no session context) honours it.
let cachedIdleTtlMs = DEFAULT_SESSION_IDLE_TTL_MS

const sessionLocks = new Map<string, Promise<unknown>>()

// ── Public API ────────────────────────────────────────────────────────────────

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  const agentChain: string[] = ['custom-ecolaundry']
  return withSessionLock(input.context.sessionId, () =>
    runChatbotTurn(input, agentChain),
  )
}

/**
 * Serialise turns of the SAME sessionId (different sessions still run in
 * parallel). In-process only: on multi-dyno deployments use sticky sessions
 * at the load balancer or a Postgres advisory lock for cross-process safety.
 */
export function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionLocks.get(sessionId) || Promise.resolve()
  const next = previous.then(fn, fn)
  const tracked: Promise<unknown> = next
    .then(() => undefined, () => undefined)
    .finally(() => {
      if (sessionLocks.get(sessionId) === tracked) {
        sessionLocks.delete(sessionId)
      }
    })
  sessionLocks.set(sessionId, tracked)
  return next
}

/** LRU-by-`lastUsedAt` eviction down to MAX_CACHED_SESSIONS. */
export function enforceCacheCap(): void {
  if (sessionCache.size < MAX_CACHED_SESSIONS) return
  const overflow = sessionCache.size - MAX_CACHED_SESSIONS + 1
  const entries = [...sessionCache.entries()].sort(
    (a, b) => a[1].lastUsedAt - b[1].lastUsedAt,
  )
  for (let i = 0; i < overflow && i < entries.length; i++) {
    sessionCache.delete(entries[i][0])
  }
}

/**
 * True when the most recent timestamped history entry is older than `resetTtlMs`,
 * meaning we should drop the cached session and start a brand-new conversation.
 * Returns false when timestamps are missing — in that case we keep replaying as-is.
 */
export function shouldResetHistory(history: HistoryEntry[], resetTtlMs: number): boolean {
  if (!history.length) return false
  for (let i = history.length - 1; i >= 0; i--) {
    const ts = history[i].timestamp
    if (!ts) continue
    const parsed = Date.parse(ts)
    if (Number.isNaN(parsed)) continue
    return Date.now() - parsed > resetTtlMs
  }
  return false
}

// ── Turn execution ────────────────────────────────────────────────────────────

async function runChatbotTurn(input: ChatbotInput, agentChain: string[]): Promise<ChatbotOutput> {
  try {
    const phoneNumber = sanitizePhoneNumber(input.context.phoneNumber)
    const session = await getOrCreateSession(
      input.context.sessionId,
      input.context.history,
      input.config.language,
      phoneNumber,
    )
    if (phoneNumber) {
      session.ar.state.customerPhone = phoneNumber
    }

    const reply = await agentTurn(session, input.userMessage)
    const { shouldEscalate, escalationSummary } = buildEscalationOutcome(session)

    return {
      reply,
      shouldEscalate,
      escalationSummary,
      meta: { tokensUsed: 0, agentChain },
    }
  } catch (error) {
    // Log the full error internally for debugging, but return a generic
    // message to the caller so we don't leak upstream details (API keys in
    // headers, internal hostnames, stack fragments) into the response body.
    logger.error('chatbot turn failed', {
      sessionId: input.context.sessionId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return {
      reply: null,
      shouldEscalate: false,
      error: 'agent_error',
      meta: { tokensUsed: 0, agentChain },
    }
  }
}

function buildEscalationOutcome(session: AgentSession): {
  shouldEscalate: boolean
  escalationSummary?: string
} {
  const { ar } = session
  const shouldEscalate = !!ar.pendingEscalation || ar.state.pendingClosure === 'escalated'
  if (!shouldEscalate || !ar.state.customerName) {
    return { shouldEscalate }
  }
  try {
    const ctx = extractEscalationContext(ar.state, ar.state.customerName)
    return { shouldEscalate, escalationSummary: buildEscalationSummary(ctx) }
  } catch (err) {
    logger.warn('Failed to build escalation summary', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { shouldEscalate }
  }
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

async function getOrCreateSession(
  sessionId: string,
  history: HistoryEntry[],
  language: ChatbotInput['config']['language'],
  phoneNumber?: string,
): Promise<AgentSession> {
  evictIdleSessions()

  const probeSession = sessionCache.get(sessionId)?.session
  const resetTtlMs =
    probeSession?.ar.runtime.settings.historyResetTtlMs ?? DEFAULT_HISTORY_RESET_TTL_MS
  const resetHistory = shouldResetHistory(history, resetTtlMs)
  if (resetHistory) sessionCache.delete(sessionId)

  if (!resetHistory) {
    const cached = sessionCache.get(sessionId)
    if (cached) {
      cached.lastUsedAt = Date.now()
      return cached.session
    }
  }

  const session = await createAgentSession()
  cachedIdleTtlMs = session.ar.runtime.settings.sessionIdleTtlMs ?? DEFAULT_SESSION_IDLE_TTL_MS

  replayHistoryIntoSession(session, resetHistory ? [] : history)
  if (phoneNumber) session.ar.state.customerPhone = phoneNumber
  applyTenantLanguage(session, language)

  enforceCacheCap()
  sessionCache.set(sessionId, { session, lastUsedAt: Date.now() })
  return session
}

function evictIdleSessions(): void {
  const now = Date.now()
  for (const [key, entry] of sessionCache) {
    if (now - entry.lastUsedAt > cachedIdleTtlMs) {
      sessionCache.delete(key)
    }
  }
}

/**
 * Replay caller-provided history so the agent has full context on cold starts
 * and multi-dyno failovers. We also re-run autoExtractFacts on each user
 * message so deterministic sticky state (location, machineType, …) is rebuilt
 * — without this, guards that depend on that state would never fire after a
 * cold start and the LLM would escalate prematurely.
 *
 * `customerName` is INTENTIONALLY not seeded from `input.userName`: registration
 * placeholders ("Unknown User-12345", "test1", phone numbers) are unsuitable
 * for the operator handover summary. customerName is set ONLY when the
 * customer types it in chat after the bot asks "¿Cómo te llamas?".
 */
function replayHistoryIntoSession(session: AgentSession, history: HistoryEntry[]): void {
  const trimmed =
    history.length > MAX_HISTORY_REPLAY ? history.slice(-MAX_HISTORY_REPLAY) : history
  if (trimmed.length < history.length) {
    logger.warn('History replay truncated to MAX_HISTORY_REPLAY', {
      received: history.length,
      kept: trimmed.length,
      cap: MAX_HISTORY_REPLAY,
    })
  }
  for (const entry of trimmed) {
    session.history.push({ role: entry.role, content: entry.content })
    if (entry.role !== 'user') continue
    try {
      autoExtractFacts(session.ar, entry.content)
    } catch (err) {
      logger.debug('autoExtractFacts threw during history replay; skipping entry', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/**
 * Honour `settings.enabledLanguages`: even if the caller passes a language
 * (phone prefix, browser locale, widget selector), fall back to
 * `defaultLanguage` when the requested one is disabled. This prevents
 * deterministic guards from rendering replies in a language the tenant
 * explicitly disabled.
 */
function applyTenantLanguage(
  session: AgentSession,
  language: ChatbotInput['config']['language'],
): void {
  const { enabledLanguages, defaultLanguage } = session.ar.runtime.settings
  const enabled = enabledLanguages || []
  const resolved = language && enabled.includes(language) ? language : defaultLanguage
  if (!resolved) return
  session.ar.state.language = resolved
  session.ar.state.preferredLanguage = resolved
}
