// Branch-router: single LLM classification call at turn 1 to decide which
// branch handler will own the rest of the conversation.
//
// Why this exists (target architecture, see docs/branch-router-architecture.md):
//   The previous design used a long pipeline of regex-based guards to
//   classify intent. That approach didn't scale across 6 supported
//   languages — every new phrasing required hand-tuning a regex. The
//   router replaces those classifiers with one LLM call that uses the
//   model's native multilingual understanding to pick a branch.
//
// Contract:
//   - Single round-trip per session (turn 1). Subsequent turns stay in the
//     branch chosen at T1 unless a topic-switch is explicitly detected.
//   - Returns a small JSON envelope; never produces customer-facing text.
//   - The branch dispatcher consumes the envelope and routes to the right
//     handler module under utils/branches/<branch>/.

import { callModel, extractJson, resolveModel } from './llm.js'
import { ROUTER_SYSTEM_PROMPT } from './router-prompt.js'
import type { Runtime, SupportedLanguage } from '../models/index.js'

export type Branch =
  | 'greeting'
  | 'faq'
  | 'trouble-machine'
  | 'invoice'
  | 'loyalty'
  | 'escalation'
  | 'unknown'

export interface RouterDecision {
  branch: Branch
  language: SupportedLanguage
  details: {
    /** For branch="faq": the matched FAQ key, when the message clearly
     *  maps to one of the entries in json/faqs.json. Empty string if not
     *  determinable from the customer's words. */
    faqKey?: string
    /** For branch="trouble-machine": the customer-mentioned display token
     *  (PUSH PROG, DOOR, AL001, etc.) when present. */
    displayHint?: string
    /** For branch="trouble-machine": location name the customer mentioned. */
    locationHint?: string
    /** For branch="escalation": the kind of non-troubleshooting incident
     *  (e.g. "datafono-wrong-amount", "cameras-or-ajax"). */
    incidentType?: string
  }
}

const ROUTER_FALLBACK: RouterDecision = {
  branch: 'unknown',
  language: 'es',
  details: {},
}

export interface ClassifyOptions {
  runtime?: Runtime
  /** Override model id for this call (defaults to runtime/env-resolved). */
  model?: string
}

/**
 * Classify the customer's message into a branch. Always returns a usable
 * decision (never throws) — failures degrade gracefully to "unknown" so
 * the dispatcher can fall through to a safe default.
 */
export async function classifyMessageBranch(
  message: string,
  options: ClassifyOptions = {},
): Promise<RouterDecision> {
  const trimmed = message.trim()
  if (!trimmed) return { ...ROUTER_FALLBACK, branch: 'unknown' }

  const model = options.model ?? resolveModel(options.runtime)
  let raw: string
  try {
    // Router temperature: deliberately low — this is a discrete classification
    // task (intent → branch), NOT a generative one. Hallucinations here mean
    // routing the customer to the wrong branch. Configurable via
    // `settings.routerTemperature` (default 0); recommended 0-0.2.
    const routerTemp = options.runtime?.settings?.routerTemperature ?? 0
    // System prompt: prefer prompts/router.txt (loaded by runtime), fall
    // back to the TS const for graceful degradation when the file is
    // missing. See CLAUDE.md Pending refactors D2.
    const promptFromFile = options.runtime?.prompts?.router?.trim()
    const systemPrompt = promptFromFile || ROUTER_SYSTEM_PROMPT
    raw = await callModel({
      model,
      systemPrompt,
      userPrompt: trimmed,
      json: true,
      temperature: routerTemp,
      maxTokens: 200,
    })
  } catch {
    // Network / API error → fall back to "unknown" so the dispatcher can
    // route to a safe default (re-ask in a neutral way).
    return ROUTER_FALLBACK
  }

  const decision = extractJson<RouterDecision>(raw, ROUTER_FALLBACK)
  return validateDecision(decision)
}

/**
 * Defensive normaliser: the LLM sometimes returns slight schema drift
 * (extra fields, missing fields, wrong values). Coerce to the contract
 * so callers can rely on the shape.
 */
function validateDecision(d: RouterDecision): RouterDecision {
  const allowedBranches: Branch[] = [
    'greeting',
    'faq',
    'trouble-machine',
    'invoice',
    'loyalty',
    'escalation',
    'unknown',
  ]
  const allowedLangs: SupportedLanguage[] = ['es', 'it', 'en', 'ca', 'pt', 'fr']
  const branch: Branch = allowedBranches.includes(d.branch) ? d.branch : 'unknown'
  const language: SupportedLanguage = allowedLangs.includes(d.language) ? d.language : 'es'
  const details = d.details && typeof d.details === 'object' ? d.details : {}
  return { branch, language, details }
}
