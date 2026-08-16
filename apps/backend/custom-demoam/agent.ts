import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  commitLanguageFromReply,
  dehydrateState,
  detachFlow,
  drainPatches,
  extractLanguage,
  FlowGraphNodeSnapshot,
  getAskedCounts,
  hasVisitedFlow,
  hydrateState,
  formatStateForPrompt,
  formatStateOneLine,
  getState,
  incrementTurn,
  JsonValue,
  markEscalationOnce,
  mergeCollectedData,
  registerFieldRequest,
  registerMessageTimestamp,
  resetState,
  resolveEnabledLanguage,
  resolveGreeting,
  seedLanguageIfNeeded,
  SessionState,
  updateState,
} from './state.js'
import { advance, allowedLabels, buildFlowGraph, currentNode } from './flow-machine.js'
import {
  formatFlowsBlock,
  formatFlowStepBlock,
  formatIntakeBlock,
  formatPreOperatorInstruction,
  caseShapeFor,
  intakeFieldMayAlreadyBeAnswered,
  nextIntakeStep,
  nextPreOperatorAction,
  startFlow,
} from './gate.js'
import type { FlowSummary, GateQuestions, ListFlowsHandler, LoadFlowHandler } from './gate.js'
import { validateCustomerName, validateProblemDescription, validateSerialNumber } from './content-guards.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface Settings {
  // The module's main/system prompt (workspace.customChatbotSystemPrompt),
  // regenerated into settings.json on every workspace save with system-level
  // {{variables}} already substituted (chatbot-settings-json.service.ts).
  mainPrompt?: string
  model: string
  temperature: number
  maxTokens: number
  maxToolHops: number
  operatorBriefingLanguage: string
  operatorEmail: string
  emailFrom: string
  emailSubjectPrefix: string
  maxMessageChars: number
  maxMessagesPerMinute: number
  maxTurnsPerSession: number
  maxHistoryMessages?: number
  privacyPolicyUrl: string
  similarityThreshold: number
  topK: number
  audioOutput: boolean
  audioVoices: Record<string, string>
  defaultLanguage: string
  enabledLanguages: string[]
  welcomeMessage?: string
  welcomeBackMessage?: string
  // NOTE: no wipMessage here — the disabled-channel message is
  // workspace.wipMessage, consumed by the HOST's gate before this module is
  // ever loaded. A copy in this file would never be read (Andrea, 2026-08-04).
  rateLimitedMessage?: string
  sessionTooLongMessage?: string
  humanSupportMessage?: string
  gateQuestions?: GateQuestions | null
  // The serial format is this tenant's own domain knowledge, not something
  // this module may hardcode (CLAUDE.md §1A/§1C) — configured per workspace
  // so the code stays a generic regex check.
  serialNumberPattern?: string
  serialNumberFormatHint?: string
  // The shared pre-operator flow every escalation road converges on — a real
  // flow-builder flow (protected, not deletable), not a code-owned question
  // list. This tenant's own flow id, so configured rather than hardcoded.
  humanSupportFlowId?: string
}

let SETTINGS: Settings
try {
  const raw = await readFile(path.join(__dirname, 'settings.json'), 'utf8')
  SETTINGS = JSON.parse(raw)
} catch {
  throw new Error('custom-demoam: settings.json is missing or invalid — no hardcoded fallback (CLAUDE.md §1)')
}

const API_KEY = process.env.OPENROUTER_API_KEY
const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'

function effectiveSettings(override?: Partial<Settings> | null): Settings {
  return override ? { ...SETTINGS, ...stripEmpty(override) } : SETTINGS
}

function stripEmpty(o: Partial<Settings>): Partial<Settings> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out as Partial<Settings>
}

const LLM_DEBUG = process.env.LLM_DEBUG === '1'

// steps.md Step 1.3: a customer whose last message is older than this is
// greeted with welcomeBackMessage instead of falling straight into normal
// chat. Hardcoded per Andrea's explicit decision (2026-08-03, exception to
// CLAUDE.md §1A — see custom-demoam/steps.md Step 1): a timing constant, not
// customer-facing copy, and not expected to vary per tenant.
const WELCOME_BACK_STALE_MS = 60 * 60 * 1000

// How many turns a corrective LOOP node may hold the conversation before the
// flow gives up and escalates. The count is 1 on the turn the customer first
// answers "no" (the turn the node dictates its instruction), so 2 means: ask
// once, allow one more turn to report it done, then move on. Same reasoning
// as the gate's maxAsks — a mechanism bound, not tenant copy.
const MAX_LOOP_TURNS = 2

export interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

/**
 * Customer-facing copy the host passes per turn, with {{customerName}}
 * already substituted. Field names match EXACTLY what the host's invoke()
 * builds for every custom chatbot (custom-client-chatbot.service.ts —
 * `messages: { welcomeBack, humanSupport, rateLimited, sessionTooLong }`);
 * anything the host does not pass falls back to `settings` (the DB-merged
 * settings.json blob), which is the single source of truth Andrea asked for.
 */
export interface WorkspaceMessages {
  welcomeBack?: string | null
  humanSupport?: string | null
  rateLimited?: string | null
  sessionTooLong?: string | null
}

export interface FaqEntry {
  question: string
  answer: string
  keywords?: string[]
}
export type GetFaqsHandler = (params: { workspaceId: string }) => Promise<FaqEntry[]>

export type { FlowSummary, LoadedFlow, ListFlowsHandler, LoadFlowHandler, GateQuestions } from './gate.js'

export interface ChatbotInput {
  userMessage: string
  userName: string
  channel: 'whatsapp' | 'widget' | 'playground'
  config: {
    workspaceId: string
    debugChannel: boolean
    isPlayground: boolean
    // NOTE: the disabled-channel gate (steps.md Step 1.1) lives UPSTREAM in
    // the host (custom-client-chatbot.service.ts invoke(), which answers with
    // workspace.wipMessage before ever loading this module) — same contract
    // as custom-demorobot. chatbotFn is never called with the channel off.
    language?: string
    operatorBriefingLanguageOverride?: string | null
    settings?: Partial<Settings> | null
    messages?: WorkspaceMessages | null
    handlers?: {
      getFaqs?: GetFaqsHandler
      listFlows?: ListFlowsHandler
      loadFlow?: LoadFlowHandler
    }
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    /** Entries carry ISO timestamps — used to derive welcome vs welcome-back. */
    history: HistoryEntry[]
    persistedState?: unknown
  }
}

export interface ChatbotOutput {
  reply: string | null
  language?: string
  shouldEscalate: boolean
  answeredFromFaq?: boolean
  escalationSummary?: string
  notificationEmails?: string
  closeChat: boolean
  patches?: import('./state.js').CustomerPatch[]
  persistedState?: unknown
  audioOutput: boolean
  audioVoices: Record<string, string>
  meta: {
    tokensUsed: number
    agentChain: string[]
  }
  error?: string
}

// ── Tools ────────────────────────────────────────────────────────────────

const START_FLOW_TOOL = {
  type: 'function',
  function: {
    name: 'start_flow',
    description:
      "Attach the troubleshooting flow that matches the customer's problem, chosen from the AVAILABLE FLOWS list. Call this as soon as you can tell which flow applies. Pass the flowId EXACTLY as written in square brackets. If NO flow matches, do NOT call this: go straight to the pre-operator checks instead.",
    parameters: {
      type: 'object',
      properties: {
        flowId: { type: 'string', description: 'The flow id copied verbatim from the AVAILABLE FLOWS list.' },
      },
      required: ['flowId'],
      additionalProperties: false,
    },
  },
} as const

const REMEMBER_TOOL = {
  type: 'function',
  function: {
    name: 'remember',
    description:
      'Save a fact the customer has provided: a fieldKey from the active flow, or one of "name", "company", ' +
      '"phone", "address", "serialNumber", "problemDescription", "robotPoweredOn", "wifiActive", ' +
      '"cutSchedulingActive", "batterySufficient". Call this the MOMENT the customer states their name, ' +
      'company, phone number, or address — even in passing, not just when directly asked.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string', description: 'The value to remember, as a string (numbers/booleans as their string form).' },
      },
      required: ['key', 'value'],
      additionalProperties: false,
    },
  },
} as const

const ESCALATE_TOOL = {
  type: 'function',
  function: {
    name: 'escalate_to_operator',
    description:
      'Escalate this conversation to a human operator. Call this EXACTLY ONCE per incident. Use when the pre-operator gate is satisfied, when a flow reaches an ESCALATE terminal, when no matching flow is found, when a complaint needs a human, or in a genuine emergency.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['complaint', 'diagnostic_exhausted', 'no_matching_flow', 'faq_not_found', 'requested_operator', 'emergency'],
        },
        summary: {
          type: 'string',
          description:
            'Operator briefing: ONLY the facts gathered along the path (what happened, what was collected), in the configured operator briefing language. Do NOT include recommendations, next steps, instructions, or advice for the operator or the customer — the operator decides what to do, you only report the facts.',
        },
      },
      required: ['reason', 'summary'],
      additionalProperties: false,
    },
  },
} as const

const ABANDON_FLOW_TOOL = {
  type: 'function',
  function: {
    name: 'abandon_flow',
    description:
      'Call ONLY when the customer clearly moves to a different subject than the active flow — not when their answer is merely unclear. Leaves whatever was already gathered intact.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
} as const

function answerFromFaqTool(faqCount: number) {
  return {
    type: 'function',
    function: {
      name: 'answer_from_faq',
      description:
        'Answer the customer from one of the entries in the FAQ block, by its index. The tool returns the ' +
        'approved answer text — translate it into the customer\'s language and send it, do not write your own wording of the fact.',
      parameters: {
        type: 'object',
        properties: {
          faqIndex: { type: 'integer', minimum: 0, maximum: Math.max(faqCount - 1, 0) },
        },
        required: ['faqIndex'],
        additionalProperties: false,
      },
    },
  } as const
}

const KEEP_DRAFT_REPLY_TOOL = {
  type: 'function',
  function: {
    name: 'keep_draft_reply',
    description:
      'Let the drafted free-text reply go out unchanged. Only valid when no FAQ answers the customer and no escalation is due — you must state which case applies.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['technical_problem_intake', 'greeting_or_smalltalk'] },
      },
      required: ['reason'],
      additionalProperties: false,
    },
  },
} as const

function answerStepTool(labels: string[]) {
  return {
    type: 'function',
    function: {
      name: 'answer_step',
      description:
        "Classify the customer's answer to the question currently asked, choosing the closest matching option. These are internal identifiers for branching, not necessarily the exact words to show the customer.",
      parameters: {
        type: 'object',
        properties: { label: { type: 'string', enum: labels } },
        required: ['label'],
        additionalProperties: false,
      },
    },
  } as const
}

