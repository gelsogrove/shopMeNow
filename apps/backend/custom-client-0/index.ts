// Web entrypoint — REUSES the same agent.ts orchestration that the CLI runs.
//
// Why this file exists:
//   - The CLI (`npm run demo`) starts at `agent.ts:agentTurn`.
//   - The web stack (CustomClientChatbotService) imports the chatbot folder
//     and expects a function `chatbotFn(input) → ChatbotOutput` on the entry.
//
// To guarantee CLI ≡ Web (same behaviour everywhere), we:
//   1. Build an AgentSession (reusing createAgentSession),
//   2. Replay the history coming from the chat-engine into the session
//      so the agent has full conversational context,
//   3. Run a single agentTurn() — the SAME function used by the CLI,
//   4. Translate AgentTurn's string reply + state flags into the
//      ChatbotOutput shape the web service expects.
//
// Anything you change in `agent.ts` is automatically reflected on both sides.

import {
  agentTurn,
  createAgentSession,
} from './agent.js'
import { autoExtractFacts } from './utils/agent-extract.js'
import { extractEscalationContext, buildEscalationSummary } from './utils/escalation.js'
import { extractExplicitLocation } from './utils/intent.js'
import { resolveKnownLocation } from './utils/message-parsing.js'

import type {
  AgentSession,
  ChatbotInput,
  ChatbotOutput,
  HistoryEntry,
} from './models/index.js'

// Fallback values when settings.json omits the fields.
const DEFAULT_LOCATION_CARRY_OVER_MS = 60 * 60 * 1000  // 1 hour
const DEFAULT_SESSION_IDLE_TTL_MS    = 30 * 60 * 1000  // 30 minutes

// Per-session cache of agent runtimes. Keyed by sessionId so concurrent
// customers do not stomp on each other's sticky facts. Entries are evicted
// after `cachedIdleTtlMs` of inactivity to keep memory bounded.
//
// NOTE: each Node process has its own cache. On a multi-dyno deployment a
// customer's next message may land on a different dyno; in that case the
// session is reconstructed from `input.context.history` (passed in by the
// caller) so the bot still has context — only the DETERMINISTIC sticky-state
// (`location`, `displayState`, …) is lost across dynos. That is the same
// guarantee the CLI gives, so behaviour stays consistent.
// Exported only for unit tests — production code MUST go through
// getOrCreateSession() so cache caps and locks are honoured.
export const sessionCache = new Map<
  string,
  { session: AgentSession; lastUsedAt: number }
>()

// Hard cap on cached sessions to prevent unbounded memory growth under load.
// Default ~10k entries × ~30KB each ≈ 300MB peak. Override via env var when
// provisioning larger Node processes.
const MAX_CACHED_SESSIONS = Math.max(
  100,
  parseInt(process.env.AGENT_SESSION_CACHE_MAX || '10000', 10) || 10000,
)

// Per-session async lock. Two messages from the SAME sessionId are serialised
// (the second await chains on the first), but messages from DIFFERENT sessions
// run in parallel as before. This prevents race conditions where two concurrent
// turns mutate `session.ar.state` (location, displayState, machineNumber, …)
// at the same time — which under load corrupts the conversation state.
//
// SCOPE: this lock is INSIDE-PROCESS only. On a multi-dyno deployment, two
// turns of the same sessionId could land on different dynos and bypass it.
// Mitigation paths (in order of cost/benefit):
//   - Sticky session at the load balancer level (Heroku: session affinity,
//     ALB: `stickiness`). Cheapest, no code change. Recommended for current scale.
//   - Postgres advisory locks (`pg_try_advisory_lock(hash(sessionId))`) for
//     cross-process serialisation. Adds ~5-20ms per turn but works with any
//     number of dynos. Do this when sticky session is not feasible.
//   - Redis-based distributed lock (Redlock). Most robust, requires Redis.
//
// Map entry is removed when the chain settles, so memory stays bounded by
// the number of currently in-flight sessions, not historical traffic.
const sessionLocks = new Map<string, Promise<unknown>>()

