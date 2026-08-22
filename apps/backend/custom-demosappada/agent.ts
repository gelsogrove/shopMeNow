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

/**
 * A tool the tenant defined in Settings → Custom Tools, dispatched as a
 * webhook by the host. The module never knows the URL or the credentials: it
 * receives a name, a schema and a description, offers them to the LLM, and
 * hands the arguments back for the host to execute.
 */
export interface CustomToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  /** Tenant-authored guidance on how to present the result. */
  responseInstructions?: string
}

export interface CustomToolResult {
  ok: boolean
  data?: unknown
  error?: string
}

/**
 * What the assistant has learned about this holiday.
 *
 * Structured, not a sentence in `notes`: the days remaining are recomputed
 * from `departureDate` on EVERY turn, and parsing that back out of prose
 * would break the first time the wording changed. The human-readable summary
 * for the Pro Loco's customer card is derived from this, never the reverse.
 */
export interface StayProfile {
  adults?: number
  children?: number
  /** Free text: "8, 9 e 10 anni". Changes what is worth proposing. */
  childrenAges?: string
  /**
   * Anything that constrains what can be recommended: coeliac, no car, a
   * pregnancy, a bad knee, a dog, a wheelchair, a fear of heights.
   *
   * Free text on purpose. An enum would be a promise the world does not keep
   * — the next guest always arrives with the constraint nobody listed — and
   * the model reasons about the sentence better than about a code.
   */
  constraints?: string
  /**
   * What a person at the Pro Loco wrote on this guest's card. Read-only:
   * the module never writes here, it only takes it into account.
   */
  operatorNotes?: string
  seniors?: number
  /** ISO date (YYYY-MM-DD). */
  arrivalDate?: string
  /** ISO date (YYYY-MM-DD) — the day they leave. */
  departureDate?: string
  /**
   * Intake questions already put to this guest, whether or not they answered.
   *
   * Asked once, never again. Without this the model has no memory across
   * conversations — a guest who comes back tomorrow gets "so, how many of you
   * are there?" a second time, and one who simply ignored the question gets it
   * every single turn (Andrea, 2026-08-23: "devono essere presenti solo una
   * volta dopo il welcome").
   */
  asked?: string[]
  /** True once the consent question has been put, whatever the answer was. */
  consentAsked?: boolean
  /** 'yes' | 'no' — whether they wanted an itinerary. Asked once. */
  itinerary?: string
  /**
   * Holidays already finished, oldest first. A guest who comes back next
   * February is starting a NEW stay: dates, questions and what-they-did all
   * reset — but what they did last time is exactly what makes the welcome
   * back worth something, so it is archived, never dropped.
   */
  pastStays?: Array<{
    arrivalDate?: string
    departureDate?: string
    doneAlready?: string
    feedback?: string
  }>
  origin?: string
  /**
   * What they have already done, appended as they tell us. Without it the
   * assistant re-proposes the Cascatelle on day three: it has no memory of
   * yesterday beyond the current conversation, and a holiday spans several.
   */
  doneAlready?: string
  notes?: string
}

export type GetStayProfileHandler = (params: {
  workspaceId: string
  customerId: string
}) => Promise<StayProfile | null>

export type SaveStayProfileHandler = (params: {
  workspaceId: string
  customerId: string
  profile: StayProfile
  /** Overwrite instead of merging — used when a finished stay is rolled over. */
  replace?: boolean
}) => Promise<boolean>

export type SaveFeedbackHandler = (params: {
  workspaceId: string
  customerId: string
  rating?: number
  comment?: string
}) => Promise<boolean>

export type SavePushConsentHandler = (params: {
  workspaceId: string
  customerId: string
  granted: boolean
}) => Promise<boolean>

export type SetCustomerTagsHandler = (params: {
  workspaceId: string
  customerId: string
  add?: string[]
  remove?: string[]
}) => Promise<string[]>

export type GetCustomToolsHandler = (params: { workspaceId: string }) => Promise<CustomToolDefinition[]>

export type ExecuteCustomToolHandler = (params: {
  workspaceId: string
  customerId?: string
  customerLanguage?: string
  name: string
  args: Record<string, unknown>
}) => Promise<CustomToolResult>

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
      getCustomTools?: GetCustomToolsHandler
      executeCustomTool?: ExecuteCustomToolHandler
      getStayProfile?: GetStayProfileHandler
      saveStayProfile?: SaveStayProfileHandler
      saveFeedback?: SaveFeedbackHandler
      savePushConsent?: SavePushConsentHandler
      setCustomerTags?: SetCustomerTagsHandler
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