function buildToolsForTurn(state: SessionState, labels: string[], faqCount: number): ReadonlyArray<Record<string, unknown>> {
  const faqTool = faqCount > 0 ? [answerFromFaqTool(faqCount)] : []
  if (state.currentNodeId) {
    return [answerStepTool(labels), REMEMBER_TOOL, ABANDON_FLOW_TOOL, ESCALATE_TOOL, ...faqTool]
  }
  return [START_FLOW_TOOL, REMEMBER_TOOL, ESCALATE_TOOL, ...faqTool]
}

// ── Operating rules (always injected, never editable per tenant) ───────────
interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

const sessionLocks = new Map<string, Promise<unknown>>()

async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionLocks.get(sessionId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(fn)
  sessionLocks.set(sessionId, next)
  try {
    return await next
  } finally {
    if (sessionLocks.get(sessionId) === next) sessionLocks.delete(sessionId)
  }
}

const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const ZERO_WIDTH_RE = /[​-‍﻿]/g
const BIDI_RE = /[‪-‮⁦-⁩]/g

function sanitizeUserMessage(raw: string, maxMessageChars: number): string {
  let s = (raw ?? '').toString()
  s = s.replace(CONTROL_CHARS_RE, '')
  s = s.replace(ZERO_WIDTH_RE, '')
  s = s.replace(BIDI_RE, '')
  s = s.trim()
  if (s.length > maxMessageChars) s = s.slice(0, maxMessageChars)
  return s
}

interface ToolContext {
  sessionId: string
  workspaceId: string
  customerName?: string
  operatorBriefingLanguageOverride?: string | null
  availableFlows?: FlowSummary[]
  availableFaqs?: FaqEntry[]
  loadFlow?: LoadFlowHandler
  gateQuestions?: GateQuestions | null
  serialNumberPattern?: string
  serialNumberFormatHint?: string
  currentMessage?: string
  /** Needed by answer_from_faq's relevance check (model name for the isolated call). */
  settings?: Settings
  humanSupportFlowId?: string
  /**
   * The hand-off text, already resolved from workspace messages / settings
   * with {{customerName}} substituted. escalate_to_operator returns it as
   * dictated text so the good-bye is the configured sentence, not one the
   * model composes: it used to reach the customer only through
   * handoffFallback, i.e. ONLY when the model produced no text of its own
   * (agent.ts's escalated branch) — so in the normal case the customer read
   * an improvised farewell while settings.humanSupportMessage sat unused.
   */
  handoffMessage?: string
}

interface ToolResult {
  ok: boolean
  [k: string]: unknown
}

function recordEscalation(params: { ticketId: string; reason: string; summary: string }): void {
  const { ticketId, reason, summary } = params
  // eslint-disable-next-line no-console
  console.error(`[demoam][escalation] ${ticketId} reason=${reason}\n${summary}`)
}

function terminalFlowNodeResult(
  sessionId: string,
  node: FlowGraphNodeSnapshot,
  finishedFlowId?: string,
  humanSupportFlowId?: string,
): ToolResult {
  // Marked BEFORE detaching: once detached the session no longer knows which
  // flow just ended, and escalate_to_operator would force the Human Support
  // flow again on the very call this terminal is telling the model to make.
  if (finishedFlowId && humanSupportFlowId && finishedFlowId === humanSupportFlowId) {
    updateState(sessionId, { humanSupportFlowDone: true }, { mirror: false })
  }
  detachFlow(sessionId)

  if (node.terminalType === 'ESCALATE') {
    // A DIAGNOSTIC flow ending in ESCALATE still owes the pre-operator
    // checks, which live in the Human Support flow. Sending the model to
    // escalate_to_operator here would cost two extra hops for nothing: that
    // tool would refuse with human_support_flow_required and name start_flow
    // anyway. Naming it directly saves the round-trip.
    //
    // Andrea 2026-08-06, seen in the CLI runner: with maxToolHops at 6 that
    // detour ran the budget out mid-hand-off, and the customer was sent
    // "Grazie <UNKNOWN>" — the fallback fired before the name was collected.
    const humanSupportStillDue =
      !!humanSupportFlowId &&
      finishedFlowId !== humanSupportFlowId &&
      !getState(sessionId).humanSupportFlowDone
    if (humanSupportStillDue) {
      return {
        ok: true,
        terminal: 'ESCALATE',
        dictates_text: false,
        force_tool: 'start_flow',
        instruction:
          `This flow has reached its escalation point. Do NOT invent a diagnosis or a fix, and do ` +
          `not hand over yet — call start_flow with flowId '${humanSupportFlowId}' NOW to run the ` +
          'standard pre-operator checks, then escalate_to_operator once it completes.',
      }
    }

    return {
      ok: true,
      terminal: 'ESCALATE',
      dictates_text: false,
      instruction:
        'This flow has reached its escalation point. Do NOT invent a diagnosis or a fix — call ' +
        "escalate_to_operator now with reason 'diagnostic_exhausted' and a summary of what was " +
        'gathered along this flow.',
    }
  }

  return {
    ok: true,
    terminal: node.terminalType ?? 'END',
    dictates_text: true,
    instruction:
      'This flow has reached its end. Translate this exact message into the customer\'s language ' +
      'and send it as your whole reply — verbatim in meaning, not reworded, not summarized, and ' +
      'do NOT add a diagnosis, a fix, or a next step of your own:\n\n' +
      node.question,
  }
}

/**
 * THE MENU IS LAW, AND THE CODE IS WHAT ENFORCES IT.
 *
 * Every hop declares which tools it offers (buildToolsForTurn, or the
 * narrowed sets used by the mid-flow pin and the FAQ verify hop). The API
 * treats that list as advisory: the model can emit a function name that was
 * never offered, and before 2026-08-16 we executed it anyway — three separate
 * guards each closed one such escape route (verify hop, mid-flow pin, flow
 * fields via remember) and each left its own uncovered window.
 *
 * One door instead of three patches: a call whose name is not in this hop's
 * menu is REFUSED here, with an instruction naming what to call instead
 * (CLAUDE.md §16 iron rule 2 — the tool refuses, the LLM corrects). Future
 * escape routes hit the same door without needing a new guard.
 */
