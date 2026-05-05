// =============================================================================
// CLIENTE-0 ORCHESTRATOR — single source of truth for "who decides what"
// =============================================================================
//
// `agentTurn()` (below) is THE orchestrator. There is no separate intent
// router. Every customer turn flows through these five steps in this order:
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ STEP 1 — Language detection                                          │
//   │   regex heuristic on user message; falls back to a tiny LLM call     │
//   │   (`prompts/language.txt`) only if the heuristic returns null.       │
//   │   Locked to `settings.enabledLanguages`.                             │
//   └──────────────────────────────────────────────────────────────────────┘
//                                  │
//   ┌──────────────────────────────▼───────────────────────────────────────┐
//   │ STEP 2 — autoExtractFacts (utils/agent-extract.ts)                   │
//   │   PURE / DETERMINISTIC. Pulls sticky facts from the user message:    │
//   │     location, machineType, machineNumber, displayState, payment.     │
//   │   Sets pendingFlow markers (caso 4 / 6 / 7 / 17 / 18 / 26 / 28) when │
//   │   the message uniquely identifies a known incident.                  │
//   │   No LLM, no I/O.                                                    │
//   └──────────────────────────────────────────────────────────────────────┘
//                                  │
//   ┌──────────────────────────────▼───────────────────────────────────────┐
//   │ STEP 3 — runGuardPipeline (utils/guards/) ← MAIN DECISION            │
//   │   26 ordered guards. Each is a pure (state, msg) → reply | null.     │
//   │   FIRST MATCH WINS — pipeline halts and the canned reply is sent     │
//   │   to the customer. ~70% of real conversations close here without    │
//   │   ever reaching the LLM. This is by design: deterministic replies   │
//   │   are auditable, free, instant, and easy to test.                    │
//   └──────────────────────────────────────────────────────────────────────┘
//                                  │ no guard matched
//   ┌──────────────────────────────▼───────────────────────────────────────┐
//   │ STEP 4 — LLM agent loop with TOOL CALLING                            │
//   │                                                                      │
//   │   The LLM (model from `settings.model`) receives:                    │
//   │     - system prompt = `prompts/agent.txt` + injected `reglas.md`     │
//   │       + sticky state placeholders + tenant settings                  │
//   │     - full conversation history                                      │
//   │     - schemas of 12 tools (set_location, set_machine_facts,          │
//   │       start_machine_flow, advance_machine_flow, apply_faq_override,  │
//   │       capture_customer_name, escalate_to_operator, ...).             │
//   │                                                                      │
//   │   On EACH iteration the LLM either:                                  │
//   │     (a) returns a plain text reply → loop exits, that's the answer.  │
//   │     (b) returns one or more tool_calls → executeTool() runs them,    │
//   │         their JSON results are appended as `role:'tool'` messages,   │
//   │         and the loop iterates again so the LLM can continue with     │
//   │         fresh data (e.g. it called start_machine_flow and now wants  │
//   │         to phrase the first step prompt for the customer).           │
//   │                                                                      │
//   │   Capped at `settings.maxToolHops` iterations to prevent runaway     │
//   │   loops. NO tool call also exits the loop immediately.               │
//   └──────────────────────────────────────────────────────────────────────┘
//                                  │
//   ┌──────────────────────────────▼───────────────────────────────────────┐
//   │ STEP 5 — Post-processing                                             │
//   │   - Sanitize the reply (strip role-leak, format quirks)              │
//   │   - On turn 1: prepend the configured welcome (unless the LLM        │
//   │     already greeted or the customer already gave concrete facts)     │
//   │   - On turn 2+: strip any greeting paragraph the LLM may have        │
//   │     reintroduced ("Hola, soy Eco" → removed)                         │
//   │   - If the pipeline marked an escalation AND we have customerName,   │
//   │     append the operator handover summary                             │
//   └──────────────────────────────────────────────────────────────────────┘
//
// Why hybrid (deterministic + LLM)?
//   - Deterministic guards = auditable, free, instant, regression-friendly.
//   - LLM tool calling = handles the long tail / context switches / FAQ.
//   - Sticky state survives across turns so context-switching is natural
//     (the customer can ask about pricing mid-troubleshooting and come back).
//
// Run modes — same code in both:
//   - CLI:  `npm run demo` → calls agentTurn() interactively in a REPL.
//   - Web:  `index.ts:chatbotFn` wraps agentTurn() with the API shape the
//           CustomClientChatbotService expects. Identical behaviour.
//
// =============================================================================