const SAVE_STAY_TOOL = {
  type: 'function',
  function: {
    name: 'save_stay',
    description:
      'Save what you have learned about this holiday. Call it the moment the customer tells you any of ' +
      'it — how many they are, how long they stay, where they come from, or something they have already ' +
      'done. Send ONLY the fields you actually learned; the rest is preserved.',
    parameters: {
      type: 'object',
      properties: {
        adults: { type: 'integer', description: 'How many adults.' },
        children: { type: 'integer', description: 'How many children.' },
        childrenAges: { type: 'string', description: 'Their ages as the guest said them, e.g. "8, 9 e 10". Save it the moment you learn it — it changes what is worth proposing.' },
        constraints: { type: 'string', description: 'Anything that limits what suits them: coeliac or another intolerance, no car, a pregnancy, limited walking, a dog, a wheelchair. Append to what is already there rather than replacing it.' },
        seniors: { type: 'integer', description: 'How many elderly people.' },
        arrivalDate: { type: 'string', description: 'YYYY-MM-DD, the day they arrived.' },
        departureDate: { type: 'string', description: 'YYYY-MM-DD, the day they leave. Compute it from "we stay 5 days" using today\'s date in RUNTIME.' },
        origin: { type: 'string', description: 'Where they travelled from (city or country).' },
        doneAlready: { type: 'string', description: 'Something they have now done or seen, in a few words, so it is not proposed again.' },
        asked: {
          type: 'array',
          description:
            'Which intake questions you have now PUT to the guest, whether or not they answered. Send it ' +
            'in the same call as the question you just asked, so it is never asked twice.',
          items: { type: 'string', enum: ['party', 'stay', 'origin', 'childrenAges', 'constraints'] },
        },
        itinerary: {
          type: 'string',
          description:
            "Their answer about wanting a day-by-day plan: 'yes' or 'no'. Send it as soon as they answer.",
          enum: ['yes', 'no'],
        },
      },
      additionalProperties: false,
    },
  },
} as const

const SAVE_CONSENT_TOOL = {
  type: 'function',
  function: {
    name: 'save_push_consent',
    description:
      'Record whether the customer agrees to receive messages about the area, and WHAT about: events, ' +
      'accommodation offers, or both. Call it ONLY after they answered clearly, with their actual answer ' +
      '— never assume a yes, and never assume both topics when they named one. Call it again at the end ' +
      'of the holiday if you re-confirm it.',
    parameters: {
      type: 'object',
      properties: {
        granted: { type: 'boolean' },
        topics: {
          type: 'array',
          description:
            'What they agreed to hear about. Send only what they actually said yes to.',
          items: { type: 'string', enum: ['events', 'lodging'] },
        },
      },
      required: ['granted'],
      additionalProperties: false,
    },
  },
} as const

const SAVE_FEEDBACK_TOOL = {
  type: 'function',
  function: {
    name: 'save_feedback',
    description:
      'Save the end-of-stay feedback: what went well, what did not, and a 1-5 rating if they gave one. ' +
      'Call it once, when the holiday is ending and they have told you how it went.',
    parameters: {
      type: 'object',
      properties: {
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        comment: { type: 'string', description: 'What went well and what did not, in their own words.' },
      },
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

/**
 * Wrap a tenant-defined tool in the OpenAI function shape. The schema is
 * authored in the Settings UI and stored as JSON; a tool with no schema still
 * needs a valid empty one or the provider rejects the whole request.
 */
function customToolSchema(tool: CustomToolDefinition) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters:
        tool.parameters && typeof tool.parameters === 'object'
          ? tool.parameters
          : { type: 'object', properties: {}, additionalProperties: false },
    },
  }
}

function buildTools(
  weatherEnabled: boolean,
  accommodationEnabled: boolean,
  stayEnabled: boolean,
  customTools: CustomToolDefinition[],
) {
  const tools: unknown[] = [REMEMBER_TOOL]
  if (weatherEnabled) tools.unshift(WEATHER_TOOL)
  if (accommodationEnabled) tools.push(ACCOMMODATION_TOOL)
  if (stayEnabled) tools.push(SAVE_STAY_TOOL, SAVE_CONSENT_TOOL, SAVE_FEEDBACK_TOOL)
  for (const tool of customTools) tools.push(customToolSchema(tool))
  return tools
}

/**
 * Prepend the welcome (and, on a brand-new conversation, the presentation
 * video) to a reply that does not already carry it.
 *
 * This is CODE, not another sentence in the prompt, because the prompt lost.
 * The model can hold "greet on the first turn", "call get_weather" and "answer
 * with real proposals" — but not all three at once: reinforcing any one of
 * them made it drop another, turn after turn (Andrea, 2026-08-23: "al welcome
 * non lo vedo"). The greeting is a fixed string in a fixed place, so it
 * belongs to the mechanism; only the ANSWER needs a model.
 *
 * The intro line before the video is written here in the reply's own language,
 * so a message never mixes two languages.
 */
const VIDEO_INTRO: Record<string, string> = {
  it: 'Prima di iniziare, ecco una breve presentazione 👇',
  en: 'Before we start, here is a short presentation 👇',
  de: 'Bevor wir beginnen, hier eine kurze Vorstellung 👇',
  es: 'Antes de empezar, aquí tienes una breve presentación 👇',
  fr: 'Avant de commencer, voici une brève présentation 👇',
}

/**
 * Translations of the tenant's welcome, keyed by `lang:text`.
 *
 * The welcome is authored once, in one language (CLAUDE.md §1A — no
 * pre-translated copy in code), but it is prepended by CODE, so nothing
 * translates it on the way out: an Austrian guest got the Italian welcome on
 * top of a German reply (live check, 2026-08-23). One isolated call fixes it,
 * and the cache means a tenant pays for it once per language for the life of
 * the process, not once per guest.
 */