async function executeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
  offeredTools?: string[],
): Promise<ToolResult> {
  if (offeredTools && !offeredTools.includes(name)) {
    // eslint-disable-next-line no-console
    console.error(`[demoam][off-menu] ${name} called but this hop offers: ${offeredTools.join(', ') || '(none)'}`)
    return {
      ok: false,
      error: 'tool_not_available_this_turn',
      instruction:
        `"${name}" is not available right now. The only tools you may call this turn are: ` +
        `${offeredTools.join(', ') || 'none — write your reply as text'}. Call one of those instead.`,
    }
  }

  if (name === 'start_flow') {
    return startFlow(ctx, args)
  }

  if (name === 'answer_from_faq') {
    const faqs = ctx.availableFaqs ?? []
    const faqIndex = typeof args.faqIndex === 'number' ? args.faqIndex : Number(args.faqIndex)
    const faq = Number.isInteger(faqIndex) ? faqs[faqIndex] : undefined

    if (!faq) {
      return {
        ok: false,
        error: 'unknown_faq_index',
        instruction: `faqIndex ${String(args.faqIndex)} is not in the FAQ block. Use one of the indices shown there, or escalate if none fits.`,
      }
    }

    // The index being in range only means the model picked a number that
    // exists. Whether that FAQ answers THIS customer is a separate question,
    // and nothing upstream has asked it: the block is injected whole, never
    // searched. A tool that refuses is the mechanism; an instruction telling
    // the model to choose carefully is not (iron rule 2).
    if (ctx.settings && ctx.currentMessage) {
      const relevant = await faqAnswersQuestion(ctx.currentMessage, faq, ctx.settings)
      if (!relevant) {
        // eslint-disable-next-line no-console
        console.error(
          `[demoam][faq-reject] index=${faqIndex} q="${faq.question.slice(0, 80)}" for message="${ctx.currentMessage.slice(0, 80)}"`,
        )
        return {
          ok: false,
          error: 'faq_does_not_answer',
          instruction:
            `FAQ ${faqIndex} does not answer what the customer asked — it is about something else. ` +
            'Do NOT send it, and do NOT answer from your own knowledge. If another entry in the FAQ ' +
            'block genuinely answers them, call answer_from_faq with that index instead. If none does, ' +
            "call escalate_to_operator with reason 'faq_not_found'.",
        }
      }
    }

    const faqState = getState(ctx.sessionId)
    let pendingNodeQuestion: string | null = null
    if (faqState.currentNodeId && faqState.activeFlowGraphSnapshot) {
      const pendingNode = currentNode(buildFlowGraph(faqState.activeFlowGraphSnapshot), faqState.currentNodeId)
      pendingNodeQuestion = pendingNode?.question ?? null
    }

    const faqDictation =
      `Translate this exact answer into the customer's language and send it, word for ` +
      `word in meaning:\n\n${faq.answer}\n\n` +
      'Do NOT add anything this text does not already say: no recommendation of your own ("I suggest X", ' +
      '"X is right for you"), no comparison you computed yourself, no offer to connect them with a colleague.'

    return {
      ok: true,
      dictates_text: true,
      instruction: pendingNodeQuestion
        ? `${faqDictation}\n\nThen, in the SAME message, return to the guided procedure by re-asking the ` +
          `pending question, verbatim, translated into the customer's language:\n\n${pendingNodeQuestion}`
        : `${faqDictation} No follow-up question — if the customer needs more than this answer gives them, ` +
          'that is a new turn, not something to improvise now. Send the answer as your whole reply — ' +
          'nothing before it, nothing after it.',
    }
  }

  if (name === 'answer_step') {
    const label = typeof args.label === 'string' ? args.label : null
    if (!label) return { ok: false, error: 'label is required' }

    const state = getState(ctx.sessionId)
    if (!state.currentNodeId || !state.activeFlowGraphSnapshot) {
      return { ok: false, error: 'no_active_flow_step', instruction: 'There is no flow question pending right now.' }
    }

    const graph = buildFlowGraph(state.activeFlowGraphSnapshot)
    const answeredNode = currentNode(graph, state.currentNodeId)
    const result = advance(graph, state.currentNodeId, label)

    if (!result) {
      const labels = allowedLabels(graph, state.currentNodeId)
      return {
        ok: false,
        error: 'unrecognized_answer',
        dictates_text: true,
        instruction:
          `"${label}" does not match any of the valid answers to the current question (${labels.join(', ')}). ` +
          'Ask a brief clarifying question about the SAME thing — do not move on or invent a new question.',
      }
    }

    if (answeredNode?.fieldKey) {
      mergeCollectedData(ctx.sessionId, { [answeredNode.fieldKey]: label })
    }

    if (result.escalate) {
      detachFlow(ctx.sessionId)
      return { ok: true, escalate: true }
    }

    if (result.nextFlowId) {
      if (hasVisitedFlow(ctx.sessionId, result.nextFlowId)) {
        detachFlow(ctx.sessionId)
        return {
          ok: true,
          escalate: true,
          error: 'flow_already_visited',
          instruction:
            'This answer leads back to a flow this conversation has already been through, so the guided ' +
            'path is exhausted. Do NOT restart it — call escalate_to_operator.',
        }
      }

      // detachFlow first: startFlow refuses to attach on top of a flow with
      // a pending node (see gate.ts's flow_already_active guard) — this
      // handoff is the one legitimate case of that, so the old flow's node
      // is cleared before attaching the next one.
      detachFlow(ctx.sessionId)
      const handover = await startFlow(ctx, { flowId: result.nextFlowId })
      if (!handover.ok) {
        return { ok: true, escalate: true, error: 'flow_handover_failed' }
      }
      return handover
    }

    if (result.nextNodeId) {
      const enteredNode = currentNode(graph, result.nextNodeId)

      updateState(ctx.sessionId, { currentNodeId: result.nextNodeId }, { mirror: false })

      const nextNode = enteredNode
      const nextLabels = allowedLabels(graph, result.nextNodeId)
      const nextNodeIsLeaf = !!nextNode && nextLabels.length === 0
      if (!nextNodeIsLeaf) {
        // The next node's question is dictated HERE, in the tool result —
        // same reasoning as start_flow's root-node block. dictates_text
        // alone only forces a text reply, not WHICH text: seen live
        // 2026-08-06, after answer_step(Done) advanced to the cut-scheduling
        // node the model asked for the customer's NAME instead — a question
        // the gate owns, but not yet. The result is what the model is
        // answering; the system-prompt step block alone loses that argument.
        const stepBlock = nextNode ? formatFlowStepBlock(nextNode.question, nextLabels) : null
        return {
          ok: true,
          next_node_id: result.nextNodeId,
          dictates_text: true,
          ...(stepBlock ? { instruction: stepBlock } : {}),
        }
      }

      return terminalFlowNodeResult(
        ctx.sessionId,
        nextNode!,
        getState(ctx.sessionId).activeFlowId,
        ctx.humanSupportFlowId,
      )
    }

    // triggersEscalation edge: the flow ends here without visiting a terminal
    // node. Same bookkeeping as terminalFlowNodeResult — otherwise this exit
    // would leave humanSupportFlowDone unset and escalate_to_operator would
    // send the customer back through the flow it just finished.
    if (
      getState(ctx.sessionId).activeFlowId &&
      ctx.humanSupportFlowId &&
      getState(ctx.sessionId).activeFlowId === ctx.humanSupportFlowId
    ) {
      updateState(ctx.sessionId, { humanSupportFlowDone: true }, { mirror: false })
    }
    detachFlow(ctx.sessionId)
    return { ok: true, escalate: true }
  }

  if (name === 'abandon_flow') {
    detachFlow(ctx.sessionId)
    return { ok: true }
  }

  if (name === 'remember') {
    const key = typeof args.key === 'string' ? args.key : null
    const value = args.value
    if (!key) return { ok: false, error: 'key is required' }

    if (key === 'serialNumber' && ctx.serialNumberPattern) {
      const guardResult = validateSerialNumber(ctx.sessionId, String(value).trim(), ctx.serialNumberPattern, ctx.serialNumberFormatHint)
      if (guardResult) return guardResult
    }

    if (key === 'problemDescription') {
      const guardResult = validateProblemDescription(ctx.sessionId, String(value).trim())
      if (guardResult) return guardResult
    }

    if (key === 'name') {
      const guardResult = validateCustomerName(String(value).trim())
      if (guardResult) return guardResult
    }

    // Andrea 2026-08-05, seen live: with a flow attached and its current node
    // asking a question, the model called remember() for that node's field —
    // and for the flow's OTHER fields in the very same hop — instead of
    // answer_step. Every value was invented: none of it came from anything
    // the customer had said. Narrowing the guard to only the CURRENT node's
    // field let the model route around it by writing the later fields
    // instead, which is the same invention one step ahead. Any fieldKey
    // anywhere in the attached flow's graph is off-limits to remember while
    // that flow is active: the only door in is answer_step, one node at a
    // time, in the order the flow actually presents them.
    // A field that belongs to a flow graph has exactly ONE door in:
    // answer_step, one node at a time, in the order the flow presents them.
    //
    // This used to be conditional on `currentNodeId` — i.e. only while a node
    // was actually pending — which left the door open in exactly the state
    // that produced the 2026-08-16 bug (04-serial-number/02): the Human
    // Support flow was attached but between nodes, and the model wrote
    // wifiActive / cutSchedulingActive / batterySufficient straight in with
    // three remember() calls. The technical checks were then "answered"
    // without the flow ever asking them, and the hand-off improvised a
    // question ("is the robot on?") that was deliberately removed from every
    // flow on 2026-08-07. The guard must not depend on WHEN it is called.
    {
      const liveState = getState(ctx.sessionId)
      const snapshot = liveState.activeFlowGraphSnapshot
      const flowOwnsField = snapshot?.some((n) => n.fieldKey === key) ?? false
      if (flowOwnsField) {
        const pendingLabels =
          liveState.currentNodeId && snapshot
            ? allowedLabels(buildFlowGraph(snapshot), liveState.currentNodeId)
            : []
        return {
          ok: false,
          error: 'field_owned_by_flow',
          dictates_text: true,
          instruction:
            `"${key}" is a guided-procedure field: it can only be set by answering that procedure's ` +
            `questions with answer_step, one at a time, never by remember. ` +
            (pendingLabels.length > 0
              ? `Answer the question pending right now with one of: ${pendingLabels.join(', ')} — do not skip ahead to a later field.`
              : 'Do not fill it in ahead of the procedure — ask nothing of your own and let the flow present its next question.'),
        }
      }
    }

    const nameWasRequestedByPreOperatorGate = key === 'name' && (getAskedCounts(ctx.sessionId)['name'] ?? 0) > 0

    if (key === 'name' || key === 'serialNumber' || key === 'company' || key === 'phone' || key === 'address') {
      updateState(ctx.sessionId, { [key]: String(value) })
    } else {
      mergeCollectedData(ctx.sessionId, { [key]: value as JsonValue })
    }

    if (nameWasRequestedByPreOperatorGate) {
      return {
        ok: true,
        name_saved: true,
        instruction:
          "Do NOT say you already had the customer's name, and do NOT tell them the handover has " +
          'happened yet. Briefly acknowledge the name, then call escalate_to_operator again NOW with ' +
          'the same reason as before — only after that call succeeds is the customer actually being ' +
          'handed over.',
      }
    }

    // Deterministic trigger, decided by code: the save that completes the
    // case dictates the ONLY legitimate next moves. Without this the model
    // was free to fill the gap with a diagnosis from its training data
    // (seen live 2026-08-04: an invented "clean the proximity sensors"
    // procedure for ERROR 001 while a real flow for it sat in the catalogue).
    const afterSave = getState(ctx.sessionId)
    if (!afterSave.currentNodeId && !nextIntakeStep(afterSave, ctx.gateQuestions)) {
      return {
        ok: true,
        case_complete: true,
        instruction:
          'The case is now complete. Your ONLY legitimate next move is start_flow with a ' +
          'matching flow from AVAILABLE FLOWS, or escalate_to_operator if none matches. ' +
          'NEVER diagnose the problem or give repair steps yourself — you do not have that knowledge.',
      }
    }

    // Andrea 2026-08-05, seen live: right after remember saved the serial
    // number, with problemDescription still missing, the model was free
    // (tool_choice still 'required', no dictates_text here) to call
    // escalate_to_operator instead of waiting for the next intake question —
    // got refused by that gate, then INVENTED a value ("<UNKNOWN>") for a
    // field the customer was never asked, just to satisfy the refusal and
    // keep retrying. Same fix as the flow-step/greeting cases: the hop
    // immediately after a save that leaves intake incomplete must be
    // text-only, so the model has no tool to reach for and must ask the
    // dictated question instead.
    const stillNeedsIntake = !afterSave.currentNodeId && !!nextIntakeStep(afterSave, ctx.gateQuestions)

    if (key === 'serialNumber') {
      return {
        ok: true,
        serial_number_accepted: true,
        dictates_text: stillNeedsIntake,
        instruction:
          `The serial number "${String(value).trim()}" is VALID and has been saved — do NOT say it is ` +
          'incomplete, malformed, or ask the customer to re-check it. Move on to the next question.',
      }
    }

    // With a flow question pending, saving a fact is never the whole move:
    // the node still has to be advanced, or the flow stalls while the model
    // runs ahead improvising its own questions.
    //
    // Andrea 2026-08-06, seen in the CLI runner (against the CORRECT graph):
    // on "ok I turned it on" the model called remember and asked about the
    // wifi itself — never answer_step('Done') — so currentNodeId sat on
    // hf_power_fix while the model free-wheeled through wifi and scheduling
    // via remember. Two turns later the loop cap fired on a node the
    // customer had already satisfied, and the whole tail of the flow
    // (wifi_fix, battery) never executed.
    if (afterSave.currentNodeId) {
      return {
        ok: true,
        dictates_text: false,
        instruction:
          'Saved. A flow question is still pending — call answer_step NOW, in this same turn, with ' +
          "the label matching the customer's reply. Do NOT ask the next question yourself and do NOT " +
          'diagnose anything: the flow decides what comes next.',
      }
    }

    return { ok: true, dictates_text: stillNeedsIntake }
  }

  if (name === 'escalate_to_operator') {
    const reason = typeof args.reason === 'string' ? args.reason : 'diagnostic_exhausted'
    const rawSummary = typeof args.summary === 'string' ? args.summary : ''
    if (!rawSummary.trim()) {
      return { ok: false, error: 'summary is required and must be a non-empty string' }
    }

    const state = getState(ctx.sessionId)

    if (reason !== 'emergency') {
      // One ordered checklist decides everything here. The shape says which
      // checklist applies; nextPreOperatorAction says which field is next.
      // This function used to be five nested gates that both READ and WROTE
      // the same handful of flags — the order of the ifs WAS the logic, so
      // every guard added to fix one symptom shifted the balance and exposed
      // the next (Andrea, 2026-08-05: thirteen fixes in one evening, each
      // revealing another). Decide first, mutate after.
      const shape = caseShapeFor(reason)

      // A flow with a question pending can only be advanced by answer_step
      // or abandoned by abandon_flow — never short-circuited into the gate.
      //
      // Andrea 2026-08-06, seen in the CLI runner: mid-flow (cut-scheduling
      // question pending) the model called escalate_to_operator; the gate,
      // seeing serial/description/when answered, dictated the NAME question
      // — so the customer was asked their name in the middle of the
      // technical checks, answered the next flow question instead, and that
      // answer ("sì la programmazione è attiva") was saved as their name and
      // read back in the hand-off. The gate must not even look while a node
      // is pending.
      if (state.currentNodeId) {
        return {
          ok: false,
          error: 'flow_question_pending',
          instruction:
            'A flow is still running with a question pending — do NOT hand over yet. Call answer_step ' +
            "with the customer's answer to that question, or abandon_flow if they clearly changed " +
            'subject, then continue the flow to its end.',
        }
      }

      // Recorded for the operator briefing: "no technical details" must read
      // as "there was no device to diagnose", not "the customer refused".
      if (shape === 'no_device' && !state.skippedTechnicalGate) {
        updateState(ctx.sessionId, { skippedTechnicalGate: true }, { mirror: false })
      }

      // A technical case goes through the Human Support flow before a human
      // sees it: that flow IS the pre-operator technical check (powered on,
      // wifi, cut scheduling, battery), with real branches and a corrective
      // LOOP on "No". Only once it reaches its ESCALATE terminal does the
      // gate below ask the last thing the flow engine cannot capture — the
      // customer's name — and hand over.
      //
      // 'no_device' (complaint / faq_not_found / requested_operator) skips it
      // entirely: there is no device to diagnose, so the only question is the
      // name. Naming the tool by function name rather than "the instruction
      // above" keeps this unambiguous in every language.
      const technicalFlowStillDue =
        shape === 'technical' &&
        !!ctx.humanSupportFlowId &&
        !state.humanSupportFlowDone &&
        !state.currentNodeId
      if (technicalFlowStillDue) {
        // Never order a move the receiving tool will refuse. startFlow's own
        // precondition is that intake is complete (it is what the flow is
        // chosen from), so ordering start_flow with intake still pending was
        // two tools commanding incompatible things: escalate said "attach the
        // flow NOW", startFlow answered 'intake_incomplete', nothing retried,
        // and the conversation walked to the name question with the technical
        // checks never asked — then improvised a question of its own at
        // hand-off (Andrea 2026-08-16, 04-serial-number/02, intermittent).
        //
        // The sequence lives in ONE place: whatever nextIntakeStep still
        // wants comes first, and the flow is ordered only once that is empty.
        // Adding flows or FAQs cannot reintroduce the contradiction, because
        // there is no second copy of the rule to fall out of sync.
        const intakeStillPending = nextIntakeStep(getState(ctx.sessionId), ctx.gateQuestions)
        if (intakeStillPending) {
          return {
            ok: false,
            error: 'intake_incomplete',
            dictates_text: true,
            instruction: formatIntakeBlock(intakeStillPending) ?? '',
          }
        }

        return {
          ok: false,
          error: 'human_support_flow_required',
          dictates_text: false,
          force_tool: 'start_flow',
          instruction:
            `Before handing over: call start_flow with flowId '${ctx.humanSupportFlowId}' NOW — it runs ` +
            'the standard pre-operator checks. Follow it to completion, then call escalate_to_operator ' +
            'again with the same reason.',
        }
      }

      const action = nextPreOperatorAction(
        getState(ctx.sessionId),
        ctx.gateQuestions,
        getAskedCounts(ctx.sessionId),
        shape,
      )

      if (action.kind === 'ask') {
        if (action.alreadyAsked) {
          return {
            ok: false,
            error: 'previous_answer_not_saved',
            instruction:
              `The "${action.field}" question was already put to the customer. If they answered it, call ` +
              `remember({key:'${action.field}', value:'...'}) with that answer FIRST — do not ask again — ` +
              'then call escalate_to_operator again in the same turn. Only ask it again if they genuinely ' +
              'never answered.',
          }
        }

        registerFieldRequest(ctx.sessionId, action.field)
        return {
          ok: false,
          error: 'pre_operator_check_required',
          dictates_text: true,
          instruction: formatPreOperatorInstruction(action),
        }
      }
    }

    const isFirst = markEscalationOnce(ctx.sessionId, reason)
    if (!isFirst) {
      return { ok: true, already_escalated: true, eta_minutes: 15 }
    }

    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`
    recordEscalation({ ticketId, reason, summary: rawSummary })
    // The hand-off sentence is configuration, not something the model writes
    // (CLAUDE.md §1A). dictates_text only when one is actually configured —
    // with nothing to dictate the model still needs to close the turn itself.
    const handoff = substituteCustomerName(ctx.handoffMessage, state.name)
    return {
      ok: true,
      ticket_id: ticketId,
      eta_minutes: 15,
      customer_name: state.name,
      ...(handoff
        ? {
            dictates_text: true,
            instruction:
              'Escalation done. Reply with THIS text, translated into the customer\'s language, ' +
              'and nothing else — do not add questions, promises or a response time:\n\n' +
              handoff,
          }
        : {}),
    }
  }

  return { ok: false, error: `unknown tool: ${name}` }
}

interface CallLLMResult {
  text: string
  toolCalls: ToolCall[]
  tokensUsed: number
  /**
   * The function names this hop actually offered. The API treats `tools` as
   * advisory — the model can and does emit names outside it (seen 2026-08-16:
   * remember() on a verify hop that offered three other tools) — so the menu
   * is enforced in executeTool, which refuses anything not listed here.
   * undefined means "no tools offered" (forceTextOnly hops).
   */
  offeredTools?: string[]
}

interface CallLLMParams {
  commonPrompt: string
  state: SessionState
  history: Message[]
  operatorBriefingLanguageOverride: string | null | undefined
  isFirstTurn: boolean
  faqBlock: string | undefined
  faqCount: number
  flowsBlock: string | undefined
  settings: Settings
  messages?: WorkspaceMessages | null
  /** Resolved (customerName substituted) welcome/welcomeBack text still needing translation this turn — see resolveGreetingText. */
  greetingToTranslate?: string
  /** True when a greeting was due this turn AND already sent in an earlier hop — see agentTurnInternal's dedicated greeting hop. */
  greetingAlreadyDelivered?: boolean
  /**
   * True for the dedicated greeting-only hop itself: suppresses the flow-step
   * / intake-question blocks so the model sees ONLY "translate this greeting,
   * say nothing else" — a "which question to ask" instruction competing with
   * "say only the greeting" is exactly the kind of double-signal that let the
   * model wander off dictated text before (same lesson as forceTextOnly).
   */
  greetingOnlyHop?: boolean
  /**
   * When true, the model MUST call a tool this hop — a free-text reply is
   * rejected by the API itself, not merely discouraged in the prompt.
   *
   * Andrea 2026-08-04, seen in the first real conversation: with the case
   * collected (serial + description) and no flow matching, the model was
   * free to write text and invented "does the display show an error code?"
   * — a question that exists in no gate and no flow. Same class of bug
   * demorobot fixed with flow-runtime.md §10: at that point the only two
   * legitimate moves are start_flow or escalate_to_operator, and the
   * escalate gate then dictates the next question (the customer's name).
   */
  forceToolChoice?: boolean
  /**
   * When true, NO tools are offered this hop at all — the API can only
   * return free text, so the model has no way to call a tool instead of
   * writing the dictated text it was just told to send.
   *
   * Andrea 2026-08-05, seen live twice: (1) the customer's first message
   * asked a question the model could answer directly, so it skipped the
   * mandatory welcome entirely — forceToolChoice is OFF on turn 1 (an
   * empty history has no prior dictation to force), so the model was free
   * to answer_from_faq or just write text, and picked text, silently
   * dropping the greeting. (2) right after start_flow attached a flow,
   * awaitingDictatedReply relaxed tool_choice to 'auto' rather than
   * requiring one — 'auto' still means "call a tool if you want to", and
   * the model called answer_step with a guessed label instead of asking
   * the root node's question, silently skipping it. Both were "mandatory"
   * prose the model could route around by calling ANY tool that fit tool
   * schema. forceTextOnly removes that option structurally: dictated text
   * (greeting, flow-step question, FAQ answer, flow-terminal message) is
   * the only thing the model is capable of producing this hop.
   */
  forceTextOnly?: boolean
  /**
   * Re-check hop fired by agentTurnInternal when a turn is about to end in
   * free text with FAQs in context and no active flow (CONTRACT.md GUARDS:
   * "il modello non può rispondere a una domanda con testo libero" / "le
   * risposte alle FAQ passano da un tool"). Restricts the toolset to
   * answer_from_faq + escalate_to_operator, tool_choice 'auto': calling no
   * tool means the drafted reply stands (a greeting, thanks, an intake
   * question), so this hop can only improve the outcome, never worsen it.
   */
  faqVerifyHop?: boolean
}

const FAQ_VERIFY_BLOCK = [
  '',
  '═══ FAQ VERIFICATION (this hop only) ═══',
  'Your drafted reply was free text with no tool call. You MUST pick exactly one of these three:',
  "- An entry in the FAQ block answers the customer's last message → call answer_from_faq with its index.",
  "- The customer asked for information that no FAQ covers → call escalate_to_operator with reason 'faq_not_found': an unanswered question must reach a human operator, never end at \"I don't have this information\" or at a suggestion to contact someone themselves.",
  '- Neither applies → call keep_draft_reply, declaring why the draft may go out: they are reporting a technical problem the intake questions are handling (technical_problem_intake), or their message asks for no information at all — a greeting, thanks, small talk (greeting_or_smalltalk).',
].join('\n')

async function callLLM({
  commonPrompt,
  state,
  history,
  operatorBriefingLanguageOverride,
  isFirstTurn,
  faqBlock,
  faqCount,
  flowsBlock,
  settings,
  messages,
  greetingToTranslate,
  greetingAlreadyDelivered,
  greetingOnlyHop,
  forceToolChoice,
  forceTextOnly,
  faqVerifyHop,
}: CallLLMParams): Promise<CallLLMResult> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const runtimeBlock = formatRuntimeBlock(operatorBriefingLanguageOverride, isFirstTurn, settings, state, messages, greetingToTranslate, greetingAlreadyDelivered)

  const systemContent: Array<Record<string, unknown>> = [
    { type: 'text', text: commonPrompt, cache_control: { type: 'ephemeral' } },
  ]
  // Block order: least-specific -> most-specific -> hard rules. Later blocks
  // win over earlier ones.
  if (faqBlock) systemContent.push({ type: 'text', text: faqBlock })
  if (flowsBlock) systemContent.push({ type: 'text', text: flowsBlock })

  let currentStepLabels: string[] = []
  if (!greetingOnlyHop && state.currentNodeId && state.activeFlowGraphSnapshot) {
    const graph = buildFlowGraph(state.activeFlowGraphSnapshot)
    const node = currentNode(graph, state.currentNodeId)
    currentStepLabels = allowedLabels(graph, state.currentNodeId)
    const stepBlock = node ? formatFlowStepBlock(node.question, currentStepLabels) : null
    if (stepBlock) systemContent.push({ type: 'text', text: stepBlock })
  }

  if (stateBlock) systemContent.push({ type: 'text', text: stateBlock })
  systemContent.push({ type: 'text', text: runtimeBlock })
  if (faqVerifyHop) systemContent.push({ type: 'text', text: FAQ_VERIFY_BLOCK })

  // Intake gate: while no flow is running and the case details are still
  // missing, the code dictates the exact question (see formatIntakeBlock in
  // gate.ts) — the model translates it, it does not compose its own.
  let intakeWantsRemember = false
  if (!greetingOnlyHop && !faqVerifyHop && !state.currentNodeId) {
    const intakeStep = nextIntakeStep(state, settings.gateQuestions)
    // Only the customer's own words count as "already told us" — assistant
    // turns are what we are trying to avoid repeating, not evidence.
    const customerMessages = history.filter((m) => m.role === 'user').map((m) => m.content ?? '')
    intakeWantsRemember = intakeFieldMayAlreadyBeAnswered(intakeStep, customerMessages)
    const intakeBlock = formatIntakeBlock(intakeStep, intakeWantsRemember)
    if (intakeBlock) systemContent.push({ type: 'text', text: intakeBlock })
  }

  const payloadMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content, tool_calls: m.tool_calls, tool_call_id: m.tool_call_id, name: m.name })),
  ]

  // forceTextOnly omits `tools` entirely rather than sending an empty array
  // or tool_choice:'none' — some providers still accept a tool call with
  // tool_choice:'none' if a tool array is present. Omitting `tools` makes it
  // structurally impossible: there is nothing to call.
  const body: Record<string, unknown> = {
    model: process.env.LLM_MODEL || settings.model,
    messages: payloadMessages,
    temperature: settings.temperature,
    max_tokens: settings.maxTokens,
  }
  if (!forceTextOnly) {
    body.tools = buildToolsForTurn(state, currentStepLabels, faqCount)
    body.tool_choice = forceToolChoice ? 'required' : 'auto'

    // With a flow question pending, 'required' over the FULL toolset is not
    // enough: it only says "call SOME tool", and remember() satisfies it
    // perfectly while leaving the node exactly where it was.
    //
    // Andrea 2026-08-06, seen in the CLI runner: the customer answered "no,
    // the wifi is not active"; the model called remember and then wrote free
    // text, never answer_step. currentNodeId sat on hf_wifi for four turns
    // while the model invented a diagnosis of its own and the customer never
    // reached an operator. The escape route is closed structurally by
    // EXCLUDING remember from this hop's toolset, not by naming a single
    // function: the curated set below keeps every legitimate mid-flow move
    // (answer the node, answer a FAQ question asked mid-flow — Andrea
    // 2026-08-16, the answer_from_faq result then re-dictates the pending
    // node question so the flow resumes in the same message — change of
    // subject, emergency) and nothing else (§16).
    if (forceToolChoice && state.currentNodeId && currentStepLabels.length > 0) {
      body.tools = [
        answerStepTool(currentStepLabels),
        ...(faqCount > 0 ? [answerFromFaqTool(faqCount)] : []),
        ABANDON_FLOW_TOOL,
        ESCALATE_TOOL,
      ]
      body.tool_choice = 'required'
    }

    // Same reasoning one step earlier, for intake. With the problem already
    // described in the customer's opening message, 'required' alone lets the
    // model satisfy the contract with start_flow or escalate_to_operator and
    // leave problemDescription unsaved — after which the intake gate dictates
    // its question and the customer is asked to repeat himself (Andrea,
    // 2026-08-08). Naming remember makes saving the thing he already said the
    // only move available. The tool's own guard
    // (validateProblemDescription) still rejects a value too thin to be a
    // description, so this forces the ATTEMPT, never a bad save.
    if (intakeWantsRemember) {
      body.tool_choice = { type: 'function', function: { name: 'remember' } }
    }

    if (faqVerifyHop) {
      body.tools = [answerFromFaqTool(faqCount), ESCALATE_TOOL, KEEP_DRAFT_REPLY_TOOL]
      body.tool_choice = 'required'
    }
  }

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      'HTTP-Referer': 'https://echatbot.ai',
      'X-Title': 'DemoAM',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 500)}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const text: string = choice?.message?.content ?? ''
  const toolCalls: ToolCall[] = choice?.message?.tool_calls ?? []
  const tokensUsed: number = (data.usage?.prompt_tokens ?? 0) + (data.usage?.completion_tokens ?? 0)

  if (LLM_DEBUG) {
    // eslint-disable-next-line no-console
    console.error('[usage]', JSON.stringify(data.usage ?? {}))
    // eslint-disable-next-line no-console
    console.error('[hop]', JSON.stringify({ node: state.currentNodeId ?? null, called: toolCalls.map((c) => `${c.function.name}(${c.function.arguments.slice(0, 60)})`), text: text.slice(0, 60) }))
  }

  const offeredTools = Array.isArray(body.tools)
    ? (body.tools as Array<{ function?: { name?: string } }>).map((t) => t.function?.name).filter((n): n is string => !!n)
    : undefined

  return { text, toolCalls, tokensUsed, offeredTools }
}

/**
 * Deterministic guard for steps.md Step 1.4 / scenario 01-welcome/07: the
 * prompt alone did not stop the model from replying in a non-enabled
 * language (seen live 2026-08-06, Danish customer — greeting and substance
 * both came back in Danish while enabledLanguages was ['it','en']). When the
 * model's own ⟦LANG:xx⟧ tag names a language outside enabledLanguages, the
 * reply is re-rendered into the resolved language by a dedicated
 * translation-only call: no history, no tools, no room to disobey
 * (CLAUDE.md §16 — a guard, not another prompt rule). Any failure returns
 * the original text: a reply in the wrong language beats no reply.
 */
function declaredLanguageNotEnabled(lang: string | null, settings: Settings): boolean {
  return !!lang && !settings.enabledLanguages.includes(lang.toLowerCase())
}

/**
 * Deterministic guard for the FAQ answer, Andrea 2026-08-16 (seen twice live
 * on the widget): answer_from_faq's result dictates "send this as your whole
 * reply, nothing before it, nothing after it" — and the model wrote its own
 * opening anyway, twice ending it with an INVENTED question ("which part
 * would you like to clean — blades, sensors, chassis?") immediately followed
 * by the FAQ text that answers it. Asking something and answering it in the
 * same breath is nonsense to the customer.
 *
 * The rule Andrea stated: tone is free, CONTENT is not. So the reply is
 * REBUILT here rather than trusted — the model's text is dropped entirely and
 * the FAQ value from the DB is what goes out, translated by the same isolated
 * translation call used elsewhere (no history, no tools, no room to add).
 *
 * Mid-flow the pending node's question is appended by the CALLER, from the
 * graph, for the same reason: that sentence is dictated by code as well, so
 * returning to the guided procedure cannot be improvised either.
 */
async function composeFaqReply(
  modelReply: string,
  faqAnswer: string,
  settings: Settings,
  language: string | undefined,
  pendingNodeQuestion: string | null,
): Promise<string> {
  const targetLanguage = language || settings.defaultLanguage
  const faqText = (await forceReplyIntoLanguage(faqAnswer, targetLanguage, settings)).trim()

  const written = modelReply.trim()
  if (written && written !== faqText) {
    // eslint-disable-next-line no-console
    console.error(`[demoam][faq-compose] model text replaced by FAQ answer: ${written.slice(0, 140)}`)
  }

  if (!pendingNodeQuestion?.trim()) return faqText

  const questionText = (await forceReplyIntoLanguage(pendingNodeQuestion, targetLanguage, settings)).trim()
  return questionText ? `${faqText}\n\n${questionText}` : faqText
}

/**
 * Does the FAQ the model picked actually answer what the customer asked?
 *
 * The FAQ block is injected whole — the host never searches it (see getFaqs in
 * custom-client-chatbot.service.ts: "never searched semantically"), so nothing
 * upstream has ever compared the customer's words to a FAQ. Until now the only
 * check was that the index existed in the array, which means "the model chose
 * a number in range", not "the number is right". Picking a nearby-but-wrong
 * entry produced a confident answer to a question nobody asked.
 *
 * Isolated call, same shape as forceReplyIntoLanguage: no history, no tools,
 * no room to negotiate — one yes/no about one pair. It cannot invent a better
 * FAQ, only accept or reject the one already chosen.
 *
 * On any failure (no API key, network, unparseable answer) this returns true:
 * a verification that cannot run must not silently suppress an answer the
 * company approved. The pre-existing behaviour is the fallback.
 */
async function faqAnswersQuestion(
  customerMessage: string,
  faq: FaqEntry,
  settings: Settings,
): Promise<boolean> {
  if (!API_KEY || !customerMessage.trim()) return true
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || settings.model,
        messages: [
          {
            role: 'system',
            content:
              'You judge whether a stored FAQ answers a customer message. The two may be in ' +
              'different languages — judge the meaning, not the wording. Answer YES only if the ' +
              'FAQ gives the customer what they actually asked for; answer NO if it is merely on ' +
              'a related topic, or answers a different question about the same subject. ' +
              'Output exactly one word: YES or NO.',
          },
          {
            role: 'user',
            content: `Customer message:\n${customerMessage}\n\nStored FAQ:\nQ: ${faq.question}\nA: ${faq.answer}`,
          },
        ],
        temperature: 0,
        max_tokens: 5,
      }),
    })
    if (!res.ok) return true
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> }
    const verdict = data.choices?.[0]?.message?.content?.trim().toUpperCase()
    if (!verdict) return true
    return !verdict.startsWith('NO')
  } catch {
    return true
  }
}

async function forceReplyIntoLanguage(text: string, languageCode: string, settings: Settings): Promise<string> {
  if (!text.trim() || !API_KEY) return text
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || settings.model,
        messages: [
          {
            role: 'system',
            content:
              `Translate the user message into the language with ISO 639-1 code "${languageCode}". ` +
              'If it is already entirely in that language, return it unchanged. ' +
              'Output ONLY the translated text — no preamble, no quotes, no added sentences.',
          },
          { role: 'user', content: text },
        ],
        temperature: 0,
        max_tokens: 1000,
      }),
    })
    if (!res.ok) return text
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string | null } }> }
    return data.choices?.[0]?.message?.content?.trim() || text
  } catch {
    return text
  }
}

/**
 * Which greeting text (if any) the model must translate and open with this
 * turn, {{customerName}} already substituted. CODE still decides whether a
 * greeting is due at all (state.greeting, set once per turn in chatbotFn) —
 * this only resolves WHICH configured string that is. Empty/unconfigured
 * resolves to undefined so formatRuntimeBlock's fallback branch fires instead
 * (no greeting invented when none is configured, CLAUDE.md §1A).
 */
function resolveGreetingText(state: SessionState, settings: Settings, messages: WorkspaceMessages | undefined): string | undefined {
  if (state.greeting !== 'new' && state.greeting !== 'returning') return undefined
  const raw = state.greeting === 'new' ? settings.welcomeMessage : (messages?.welcomeBack ?? settings.welcomeBackMessage)
  const knownName = state.name?.trim()
  const resolved = raw
    ?.replace(/\{\{\s*customerName\s*\}\}/gi, knownName || '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return resolved || undefined
}

function formatFaqBlock(faqs: FaqEntry[]): string | undefined {
  if (!faqs.length) return undefined
  const entries = faqs
    .map((f, i) => {
      const keywords = f.keywords?.length ? `\nKeywords: ${f.keywords.join(', ')}` : ''
      return `[${i}] Q: ${f.question}${keywords}\nA: ${f.answer}`
    })
    .join('\n\n')
  return [
    '',
    '═══ FAQ ═══',
    'Answers already approved by the company. When one of them answers the',
    "customer's question, call answer_from_faq with its index instead of",
    'writing the answer yourself.',
    '',
    entries,
  ].join('\n')
}

function formatRuntimeBlock(
  operatorBriefingLanguageOverride: string | null | undefined,
  isFirstTurn: boolean,
  settings: Settings,
  state: SessionState,
  messages: WorkspaceMessages | null | undefined,
  greetingToTranslate: string | undefined,
  greetingAlreadyDelivered = false,
): string {
  const now = new Date()
  const lines = [
    '## RUNTIME',
    `- Current date/time: ${now.toISOString()}`,
    `- Operator briefing language: ${operatorBriefingLanguageOverride || settings.operatorBriefingLanguage}`,
    `- Privacy policy URL: ${settings.privacyPolicyUrl}`,
    `- First turn: ${isFirstTurn}`,
    `- Customer name: ${state.name?.trim() || 'unknown'}`,
  ]

  if (state.greeting === 'new' || state.greeting === 'returning') {
    if (greetingToTranslate) {
      lines.push(
        '',
        '## THE GREETING TO OPEN WITH (mandatory, this turn only)',
        '',
        'Translate this exact sentence into the language of the customer\'s message — but ONLY if',
        `that language is one of: ${settings.enabledLanguages.join(', ')}. If the customer wrote in any`,
        `other language, translate into ${settings.defaultLanguage} instead (this workspace's default),`,
        'never into the language they actually used. Make the translated sentence your WHOLE reply —',
        'nothing else, the substance of the conversation continues in a separate message right after',
        'this one:',
        '',
        greetingToTranslate,
      )
    } else if (greetingAlreadyDelivered) {
      lines.push(
        '',
        '## DO NOT GREET AGAIN (already sent this turn)',
        '',
        `A ${state.greeting === 'new' ? 'new-customer' : 'returning-customer'} greeting was already sent as its`,
        'own message immediately before this one. Repeating it — even a different-sounding',
        '"Ciao!" / "Hi there!" / self-introduction — is a duplicate, not a nicety.',
        '',
        "If the customer's message was itself just a greeting with no request in it (\"ciao\", \"hi\",",
        '"buongiorno" and nothing else), there is nothing to answer yet: ask how you can help,',
        'in one short sentence, and nothing more. Do not call a tool.',
        '',
        'If instead the customer already asked something or reported a problem, answer THAT and',
        'only that. Do NOT open by asking how you can help — they have already told you.',
      )
    } else {
      lines.push(
        '',
        `- This is a ${state.greeting === 'new' ? 'NEW customer' : 'returning customer'}. No greeting is`,
        '  configured for this case — do NOT write one of your own, start directly with the',
        '  substance of your reply.',
      )
    }
  }

  const humanSupport = messages?.humanSupport ?? settings.humanSupportMessage
  if (humanSupport?.trim()) {
    lines.push(
      '',
      '## HAND-OFF MESSAGE (use when escalate_to_operator succeeds)',
      humanSupport.trim(),
      "After a successful escalation, close with this sentence, translated into the customer's language.",
    )
  }

  if (state.skippedTechnicalGate) {
    lines.push(
      '',
      '## NOTE FOR THE OPERATOR BRIEFING',
      'This case has no device to diagnose (an unanswered FAQ question, or a',
      'complaint about something that already happened): no serial number,',
      'problem description or device checks were collected. Say so plainly in',
      'the summary so the operator knows what kind of case this is.',
    )
  }

  return lines.join('\n')
}

