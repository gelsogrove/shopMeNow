import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  commitLanguageFromReply,
  dehydrateState,
  detachFlow,
  clearPendingEscalation,
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
import { customerVerbatim } from './briefing.js'
import {
  formatFlowsBlock,
  formatFlowStepBlock,
  formatIntakeBlock,
  formatPreOperatorInstruction,
  caseShapeFor,
  intakeEvidenceOnRecord,
  intakeFieldMayAlreadyBeAnswered,
  midIntakePendingQuestion,
  nextIntakeStep,
  nextPreOperatorAction,
  pendingQuestionText,
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
// customer-facing copy, and not expected to vary per tenant. Two hours per
// CONTRACT.md rule 32.
const WELCOME_BACK_STALE_MS = 2 * 60 * 60 * 1000

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
      "Classify the customer's last message truthfully so the code can decide what happens to your drafted reply. Only valid when no FAQ answers them.",
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', enum: ['technical_problem_intake', 'greeting_or_smalltalk', 'question_no_faq'] },
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

/**
 * Explicit language switch (CONTRACT.md rules 17/20, Andrea 2026-08-17:
 * "se l'utente chiede di cambiare lingua lo facciamo e settiamo il valore
 * nel DB"). The boundary lives in the SCHEMA: the enum is the workspace's
 * enabledLanguages, so a language outside the list is not even invocable —
 * freedom only inside closed options, no guard needed afterwards.
 */
function setLanguageTool(enabledLanguages: readonly string[]) {
  return {
    type: 'function',
    function: {
      name: 'set_language',
      description:
        'Switch the conversation language — call ONLY when the customer explicitly asks to change language. The choice is saved to their profile.',
      parameters: {
        type: 'object',
        properties: { language: { type: 'string', enum: [...enabledLanguages] } },
        required: ['language'],
        additionalProperties: false,
      },
    },
  } as const
}

function buildToolsForTurn(
  state: SessionState,
  labels: string[],
  faqCount: number,
  enabledLanguages: readonly string[],
): ReadonlyArray<Record<string, unknown>> {
  const faqTool = faqCount > 0 ? [answerFromFaqTool(faqCount)] : []
  const langTool = enabledLanguages.length > 1 ? [setLanguageTool(enabledLanguages)] : []
  if (state.currentNodeId) {
    return [answerStepTool(labels), REMEMBER_TOOL, ABANDON_FLOW_TOOL, ESCALATE_TOOL, ...faqTool, ...langTool]
  }
  return [START_FLOW_TOOL, REMEMBER_TOOL, ESCALATE_TOOL, ...faqTool, ...langTool]
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
  /** FAQ indices the relevance check rejected for the CURRENT message — reset each turn, see agentTurnInternal. */
  rejectedFaqIndices?: Set<number>
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
    // An index already rejected this turn is refused without asking again.
    // The relevance check is itself an LLM call, and the refusal above only
    // ASKS the model not to repeat itself — which it ignored, re-proposing
    // the same entry six times until the hop limit ran out (Andrea
    // 2026-08-16, on a plain "grazie mille"). Remembering the verdict makes
    // the retry structurally impossible and stops paying for it twice.
    if (ctx.rejectedFaqIndices?.has(faqIndex)) {
      return {
        ok: false,
        error: 'faq_already_rejected',
        instruction:
          `FAQ ${faqIndex} was already checked this turn and does not answer the customer. Do NOT ask ` +
          'for it again and do NOT answer from your own knowledge: pick a genuinely different entry, ' +
          "or call escalate_to_operator with reason 'faq_not_found'.",
      }
    }

    if (ctx.settings && ctx.currentMessage) {
      const relevant = await faqAnswersQuestion(ctx.currentMessage, faq, ctx.settings)
      if (!relevant) {
        ctx.rejectedFaqIndices ??= new Set()
        ctx.rejectedFaqIndices.add(faqIndex)
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
      const guardResult = await validateProblemDescription(
        ctx.sessionId,
        String(value).trim(),
        ctx.settings ? (text) => descriptionDescribesSymptom(text, ctx.settings!) : undefined,
      )
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

    // A save that completes the pre-operator checklist while a hand-over is
    // waiting (pendingEscalationReason) does not get to end the turn as
    // prose: escalate_to_operator is force-called NOW. Leaving the re-call
    // to the model is what produced a saved name followed by an invented
    // diagnosis instead of the configured hand-off (Andrea 2026-08-16) —
    // rules 11 and 18 delivered by mechanism, not by instruction.
    if (!afterSave.currentNodeId && afterSave.pendingEscalationReason) {
      const gateAction = nextPreOperatorAction(
        afterSave,
        ctx.gateQuestions,
        getAskedCounts(ctx.sessionId),
        caseShapeFor(afterSave.pendingEscalationReason),
      )
      if (gateAction.kind === 'escalate') {
        return {
          ok: true,
          dictates_text: false,
          force_tool: 'escalate_to_operator',
          instruction:
            'Saved — and every pre-operator check is now complete. Call escalate_to_operator NOW, in ' +
            'this same turn, with the same reason as before. Do not diagnose, summarise or close the ' +
            'conversation yourself.',
        }
      }
    }

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
      //
      // EVIDENCE BEATS DECLARATION: the model picks `reason` fresh on every
      // call, and on a technical case it flip-flopped between calls — the
      // first escalate declared a no_device reason (gate asked ONLY the
      // name), the second a technical one (flow forced after) — so the
      // customer's name landed BEFORE the technical checks, violating rule
      // 11's "name last" (Andrea 2026-08-17, seen live, es conversation).
      // With intake facts on record there IS a device being diagnosed: the
      // shape is technical no matter what reason the model declares.
      const shape = intakeEvidenceOnRecord(state) ? 'technical' : caseShapeFor(reason)

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
        // The hand-over is now officially in progress and waiting on fields:
        // recorded so that the remember() save completing the checklist can
        // force the escalate call the model kept forgetting to repeat.
        updateState(ctx.sessionId, { pendingEscalationReason: reason }, { mirror: false })

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
    clearPendingEscalation(ctx.sessionId)
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

  if (name === 'set_language') {
    const requested = typeof args.language === 'string' ? args.language.trim().toLowerCase() : ''
    const enabled = ctx.settings?.enabledLanguages ?? []
    // The enum already constrains the call; this re-check is the tool
    // refusing (iron rule 2) if a provider ever lets an off-enum value
    // through.
    if (!requested || !enabled.includes(requested)) {
      return {
        ok: false,
        error: 'language_not_enabled',
        instruction:
          `Only these languages are available: ${enabled.join(', ')}. Tell the customer which ones ` +
          'are available, in the current conversation language, and continue unchanged.',
      }
    }
    // Same commit path as the ⟦LANG⟧ tag — mirrors to the customer profile
    // via the patch queue, so the choice persists across sessions (rule 17).
    commitLanguageFromReply(ctx.sessionId, requested)
    return {
      ok: true,
      language: requested,
      instruction:
        `Language switched to "${requested}" and saved to the customer profile. From NOW ON reply ` +
        'ONLY in that language: briefly confirm the switch and, if a question was pending, re-ask ' +
        'it in the new language.',
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
  /** True when a greeting is due this turn: code prepends it to the reply (withGreeting), so the model must not greet on its own. */
  greetingAlreadyDelivered?: boolean
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
  /**
   * Function name a refusing tool demanded be called next (ToolResult.force_tool).
   * Pins tool_choice to that exact function so the order the code decided cannot
   * be answered with free text — the failure mode behind an unattached Human
   * Support flow and an improvised hand-off question.
   */
  forceSpecificTool?: string | null
  /**
   * Exact toolset for this hop, tool_choice 'required' — for the moments the
   * code knows the next move is one of a specific few tools but which one is
   * a semantic call that stays with the model (e.g. post-intake: start_flow
   * or escalate_to_operator, CONTRACT.md rules 5/9).
   */
  curatedTools?: ReadonlyArray<Record<string, unknown>>
}

const FAQ_VERIFY_BLOCK = [
  '',
  '═══ FAQ VERIFICATION (this hop only) ═══',
  'Your drafted reply was free text with no tool call. You MUST pick exactly one:',
  "- An entry in the FAQ block answers the customer's last message → call answer_from_faq with its index.",
  "- No FAQ applies → call keep_draft_reply, classifying the customer's last message truthfully:",
  '  • greeting_or_smalltalk — it asks for no information at all: a greeting, thanks, small talk.',
  '  • technical_problem_intake — it reports a problem with their device; the case intake is handling it.',
  '  • question_no_faq — it asks for information, and NO entry in the FAQ block covers it.',
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
  greetingAlreadyDelivered,
  forceToolChoice,
  forceTextOnly,
  faqVerifyHop,
  forceSpecificTool,
  curatedTools,
}: CallLLMParams): Promise<CallLLMResult> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const runtimeBlock = formatRuntimeBlock(operatorBriefingLanguageOverride, isFirstTurn, settings, state, messages, greetingAlreadyDelivered)

  // No breakpoint here: mainPrompt alone is ~2.5k tokens, under Haiku 4.5's
  // 4096-token minimum, so marking it cached nothing — and a 5m block before
  // the 1h one below is rejected outright ("a ttl='1h' cache_control block
  // must not come after a ttl='5m' block"). The single breakpoint after the
  // static blocks covers this text too: the cached region is a prefix.
  const systemContent: Array<Record<string, unknown>> = [
    { type: 'text', text: commonPrompt },
  ]
  // Block order: least-specific -> most-specific -> hard rules. Later blocks
  // win over earlier ones.
  //
  // The FAQ and flow catalogues are fetched once per turn and are byte-identical
  // across every hop of that turn — and across turns, until the workspace edits
  // one. Only commonPrompt used to carry cache_control, so these two were re-sent
  // and re-charged at full price on all 6 hops. They are the largest blocks in
  // the payload after the prompt itself, which is what made a single customer
  // message cost ~7.5k tokens (Andrea, 2026-08-16 — €15 of credit in one day).
  // Marking the last of the three static blocks extends the cached prefix over
  // all of them: the boundary is a prefix, so one breakpoint covers everything
  // before it.
  if (faqBlock) systemContent.push({ type: 'text', text: faqBlock })
  if (flowsBlock) systemContent.push({ type: 'text', text: flowsBlock })

  // One breakpoint AFTER the last static block, not on the prompt alone:
  // Haiku 4.5 only caches a prefix of 4096+ tokens, and mainPrompt is ~2.5k —
  // under the threshold, so the original single breakpoint could never cache
  // anything at all (measured 2026-08-16: cached_tokens 0 on every hop).
  // Prompt + FAQ + flows together clear it.
  //
  // Default 5m TTL, not 1h: a 1h write is billed at a higher rate, and
  // measured on a real turn (2026-08-16) it raised the write hop from
  // $0.0074 to $0.0103 while still being read back only once. The prefix
  // only has to survive the hops of a turn and a customer typing their next
  // message — minutes, not an hour.
  const lastStaticBlock = systemContent[systemContent.length - 1]
  if (lastStaticBlock) lastStaticBlock.cache_control = { type: 'ephemeral' }

  let currentStepLabels: string[] = []
  if (state.currentNodeId && state.activeFlowGraphSnapshot) {
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
  if (!faqVerifyHop && !state.currentNodeId) {
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
    body.tools = buildToolsForTurn(state, currentStepLabels, faqCount, settings.enabledLanguages)
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
        // A mid-flow language switch is a legitimate customer move (same
        // reasoning as the FAQ detour): the enum keeps it inside the
        // enabled languages by construction.
        ...(settings.enabledLanguages.length > 1 ? [setLanguageTool(settings.enabledLanguages)] : []),
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
      body.tools = [answerFromFaqTool(faqCount), KEEP_DRAFT_REPLY_TOOL]
      body.tool_choice = 'required'
    }

    if (curatedTools) {
      body.tools = curatedTools
      body.tool_choice = 'required'
    }

    if (forceSpecificTool) {
      const offered = body.tools as ReadonlyArray<{ function?: { name?: string } }> | undefined
      if (offered?.some((t) => t.function?.name === forceSpecificTool)) {
        body.tool_choice = { type: 'function', function: { name: forceSpecificTool } }
      }
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

  // Both pieces are translated by the same isolated call, so they run
  // concurrently instead of one waiting on the other — two sequential
  // round-trips for one reply was pure latency, and on the FAQ path it fires
  // on every answer served.
  const [faqTranslated, questionTranslated] = await Promise.all([
    forceReplyIntoLanguage(faqAnswer, targetLanguage, settings),
    pendingNodeQuestion?.trim()
      ? forceReplyIntoLanguage(pendingNodeQuestion, targetLanguage, settings)
      : Promise.resolve(''),
  ])

  const faqText = faqTranslated.trim()
  const written = modelReply.trim()
  if (written && written !== faqText) {
    // eslint-disable-next-line no-console
    console.error(`[demoam][faq-compose] model text replaced by FAQ answer: ${written.slice(0, 140)}`)
  }

  const questionText = questionTranslated.trim()
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
/**
 * Does this text DESCRIBE what is wrong — a symptom, an error code, a sound,
 * a light, a broken part — or does it only say that something doesn't work?
 *
 * The informativeness criterion behind CONTRACT.md rule 7 ("se il problema
 * non è ben spiegato chiediamo più dettagli"): length alone let "no me
 * funciona el Robot" through as a problem description, intake completed on
 * zero information, and the post-intake obligation forced a flow choice the
 * model could only guess — it attached the strange-noise flow and asserted a
 * noise nobody reported (Andrea 2026-08-17, seen live). Same isolated-judge
 * shape as faqAnswersQuestion: one yes/no, temperature 0, fail-open — a
 * judge that cannot run must not block an intake that used to work.
 */
async function descriptionDescribesSymptom(text: string, settings: Settings): Promise<boolean> {
  if (!API_KEY || !text.trim()) return true
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
              'You judge whether a customer message actually DESCRIBES what is wrong with their ' +
              'device: a symptom, an error code, a sound, a light, a behavior, a broken part — ' +
              'any observable detail. Saying only that it does not work / has a problem / is ' +
              'broken, with no observable detail at all, does not count. The message may be in ' +
              'any language. Output exactly one word: YES or NO.',
          },
          { role: 'user', content: text },
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
              'You judge whether a stored, company-approved FAQ may be served as the reply to a ' +
              'customer message. The two may be in different languages — judge meaning, never ' +
              'wording, and treat colloquial near-synonyms in any language as the same request ' +
              '(a customer asking about the "insurance" / "seguro" / "assicurazione" of a product ' +
              'whose FAQ covers its warranty is asking for that FAQ). Default to YES: the FAQ is ' +
              'approved content, and serving a close answer beats refusing one the company already ' +
              'wrote. Answer NO only in two cases: the message asks for no information at all (a ' +
              'greeting, a thank-you, small talk), or the FAQ addresses a clearly different need ' +
              'than the message — different subject matter, not just different phrasing. ' +
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
  // ONE copy of the substitution rule (substituteCustomerName) — this used to
  // duplicate it inline without the orphaned-punctuation cleanup, which is
  // where "Bentornato !" came from (2026-08-17).
  return substituteCustomerName(raw, state.name) ?? undefined
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
    if (greetingAlreadyDelivered) {
      lines.push(
        '',
        '## DO NOT GREET (the greeting is handled for you)',
        '',
        `The ${state.greeting === 'new' ? 'new-customer' : 'returning-customer'} greeting is prepended to your`,
        'reply by the system, in the right language. Writing one of your own — even a',
        'different-sounding "Ciao!" / "Hi there!" / self-introduction — produces a duplicate.',
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
  customerSaid: string[]
  settings: Settings
}): Promise<string> {
  const { state, reason, customerSaid, settings } = params
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

  // Verbatim and untranslated on purpose: a translation is one more model
  // pass over the customer's words, and the whole point of this section is
  // that nothing generated stands between the customer and the operator.
  if (customerSaid.length > 0) {
    lines.push('')
    lines.push('**Customer said (verbatim)**')
    for (const msg of customerSaid) lines.push(`• «${msg}»`)
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
  return (
    text
      .replace(/\{\{\s*customerName\s*\}\}/gi, customerName?.trim() || '')
      .replace(/\s{2,}/g, ' ')
      // An empty name leaves the template's punctuation orphaned —
      // "Bentornato !" (seen live 2026-08-17). Snapping the space out gives
      // "Bentornato!" without inventing any copy.
      .replace(/\s+([!?.,;:])/g, '$1')
      .trim() || null
  )
}

function handoffFallback(messages: WorkspaceMessages | undefined, settings: Settings, customerName: string | undefined): string | null {
  return substituteCustomerName(messages?.humanSupport ?? settings.humanSupportMessage, customerName)
}

/** Tool arguments are model-written JSON: malformed input is a bad call, never a crash. */
function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
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
  // Verdicts are about THIS message: a FAQ that did not answer the last one
  // may well answer the next.
  ctx.rejectedFaqIndices = new Set()

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

  // The greeting is dictated copy (welcomeMessage / welcomeBackMessage,
  // customerName substituted by code), so it is rendered by the ISOLATED
  // translation call at reply-assembly time — after the substance hops have
  // established the turn's language — never by a context-bearing hop.
  //
  // It used to be its own callLLM hop with the full prompt, history and the
  // customer's message in view; told to "only translate", it eventually
  // answered the customer inside the greeting instead (Andrea 2026-08-17,
  // live: an invented warranty apology plus a staged hand-over, all riding
  // on "Bentornato Pinotto" while the real FAQ answer followed below). An
  // isolated call that never receives the customer's message CANNOT answer
  // it — mechanism, not instruction (iron rule 1). It is also far cheaper:
  // the dropped hop re-sent ~3k tokens of context to translate one line.
  //
  // Language: the substance hops commit the turn's language via the
  // ⟦LANG:xx⟧ tag (filtered through resolveEnabledLanguage) before any
  // reply is assembled, and returning customers arrive with the profile
  // language already seeded — so by assembly time state.language is the
  // right target, with defaultLanguage as the safety net.
  const greetingToTranslate = resolveGreetingText(state, settings, messages)
  let greetingRendered: string | null = null
  const withGreeting = async (body: string): Promise<string> => {
    if (!greetingToTranslate) return body
    if (greetingRendered === null) {
      const greetingLang = getState(ctx.sessionId).language || settings.defaultLanguage
      greetingRendered = (await forceReplyIntoLanguage(greetingToTranslate, greetingLang, settings)).trim()
    }
    return greetingRendered && body ? `${greetingRendered}\n\n${body}` : greetingRendered || body
  }

  let awaitingDictatedReply = false
  let dictatedByRefusal = false
  let answeredFromFaq = false
  let servedFaqAnswer: string | null = null
  let servedFaqPendingQuestion: string | null = null
  let faqVerifyHopNext = false
  let faqVerifyAttempted = false
  let faqVerifyDraft: string | null = null
  let forcedToolNext: string | null = null
  let postIntakeForced = false
  let intakeSaveForced = false
  let curatedToolsNext: ReadonlyArray<Record<string, unknown>> | null = null

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
      greetingAlreadyDelivered: !!greetingToTranslate,
      forceToolChoice: mustForceToolChoice && !faqVerifyHopNext,
      forceTextOnly: awaitingDictatedReply,
      faqVerifyHop: faqVerifyHopNext,
      forceSpecificTool: forcedToolNext,
      curatedTools: curatedToolsNext ?? undefined,
    })
    const wasFaqVerifyHop = faqVerifyHopNext
    faqVerifyHopNext = false
    forcedToolNext = null
    curatedToolsNext = null

    // On the verify hop the outcome set is closed by construction: the menu
    // offers only answer_from_faq and keep_draft_reply. Escalation is NOT
    // reachable from here — a turn that already drafted free text has not
    // been asked an unanswered question, and offering the tool anyway is what
    // handed a thank-you ("bene grazie") to a human operator.
    //
    // What the draft is allowed to BE depends on why no FAQ was used, and
    // that reason is the model's own declaration:
    //
    //   greeting_or_smalltalk    — it says the message asks for no
    //                              information. A reply carrying no facts is
    //                              free text by definition, so it stands.
    //   technical_problem_intake — it says the intake questions are handling
    //                              this. Then the ANSWER is the question the
    //                              gate already decided, not the prose the
    //                              model wrote around it.
    //
    // Keeping the draft in the second case is what let a wholly invented
    // four-step app procedure reach a customer (Andrea 2026-08-16: "how can I
    // manage my robot from my app?" — no FAQ covered it, the model declared
    // technical_problem_intake, and its own instructions went out as fact).
    // A guard whose failure mode is "send what the model wrote" is not a
    // guard (CONTRACT.md rule 3); the fix is that the fact-bearing branch has
    // no path to free text at all.
    let effectiveToolCalls = toolCalls
    if (wasFaqVerifyHop) {
      effectiveToolCalls = toolCalls.filter((c) => c.function.name === 'answer_from_faq')
      if (effectiveToolCalls.length === 0) {
        const keepCall = toolCalls.find((c) => c.function.name === 'keep_draft_reply')
        const declaredReason = keepCall ? safeParseArgs(keepCall.function.arguments).reason : undefined

        // Each declared class maps to ONE mechanical outcome — no branch
        // ends in "send whatever the model wrote" unless the model declared
        // the message carries no information request at all.
        if (declaredReason === 'question_no_faq') {
          // The model's own verdict: a question, and no FAQ covers it. From
          // here CONTRACT.md rule 8 is mechanical — hand over without the
          // serial and without the human flow; the escalate gate dictates
          // the name question and the hand-off. Forced, not hoped: leaving
          // the call to the model is how this path ended at "mi serve il
          // numero di serie" instead (2026-08-16).
          // eslint-disable-next-line no-console
          console.error('[demoam][faq-verify] question with no FAQ — forcing escalate_to_operator')
          forcedToolNext = 'escalate_to_operator'
          tokensUsedSoFar += hopTokens
          continue
        }

        if (declaredReason === 'technical_problem_intake') {
          // A fault report: the mechanical next step is intake, and its next
          // missing question is dictated from settings. The draft — prose
          // from the model's own knowledge — is dropped; it is where the
          // invented four-step app procedure came from (2026-08-16).
          const step = nextIntakeStep(getState(ctx.sessionId), ctx.gateQuestions)
          if (step) {
            // eslint-disable-next-line no-console
            console.error('[demoam][faq-verify] fault report — draft dropped, intake question dictated')
            const verifyLang = getState(ctx.sessionId).language || settings.defaultLanguage
            const asked = (await forceReplyIntoLanguage(step.question, verifyLang, settings)).trim()
            const reply = await withGreeting(asked)
            history.push({ role: 'assistant', content: reply })
            return { reply, tokensUsed: tokensUsedSoFar + hopTokens, escalated: false, answeredFromFaq }
          }
        }

        // greeting_or_smalltalk, no declaration, or nothing left to dictate:
        // the draft stands. A missing declaration is the guard failing to
        // answer, not evidence against the draft — treating the two the same
        // desynchronised whole conversations (2026-08-16).
        // eslint-disable-next-line no-console
        console.error(`[demoam][faq-verify] draft kept (reason=${String(declaredReason ?? 'none')})`)
        const draftBody = faqVerifyDraft ?? ''
        const reply = await withGreeting(draftBody)
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
      // ── THE INTAKE INVARIANT ────────────────────────────────────────────
      // Once the customer's own answers put the case on the technical track
      // (midIntakePendingQuestion: an intake fact on record, no flow node
      // pending, a field still missing), free text is no longer how the turn
      // may end: the reply IS the next intake question — wording from
      // settings.gateQuestions (rule 1A), rendered by the isolated
      // translation call. The model's prose on these turns is exactly where
      // the skipped serial question, the re-asked description and the
      // invented diagnosis all came from (Andrea 2026-08-16); it is logged
      // and dropped, never sent. One invariant at the exit, not per-branch
      // patches (CONTRACT.md rule 4). The FAQ detour stays natural (rule
      // 30): answer first, re-ask in the same message — the composition the
      // flows already use. Complaints and pure FAQ chats never trip this:
      // with no intake fact on record the predicate stays null, so their
      // free-text replies are untouched.
      // ── FLOW NODE COMPOSITION ───────────────────────────────────────────
      // A pending node's question is authored in the flow builder: the reply
      // IS that question, rendered by the isolated translation call. The
      // model's rendering freedom here produced editorial color ("il
      // problema è critico", 2026-08-16), empty replies, and finally
      // "I'm Claude, an AI assistant made by Anthropic" said to a customer
      // (2026-08-17) — the last free-text door on the technical track. FAQ
      // detours keep their own composition (composeFaqReply appends the
      // node question already); a refusal's tailored clarify-ask still
      // passes (dictatedByRefusal): it explains what was wrong with the
      // answer, which the bare node question would drop.
      const nodeState = getState(ctx.sessionId)
      if (
        nodeState.currentNodeId &&
        nodeState.activeFlowGraphSnapshot &&
        !servedFaqAnswer &&
        !(awaitingDictatedReply && dictatedByRefusal)
      ) {
        const nodeQuestion = currentNode(buildFlowGraph(nodeState.activeFlowGraphSnapshot), nodeState.currentNodeId)?.question?.trim()
        if (nodeQuestion) {
          if (replyBody) {
            // eslint-disable-next-line no-console
            console.error(`[demoam][node-dictated] model prose dropped: ${replyBody.slice(0, 140)}`)
          }
          const nodeLang = nodeState.language || settings.defaultLanguage
          const asked = (await forceReplyIntoLanguage(nodeQuestion, nodeLang, settings)).trim()
          const reply = await withGreeting(asked)
          history.push({ role: 'assistant', content: reply })
          return { reply, tokensUsed: tokensUsedSoFar + hopTokens, escalated: false, answeredFromFaq }
        }
      }

      const midIntakeQ = midIntakePendingQuestion(getState(ctx.sessionId), ctx.gateQuestions)
      if (midIntakeQ && !(awaitingDictatedReply && dictatedByRefusal)) {
        // Dictating the question would RE-ASK something the customer already
        // said when the missing field is plausibly sitting in their own words
        // (certification 2026-08-17, 07-hs/05: description in the opening
        // message, re-asked at turn 2 — the exact 2026-08-08 bug that
        // scenario exists to prevent). One forced remember attempt instead:
        // the existing intake block renders in save-what-they-said mode, and
        // the field's own guard still rejects a value too thin to count.
        if (!intakeSaveForced && !servedFaqAnswer) {
          const pendingStep = nextIntakeStep(getState(ctx.sessionId), ctx.gateQuestions)
          const customerMessages = history.filter((m) => m.role === 'user').map((m) => m.content ?? '')
          if (intakeFieldMayAlreadyBeAnswered(pendingStep, customerMessages)) {
            intakeSaveForced = true
            forcedToolNext = 'remember'
            awaitingDictatedReply = false
            tokensUsedSoFar += hopTokens
            continue
          }
        }
        const intakeLang = getState(ctx.sessionId).language || settings.defaultLanguage
        let composedBody: string
        if (servedFaqAnswer) {
          composedBody = await composeFaqReply(replyBody, servedFaqAnswer, settings, intakeLang, midIntakeQ)
        } else {
          if (replyBody) {
            // eslint-disable-next-line no-console
            console.error(`[demoam][intake-dictated] model prose dropped: ${replyBody.slice(0, 140)}`)
          }
          composedBody = (await forceReplyIntoLanguage(midIntakeQ, intakeLang, settings)).trim()
        }
        const reply = await withGreeting(composedBody)
        history.push({ role: 'assistant', content: reply })
        return { reply, tokensUsed: tokensUsedSoFar + hopTokens, escalated: false, answeredFromFaq }
      }

      // ── POST-INTAKE OBLIGATION ──────────────────────────────────────────
      // Intake complete on the technical track, no flow ever attached, no
      // hand-over in progress: the next move is mechanical — match a flow or
      // hand over (CONTRACT.md rules 5 and 9) — never prose. Free text here
      // is where "Ora mi serve capire da dove viene il ronzio" stalled a
      // whole conversation (2026-08-16). WHICH flow matches stays the
      // model's semantic call (CLAUDE.md §14), so the hop re-runs with
      // exactly those two tools instead of dictating text. One attempt per
      // turn: if the model still produces no usable move, prose passes
      // (logged) rather than burning the hop budget in a loop.
      const postState = getState(ctx.sessionId)
      const postIntakeDue =
        !postIntakeForced &&
        !servedFaqAnswer &&
        !postState.currentNodeId &&
        !(postState.visitedFlowIds && postState.visitedFlowIds.length > 0) &&
        !postState.pendingEscalationReason &&
        intakeEvidenceOnRecord(postState) &&
        !nextIntakeStep(postState, ctx.gateQuestions)
      if (postIntakeDue) {
        postIntakeForced = true
        // eslint-disable-next-line no-console
        console.error(`[demoam][post-intake-obligation] prose dropped, forcing flow-or-escalate: ${replyBody.slice(0, 120)}`)
        curatedToolsNext = [START_FLOW_TOOL, ESCALATE_TOOL]
        tokensUsedSoFar += hopTokens
        continue
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
      const reply = await withGreeting(replyBody)
      history.push({ role: 'assistant', content: reply })
      if (LLM_DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[state]', formatStateOneLine(getState(ctx.sessionId)))
      }
      return { reply, tokensUsed: tokensUsedSoFar + hopTokens, escalated: false, answeredFromFaq }
    }

    history.push({ role: 'assistant', content: text || null, tool_calls: effectiveToolCalls })

    let escalated = false
    let escalationReason = 'diagnostic_exhausted'

    for (const call of effectiveToolCalls) {
      const args = safeParseArgs(call.function.arguments)
      if (LLM_DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[tool_call]', call.function.name, JSON.stringify(args))
      }

      const answeringNodeId = call.function.name === 'answer_step' ? getState(ctx.sessionId).currentNodeId : undefined

      const result = await executeTool(ctx, call.function.name, args, offeredTools)

      if (result.dictates_text === true) {
        awaitingDictatedReply = true
        // A REFUSAL's dictation (ok:false — a guard composing its own
        // corrective ask, e.g. the vague-description follow-up or the
        // invalid-serial hint) is already sourced text: the intake invariant
        // must let its rendering through, or the tailored ask gets bulldozed
        // into the generic gate question (seen 2026-08-17, first turn of the
        // es scenario). A SAVE's dictation (ok:true acks) stays subject to
        // the invariant — those are the bare-ack stalls of 2026-08-16.
        dictatedByRefusal = result.ok === false
      }

      if (typeof result.force_tool === 'string') {
        forcedToolNext = result.force_tool
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

      // The model's `summary` argument stays a required part of the tool call
      // (making it articulate the case is useful) but it is never shown to a
      // human: briefing and host e-mail both carry the customer's verbatim
      // words instead — see customerVerbatim.
      const verbatim = customerVerbatim(history)
      const briefing = await formatOperatorBriefing({
        state: getState(ctx.sessionId),
        reason: escalationReason,
        customerSaid: verbatim,
        settings,
      })

      detachFlow(ctx.sessionId)
      const customerReplyBody = reply.trim() || handoffFallback(messages, settings, getState(ctx.sessionId).name) || ''
      const customerReply = await withGreeting(customerReplyBody)

      return {
        reply: `${customerReply}\n\n${briefing}`,
        tokensUsed: tokensUsedSoFar + hopTokens + finalHop.tokensUsed,
        escalated: true,
        answeredFromFaq,
        escalationSummary: verbatim.map((m) => `«${m}»`).join('\n'),
      }
    }
  }

  // Running out of tool hops means the MODEL got stuck, not that the customer
  // needs a human: Andrea 2026-08-16 saw "grazie mille, gentilissima!" retry
  // the same rejected FAQ six times and then hand a thank-you to an operator,
  // chat disabled, briefing with an empty name. Escalation is a deliberate
  // act — an explicit request, an emergency, a flow's ESCALATE terminal, a
  // completed gate — never the error path of an exhausted loop.
  //
  // The recovery is the question the CODE already knows is pending: the
  // current flow node, or the next intake step. With neither, nothing is
  // outstanding (the stuck turn was smalltalk), so the turn ends silently
  // rather than inventing a closing line — CLAUDE.md §1A, fail toward
  // silence.
  // eslint-disable-next-line no-console
  console.error('[warn] max tool hops exhausted without a final reply — re-asking the pending question')

  const finalState = getState(ctx.sessionId)
  const pendingQuestion = pendingQuestionText(finalState, settings)

  if (!pendingQuestion) {
    return { reply: await withGreeting(''), tokensUsed: tokensUsedSoFar, escalated: false, answeredFromFaq }
  }

  const askedInLanguage = await forceReplyIntoLanguage(
    pendingQuestion,
    finalState.language || settings.defaultLanguage,
    settings,
  )

  return {
    reply: await withGreeting(askedInLanguage),
    tokensUsed: tokensUsedSoFar,
    escalated: false,
    answeredFromFaq,
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
