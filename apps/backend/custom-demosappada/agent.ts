/**
 * Loco.AI — Sappada tourism assistant.
 *
 * What makes this module different from the support bots it is descended from
 * (custom-demoam, custom-demorobot): there is no case, no intake, no operator.
 * A tourist asks a question and gets an answer, now.
 *
 * The product promise is RECOMBINATION. "It's raining and I have two kids and
 * three hours" must produce ONE answer that crosses the forecast, the museum's
 * opening days and a restaurant nearby — the thing a website cannot do. So the
 * FAQ block is context the model reasons over, not a script it recites.
 *
 * Which puts all the weight on one guarantee: everything factual must come
 * from approved content. Two mechanisms hold it, neither of them a sentence in
 * the prompt (CLAUDE.md §16 iron rule 1):
 *
 *   1. get_weather — the only way to know the weather. The model cannot recall
 *      a forecast; without the tool it would invent one that sounds right.
 *   2. stripUnverifiableContacts — every URL and phone number in the reply is
 *      checked against the FAQ block, and removed if it is not there.
 */

import {
  commitLanguageFromReply,
  CustomerPatch,
  dehydrateState,
  drainPatches,
  extractLanguage,
  formatStateForPrompt,
  formatStateOneLine,
  getState,
  hydrateState,
  incrementTurn,
  registerMessageTimestamp,
  resetState,
  resolveEnabledLanguage,
  resolveGreeting,
  seedLanguageIfNeeded,
  updateState,
} from './state.js'
import { stripUnverifiableContacts } from './content-guards.js'
import { getSappadaWeather, WEATHER_TOOL, type WeatherReport } from './weather.js'
import { MAX_TOOL_HOPS, WEATHER_CACHE_MS, WELCOME_BACK_STALE_MS } from './bounds.js'

// ── Settings ──────────────────────────────────────────────────────────────
// Every value comes from the DB via chatbot-settings-json.service.ts, which
// re-renders settings.json on each workspace save. The defaults here exist so
// a missing key never crashes a turn — never so a tenant string lives in code
// (CLAUDE.md §1A).

interface Settings {
  /** workspace.customChatbotSystemPrompt with {{faqs}} already substituted. */
  mainPrompt?: string
  model: string
  temperature: number
  maxTokens: number
  maxToolHops?: number
  maxMessageChars: number
  maxMessagesPerMinute: number
  maxTurnsPerSession: number
  maxHistoryMessages?: number
  privacyPolicyUrl?: string
  defaultLanguage: string
  enabledLanguages: string[]
  welcomeMessage?: string
  welcomeBackMessage?: string
  rateLimitedMessage?: string
  sessionTooLongMessage?: string
  /** Presentation video shown once, on the first turn of a new conversation. */
  welcomeVideoUrl?: string
  /** Tenant switch for the live-forecast tool. Off ⇒ the bot never claims weather. */
  weatherEnabled?: boolean
  audioOutput: boolean
  audioVoices: Record<string, string>
}

const DEFAULT_SETTINGS: Settings = {
  model: 'anthropic/claude-haiku-4.5',
  temperature: 0.3,
  maxTokens: 2500,
  maxToolHops: MAX_TOOL_HOPS,
  maxMessageChars: 2000,
  maxMessagesPerMinute: 30,
  maxTurnsPerSession: 50,
  maxHistoryMessages: 30,
  defaultLanguage: 'it',
  enabledLanguages: ['it', 'en', 'de'],
  weatherEnabled: true,
  audioOutput: false,
  audioVoices: {},
}

const API_KEY = process.env.OPENROUTER_API_KEY
const BASE_URL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
const LLM_DEBUG = process.env.LLM_DEBUG === '1'

function stripEmpty(o: Partial<Settings>): Partial<Settings> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out as Partial<Settings>
}

function effectiveSettings(override?: Partial<Settings> | null): Settings {
  return { ...DEFAULT_SETTINGS, ...(override ? stripEmpty(override) : {}) }
}