const HUMAN_SUPPORT_MARKER = '**👤 Human Support message**'

// The customer answers in THEIR language, so collectedData and the LLM summary
// arrive in whatever they typed. The operator reads this briefing in the
// workspace default language — translate the free-text values into it. Field
// names and section labels stay as-is: they are keys, not prose.
async function formatOperatorBriefing(params: {
  state: SessionState
  reason: string
  summary?: string
  settings: Settings
}): Promise<string> {
  const { state, reason, summary, settings } = params
  const toOperatorLanguage = (text: string): Promise<string> =>
    forceReplyIntoLanguage(text, settings.defaultLanguage, settings)

  const lines: string[] = [HUMAN_SUPPORT_MARKER, '']

  lines.push(`📌 **Reason:** ${reason}`)
  if (state.skippedTechnicalGate) {
    lines.push('⚠️ **No technical details collected** — no device to diagnose on this incident.')
  }
  lines.push('')

  lines.push('**Customer**')
  lines.push(`• Name: ${state.name?.trim() || '—'}`)
  if (state.company?.trim()) lines.push(`• Company: ${state.company.trim()}`)
  if (state.phone?.trim()) lines.push(`• Phone: ${state.phone.trim()}`)
  if (state.address?.trim()) lines.push(`• Address: ${state.address.trim()}`)
  lines.push(`• Language: ${state.language || '—'}`)
  lines.push('')

  if (!state.skippedTechnicalGate) {
    lines.push('**Case**')
    lines.push(
      `• Serial number: ${state.serialNumber?.trim() || (state.serialNumberExhausted ? 'not provided — customer failed 3 attempts' : 'not provided')}`,
    )
    lines.push(`• Troubleshooting flow: ${state.activeFlowId || 'none matched'}`)

    const collected = state.collectedData ?? {}
    const collectedKeys = Object.keys(collected)
    if (collectedKeys.length > 0) {
      lines.push('')
      lines.push('**Answers collected**')
      // Booleans and other non-prose values have nothing to translate — sending
      // them to the LLM would only risk turning `true` into `vero`.
      const translated = await Promise.all(
        collectedKeys.map((key) => {
          const value = collected[key]
          return typeof value === 'string' && /\p{L}{2,}/u.test(value)
            ? toOperatorLanguage(value)
            : Promise.resolve(String(value))
        }),
      )
      collectedKeys.forEach((key, index) => {
        lines.push(`• ${key}: ${translated[index]}`)
      })
    }
  }

  if (summary?.trim()) {
    lines.push('')
    lines.push('**Summary**')
    lines.push(await toOperatorLanguage(summary.trim()))
  }

  return lines.join('\n')
}