import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadRuntime } from './utils/runtime.js'
import { createInitialState } from './utils/state.js'
import { extractEscalationContext, buildEscalationSummary } from './utils/escalation.js'
import { sanitizeCustomerReply } from './utils/message-parsing.js'
import { detectLanguageHeuristic } from './utils/intent.js'
import { runGuardPipeline } from './utils/guards/index.js'
import { lang as resolveTenantLang } from './utils/guards/helpers.js'
import { autoExtractFacts } from './utils/agent-extract.js'
import { executeTool } from './utils/agent-tools.js'
import { loadPromptBundle, buildSystemPrompt } from './utils/agent-prompt.js'
import { callAgentLLM } from './utils/agent-llm.js'
import { renderWelcomeForTurn, shouldShowWelcome, stripWelcomeParagraphs } from './utils/agent-welcome.js'
import { printCliBanner, printCliMessage } from './utils/cli.js'
import { API_KEY } from './utils/llm.js'

import type { AgentMessage, AgentRuntime, AgentSession } from './models/index.js'

// Re-export public types so existing imports from './agent.js' keep working.
export type { AgentRuntime, AgentSession } from './models/index.js'

// Load .env so OPENROUTER_API_KEY is available
try {
  const __envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env')
  process.loadEnvFile(__envFile)
} catch {
  // optional
}

// Hard cap on tool-call iterations per turn. Read from `settings.maxToolHops`
// (json/settings.json) at runtime; this constant is the safety fallback used
// only when settings doesn't define the value.
const DEFAULT_MAX_TOOL_HOPS = 6

// ── Session lifecycle ─────────────────────────────────────────────────────────