export function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionLocks.get(sessionId) || Promise.resolve()
  // Run fn after `previous` settles regardless of outcome (then(fn, fn) means
  // the new turn fires whether the prior one fulfilled or rejected — a single
  // failing turn must not poison the queue for subsequent turns).
  const next = previous.then(fn, fn)
  // The chain entry kept in `sessionLocks` must NEVER reject — if it did, the
  // unhandled rejection would crash the Node process even though the caller
  // already handled `next`. We absorb errors here; the original rejection still
  // surfaces through the returned `next` promise to the caller.
  const tracked: Promise<unknown> = next.then(
    () => undefined,
    () => undefined,
  ).finally(() => {
    if (sessionLocks.get(sessionId) === tracked) {
      sessionLocks.delete(sessionId)
    }
  })
  sessionLocks.set(sessionId, tracked)
  return next
}

/**
 * Drop the oldest entries until `sessionCache.size <= MAX_CACHED_SESSIONS`.
 * The Map preserves insertion order; we refresh `lastUsedAt` on hit but do
 * NOT re-insert, so an LRU-by-lastUsedAt is implemented by sorting entries
 * before evicting. Called from `getOrCreateSession` before insertion.
 */
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

// Cached from the first loaded session's settings so evictIdleSessions()
// (which has no session context) can honour the tenant-configured TTL.
let cachedIdleTtlMs = DEFAULT_SESSION_IDLE_TTL_MS

/**
 * Walk the replayed history from newest to oldest and try to recover the
 * customer's last mentioned laundromat location. Only entries whose timestamp
 * are within `locationCarryOverMs` (from settings.json) are considered; older
 * mentions are stale (the customer may have moved to another laundromat).
 *
 * History entries without a `timestamp` are skipped — the caller is expected
 * to provide them. We never guess.
 */
function recoverStickyLocation(
  session: AgentSession,
  history: HistoryEntry[],
): void {
  if (session.ar.state.location) return // already known, nothing to recover
  const carryOverMs = session.ar.runtime.settings.locationCarryOverMs ?? DEFAULT_LOCATION_CARRY_OVER_MS
  const now = Date.now()
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i]
    if (h.role !== 'user') continue
    if (!h.timestamp) continue
    const ts = Date.parse(h.timestamp)
    if (Number.isNaN(ts)) continue
    if (now - ts > carryOverMs) break // older entries are out of window
    const explicit = extractExplicitLocation(h.content)
    if (!explicit) continue
    const known = resolveKnownLocation(explicit)
    if (known) {
      session.ar.state.location = known
      return
    }
  }
}

function evictIdleSessions(): void {
  const now = Date.now()
  for (const [key, entry] of sessionCache) {
    if (now - entry.lastUsedAt > cachedIdleTtlMs) {
      sessionCache.delete(key)
    }
  }
}

