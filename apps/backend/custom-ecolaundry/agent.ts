// Orchestrator entry point — see `docs/orchestrator.md` for the full
// step-by-step diagram of how `agentTurn()` routes each customer turn.

import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadRuntime } from './utils/runtime.js'
import { createInitialState } from './utils/state.js'
import { extractEscalationContext, buildEscalationSummary } from './utils/escalation.js'
import { sanitizeCustomerReply } from './utils/message-parsing.js'
import { detectLanguageHeuristic } from './utils/intent.js'
import { runGuardPipeline, type GuardOutcome } from './utils/guards/index.js'
import { lang as resolveTenantLang } from './utils/guards/helpers.js'
import { autoExtractFacts } from './utils/agent-extract.js'
import { executeTool } from './utils/agent-tools.js'
import { loadPromptBundle, buildSystemPrompt } from './utils/agent-prompt.js'
import { callAgentLLM } from './utils/agent-llm.js'
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
import { t } from './utils/localization.js'
import type { SupportedLanguage } from './models/index.js'
import {
  detectResolutionEscalationContradiction,
  stripResolutionSentences,
} from './utils/contradiction.js'
import { closeAsEscalated, undoResolved } from './utils/state-transitions.js'
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
  autoExtractFacts(ar, userMessage)

  // Branch-router architecture (feature-flagged via settings.useBranchRouter).
  // When enabled and we have a registered handler for the chosen branch,
  // dispatch directly. Otherwise fall through to the legacy guard pipeline
  // so the bot keeps working while branches are migrated incrementally.
  // See docs/branch-router-architecture.md for the migration plan.
  if (ar.runtime.settings?.useBranchRouter) {
    const dispatchResult = await maybeDispatchBranch(ar, userMessage)
    if (dispatchResult) {
      history.push({ role: 'user', content: userMessage })
      history.push({ role: 'assistant', content: dispatchResult })
      const polished = polishReplyForTurn(ar, dispatchResult)
      return appendEscalationSummary(ar, polished)
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
  return appendEscalationSummary(ar, polished)
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
  if (ar.state.activeBranch && ar.state.activeBranch !== 'unknown') {
    const result = await dispatchSubsequentTurn(ar, userMessage, ar.state.language as SupportedLanguage ?? 'es')
    return result.handled && result.output ? result.output.reply : null
  }
  // T1: classify and dispatch.
  const result = await dispatchTurnOne(ar, userMessage)
  return result.handled && result.output ? result.output.reply : null
}

// ── Turn pipeline ─────────────────────────────────────────────────────────────

/**
 * Lock state.language to a tenant-allowed value. Called every turn so a stale
 * or mutated value can never produce a reply in a disabled language.
 */
function resolveLanguageForTurn(ar: AgentRuntime, userMessage: string): void {
  if (!ar.state.preferredLanguage) {
    const enabled = ar.runtime.settings.enabledLanguages || []
    const heuristic = detectLanguageHeuristic(userMessage)
    const candidate = heuristic && enabled.includes(heuristic)
      ? heuristic
      : ar.runtime.settings.defaultLanguage
    ar.state.language = candidate
    ar.state.preferredLanguage = candidate
  }
  const resolved = resolveTenantLang(ar)
  if (ar.state.language !== resolved) {
    ar.state.language = resolved
    ar.state.preferredLanguage = resolved
  }
}

/** Persist the guard reply in history, optionally prepending the welcome on T1. */
function applyGuardOutcome(
  session: AgentSession,
  outcome: GuardOutcome,
  userMessage: string,
): string {
  const { ar, history } = session
  let reply = outcome.reply
  if (ar.state.turnCount === 1 && shouldShowWelcome(outcome.reason)) {
    const welcome = renderWelcomeForTurn(ar)
    if (welcome) reply = mergeWelcomeWithReply(welcome, reply)
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
  // Output invariants — strip the bug surfaces previously patched in
  // prompts/agent.txt (rule #1: no patches in prompt). See
  // utils/output-invariants.ts for the catalogue + tests.
  const reply = applyOutputInvariants(noContradiction, {
    location: ar.state.location || null,
  })
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
 */
function appendEscalationSummary(ar: AgentRuntime, reply: string): string {
  if (!ar.pendingEscalation || !ar.state.customerName) return reply
  const ctx = extractEscalationContext(ar.state, ar.state.customerName)
  const summary = buildEscalationSummary(ctx)
  ar.pendingEscalation = null
  closeAsEscalated(ar)
  // Determine output language: tenant lock first, fallback to state.language.
  const lang = resolveTenantLang(ar)
  const handoff = t('operatorHandoffFinal', lang)
  return `${reply}\n\n${handoff}\n\n**👤 Human Support message**\n${summary}`
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

if (isDirectExecution()) {
  runInteractive().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
