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
import { extractEscalationContext, buildEscalationSummary } from './utils/escalation.js'

import type {
  AgentSession,
  ChatbotInput,
  ChatbotOutput,
  HistoryEntry,
} from './models/index.js'

// Per-session cache of agent runtimes. Keyed by sessionId so concurrent
// customers do not stomp on each other's sticky facts. Entries are evicted
// after IDLE_TTL_MS of inactivity to keep memory bounded.
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
const IDLE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function evictIdleSessions(): void {
  const now = Date.now()
  for (const [key, entry] of sessionCache) {
    if (now - entry.lastUsedAt > IDLE_TTL_MS) {
      sessionCache.delete(key)
    }
  }
}

async function getOrCreateSession(
  sessionId: string,
  history: HistoryEntry[],
  userName: string,
  language: ChatbotInput['config']['language'],
): Promise<AgentSession> {
  evictIdleSessions()

  const cached = sessionCache.get(sessionId)
  if (cached) {
    cached.lastUsedAt = Date.now()
    return cached.session
  }

  const session = await createAgentSession()

  // Replay caller-provided history so the agent has full context even on
  // the first call to a fresh process (cold start, multi-dyno failover).
  // We push the messages directly into session.history; agentTurn will
  // include them in the LLM context on the next call.
  for (const h of history) {
    session.history.push({ role: h.role, content: h.content })
  }

  // Seed sticky state with caller-provided customer info so the agent does
  // not have to re-ask for the name and so language-aware guards behave
  // immediately without waiting for heuristics on the first message.
  if (userName) session.ar.state.customerName = userName
  if (language) {
    session.ar.state.language = language
    session.ar.state.preferredLanguage = language
  }

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
    )

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
