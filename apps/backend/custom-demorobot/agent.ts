// demoRobot chatbot — prompt-driven LLM turn loop, sibling module to
// custom-demowash. Same runtime contract (ChatbotInput/ChatbotOutput,
// tool-hop loop, session locking, PII-free by design since demoRobot
// collects operational robot data, not customer PII in the same way).
//
// What's DIFFERENT from demowash: no static system prompt file — the
// dynamic ingredient is the attached Flow's compiledPrompt (design.md
// "Cambio di paradigma rispetto a demowash"), selected per-turn by the
// retrieval layer instead of always being the same cached blob.

import nodemailer from 'nodemailer'
import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  attachFlow,
  commitLanguageFromReply,
  detachFlow,
  drainPatches,
  extractLanguage,
  formatStateForPrompt,
  formatStateOneLine,
  getState,
  incrementTurn,
  JsonValue,
  markEscalationOnce,
  mergeCollectedData,
  registerMessageTimestamp,
  resetState,
  SessionState,
  updateState,
} from './state.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Settings ─────────────────────────────────────────────────────────────

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
  privacyPolicyUrl: string
  similarityThreshold: number
  topK: number
  audioOutput: boolean
  audioVoices: Record<string, string>
}

let SETTINGS: Settings
try {
  const raw = await readFile(path.join(__dirname, 'settings.json'), 'utf8')
  SETTINGS = JSON.parse(raw)
} catch {
  throw new Error('custom-demorobot: settings.json is missing or invalid — no hardcoded fallback (CLAUDE.md §1)')
}

const API_KEY = process.env.OPENROUTER_API_KEY
const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
const MODEL = process.env.LLM_MODEL || SETTINGS.model
const MAX_TOOL_HOPS = SETTINGS.maxToolHops
const MAX_MESSAGE_CHARS = SETTINGS.maxMessageChars
const MAX_MESSAGES_PER_MINUTE = SETTINGS.maxMessagesPerMinute
const MAX_TURNS_PER_SESSION = SETTINGS.maxTurnsPerSession
const AUDIO_OUTPUT = SETTINGS.audioOutput
const AUDIO_VOICES = SETTINGS.audioVoices
const OPERATOR_EMAIL = process.env.OPERATOR_EMAIL || SETTINGS.operatorEmail
const EMAIL_FROM = SETTINGS.emailFrom
const EMAIL_SUBJECT_PREFIX = SETTINGS.emailSubjectPrefix
const GMAIL_USER = process.env.GMAIL_USER
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD

const LLM_DEBUG = process.env.LLM_DEBUG === '1'

// ── Public contract (mirrors custom-demowash/agent.ts) ──────────────────────

export interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

// Injected by the host — see design.md "Retrieval as a shared component":
// the compiler/retrieval logic lives in apps/backend/src/application/demorobot
// (Jest-testable), this module only calls it through these handlers so the
// standalone package has no direct Prisma/DB dependency.
export interface RetrievalHandlerResult {
  selectedFlowId?: string
  compiledPrompt?: string
  hash?: string
  robotModelId?: string
  reason?: 'unknown_model' | 'no_matching_flow'
}
export type RetrievalHandler = (params: {
  workspaceId: string
  conversationId: string
  serialNumber?: string
  query: string
}) => Promise<RetrievalHandlerResult>

// FAQs are a small, fixed set per workspace (unlike Flows, which scale to
// hundreds and need retrieval) — always injected as a prompt block, never
// searched semantically. Fetched fresh each turn (not cached with
// commonPrompt) so an admin edit is visible on the very next turn.
export interface FaqEntry {
  question: string
  answer: string
}
export type GetFaqsHandler = (params: { workspaceId: string }) => Promise<FaqEntry[]>

