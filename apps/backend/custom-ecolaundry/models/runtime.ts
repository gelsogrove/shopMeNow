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
  /** Free-form description of the desired tone, injected into agent.txt. */
  tone?: string
  /** Tenant support email addresses, exposed to FAQ/handover messages. */
  supportEmails?: {
    invoice?: string
    support?: string
  }
  /** Public refund-form URL, used inside FAQ replies for double-charge etc. */
  refundFormUrl?: string
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
   * Branch-router architecture (target — see docs/branch-router-architecture.md).
   * When true, turn 1 is classified by utils/router.ts (one LLM call) into a
   * branch (greeting/faq/trouble-machine/invoice/loyalty/escalation) and
   * dispatched to utils/branches/<branch>/handler.ts. Subsequent turns are
   * deterministic, driven by state.activeBranch. When false (default), the
   * legacy guard pipeline runs unchanged.
   */
  useBranchRouter?: boolean
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
