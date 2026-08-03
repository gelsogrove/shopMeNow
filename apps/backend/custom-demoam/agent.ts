import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  commitLanguageFromReply,
  dehydrateState,
  detachFlow,
  drainPatches,
  extractLanguage,
  getAskedCounts,
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
  nextIntakeStep,
  nextPreOperatorStep,
  startFlow,
} from './gate.js'
import type { FlowSummary, GateQuestions, ListFlowsHandler, LoadFlowHandler } from './gate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface Settings {
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
    systemPromptOverride?: string | null
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

async function buildCommonPrompt(): Promise<string> {
  return readFile(path.join(__dirname, 'prompts', 'common.md'), 'utf8')
}

let cachedCommonPromptPromise: Promise<string> | null = null
function getCachedCommonPrompt(): Promise<string> {
  if (!cachedCommonPromptPromise) cachedCommonPromptPromise = buildCommonPrompt()
  return cachedCommonPromptPromise
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
      'Save a fact the customer has provided: a fieldKey from the active flow, or one of "name", "serialNumber", "problemDescription", "robotPoweredOn", "wifiActive", "cutSchedulingActive", "batterySufficient". Call this the moment the customer gives you the information.',
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
          enum: ['complaint', 'diagnostic_exhausted', 'no_matching_flow', 'faq_not_found', 'emergency'],
        },
        summary: { type: 'string', description: 'Operator briefing: facts gathered along the path, in the configured operator briefing language.' },
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
 * Tools available this turn, decided by phase (flow-runtime.md §9 pattern):
 * a flow is attached -> answer_step/remember/abandon_flow/escalate; no flow
 * attached -> start_flow/remember/escalate. A tool not exposed cannot be
 * misused.
 */
function buildToolsForTurn(state: SessionState, labels: string[]): ReadonlyArray<Record<string, unknown>> {
  if (state.currentNodeId) {
    return [answerStepTool(labels), REMEMBER_TOOL, ABANDON_FLOW_TOOL, ESCALATE_TOOL]
  }
  return [START_FLOW_TOOL, REMEMBER_TOOL, ESCALATE_TOOL]
}

// ── Operating rules (always injected, never editable per tenant) ───────────
const OPERATING_RULES = [
  '## HOW TO ANSWER',
  '',
  '- ONE question per message. Never stack two.',
  '- Number the options ("1.", "2.", "3.") when a flow or FAQ offers a choice,',
  '  one per line, a few words each. A bare number in the reply picks that',
  '  option. Never invent your own option list.',
  '- Emoji: at most one per message, only when it adds something. None is fine.',
  '',
  '## SOURCES OF TRUTH',
  '',
  'Everything you tell the customer comes from the ACTIVE FLOW block, the FAQ',
  'block, or SESSION STATE. Your training data is NOT a source here.',
  '',
  '- NEVER invent a diagnosis, a cause, a fix, or a question of your own.',
  '- NEVER invent product facts: models, prices, warranty, parts, delivery times.',
  '- NEVER confirm a serial number or warranty unless SESSION STATE says so.',
  '- NEVER send a placeholder ("{{customerName}}", "[NAME]"): substitute the real',
  '  value or rewrite the sentence without it.',
  '- An honest "I do not have that information, I am passing you to a colleague"',
  '  is ALWAYS correct. A plausible-sounding guess is a serious error.',
  '',
  '## CLASSIFYING THE REQUEST (once per incident, then stay on that track)',
  '',
  'Classify the turn into exactly one of three categories, then follow that',
  'track for the rest of the conversation about THIS incident:',
  '',
  '- **complaint** — the customer is unhappy about something that already',
  '  happened. Go straight to the pre-operator checks, then escalate.',
  '- **faq** — a general question a FAQ answers. Reply from the FAQ. If no FAQ',
  '  answers it, ask only for their name and escalate (reason "faq_not_found")',
  '  — do NOT run the full pre-operator checks for this case, there is no',
  '  technical problem to diagnose.',
  '- **troubleshooting** — the customer describes a problem to fix. Ask for the',
  '  serial number, then when it started, then look for a matching flow in',
  '  AVAILABLE FLOWS. If one matches, start_flow and follow it. If its terminal',
  '  is ESCALATE, or none matches, go to the pre-operator checks, then escalate.',
  '',
  'Once a flow is attached it is your ONLY script: follow its steps in order and',
  'ignore the catalogue. Never mix questions from another flow into it.',
  '',
  '## HANDING OVER',
  '',
  'Never promise an operator will get in touch without calling',
  'escalate_to_operator in the same turn. Then confirm BY NAME: "Andrea, I am',
  'putting you through to our operator, they will get back to you shortly."',
  '',
  'EMERGENCY (injury, animal hurt, smoke, fire, damage): escalate IMMEDIATELY',
  'with reason "emergency" — nothing may delay reaching a human. In the same',
  'reply, acknowledge what happened with genuine concern and ask for the details',
  'the operator needs. Never answer an emergency with one flat line.',
].join('\n')

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

