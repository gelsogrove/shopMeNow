import { readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  attachFlow,
  commitLanguageFromReply,
  dehydrateState,
  detachFlow,
  drainPatches,
  extractLanguage,
  hydrateState,
  formatStateForPrompt,
  formatStateOneLine,
  getState,
  incrementTurn,
  JsonValue,
  markEscalationOnce,
  mergeCollectedData,
  registerMessageTimestamp,
  resetState,
  seedLanguageIfNeeded,
  SessionState,
  updateState,
} from './state.js'

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

export interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

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
    systemPromptOverride?: string | null
    settings?: Partial<Settings> | null
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

async function buildCommonPrompt(): Promise<string> {
  return readFile(path.join(__dirname, 'prompts', 'common.md'), 'utf8')
}

let cachedCommonPromptPromise: Promise<string> | null = null
function getCachedCommonPrompt(): Promise<string> {
  if (!cachedCommonPromptPromise) cachedCommonPromptPromise = buildCommonPrompt()
  return cachedCommonPromptPromise
}

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
}

interface ToolResult {
  ok: boolean
  [k: string]: unknown
}

function recordEscalation(params: { ticketId: string; reason: string; summary: string }): void {
  const { ticketId, reason, summary } = params
  // eslint-disable-next-line no-console
  console.error(`[demorobot][escalation] ${ticketId} reason=${reason}\n${summary}`)
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

    const isFirst = markEscalationOnce(ctx.sessionId, reason)
    if (!isFirst) {
      return { ok: true, already_escalated: true, eta_minutes: 15 }
    }

    const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`
    recordEscalation({ ticketId, reason, summary: rawSummary })
    return { ok: true, ticket_id: ticketId, eta_minutes: 15 }
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
  faqBlock: string | undefined,
  settings: Settings,
): Promise<CallLLMResult> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY missing in environment')

  const stateBlock = formatStateForPrompt(state)
  const runtimeBlock = formatRuntimeBlock(operatorBriefingLanguageOverride, isFirstTurn, settings)

  const systemContent: Array<Record<string, unknown>> = [
    { type: 'text', text: commonPrompt, cache_control: { type: 'ephemeral' } },
  ]
  // FAQs are a small fixed set per workspace, always injected — never
  // retrieved semantically. Placed before the flow so an active diagnostic
  // flow stays the more specific, later-winning instruction.
  if (faqBlock) systemContent.push({ type: 'text', text: faqBlock })
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
      model: process.env.LLM_MODEL || settings.model,
      messages: payloadMessages,
      tools: TOOLS,
      tool_choice: 'auto',
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

// Renders the workspace FAQs as a prompt block. Returns undefined when there
// are none, so no empty section is pushed into the system prompt.
function formatFaqBlock(faqs: FaqEntry[]): string | undefined {
  if (!faqs.length) return undefined
  const entries = faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
  return [
    '',
    '═══ FAQ ═══',
    'Answers already approved by the company. When one of them answers the',
    "customer's question, use it instead of a diagnostic flow. Never contradict",
    'a FAQ, and never invent an answer that is not here or in the ACTIVE FLOW.',
    '',
    entries,
  ].join('\n')
}

function formatRuntimeBlock(
  operatorBriefingLanguageOverride: string | null | undefined,
  isFirstTurn: boolean,
  settings: Settings,
): string {
  const now = new Date()
  const lines = [
    '## RUNTIME',
    `- Current date/time: ${now.toISOString()}`,
    `- Operator briefing language: ${operatorBriefingLanguageOverride || settings.operatorBriefingLanguage}`,
    `- Privacy policy URL: ${settings.privacyPolicyUrl}`,
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
  faqBlock: string | undefined,
  settings: Settings,
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

  for (let hop = 0; hop < settings.maxToolHops; hop++) {
    state = getState(ctx.sessionId)
    const { text, toolCalls, tokensUsed: hopTokens } = await callLLM(
      commonPrompt,
      state.activeFlowPromptSnapshot,
      state,
      history,
      operatorBriefingLanguageOverride,
      isFirstTurn,
      faqBlock,
      settings,
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
      const finalHop = await callLLM(commonPrompt, state.activeFlowPromptSnapshot, state, history, operatorBriefingLanguageOverride, isFirstTurn, faqBlock, settings)
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

  // Andrea 2026-08-02: this used to return an empty reply, which chatbotFn
  // turned into `reply: null` — the widget then showed the customer a generic
  // "Sorry, I couldn't process your message" and the conversation dead-ended
  // with shouldEscalate=false, so no human ever saw it. Seen in production on
  // "non mi funziona non taglia bene" (retrieval matched no flow, the LLM kept
  // calling tools until the hops ran out).
  //
  // Running out of hops means the bot could not help. That is exactly what
  // escalation is for: hand over to a human instead of stonewalling.
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
  detachFlow(ctx.sessionId)

  // Deterministic text, in the customer's language when known — we cannot ask
  // the LLM for it, since failing to get a reply from the LLM is the very
  // reason we are here.
  return {
    reply: handoffMessage(finalState.language),
    tokensUsed: 0,
    escalated: true,
    escalationSummary: summary,
    retrievalDebug,
  }
}

// Localized hand-off notice for the hop-exhaustion path. Deliberately small:
// English is the documented business default (state.ts DEFAULT_LANGUAGE), and
// any language not listed falls back to it rather than to silence.
const HANDOFF_MESSAGES: Record<string, string> = {
  en: "I'm sorry, I can't solve this on my own. I'm passing you to a colleague who will get back to you shortly.",
  it: 'Mi dispiace, non riesco a risolvere da solo. Ti passo a un collega che ti risponderà a breve.',
  es: 'Lo siento, no puedo resolverlo por mi cuenta. Te paso con un compañero que te responderá en breve.',
  da: 'Beklager, det kan jeg ikke løse selv. Jeg sender dig videre til en kollega, som vender tilbage snarest.',
  fr: 'Désolé, je ne peux pas résoudre cela seul. Je vous transfère à un collègue qui vous répondra sous peu.',
  de: 'Es tut mir leid, das kann ich nicht allein lösen. Ich übergebe an eine Kollegin, die sich in Kürze meldet.',
  pt: 'Lamento, não consigo resolver sozinho. Vou passar a um colega que lhe responderá em breve.',
  ca: 'Ho sento, no ho puc resoldre sol. Et passo amb un company que et respondrà ben aviat.',
}

function handoffMessage(language?: string): string {
  return HANDOFF_MESSAGES[language ?? 'en'] ?? HANDOFF_MESSAGES.en
}

export async function agentTurn(
  ctx: ToolContext & { retrieveFlow?: RetrievalHandler },
  commonPrompt: string,
  history: Message[],
  rawMessage: string,
  operatorBriefingLanguageOverride: string | null | undefined,
  faqBlock?: string,
  settingsOverride?: Partial<Settings> | null,
): Promise<TurnResult> {
  const settings = effectiveSettings(settingsOverride)
  const sanitized = sanitizeUserMessage(rawMessage, settings.maxMessageChars)
  if (!sanitized) return { reply: '', tokensUsed: 0, escalated: false }

  const now = Date.now()
  const recentCount = registerMessageTimestamp(ctx.sessionId, now, 60_000)
  if (recentCount > settings.maxMessagesPerMinute) {
    return { reply: 'You are sending messages too quickly. Please wait a moment.', tokensUsed: 0, escalated: false }
  }

  const turnNum = incrementTurn(ctx.sessionId)
  if (turnNum > settings.maxTurnsPerSession) {
    return { reply: 'This conversation has become too long. Please contact us via email to continue.', tokensUsed: 0, escalated: false }
  }

  return withSessionLock(ctx.sessionId, () =>
    agentTurnInternal(ctx, commonPrompt, history, sanitized, operatorBriefingLanguageOverride, faqBlock, settings),
  )
}

// ── chatbotFn — host integration entry point ────────────────────────────────

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  // Effective config for this workspace: database values (sent by the host)
  // layered over the module's settings.json defaults.
  const settings = effectiveSettings(input.config.settings)

  if (!API_KEY) {
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: 0, agentChain: ['custom-demorobot'] },
      error: 'llm_unavailable',
    }
  }

  try {
    // Editable prompt (workspace.customChatbotSystemPrompt) takes priority
    // over the module's static prompts/common.md when the host provides one.
    // Not cached with the static prompt — the editable one can change
    // between turns, unlike the file read once at boot.
    const commonPrompt = input.config.systemPromptOverride || (await getCachedCommonPrompt())

    const ctx: ToolContext & { retrieveFlow?: RetrievalHandler } = {
      sessionId: input.context.sessionId,
      workspaceId: input.config.workspaceId,
      customerName: input.userName,
      operatorBriefingLanguageOverride: input.config.operatorBriefingLanguageOverride,
      retrieveFlow: input.config.handlers?.retrieveFlow,
    }

    // Restore durable state (serial, language, attached flow) before any tool
    // or prompt reads it — otherwise a dyno restart mid-conversation would
    // silently drop what the customer already told us.
    hydrateState(input.context.sessionId, input.context.persistedState)

    // Andrea 2026-08-02: seed the conversation language from what the host
    // already knows (the widget registration form, or the customer record).
    // Without this the module started every conversation with no language at
    // all, so the LLM fell back to the workspace defaultLanguage — AmRobots
    // (defaultLanguage "it") answered "hola" in Italian. seedLanguageIfNeeded
    // never overwrites a language already committed from a previous turn.
    if (input.config.language) {
      seedLanguageIfNeeded(input.context.sessionId, input.config.language)
    }

    // Andrea 2026-08-01: cap the history handed to the LLM. It used to grow
    // unbounded, so cost and latency climbed with every turn and a long
    // conversation would eventually blow past the context window. The last
    // MAX_HISTORY_MESSAGES entries are enough: durable facts (serial, name,
    // language, collected flow answers) live in SessionState, which is sent
    // separately as its own prompt block and is never truncated.
    const maxHistory = settings.maxHistoryMessages ?? 30
    const fullHistory: Message[] = input.context.history.map((h) => ({ role: h.role, content: h.content }))
    const history: Message[] =
      fullHistory.length > maxHistory ? fullHistory.slice(-maxHistory) : fullHistory

    // Fetched fresh each turn (never cached with commonPrompt) so an admin
    // edit is visible on the very next message. A failure here must not cost
    // the customer their reply — degrade to "no FAQ block".
    let faqBlock: string | undefined
    const getFaqs = input.config.handlers?.getFaqs
    if (getFaqs) {
      try {
        faqBlock = formatFaqBlock(await getFaqs({ workspaceId: input.config.workspaceId }))
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[demorobot] getFaqs handler threw, continuing without FAQ block', err)
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
    )

    const patches = drainPatches(input.context.sessionId)
    const sessionId = input.context.sessionId

    return {
      reply: result.reply || null,
      language: getState(sessionId).language,
      // Snapshot taken AFTER the turn, so the next request restores the serial,
      // language and attached flow even if it lands on a different dyno.
      persistedState: dehydrateState(sessionId),
      shouldEscalate: result.escalated,
      escalationSummary: result.escalated ? result.escalationSummary || `Session ${sessionId} escalated (no briefing captured)` : undefined,
      notificationEmails: result.escalated
        ? process.env.OPERATOR_EMAIL || settings.operatorEmail || undefined
        : undefined,
      closeChat: result.escalated,
      patches: patches.length > 0 ? patches : undefined,
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
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
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: 0, agentChain: ['custom-demorobot'] },
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// Exposed for tests/tools that need to clear in-RAM state between runs.
export { resetState }