export interface ChatbotInput {
  userMessage: string
  userName: string
  channel: 'whatsapp' | 'widget' | 'playground'
  config: {
    workspaceId: string
    debugChannel: boolean
    isPlayground: boolean
    language?: string
    operatorBriefingLanguageOverride?: string | null
    handlers?: {
      retrieveFlow?: RetrievalHandler
      getFaqs?: GetFaqsHandler
    }
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: HistoryEntry[]
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
  audioOutput: boolean
  audioVoices: Record<string, string>
  meta: {
    tokensUsed: number
    agentChain: string[]
    debug?: {
      retrievalEvent?: {
        query: string
        robotModelId?: string
        selectedFlowId?: string
        reason?: string
      }
    }
  }
  error?: string
}

// ── Common (always-present) prompt block — analisi.md §9 ───────────────────

async function buildCommonPrompt(): Promise<string> {
  return readFile(path.join(__dirname, 'prompts', 'common.md'), 'utf8')
}

let cachedCommonPromptPromise: Promise<string> | null = null
function getCachedCommonPrompt(): Promise<string> {
  if (!cachedCommonPromptPromise) cachedCommonPromptPromise = buildCommonPrompt()
  return cachedCommonPromptPromise
}

// ── Tool schema — remember + escalate_to_operator only (analisi.md §5) ─────

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'remember',
      description:
        'Save a fact the customer has provided that matches one of the active flow\'s fieldKeys, or the customer name / serial number. Call this as soon as the customer provides the information, merging with what is already known — never wait until the end of the flow.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The fieldKey from the active flow, or "name"/"serialNumber".' },
          value: { type: 'string', description: 'The value to remember, as a string (numbers/booleans as their string form).' },
        },
        required: ['key', 'value'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'escalate_to_operator',
      description:
        'Escalate this conversation to a human operator. Call this EXACTLY ONCE per incident — never emit two escalate_to_operator calls in the same turn. Use when the active flow reaches an ESCALATE terminal, when an answer is flagged as immediately escalating, when the model/serial cannot be resolved, when no matching flow is found, or in a genuine emergency.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            enum: ['diagnostic_exhausted', 'unknown_model', 'no_matching_flow', 'emergency'],
          },
          summary: { type: 'string', description: 'Operator briefing: facts gathered along the path, in the configured operator briefing language.' },
        },
        required: ['reason', 'summary'],
        additionalProperties: false,
      },
    },
  },
] as const

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

// ── Concurrency: per-sessionId async lock (identical pattern to demowash) ──

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

// ── Input sanitization (identical pattern to demowash) ─────────────────────

const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const ZERO_WIDTH_RE = /[​-‍﻿]/g
const BIDI_RE = /[‪-‮⁦-⁩]/g

function sanitizeUserMessage(raw: string): string {
  let s = (raw ?? '').toString()
  s = s.replace(CONTROL_CHARS_RE, '')
  s = s.replace(ZERO_WIDTH_RE, '')
  s = s.replace(BIDI_RE, '')
  s = s.trim()
  if (s.length > MAX_MESSAGE_CHARS) s = s.slice(0, MAX_MESSAGE_CHARS)
  return s
}

// ── Tool execution ───────────────────────────────────────────────────────

interface ToolContext {
  sessionId: string
  workspaceId: string
  customerName?: string
  operatorBriefingLanguageOverride?: string | null
}

interface ToolResult {
  ok: boolean
  [k: string]: unknown
}

async function sendEscalationEmail(params: {
  ticketId: string
  reason: string
  summary: string
  state: SessionState
}): Promise<void> {
  const { ticketId, reason, summary } = params
  // eslint-disable-next-line no-console
  console.error(`[demorobot][escalation] ${ticketId} reason=${reason}\n${summary}`)

  if (!OPERATOR_EMAIL) throw new Error('OPERATOR_EMAIL not configured')
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) throw new Error('Gmail SMTP credentials not configured')

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  })

  await transport.sendMail({
    from: EMAIL_FROM,
    to: OPERATOR_EMAIL,
    subject: `${EMAIL_SUBJECT_PREFIX} ${ticketId} — ${reason}`,
    text: `Ticket: ${ticketId}\nReason: ${reason}\n\n${summary}\n\n— DemoRobot Bot`,
  })
}

