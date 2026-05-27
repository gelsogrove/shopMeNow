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
import { LlmFetchError } from './llm-fetch.js'
import { ROUTER_SYSTEM_PROMPT } from './router-prompt.js'
import { GATHER_AND_FLOW_GUARDS } from './guards/index.js'
import type { Runtime, SupportedLanguage } from '../models/index.js'

export type Branch =
  | 'greeting'
  | 'faq'
  | 'trouble-machine'
  | 'invoice'
  | 'loyalty'
  | 'escalation'
  | 'feedback'
  | 'unknown'

export type TroubleSubCase =
  | 'paid-not-activated'    // Caso 4 — pagò pero la maquina no se activó (cambio question)
  | 'paid-not-used'          // Caso 7 — pagò pero no he podido usar
  | 'display-unreadable'     // Caso 17 — no veo / pantalla rota / apagada
  | 'numeric-code'           // Caso 18 — código sólo numérico
  | 'display-driven'         // Casi 1/2/3/5/13/14/15/16/30 — pantalla con código
  | 'none'                   // ambiguous / no clear sub-case

/** F108 — Turn-aware mode emitted by the router on EVERY turn. The guard
 *  dispatcher uses this to decide what the pipeline is allowed to do this
 *  turn. Prevents the bot from re-asking for gather facts (location, type,
 *  number, display) when the customer is closing a topic or pivoting.
 *
 *  - "new-incident"          fresh operational problem
 *  - "gather"                customer is answering bot's previous question
 *  - "respond-and-continue"  customer fired a quick FAQ mid-flow
 *  - "pure-closure"          customer acknowledged / closed topic; bot must
 *                            not ask any new operational question this turn
 *  - "escalate"              customer explicitly demands operator
 *  - "topic-pivot"           (F112) customer explicitly returns to a previous
 *                            topic mid-FAQ ("back to my problem", "torniamo
 *                            al problema", "still PUSH"). Dispatcher releases
 *                            sticky FAQ branch and resumes trouble flow.
 *  - "resolution"            (F112) customer explicitly closes the trouble
 *                            ("now it works", "ora funziona", "ya funciona").
 *                            Dispatcher fires markResolved + resetMachineFacts.
 *  - "unclear"               (F112) router could not parse the customer's
 *                            intent at all (gibberish, broken mixed-language
 *                            soup, ambiguity beyond resolution). Bot must say
 *                            "ripeti per favore, non ho capito".
 */
export type TurnMode =
  | 'new-incident'
  | 'gather'
  | 'respond-and-continue'
  | 'pure-closure'
  | 'escalate'
  | 'topic-pivot'
  | 'resolution'
  | 'unclear'

export interface RouterDecision {
  branch: Branch
  language: SupportedLanguage
  /** F108 — Required on every classification. Defaults to 'new-incident' if
   *  the LLM omits it (safe default: behaves as today, no guards blocked). */
  turnMode: TurnMode
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
    /** For branch="trouble-machine": sub-case identification (F31). The router
     *  classifies the message into one of the documented Casi at the same
     *  time as the branch decision, so the trouble-machine handler can set
     *  `state.pendingFlow` semantically (caso4 → 'no-change-ask',
     *  caso17 → 'photo-await-decision', etc.) without falling back to
     *  fragile regex L3 detectors. */
    subCase?: TroubleSubCase
    /** For branch="escalation": the kind of non-troubleshooting incident
     *  (e.g. "datafono-wrong-amount", "cameras-or-ajax"). */
    incidentType?: string
    /** For branch="feedback": sentiment of the customer's opinion.
     *  "positive" → compliment / satisfaction; "negative" → complaint. */
    sentiment?: 'positive' | 'negative'
  }
}

const ROUTER_FALLBACK: RouterDecision = {
  branch: 'unknown',
  language: 'es',
  // Safe default: 'new-incident' means the dispatcher blocks NO guards,
  // so a router failure degrades to today's behaviour (full pipeline runs).
  turnMode: 'new-incident',
  details: {},
}