// ── Public contract ───────────────────────────────────────────────────────
// Field names match exactly what the host builds for every custom chatbot
// (custom-client-chatbot.service.ts). Structural typing across the dynamic
// import means a rename here silently detaches the module from the host.

export interface HistoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

export interface WorkspaceMessages {
  welcomeBack?: string | null
  rateLimited?: string | null
  sessionTooLong?: string | null
}

export interface FaqEntry {
  question: string
  answer: string
  keywords?: string[]
}

export type GetFaqsHandler = (params: { workspaceId: string }) => Promise<FaqEntry[]>

/**
 * An accommodation the Pro Loco keeps on file: who they are and how to reach
 * them.
 *
 * Deliberately WITHOUT a live availability count. Andrea, 2026-08-22: how
 * availability gets maintained — who updates it, how often, and what the bot
 * should say when nobody has — is an open question, and a number nobody keeps
 * fresh is worse than no number at all. Until that process exists the bot
 * hands over the contact and lets the structure answer. Re-introducing a
 * count later is a field here and a line in formatCatalogue.
 */
export interface CatalogueEntry {
  name: string
  description?: string
  price?: number
  link?: string
  type?: string
}

export type GetCatalogueHandler = (params: { workspaceId: string }) => Promise<CatalogueEntry[]>

export interface ChatbotInput {
  userMessage: string
  userName: string
  channel: 'whatsapp' | 'widget' | 'playground'
  config: {
    workspaceId: string
    debugChannel: boolean
    isPlayground: boolean
    language?: string
    settings?: Partial<Settings> | null
    messages?: WorkspaceMessages | null
    handlers?: {
      getFaqs?: GetFaqsHandler
      getCatalogue?: GetCatalogueHandler
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
  answeredFromFaq?: boolean
  closeChat: boolean
  patches?: CustomerPatch[]
  persistedState?: unknown
  audioOutput: boolean
  audioVoices: Record<string, string>
  meta: {
    tokensUsed: number
    agentChain: string[]
  }
  error?: string
}

// ── Tools ─────────────────────────────────────────────────────────────────

const REMEMBER_TOOL = {
  type: 'function',
  function: {
    name: 'remember',
    description:
      'Save a fact the customer told you about themselves, so it survives the conversation. Call it the ' +
      'moment they mention their name — even in passing.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', enum: ['name'] },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
      additionalProperties: false,
    },
  },
} as const