async function getOrCreateSession(
  sessionId: string,
  history: HistoryEntry[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _userName: string,
  language: ChatbotInput['config']['language'],
  phoneNumber?: string,
): Promise<AgentSession> {
  evictIdleSessions()

  const cached = sessionCache.get(sessionId)
  if (cached) {
    cached.lastUsedAt = Date.now()
    return cached.session
  }

  const session = await createAgentSession()

  // Sync the TTL cache with this tenant's configured value so eviction honours it.
  cachedIdleTtlMs = session.ar.runtime.settings.sessionIdleTtlMs ?? DEFAULT_SESSION_IDLE_TTL_MS

  // Replay caller-provided history so the agent has full context even on
  // the first call to a fresh process (cold start, multi-dyno failover).
  // We push the messages directly into session.history; agentTurn will
  // include them in the LLM context on the next call.
  //
  // CRITICAL: we also rebuild deterministic state by running autoExtractFacts
  // on each user message. Without this, on a cold start the LLM sees the
  // history as plain text but state.displayState / machineType / machineNumber
  // remain empty, so guards like guardCaso5Al001AskBefore (which need
  // displayState='AL001' + machineType + machineNumber to fire) fail to
  // trigger and the LLM escalates straight away. This matches what
  // agentTurn does turn-by-turn in the CLI/test runner, so behaviour is
  // identical between cold-start (web) and warm session (CLI).
  for (const h of history) {
    session.history.push({ role: h.role, content: h.content })
    if (h.role === 'user') {
      try {
        autoExtractFacts(session.ar, h.content)
      } catch {
        // Extraction is best-effort during replay: a single bad turn must
        // not break the whole session bootstrap.
      }
    }
  }

  // Seed sticky state with caller-provided customer info.
  //
  // `userName` is INTENTIONALLY NOT copied into `customerName` here. The
  // caller's `userName` typically comes from the registration form, widget
  // profile, or auto-generated placeholder ("Unknown User-12345", "test1",
  // "+34..."). Those values are NOT suitable for the operator handover
  // summary, which must contain the name the customer provides EXPLICITLY
  // during the escalation conversation (via the customerNameAsk guard).
  //
  // Pre-populating customerName from userName caused real escalations to
  // surface technical placeholders to operators ("Usuario test1 en Mataró
  // …"). The architectural contract is: customerName is set ONLY when the
  // customer types their name in chat after the bot asks "¿Cómo te llamas?".
  if (phoneNumber) session.ar.state.customerPhone = phoneNumber

  // Tenant locks the bot to a specific set of `enabledLanguages` in
  // settings.json. The caller (chat-engine, widget, WhatsApp webhook) MAY
  // pass a `language` based on phone prefix, browser locale or widget
  // selector — but if that language is NOT enabled for this tenant we MUST
  // fall back to `defaultLanguage`. Otherwise the deterministic guards
  // (guardForceMachineType, guardForceMachineNumber, …) end up calling
  // t(key, lang) with a language the tenant explicitly disabled, producing
  // replies in the wrong language even though the LLM prompt is correctly
  // configured. This was the root cause of "ES tenant + EN replies" reports.
  const enabled = session.ar.runtime.settings.enabledLanguages || []
  const defaultLang = session.ar.runtime.settings.defaultLanguage
  if (language && enabled.includes(language)) {
    session.ar.state.language = language
    session.ar.state.preferredLanguage = language
  } else if (defaultLang) {
    session.ar.state.language = defaultLang
    session.ar.state.preferredLanguage = defaultLang
  }

  // Recover the customer's most recently mentioned location from the replayed
  // history, so the bot doesn't ask "where are you?" again on a new incident
  // when the customer is clearly still at the same laundromat. We only carry
  // the location forward if the last user mention is within
  // `settings.locationCarryOverMs` — beyond that the customer may have moved.
  //
  // Machine-level facts (lavadora/secadora, number, display) are intentionally
  // NOT recovered: each new incident must re-ask those, because the same
  // customer may be using a different machine.
  recoverStickyLocation(session, history)

  enforceCacheCap()
  sessionCache.set(sessionId, { session, lastUsedAt: Date.now() })
  return session
}

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  const agentChain: string[] = ['custom-client-0']
  // Serialise turns belonging to the SAME session. Different sessions still
  // run in parallel — the lock is keyed by sessionId. This is the smallest
  // safe granularity: it lets the host process serve thousands of concurrent
  // conversations while protecting each conversation's mutable state.
  return withSessionLock(input.context.sessionId, () =>
    runChatbotTurn(input, agentChain),
  )
}

async function runChatbotTurn(
  input: ChatbotInput,
  agentChain: string[],
): Promise<ChatbotOutput> {
  try {
    const session = await getOrCreateSession(
      input.context.sessionId,
      input.context.history,
      input.userName,
      input.config.language,
      input.context.phoneNumber,
    )

    // Refresh phone in case the session was cached without one (or with an old value).
    if (input.context.phoneNumber) {
      session.ar.state.customerPhone = input.context.phoneNumber
    }

    // Single source of truth: the SAME function the CLI runs.
    const reply = await agentTurn(session, input.userMessage)

    // Surface escalation signals coming from the deterministic pipeline /
    // tool calls so the web layer can route to a human operator without
    // string-matching the LLM output.
    const ar = session.ar
    const shouldEscalate =
      !!ar.pendingEscalation || ar.state.pendingClosure === 'escalated'

    let escalationSummary: string | undefined
    if (shouldEscalate && ar.state.customerName) {
      try {
        const ctx = extractEscalationContext(ar.state, ar.state.customerName)
        escalationSummary = buildEscalationSummary(ctx)
      } catch {
        // Summary is best-effort: a missing summary must NOT break the reply.
        escalationSummary = undefined
      }
    }

    return {
      reply,
      shouldEscalate,
      escalationSummary,
      meta: {
        // The CLI agent doesn't currently surface token counts up to the
        // wrapper; report 0 for now and let billing accept the underestimate.
        // TODO: thread tokensUsed through agentTurn return type.
        tokensUsed: 0,
        agentChain,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      reply: null,
      shouldEscalate: false,
      error: message,
      meta: {
        tokensUsed: 0,
        agentChain,
      },
    }
  }
}
