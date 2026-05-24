// Orchestrator entry point — see `docs/orchestrator.md` for the full
// step-by-step diagram of how `agentTurn()` routes each customer turn.

import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadRuntime } from './utils/runtime.js'
import { createInitialState } from './utils/state.js'
import { extractEscalationContext, buildEscalationSummary, formatHandoverTimestamp } from './utils/escalation.js'
import { sanitizeCustomerReply } from './utils/message-parsing.js'
import { detectLanguageHeuristic } from './utils/intent.js'
import { runGuardPipeline, type GuardOutcome } from './utils/guards/index.js'
import { lang as resolveTenantLang } from './utils/guards/helpers.js'
import { autoExtractFacts } from './utils/agent-extract.js'
import { executeTool } from './utils/agent-tools.js'
import { loadPromptBundle, buildSystemPrompt } from './utils/agent-prompt.js'
import { callAgentLLM } from './utils/agent-llm.js'
import { rephraseForTurn } from './utils/agent-rephrase.js'
import { generateOperatorBriefingFromHistory } from './utils/operator-briefing.js'
import {
  mergeWelcomeWithReply,
  renderWelcomeForTurn,
  shouldShowWelcome,
  stripWelcomeParagraphs,
} from './utils/agent-welcome.js'
import { printCliBanner, printCliMessage } from './utils/cli.js'
import { API_KEY } from './utils/llm.js'
import { logger } from './utils/logger.js'
import { sanitizeUserMessage } from './utils/input-sanitize.js'
import { dispatchSubsequentTurn, dispatchTurnOne } from './utils/branches/index.js'
import { t, tt } from './utils/localization.js'
import type { SupportedLanguage } from './models/index.js'
import {
  detectResolutionEscalationContradiction,
  replyContainsResolutionMarker,
  stripResolutionSentences,
} from './utils/contradiction.js'
import { closeAsEscalated, markResolved, undoResolved } from './utils/state-transitions.js'
import { applyOutputInvariants } from './utils/output-invariants.js'
import {
  auditFactDiscipline,
  collectInvokedSetTools,
  snapshotFacts,
} from './utils/fact-call-audit.js'
import type { AgentMessage, AgentRuntime, AgentSession } from './models/index.js'

export type { AgentRuntime, AgentSession } from './models/index.js'

loadDotEnv()

// ── Public API ────────────────────────────────────────────────────────────────