const ACCOMMODATION_TOOL = {
  type: 'function',
  function: {
    name: 'check_accommodation',
    description:
      'List the accommodation the Pro Loco keeps on file, with contacts. Call it whenever the customer ' +
      'asks where to sleep, or about a rifugio, hotel, B&B, apartment or campsite. It does NOT report ' +
      'whether rooms are free — only the structure knows that.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
} as const

function buildTools(weatherEnabled: boolean, accommodationEnabled: boolean) {
  const tools: unknown[] = [REMEMBER_TOOL]
  if (weatherEnabled) tools.unshift(WEATHER_TOOL)
  if (accommodationEnabled) tools.push(ACCOMMODATION_TOOL)
  return tools
}

/** Render the structures for the model: who they are, how to reach them. */
function formatCatalogue(entries: CatalogueEntry[]): string {
  const lines = entries.map((e) => {
    const bits = [e.type ? `[${e.type}]` : '', e.name].filter(Boolean)
    const detail: string[] = []
    if (e.price && e.price > 0) detail.push(`prezzo indicativo da €${e.price}`)
    if (e.link) detail.push(e.link)
    if (e.description) detail.push(e.description)
    return `- ${bits.join(' ')} — ${detail.join(' · ')}`
  })
  return lines.join('\n')
}

// ── Operating rules ───────────────────────────────────────────────────────
// Instructions to the LLM, never shown to a customer, and deliberately NOT
// tenant-editable: a safety rule that can be deleted by editing a prompt in
// the backoffice is not a safety rule (CLAUDE.md §1B). Kept short — it is
// paid on every call.

const OPERATING_RULES = [
  '═══ OPERATING RULES (system, not customer-facing) ═══',
  '- Every fact you state — a name, an hour, a price, a phone number, a URL — must appear in the FAQ block, in a tool result, or in the customer\'s own message. Nothing else is knowledge you may use.',
  '- You MAY combine several FAQ entries and the weather into one tailored recommendation. That is your job. What you may NOT do is add a fact none of them contain.',
  '- You cannot know the weather without calling get_weather. Never state, estimate or imply it otherwise — not even "in August it is usually sunny".',
  '- Opening hours in the FAQ block are seasonal and may be stale. Never assert that something is open right now; say what the entry says and suggest confirming.',
  '- Never invent a URL or a phone number. Unverifiable ones are stripped from your reply before it is sent, which leaves the customer with a broken sentence — so only cite what you were given.',
  '- There is no human operator behind you. Never promise a callback, never say a colleague will get in touch, never take a booking.',
].join('\n')

// ── Concurrency ───────────────────────────────────────────────────────────
// Per-session async lock: two messages from the same customer arriving within
// one LLM round-trip must not interleave their state writes (CLAUDE.md §10).

const sessionLocks = new Map<string, Promise<unknown>>()

async function withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
  const previous = sessionLocks.get(sessionId) ?? Promise.resolve()
  const run = previous.then(fn, fn)
  sessionLocks.set(
    sessionId,
    run.catch(() => undefined),
  )
  try {
    return await run
  } finally {
    if (sessionLocks.get(sessionId) === run || (await sessionLocks.get(sessionId)) === undefined) {
      // Best-effort cleanup; a newer turn may have replaced the entry already.
      if (sessionLocks.get(sessionId) === run) sessionLocks.delete(sessionId)
    }
  }
}

// ── Input sanitization ────────────────────────────────────────────────────

const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g
const ZERO_WIDTH_RE = /[​-‍﻿]/g
const BIDI_RE = /[‪-‮⁦-⁩]/g

function sanitizeUserMessage(raw: string, maxMessageChars: number): string {
  return (raw || '')
    .replace(CONTROL_CHARS_RE, '')
    .replace(ZERO_WIDTH_RE, '')
    .replace(BIDI_RE, '')
    .trim()
    .slice(0, maxMessageChars)
}

// ── Weather cache ─────────────────────────────────────────────────────────
// Per session: three follow-ups about the same afternoon are one forecast.

interface CachedForecast {
  report: WeatherReport
  fetchedAtMs: number
}

const weatherCache = new Map<string, CachedForecast>()

async function fetchWeather(sessionId: string, now: Date): Promise<WeatherReport> {
  const cached = weatherCache.get(sessionId)
  if (cached && now.getTime() - cached.fetchedAtMs < WEATHER_CACHE_MS) {
    return cached.report
  }
  const report = await getSappadaWeather(now)
  // Only a good report is worth caching: a transient outage should be retried
  // on the next question, not remembered as "weather unavailable" for 30 min.
  if (report.ok) weatherCache.set(sessionId, { report, fetchedAtMs: now.getTime() })
  return report
}

// ── Prompt assembly ───────────────────────────────────────────────────────