export async function createAgentSession(): Promise<AgentSession> {
  const runtime = await loadRuntime()
  const state = createInitialState()
  const ar: AgentRuntime = {
    runtime,
    state,
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  const bundle = await loadPromptBundle()
  return { ar, history: [], bundle }
}

// ── Conversation loop ─────────────────────────────────────────────────────────

export async function agentTurn(session: AgentSession, userMessage: string): Promise<string> {
  const { ar, history, bundle } = session
  ar.state.turnCount = (ar.state.turnCount || 0) + 1
  ar.state.lastActivityAt = Date.now()

  // Detect language from the user message before calling the LLM. This
  // ensures the welcome template (rendered later) uses the right language.
  //
  // Tenant restriction: if the detected language is NOT in
  // settings.enabledLanguages, we fall back to defaultLanguage. This way a
  // tenant can lock the bot to a single language (e.g. only Spanish) even
  // if the customer types in another language.
  if (!ar.state.preferredLanguage) {
    const enabled = ar.runtime.settings.enabledLanguages || []
    const heuristic = detectLanguageHeuristic(userMessage)
    const candidate = (heuristic && enabled.includes(heuristic)) ? heuristic : ar.runtime.settings.defaultLanguage
    ar.state.language = candidate
    ar.state.preferredLanguage = candidate
  }

  // Tenant lock — last line of defence. Every turn we re-validate that
  // state.language is in settings.enabledLanguages. If a caller mutated it
  // mid-session (or a tool reset it to a stale value), force it back to the
  // tenant-resolved value. This makes "settings.json is law" structurally
  // true: there is no code path that can produce a reply in a non-allowed
  // language.
  const resolved = resolveTenantLang(ar)
  if (ar.state.language !== resolved) {
    ar.state.language = resolved
    ar.state.preferredLanguage = resolved
  }

  // Safety net 1: extract sticky facts from the customer message BEFORE the
  // LLM call so the escalation summary is never empty (location, machineType,
  // machineNumber, displayState, paymentCompleted).
  autoExtractFacts(ar, userMessage)

  // Safety net 2: run the deterministic guard pipeline. The first guard
  // that fires produces a reply directly, bypassing the LLM. See
  // utils/guards/index.ts for the ordered list and conditions.
  const guardOutcome = runGuardPipeline(ar, userMessage)
  if (guardOutcome) {
    let reply = guardOutcome.reply
    // First-turn welcome: prepend ONLY if the customer hasn't already
    // described a specific problem. If a guard fires immediately (Caso 9
    // factura, Caso 10 tarjeta, escalation, …) the welcome would feel
    // robotic — we just answer the operational question.
    if (ar.state.turnCount === 1 && shouldShowWelcome(guardOutcome.reason)) {
      const welcome = renderWelcomeForTurn(ar)
      if (welcome) reply = `${welcome}\n\n${reply}`
    }
    history.push({ role: 'user', content: userMessage })
    history.push({ role: 'assistant', content: reply })
    return reply
  }

  // Rebuild system prompt every turn so sticky facts and active overrides are fresh.
  const systemPrompt = buildSystemPrompt(ar, bundle)
  const messages: AgentMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ]

  let hops = 0
  let assistantReply = ''
  const maxToolHops = ar.runtime.settings.maxToolHops || DEFAULT_MAX_TOOL_HOPS

  while (hops < maxToolHops) {
    hops += 1
    const response = await callAgentLLM(messages, ar.runtime)
    messages.push(response)

    const toolCalls = response.tool_calls || []
    if (toolCalls.length === 0) {
      assistantReply = response.content || ''
      break
    }

    for (const call of toolCalls) {
      let parsedArgs: Record<string, unknown> = {}
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}')
      } catch {
        parsedArgs = {}
      }
      const result = await executeTool(ar, call.function.name, parsedArgs)
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      })
    }
  }

  // Persist the assistant's final reply in history (without the tool dance,
  // for cleaner context next turn).
  history.push({ role: 'user', content: userMessage })
  history.push({ role: 'assistant', content: assistantReply })

  // First-turn welcome: prepend the configured welcome message in the
  // customer's detected language unless the LLM already greeted OR the
  // customer already gave concrete machine facts at T1 (location +
  // displayState or location + machineType + machineNumber). In those
  // cases the bot is already mid-action and adding "Hola, soy …" feels
  // robotic.
  let finalReply = sanitizeCustomerReply(assistantReply)
  if (ar.state.turnCount === 1) {
    const llmAlreadyGreeted = /\b(soy|sono|i'?m|i am|sou|je suis)\s+(?:el|the|l['o]|le|il)?\s*asistente|\bsoy\s+eco\b/i.test(finalReply)
    const hasOperationalFacts = !!(
      ar.state.location && (ar.state.displayState || ar.state.machineNumber)
    )
    if (!llmAlreadyGreeted && !hasOperationalFacts) {
      const welcome = renderWelcomeForTurn(ar)
      if (welcome) finalReply = `${welcome}\n\n${finalReply}`
    }
  } else {
    // Turn 2+: strip any greeting paragraph the LLM may have produced.
    finalReply = stripWelcomeParagraphs(finalReply)
  }

  if (ar.pendingEscalation && ar.state.customerName) {
    const ctx = extractEscalationContext(ar.state, ar.state.customerName)
    const summary = buildEscalationSummary(ctx)
    finalReply = `${finalReply}\n\n**👤 Human Support message**\n${summary}`
    ar.pendingEscalation = null
    ar.state.pendingClosure = 'escalated'
  }

  return finalReply
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

async function runInteractive(): Promise<void> {
  if (!API_KEY) {
    console.error('OPENROUTER_API_KEY missing. Export it before running the agent demo.')
    process.exit(1)
  }
  const session = await createAgentSession()
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  printCliBanner('Cliente-0 Agent Demo (Step X)', 'LLM-as-agent prototype. /exit to quit, /reset to restart.')

  while (true) {
    let input = ''
    try {
      input = await rl.question('')
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ERR_USE_AFTER_CLOSE') break
      throw err
    }
    const trimmed = input.trim()
    if (!trimmed) continue
    if (trimmed === '/exit' || trimmed === '/quit') break
    if (trimmed === '/reset') {
      const fresh = await createAgentSession()
      session.ar = fresh.ar
      session.history = fresh.history
      session.bundle = fresh.bundle
      printCliMessage('Info', 'Session reset.')
      continue
    }
    try {
      const reply = await agentTurn(session, trimmed)
      printCliMessage('Bot', reply)
    } catch (err) {
      printCliMessage('Error', `Agent error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  rl.close()
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