interface TurnResult {
  reply: string
  tokensUsed: number
  escalated: boolean
  answeredFromFaq?: boolean
  escalationSummary?: string
}

// Andrea 2026-08-05, seen live: the maxToolHops-exhausted fallback sent
// "{{customerName}}, I'm putting you through..." to the customer verbatim —
// this path never goes through the LLM (it fires precisely because the LLM
// loop didn't produce usable text), so nothing else ever substitutes the
// placeholder. resolveGreetingText already does this substitution for the
// greeting; this mirrors it for the same reason.
function substituteCustomerName(raw: string | undefined, customerName: string | undefined): string | null {
  const text = raw?.trim()
  if (!text) return null
  return text.replace(/\{\{\s*customerName\s*\}\}/gi, customerName?.trim() || '').replace(/\s{2,}/g, ' ').trim() || null
}

function handoffFallback(messages: WorkspaceMessages | undefined, settings: Settings, customerName: string | undefined): string | null {
  return substituteCustomerName(messages?.humanSupport ?? settings.humanSupportMessage, customerName)
}

async function agentTurnInternal(
  ctx: ToolContext,
  commonPrompt: string,
  history: Message[],
  sanitizedMessage: string,
  operatorBriefingLanguageOverride: string | null | undefined,
  faqBlock: string | undefined,
  flowsBlock: string | undefined,
  settings: Settings,
  messages: WorkspaceMessages | undefined,
): Promise<TurnResult> {
  const isFirstTurn = history.length === 0
  history.push({ role: 'user', content: sanitizedMessage })
  ctx.currentMessage = sanitizedMessage
  ctx.settings = settings

  let state = getState(ctx.sessionId)
  let tokensUsedSoFar = 0

  // A corrective LOOP node ("turn the scheduling on, then tell me") holds the
  // conversation until the customer reports it done. The graph cycles forever
  // by construction — the compiler permits the cycle precisely BECAUSE the
  // node is typed LOOP — so the bound must live in code.
  //
  // Counted per TURN, not per answer_step call: the node dictates its text,
  // which puts the turn into awaitingDictatedReply, and from there the model
  // re-sends that text without calling answer_step at all. The node is
  // entered once and never left, so counting entries counts to one forever.
  //
  // The tally lives in PERSISTED state, not in askedCounts: those are
  // per-process by design, and the CLI runner (like a second dyno) starts a
  // fresh process every turn — an in-memory counter restarts at 1 each time
  // and never reaches the cap.
  //
  // Andrea 2026-08-06, seen in the CLI runner: a customer who answered "no"
  // to cut scheduling got "activate the cut scheduling" on every following
  // turn — they never reached the battery question, never got asked their
  // name, and never reached an operator. Even their name was answered into
  // the loop and ignored. Someone who cannot complete a check must still get
  // to a human: the gate's maxAsks principle, applied to flow nodes.
  if (state.currentNodeId && state.activeFlowGraphSnapshot) {
    const loopGraph = buildFlowGraph(state.activeFlowGraphSnapshot)
    const stuckNode = currentNode(loopGraph, state.currentNodeId)
    if (stuckNode?.terminalType === 'LOOP') {
      const nodeId = state.currentNodeId
      const turnsHere = (state.loopTurns?.[nodeId] ?? 0) + 1
      updateState(
        ctx.sessionId,
        { loopTurns: { ...(state.loopTurns ?? {}), [nodeId]: turnsHere } },
        { mirror: false },
      )
      if (turnsHere >= MAX_LOOP_TURNS) {
        if (ctx.humanSupportFlowId && state.activeFlowId === ctx.humanSupportFlowId) {
          updateState(ctx.sessionId, { humanSupportFlowDone: true }, { mirror: false })
        }
        detachFlow(ctx.sessionId)
      }
      state = getState(ctx.sessionId)
    }
  }

  // The greeting is delivered in its OWN forced-text-only hop, before the
  // loop that handles the substance of the request. Andrea 2026-08-05, seen
  // live: with a mandatory greeting due AND a real question in the same
  // message, tool_choice:'auto' let the model call answer_from_faq and
  // never write the greeting at all — a "translate this and open with it"
  // prompt instruction competing with a tool call, and the tool call won.
  // Splitting into two hops removes the competition structurally: this hop
  // is capable of producing nothing BUT the translated greeting (no tools
  // offered), and the customer still sees one message — the two hops' text
  // is concatenated into a single reply below.
  const greetingToTranslate = resolveGreetingText(state, settings, messages)
  let greetingReply = ''
  if (greetingToTranslate) {
    const greetingHop = await callLLM({
      commonPrompt,
      state,
      history,
      operatorBriefingLanguageOverride,
      isFirstTurn,
      faqBlock: undefined,
      faqCount: 0,
      flowsBlock: undefined,
      settings,
      messages,
      greetingToTranslate,
      greetingOnlyHop: true,
      forceTextOnly: true,
    })
    tokensUsedSoFar += greetingHop.tokensUsed
    const { reply, lang } = extractLanguage(greetingHop.text)
    greetingReply = reply.trim()
    if (lang) {
      commitLanguageFromReply(ctx.sessionId, resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage))
    }
    if (declaredLanguageNotEnabled(lang, settings)) {
      greetingReply = await forceReplyIntoLanguage(greetingReply, settings.defaultLanguage, settings)
    }
  }

  let awaitingDictatedReply = false
  let answeredFromFaq = false
  let servedFaqAnswer: string | null = null
  let servedFaqPendingQuestion: string | null = null
  let faqVerifyHopNext = false
  let faqVerifyAttempted = false
  let faqVerifyDraft: string | null = null

  const EMPTY_REPLY_RETRY_INSTRUCTION =
    "[SYSTEM: Your previous turn produced no visible text. Write your reply to the customer now — ask the pending question or acknowledge their last message — in the customer's language, ending with the ⟦LANG:xx⟧ tag.]"

  for (let hop = 0; hop < settings.maxToolHops; hop++) {
    state = getState(ctx.sessionId)
    // isFirstTurn still exempts this hop: forcing tool_choice:'required'
    // unconditionally was tried 2026-08-16 and reverted — when NO FAQ/flow/
    // step genuinely fits (no active flow, no matching FAQ), 'required'
    // still forces a tool call, and the model picks answer_from_faq with a
    // guessed index rather than being allowed to say honestly "I don't have
    // this information" in free text (seen live: 02-faq-not-found scenario
    // regressed). The original bug this was meant to fix — a first-turn
    // question with a real FAQ match getting an invented apology
    // concatenated with the correct FAQ answer — has no known deterministic
    // guard: the FAQ text is always translated into the customer's language
    // before being sent, so a verbatim content match against the DB's
    // approved text isn't reliable either. Left as a known residual risk,
    // mitigated only by the FAQ block's own instruction to call
    // answer_from_faq instead of writing the answer by hand.
    const mustForceToolChoice = !isFirstTurn && !awaitingDictatedReply
    // forceTextOnly, not just tool_choice:'auto': a tool result with
    // dictates_text:true (a flow-step question, a FAQ answer, a flow
    // terminal message, the pre-operator gate's next question) means the
    // ONLY legitimate move this hop is writing that dictated text. 'auto'
    // still lets the model call a DIFFERENT tool instead — seen live
    // 2026-08-05, right after start_flow attached ERROR 001: the model
    // called answer_step with a guessed label instead of asking the root
    // node's question, silently skipping it.
    const { text, toolCalls, tokensUsed: hopTokens, offeredTools } = await callLLM({
      commonPrompt,
      state,
      history,
      operatorBriefingLanguageOverride,
      isFirstTurn,
      faqBlock,
      faqCount: ctx.availableFaqs?.length ?? 0,
      flowsBlock: state.activeFlowId ? undefined : flowsBlock,
      settings,
      messages,
      greetingToTranslate: undefined,
      greetingAlreadyDelivered: !!greetingToTranslate,
      forceToolChoice: mustForceToolChoice && !faqVerifyHopNext,
      forceTextOnly: awaitingDictatedReply,
      faqVerifyHop: faqVerifyHopNext,
    })
    const wasFaqVerifyHop = faqVerifyHopNext
    faqVerifyHopNext = false

    // On the verify hop the outcome set is closed by construction: the menu
    // (enforced in executeTool) offers only answer_from_faq, escalate_to_
    // operator and keep_draft_reply, so anything that is not one of the first
    // two — an explicit keep_draft_reply, an off-menu attempt, or no call at
    // all — means the drafted reply stands.
    let effectiveToolCalls = toolCalls
    if (wasFaqVerifyHop) {
      effectiveToolCalls = toolCalls.filter(
        (c) => c.function.name === 'answer_from_faq' || c.function.name === 'escalate_to_operator',
      )
      if (effectiveToolCalls.length === 0) {
        // eslint-disable-next-line no-console
        console.error(
          '[demoam][faq-verify]',
          toolCalls.length === 0
            ? 'no tool returned despite required — draft kept (fail-safe)'
            : `draft kept (model called: ${toolCalls.map((c) => `${c.function.name}(${c.function.arguments.slice(0, 80)})`).join(', ')})`,
        )
        const draftBody = faqVerifyDraft ?? ''
        const reply = greetingReply ? `${greetingReply}\n\n${draftBody}`.trim() : draftBody
        history.push({ role: 'assistant', content: reply })
        return { reply, tokensUsed: tokensUsedSoFar + hopTokens, escalated: false, answeredFromFaq }
      }
    }

    if (toolCalls.length === 0) {
      if (mustForceToolChoice) {
        // tool_choice=required was sent but the API returned no tool_calls —
        // a provider contract violation, logged so it surfaces instead of
        // silently passing an invented free-text reply through.
        // eslint-disable-next-line no-console
        console.error('[demoam] tool_choice=required returned no tool_calls — provider contract violation')
      }
      const { reply: rawReply, lang } = extractLanguage(text)
      if (lang) {
        commitLanguageFromReply(ctx.sessionId, resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage))
      }
      let replyBody = rawReply.trim()
      if (declaredLanguageNotEnabled(lang, settings)) {
        replyBody = await forceReplyIntoLanguage(replyBody, settings.defaultLanguage, settings)
      }
      if (!replyBody) {
        // Andrea 2026-08-06, seen live (Danish customer, first turn): the
        // greeting hop always produces text, so the old `!replyBody &&
        // !greetingReply` guard never retried an empty SUBSTANCE hop — the
        // customer got only the greeting, their actual message (a stated
        // fault) silently dropped with no question asked back. The retry
        // must fire whenever the substance is empty, greeting or not.
        // eslint-disable-next-line no-console
        console.error('[demoam][empty-reply-retry]', JSON.stringify({ node: state.currentNodeId ?? null, hop }))
        history.push({ role: 'user', content: EMPTY_REPLY_RETRY_INSTRUCTION })
        const retryHop = await callLLM({
          commonPrompt,
          state,
          history,
          operatorBriefingLanguageOverride,
          isFirstTurn,
          faqBlock,
          faqCount: ctx.availableFaqs?.length ?? 0,
          flowsBlock: state.activeFlowId ? undefined : flowsBlock,
          settings,
          messages,
          greetingToTranslate: undefined,
          greetingAlreadyDelivered: !!greetingToTranslate,
          forceTextOnly: true,
        })
        history.pop()
        tokensUsedSoFar += retryHop.tokensUsed
        const retryExtracted = extractLanguage(retryHop.text)
        if (retryExtracted.lang) {
          commitLanguageFromReply(ctx.sessionId, resolveEnabledLanguage(retryExtracted.lang, settings.enabledLanguages, settings.defaultLanguage))
        }
        replyBody = retryExtracted.reply.trim()
        if (declaredLanguageNotEnabled(retryExtracted.lang, settings)) {
          replyBody = await forceReplyIntoLanguage(replyBody, settings.defaultLanguage, settings)
        }
      }
      const faqVerifyEligible =
        !awaitingDictatedReply &&
        !faqVerifyAttempted &&
        (ctx.availableFaqs?.length ?? 0) > 0 &&
        !getState(ctx.sessionId).currentNodeId
      if (faqVerifyEligible) {
        faqVerifyAttempted = true
        faqVerifyHopNext = true
        faqVerifyDraft = replyBody
        tokensUsedSoFar += hopTokens
        continue
      }
      if (servedFaqAnswer) {
        replyBody = await composeFaqReply(
          replyBody,
          servedFaqAnswer,
          settings,
          getState(ctx.sessionId).language,
          servedFaqPendingQuestion,
        )
      }
      const reply = greetingReply ? `${greetingReply}\n\n${replyBody}`.trim() : replyBody
      history.push({ role: 'assistant', content: reply })
      if (LLM_DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[state]', formatStateOneLine(getState(ctx.sessionId)))
      }
      return { reply, tokensUsed: tokensUsedSoFar + hopTokens, escalated: false, answeredFromFaq }
    }

    history.push({ role: 'assistant', content: text || null, tool_calls: effectiveToolCalls })

    let escalated = false
    let escalationSummary: string | undefined
    let escalationReason = 'diagnostic_exhausted'

    for (const call of effectiveToolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        args = {}
      }
      if (LLM_DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[tool_call]', call.function.name, JSON.stringify(args))
      }

      const answeringNodeId = call.function.name === 'answer_step' ? getState(ctx.sessionId).currentNodeId : undefined

      const result = await executeTool(ctx, call.function.name, args, offeredTools)

      if (result.dictates_text === true) {
        awaitingDictatedReply = true
      }

      if (call.function.name === 'answer_step' && !result.ok && result.error === 'unrecognized_answer' && answeringNodeId) {
        const attempts = registerFieldRequest(ctx.sessionId, `flow_node:${answeringNodeId}`)
        if (attempts >= 2) {
          detachFlow(ctx.sessionId)
        }
      }

      if (call.function.name === 'answer_from_faq' && result.ok) {
        answeredFromFaq = true
        const idx = typeof args.faqIndex === 'number' ? args.faqIndex : Number(args.faqIndex)
        servedFaqAnswer = ctx.availableFaqs?.[idx]?.answer ?? null
        // Mid-flow the reply is FAQ answer + the pending node's question. The
        // tool asks the model to reproduce that question verbatim, but asking
        // is what let invented text in everywhere else — so the question is
        // read from the graph here and appended by composeFaqReply instead.
        const faqTurnState = getState(ctx.sessionId)
        if (faqTurnState.currentNodeId && faqTurnState.activeFlowGraphSnapshot) {
          servedFaqPendingQuestion =
            currentNode(buildFlowGraph(faqTurnState.activeFlowGraphSnapshot), faqTurnState.currentNodeId)?.question ?? null
        }
      }

      if (call.function.name === 'escalate_to_operator' && result.ok) {
        escalated = true
        escalationSummary = typeof args.summary === 'string' ? args.summary : escalationSummary
        escalationReason = typeof args.reason === 'string' ? args.reason : escalationReason
      }

      history.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: call.id,
        name: call.function.name,
      })
    }

    if (escalated) {
      const finalHop = await callLLM({
        commonPrompt,
        state,
        history,
        operatorBriefingLanguageOverride,
        isFirstTurn,
        faqBlock,
        faqCount: ctx.availableFaqs?.length ?? 0,
        flowsBlock: undefined,
        settings,
        messages,
        greetingToTranslate: undefined,
        greetingAlreadyDelivered: !!greetingToTranslate,
      })
      const finalExtracted = extractLanguage(finalHop.text)
      let reply = finalExtracted.reply
      const lang = finalExtracted.lang
      if (lang) {
        commitLanguageFromReply(ctx.sessionId, resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage))
      }
      if (declaredLanguageNotEnabled(lang, settings)) {
        reply = await forceReplyIntoLanguage(reply, settings.defaultLanguage, settings)
      }
      history.push({ role: 'assistant', content: reply })

      const briefing = await formatOperatorBriefing({
        state: getState(ctx.sessionId),
        reason: escalationReason,
        summary: escalationSummary,
        settings,
      })

      detachFlow(ctx.sessionId)
      const customerReplyBody = reply.trim() || handoffFallback(messages, settings, getState(ctx.sessionId).name) || ''
      const customerReply = greetingReply ? `${greetingReply}\n\n${customerReplyBody}`.trim() : customerReplyBody

      return {
        reply: `${customerReply}\n\n${briefing}`,
        tokensUsed: tokensUsedSoFar + hopTokens + finalHop.tokensUsed,
        escalated: true,
        answeredFromFaq,
        escalationSummary,
      }
    }
  }

  // eslint-disable-next-line no-console
  console.error('[warn] max tool hops exhausted without a final reply — escalating')

  const finalState = getState(ctx.sessionId)
  const summary = [
    'The assistant could not resolve this conversation automatically (tool-hop limit reached).',
    `Customer message: ${sanitizedMessage}`,
    finalState.serialNumber ? `Serial number: ${finalState.serialNumber}` : 'Serial number: not provided',
    finalState.activeFlowId ? `Active flow: ${finalState.activeFlowId}` : 'Active flow: none matched',
    finalState.collectedData && Object.keys(finalState.collectedData).length > 0
      ? `Collected data: ${JSON.stringify(finalState.collectedData)}`
      : 'Collected data: none',
  ].join('\n')

  markEscalationOnce(ctx.sessionId, 'diagnostic_exhausted')

  const briefing = await formatOperatorBriefing({
    state: finalState,
    reason: 'diagnostic_exhausted',
    summary,
    settings,
  })

  detachFlow(ctx.sessionId)

  return {
    reply: [greetingReply, handoffFallback(messages, settings, finalState.name), briefing].filter(Boolean).join('\n\n'),
    tokensUsed: tokensUsedSoFar,
    escalated: true,
    answeredFromFaq,
    escalationSummary: summary,
  }
}