function formatFaqBlock(faqs: FaqEntry[]): string {
  if (faqs.length === 0) return ''
  const entries = faqs.map((f, i) => `[${i}] Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
  return ['═══ APPROVED CONTENT (your only source of facts) ═══', '', entries].join('\n')
}

function formatRuntimeBlock(params: {
  now: Date
  channel: string
  greeting: 'new' | 'returning' | 'none'
  settings: Settings
  customerName?: string
}): string {
  const { now, channel, greeting, settings, customerName } = params
  const lines = [
    '═══ RUNTIME ═══',
    `Today: ${now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `Local time: ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`,
    `Channel: ${channel}`,
  ]
  if (customerName) lines.push(`Customer name: ${customerName}`)
  if (settings.privacyPolicyUrl) lines.push(`Privacy policy URL: ${settings.privacyPolicyUrl}`)

  if (greeting === 'new') {
    const welcome = settings.welcomeMessage?.trim()
    if (welcome) {
      lines.push(
        '',
        'FIRST TURN — open with this welcome, translated into the customer\'s language:',
        welcome,
      )
    }
    const video = settings.welcomeVideoUrl?.trim()
    if (video) {
      lines.push(
        '',
        'PRESENTATION VIDEO (first turn only). After the welcome, leave a blank line, write ONE short',
        'sentence meaning "before we start, here is a short presentation", ending with 👇, in the SAME',
        'language as the rest of your reply — never English unless the reply is English. Then, on the next',
        'line, this URL bare and verbatim: no markdown, no surrounding text, no shortening.',
        video,
        'The system turns that link into a playable video. From the second turn on, never repeat it.',
      )
    }
    lines.push('', 'Then answer what the customer actually asked, in the same message.')
  } else if (greeting === 'returning') {
    const back = settings.welcomeBackMessage?.trim()
    if (back) {
      lines.push('', 'RETURNING CUSTOMER — open with this, translated into their language:', back)
    }
    lines.push('Do NOT send the presentation video again.')
  } else {
    lines.push('', 'Mid-conversation: no greeting, no video. Answer directly.')
  }

  return lines.join('\n')
}

// ── LLM ───────────────────────────────────────────────────────────────────

interface ToolCall {
  id?: string
  function: { name: string; arguments?: string }
}

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

interface LlmResult {
  content: string
  toolCalls: ToolCall[]
  tokensUsed: number
}

async function callLLM(messages: Message[], settings: Settings, tools: unknown[]): Promise<LlmResult> {
  if (!API_KEY) throw new Error('OPENROUTER_API_KEY is not set')

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      messages,
      tools,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`LLM HTTP ${response.status}: ${body.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>
    usage?: { total_tokens?: number }
  }

  const message = data.choices?.[0]?.message
  return {
    content: message?.content ?? '',
    toolCalls: message?.tool_calls ?? [],
    tokensUsed: data.usage?.total_tokens ?? 0,
  }
}

function safeParseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

// ── Turn ──────────────────────────────────────────────────────────────────

interface TurnOutcome {
  reply: string | null
  language?: string
  tokensUsed: number
  answeredFromFaq: boolean
  error?: string
}

async function runTurn(input: ChatbotInput, settings: Settings): Promise<TurnOutcome> {
  const { sessionId, history, persistedState } = input.context
  const now = new Date()

  hydrateState(sessionId, persistedState)

  const userMessage = sanitizeUserMessage(input.userMessage, settings.maxMessageChars)
  if (!userMessage) {
    return { reply: null, tokensUsed: 0, answeredFromFaq: false }
  }

  // Rate limit and session length: both answer with tenant copy when set, and
  // stay silent otherwise — an untranslated English sentence is worse than
  // nothing (CLAUDE.md §1A, resolution order ends in silence).
  const recentCount = registerMessageTimestamp(sessionId, now.getTime(), 60_000)
  if (recentCount > settings.maxMessagesPerMinute) {
    return { reply: settings.rateLimitedMessage?.trim() || null, tokensUsed: 0, answeredFromFaq: false }
  }

  const turnCount = incrementTurn(sessionId)
  if (turnCount > settings.maxTurnsPerSession) {
    return { reply: settings.sessionTooLongMessage?.trim() || null, tokensUsed: 0, answeredFromFaq: false }
  }

  const state = getState(sessionId)

  const knownName = state.name || (input.userName?.trim() ? input.userName.trim() : undefined)
  if (knownName && !state.name) {
    updateState(sessionId, { name: knownName }, { mirror: false })
  }

  seedLanguageIfNeeded(sessionId, input.config.language, settings.enabledLanguages, settings.defaultLanguage)

  const lastTimestamp = history.length > 0 ? history[history.length - 1]?.timestamp : undefined
  const greeting = resolveGreeting({
    historyLength: history.length,
    lastMessageAtMs: lastTimestamp ? Date.parse(lastTimestamp) : undefined,
    hasKnownName: !!knownName,
    nowMs: now.getTime(),
    staleMs: WELCOME_BACK_STALE_MS,
  })
  updateState(sessionId, { greeting }, { mirror: false })

  const faqs = input.config.handlers?.getFaqs
    ? await input.config.handlers.getFaqs({ workspaceId: input.config.workspaceId })
    : []

  const faqBlock = formatFaqBlock(faqs)
  const weatherEnabled = settings.weatherEnabled !== false
  const accommodationEnabled = !!input.config.handlers?.getCatalogue

  const systemPrompt = [
    settings.mainPrompt?.trim() || '',
    '',
    OPERATING_RULES,
    '',
    faqBlock,
    '',
    formatRuntimeBlock({ now, channel: input.channel, greeting, settings, customerName: knownName }),
    formatStateForPrompt(getState(sessionId)),
  ]
    .filter((part) => part !== '')
    .join('\n')

  const trimmedHistory = history.slice(-(settings.maxHistoryMessages ?? 30))
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory.map((h) => ({ role: h.role, content: h.content }) as Message),
    { role: 'user', content: userMessage },
  ]

  // `approvedContent` is everything the reply may legitimately quote: the FAQ
  // block, the tenant's own presentation video, and anything a tool returns
  // this turn. It grows as tools answer.
  //
  // The video has to be in here explicitly. It arrives from settings, not from
  // the FAQ block, and without it the guard stripped the very link the welcome
  // had just announced — leaving "here is a short presentation 👇" followed by
  // nothing (live run, 2026-08-22).
  let approvedContent = [faqBlock, settings.welcomeVideoUrl ?? '', settings.privacyPolicyUrl ?? '']
    .filter(Boolean)
    .join('\n')
  let tokensUsed = 0
  let answeredFromFaq = faqs.length > 0

  const maxHops = settings.maxToolHops ?? MAX_TOOL_HOPS

  for (let hop = 0; hop < maxHops; hop++) {
    const result = await callLLM(messages, settings, buildTools(weatherEnabled, accommodationEnabled))
    tokensUsed += result.tokensUsed

    if (result.toolCalls.length === 0) {
      const { reply, lang } = extractLanguage(result.content)
      if (!reply.trim()) {
        return { reply: null, tokensUsed, answeredFromFaq, error: 'empty_reply' }
      }

      const checked = stripUnverifiableContacts(reply, approvedContent)
      if (checked.removed.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][stripped] ${checked.removed.join(' | ')}`)
      }

      if (lang) {
        const resolved = resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
        commitLanguageFromReply(sessionId, resolved)
      }

      return {
        reply: checked.text || null,
        language: getState(sessionId).language,
        tokensUsed,
        answeredFromFaq,
      }
    }

    messages.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls })

    for (const call of result.toolCalls) {
      const name = call.function.name
      let toolOutput: string

      if (name === 'get_weather') {
        if (!weatherEnabled) {
          toolOutput = JSON.stringify({
            ok: false,
            instruction:
              'The live forecast is not available for this destination. Do NOT state the weather. Say you ' +
              'cannot check it and point the customer to the official bulletin named in the FAQ block.',
          })
        } else {
          const report = await fetchWeather(sessionId, now)
          if (report.ok && report.summary) {
            approvedContent += `\n${report.summary}`
            toolOutput = JSON.stringify({
              ok: true,
              forecast: report.summary,
              instruction:
                'These are the REAL conditions for Sappada, written in Italian as the source language — ' +
                'translate them into the customer\'s language. Use them to shape your recommendation: ' +
                'indoors when it rains, outdoors when it is clear. Quote only the part that matters to ' +
                'what they asked; do not dump the whole forecast.',
            })
          } else {
            toolOutput = JSON.stringify({
              ok: false,
              error: report.error ?? 'unavailable',
              instruction:
                'The forecast could not be fetched. Do NOT guess the weather. Tell the customer plainly ' +
                'that you cannot check it right now and point them to the official bulletin in the FAQ block.',
            })
          }
        }
      } else if (name === 'check_accommodation') {
        const entries = accommodationEnabled
          ? await input.config.handlers!.getCatalogue!({ workspaceId: input.config.workspaceId })
          : []
        if (entries.length === 0) {
          toolOutput = JSON.stringify({
            ok: false,
            instruction:
              'No accommodation is on file. Do NOT invent any. Point the customer to the official ' +
              'accommodation page and the InfoPoint named in the FAQ block.',
          })
        } else {
          const rendered = formatCatalogue(entries)
          approvedContent += `\n${rendered}`
          toolOutput = JSON.stringify({
            ok: true,
            accommodation: rendered,
            instruction:
              'Written in Italian as the source language — translate it. These are contacts, NOT ' +
              'availability: you have no idea whether any of them has a room free. Never say a structure ' +
              'is full, never say one has space, never say Sappada is booked out. Give the contact and ' +
              'let the customer call. You take no bookings.',
          })
        }
      } else if (name === 'remember') {
        const args = safeParseArgs(call.function.arguments)
        const value = typeof args.value === 'string' ? args.value.trim() : ''
        if (args.key === 'name' && value) {
          updateState(sessionId, { name: value })
          toolOutput = JSON.stringify({ ok: true, saved: 'name' })
        } else {
          toolOutput = JSON.stringify({ ok: false, error: 'nothing_to_save' })
        }
      } else {
        toolOutput = JSON.stringify({ ok: false, error: `unknown tool ${name}` })
      }

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name,
        content: toolOutput,
      })
    }
  }

  // Hop budget exhausted with no free-text reply: the model kept calling tools.
  return { reply: null, tokensUsed, answeredFromFaq, error: 'tool_hop_limit' }
}

