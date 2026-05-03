// Agent-mode entrypoint — Step X.
//
// Architecture:
//   1 LLM agent loops with tool calling
//   - Tools wrap the existing flow-engine, locations.json, escalation builder
//   - State is sticky: facts persist across turns, conversation history is
//     fully replayed to the LLM each turn so context-switching is natural
//   - Conversation runs until the agent decides to reply (no tool call) OR
//     it reaches a hard cap of MAX_TOOL_HOPS per turn
//   - Two safety nets BEFORE the LLM call:
//       1. autoExtractFacts (utils/agent-extract.ts)
//       2. runGuardPipeline (utils/agent-guards.ts)
//
// Run:
//   npm run demo                 # interactive REPL (alias of demo:agent)
//   npm run demo:agent
//
// chatbot.ts (legacy) is untouched and kept as `npm run demo:legacy`.

import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { loadRuntime } from './utils/runtime.js'
import { createInitialState } from './utils/state.js'
import { extractEscalationContext, buildEscalationSummary } from './utils/escalation.js'
import { sanitizeCustomerReply } from './utils/message-parsing.js'
import { detectLanguageHeuristic } from './utils/intent.js'
import { runGuardPipeline } from './utils/agent-guards.js'
import { autoExtractFacts } from './utils/agent-extract.js'
import { executeTool } from './utils/agent-tools.js'
import { loadPromptBundle, buildSystemPrompt } from './utils/agent-prompt.js'
import { callAgentLLM } from './utils/agent-llm.js'
import { renderWelcomeForTurn, stripWelcomeParagraphs } from './utils/agent-welcome.js'
import { printCliBanner, printCliMessage } from './utils/cli.js'
import { API_KEY } from './utils/llm.js'

import type { AgentMessage, AgentRuntime, AgentSession } from './utils/agent-types.js'

// Re-export public types so existing imports from './agent.js' keep working.
export type { AgentRuntime, AgentSession } from './utils/agent-types.js'

// Load .env so OPENROUTER_API_KEY is available
try {
  const __envFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env')
  process.loadEnvFile(__envFile)
} catch {
  // optional
}

const MAX_TOOL_HOPS = 6

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

  // Safety net 1: extract sticky facts from the customer message BEFORE the
  // LLM call so the escalation summary is never empty (location, machineType,
  // machineNumber, displayState, paymentCompleted).
  autoExtractFacts(ar, userMessage)

  // Safety net 2: run the deterministic guard pipeline. The first guard
  // that fires produces a reply directly, bypassing the LLM. See
  // utils/agent-guards.ts for the ordered list and conditions.
  const guardOutcome = runGuardPipeline(ar, userMessage)
  if (guardOutcome) {
    let reply = guardOutcome.reply
    // First-turn welcome: prepend the configured welcome message even when
    // a deterministic guard short-circuits the LLM.
    if (ar.state.turnCount === 1) {
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

  while (hops < MAX_TOOL_HOPS) {
    hops += 1
    const response = await callAgentLLM(messages)
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
  // customer's detected language unless the LLM already greeted.
  let finalReply = sanitizeCustomerReply(assistantReply)
  if (ar.state.turnCount === 1) {
    const llmAlreadyGreeted = /\b(soy|sono|i'?m|i am|sou|je suis)\s+eco\b/i.test(finalReply)
    if (!llmAlreadyGreeted) {
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
