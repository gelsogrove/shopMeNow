// Guard pipeline contract: a guard is a pure function that, given the agent
// runtime + the user message, either short-circuits the turn with a
// deterministic reply or returns null to fall through to the next guard.

import type { AgentRuntime } from './agent.js'

export interface GuardOutcome {
  reply: string
  reason: string
}

export type Guard = (ar: AgentRuntime, userMessage: string) => GuardOutcome | null
