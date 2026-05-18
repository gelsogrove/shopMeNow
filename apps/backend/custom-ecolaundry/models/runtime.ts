// Runtime configuration types: flows, FAQs, locations, settings.

import type { DisplayFlowsFile } from './display-flow.js'
import type { NluPatternsFile } from './nlu-patterns.js'

export type FlowNode = {
  type: 'ACTION' | 'CONFIRMATION' | 'CHOICE' | 'INFO' | 'ROUTER' | 'INPUT'
  prompt: string
  transitions?: Record<string, string>
  logic?: Record<string, string>
  isTerminal?: boolean
  action?: 'escalate'
  strictMatching?: boolean
  onInterruptFallback?: string
}

export type FlowMap = Record<string, Record<string, FlowNode>>
export type FaqMap = Record<string, string>

export type LocationOverride = {
  pueblo?: string
  calle?: string
  displayName?: string
  metadata?: Record<string, unknown>
  faqOverrides?: Record<string, string>
  flowOverrides?: Record<string, { prompt?: string }>
  escalationRules?: Array<{ id: string; trigger: string; action: string; reason?: string }>
}

export type LocationsConfig = {
  _principle?: string
  _overrideTypes?: Record<string, string>
  locations: Record<string, LocationOverride>
}

export type SupportedLanguage = 'it' | 'es' | 'en' | 'pt' | 'ca' | 'fr'

export type Settings = {
  enabledLanguages: SupportedLanguage[]
  defaultLanguage: SupportedLanguage
  chatbotName?: string
  /** Tenant brand name, e.g. "Ecolaundry". Substituted into prompts and
   *  used by escalation/handover summaries. */
  companyName?: string
  /** OpenRouter model id used by every LLM call in this tenant (e.g.
   *  "openai/gpt-4o-mini"). Optional; falls back to LLM_MODEL env var or
   *  a hard-coded default in `utils/llm.ts` when omitted. */
  model?: string
  /** Sampling temperature for the agent loop (default 0.3). */
  agentTemperature?: number
  /** Maximum tokens generated per LLM call (default 800). */
  agentMaxTokens?: number
  /** Hard cap on tool-call iterations per turn. Required: must be defined
   *  in `json/settings.json` (no in-code fallback). */
  maxToolHops: number
  /** Tenant-specific prefix for discount codes (Caso 8). The full code shape is
   *  `^<prefix>\d{6}\d+$` (prefix + DDMMYY + amount), e.g. `SAU2904266`.
   *  Required so the same `validateCustomerName` / discount-code guard can
   *  refuse code-shaped tokens as a customer name (F46). Must be a non-empty
   *  uppercase letters-only string. */
  discountCodePrefix: string
  /** Free-form description of the desired tone, injected into agent.txt. */
  tone?: string
  /** Tenant support email addresses, exposed to FAQ/handover messages. */
  supportEmails?: {
    invoice?: string
    support?: string
  }
  /** Public refund-form URL, used inside FAQ replies for double-charge etc. */
  refundFormUrl?: string
  /**
   * Comma-separated list of email addresses that receive a notification
   * (with HTML chat history) every time a Human Support message is generated.
   * Multiple recipients: "a@x.com, b@x.com". Leave empty/omit to disable.
   */
  notificationEmails?: string
  /** Whitelisted external domains the bot is allowed to mention. */
  allowedExternalLinks?: string
  welcomeMessage?: Partial<Record<SupportedLanguage, string>>
  /**
   * How long (in ms) to keep replaying conversation history before treating
   * the next message as a brand-new conversation. If the gap between the last
   * history entry and the incoming message exceeds this value, the history is
   * dropped and the session is recreated fresh — the bot welcomes the customer
   * again and re-asks location/machine. Default 3 600 000 (1 hour).
   *
   * Requires history entries to carry a `timestamp`. Callers that do not
   * provide timestamps fall back to no-reset behaviour.
   */
  historyResetTtlMs?: number
  /**
   * In-process session cache TTL (ms). Sessions idle longer than this are
   * evicted to keep memory bounded. Default 1 800 000 (30 minutes).
   */
  sessionIdleTtlMs?: number
  /**
   * Hard cap on cached sessions in memory. When exceeded, oldest sessions
   * (by lastUsedAt) are evicted (LRU). Default 10000. Falls back to env var
   * AGENT_SESSION_CACHE_MAX when not set in settings.
   */
  agentSessionCacheMax?: number
  /**
   * Branch-router architecture (target — see docs/branch-router-architecture.md).
   * When true, turn 1 is classified by utils/router.ts (one LLM call) into a
   * branch (greeting/faq/trouble-machine/invoice/loyalty/escalation) and
   * dispatched to utils/branches/<branch>/handler.ts. Subsequent turns are
   * deterministic, driven by state.activeBranch. When false (default), the
   * legacy guard pipeline runs unchanged.
   */
  useBranchRouter?: boolean
  /**
   * Natural-rephrase layer (target — see CLAUDE.md Pending refactors D1).
   * When true, every guard outcome (except operator-only structured output)
   * is passed through utils/agent-rephrase.ts for LLM tone-polish, using
   * conversation history as context. Content invariants are preserved by
   * the rephrase prompt. Adds ~$0.0005 + ~1s latency per rephrased turn.
   * Off by default — opt-in.
   */
  naturalRephrase?: boolean
  /**
   * Operator briefing source. When true, the "**👤 Human Support
   * message**" block is generated by utils/operator-briefing.ts using
   * the conversation history (more natural narrative for the operator).
   * When false (default), the deterministic template in
   * utils/escalation.ts:buildEscalationSummary is used. Tests run with
   * this flag OFF so assertions on summary content stay reliable.
   */
  operatorBriefingFromLlm?: boolean
  /**
   * Per-LLM-call temperatures. Each call site has its own use case:
   *   - router = classification task → low T (default 0, max recommended 0.2).
   *     A hallucination here means routing the customer to the wrong branch.
   *   - rephrase = polish task with strict content constraints → moderate T
   *     (default 0.4, recommended 0.2-0.5). Lower = more conservative
   *     wording, higher = more natural variation but risk of drifting
   *     from the canned reply.
   *   - operatorBriefing = summarisation of the conversation history
   *     for the operator → low T (default 0.2, recommended 0-0.3).
   *     Higher T risks the LLM inventing facts not present in history.
   * agentTemperature (legacy) is consumed by utils/agent-llm.ts (main turn).
   */
  routerTemperature?: number
  rephraseTemperature?: number
  operatorBriefingTemperature?: number
}

export type Runtime = {
  prompts: Record<string, string>
  flows: {
    washer: FlowMap
    dryer: FlowMap
  }
  /** Kept for backwards compat with utils that still reference it; always []. */
  regressions: never[]
  locations: LocationsConfig
  settings: Settings
  /** Declarative display-state intermediate flows, see models/display-flow.ts. */
  displayFlows: DisplayFlowsFile
  /** Declarative NLU patterns (intent/topic/display detection regexes),
   *  see models/nlu-patterns.ts. */
  nluPatterns: NluPatternsFile
}