async function executeTool(ctx: ToolContext, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  if (name === 'remember') {
    const key = typeof args.key === 'string' ? args.key : null
    const value = args.value
    if (!key) return { ok: false, error: 'key is required' }

    if (key === 'name' || key === 'serialNumber') {
      updateState(ctx.sessionId, { [key]: String(value) })
      return { ok: true }
    }
    mergeCollectedData(ctx.sessionId, { [key]: value as JsonValue })
    return { ok: true }
  }

  if (name === 'escalate_to_operator') {
    const reason = typeof args.reason === 'string' ? args.reason : 'diagnostic_exhausted'
    const rawSummary = typeof args.summary === 'string' ? args.summary : ''
    if (!rawSummary.trim()) {
      return { ok: false, error: 'summary is required and must be a non-empty string' }
    }

    const state = getState(ctx.sessionId)

    const isFirst = markEscalationOnce(ctx.sessionId, reason)
    if (!isFirst) {
      return { ok: true, already_escalated: true, eta_minutes: 15 }
    }

    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`
    try {
      await sendEscalationEmail({ ticketId, reason, summary: rawSummary, state })
      return { ok: true, ticket_id: ticketId, eta_minutes: 15, email_sent: !!GMAIL_USER }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: true, ticket_id: ticketId, eta_minutes: 15, email_sent: false, email_error: msg }
    }
  }

  return { ok: false, error: `unknown tool: ${name}` }
}

// ── LLM call — identical mechanism to demowash (OpenRouter, cache_control) ─

interface CallLLMResult {
  text: string
  toolCalls: ToolCall[]
  tokensUsed: number
}

async function callLLM(
  commonPrompt: string,
  activeFlowSnapshot: string | undefined,
  state: SessionState,
  history: Message[],
  operatorBriefingLanguageOverride: string | null | undefined,
  isFirstTurn: boolean,
): Promise<CallLLMResult> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const runtimeBlock = formatRuntimeBlock(operatorBriefingLanguageOverride, isFirstTurn)

  const systemContent: Array<Record<string, unknown>> = [
    { type: 'text', text: commonPrompt, cache_control: { type: 'ephemeral' } },
  ]
  if (activeFlowSnapshot) {
    // The dynamic ingredient — NOT cached (design.md "Cambio di paradigma
    // rispetto a demowash"): it changes per attached flow, so caching it
    // would never hit.
    systemContent.push({ type: 'text', text: `\n═══ ACTIVE FLOW ═══\n\n${activeFlowSnapshot}` })
  }
  if (stateBlock) systemContent.push({ type: 'text', text: stateBlock })
  systemContent.push({ type: 'text', text: runtimeBlock })

  // System message content is the typed content-block array itself (not a
  // plain string) so the cache_control directive can be attached to just
  // the first (fixed) block, per demowash's cache pattern.
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
      'X-Title': 'DemoRobot',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: payloadMessages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: SETTINGS.temperature,
      max_tokens: SETTINGS.maxTokens,
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

function formatRuntimeBlock(operatorBriefingLanguageOverride: string | null | undefined, isFirstTurn: boolean): string {
  const now = new Date()
  const lines = [
    '## RUNTIME',
    `- Current date/time: ${now.toISOString()}`,
    `- Operator briefing language: ${operatorBriefingLanguageOverride || SETTINGS.operatorBriefingLanguage}`,
    `- Privacy policy URL: ${SETTINGS.privacyPolicyUrl}`,
    `- First turn: ${isFirstTurn}`,
  ]
  return lines.join('\n')
}

// ── Turn execution ───────────────────────────────────────────────────────

interface TurnResult {
  reply: string
  tokensUsed: number
  escalated: boolean
  escalationSummary?: string
  retrievalDebug?: ChatbotOutput['meta']['debug']
}

async function agentTurnInternal(
  ctx: ToolContext & { retrieveFlow?: RetrievalHandler },
  commonPrompt: string,
  history: Message[],
  sanitizedMessage: string,
  operatorBriefingLanguageOverride: string | null | undefined,
): Promise<TurnResult> {
  const isFirstTurn = history.length === 0
  history.push({ role: 'user', content: sanitizedMessage })

  let state = getState(ctx.sessionId)
  let retrievalDebug: ChatbotOutput['meta']['debug']

  // Retrieval trigger gating (specs/flow-retrieval "Retrieval runs only to
  // attach or re-attach, not every turn"): only when no flow is attached.
  // Mid-flow re-retrieval on semantic mismatch is left to the LLM calling
  // remember with a fresh problem description — v1 gate is attach-if-empty.
  if (!state.activeFlowId && ctx.retrieveFlow) {
    try {
      const result = await ctx.retrieveFlow({
        workspaceId: ctx.workspaceId,
        conversationId: ctx.sessionId,
        serialNumber: state.serialNumber,
        query: sanitizedMessage,
      })
      retrievalDebug = {
        retrievalEvent: {
          query: sanitizedMessage,
          robotModelId: result.robotModelId,
          selectedFlowId: result.selectedFlowId,
          reason: result.reason,
        },
      }
      if (result.selectedFlowId && result.compiledPrompt && result.hash) {
        attachFlow(ctx.sessionId, result.selectedFlowId, result.hash, result.compiledPrompt)
        if (result.robotModelId) updateState(ctx.sessionId, { activeModelId: result.robotModelId }, { mirror: false })
        state = getState(ctx.sessionId)
      }
    } catch (err) {
      // Graceful degradation (design.md Decision 14): retrieval failure
      // never blocks the turn — proceed without an attached flow.
      // eslint-disable-next-line no-console
      console.error('[demorobot] retrieveFlow handler threw, continuing without attachment', err)
    }
  }

  for (let hop = 0; hop < MAX_TOOL_HOPS; hop++) {
    state = getState(ctx.sessionId)
    const { text, toolCalls, tokensUsed: hopTokens } = await callLLM(
      commonPrompt,
      state.activeFlowPromptSnapshot,
      state,
      history,
      operatorBriefingLanguageOverride,
      isFirstTurn,
    )

    if (toolCalls.length === 0) {
      const { reply, lang } = extractLanguage(text)
      commitLanguageFromReply(ctx.sessionId, lang)
      history.push({ role: 'assistant', content: reply })
      if (LLM_DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[state]', formatStateOneLine(getState(ctx.sessionId)))
      }
      return { reply, tokensUsed: hopTokens, escalated: false, retrievalDebug }
    }

    history.push({ role: 'assistant', content: text || null, tool_calls: toolCalls })

    let escalated = false
    let escalationSummary: string | undefined

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        // malformed args -> proceed with {}, tool handler returns its own validation error
      }
      if (LLM_DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[tool_call]', call.function.name, JSON.stringify(args))
      }

      const result = await executeTool(ctx, call.function.name, args)

      if (call.function.name === 'escalate_to_operator' && result.ok) {
        escalated = true
        escalationSummary = typeof args.summary === 'string' ? args.summary : escalationSummary
      }

      history.push({
        role: 'tool',
        content: JSON.stringify(result),
        tool_call_id: call.id,
        name: call.function.name,
      })
    }

    if (escalated) {
      // Continue the loop so the LLM can produce its final customer-facing
      // reply after seeing the tool result, same as demowash.
      const finalHop = await callLLM(commonPrompt, state.activeFlowPromptSnapshot, state, history, operatorBriefingLanguageOverride, isFirstTurn)
      const { reply, lang } = extractLanguage(finalHop.text)
      commitLanguageFromReply(ctx.sessionId, lang)
      history.push({ role: 'assistant', content: reply })
      detachFlow(ctx.sessionId) // escalation closes the flow (specs: reaching a terminal closes it)
      return {
        reply,
        tokensUsed: hopTokens + finalHop.tokensUsed,
        escalated: true,
        escalationSummary,
        retrievalDebug,
      }
    }
  }

  // eslint-disable-next-line no-console
  console.error('[warn] max tool hops exhausted without a final reply')
  return { reply: '', tokensUsed: 0, escalated: false, retrievalDebug }
}

export async function agentTurn(
  ctx: ToolContext & { retrieveFlow?: RetrievalHandler },
  commonPrompt: string,
  history: Message[],
  rawMessage: string,
  operatorBriefingLanguageOverride: string | null | undefined,
): Promise<TurnResult> {
  const sanitized = sanitizeUserMessage(rawMessage)
  if (!sanitized) return { reply: '', tokensUsed: 0, escalated: false }

  const now = Date.now()
  const recentCount = registerMessageTimestamp(ctx.sessionId, now, 60_000)
  if (recentCount > MAX_MESSAGES_PER_MINUTE) {
    return { reply: 'You are sending messages too quickly. Please wait a moment.', tokensUsed: 0, escalated: false }
  }

  const turnNum = incrementTurn(ctx.sessionId)
  if (turnNum > MAX_TURNS_PER_SESSION) {
    return { reply: 'This conversation has become too long. Please contact us via email to continue.', tokensUsed: 0, escalated: false }
  }

  return withSessionLock(ctx.sessionId, () => agentTurnInternal(ctx, commonPrompt, history, sanitized, operatorBriefingLanguageOverride))
}

// ── chatbotFn — host integration entry point ────────────────────────────────

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  if (!API_KEY) {
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: AUDIO_OUTPUT,
      audioVoices: AUDIO_VOICES,
      meta: { tokensUsed: 0, agentChain: ['custom-demorobot'] },
      error: 'llm_unavailable',
    }
  }

  try {
    const commonPrompt = await getCachedCommonPrompt()

    const ctx: ToolContext & { retrieveFlow?: RetrievalHandler } = {
      sessionId: input.context.sessionId,
      workspaceId: input.config.workspaceId,
      customerName: input.userName,
      operatorBriefingLanguageOverride: input.config.operatorBriefingLanguageOverride,
      retrieveFlow: input.config.handlers?.retrieveFlow,
    }

    const history: Message[] = input.context.history.map((h) => ({ role: h.role, content: h.content }))

    const result = await agentTurn(ctx, commonPrompt, history, input.userMessage, input.config.operatorBriefingLanguageOverride)

    const patches = drainPatches(input.context.sessionId)
    const sessionId = input.context.sessionId

    return {
      reply: result.reply || null,
      language: getState(sessionId).language,
      shouldEscalate: result.escalated,
      escalationSummary: result.escalated ? result.escalationSummary || `Session ${sessionId} escalated (no briefing captured)` : undefined,
      notificationEmails: result.escalated ? OPERATOR_EMAIL || undefined : undefined,
      closeChat: result.escalated,
      patches: patches.length > 0 ? patches : undefined,
      audioOutput: AUDIO_OUTPUT,
      audioVoices: AUDIO_VOICES,
      meta: {
        tokensUsed: result.tokensUsed,
        agentChain: ['custom-demorobot'],
        debug: input.config.debugChannel ? result.retrievalDebug : undefined,
      },
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chatbotFn] error:', err)
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: AUDIO_OUTPUT,
      audioVoices: AUDIO_VOICES,
      meta: { tokensUsed: 0, agentChain: ['custom-demorobot'] },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// Exposed for tests/tools that need to clear in-RAM state between runs.
export { resetState }