export interface ClassifyOptions {
  runtime?: Runtime
  /** Override model id for this call (defaults to runtime/env-resolved). */
  model?: string
  /** F108 — Previous bot turn (last assistant message). Passed as context so
   *  the router can distinguish `gather` (customer answering a bot question)
   *  from `new-incident` and from `pure-closure`. Omitted on T1 (no history). */
  lastAssistantMessage?: string
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
    // F108 — Include the previous bot turn in the user prompt so the router
    // can correctly classify `gather` / `pure-closure` / `new-incident`.
    // Without this, a bare "ok merci" looks ambiguous; with the bot's
    // previous question as context, the router sees "bot asked X, customer
    // answered ok" → pure-closure or gather. The format is intentionally
    // compact (single line) to keep router latency low.
    const userPrompt = options.lastAssistantMessage
      ? `Previous bot turn: ${options.lastAssistantMessage.slice(0, 400)}\nCustomer: ${trimmed}`
      : trimmed
    raw = await callModel({
      model,
      systemPrompt,
      userPrompt,
      json: true,
      temperature: routerTemp,
      maxTokens: 200,
      caller: 'router',
      cacheSystemPrompt: true,
    })
  } catch (err) {
    // F85 — OpenRouter outages (auth/credits/rate/timeout/network) propagate
    // up so chatbotFn returns error='llm_unavailable' and the widget serves
    // the workspace WIP message. The historic "fall back to ROUTER_FALLBACK"
    // path was masking outages as ordinary "unknown" classifications.
    if (err instanceof LlmFetchError) throw err
    // Non-network errors (JSON parse, validation, etc.) keep the safe-default
    // behaviour so an isolated parsing glitch doesn't trigger WIP for the
    // whole tenant.
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
    'feedback',
    'unknown',
  ]
  const allowedLangs: SupportedLanguage[] = ['es', 'it', 'en', 'ca', 'pt', 'fr']
  const allowedSubCases: TroubleSubCase[] = [
    'paid-not-activated',
    'paid-not-used',
    'display-unreadable',
    'numeric-code',
    'display-driven',
    'none',
  ]
  const allowedTurnModes: TurnMode[] = [
    'new-incident',
    'gather',
    'respond-and-continue',
    'pure-closure',
    'escalate',
    'topic-pivot',
    'resolution',
    'unclear',
  ]
  const branch: Branch = allowedBranches.includes(d.branch) ? d.branch : 'unknown'
  const language: SupportedLanguage = allowedLangs.includes(d.language) ? d.language : 'es'
  // F108 — Safe default if LLM omits or returns drift: 'new-incident' (no
  // guards blocked, pipeline behaves as today).
  const turnMode: TurnMode = allowedTurnModes.includes(d.turnMode as TurnMode)
    ? (d.turnMode as TurnMode)
    : 'new-incident'
  const details = d.details && typeof d.details === 'object' ? { ...d.details } : {}
  // Defensive normalisation for subCase — fallback to 'none' if drift.
  if (details.subCase && !allowedSubCases.includes(details.subCase)) {
    details.subCase = 'none'
  }
  return { branch, language, turnMode, details }
}

/**
 * F108 — Map `turnMode` to the set of guards the dispatcher must SKIP for
 * this turn.
 *
 * - `pure-closure` → block all gather/flow guards. The customer closed the
 *   topic; the bot must NOT re-ask for location/type/number/display or
 *   restart a display flow. Closure + FAQ + LLM-polish guards still fire.
 * - `gather` / `new-incident` / `respond-and-continue` / `escalate` → block
 *   nothing. The full pipeline runs as today.
 *
 * The empty set means "no guards blocked" — the safe default for any
 * unknown turnMode and for router failures (fallback returns
 * turnMode='new-incident').
 */
export function blockedGuardsForTurnMode(turnMode: TurnMode): ReadonlySet<string> {
  if (turnMode === 'pure-closure') return GATHER_AND_FLOW_GUARDS
  return EMPTY_SET
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>()