const welcomeTranslations = new Map<string, string>()

async function translateWelcome(
  text: string,
  language: string,
  settings: Settings,
): Promise<string> {
  const key = `${language}:${text}`
  const cached = welcomeTranslations.get(key)
  if (cached) return cached

  try {
    const result = await callLLM(
      [
        {
          role: 'system',
          content:
            `Translate the user message into the language with ISO 639-1 code "${language}". ` +
            'Keep the tone, the emoji and the Markdown exactly as they are. If it is already in that ' +
            'language, return it unchanged. Output ONLY the translation — no preamble, no quotes.',
        },
        { role: 'user', content: text },
      ],
      { ...settings, maxTokens: 600 },
      [],
    )
    const translated = result.content.trim()
    if (!translated) return text
    welcomeTranslations.set(key, translated)
    return translated
  } catch {
    // A greeting in the wrong language beats no greeting at all.
    return text
  }
}

/**
 * Words a self-introduction opens with, in the languages this workspace
 * serves. Matching the SHAPE of a greeting, not any particular sentence:
 * the tenant's welcome is configuration and may say anything, while what the
 * model improvises is always some form of "hello, I am the assistant".
 */
const GREETING_OPENERS =
  /^(ciao|salve|buongiorno|buonasera|benvenut\w*|hi|hello|hey|welcome|good (morning|afternoon|evening)|hallo|guten (tag|morgen|abend)|willkommen|hola|bienvenid\w*|bonjour|bienvenue)\b/i