/** Build a fresh AgentSession with a clean state and a loaded prompt bundle. */
export async function createAgentSession(): Promise<AgentSession> {
  const runtime = await loadRuntime()
  const ar: AgentRuntime = {
    runtime,
    state: createInitialState(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  const bundle = await loadPromptBundle()
  return { ar, history: [], bundle }
}

/** Process one customer turn and return the bot's reply. Same code path on CLI and Web. */
export async function agentTurn(session: AgentSession, rawUserMessage: string): Promise<string> {
  const { ar, history, bundle } = session
  ar.state.turnCount = (ar.state.turnCount || 0) + 1
  ar.state.lastActivityAt = Date.now()

  // Strip control + zero-width chars and cap length BEFORE the message reaches
  // the LLM, the guards or the fact extractor. Defence in depth against
  // prompt-stuffing and homograph/bidi-based prompt-injection payloads.
  const userMessage = sanitizeUserMessage(rawUserMessage)
  // Make the current-turn user message available to tool validators (e.g.
  // mark_resolved checks for mixed signals).
  ar.state.lastUserMessage = userMessage

  resolveLanguageForTurn(ar, userMessage)
  // Snapshot displayState BEFORE autoExtractFacts runs. Guards downstream
  // (e.g. guardPostInstructionFailureReask Phase B) compare snapshot vs
  // current displayState to detect when the customer volunteered a NEW
  // display in the same message — pivot instead of re-ask. See
  // utils/guards/display.ts and __tests__/unit/display-pivot-phase-b.test.ts.
  ar.state.displayStateAtTurnStart = ar.state.displayState || ''
  autoExtractFacts(ar, userMessage)

  // Branch-router architecture (feature-flagged via settings.useBranchRouter).
  // When enabled and we have a registered handler for the chosen branch,
  // dispatch directly. Otherwise fall through to the legacy guard pipeline
  // so the bot keeps working while branches are migrated incrementally.
  // See docs/branch-router-architecture.md for the migration plan.
  if (ar.runtime.settings?.useBranchRouter) {
    const dispatchResult = await maybeDispatchBranch(ar, userMessage)
    if (dispatchResult) {
      return applyGuardOutcome(session, { reply: dispatchResult, reason: 'branch-router' }, userMessage)
    }
  }

  const guardOutcome = runGuardPipeline(ar, userMessage)
  if (guardOutcome) {
    return applyGuardOutcome(session, guardOutcome, userMessage)
  }

  const assistantReply = await runLlmLoop(ar, history, bundle, userMessage)
  history.push({ role: 'user', content: userMessage })
  history.push({ role: 'assistant', content: assistantReply })

  const polished = polishReplyForTurn(ar, assistantReply)
  return appendEscalationSummary(ar, polished, history)
}

/**
 * Branch-router dispatch (feature-flagged). Returns the handler reply
 * when the dispatcher was able to handle the turn, else null so the
 * caller falls through to the legacy pipeline. Pure side-effect-free
 * fall-back: when no handler exists for the chosen branch, no state
 * mutation persists across the dispatch (the dispatcher only stores
 * activeBranch when it actually invokes a handler).
 */
async function maybeDispatchBranch(ar: AgentRuntime, userMessage: string): Promise<string | null> {
  // T2+ first: if the previous turn pinned a sticky branch, route there
  // directly without re-classifying.
  // Exception: if the case was already resolved (pendingClosure='resolved'),
  // release the sticky branch so the next message is treated as a fresh T1.
  // Without this, a post-resolution message (e.g. "ottimo servizio") keeps
  // the trouble-machine branch active and the guard pipeline asks "cosa vedi
  // sullo schermo?" instead of routing the feedback to the feedback handler.
  if (ar.state.activeBranch && ar.state.activeBranch !== 'unknown') {
    if (ar.state.pendingClosure === 'resolved') {
      ar.state.previousBranch = ar.state.activeBranch
      ar.state.activeBranch = null
      // Fall through to T1 dispatch below.
    } else {
      const result = await dispatchSubsequentTurn(ar, userMessage, ar.state.language as SupportedLanguage ?? 'es')
      return result.handled && result.output ? result.output.reply : null
    }
  }
  // T1: classify and dispatch.
  const result = await dispatchTurnOne(ar, userMessage)
  // F80 — Router language detection is authoritative ONLY at T1. The router
  // LLM is more accurate than the heuristic in resolveLanguageForTurn, so we
  // allow it to correct the just-set value while we're still in turn 1. From
  // T2 onward the language is STRICT-STICKY: the router (or anything else)
  // MUST NOT overwrite preferredLanguage mid-session — that's how the mixed-
  // language regression of 2026-05-22 happened (welcome EN → "Policia" → ES
  // → router flipped back to EN on a different turn).
  //
  // F105 (2026-05-24) — heuristic takes precedence when confident. The router
  // LLM can be confused by Spanish-sounding location names embedded in a
  // non-ES message (e.g. "Come si usa l'asciugatrice? Sono a Goya" → router
  // returns 'es' because "Goya" sounds Spanish). The deterministic heuristic
  // detects 'it' via the 'asciug' pattern and is considered more reliable
  // than the LLM for this case. Rule: router overwrites ONLY when the
  // heuristic returned null (no confident match); if the heuristic already
  // picked a non-null language, its result is preserved.
  if (ar.state.turnCount === 1 && result.decision?.language) {
    const enabled = ar.runtime.settings.enabledLanguages || []
    const routerLang = result.decision.language
    const heuristicLang = detectLanguageHeuristic(userMessage)
    // Only let the router overwrite if the heuristic had no confident match.
    // When heuristicLang is non-null, the deterministic pattern already won.
    if (enabled.includes(routerLang) && heuristicLang === null) {
      ar.state.language = routerLang
      ar.state.preferredLanguage = routerLang
    }
  }
  return result.handled && result.output ? result.output.reply : null
}

// ── Turn pipeline ─────────────────────────────────────────────────────────────

/**
 * Lock state.language to a tenant-allowed value. Called every turn so a stale
 * or mutated value can never produce a reply in a disabled language.
 */
function resolveLanguageForTurn(ar: AgentRuntime, userMessage: string): void {
  const enabled = ar.runtime.settings.enabledLanguages || []

  if (!ar.state.preferredLanguage) {
    // First turn: detect language from message, fall back to defaultLanguage.
    const heuristic = detectLanguageHeuristic(userMessage)
    const candidate = heuristic && enabled.includes(heuristic)
      ? heuristic
      : ar.runtime.settings.defaultLanguage
    ar.state.language = candidate
    ar.state.preferredLanguage = candidate
    return
  }

  // F80 — Subsequent turns: preferredLanguage is STRICT-STICKY. Once locked
  // at T1 (either by router LLM or by heuristic on the customer's first real
  // message), it NEVER changes — not by heuristic, not by router. The mid-
  // session flip-back (previous design) produced the mix observed in Andrea
  // 2026-05-22 chat: welcome EN → "Policia" → ES → "no funciona" → ES kept,
  // but T2/T3 oscillated between EN and ES based on per-turn heuristic.
  // Sticky-T1 is the architectural contract: the customer's language is a
  // session-level attribute, not a per-message attribute.
  ar.state.language = ar.state.preferredLanguage as typeof ar.state.language
}

/** Persist the guard reply in history, optionally prepending the welcome on T1.
 *
 *  When `settings.naturalRephrase=true`, the customer-facing reply is passed
 *  through `utils/agent-rephrase.ts` for LLM tone-polish before being
 *  stored in history. Operator-only structured output (handover summary)
 *  and T1 welcome are NOT rephrased — see `rephraseForTurn` for the
 *  filter. See CLAUDE.md Pending refactors D1.
 */
async function applyGuardOutcome(
  session: AgentSession,
  outcome: GuardOutcome,
  userMessage: string,
): Promise<string> {
  const { ar, history } = session
  let reply = outcome.reply
  const isT1Welcome = ar.state.turnCount === 1 && shouldShowWelcome(outcome.reason)
  if (isT1Welcome) {
    const welcome = renderWelcomeForTurn(ar)
    if (welcome) reply = mergeWelcomeWithReply(welcome, reply)
  }
  // ── Rephrase bypass conditions ────────────────────────────────────────────
  // The rephrase layer (utils/agent-rephrase.ts) passes the reply + full
  // conversation history to a third-party LLM API. Any flow that collects PII
  // in the history MUST bypass it. Add new PII flows to PII_FLOW_PREFIXES.
  //
  // F35 — invoice flow (Caso 9): CIF/NIF, dirección, razón social, email.
  // Add future sensitive flows here (e.g. 'payment-card-', 'id-verify-').
  const PII_FLOW_PREFIXES = ['invoice-'] as const
  const isPrivateFlow = PII_FLOW_PREFIXES.some((p) =>
    ar.state.pendingFlow.startsWith(p),
  )
  // F41 — markdown bullet+bold list: rephrase LLM flattens structure.
  // The formatted reply IS the UX — no polish needed.
  // Exception: howToUse / howToUseDryer FAQ overrides are ES source strings
  // that need LLM translation for non-ES sessions (F105). These reasons are
  // excluded from the bullet-list bypass so rephraseForTurn can translate them.
  const FAQ_NEEDS_TRANSLATION = new Set(['faq-how-to-use', 'faq-how-to-use-dryer'])
  const hasFormattedBulletList =
    /\n-\s+\*\*/.test(reply) && !FAQ_NEEDS_TRANSLATION.has(outcome.reason ?? '')
  // F49 — discount-code-ask: clean i18n is the UX; rephrase kept adding
  // "incluyendo letras si las hay" autonomously.
  const isDiscountCodeAsk = outcome.reason === 'discount-code-ask'
  // F70 — loyalty FAQ (buy/recharge): usecases.md Caso 10 criterio 4 says
  // bot must NOT ask for location — rephrase LLM kept adding "¿En qué
  // lavandería te encuentras?" autonomously against the spec.
  // F94 — also bypass for Caso 36 reasons: 'loyalty-card-wrong-location'
  // (cross-location warning with {buyLocation}/{currentLocation} placeholders
  // replaced deterministically) and 'loyalty-card-buy-with-location' (T2
  // override after location reply). The rephrase LLM was adding unsolicited
  // follow-up questions ("¿Te gustaría saber algo más?") causing the next
  // customer "sì/sí/yes" to be misinterpreted as machine-flow confirmation.
  const isLoyaltyFaq =
    outcome.reason === 'loyalty-card-buy' ||
    outcome.reason === 'loyalty-card-recharge' ||
    outcome.reason === 'loyalty-card-wrong-location' ||
    outcome.reason === 'loyalty-card-buy-with-location'
  // F56 — active display flow (washer/dryer JSON prompts): PDF-vetted content;
  // rephrase invented operational details ("ropa en la goma", "hasta oír un
  // clic"). Deterministic bypass is the only robust fix.
  //
  // ⚙️  TOGGLE: set "rephraseDisplayFlow": true in json/settings.json to
  // re-enable rephrase for display flows and experiment with contextual
  // recaps (e.g. "sigues en Goya con la lavadora 5 y el error DOOR 😕").
  // Risk: rephrase may invent operational details — monitor carefully.
  // Default: false (bypass active).
  const isDisplayFlowActive =
    !!ar.state.activeFlowId && !ar.runtime.settings?.rephraseDisplayFlow

  if (
    !isT1Welcome &&
    !isPrivateFlow &&
    !hasFormattedBulletList &&
    !isDiscountCodeAsk &&
    !isDisplayFlowActive &&
    !isLoyaltyFaq &&
    ar.runtime.settings?.naturalRephrase
  ) {
    reply = await rephraseForTurn(reply, ar, history)
  }
  // F79 — Landmark ack (consume-once turn-local signal). When agent-extract
  // resolved the location via a landmark deduction (e.g. "estoy cerca del
  // Mercadona" → 'Goya'), prepend a confirmation so the customer knows the
  // bot understood. Direct canonical mentions ("Goya") never set this
  // signal, keeping replies terse when there is nothing surprising to ack.
  // Runs AFTER rephrase so the canonical wording (with bold + address)
  // reaches the customer verbatim — the rephrase polish would otherwise
  // flatten the bold or drop the address.
  if (ar.state.locationAckPending) {
    const canonical = ar.state.locationAckPending
    const override = ar.runtime.locations.locations[canonical]
    if (override) {
      const displayName = override.displayName || canonical
      const address = override.calle || ''
      const tenantLang = resolveTenantLang(ar)
      const ack = tt('landmarkAck', tenantLang, {
        location: displayName,
        address,
      })
      reply = `${ack}\n\n${reply}`
    }
    ar.state.locationAckPending = null
  }
  history.push({ role: 'user', content: userMessage })
  history.push({ role: 'assistant', content: reply })
  return reply
}

/** Run the LLM tool-calling loop, capped at settings.maxToolHops iterations. */
async function runLlmLoop(
  ar: AgentRuntime,
  history: AgentMessage[],
  bundle: AgentSession['bundle'],
  userMessage: string,
): Promise<string> {
  const messages: AgentMessage[] = [
    { role: 'system', content: buildSystemPrompt(ar, bundle) },
    ...history,
    { role: 'user', content: userMessage },
  ]
  const maxToolHops = ar.runtime.settings.maxToolHops
  // Snapshot facts before the LLM runs. autoExtractFacts (agent.ts:72) has
  // already populated state; this baseline lets the audit detect new facts
  // gained during the LLM turn vs sticky facts that were already present.
  const beforeSnapshot = snapshotFacts(ar.state)

  for (let hops = 0; hops < maxToolHops; hops++) {
    const response = await callAgentLLM(messages, ar.runtime)
    messages.push(response)

    const toolCalls = response.tool_calls || []
    if (toolCalls.length === 0) {
      auditFactDiscipline(beforeSnapshot, snapshotFacts(ar.state), collectInvokedSetTools(messages), {
        turnCount: ar.state.turnCount,
      })
      return response.content || ''
    }
    await runToolCalls(ar, toolCalls, messages)
  }
  logger.warn('LLM loop exhausted maxToolHops without producing a text reply', {
    maxToolHops,
    sessionTurnCount: ar.state.turnCount,
  })
  return ''
}

/** Execute each tool_call in order and append its JSON result as a `role:'tool'` message. */
async function runToolCalls(
  ar: AgentRuntime,
  toolCalls: NonNullable<AgentMessage['tool_calls']>,
  messages: AgentMessage[],
): Promise<void> {
  for (const call of toolCalls) {
    const args = parseToolArgs(call.function.name, call.function.arguments)
    const result = await executeTool(ar, call.function.name, args)
    messages.push({
      role: 'tool',
      tool_call_id: call.id,
      name: call.function.name,
      content: JSON.stringify(result),
    })
  }
}

function parseToolArgs(toolName: string, raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch (err) {
    logger.warn('LLM produced malformed tool arguments; defaulting to empty object', {
      tool: toolName,
      raw,
      error: err instanceof Error ? err.message : String(err),
    })
    return {}
  }
}

/**
 * Sanitize, enforce invariants, and adjust greetings:
 *   - turn 1 prepends the welcome (unless the LLM already greeted or the
 *     customer already gave operational facts)
 *   - turn 2+ strips any greeting paragraph the LLM may have re-introduced
 *   - in all turns: enforce the no-contradiction invariant (a single reply
 *     must NOT claim resolution AND announce an escalation)
 */
function polishReplyForTurn(ar: AgentRuntime, rawReply: string): string {
  const sanitized = sanitizeCustomerReply(rawReply)
  const noContradiction = enforceNoContradiction(ar, sanitized)
  enforceResolutionStateBackstop(ar, noContradiction)
  // Output invariants — strip the bug surfaces previously patched in
  // prompts/agent.txt (rule #1: no patches in prompt). See
  // utils/output-invariants.ts for the catalogue + tests.
  let reply = applyOutputInvariants(noContradiction, {
    location: ar.state.location || null,
  })
  // F28 (Andrea 2026-05-10, Caso 32.3 RED-SPEC closure): if the customer
  // paused an active trouble flow with a brief FAQ this turn, append the
  // "¿Sigamos con tu problema?" prompt so they know the flow is paused,
  // not lost. Skip on closure turns (escalated / resolved / refund-form)
  // to avoid contradicting the closure message.
  if (ar.state.faqPause && ar.state.pendingFlow && !ar.state.pendingClosure) {
    const resume = t('resumeAfterFaq', ar.state.language)
    if (resume && !reply.includes(resume)) {
      reply = `${reply.trimEnd()}\n\n${resume}`
    }
  }
  if (ar.state.turnCount !== 1) {
    return stripWelcomeParagraphs(reply)
  }
  if (llmAlreadyGreeted(reply) || hasOperationalFacts(ar)) {
    return reply
  }
  const welcome = renderWelcomeForTurn(ar)
  return welcome ? mergeWelcomeWithReply(welcome, reply) : reply
}

/**
 * If the LLM produced a reply with both resolution and escalation markers,
 * the case is being escalated (the customer reported a NEW issue): drop the
 * resolution sentences AND undo any state mutation that might have come
 * from a `mark_resolved` tool call earlier in the same turn.
 */
function enforceNoContradiction(ar: AgentRuntime, reply: string): string {
  const report = detectResolutionEscalationContradiction(reply)
  if (!report.detected) return reply
  logger.warn('Resolution/escalation contradiction in LLM reply; stripping resolution sentences', {
    resolutionPhrase: report.resolutionPhrase,
    escalationPhrase: report.escalationPhrase,
  })
  undoResolved(ar)
  return stripResolutionSentences(reply)
}

/**
 * Backstop: if the LLM emitted a closure phrase ("incidencia resuelta",
 * "issue resolved", ...) but FORGOT to call the `mark_resolved` tool,
 * set `state.pendingClosure='resolved'` deterministically so the state
 * matches the customer-facing message.
 *
 * REGRESSION (Andrea, 2026-05-09 Caso 1.1 LLM run): the bot replied
 * "✅ Perfecto, incidencia resuelta. ¡Gracias por tu paciencia! 🎉"
 * but `state.pendingClosure` stayed null because the LLM skipped the
 * tool call. The Scenario 1.1 test asserts `pendingClosure='resolved'`
 * after the closure reply — without this backstop the state and the
 * reply diverged.
 *
 * Architectural rationale (CLAUDE.md regla #2 corollary): "tool refuses,
 * LLM corrects" handles bad calls. This handles forgotten calls — the
 * post-processor compensates so the conversation state is consistent
 * regardless of LLM compliance.
 *
 * Skips when an escalation is in progress (operatorRequested /
 * customerNameRequested / pendingClosure already set) — those are
 * legitimate non-resolved closures.
 */
function enforceResolutionStateBackstop(ar: AgentRuntime, reply: string): void {
  if (ar.state.pendingClosure) return
  if (ar.state.operatorRequested || ar.state.customerNameRequested) return
  if (!replyContainsResolutionMarker(reply)) return
  logger.info('Resolution backstop: setting pendingClosure="resolved" (LLM emitted closure without mark_resolved tool call)')
  markResolved(ar)
}

/**
 * True when the LLM reply already opens with a greeting marker. Detection is
 * sentence-level (not paragraph-level) because the LLM often inlines the
 * greeting with the rest of the reply ("¡Hola! Soy Eco. ¿Dónde estás?") —
 * the paragraph-based stripper would not catch this and we'd double-greet.
 *
 * Patterns: opening "Hola/Ciao/Hi/Hello/Olá/Bonjour" OR a self-introduction
 * ("soy/sono/i'm/sou/je suis" + the chatbot name) anywhere in the reply.
 */
function llmAlreadyGreeted(reply: string): boolean {
  const trimmed = reply.trim()
  if (!trimmed) return false
  const startsWithGreeting =
    /^(¡?hola[!,.\s]|ciao[!,.\s]|hi[!,.\s]|hello[!,.\s]|ol[áa][!,.\s]|bonjour[!,.\s])/i.test(
      trimmed,
    )
  if (startsWithGreeting) return true
  // Fallback: paragraph-level stripping changes the text → at least one
  // greeting block was somewhere else in the reply.
  return stripWelcomeParagraphs(reply) !== reply
}

function hasOperationalFacts(ar: AgentRuntime): boolean {
  const { location, displayState, machineNumber } = ar.state
  return Boolean(location && (displayState || machineNumber))
}

/** Append the operator handover summary when the pipeline marked an escalation.
 *
 *  The final reply has 3 parts (uniform across all escalation branches —
 *  Caso 1.2 / 5.2 / 5.3 / 7.2 / 13 / 17 / 18 / 25 / 26-27 / 28 / 29 / 30):
 *
 *    1. The LLM-generated empathic line ("Vamos a revisar tu caso, Andrea...")
 *       — varies in tone, language, phrasing.
 *    2. A FIXED handoff line from i18n key `operatorHandoffFinal` containing
 *       the customer-facing keywords "operador" + "desactivado" — uniform,
 *       deterministic, multilingual via the i18n catalogue.
 *    3. The operator-side "👤 Human Support message" summary.
 *
 *  Rule #8 (multi-language by design): the handoff line is in 6 languages
 *  in `json/i18n/<lang>.json:operatorHandoffFinal`. Adding a 7th language
 *  = adding 1 entry to each i18n file, no code change.
 *
 *  TODO (Andrea, 2026-05-09 — PII must not reach the LLM):
 *    Personal data flows into the LLM prompt today and that is not
 *    acceptable for privacy/GDPR. The customer's free-text messages are
 *    forwarded verbatim to the external model (OpenRouter / OpenAI) and
 *    they contain:
 *      - customer name (Caso 6 / 8 / every escalation that asks the name)
 *      - last 4 digits of the bank card (Caso 6 step 4-dígitos)
 *      - photo references / receipt hints (Caso 6 captura, Caso 17 foto)
 *      - location + machine number (less sensitive but still PII when
 *        combined with the rest)
 *    Fix direction:
 *      - Capture PII deterministically (already done for card digits via
 *        guardDoubleChargeAskCardDigits, and for the name via
 *        guardDoubleChargeAwaitName / guardDiscountCodeAwaitName).
 *      - Before forwarding the conversation history to the LLM, redact /
 *        mask the captured PII fields (e.g. replace card digits with
 *        "[REDACTED-CARD-4]", customer name with "[CUSTOMER]"). The state
 *        keeps the real values for the operator briefing, but the LLM
 *        only sees placeholders.
 *      - Audit every guard that asks the LLM for help on a turn that
 *        already contains PII in the user message and short-circuit it
 *        deterministically when possible.
 *    Tracking: search "PII must not reach the LLM" in this repo.
 */
async function appendEscalationSummary(ar: AgentRuntime, reply: string, history: AgentMessage[]): Promise<string> {
  // Refund-form path (Caso 6.1 Sí branch): customer used the service, the
  // case is closed via refund trámite — no live operator, no handoff line,
  // no Human Support summary. Triggered by markRefundFormPending() which
  // sets pendingClosure='refund-form' atomically. See usecases.md §6.1
  // riga 627.
  //
  // Why we REPLACE the LLM reply with a deterministic i18n string: without
  // operatorRequested/pendingEscalation set, the LLM is not guided into a
  // closure phrase and may improvise (e.g. ask "what's on the screen?"
  // because the displayState slot is empty). The i18n key `refundFormFinal`
  // is the canonical closure for this branch.
  const { pendingClosure: closure, customerName } = ar.state
  if (closure === 'refund-form') {
    if (!customerName) return reply
    const lang = resolveTenantLang(ar)
    // F34 (Andrea 2026-05-10): the customer was getting the message
    // "te enviaremos el formulario de reembolso" but never the actual URL
    // → no clue when/how/where the form arrives. Inject `{refundFormUrl}`
    // from settings so the customer sees the link directly in the close
    // message and can fill it immediately. Empty string fallback if not
    // configured (the message degrades gracefully without leaking braces).
    const refundFormUrl = ar.runtime.settings?.refundFormUrl ?? ''
    const finalText = t('refundFormFinal', lang)
      .replace('{name}', customerName)
      .replace('{refundFormUrl}', refundFormUrl)
    // Append a compact incident summary under "📋 Resumen para tramitación" so
    // the team processing the refund form can see location, machine, and
    // incident details without reading the full conversation log. Uses a
    // different section header than live-operator escalation (no "Human
    // Support message", no "operador") so Scenario 6.1 assertions stay green
    // (usecases.md §6.1 riga 627: "no es una escalación a un humano en vivo").
    const ctx = extractEscalationContext(ar.state, customerName)
    const summary = await generateOperatorBriefingFromHistory(ar, history, buildEscalationSummary(ctx))
    ar.pendingEscalation = null
    return `${finalText}\n\n**📋 Resumen para tramitación:**\n${summary}`
  }
  if (!ar.pendingEscalation || !customerName) return reply
  const ctx = extractEscalationContext(ar.state, ar.state.customerName)
  // Deterministic baseline summary — always computed (used as the fallback
  // for the LLM path, AND emitted directly when settings.operatorBriefingFromLlm
  // is false). Tests run with the flag OFF so assertions on summary content
  // stay reliable. See CLAUDE.md "Test deterministic vs production polished".
  const baseline = buildEscalationSummary(ctx)
  const summary = await generateOperatorBriefingFromHistory(ar, history, baseline)
  ar.pendingEscalation = null
  closeAsEscalated(ar)

  // Handoff language: ALWAYS the locked tenant/state language, never an
  // heuristic on `reply`. Reason: if the LLM drifts the reply to a wrong
  // language (e.g. emits ES at T6 while state is EN), the heuristic would
  // cascade the drift into the handoff and the briefing — producing a
  // reply in ES + handoff in ES even though the customer has been speaking
  // EN all session. Locking to resolveTenantLang(ar) guarantees the
  // customer-facing handoff is in their session language regardless of
  // LLM behaviour.
  const lang = resolveTenantLang(ar)
  // The empathic lead line ("Vamos a revisar tu caso, Andrea") is ALSO
  // deterministic: the LLM-generated `reply` is replaced by the canned
  // i18n key `escalationCaseReviewLead`. This makes the entire 3-block
  // escalation handover language-coherent and immune to LLM drift at
  // the name-capture turn — observed regression: state=en, LLM emitted
  // ES at T6, producing a Spanish empathic line + handoff cascade.
  // Iron rule #10: every required step has a deterministic catch-all.
  const lead = t('escalationCaseReviewLead', lang).replace('{name}', ar.state.customerName || '')
  const handoff = t('operatorHandoffFinal', lang)
  return `${lead}\n\n${handoff}\n\n**👤 Human Support message**\n${summary}`
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function loadDotEnv(): void {
  const envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env')
  try {
    process.loadEnvFile(envFile)
  } catch (err) {
    // ENOENT is expected (tests and prod set vars via the environment); other
    // errors (permission, malformed file) deserve a warning so they aren't silent.
    const code = (err as NodeJS.ErrnoException)?.code
    if (code === 'ENOENT') return
    logger.warn('Failed to load .env file', {
      envFile,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function runInteractive(): Promise<void> {
  if (!API_KEY) {
    console.error('OPENROUTER_API_KEY missing. Export it before running the agent demo.')
    process.exit(1)
  }
  const session = await createAgentSession()
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  printCliBanner(
    'Ecolaundry Agent Demo (Step X)',
    'LLM-as-agent prototype. /exit to quit, /reset to restart.',
  )

  while (true) {
    const command = await readCliInput(rl)
    if (command === null) break
    if (command === '') continue
    if (command === '/exit' || command === '/quit') break
    if (command === '/reset') {
      await resetCliSession(session)
      continue
    }
    await handleCliTurn(session, command)
  }
  rl.close()
}

async function readCliInput(rl: ReturnType<typeof createInterface>): Promise<string | null> {
  try {
    const input = await rl.question('')
    return input.trim()
  } catch (err) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') {
      return null
    }
    throw err
  }
}

async function resetCliSession(session: AgentSession): Promise<void> {
  const fresh = await createAgentSession()
  session.ar = fresh.ar
  session.history = fresh.history
  session.bundle = fresh.bundle
  printCliMessage('Info', 'Session reset.')
}

async function handleCliTurn(session: AgentSession, message: string): Promise<void> {
  try {
    const reply = await agentTurn(session, message)
    printCliMessage('Bot', reply)
  } catch (err) {
    printCliMessage('Error', `Agent error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * Test-only handles for internal helpers. Production code MUST go through
 * `agentTurn()` — direct access is reserved for unit tests.
 */
export const __testing = {
  llmAlreadyGreeted,
}

function isDirectExecution(): boolean {
  const entryFile = process.argv[1]
  if (!entryFile) return false
  return import.meta.url === pathToFileURL(path.resolve(entryFile)).href
}

// ── Batch mode ────────────────────────────────────────────────────────────────
//
// Non-interactive driver for Claude / scripts. Accepts a JSON array of
// scenarios on argv after `--batch`. Each entry is either:
//   - string[]  → a sequence of user turns inside ONE session
//   - "/reset"  → marker that resets the session before the next entry
// Output is a markdown transcript on stdout (one block per scenario / turn)
// so the caller can parse "[SCENARIO N]", "[USER]", "[BOT]" markers.

async function runBatch(rawJson: string): Promise<void> {
  if (!API_KEY) {
    console.error('OPENROUTER_API_KEY missing. Export it before running the agent batch.')
    process.exit(1)
  }
  let plan: Array<string[] | string>
  try {
    plan = JSON.parse(rawJson)
    if (!Array.isArray(plan)) throw new Error('top-level must be an array')
  } catch (err) {
    console.error('Invalid --batch JSON:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }

  let session = await createAgentSession()
  let scenarioIdx = 0

  for (const entry of plan) {
    if (entry === '/reset') {
      console.log('\n[RESET] ──────────────────────────────────────────────')
      session = await createAgentSession()
      continue
    }
    if (!Array.isArray(entry)) {
      console.log(`\n[SKIP] non-array, non-reset entry: ${JSON.stringify(entry)}`)
      continue
    }
    scenarioIdx += 1
    console.log(`\n[SCENARIO ${scenarioIdx}] ═══════════════════════════════════`)
    for (let i = 0; i < entry.length; i += 1) {
      const turn = entry[i]
      console.log(`\n[USER T${i + 1}] ${turn}`)
      try {
        const reply = await agentTurn(session, turn)
        console.log(`[BOT T${i + 1}] ${reply}`)
      } catch (err) {
        console.log(`[ERROR T${i + 1}] ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    console.log(`\n[STATE T-end] language=${session.ar.state.language} preferredLanguage=${session.ar.state.preferredLanguage} pendingFlow=${session.ar.state.pendingFlow} activeBranch=${session.ar.state.activeBranch} activeFlowId=${session.ar.state.activeFlowId} location=${session.ar.state.location} machineType=${session.ar.state.machineType} machineNumber=${session.ar.state.machineNumber} displayState=${session.ar.state.displayState} lastResolvedIntent=${session.ar.state.lastResolvedIntent} lastFaqKey=${session.ar.state.lastFaqKey}`)
  }
  console.log('\n[BATCH DONE] ─────────────────────────────────────────────')
}

function findBatchArg(): string | null {
  const i = process.argv.indexOf('--batch')
  if (i === -1) return null
  const v = process.argv[i + 1]
  return v ?? null
}

if (isDirectExecution()) {
  const batch = findBatchArg()
  const runner = batch !== null ? runBatch(batch) : runInteractive()
  runner.catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