// ── Public entry point ────────────────────────────────────────────────────

export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  const settings = effectiveSettings(input.config.settings)

  // Host-provided copy wins over settings.json: it is rendered per turn with
  // {{customerName}} already substituted.
  const messages = input.config.messages
  if (messages?.welcomeBack?.trim()) settings.welcomeBackMessage = messages.welcomeBack.trim()
  if (messages?.rateLimited?.trim()) settings.rateLimitedMessage = messages.rateLimited.trim()
  if (messages?.sessionTooLong?.trim()) settings.sessionTooLongMessage = messages.sessionTooLong.trim()

  const { sessionId } = input.context

  try {
    const outcome = await withSessionLock(sessionId, () => runTurn(input, settings))

    if (LLM_DEBUG) {
      // eslint-disable-next-line no-console
      console.error(`[demosappada][state] ${formatStateOneLine(getState(sessionId))}`)
    }

    return {
      reply: outcome.reply,
      language: outcome.language,
      shouldEscalate: false,
      answeredFromFaq: outcome.answeredFromFaq,
      closeChat: false,
      patches: drainPatches(sessionId),
      persistedState: dehydrateState(sessionId),
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: outcome.tokensUsed, agentChain: ['demosappada'] },
      error: outcome.error,
    }
  } catch (error) {
    const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    // eslint-disable-next-line no-console
    console.error(`[demosappada][error] ${detail}`)
    return {
      reply: null,
      shouldEscalate: false,
      closeChat: false,
      audioOutput: settings.audioOutput,
      audioVoices: settings.audioVoices,
      meta: { tokensUsed: 0, agentChain: ['demosappada'] },
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export { resetState }