/** Does this line introduce the assistant rather than answer anything? */
const SELF_INTRODUCTION =
  /(sono l'assistente|sono il tuo assistente|assistente (virtuale|digitale)|i am the|i'm the .*assistant|ich bin (der|die|dein)|soy el asistente|je suis l'assistant)/i

/**
 * Drop an opening greeting the model wrote, keeping the answer under it.
 *
 * Conservative on purpose: only leading paragraphs are considered, and only
 * while they look like an introduction — the moment a paragraph carries real
 * content the rest is returned untouched. Cutting an answer would be a far
 * worse failure than leaving one greeting too many.
 */
function stripLeadingGreeting(reply: string): string {
  const paragraphs = reply.split(/\n{2,}/)
  let start = 0
  let sawGreeting = false

  while (start < paragraphs.length) {
    const paragraph = paragraphs[start].trim()
    if (!paragraph) {
      start++
      continue
    }

    // Anything carrying a fact — a number, an hour, a price, a bullet list —
    // is the answer, and the answer is never dropped.
    if (/\d/.test(paragraph) || /^[-•*]/m.test(paragraph)) break

    const opensAsGreeting = GREETING_OPENERS.test(paragraph) || SELF_INTRODUCTION.test(paragraph)

    // The paragraphs that FOLLOW a greeting are still preamble while they only
    // restate what the assistant can do ("I'm here to help you discover…",
    // "how can I help?"). One greeting from the model was three paragraphs
    // long, and cutting only the first left the rest under the real welcome.
    const continuesPreamble =
      sawGreeting &&
      /(aiutart|aiutarl|posso aiutar|sono qui per|dimmi pure|come posso|scoprire il meglio|here to help|how can i help|tell me|wie kann ich|ich helfe|estoy aquí para)/i.test(
        paragraph,
      )

    if (!opensAsGreeting && !continuesPreamble) break

    sawGreeting = true
    start++
  }

  return paragraphs.slice(start).join('\n\n').trim()
}

/**
 * Does this message plausibly carry facts about the stay?
 *
 * Deliberately crude — it only decides whether it is worth ONE extra hop
 * asking the model to save; the model still judges what the facts are. A
 * false positive costs a hop, a false negative costs the guest being asked
 * the same question tomorrow.
 *
 * This is not phrase-based intent detection (CLAUDE.md §14): nothing here
 * routes the conversation or picks an answer. It only asks "might there be
 * something to write down".
 */
function mentionsStayFacts(message: string): boolean {
  const text = message.toLowerCase()
  const hasNumber = /\d/.test(text) || /\b(un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|zwei|drei|vier|two|three|four|five)\b/.test(text)
  const hasStayWord =
    /(siamo|sono in|bambin|figli|ragazz|anni|anziani|nonn|moglie|marito|famiglia|coppia|giorn|settiman|notte|nott|restiamo|rimaniamo|partiamo|arriviamo|veniamo da|arriviamo da|celiac|glutine|intolleran|allerg|incinta|carrozzin|cane|senza auto|a piedi|macchina|kinder|jahre|tage|wir sind|children|days|we are|we're staying)/.test(
      text,
    )
  return hasNumber && hasStayWord
}

/**
 * Substitute the per-customer placeholders in tenant copy.
 *
 * The host does this for the strings IT sends, but the greeting is prepended
 * by this module, so nothing had resolved it: "Bentornato {{customerName}}!"
 * reached a guest verbatim (live check, 2026-08-23). With no name known the
 * placeholder is removed rather than left or filled with a stand-in — a
 * greeting addressed to nobody still reads fine, one addressed to
 * "{{customerName}}" does not.
 */
function substitutePlaceholders(text: string, customerName: string | undefined): string {
  const name = customerName?.trim()
  if (name) return text.replace(/\{\{\s*customerName\s*\}\}/gi, name)
  return text
    .replace(/[ \t]*\{\{\s*customerName\s*\}\}[ \t]*/gi, ' ')
    .replace(/\s+([,!?.])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

async function withWelcome(
  reply: string,
  welcomeText: string | undefined,
  videoUrl: string | undefined,
  language: string | undefined,
  settings: Settings,
  customerName: string | undefined,
): Promise<string> {
  const welcome = substitutePlaceholders(welcomeText?.trim() ?? '', customerName)
  if (!welcome) return reply

  // The model was told not to greet, and greeted anyway — so the greeting it
  // wrote is REMOVED rather than the configured one skipped.
  //
  // Comparing the two texts does not work: the model paraphrases ("Ciao! Sono
  // l'assistente della Pro Loco di Sappada") and no substring of the tenant's
  // welcome appears in it, so the guard passed and the guest read two
  // different welcomes in a row (Andrea, 2026-08-23). What identifies a
  // greeting is its SHAPE — an opening line that introduces the assistant and
  // asks nothing — not its wording, and the shape is something code can find.
  const stripped = stripLeadingGreeting(reply)
  const body = stripped.trim() ? stripped : reply

  const lang = (language || settings.defaultLanguage || 'it').toLowerCase()
  const sourceLang = (settings.defaultLanguage || 'it').toLowerCase()
  const greeting =
    lang === sourceLang ? welcome : await translateWelcome(welcome, lang, settings)

  const parts = [greeting]
  const video = videoUrl?.trim()
  if (video && !reply.includes(video)) {
    parts.push('', VIDEO_INTRO[lang] ?? VIDEO_INTRO.it, video)
  }
  parts.push('', body)
  return parts.join('\n')
}

/**
 * Days after departure before a new message counts as a NEW holiday.
 *
 * Three, not zero: someone writing the evening they got home is still closing
 * the last trip ("we left the jacket at the rifugio"), and resetting their
 * stay there would lose the thread mid-conversation.
 */
const NEW_STAY_AFTER_DEPARTURE_DAYS = 3

/**
 * Has this guest come back for a fresh holiday?
 *
 * Detected from the calendar, never asked: a returning guest does not
 * announce a new stay, they just say hello. Without this the profile stays
 * frozen on last summer — the assistant keeps insisting the holiday is over,
 * never asks the new dates, and refuses to propose the Cascatelle because
 * they were done in August (Andrea, 2026-08-23).
 */
function isNewStay(profile: StayProfile | null, now: Date): boolean {
  const departure = profile?.departureDate
  if (!departure) return false
  const departureMs = Date.parse(`${departure}T23:59:59`)
  if (Number.isNaN(departureMs)) return false
  const daysSince = (now.getTime() - departureMs) / 86_400_000
  return daysSince > NEW_STAY_AFTER_DEPARTURE_DAYS
}

/**
 * Roll the current stay into history and clear what belongs to one holiday.
 *
 * Kept: where they come from, who they are, the consent (a legal record, not
 * a holiday detail) and everything already archived.
 * Cleared: dates, the questions asked, what they did, the itinerary answer —
 * all of it is about a trip that is over.
 */
function rolloverStay(profile: StayProfile): StayProfile {
  const history = [...(profile.pastStays ?? [])]
  if (profile.arrivalDate || profile.departureDate || profile.doneAlready) {
    history.push({
      arrivalDate: profile.arrivalDate,
      departureDate: profile.departureDate,
      doneAlready: profile.doneAlready,
    })
  }

  return {
    // Facts that outlive a single holiday.
    adults: profile.adults,
    children: profile.children,
    childrenAges: profile.childrenAges,
    seniors: profile.seniors,
    origin: profile.origin,
    consentAsked: profile.consentAsked,
    // Kept in history, cleared from the live stay.
    pastStays: history.slice(-5),
    // Everything below is deliberately absent: a new holiday, asked afresh.
    arrivalDate: undefined,
    departureDate: undefined,
    doneAlready: undefined,
    itinerary: undefined,
    asked: [],
  }
}

/**
 * Render the stay for the model, with the days remaining computed HERE.
 *
 * The count is derived from `departureDate` on every turn, never stored:
 * "3 giorni" written down on Monday is wrong by Wednesday, and the whole
 * point of knowing the stay is to concentrate the suggestions into the time
 * that is actually left.
 */
function formatStayBlock(
  profile: StayProfile | null,
  now: Date,
  returningGuest = false,
): string {
  if (!profile) return ''

  const lines: string[] = []

  if (returningGuest) {
    const last = profile.pastStays?.[profile.pastStays.length - 1]
    lines.push(
      'È TORNATO — nuova vacanza. Salutalo come si saluta chi si rivede, non come uno sconosciuto:',
      last?.doneAlready
        ? `  la volta scorsa aveva fatto: ${last.doneAlready}. Ricordaglielo con piacere, e proponigli ` +
          'qualcosa di nuovo oppure la stessa cosa in un\'altra stagione (le Cascatelle d\'inverno sono ' +
          'un\'altra cosa).'
        : '  non sappiamo cosa avesse fatto la volta scorsa.',
      '  Le date di questa vacanza NON le sai ancora: chiediglielo.',
    )
  }
  const party: string[] = []
  if (profile.adults) party.push(`${profile.adults} adulti`)
  if (profile.children) {
    party.push(
      profile.childrenAges
        ? `${profile.children} bambini (${profile.childrenAges})`
        : `${profile.children} bambini`,
    )
  }
  if (profile.seniors) party.push(`${profile.seniors} anziani`)
  if (party.length > 0) lines.push(`In vacanza: ${party.join(', ')}`)
  if (profile.origin) lines.push(`Arrivano da: ${profile.origin}`)
  if (profile.constraints) {
    lines.push(
      `⚠️ DA TENERE PRESENTE SEMPRE: ${profile.constraints}. Filtra OGNI proposta su questo, senza ` +
        'ricordarglielo ogni volta: se non puoi rispettarlo, dillo apertamente e proponi altro.',
    )
  }
  if (profile.arrivalDate) lines.push(`Arrivo: ${profile.arrivalDate}`)

  if (profile.departureDate) {
    const departure = Date.parse(`${profile.departureDate}T23:59:59`)
    if (!Number.isNaN(departure)) {
      const daysLeft = Math.ceil((departure - now.getTime()) / 86_400_000)
      lines.push(`Partenza: ${profile.departureDate}`)
      if (daysLeft > 1) {
        lines.push(
          `GIORNI RIMANENTI: ${daysLeft}. Concentra i consigli in questo tempo: proponi prima le cose ` +
            `che non vorresti si perdessero.`,
        )
      } else if (daysLeft === 1) {
        lines.push(
          'ULTIMO GIORNO PIENO. Proponi solo cose che stanno in una giornata, e verso sera chiedi come ' +
            'è andata la vacanza (cosa è piaciuto e cosa no) e salvala con save_feedback, poi salutali ' +
            'dicendo che li aspettiamo di nuovo.',
        )
      } else if (daysLeft <= 0) {
        lines.push(
          'LA VACANZA È FINITA (o finisce oggi). Non proporre più attività: chiedi come è andata — cosa ' +
            'è piaciuto e cosa no — salvala con save_feedback e salutali dicendo che li aspettiamo di nuovo.',
        )
      }
    }
  }

  if (profile.operatorNotes) {
    lines.push(
      `NOTA DELLA PRO LOCO su questo ospite: ${profile.operatorNotes}. Tienine conto, ma non citarla ` +
        'mai apertamente: è scritta per noi, non per lui.',
    )
  }

  if (profile.doneAlready) {
    lines.push(
      `GIÀ FATTO (non riproporlo, semmai costruiscici sopra): ${profile.doneAlready}`,
    )
  }

  // What is still open, and what must never be asked again. Computed here so
  // the model is told plainly instead of inferring it from absence — absence
  // is exactly what it gets wrong, re-asking a question the guest ignored.
  const asked = new Set(profile.asked ?? [])
  const missing: string[] = []
  if (!profile.adults && !profile.children && !profile.seniors && !asked.has('party')) {
    missing.push('con chi è (quanti adulti, bambini, anziani) → `party`')
  }
  if (!profile.departureDate && !asked.has('stay')) {
    missing.push('fino a quando resta → `stay`')
  }
  if (profile.children && !profile.childrenAges && !asked.has('childrenAges')) {
    missing.push("che età hanno i bambini → `childrenAges`")
  }
  if (!profile.constraints && !asked.has('constraints')) {
    missing.push(
      'se c\'è qualcosa da tenere presente — allergie o intolleranze, se sono senza auto, una ' +
        'gravidanza, difficoltà a camminare, un cane → `constraints`',
    )
  }
  if (!profile.origin && !asked.has('origin')) {
    missing.push('da dove arriva → `origin`')
  }
  if (!profile.consentAsked) {
    missing.push('se vuole ricevere notizie su eventi e offerte di alloggio → `consent`')
  }
  if (!profile.itinerary) {
    missing.push("se vuole che gli prepari un programma per i giorni che restano → `itinerary`")
  }

  if (missing.length > 0) {
    lines.push(
      'ANCORA DA CHIEDERE (una sola per messaggio, agganciata al discorso, mai due insieme):',
      ...missing.map((m) => `  - ${m}`),
    )
  } else {
    lines.push('NON CHIEDERE PIÙ NULLA sul suo soggiorno: sai già tutto quello che serve.')
  }

  if (asked.size > 0 || profile.consentAsked || profile.itinerary) {
    const done = [
      ...Array.from(asked),
      ...(profile.consentAsked ? ['consent'] : []),
      ...(profile.itinerary ? ['itinerary'] : []),
    ]
    lines.push(
      `GIÀ CHIESTO (non richiederlo MAI più, nemmeno se non ha risposto): ${done.join(', ')}`,
    )
  }

  if (profile.itinerary === 'no') {
    lines.push('Ha detto che NON vuole un programma: rispondi solo alle sue domande, non pianificare.')
  } else if (profile.itinerary === 'yes') {
    lines.push('Vuole il programma: sei il suo pianificatore, porta avanti il piano.')
  }

  if (lines.length === 0) return ''
  return ['', '═══ QUESTO OSPITE ═══', ...lines].join('\n')
}

/**
 * Tags the module maintains on the customer record.
 *
 * They exist for the campaign side of the product: a promotion for tonight's
 * dinner must reach only the guests who are IN TOWN tonight, and an offer on
 * accommodation only those who agreed to hear about accommodation. Segmenting
 * at send time is what makes the consent worth something.
 *
 * `INLOCO` is DERIVED from the stay dates, never asked and never set by the
 * model: the guest does not announce their departure, the calendar does.
 */
const TAG_IN_LOCO = 'INLOCO'
const TAG_INTEREST_EVENTS = 'INTERESSE-EVENTI'
const TAG_INTEREST_LODGING = 'INTERESSE-ALLOGGI'

/**
 * Is this guest in town right now, according to the dates they gave us?
 * Returns null when we cannot tell — an unknown stay must not remove a tag
 * someone set by hand.
 */
function isCurrentlyInTown(profile: StayProfile | null, now: Date): boolean | null {
  const departure = profile?.departureDate
  if (!departure) return null

  const departureMs = Date.parse(`${departure}T23:59:59`)
  if (Number.isNaN(departureMs)) return null
  if (now.getTime() > departureMs) return false

  const arrival = profile?.arrivalDate
  if (arrival) {
    const arrivalMs = Date.parse(`${arrival}T00:00:00`)
    if (!Number.isNaN(arrivalMs) && now.getTime() < arrivalMs) return false
  }
  return true
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
    // The welcome and the video are prepended by CODE after the model answers
    // (withWelcome above). Asking the model for them too is what made it drop
    // get_weather to make room for the greeting.
    lines.push(
      '',
      '🚨 A welcome line and a presentation video are added automatically ABOVE your reply. Do NOT write',
      'a greeting, do NOT introduce yourself, do NOT offer help in general, do NOT write a video link.',
      'Anything of that kind you write is deleted before sending, and what remains is what the guest',
      'reads — so start your very first sentence with the substance.',
      'On this first turn: answer what they asked (or, if they asked nothing, give one concrete',
      'suggestion), then ask the FIRST question from ANCORA DA CHIEDERE. Never end with a generic',
      '"how can I help you?" — that question is already answered by the welcome above you.',
    )
  } else if (greeting === 'returning') {
    lines.push(
      '',
      'A short welcome-back line is added automatically before your reply — do NOT greet the customer',
      'yourself, and never send the presentation video again. Start directly with the answer.',
    )
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
  // The stay tools need a customer to write to: in the playground there is
  // none, so they are simply not offered rather than failing at call time.
  const customerId = input.context.customerId
  const stayEnabled = !!customerId && !!input.config.handlers?.saveStayProfile
  let stayProfile =
    customerId && input.config.handlers?.getStayProfile
      ? await input.config.handlers.getStayProfile({
          workspaceId: input.config.workspaceId,
          customerId,
        })
      : null

  // Coming back for a new holiday: archive the finished one and start the
  // stay fresh, keeping who they are and the consent. Done BEFORE the prompt
  // is built, so this turn already behaves like the first of a new trip.
  let returningGuest = false
  if (stayProfile && isNewStay(stayProfile, now)) {
    const rolled = rolloverStay(stayProfile)
    if (customerId && input.config.handlers?.saveStayProfile) {
      // A merge would keep the old dates alive, so the cleared stay is written
      // whole: `replace: true` tells the host to overwrite rather than merge.
      await input.config.handlers.saveStayProfile({
        workspaceId: input.config.workspaceId,
        customerId,
        profile: rolled,
        replace: true,
      })
    }
    stayProfile = rolled
    returningGuest = true
  }

  let greeting = resolveGreeting({
    historyLength: history.length,
    lastMessageAtMs: lastTimestamp ? Date.parse(lastTimestamp) : undefined,
    hasKnownName: !!knownName,
    nowMs: now.getTime(),
    staleMs: WELCOME_BACK_STALE_MS,
  })

  // A guest whose stay we already know is not new, however empty this
  // conversation's history looks. WhatsApp threads and widget sessions start
  // fresh all the time — on the third day of the holiday that produced the
  // full welcome and the presentation video all over again (live check,
  // 2026-08-23). The stay profile is the durable record; the history is not.
  if (greeting === 'new' && stayProfile) greeting = 'returning'
  updateState(sessionId, { greeting }, { mirror: false })

  const faqs = input.config.handlers?.getFaqs
    ? await input.config.handlers.getFaqs({ workspaceId: input.config.workspaceId })
    : []

  const faqBlock = formatFaqBlock(faqs)
  const weatherEnabled = settings.weatherEnabled !== false
  const accommodationEnabled = !!input.config.handlers?.getCatalogue

  // Tenant-defined webhook tools (Settings → Custom Tools). Absent handler or
  // an empty list simply means this workspace defined none.
  const customTools = input.config.handlers?.getCustomTools
    ? await input.config.handlers.getCustomTools({ workspaceId: input.config.workspaceId })
    : []
  const customToolsByName = new Map(customTools.map((t) => [t.name, t]))


  // INLOCO is kept in sync by CODE, every turn, from the stay dates. It is the
  // segment a campaign for tonight is sent to, so it must be true even when
  // the guest never says "we're leaving" — and the model must not be able to
  // set it, because "are you still here?" is not a question worth asking.
  if (customerId && input.config.handlers?.setCustomerTags) {
    const inTown = isCurrentlyInTown(stayProfile, now)
    if (inTown === true) {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        add: [TAG_IN_LOCO],
      })
    } else if (inTown === false) {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        remove: [TAG_IN_LOCO],
      })
    }
  }

  const systemPrompt = [
    settings.mainPrompt?.trim() || '',
    '',
    OPERATING_RULES,
    '',
    faqBlock,
    '',
    formatRuntimeBlock({ now, channel: input.channel, greeting, settings, customerName: knownName }),
    formatStayBlock(stayProfile, now, returningGuest),
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

  // Whether the guest's answer was actually recorded this turn. The prompt
  // asks the model to call save_stay the moment it learns something, and the
  // model regularly does not: it acknowledged "siamo in 4, due bambini di 7 e
  // 9 anni" in prose and saved nothing, so two turns later it asked again
  // (Andrea, 2026-08-23). An instruction cannot be the guarantee here.
  let stayWasSaved = false
  let forcedSaveDone = false

  for (let hop = 0; hop < maxHops; hop++) {
    const result = await callLLM(
      messages,
      settings,
      buildTools(weatherEnabled, accommodationEnabled, stayEnabled, customTools),
    )
    tokensUsed += result.tokensUsed

    if (result.toolCalls.length === 0) {
      // The turn is about to end. If the guest told us something about their
      // stay and nothing was written, spend one hop forcing the tool rather
      // than letting the fact evaporate — asking the same question twice is
      // what makes the assistant feel like a form.
      if (stayEnabled && !stayWasSaved && !forcedSaveDone && mentionsStayFacts(userMessage)) {
        forcedSaveDone = true
        messages.push({ role: 'assistant', content: result.content || null })
        messages.push({
          role: 'user',
          content:
            '[SYSTEM] Il cliente ti ha appena dato informazioni sul suo soggiorno e non le hai ancora ' +
            'salvate. Chiama ORA save_stay con quello che hai imparato da questo messaggio (quante ' +
            'persone, bambini e le loro età, anziani, quanti giorni, da dove arrivano, esigenze ' +
            'particolari), e registra in `asked` le domande che hai fatto. Non scrivere nulla al ' +
            'cliente in questo passaggio.',
        })
        continue
      }
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

      // Applied HERE, after the model has written its answer: the greeting is
      // the one part of the message that must not depend on the model
      // remembering to produce it.
      let finalReply = checked.text
      if (finalReply && greeting !== 'none') {
        const isNew = greeting === 'new'
        const welcomeText = isNew
          ? settings.welcomeMessage
          : settings.welcomeBackMessage || settings.welcomeMessage
        const sendVideo = isNew && !getState(sessionId).videoSent
        finalReply = await withWelcome(
          finalReply,
          welcomeText,
          sendVideo ? settings.welcomeVideoUrl : undefined,
          getState(sessionId).language,
          settings,
          knownName,
        )
        if (sendVideo) updateState(sessionId, { videoSent: true }, { mirror: false })
      }

      return {
        reply: finalReply || null,
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
      } else if (name === 'save_stay') {
        if (!stayEnabled || !customerId) {
          toolOutput = JSON.stringify({ ok: false, error: 'no_customer' })
        } else {
          const args = safeParseArgs(call.function.arguments)
          const profile: StayProfile = {}
          const num = (v: unknown) => (typeof v === 'number' && v >= 0 ? Math.round(v) : undefined)
          const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

          profile.adults = num(args.adults)
          profile.children = num(args.children)
          profile.childrenAges = str(args.childrenAges)

          // Appended: constraints arrive one at a time over a conversation
          // ("she's coeliac"… later "and we're on foot"), and a replacing
          // write would drop the one told first.
          const constraint = str(args.constraints)
          if (constraint) {
            const previous = stayProfile?.constraints?.trim()
            profile.constraints =
              previous && !previous.toLowerCase().includes(constraint.toLowerCase())
                ? `${previous}; ${constraint}`
                : constraint
          }
          profile.seniors = num(args.seniors)
          profile.arrivalDate = str(args.arrivalDate)
          profile.departureDate = str(args.departureDate)
          profile.origin = str(args.origin)

          // Appended, never replaced: each visit adds to the list of what they
          // have seen, and a write that overwrote it would make the assistant
          // forget everything but the last thing.
          const done = str(args.doneAlready)
          if (done) {
            const previous = stayProfile?.doneAlready?.trim()
            profile.doneAlready = previous && !previous.includes(done) ? `${previous}; ${done}` : done
          }

          const itineraryAnswer = str(args.itinerary)
          if (itineraryAnswer === 'yes' || itineraryAnswer === 'no') {
            profile.itinerary = itineraryAnswer
          }

          // Accumulated, never replaced: each call reports the question just
          // asked, and the set is what stops it being asked again tomorrow.
          const nowAsked = Array.isArray(args.asked) ? (args.asked as unknown[]) : []
          const askedSet = new Set(stayProfile?.asked ?? [])
          for (const item of nowAsked) {
            if (typeof item === 'string' && item.trim()) askedSet.add(item.trim())
          }
          if (askedSet.size > (stayProfile?.asked?.length ?? 0)) {
            profile.asked = Array.from(askedSet)
          }

          const saved = await input.config.handlers!.saveStayProfile!({
            workspaceId: input.config.workspaceId,
            customerId,
            profile,
          })
          if (saved) stayWasSaved = true
          toolOutput = JSON.stringify({
            ok: saved,
            instruction: done
              ? 'Saved. Now ask briefly how it went — one short question, in their language. Their answer ' +
                'goes to save_feedback. Do not ask again about something already recorded.'
              : 'Saved. Do not thank them for the information or repeat it back: just carry on helping.',
          })
        }
      } else if (name === 'save_push_consent') {
        if (!customerId || !input.config.handlers?.savePushConsent) {
          toolOutput = JSON.stringify({ ok: false, error: 'no_customer' })
        } else {
          const args = safeParseArgs(call.function.arguments)
          const granted = args.granted === true
          const saved = await input.config.handlers.savePushConsent({
            workspaceId: input.config.workspaceId,
            customerId,
            granted,
          })

          // Marked whatever the answer was: a "no" that is not recorded as
          // ASKED gets asked again, which is the one thing a refusal must
          // never lead to.
          if (input.config.handlers.saveStayProfile) {
            await input.config.handlers.saveStayProfile({
              workspaceId: input.config.workspaceId,
              customerId,
              profile: { consentAsked: true },
            })
          }

          // The interests are what makes the consent usable: an offer on rooms
          // goes only to whoever agreed to hear about rooms. Stored as tags so
          // the campaign side can segment without knowing this module exists.
          if (input.config.handlers.setCustomerTags) {
            const topics = Array.isArray(args.topics) ? (args.topics as unknown[]) : []
            const wantsEvents = granted && topics.includes('events')
            const wantsLodging = granted && topics.includes('lodging')
            await input.config.handlers.setCustomerTags({
              workspaceId: input.config.workspaceId,
              customerId,
              add: [
                ...(wantsEvents ? [TAG_INTEREST_EVENTS] : []),
                ...(wantsLodging ? [TAG_INTEREST_LODGING] : []),
              ],
              remove: [
                ...(wantsEvents ? [] : [TAG_INTEREST_EVENTS]),
                ...(wantsLodging ? [] : [TAG_INTEREST_LODGING]),
              ],
            })
          }

          toolOutput = JSON.stringify({
            ok: saved,
            instruction: granted
              ? 'Consent recorded. Thank them in one short line and move on — do not oversell it.'
              : 'Refusal recorded. Accept it without insisting, and never ask again.',
          })
        }
      } else if (name === 'save_feedback') {
        if (!customerId || !input.config.handlers?.saveFeedback) {
          toolOutput = JSON.stringify({ ok: false, error: 'no_customer' })
        } else {
          const args = safeParseArgs(call.function.arguments)
          const rating = typeof args.rating === 'number' ? Math.round(args.rating) : undefined
          const comment = typeof args.comment === 'string' ? args.comment.trim() : undefined
          const saved = await input.config.handlers.saveFeedback({
            workspaceId: input.config.workspaceId,
            customerId,
            rating,
            comment,
          })
          toolOutput = JSON.stringify({
            ok: saved,
            instruction:
              'Saved. Thank them warmly in one line. If the holiday is over, say goodbye telling them ' +
              'we look forward to having them back. Never ask for the same feedback twice.',
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
      } else if (customToolsByName.has(name) && input.config.handlers?.executeCustomTool) {
        const definition = customToolsByName.get(name)!
        const result = await input.config.handlers.executeCustomTool({
          workspaceId: input.config.workspaceId,
          customerId: input.context.customerId,
          customerLanguage: getState(sessionId).language,
          name,
          args: safeParseArgs(call.function.arguments),
        })

        if (result.ok) {
          const rendered = typeof result.data === 'string' ? result.data : JSON.stringify(result.data)
          // Whatever the tenant's own service returned is approved content:
          // a phone number or URL it sends back is as verifiable as one from
          // the FAQ block, and would otherwise be stripped before sending.
          approvedContent += `\n${rendered}`
          toolOutput = JSON.stringify({
            ok: true,
            result: result.data,
            instruction:
              definition.responseInstructions ||
              'Present this result to the customer in their language. Use only what it contains — ' +
                'do not add facts of your own.',
          })
        } else {
          toolOutput = JSON.stringify({
            ok: false,
            error: result.error ?? 'tool_failed',
            instruction:
              'The tool failed. Do NOT invent what it would have returned. Tell the customer plainly ' +
              'that you cannot retrieve that right now.',
          })
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