export async function agentTurn(
  ctx: ToolContext,
  commonPrompt: string,
  history: Message[],
  rawMessage: string,
  operatorBriefingLanguageOverride: string | null | undefined,
  faqBlock?: string,
  settingsOverride?: Partial<Settings> | null,
  flowsBlock?: string,
  messages?: WorkspaceMessages,
): Promise<TurnResult> {
  const settings = effectiveSettings(settingsOverride)
  const sanitized = sanitizeUserMessage(rawMessage, settings.maxMessageChars)
  if (!sanitized) return { reply: '', tokensUsed: 0, escalated: false }

  const now = Date.now()
  const recentCount = registerMessageTimestamp(ctx.sessionId, now, 60_000)
  if (recentCount > settings.maxMessagesPerMinute) {
    return { reply: (messages?.rateLimited ?? settings.rateLimitedMessage)?.trim() || '', tokensUsed: 0, escalated: false }
  }

  const turnNum = incrementTurn(ctx.sessionId)
  if (turnNum > settings.maxTurnsPerSession) {
    return { reply: (messages?.sessionTooLong ?? settings.sessionTooLongMessage)?.trim() || '', tokensUsed: 0, escalated: false }
  }

  return withSessionLock(ctx.sessionId, () =>
    agentTurnInternal(ctx, commonPrompt, history, sanitized, operatorBriefingLanguageOverride, faqBlock, flowsBlock, settings, messages),
  )
}

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  const settings = effectiveSettings(input.config.settings)

  if (!API_KEY) {
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: 0, agentChain: ['custom-demoam'] },
      error: 'llm_unavailable',
    }
  }

  if (!settings.mainPrompt) {
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: 0, agentChain: ['custom-demoam'] },
      error: 'system_prompt_not_configured',
    }
  }

  try {
    const commonPrompt = settings.mainPrompt
    const sessionId = input.context.sessionId

    const ctx: ToolContext = {
      sessionId,
      workspaceId: input.config.workspaceId,
      customerName: input.userName,
      operatorBriefingLanguageOverride: input.config.operatorBriefingLanguageOverride,
      loadFlow: input.config.handlers?.loadFlow,
      // From the DB-merged settings blob only: gateQuestions lives in the
      // workspace's customChatbotAdvancedSettings JSON, merged into
      // config.settings by the host on every turn — the single source Andrea
      // asked for ("tutto dentro il settings").
      gateQuestions: settings.gateQuestions,
      serialNumberPattern: settings.serialNumberPattern,
      serialNumberFormatHint: settings.serialNumberFormatHint,
      humanSupportFlowId: settings.humanSupportFlowId,
      // RAW on purpose — {{customerName}} is substituted at escalation time,
      // not here: the name is normally collected DURING that very turn (it is
      // the last gate step), so resolving it now would blank the placeholder
      // in exactly the case the message needs it.
      handoffMessage: (input.config.messages?.humanSupport ?? settings.humanSupportMessage) ?? undefined,
    }

    hydrateState(sessionId, input.context.persistedState)

    // steps.md Step 1.2/1.3: new vs. returning vs. mid-conversation, decided
    // in code every turn from what the host already passes (history entries
    // carry ISO timestamps; the customer name comes from session state or the
    // host) — never inferred by the LLM from the transcript.
    const lastEntry = input.context.history[input.context.history.length - 1]
    const lastMessageAtMs = lastEntry?.timestamp ? Date.parse(lastEntry.timestamp) : NaN
    // Host convention: anonymous customers get an auto-generated name
    // "Visitor <id>" (visitor-id.service.ts; prompt-variable-builder.service.ts
    // applies this same prefix check). That is NOT a known customer — treating
    // it as one produced "Bentornato Visitor o5thgaq6" instead of the welcome
    // for new customers (seen live, 2026-08-04). Host metadata, not customer
    // text — CLAUDE.md §14 does not apply.
    const hostName = input.userName?.trim() ?? ''
    const realHostName = hostName && !hostName.startsWith('Visitor ') ? hostName : ''
    const greeting = resolveGreeting({
      historyLength: input.context.history.length,
      lastMessageAtMs: Number.isNaN(lastMessageAtMs) ? undefined : lastMessageAtMs,
      hasKnownName: !!(getState(sessionId).name?.trim() || realHostName),
      nowMs: Date.now(),
      staleMs: WELCOME_BACK_STALE_MS,
    })
    updateState(sessionId, { greeting }, { mirror: false })
    // One-line diagnostic, kept on purpose: when a greeting goes missing in a
    // live conversation this is the only way to tell whether the CODE decided
    // wrong (bug here) or the MODEL ignored the dictated block (prompt issue).
    // eslint-disable-next-line no-console
    console.error(
      `[demoam][greeting] session=${sessionId} greeting=${greeting} historyLen=${input.context.history.length} hostName=${JSON.stringify(hostName)} welcomeConfigured=${!!settings.welcomeMessage?.trim()} welcomeBackConfigured=${!!(input.config.messages?.welcomeBack ?? settings.welcomeBackMessage)?.trim()}`,
    )

    if (input.config.language) {
      seedLanguageIfNeeded(sessionId, input.config.language, settings.enabledLanguages, settings.defaultLanguage)
    }

    const maxHistory = settings.maxHistoryMessages ?? 30
    const fullHistory: Message[] = input.context.history.map((h) => ({ role: h.role, content: h.content }))
    const history: Message[] = fullHistory.length > maxHistory ? fullHistory.slice(-maxHistory) : fullHistory

    let faqBlock: string | undefined
    const getFaqs = input.config.handlers?.getFaqs
    if (getFaqs) {
      try {
        const faqs = await getFaqs({ workspaceId: input.config.workspaceId })
        ctx.availableFaqs = faqs
        faqBlock = formatFaqBlock(faqs)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[demoam] getFaqs handler threw, continuing without FAQ block', err)
      }
    }

    let flowsBlock: string | undefined
    const listFlows = input.config.handlers?.listFlows
    if (listFlows) {
      try {
        const flows = await listFlows({ workspaceId: input.config.workspaceId })
        // ctx.availableFlows keeps ALL flows, and is loaded even while a flow
        // is already attached: startFlow validates against it when an answer
        // hands over to another flow mid-conversation.
        ctx.availableFlows = flows
        // The "AVAILABLE FLOWS" catalogue the model may pick from while
        // classifying the problem: only offered when no flow is running yet,
        // and never including Human Support. escalate_to_operator no longer
        // attaches that flow (the pre-operator checks live in CHECKLIST), so
        // its only remaining role here is to stay out of the catalogue — it
        // is a destination, never a diagnostic match.
        if (!getState(sessionId).activeFlowId) {
          const selectableFlows = flows.filter((f) => f.flowId !== ctx.humanSupportFlowId)
          flowsBlock = formatFlowsBlock(selectableFlows)
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[demoam] listFlows handler threw, continuing without the flow catalogue', err)
      }
    }

    const result = await agentTurn(
      ctx,
      commonPrompt,
      history,
      input.userMessage,
      input.config.operatorBriefingLanguageOverride,
      faqBlock,
      input.config.settings,
      flowsBlock,
      input.config.messages ?? undefined,
    )

    const patches = drainPatches(sessionId)

    let reply = result.reply || ''
    if (!reply) {
      const greet = resolveGreetingText(getState(sessionId), settings, input.config.messages ?? undefined)
      if (greet) reply = greet
    }

    return {
      reply: reply || null,
      language: getState(sessionId).language,
      persistedState: dehydrateState(sessionId),
      shouldEscalate: result.escalated,
      answeredFromFaq: result.answeredFromFaq ?? false,
      escalationSummary: result.escalated ? result.escalationSummary || `Session ${sessionId} escalated (no briefing captured)` : undefined,
      notificationEmails: result.escalated ? process.env.OPERATOR_EMAIL || settings.operatorEmail || undefined : undefined,
      closeChat: result.escalated,
      patches: patches.length > 0 ? patches : undefined,
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: result.tokensUsed, agentChain: ['custom-demoam'] },
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chatbotFn] error:', err)
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: 0, agentChain: ['custom-demoam'] },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export { resetState }
