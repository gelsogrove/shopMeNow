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

// ── Grounding rule (always injected, never editable per tenant) ─────────────
// A workspace can replace prompts/common.md with its own system prompt via
// workspace.customChatbotSystemPrompt. That must never be able to remove the
// anti-hallucination rule, so the module appends this block on every call,
// after the tenant prompt.
const GROUNDING_RULE = [
  '## NEVER INVENT ANYTHING (absolute rule — overrides every instruction above)',
  '',
  'Everything you tell the customer must come from the ACTIVE FLOW block, the',
  'FAQ block, or the SESSION STATE. Nothing else counts as knowledge you may use.',
  '',
  '- NEVER invent a diagnosis, a cause, a fix, or a repair procedure.',
  '- NEVER invent product facts: model names, specifications, prices, warranty',
  '  terms, spare parts, delivery times, opening hours, phone numbers, addresses',
  '  or URLs. If it is not written in the blocks above, you do not know it.',
  '- NEVER confirm that a serial number is registered, that a model exists, or',
  '  that a robot is under warranty unless SESSION STATE says so.',
  '- NEVER guess which flow applies just to have something to say, and never',
  '  answer from general knowledge about robot mowers. Your training data is',
  '  NOT a source here.',
  '- If the information is missing, say plainly that you do not have it and call',
  '  escalate_to_operator. An honest "I don\'t know, I\'m passing you to a',
  '  colleague" is ALWAYS correct — a plausible-sounding guess is a serious error.',
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
  // Block order is the orchestration contract. Later blocks win over earlier
  // ones, so this goes least-specific -> most-specific -> hard rules:
  //   1. main prompt   (tenant identity/role — cached, changes rarely)
  //   2. FAQ           (approved answers, workspace-wide)
  //   3. ACTIVE FLOW   (the procedure for THIS problem — beats a generic FAQ)
  //   4. SESSION STATE (what we know about THIS customer + language rules)
  //   5. RUNTIME       (date, operator language, privacy URL, first-turn flag)
  //   6. GROUNDING     (never invent — must outrank everything above)
  if (faqBlock) systemContent.push({ type: 'text', text: faqBlock })
  if (activeFlowSnapshot) {
    systemContent.push({ type: 'text', text: `\n═══ ACTIVE FLOW ═══\n\n${activeFlowSnapshot}` })
  }
  if (stateBlock) systemContent.push({ type: 'text', text: stateBlock })
  systemContent.push({ type: 'text', text: runtimeBlock })
  // Andrea 2026-08-02: the anti-hallucination rule must hold for EVERY tenant,
  // including workspaces that replace prompts/common.md with their own
  // customChatbotSystemPrompt (AmRobots does). Injected by the module so it
  // cannot be lost by editing a prompt in the backoffice, and kept LAST so it
  // outranks every block above it.
  systemContent.push({ type: 'text', text: GROUNDING_RULE })

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
        args = {}
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
      const finalHop = await callLLM(commonPrompt, state.activeFlowPromptSnapshot, state, history, operatorBriefingLanguageOverride, isFirstTurn, faqBlock, settings)
      const { reply, lang } = extractLanguage(finalHop.text)
      commitLanguageFromReply(ctx.sessionId, lang)
      history.push({ role: 'assistant', content: reply })
      detachFlow(ctx.sessionId)
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

  return {
    reply: handoffMessage(finalState.language),
    tokensUsed: 0,
    escalated: true,
    escalationSummary: summary,
    retrievalDebug,
  }
}

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

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
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
    const commonPrompt = input.config.systemPromptOverride || (await getCachedCommonPrompt())

    const ctx: ToolContext & { retrieveFlow?: RetrievalHandler } = {
      sessionId: input.context.sessionId,
      workspaceId: input.config.workspaceId,
      customerName: input.userName,
      operatorBriefingLanguageOverride: input.config.operatorBriefingLanguageOverride,
      retrieveFlow: input.config.handlers?.retrieveFlow,
    }

    hydrateState(input.context.sessionId, input.context.persistedState)

    if (input.config.language) {
      seedLanguageIfNeeded(input.context.sessionId, input.config.language)
    }

    const maxHistory = settings.maxHistoryMessages ?? 30
    const fullHistory: Message[] = input.context.history.map((h) => ({ role: h.role, content: h.content }))
    const history: Message[] =
      fullHistory.length > maxHistory ? fullHistory.slice(-maxHistory) : fullHistory

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

export { resetState }