// steps.md 2-C.1: after 3 invalid serial-number attempts, stop asking and
// fall straight to the pre-operator gate rather than looping forever.
const MAX_SERIAL_ATTEMPTS = 3
const SERIAL_ATTEMPTS_KEY = 'serialNumber_invalid'

interface ToolContext {
  sessionId: string
  workspaceId: string
  customerName?: string
  operatorBriefingLanguageOverride?: string | null
  availableFlows?: FlowSummary[]
  loadFlow?: LoadFlowHandler
  gateQuestions?: GateQuestions | null
  serialNumberPattern?: string
  serialNumberFormatHint?: string
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

async function executeTool(ctx: ToolContext, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === 'start_flow') {
    return startFlow(ctx, args)
  }

  if (name === 'answer_step') {
    const label = typeof args.label === 'string' ? args.label : null
    if (!label) return { ok: false, error: 'label is required' }

    const state = getState(ctx.sessionId)
    if (!state.currentNodeId || !state.activeFlowGraphSnapshot) {
      return { ok: false, error: 'no_active_flow_step', instruction: 'There is no flow question pending right now.' }
    }

    const graph = buildFlowGraph(state.activeFlowGraphSnapshot)
    const result = advance(graph, state.currentNodeId, label)

    if (!result) {
      const labels = allowedLabels(graph, state.currentNodeId)
      return {
        ok: false,
        error: 'unrecognized_answer',
        instruction:
          `"${label}" does not match any of the valid answers to the current question (${labels.join(', ')}). ` +
          'Ask a brief clarifying question about the SAME thing — do not move on or invent a new question.',
      }
    }

    if (result.escalate) {
      detachFlow(ctx.sessionId)
      return { ok: true, escalate: true }
    }

    if (result.nextNodeId) {
      updateState(ctx.sessionId, { currentNodeId: result.nextNodeId }, { mirror: false })
      return { ok: true, next_node_id: result.nextNodeId }
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

    // steps.md 2-C.1: format check lives in code (tool refuses, LLM
    // corrects), the pattern/hint themselves come from settings.json — this
    // tenant's serial format, not a literal in this file.
    if (key === 'serialNumber' && ctx.serialNumberPattern) {
      const candidate = String(value).trim()
      if (!new RegExp(ctx.serialNumberPattern, 'i').test(candidate)) {
        const attempts = registerFieldRequest(ctx.sessionId, SERIAL_ATTEMPTS_KEY)
        if (attempts >= MAX_SERIAL_ATTEMPTS) {
          return {
            ok: false,
            error: 'invalid_serial_format_exhausted',
            instruction:
              'The customer has failed to provide a valid serial number 3 times. Do NOT ask again: ' +
              'acknowledge that, and move straight to the pre-operator checks (call escalate_to_operator).',
          }
        }
        return {
          ok: false,
          error: 'invalid_serial_format',
          instruction:
            `"${candidate}" is not a valid serial number` +
            (ctx.serialNumberFormatHint ? ` — it must be ${ctx.serialNumberFormatHint}.` : '.') +
            ' Tell the customer this and ask them to re-check it.',
        }
      }
    }

    if (key === 'name' || key === 'serialNumber') {
      updateState(ctx.sessionId, { [key]: String(value) })
    } else {
      mergeCollectedData(ctx.sessionId, { [key]: value as JsonValue })
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
    return { ok: true }
  }

  if (name === 'escalate_to_operator') {
    const reason = typeof args.reason === 'string' ? args.reason : 'diagnostic_exhausted'
    const rawSummary = typeof args.summary === 'string' ? args.summary : ''
    if (!rawSummary.trim()) {
      return { ok: false, error: 'summary is required and must be a non-empty string' }
    }

    const state = getState(ctx.sessionId)

    if (reason !== 'emergency') {
      // steps.md 2-B.3: the FAQ-not-found path never collected a technical
      // case, so the gate only asks for the name — not the full 7 fields.
      const skipTechnical = reason === 'faq_not_found'
      if (skipTechnical && !state.skippedTechnicalGate) {
        updateState(ctx.sessionId, { skippedTechnicalGate: true }, { mirror: false })
      }

      // A serial number stuck at the 3-attempt cap must not block the gate
      // forever on a field that will never be answered — it counts as
      // "asked enough", same fails-toward-silence rule as an unconfigured
      // question (nextPreOperatorStep skips it once askedCounts is maxed).
      const step = nextPreOperatorStep(state, ctx.gateQuestions, getAskedCounts(ctx.sessionId), {
        skipTechnical: skipTechnical || state.skippedTechnicalGate,
      })
      if (step) {
        registerFieldRequest(ctx.sessionId, step.field)
        return {
          ok: false,
          error: 'pre_operator_check_required',
          instruction: formatPreOperatorInstruction(step),
        }
      }
    }

    const isFirst = markEscalationOnce(ctx.sessionId, reason)
    if (!isFirst) {
      return { ok: true, already_escalated: true, eta_minutes: 15 }
    }

    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`
    recordEscalation({ ticketId, reason, summary: rawSummary })
    return { ok: true, ticket_id: ticketId, eta_minutes: 15, customer_name: state.name }
  }

  return { ok: false, error: `unknown tool: ${name}` }
}

interface CallLLMResult {
  text: string
  toolCalls: ToolCall[]
  tokensUsed: number
}

interface CallLLMParams {
  commonPrompt: string
  state: SessionState
  history: Message[]
  operatorBriefingLanguageOverride: string | null | undefined
  isFirstTurn: boolean
  faqBlock: string | undefined
  flowsBlock: string | undefined
  settings: Settings
  messages?: WorkspaceMessages | null
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
}

async function callLLM({
  commonPrompt,
  state,
  history,
  operatorBriefingLanguageOverride,
  isFirstTurn,
  faqBlock,
  flowsBlock,
  settings,
  messages,
  forceToolChoice,
}: CallLLMParams): Promise<CallLLMResult> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const runtimeBlock = formatRuntimeBlock(operatorBriefingLanguageOverride, isFirstTurn, settings, state, messages)

  const systemContent: Array<Record<string, unknown>> = [
    { type: 'text', text: commonPrompt, cache_control: { type: 'ephemeral' } },
  ]
  // Block order: least-specific -> most-specific -> hard rules. Later blocks
  // win over earlier ones.
  if (faqBlock) systemContent.push({ type: 'text', text: faqBlock })
  if (flowsBlock) systemContent.push({ type: 'text', text: flowsBlock })

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
  systemContent.push({ type: 'text', text: OPERATING_RULES })

  // Intake gate: while no flow is running and the case details are still
  // missing, the code dictates the exact question (see formatIntakeBlock in
  // gate.ts) — the model translates it, it does not compose its own. When a
  // greeting is due this turn, the dictated reply is greeting + question, so
  // this block cannot override the WELCOME block into silence.
  if (!state.currentNodeId) {
    const intakeBlock = formatIntakeBlock(nextIntakeStep(state, settings.gateQuestions), {
      withGreeting: state.greeting === 'new' || state.greeting === 'returning',
    })
    if (intakeBlock) systemContent.push({ type: 'text', text: intakeBlock })
  }

  const payloadMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content, tool_calls: m.tool_calls, tool_call_id: m.tool_call_id, name: m.name })),
  ]

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      'HTTP-Referer': 'https://echatbot.ai',
      'X-Title': 'DemoAM',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || settings.model,
      messages: payloadMessages,
      tools: buildToolsForTurn(state, currentStepLabels),
      tool_choice: forceToolChoice ? 'required' : 'auto',
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
    }),
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
  }

  return { text, toolCalls, tokensUsed }
}

function formatFaqBlock(faqs: FaqEntry[]): string | undefined {
  if (!faqs.length) return undefined
  const entries = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
  return [
    '',
    '═══ FAQ ═══',
    'Answers already approved by the company. When one of them answers the',
    "customer's question, use it instead of a troubleshooting flow. Never",
    'contradict a FAQ, and never invent an answer that is not here.',
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

  // steps.md Step 1.2/1.3: welcome vs welcome-back is decided in CODE
  // (resolveGreeting — new vs. returning customer, staleness threshold),
  // not left to the LLM to guess. The wording itself is workspace copy from
  // the DB-merged settings (or host-passed messages, {{customerName}}
  // already substituted), rendered by the LLM in the customer's language.
  if (state.greeting === 'new' && settings.welcomeMessage?.trim()) {
    lines.push(
      '',
      '## WELCOME (use INSTEAD of any greeting of your own — new customer)',
      settings.welcomeMessage.trim(),
      "Open with this greeting, translated into the customer's language, together with your reply to their message.",
    )
  }
  if (state.greeting === 'returning' && (messages?.welcomeBack ?? settings.welcomeBackMessage)?.trim()) {
    const text = (messages?.welcomeBack ?? settings.welcomeBackMessage)!.trim()
    lines.push(
      '',
      '## WELCOME BACK (use INSTEAD of any greeting of your own — returning customer)',
      text,
      "Open with this greeting, translated into the customer's language, together with your reply to their message.",
    )
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
      'This case came from an unanswered FAQ question, not a technical report:',
      'no serial number, problem description or device checks were collected.',
      'Say so plainly in the summary so the operator knows to start from scratch.',
    )
  }

  return lines.join('\n')
}

const HUMAN_SUPPORT_MARKER = '**👤 Human Support message**'

function formatOperatorBriefing(params: {
  state: SessionState
  reason: string
  summary?: string
  ticketId?: string
}): string {
  const { state, reason, summary, ticketId } = params

  const lines: string[] = [HUMAN_SUPPORT_MARKER, '']

  if (ticketId) lines.push(`🎫 **Ticket:** ${ticketId}`)
  lines.push(`📌 **Reason:** ${reason}`)
  if (state.skippedTechnicalGate) {
    lines.push('⚠️ **No technical details collected** — this came from an unanswered FAQ question.')
  }
  lines.push('')

  lines.push('**Customer**')
  lines.push(`• Name: ${state.name?.trim() || '—'}`)
  lines.push(`• Language: ${state.language || '—'}`)
  lines.push('')

  if (!state.skippedTechnicalGate) {
    lines.push('**Case**')
    lines.push(`• Serial number: ${state.serialNumber?.trim() || 'not provided'}`)
    lines.push(`• Troubleshooting flow: ${state.activeFlowId || 'none matched'}`)

    const collected = state.collectedData ?? {}
    const collectedKeys = Object.keys(collected)
    if (collectedKeys.length > 0) {
      lines.push('')
      lines.push('**Answers collected**')
      for (const key of collectedKeys) {
        lines.push(`• ${key}: ${String(collected[key])}`)
      }
    }
  }

  if (summary?.trim()) {
    lines.push('')
    lines.push('**Summary**')
    lines.push(summary.trim())
  }

  return lines.join('\n')
}

interface TurnResult {
  reply: string
  tokensUsed: number
  escalated: boolean
  escalationSummary?: string
}

function handoffFallback(messages: WorkspaceMessages | undefined, settings: Settings): string | null {
  return (messages?.humanSupport ?? settings.humanSupportMessage)?.trim() || null
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

  let state = getState(ctx.sessionId)

  // Once intake is COMPLETE (nextIntakeStep null: serial + description + when
  // all collected, or unconfigured) and no flow is attached, free text = an
  // invented question (seen live 2026-08-04: "does the display show an error
  // code?"). The only legitimate moves left are start_flow or
  // escalate_to_operator — enforced by the API via tool_choice, not by
  // another sentence in the prompt (iron rule 1). Recomputed per hop: a flow
  // may attach or detach during this very turn. FAQ conversations never
  // collect a serial, so intake stays open and they are never forced.
  // Free text is legitimate ONLY while there is something DICTATED to say:
  // the next intake question (intake still open), or the question a refusing
  // tool just instructed (gate check, invalid serial, unrecognized answer).
  // Everything else — in particular the gap right after the case completes —
  // stays forced onto start_flow/escalate_to_operator, so a diagnosis from
  // training data has no opening. A refusal lifts the force for the rest of
  // the turn (the model must be able to ASK the dictated question); a
  // successful save does not.
  let refusalDictatedTextThisTurn = false

  for (let hop = 0; hop < settings.maxToolHops; hop++) {
    state = getState(ctx.sessionId)
    const mustForceToolChoice =
      !isFirstTurn &&
      !refusalDictatedTextThisTurn &&
      !state.currentNodeId &&
      !state.activeFlowId &&
      nextIntakeStep(state, settings.gateQuestions) === null
    const { text, toolCalls, tokensUsed: hopTokens } = await callLLM({
      commonPrompt,
      state,
      history,
      operatorBriefingLanguageOverride,
      isFirstTurn,
      faqBlock,
      flowsBlock: state.activeFlowId ? undefined : flowsBlock,
      settings,
      messages,
      forceToolChoice: mustForceToolChoice,
    })

    if (toolCalls.length === 0) {
      if (mustForceToolChoice) {
        // tool_choice=required was sent but the API returned no tool_calls —
        // a provider contract violation, logged so it surfaces instead of
        // silently passing an invented free-text reply through.
        // eslint-disable-next-line no-console
        console.error('[demoam] tool_choice=required returned no tool_calls — provider contract violation')
      }
      const { reply, lang } = extractLanguage(text)
      if (lang) {
        commitLanguageFromReply(ctx.sessionId, resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage))
      }
      history.push({ role: 'assistant', content: reply })
      if (LLM_DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[state]', formatStateOneLine(getState(ctx.sessionId)))
      }
      return { reply, tokensUsed: hopTokens, escalated: false }
    }

    history.push({ role: 'assistant', content: text || null, tool_calls: toolCalls })

    let escalated = false
    let escalationSummary: string | undefined
    let escalationReason = 'diagnostic_exhausted'
    let escalationTicketId: string | undefined

    for (const call of toolCalls) {
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

      const result = await executeTool(ctx, call.function.name, args)

      // A refusal that carries an instruction dictates what the model must
      // SAY next (a gate question, a re-ask, a clarification) — free text on
      // the following hop is that dictated text, so the force lifts for the
      // rest of this turn.
      if (!result.ok && typeof result.instruction === 'string') {
        refusalDictatedTextThisTurn = true
      }

      if (call.function.name === 'answer_step' && !result.ok && result.error === 'unrecognized_answer' && answeringNodeId) {
        const attempts = registerFieldRequest(ctx.sessionId, `flow_node:${answeringNodeId}`)
        if (attempts >= 2) {
          detachFlow(ctx.sessionId)
        }
      }

      if (call.function.name === 'escalate_to_operator' && result.ok) {
        escalated = true
        escalationSummary = typeof args.summary === 'string' ? args.summary : escalationSummary
        escalationReason = typeof args.reason === 'string' ? args.reason : escalationReason
        if (typeof result.ticket_id === 'string') escalationTicketId = result.ticket_id
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
        flowsBlock: undefined,
        settings,
        messages,
      })
      const { reply, lang } = extractLanguage(finalHop.text)
      if (lang) {
        commitLanguageFromReply(ctx.sessionId, resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage))
      }
      history.push({ role: 'assistant', content: reply })

      const briefing = formatOperatorBriefing({
        state: getState(ctx.sessionId),
        reason: escalationReason,
        summary: escalationSummary,
        ticketId: escalationTicketId,
      })

      detachFlow(ctx.sessionId)
      const customerReply = reply.trim() || handoffFallback(messages, settings) || ''

      return {
        reply: `${customerReply}\n\n${briefing}`,
        tokensUsed: hopTokens + finalHop.tokensUsed,
        escalated: true,
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

  const briefing = formatOperatorBriefing({ state: finalState, reason: 'diagnostic_exhausted', summary })

  detachFlow(ctx.sessionId)

  return {
    reply: [handoffFallback(messages, settings), briefing].filter(Boolean).join('\n\n'),
    tokensUsed: 0,
    escalated: true,
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

  try {
    const commonPrompt = input.config.systemPromptOverride || (await getCachedCommonPrompt())
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
        faqBlock = formatFaqBlock(await getFaqs({ workspaceId: input.config.workspaceId }))
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[demoam] getFaqs handler threw, continuing without FAQ block', err)
      }
    }

    let flowsBlock: string | undefined
    const listFlows = input.config.handlers?.listFlows
    if (listFlows && !getState(sessionId).activeFlowId) {
      try {
        const flows = await listFlows({ workspaceId: input.config.workspaceId })
        ctx.availableFlows = flows
        flowsBlock = formatFlowsBlock(flows)
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

    return {
      reply: result.reply || null,
      language: getState(sessionId).language,
      persistedState: dehydrateState(sessionId),
      shouldEscalate: result.escalated,
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
