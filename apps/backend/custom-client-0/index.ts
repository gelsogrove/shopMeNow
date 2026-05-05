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
const sessionCache = new Map<
  string,
  { session: AgentSession; lastUsedAt: number }
>()

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
  userName: string,
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

  // Seed sticky state with caller-provided customer info so the agent does
  // not have to re-ask for the name and so language-aware guards behave
  // immediately without waiting for heuristics on the first message.
  if (userName) session.ar.state.customerName = userName
  if (phoneNumber) session.ar.state.customerPhone = phoneNumber
  if (language) {
    session.ar.state.language = language
    session.ar.state.preferredLanguage = language
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

  sessionCache.set(sessionId, { session, lastUsedAt: Date.now() })
  return session
}

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  const agentChain: string[] = ['custom-client-0']
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
