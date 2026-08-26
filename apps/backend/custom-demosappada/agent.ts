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
import { nextIntakeStep, type IntakeContext } from './intake-machine.js'
import { getSappadaWeather, TIMEZONE, type WeatherReport } from './weather.js'
import { MAX_TOOL_HOPS, WELCOME_BACK_STALE_MS } from './bounds.js'
import { isCurrentlyInTown, TAG_IN_LOCO } from '@shared/stay-inloco'

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
  /** Confirmation sent after an UNSUBSCRIBE. Authored in ONE language; the host translates. */
  unsubscribedMessage?: string
  sessionTooLongMessage?: string
  /** Presentation video shown once, on the first turn of a new conversation. */
  welcomeVideoUrl?: string
  /**
   * The intake questions, DICTATED verbatim — one per turn.
   *
   * Written in one language; the model translates them and nothing else. The
   * prompt used to DESCRIBE each question instead ("with whom — name the three
   * categories…") and let the model compose it, which is how three of them
   * ended up in a single numbered list (Andrea, live, 2026-08-24). Same
   * mechanism as custom-demorobot's `intakeQuestions`: the code owns WHICH
   * question and its WORDING, the model owns only the language.
   *
   * Resolution order per CLAUDE.md §1A: workspace advanced-settings (edited in
   * the backoffice) → this module's settings.json → nothing asked at all.
   */
  intakeQuestions?: Partial<Record<IntakeKey, string>>
  /**
   * Shown ONLY to a guest who accepts the push consent: how to turn it off
   * again. Configuration, not a literal, so it can be reworded per tenant and
   * the LLM renders it in the guest's language (CLAUDE.md §1A).
   */
  /**
   * How the intake-closing message ends, after the itinerary question.
   *
   * Configuration, not a literal: the model was writing its own sign-off
   * ("Se vi va, posso darvi informazioni sui ristoranti per la cena. Che ne
   * pensi?"), which offers something nobody asked for. Andrea, 2026-08-25.
   */
  closingLine?: string
  pushOptOutHint?: string
  /**
   * The exact words a guest may write to revoke the push consent.
   *
   * Configured next to `pushOptOutHint` on purpose: the hint PROMISES a
   * command, and this is what makes it work — keeping them together is what
   * stops the module promising "NO PUSH" while only listening for
   * "unsubscribe" (Andrea, 2026-08-24). Matched alone on the line, so a
   * sentence merely containing the words is still a question.
   */
  pushOptOutCommands?: string[]
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
  /** Confirmation sent after the customer revokes consent with UNSUBSCRIBE. */
  unsubscribed?: string | null
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
   * What they said they enjoy — nature, food, history, quiet, walking.
   *
   * Kept apart from `constraints` on purpose. A constraint FILTERS ("no car"
   * rules things out); an interest ORIENTS ("we like food" moves the dairy up
   * the list without ruling the museum out). Merged into one field the block
   * below would filter every proposal on a preference, and a guest who likes
   * nature would stop being told about anything indoors — including on the
   * day it rains (Andrea, 2026-08-23).
   */
  interests?: string
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
  /**
   * Where this guest stands with Sappada (contratto.md, 2026-08-27):
   * `in_loco` = in town now, `planned` = holiday booked but not started
   * (both run the standard intake), `remote` = asking from home with no
   * stay — every stay question is skipped for them. Saved by the model via
   * save_preferences (it reads the nuance); a bare sì/no to the location
   * question is captured deterministically as backstop.
   */
  presence?: 'in_loco' | 'remote' | 'planned'
  /** True once the remote prospect's needs question has been put. */
  remoteNeedsAsked?: boolean
  /** True once the consent question has been put, whatever the answer was. */
  consentAsked?: boolean
  /**
   * True once the guest has been told HOW to opt out ("scrivi NO PUSH").
   *
   * On the customer, not on the turn: a per-turn flag sent it again whenever
   * the model called save_push_consent a second time, so the same guest read
   * it twice, two turns apart (Andrea, 2026-08-25). It is a promise made
   * once — repeating it reads like nagging.
   */
  pushOptOutHintSent?: boolean
  /**
   * True when this customer wrote to us BEFORE the current conversation.
   *
   * Set by the host from the message archive, which is the only durable
   * record of it: a widget session or a WhatsApp thread starts fresh
   * constantly, and a guest who chatted without ever stating dates has no
   * stay to go by (Andrea, 2026-08-25: "il primo check è sapere se l'utente
   * esiste o no").
   */
  hasWrittenBefore?: boolean
  /**
   * Set by the `startNewStay` tool when the guest SAYS they are back.
   *
   * The calendar rollover only fires three days after a departure we know
   * about; someone returning early, or whose dates were never saved, would
   * stay pinned to a finished holiday. Cleared by the rollover it triggers.
   */
  restartRequested?: boolean
  /** 'yes' | 'no' — whether they wanted an itinerary. Asked once. */
  itinerary?: string
  /**
   * The plan they accepted, one line per day ("2026-08-24: Cascatelle al
   * mattino, museo il pomeriggio").
   *
   * Saved because a plan that lives only in the conversation is lost the
   * moment they close the chat — and a guest who comes back tomorrow asking
   * "cosa avevamo detto per oggi?" deserves an answer. Rewritten in full on
   * every change: a plan is one object, not a log of edits.
   */
  itineraryPlan?: string
  /**
   * True once the presentation video has been sent to THIS GUEST.
   *
   * On the customer, not on the session: widget sessions and WhatsApp threads
   * start fresh constantly, and a per-session flag showed the same video again
   * on day two of the holiday.
   */
  videoSent?: boolean
  /**
   * True once the end-of-stay feedback has been collected. Without it the
   * assistant asks "how did it go?" every time they write after leaving —
   * the prompt says not to, but the prompt has no way to know.
   */
  feedbackGiven?: boolean
  /** Their words about this stay, so the archive keeps them. */
  lastFeedback?: string
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
  /**
   * The holiday in prose, for the Pro Loco's customer card.
   *
   * Derived from the structured fields, never the reverse (see the note on
   * this interface): the days remaining are still computed from
   * `departureDate`, and nothing is ever parsed back out of here. What it
   * buys is a card a human can read at a glance instead of a row of fields
   * — the whole intake in one paragraph (Andrea, 2026-08-24: "il risultato
   * deve andare tutto dentro note").
   */
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

// The seven schemas live in tools.manifest.ts, which the backend reads to seed
// one editable row per tool. Imported from there rather than declared here so
// there is exactly one copy of each schema (CLAUDE.md §1) and no import cycle:
// weather.ts → tools.manifest.ts → agent.ts.
import {
  ACCOMMODATION_TOOL,
  REMEMBER_TOOL,
  SAVE_CONSENT_TOOL,
  SAVE_FEEDBACK_TOOL,
  SAVE_ITINERARY_TOOL,
  SAVE_STAY_TOOL,
} from './tools.manifest.js'

export {
  ACCOMMODATION_TOOL,
  REMEMBER_TOOL,
  SAVE_CONSENT_TOOL,
  SAVE_FEEDBACK_TOOL,
  SAVE_ITINERARY_TOOL,
  SAVE_STAY_TOOL,
}

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

/**
 * Every tool offered this turn, in the order the host supplied them.
 *
 * The module's own seven built-ins used to be hardcoded here and gated on
 * three booleans. They are now DB rows — seeded from `tools.manifest.ts` and
 * switchable in Settings → Custom Tools — and reach this function through the
 * same `customTools` list as a tenant's webhooks. What executes them is still
 * the dispatch branch in this file, matched on `functionName`; the row is the
 * declaration, the code is the handler.
 *
 * A tool an admin switched off is simply absent: the model is never told it
 * exists, which is the honest failure. Nothing is substituted for it here —
 * a fallback would be exactly the invented default CLAUDE.md §1 forbids.
 */
function buildTools(customTools: CustomToolDefinition[]) {
  return customTools.map(customToolSchema)
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
 * Video links carried BY a FAQ entry, as opposed to the tenant's presentation
 * video. Two different things that the prompt used to call by one name: the
 * blanket "no video" of a mid-conversation turn made the model drop the FAQ's
 * own links too, so the guest asking about Malga Tuglia got neither of its two
 * videos — nor the GPX track and the trail description alongside them
 * (Andrea, 2026-08-23: "volevo un video una foto").
 *
 * Wording the prompt more carefully is half the fix; this is the other half,
 * because an instruction the model may still ignore is not a guarantee
 * (CLAUDE.md §16 iron rule 1).
 */
const ANY_LINK_RE = /https?:\/\/[^\s<>()\[\]]+/gi
const VIDEO_LINK_RE = /(?:youtube\.com|youtu\.be|vimeo\.com|\.mp4)/i
const PHOTO_LINK_RE = /\.(?:jpg|jpeg|png|webp|gif)(?:$|[?#])/i

/**
 * Every link a FAQ entry carries, richest first.
 *
 * Andrea's order, 2026-08-23: "preferisco sempre il video" — a video, else a
 * photo, else the page itself. One link goes out, so which one it is decides
 * what the guest sees: a detail answer about a rifugio should show the place,
 * and only fall back to a URL when there is nothing to show.
 *
 * Trailing sentence punctuation is trimmed: a link cited mid-sentence ends up
 * carrying the comma after it, and a comma inside a URL breaks the preview.
 */
function mediaLinksIn(text: string): string[] {
  const links = Array.from(new Set((text.match(ANY_LINK_RE) ?? []).map(trimUrlPunctuation)))
  const rank = (link: string): number => {
    if (VIDEO_LINK_RE.test(link)) return 0
    if (PHOTO_LINK_RE.test(link)) return 1
    return 2
  }
  return links.sort((a, b) => rank(a) - rank(b))
}

function trimUrlPunctuation(raw: string): string {
  return raw.replace(/[)\].,;:!?]+$/, '')
}

/**
 * Append the media of the ONE place the reply is about.
 *
 * Andrea's rule, 2026-08-23: media belong to a detail answer, never to a list.
 * Asked "which mountain huts are there", the reply names ten of them — one
 * video each would be ten WhatsApp notifications and a chat nobody reads.
 *
 * The subject is the entry that WINS, not the only entry that matches. The
 * previous test — "no other FAQ may look like the reply" — sounded equivalent
 * and was not: a good detail answer about the Cascatelle also says
 * `passeggiata`, `adatta ai bambini`, `facile`, so the two generic
 * walks-with-children entries matched it too, three entries were counted and
 * the video was dropped. That is the bug Andrea hit live (2026-08-23:
 * "me lo devi dare subito, non se lo chiedo"), and it hit EVERY detail
 * answer, not just that one.
 *
 * So the entries are ranked by topic overlap and the top one must beat the
 * runner-up by a clear margin. One place described in depth wins outright;
 * ten huts listed side by side all score alike, no one wins, and the reply
 * stays text — which is the list rule, now enforced by the same measurement
 * instead of a second heuristic.
 *
 * At most ONE link is appended (Andrea, 2026-08-23: "testo e video o link o
 * foto"). Malga Tuglia carries two videos; sending both would be the ten
 * notifications again, in miniature.
 *
 * `excluded` keeps the presentation video out: it is prepended by withWelcome
 * and must not come back a second time as if it were content.
 */
/**
 * Is the presentation video going out on THIS turn?
 *
 * On a brand-new conversation withWelcome prepends the tenant's presentation
 * video, and a FAQ video appended underneath makes it two videos in one
 * message — two WhatsApp previews, with the intake question wedged between
 * them (Andrea, 2026-08-23: "e dopo il welcome con le notizie?"). The
 * presentation goes first because it is sent once in the guest's life; the
 * place's own video is not lost, it arrives the moment they ask about it.
 */
function presentationVideoGoesOut(
  greeting: 'new' | 'returning' | 'none',
  sessionId: string,
  stayProfile: StayProfile | null | undefined,
  settings: Settings,
): boolean {
  if (greeting !== 'new') return false
  if (!settings.welcomeVideoUrl?.trim()) return false
  return !getState(sessionId).videoSent && !stayProfile?.videoSent
}

/**
 * May a place's own photo or video go out on this turn at all?
 *
 * Two turns where the answer is no, for opposite reasons:
 *
 * - the presentation video is going out (see above) — one video per message;
 * - the holiday is OVER. The closing turns are feedback, the renewed consent
 *   and the goodbye, and the guest is on the motorway home. The prompt
 *   already says "non proporre più attività: non sono più in zona", yet a
 *   guest writing "ci sono piaciute le cascatelle" was sent the waterfall
 *   video underneath the feedback question — an advert for the place they
 *   have just left, stapled under the one thing they were meant to read
 *   (Andrea, 2026-08-23). A medium is sent when it serves the guest, not
 *   when a word matches.
 */
function contentMediaAllowed(
  greeting: 'new' | 'returning' | 'none',
  sessionId: string,
  stayProfile: StayProfile | null | undefined,
  settings: Settings,
  now: Date,
  /** True while an intake question is pending this turn. */
  intakePending = false,
): boolean {
  if (presentationVideoGoesOut(greeting, sessionId, stayProfile, settings)) return false

  // While the intake is still running, the turn belongs to the question. A
  // link or a video under it competes with the one thing the guest is being
  // asked, and they were arriving on every single intake turn (Andrea,
  // 2026-08-25: "non voglio il link"). Media come back the moment the
  // questions are done and the conversation is about places again.
  if (intakePending) return false

  // The welcome turn carries the greeting and the presentation — nothing else.
  // The guest wrote "ciao": they have not asked about a place yet, so there is
  // no detail answer for a photo or video to belong to, and attaching one puts
  // a second link under a message that already has one (Andrea, 2026-08-24:
  // "togli il link che c'è sotto").
  //
  // Gated on the GREETING, not on presentationVideoGoesOut above: once the
  // video moved into the copy as {{videoUrl}}, `welcomeVideoUrl` went empty
  // and that check stopped firing — silently taking this protection with it.
  if (greeting === 'new') return false

  const daysLeft = daysLeftInStay(stayProfile ?? null, now)
  return daysLeft === null || daysLeft > 0
}

const SUBJECT_MIN_SCORE = 0.6
const SUBJECT_MIN_MARGIN = 0.2
const SUPPORT_MIN_RATIO = 1.5

/**
 * How many places a reply can name before it stops being ABOUT one of them.
 *
 * Two, because a detail answer legitimately brushes past a neighbour — the
 * Cascatelle entry names the museum by the bridge — while a list names four,
 * six, ten. Measured on the same score, so no phrase matching is involved.
 */
const LIST_NAMED_PLACES = 2

/**
 * How strongly a place must feature before it counts toward the list test.
 *
 * Above SUBJECT_MIN_SCORE on purpose: passing landmarks clear the lower bar
 * (they are named, with their distinctive words) without the reply being
 * about them.
 */
const LIST_PLACE_SCORE = 0.8

/**
 * Is this reply a DETAIL answer about one FAQ place?
 *
 * Same measurement withFaqMedia uses (subject overlap on the MODEL's output,
 * never the guest's words). Needed mid-intake: a guest who picks an offered
 * place ("si le cascatelle") asked for its detail, and replacing the answer
 * with the next intake question bulldozed the request (2026-08-25: "se ti
 * dico cascatelle è il punto che devi espandere").
 */
function replyIsDetailAnswer(reply: string, userMessage: string, faqs: FaqEntry[]): boolean {
  if (faqs.length === 0) return false
  // A detail is about ONE place. Counted at the ordinary subject bar: the
  // higher LIST_PLACE_SCORE bar let a four-item tour of the village pass as
  // "detail" and a video landed under a list (R6.3 violated, 2026-08-25).
  const subjects = faqs.filter((f) => subjectScore(f, reply, faqs) >= SUBJECT_MIN_SCORE)
  if (subjects.length !== 1) return false
  // And the GUEST named it — reply-only scoring fired on the model's own
  // tangents (a stray restaurants line dragged its link into a date answer).
  return subjectScore(subjects[0], userMessage, faqs) > 0
}

function withFaqMedia(
  reply: string,
  faqs: FaqEntry[],
  userMessage: string,
  excluded: string[],
): string {
  const skip = new Set([...mediaLinksIn(reply), ...excluded.filter(Boolean)])

  // A reply that names several places is a LIST, even when only one of them
  // happens to carry a video — and then that one wins by having no rival,
  // which is exactly backwards. Asked "cosa faccio con i bambini", the reply
  // offers the Gnomi, the Daini, the SapPark, Nevelandia and mentions the
  // Cascatelle in passing; the waterfall video is the only one in the set, so
  // it was being attached to an answer that was not about waterfalls
  // (Andrea, 2026-08-23). Media belong to a detail answer, never to a list.
  // Counted on a HIGHER bar than the winner has to clear. A detail answer
  // legitimately names its landmarks — the Cascatelle entry gives the wooden
  // bridge, the Piccolo Museo della Grande Guerra and the InfoPoint as the
  // way to get there — and counting those as "places named" made the answer
  // look like a list, so the waterfall video was suppressed on the very turn
  // the guest asked for the waterfall (Andrea, live, 2026-08-23: "ti avevo
  // chiesto di mostrare il video ma non lo fai quando si chiede il
  // dettaglio"). A real list has several places each carrying the reply, not
  // one subject plus its directions.
  const namedPlaces = faqs.filter((faq) => subjectScore(faq, reply, faqs) >= LIST_PLACE_SCORE).length
  if (namedPlaces > LIST_NAMED_PLACES) return reply

  // The reply is the stronger signal: it spells the place out in full, while
  // the guest writes "si le cascatelle" and never types the second half of
  // the name. The question still counts, very slightly discounted, so that a
  // place ASKED about beats one merely mentioned in passing.
  const ranked = faqs
    .map((faq) => ({
      faq,
      score: Math.max(
        subjectScore(faq, reply, faqs),
        subjectScore(faq, userMessage, faqs) * 0.99,
      ),
    }))
    .sort((a, b) => b.score - a.score)

  const top = ranked[0]
  if (!top || top.score < SUBJECT_MIN_SCORE) return reply

  // A tie is only fatal when the rival is a real rival. "C'è lo sci di fondo?"
  // and "Cosa sono le Cascatelle?" both reduce to a single distinctive word,
  // so the question alone cannot separate them — but their ANSWERS can: the
  // waterfall entry describes the place the reply is describing, while the
  // cross-country entry never mentions it. Comparing answers is what tells a
  // homonym (`fondo`, the gravel underfoot) from the actual subject, and it
  // is the same measurement, so it stays language-independent.
  const runnerUp = ranked[1]
  if (runnerUp && top.score - runnerUp.score < SUBJECT_MIN_MARGIN) {
    const topSupport = answerOverlap(top.faq, reply, faqs)
    const rivalSupport = answerOverlap(runnerUp.faq, reply, faqs)
    // Compared as a RATIO, not a difference. A short reply covers only a
    // sliver of a long FAQ answer, so both supports are small numbers
    // (0.031 vs 0.016 for Malga Tuglia) and no absolute gap between them
    // would ever clear a fixed threshold. What matters is not how much the
    // winner covers, but that it covers decisively more than its rival.
    if (topSupport <= rivalSupport * SUPPORT_MIN_RATIO) return reply
  }

  // The winning entry must actually be NAMED in the reply. Scoring alone put
  // the Villaggio degli Gnomi's video under a list of three restaurants — it
  // won on topic overlap ("bambini", "Sappada") without being mentioned once
  // (Andrea, 2026-08-25: "villaggio gnomi qui non ha senso, non è neanche un
  // ristorante").
  //
  // Checked on the entry's own distinctive words, the same measurement used
  // for scoring, so nothing here reads phrasing or intent: at least one of
  // them has to appear verbatim in the reply the guest is about to read.
  const topTerms = distinctiveTerms(top.faq.question)
  const replyLower = reply.toLowerCase()
  const named = topTerms.some((term) => term.length >= 4 && replyLower.includes(term))
  if (!named) return reply

  const links = mediaLinksIn(top.faq.answer).filter((l) => !skip.has(l))
  if (links.length === 0) return reply
  return [reply, '', links[0]].join('\n')
}

/**
 * Whether `text` is substantially ABOUT this FAQ entry.
 *
 * Matching is on the entry's distinctive nouns — the words its question is
 * built from, minus the ones every tourism question shares. Nothing here reads
 * INTENT from phrasing (CLAUDE.md §14): it measures topic overlap, so it works
 * the same in Italian, German and English.
 */
function subjectScore(faq: FaqEntry, text: string, faqs: FaqEntry[]): number {
  const words = wordsOf(text)
  const terms = distinctiveTerms(faq.question)
  if (terms.length === 0) return 0

  // Terms are weighted by how rare they are across THIS tenant's FAQ set.
  // Weighting them equally was the bug: the Cascatelle entry is identified by
  // `cascatelle` and `arrivo`, and a detail answer that never repeats the
  // word "arrivo" scored 0.5 — the same as an unrelated entry that happened
  // to share one common word. `cascatelle` appears in one question out of 72
  // and `arrivo` in a dozen, so the name must carry the weight, and the
  // service verb almost none.
  //
  // This is plain inverse document frequency: no phrase matching, no keyword
  // list, and it behaves the same in every language (CLAUDE.md §14) —
  // a German reply naming `Cascatelle` and `Mühlbach` still lands on the
  // right entry.
  let total = 0
  let matched = 0
  for (const term of terms) {
    const weight = termWeight(term, faqs)
    total += weight
    if (words.has(term)) matched += weight
  }
  return total === 0 ? 0 : matched / total
}

/**
 * How much of the entry's ANSWER the reply actually covers.
 *
 * The tie-break of last resort: two entries whose questions score alike are
 * told apart by whether the reply talks about what the entry talks about.
 * Weighted the same way as the question, so a shared `sappada` counts for
 * almost nothing and a shared `mühlbach` counts for a lot.
 */
function answerOverlap(faq: FaqEntry, reply: string, faqs: FaqEntry[]): number {
  const words = wordsOf(reply)
  const terms = distinctiveTerms(faq.answer)
  if (terms.length === 0) return 0

  let total = 0
  let matched = 0
  for (const term of terms) {
    const weight = termWeight(term, faqs)
    total += weight
    if (words.has(term)) matched += weight
  }
  return total === 0 ? 0 : matched / total
}

/**
 * How much a term identifies ONE entry: 1 when it belongs to a single
 * question, falling towards 0 the more questions share it.
 *
 * Whole words, never substrings. `includes` scored "C'è lo sci di FONDO?" a
 * perfect 1.0 against an answer about waterfalls, because the trail
 * description said "il FONDO è ghiaioso" — same letters, opposite meaning
 * (2026-08-23).
 */
function termWeight(term: string, faqs: FaqEntry[]): number {
  let documents = 0
  for (const faq of faqs) {
    if (wordsOf(faq.question).has(term)) documents++
  }
  return documents <= 1 ? 1 : 1 / documents
}

function wordsOf(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean),
  )
}

/**
 * Words too common across this tenant's FAQ set to identify an entry: every
 * question mentions the destination, and most are shaped "what is X, how do I
 * get there". Kept in code, not settings: this is a mechanism bound, not copy
 * a customer ever reads (CLAUDE.md §1B).
 */
const GENERIC_QUESTION_WORDS = new Set([
  'sappada', 'cosa', 'come', 'dove', 'quali', 'quando', 'quanto', 'sono', 'sono?', 'posso',
  'arrivo', 'ci', 'si', 'che', 'per', 'del', 'della', 'delle', 'dei', 'con', 'una', 'uno',
  'gli', 'le', 'la', 'il', 'lo', 'un', 'and', 'the', 'what', 'where', 'how', 'there',
])

function distinctiveTerms(question: string): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !GENERIC_QUESTION_WORDS.has(w)),
    ),
  )
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
  const translated = await translateText(text, language, settings)
  if (translated !== text) welcomeTranslations.set(key, translated)
  return translated
}

/**
 * Translate a reply into the language the model itself declared.
 *
 * The model reliably KNOWS the language — it emits ⟦LANG:es⟧ correctly — and
 * then writes the answer in the workspace default anyway. Asking it more
 * firmly in the prompt did not change that (2026-08-23: a Spanish "hola qué
 * hago hoy" answered in Italian, tagged es). So the mismatch is repaired
 * afterwards, by code, instead of being hoped away.
 */
async function translateText(
  text: string,
  language: string,
  settings: Settings,
): Promise<string> {
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
    return result.content.trim() || text
  } catch {
    // A reply in the wrong language beats no reply at all.
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
 * Function words that identify a language cheaply, without an LLM call.
 *
 * Only used to answer "is this reply obviously NOT in the declared language",
 * so a wrong guess costs one translation call, never a wrong answer. Nothing
 * here routes the conversation (CLAUDE.md §14): it checks output, not intent.
 */
/**
 * The language of an opening greeting, when it is unmistakable.
 *
 * The widget sends the BROWSER's language, and a guest whose browser is in
 * English typed "Ciao" and was answered in English — the one thing that tells
 * someone nobody read what they wrote (Andrea, 2026-08-25). The prompt already
 * says to detect the language from the message; the model followed the seed
 * anyway, so the decision is taken here instead (iron rule 1).
 *
 * NOT phrase-based intent detection (CLAUDE.md §14): nothing here reads what
 * the guest WANTS. It answers one question — which language is this word — on
 * a closed list of greetings, the same job a language detector does.
 *
 * Deliberately narrow. Only words that belong to ONE language and are spelled
 * the same nowhere else: "hola" is Spanish, "ciao" is Italian, but "ok" and
 * "hi" are international and are left to the seed.
 */
const GREETING_LANGUAGES: Record<string, string> = {
  ciao: 'it', salve: 'it', buongiorno: 'it', buonasera: 'it',
  hola: 'es', buenas: 'es',
  bonjour: 'fr', salut: 'fr', bonsoir: 'fr',
  hallo: 'de', guten: 'de', servus: 'de', moin: 'de',
  hello: 'en', hey: 'en',
  ola: 'pt',
  hej: 'da',
  hoi: 'nl', goedendag: 'nl',
}

/**
 * The language of a short opening message, or null when it carries no signal.
 *
 * Only consulted for the FIRST message of a conversation, and only when it is
 * short enough to be a greeting and nothing else: a real sentence is left to
 * the model, which reads it better than a word list can.
 */
function greetingLanguage(message: string): string | null {
  const words = message
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return null

  // A greeting we recognise settles it outright.
  if (words.length <= 3) {
    for (const word of words) {
      const lang = GREETING_LANGUAGES[word]
      if (lang) return lang
    }
  }

  // Otherwise weigh the FUNCTION words of each language we serve. "ao voglio
  // fae passeggiate" is Italian written badly — no greeting in it, and the
  // guest was answered in English because the browser said so (Andrea,
  // 2026-08-25: "non è in italiano?"). Function words survive typos: the
  // misspelled nouns are ignored, "voglio" is not.
  //
  // Only when ONE language leads outright — a tie is left to the model, which
  // reads a real sentence better than a word list can. "ok" and "sports"
  // belong to no language here and keep the host's seed.
  const scores = Object.entries(OPENING_LANGUAGE_MARKERS)
    .map(([code, re]) => {
      re.lastIndex = 0
      return { code, hits: (message.match(re) || []).length }
    })
    .sort((a, b) => b.hits - a.hits)
  const [best, second] = scores
  if (best && best.hits >= 1 && best.hits > (second?.hits ?? 0)) return best.code
  return null
}

/**
 * Function words that identify the language of an OPENING message.
 *
 * Separate from LANGUAGE_MARKERS below, which answers a different question
 * ("is this reply obviously NOT in the declared language") on long text and
 * must stay tuned for that. This list is wider on purpose — pronouns, verbs
 * and prepositions a guest uses in their very first line — because here a
 * single hit has to be enough.
 */
const OPENING_LANGUAGE_MARKERS: Record<string, RegExp> = {
  it: /\b(il|la|le|gli|di|che|per|sono|siete|questo|quanto|giorno|oggi|voglio|vorrei|dove|come|quando|con|una|un|non|mi|ci|se|ho|abbiamo|siamo|stiamo|fare|posso)\b/gi,
  es: /\b(el|los|las|de|que|para|est[aá]|sois|cu[aá]nto|d[ií]a|hoy|quiero|d[oó]nde|con|una|un|no|estamos|somos|hacer|puedo)\b/gi,
  en: /\b(the|and|for|you|are|this|how|many|day|today|want|where|with|have|we|is|to|my|can|there)\b/gi,
  de: /\b(der|die|das|und|f[uü]r|sind|ihr|wie|viele|tag|heute|m[oö]chte|wo|mit|wir|haben|ist|kann)\b/gi,
  fr: /\b(le|les|des|que|pour|vous|[eê]tes|combien|jour|aujourd|veux|o[uù]|avec|nous|avons|puis)\b/gi,
  pt: /\b(os|as|de|que|para|est[aã]o|quantos|dia|hoje|quero|onde|com|temos|posso)\b/gi,
  nl: /\b(de|het|een|en|voor|zijn|hoeveel|dag|vandaag|wil|waar|met|hebben|kan)\b/gi,
  da: /\b(og|det|den|for|er|hvor|mange|dag|vil|med|har|kan)\b/gi,
}

const LANGUAGE_MARKERS: Record<string, RegExp> = {
  it: /\b(il|la|le|gli|di|che|per|sono|siete|questo|quanto|giorno|oggi)\b/gi,
  es: /\b(el|la|los|las|de|que|para|est[aá]|sois|cu[aá]nto|d[ií]a|hoy|hola)\b/gi,
  en: /\b(the|and|for|you|are|this|how|many|day|today)\b/gi,
  de: /\b(der|die|das|und|f[uü]r|sind|ihr|wie|viele|tag|heute)\b/gi,
  fr: /\b(le|la|les|des|que|pour|vous|[eê]tes|combien|jour|aujourd)\b/gi,
  pt: /\b(o|os|as|de|que|para|est[aã]o|quantos|dia|hoje)\b/gi,
  nl: /\b(de|het|een|en|voor|zijn|hoeveel|dag|vandaag)\b/gi,
  da: /\b(og|det|den|for|er|hvor|mange|dag|i dag)\b/gi,
}

function countMarkers(text: string, language: string): number {
  const re = LANGUAGE_MARKERS[language]
  if (!re) return 0
  return (text.match(re) || []).length
}

/**
 * Does the text look like it is NOT in `language`, while clearly being in
 * another one we know? Conservative: only returns true when some other
 * language scores clearly higher, so an ambiguous short reply is left alone.
 */
function looksLikeWrongLanguage(text: string, language: string): boolean {
  const words = text.split(/\s+/).length
  if (words < 8) return false // too short to judge

  const declared = countMarkers(text, language)
  let best = declared
  let bestLang = language
  for (const other of Object.keys(LANGUAGE_MARKERS)) {
    if (other === language) continue
    const score = countMarkers(text, other)
    if (score > best) {
      best = score
      bestLang = other
    }
  }
  return bestLang !== language && best >= declared + 3
}

/**
 * Did the guest actually ask something?
 *
 * A question mark, or one of the shapes a request takes without one ("dimmi
 * dove", "vorrei sapere", "quanto costa"). Used only to decide whether a
 * reply that consists of nothing but our own intake question is acceptable —
 * it never picks an answer or routes anything (CLAUDE.md §14).
 */
function guestAskedSomething(message: string): boolean {
  // The question mark, nothing else. The keyword list this replaces was
  // phrase detection on user text (§14) and misfired exactly as the rule
  // predicts: "ci sono 2 bambini" — a statement — matched "ci sono", the
  // model's prose was kept, and the guest got a list of playgrounds in the
  // middle of the intake (2026-08-25). A guest who asks without a question
  // mark gets their answer one turn later, when the intake is done — the
  // lesser failure.
  return message.includes('?')
}

/**
 * Is this reply nothing but our own intake question?
 *
 * Short, ends in a question mark, and carries no fact of its own. When the
 * guest asked something and gets this back, their question was dropped —
 * which happened the moment "one question at a time" was made strict: asked
 * the price of a cable car, the assistant replied "until when are you
 * staying?" and nothing else (Andrea, 2026-08-23).
 */
function isBareIntakeQuestion(reply: string): boolean {
  const text = reply.trim()
  if (!text.endsWith('?')) return false
  if (text.length > 180) return false
  // A reply carrying a number, a name in bold or a list is doing real work.
  if (/\d/.test(text) || /\*\*/.test(text) || /^[-•*]/m.test(text)) return false
  return true
}

/**
 * Did the intake question reach the guest WITHOUT the examples that make it
 * answerable?
 *
 * Two questions carry examples, and both collapse without them. "C'è qualcosa
 * che devo tenere presente?" gets a "no"; "siete entrambi adulti?" is a closed
 * question that takes children and seniors off the table in one move (Andrea,
 * live, 2026-08-23). The prompt now says to pronounce them, but an instruction
 * is a request — this is the check.
 *
 * Only the presence of the categories is tested, never how they are worded:
 * the model owns the phrasing and the language, and the guest may be reading
 * in any of them. A reply that names none of the alternatives is the failure;
 * one is enough to show the question was opened up.
 */
function intakeQuestionLacksExamples(reply: string, key: string | null): boolean {
  // `party` used to be checked here too: its old wording ("con chi sei in
  // vacanza") collapsed into a closed "siete entrambi adulti?" unless the
  // model pronounced the categories, so a retry forced them back in.
  //
  // The question is now "In quanti siete e fino a quando vi fermate?" — a
  // headcount and a date, open by construction, with nothing to enumerate.
  // Keeping the guard made the model append "quanti adulti, bambini e anziani"
  // to a question that never asked for them (Andrea, 2026-08-24).
  if (key !== 'constraints') return false
  const text = reply.toLowerCase()
  const groups = [
    /allerg|intoller|celiac|glutine|gluten|unverträg/,
    /auto|macchina|patente|car|coche|voiture|wagen|piedi|fuß|walk|pied/,
    /gravidanz|incinta|pregnan|embaraz|enceinte|schwanger/,
    /cammin|deambul|carrozzin|mobilit|walk|gehen|silla|fauteuil/,
    /cane|cagnolin|animal|dog|hund|perro|chien/,
  ]
  return !groups.some((re) => re.test(text))
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

/**
 * Compose the reply for a turn where an intake question is pending.
 *
 * ONE place, one order — replacing six guards that had grown on top of each
 * other and fought (Andrea, 2026-08-25: "orchestra bene, pulisci il codice,
 * non voglio accrocchi"). Each step below states what it guarantees:
 *
 *   1. our question is the one the guest reads, in their language;
 *   2. it is the ONLY question in the message;
 *   3. on a turn where the guest asked nothing, it is the WHOLE message —
 *      except the closing turn, which carries the greeting and the weather;
 *   4. the closing turn ends with the configured closing line.
 *
 * Everything the model added of its own is dropped, not merged: the code owns
 * WHICH question is asked and HOW the turn is shaped, the model owns the
 * language and the content of the recommendation (iron rule 1).
 */
interface IntakeTurnInput {
  /** The reply the model produced, already stripped of unverifiable facts. */
  reply: string
  /** The intake key dictated this turn, or null when none is pending. */
  key: string | null
  /** The configured wording, in the tenant's language. */
  question: string | null
  /** The same wording in the language the model replied in. */
  questionTranslated: string | null
  /** Did the guest ask something of their own this turn? */
  guestAsked: boolean
  /** The line that ends the intake-closing turn, when configured. */
  closingLine?: string
  /**
   * True while the intake still has questions left, even when none is due on
   * THIS turn (the guest just answered the pending one).
   *
   * The model fills that gap with a question of its own — "Ci sono altre
   * esigenze o preferenze da considerare?" one turn after the guest had
   * already answered exactly that (Andrea, 2026-08-25: "ma lo abbiamo già
   * chiesto no?"). While the code owns the questions, the model asks none.
   */
  intakeOpen?: boolean
}

interface IntakeTurnResult {
  text: string
  /** True when the question reached the guest — the caller retires it only then. */
  asked: boolean
  /** What was dropped, for the log. */
  dropped: string[]
}

/**
 * Substitute {{variables}} into the tenant's main prompt.
 *
 * A line whose ONLY content is an empty variable disappears, label and all: a
 * bare "VINCOLI:" with nothing under it invites the model to fill the gap with
 * something nobody told it. A line that also carries other text keeps it, with
 * the placeholder resolved to nothing.
 *
 * Unknown placeholders are left ALONE, never blanked: the tenant may be using
 * a variable the host substitutes ({{chatbotName}}, {{companyName}}), and
 * wiping it here would delete a value that was about to arrive.
 */
function renderPromptVariables(prompt: string, values: Record<string, string>): string {
  if (!prompt) return ''
  const known = new RegExp(`\\{\\{\\s*(${Object.keys(values).join('|')})\\s*\\}\\}`, 'gi')

  return prompt
    .split('\n')
    .filter((line) => {
      const matches = [...line.matchAll(known)]
      if (matches.length === 0) return true
      const allEmpty = matches.every((m) => !values[m[1]] && !values[m[1].toLowerCase()])
      if (!allEmpty) return true
      // Every variable on the line is empty. What is left is either a LABEL
      // for them ("VINCOLI:", "- Interessi:") — which must go with them — or a
      // real sentence that happens to mention one, which must stay.
      //
      // A label is short and ends in a colon or a dash: it introduces a value
      // that is not coming. Shape only, so it holds in every language.
      const rest = line.replace(known, '').trim()
      if (rest.length === 0) return false
      const looksLikeLabel = rest.length <= 40 && /[:\-–—]\s*$/.test(rest)
      return !looksLikeLabel
    })
    .map((line) =>
      line
        .replace(known, (_full, name: string) => values[name] ?? values[name.toLowerCase()] ?? '')
        .replace(/[ \t]{2,}/g, ' ')
        .trimEnd()
    )
    .filter((line, i, all) => line.trim() !== '' || (all[i - 1]?.trim() ?? '') !== '')
    .join('\n')
    .trim()
}

/**
 * Remove every question the MODEL wrote, keeping the one the code dictated.
 *
 * Sentence-shaped and language-independent: a sentence ending in "?" that is
 * not a URL ("…com/watch?v=" is a link, not a question). `ours`, when given,
 * is exempt — it is the question the guest is meant to answer.
 */
/**
 * Remove empty weather hedges from the MODEL's prose.
 *
 * "Se il tempo lo consente, nel pomeriggio..." — written three times in one
 * itinerary while the 7-day forecast sat in the prompt (2026-08-25: "il meteo
 * lo sai, se fai la chiamata!"). The rule in the prompt is ignored, so the
 * clause is deleted here: what remains states the plan, and the forecast the
 * model DID quote elsewhere carries the weather. Matching is on OUR output,
 * never the guest's words (§14 untouched).
 */
/**
 * Strip LISTS whose items do not exist in the approved content.
 *
 * The model served a coeliac guest a complete invented restaurant menu —
 * antipasti, primi, dolci — none of it anywhere in the FAQ block (2026-08-25:
 * "NON DEVI INVENTARE!"). Phones and prices were already verified; itemized
 * prose was not. Same principle, extended: a block of 3+ short list lines
 * whose distinctive words never appear in the approved content is fabricated,
 * and it goes.
 *
 * Shape-only detection (markers, line length, consecutiveness) plus overlap
 * against OUR approved text — never the guest's words (§14). Legit lists
 * survive because their items are QUOTED from the FAQ block: "Casunziei",
 * "Keisn Osteria" are right there in the haystack.
 */
function stripInventedLists(reply: string, approvedContent: string): { text: string; removed: string[] } {
  const haystack = approvedContent.toLowerCase()
  const lines = reply.split('\n')
  const isItem = (l: string): boolean =>
    /^\s*(?:[-•*]\s|\d+[.)]\s|\*\*[^*]{2,60}\*\*\s*:?\s*$)/.test(l) && l.trim().length <= 90
  const verified = (l: string): boolean => {
    const toks = l
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5)
    if (toks.length === 0) return true
    return toks.some((t) => haystack.includes(t))
  }
  const removed: string[] = []
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (!isItem(lines[i])) {
      out.push(lines[i])
      i++
      continue
    }
    // Collect a consecutive item block (blank lines allowed inside).
    const block: number[] = []
    let j = i
    while (j < lines.length && (isItem(lines[j]) || lines[j].trim() === '')) {
      if (isItem(lines[j])) block.push(j)
      j++
    }
    const unverified = block.filter((k) => !verified(lines[k]))
    if (block.length >= 3 && unverified.length * 3 >= block.length * 2) {
      // Fabricated block: drop it, and the intro line ending in ':' above it.
      if (out.length > 0 && /:\s*$/.test(out[out.length - 1])) removed.push(out.pop() as string)
      for (const k of block) removed.push(lines[k])
    } else {
      for (let k = i; k < j; k++) out.push(lines[k])
    }
    i = j
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), removed }
}

function stripWeatherHedges(reply: string): string {
  const HEDGES =
    /(?:se|si|if|wenn|falls)\s+(?:il\s+tempo|el\s+tiempo|le\s+temps|the\s+weather|das\s+wetter|het\s+weer|vejret)\s+(?:lo\s+(?:consente|permette|regge)|(?:è|es|est|is|ist)\s+(?:buono|bello|clemente|bueno|beau|good|nice|gut|goed|godt)|(?:lo\s+)?permite|le\s+permet|permitting|es\s+zul[aä]sst|zulässt|tillader)[,]?\s*/gi
  let out = reply.replace(HEDGES, '')
  out = out.replace(/(^|[.!?]\s+)([a-zàèéìòù])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
  return out.replace(/[ \t]{2,}/g, ' ')
}

function stripModelQuestions(reply: string, ours: string | null, dropped: string[]): string {
  const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const keep = ours ? normalise(ours) : null
  return reply
    .split('\n')
    .map((line) => {
      if (!line.includes('?') || /https?:\/\//.test(line)) return line
      return (line.match(/[^.!?]+[.!?]*/g) ?? [line])
        .filter((sentence) => {
          if (!sentence.trim().endsWith('?')) return true
          if (keep && normalise(sentence).includes(keep)) return true
          dropped.push(sentence.trim())
          return false
        })
        .join('')
        .replace(/\s{2,}/g, ' ')
        .trim()
    })
    .filter((line, i, all) => line.trim() !== '' || (all[i - 1]?.trim() ?? '') !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function composeIntakeTurn(input: IntakeTurnInput): IntakeTurnResult {
  const { reply, key, question, guestAsked, closingLine, intakeOpen } = input
  const ask = (input.questionTranslated ?? question ?? '').trim()
  const dropped: string[] = []

  // No question due this turn. With the intake still running the model must
  // not invent one of its own, so its questions are stripped and nothing is
  // put in their place; once the intake is over it converses freely again.
  if (!key || !ask) {
    if (!intakeOpen) return { text: reply, asked: false, dropped: [] }
    return { text: stripModelQuestions(reply, null, dropped), asked: false, dropped }
  }

  const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

  // The closing turn is the only one that keeps the model's prose: it carries
  // the greeting by name, the weather and one suggestion before the question.
  const isClosingTurn = key === 'itinerary'

  // Step 3 — a turn where the guest asked nothing IS the question, nothing else.
  if (!guestAsked && !isClosingTurn) {
    if (normalise(reply) !== normalise(ask)) dropped.push(reply.trim())
    return { text: ask, asked: true, dropped }
  }

  // Step 1+2 — keep the model's answer, strip every question it invented, and
  // make sure ours is there exactly once, at the end.
  const withoutQuestions = stripModelQuestions(reply, ask, dropped)

  const alreadyThere = normalise(withoutQuestions).includes(normalise(ask))
  const body = alreadyThere
    ? withoutQuestions
    : [withoutQuestions, ask].filter((p) => p.length > 0).join('\n\n')

  // Step 4 — the closing turn signs off with the configured line.
  const closing = closingLine?.trim()
  if (isClosingTurn && closing && !normalise(body).endsWith(normalise(closing))) {
    return { text: `${body}\n\n${closing}`, asked: true, dropped }
  }

  return { text: body, asked: true, dropped }
}

async function withWelcome(
  reply: string,
  welcomeText: string | undefined,
  videoUrl: string | undefined,
  language: string | undefined,
  settings: Settings,
  customerName: string | undefined,
  /**
   * The intake question due on this turn, already in the guest's language.
   *
   * The welcome may place it with {{firstQuestion}}, so the whole opening
   * message — greeting, video, first question — is edited in ONE field in the
   * backoffice (Andrea, 2026-08-25). It is still the machine that decides
   * WHICH question that is, so it stays tracked as asked; the tenant only
   * decides where it sits.
   */
  firstQuestion?: string,
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
  const translated =
    lang === sourceLang ? welcome : await translateWelcome(welcome, lang, settings)

  // {{firstQuestion}} — the tenant decides WHERE the opening question sits;
  // the intake machine decides WHICH one it is. With no question due (a
  // returning guest whose profile is complete) the placeholder collapses,
  // taking its blank line with it rather than leaving a hole.
  const QUESTION_SLOT = /\n?[ \t]*\{\{\s*firstQuestion\s*\}\}[ \t]*/gi
  const hasSlot = QUESTION_SLOT.test(translated)
  QUESTION_SLOT.lastIndex = 0
  const greeting = hasSlot
    ? translated.replace(QUESTION_SLOT, firstQuestion?.trim() ? `\n${firstQuestion.trim()}` : '')
    : translated

  const parts = [greeting]
  const video = videoUrl?.trim()
  if (video && !reply.includes(video)) {
    parts.push('', VIDEO_INTRO[lang] ?? VIDEO_INTRO.it, video)
  }
  parts.push('', body)
  return parts.join('\n')
}

/**
 * Days after departure before the finished stay is archived.
 *
 * Three, not zero: the days right after leaving are when the goodbye happens
 * — the feedback, the consent, the "we left a jacket at the rifugio". Wiping
 * the stay there would take the conversation's subject away mid-sentence.
 *
 * After that the holiday is closed: the profile is archived, the itinerary
 * and what-they-did are cleared, and the guest goes back to being a contact.
 * When they write again — next week or next February — the assistant starts
 * a fresh stay and asks the dates anew, which is exactly the service being
 * offered to them a second time.
 */
const ARCHIVE_STAY_AFTER_DEPARTURE_DAYS = 3

/**
 * Has this guest come back for a fresh holiday?
 *
 * Detected from the calendar, never asked: a returning guest does not
 * announce a new stay, they just say hello. Without this the profile stays
 * frozen on last summer — the assistant keeps insisting the holiday is over,
 * never asks the new dates, and refuses to propose the Cascatelle because
 * they were done in August (Andrea, 2026-08-23).
 */
function isStayOverAndClosed(profile: StayProfile | null, now: Date): boolean {
  const departure = profile?.departureDate
  if (!departure) return false
  const departureMs = Date.parse(`${departure}T23:59:59`)
  if (Number.isNaN(departureMs)) return false
  const daysSince = (now.getTime() - departureMs) / 86_400_000
  return daysSince > ARCHIVE_STAY_AFTER_DEPARTURE_DAYS
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
      // What they thought of it is the most valuable thing the stay produced:
      // it is what makes the next welcome-back worth reading.
      feedback: profile.lastFeedback,
    })
  }

  return {
    // Facts that outlive a single holiday: who they are and where they come
    // from do not change between one August and the next.
    adults: profile.adults,
    children: profile.children,
    childrenAges: profile.childrenAges,
    seniors: profile.seniors,
    origin: profile.origin,
    consentAsked: profile.consentAsked,
    // Told once, remembered for good: a returning guest already knows how to
    // opt out, and hearing it again on a new holiday reads like nagging.
    pushOptOutHintSent: profile.pushOptOutHintSent,
    // Written by a person at the Pro Loco, never by this module. Wiping it
    // would delete someone else's work.
    operatorNotes: profile.operatorNotes,
    // The bot's own card goes with the holiday it described: "coppia senza
    // auto, la moglie è celiaca, 22-26 agosto" is about a stay that is over,
    // and carrying it into the next one filters a holiday nobody has
    // described yet (contratto.md: "cancelliamo le note e itinerario").
    //
    // Cleared HERE, at the rollover, not when the guest accepts the renewal:
    // the renewal is asked on the last day, while they are still in Sappada
    // and can still write — wiping the card then would strip their coeliac
    // and their lack of a car mid-conversation (conflitto sciolto con Andrea,
    // opzione C, 2026-08-25).
    notes: undefined,
    // Kept in history, cleared from the live stay.
    pastStays: history.slice(-5),
    // Everything below is deliberately absent: a new holiday, asked afresh.
    arrivalDate: undefined,
    departureDate: undefined,
    doneAlready: undefined,
    itinerary: undefined,
    // The plan belonged to the days that are over. Left behind it would be
    // presented as "il vostro programma" on the first turn of a holiday whose
    // dates we do not even know yet.
    itineraryPlan: undefined,
    // Both are about THIS trip: what limited them last winter (a plaster cast,
    // a pregnancy) and what they felt like doing then are not facts about the
    // person, and carrying them over silently filters a holiday they have not
    // described yet. Asked again, like the dates.
    constraints: undefined,
    interests: undefined,
    asked: [],
    // Consumed: the restart it asked for has just happened.
    restartRequested: undefined,
    feedbackGiven: undefined,
    lastFeedback: undefined,
    // videoSent is NOT cleared: they have seen the presentation once, and a
    // returning guest does not need to be introduced to Sappada again.
    videoSent: profile.videoSent,
  }
}

/**
 * Days of holiday left, or null when we do not know the departure.
 * Zero or negative means today is the last day (or it is already over).
 */
function daysLeftInStay(profile: StayProfile | null, now: Date): number | null {
  const departure = profile?.departureDate
  if (!departure) return null
  const departureMs = Date.parse(`${departure}T23:59:59`)
  if (Number.isNaN(departureMs)) return null
  return Math.ceil((departureMs - now.getTime()) / 86_400_000)
}

/**
 * Render the stay for the model, with the days remaining computed HERE.
 *
 * The count is derived from `departureDate` on every turn, never stored:
 * "3 giorni" written down on Monday is wrong by Wednesday, and the whole
 * point of knowing the stay is to concentrate the suggestions into the time
 * that is actually left.
 */
/**
 * What formatStayBlock produced: the prompt text, and WHICH intake question it
 * put in front of the model.
 *
 * The key used to be a module-level `let` that the function assigned as a side
 * effect. Two turns being served at once on the same dyno shared it, so one
 * guest's pending question leaked into another's turn — and any turn that
 * returned early left the previous value standing (CLAUDE.md §10: no shared
 * state across conversations).
 */
/**
 * The intake steps, in the order they are put to the guest.
 *
 * A union rather than free strings: the key ties together the settings entry
 * that supplies the wording, the `asked` marker that retires it, and the
 * save_preferences enum — a typo in any one of them would otherwise make a question
 * repeat forever or vanish silently.
 */
export type IntakeKey =
  | 'location'
  | 'remoteNeeds'
  | 'party'
  | 'headcount'
  | 'stay'
  | 'composition'
  | 'childrenAges'
  | 'constraints'
  | 'interests'
  | 'itinerary'
  | 'consent'
  | 'name'

export interface StayBlock {
  text: string
  askedKey: string | null
  /** Every intake key shown this turn. All of them get marked as asked. */
  askedKeys: string[]
  /**
   * The configured wording dictated this turn. Carried out so the
   * one-question guard can tell OUR question — which may legitimately span
   * several sentences — from questions the model added on its own.
   */
  askedQuestion: string | null
}

/**
 * The exact sentence to put to the guest for this intake step.
 *
 * Resolution order, CLAUDE.md §1A: the workspace's own text (edited in the
 * backoffice and merged into settings by the host) → this module's
 * settings.json default → `null`, meaning nothing is asked at all.
 *
 * `null` is a real answer, not a failure to paper over: a question nobody
 * configured is better skipped than improvised by the model or sent in the
 * wrong language.
 */
function intakeQuestionFor(key: IntakeKey, settings: Settings): string | null {
  const configured = settings.intakeQuestions?.[key]
  return configured?.trim() ? configured.trim() : null
}

export function formatStayBlock(
  profile: StayProfile | null,
  now: Date,
  returningGuest = false,
  /**
   * The guest's name, when the host already knows it (widget registration
   * form) or the `remember` tool has captured it. Passed in so the intake can
   * skip a question we already have the answer to — on WhatsApp there is no
   * form, and without asking, the assistant never learns it at all.
   */
  knownName?: string,
  /** Carries `intakeQuestions` — the wording this block dictates. */
  settings: Settings = DEFAULT_SETTINGS,
): StayBlock {
  // A guest with no saved profile is precisely the one everything still has to
  // be asked of. Returning early here meant the FIRST message — the only turn
  // where the intake has not started at all — got no question and no key: the
  // model improvised a seven-day plan for two people it knew nothing about,
  // and the single-question guard stayed off because there was no pending key
  // to guard (Andrea, live, 2026-08-23).
  const stay: StayProfile = profile ?? ({} as StayProfile)

  const lines: string[] = []

  if (returningGuest && profile) {
    const last = stay.pastStays?.[stay.pastStays.length - 1]
    lines.push(
      'È TORNATO — nuova vacanza. Salutalo come si saluta chi si rivede, non come uno sconosciuto:',
      last?.doneAlready
        ? `  la volta scorsa aveva fatto: ${last.doneAlready}. Ricordaglielo con piacere, e proponigli ` +
          'qualcosa di nuovo oppure la stessa cosa in un\'altra stagione (le Cascatelle d\'inverno sono ' +
          'un\'altra cosa).'
        : '  non sappiamo cosa avesse fatto la volta scorsa.',
      // The archived feedback is the sharpest thing we hold about a returning
      // guest: it says what to steer AWAY from, which `doneAlready` alone
      // never does.
      ...(last?.feedback
        ? [
            `  alla fine ci aveva detto: ${last.feedback}. Che gli sia piaciuto o no, orienta le ` +
              'proposte di quest\'anno di conseguenza.',
          ]
        : []),
      '  Le date di questa vacanza NON le sai ancora: chiediglielo.',
    )
  }
  const party: string[] = []
  if (stay.adults) party.push(`${stay.adults} adulti`)
  if (stay.children) {
    party.push(
      stay.childrenAges
        ? `${stay.children} bambini (${stay.childrenAges})`
        : `${stay.children} bambini`,
    )
  }
  if (stay.seniors) party.push(`${stay.seniors} anziani`)
  if (party.length > 0) lines.push(`In vacanza: ${party.join(', ')}`)
  if (stay.origin) lines.push(`Arrivano da: ${stay.origin}`)
  if (stay.presence === 'remote') {
    lines.push(
      '🚨 NON È A SAPPADA e non ha una vacanza in programma: è un contatto che scrive da casa. ' +
        'NIENTE domande sul soggiorno (quanti siete, cosa vi piace, fino a quando…): aiutalo su ' +
        'alloggi, eventi e informazioni con i fatti delle schede. Se dice che verrà o che sta ' +
        "programmando una vacanza, salva SUBITO save_preferences presence='planned' (o 'in_loco' " +
        'se è appena arrivato): da lì riparte il flusso normale.',
    )
  } else if (stay.presence === 'planned') {
    lines.push(
      'HA UNA VACANZA IN PROGRAMMA ma non è ancora a Sappada: trattalo come un ospite futuro — ' +
        "date, con chi viene e interessi valgono per quando arriverà, e l'itinerario glielo puoi " +
        'proporre per quelle date. Quando ti dice che è arrivato, salva ' +
        "save_preferences presence='in_loco'.",
    )
  }
  if (stay.interests) {
    lines.push(
      `🚨 GLI INTERESSA: ${stay.interests}. Te l'hanno detto loro, rispondendo a una domanda ` +
        'esplicita: il PRIMO consiglio che dai deve essere di questo tipo. Un guest che ha ' +
        'risposto "sport" e si è sentito proporre il museo ha capito che la domanda era finta ' +
        '(Andrea, 2026-08-25). Se il meteo o un vincolo rendono impraticabile quello che vogliono, ' +
        'dillo e proponi la cosa più vicina — non cambiare argomento in silenzio. Il resto lo ' +
        'proponi dopo, se serve.',
    )
  }

  if (stay.constraints) {
    lines.push(
      `⚠️ DA TENERE PRESENTE SEMPRE: ${stay.constraints}. Filtra OGNI proposta su questo, senza ` +
        'ricordarglielo ogni volta: se non puoi rispettarlo, dillo apertamente e proponi altro.',
    )
  }
  if (stay.arrivalDate) {
    const arrivalDay = new Date(`${stay.arrivalDate}T12:00:00`)
    const arrivalLabel = Number.isNaN(arrivalDay.getTime())
      ? stay.arrivalDate
      : arrivalDay.toLocaleDateString('it-IT', {
          timeZone: TIMEZONE,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
    lines.push(`Arrivo: ${stay.arrivalDate} (${arrivalLabel})`)
  }

  if (stay.departureDate) {
    const departure = Date.parse(`${stay.departureDate}T23:59:59`)
    if (!Number.isNaN(departure)) {
      // Counted between CALENDAR DAYS in Sappada, not from a millisecond
      // difference: `T23:59:59` is parsed in the host's zone, so on a UTC dyno
      // the small hours of a Rome day still belonged to the previous one and
      // the count came out a day short (Andrea, live, 2026-08-23).
      //
      // DAYS OF PRESENCE, not nights: a guest who says "restiamo 5 giorni" is
      // counting the days they are here, arrival day included — so the day of
      // departure itself is 1, not 0 (Andrea's call, 2026-08-23). The +1 is
      // what turns a calendar gap into that count.
      const todayInSappada = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
      const daysLeft =
        Math.round(
          (Date.parse(`${stay.departureDate}T12:00:00Z`) -
            Date.parse(`${todayInSappada}T12:00:00Z`)) /
            86_400_000,
        ) + 1
      // With the weekday spelled out: the model said "giovedì 2 settembre"
    // about a date it had just saved as the 3rd — the day of the week is
    // arithmetic, and arithmetic is not what a language model is for
    // (Andrea, 2026-08-23).
    const departureDay = new Date(`${stay.departureDate}T12:00:00`)
    const departureLabel = Number.isNaN(departureDay.getTime())
      ? stay.departureDate
      : departureDay.toLocaleDateString('it-IT', {
          timeZone: TIMEZONE,
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
    lines.push(
      `Partenza: ${stay.departureDate} (${departureLabel}) — usa QUESTO giorno della settimana, non calcolarlo tu`,
    )
      if (daysLeft > 1) {
        lines.push(
          `GIORNI RIMANENTI: ${daysLeft}. Concentra i consigli in questo tempo: proponi prima le cose ` +
            `che non vorresti si perdessero.`,
        )
      } else if (daysLeft === 1) {
        lines.push(
          'OGGI È IL GIORNO DELLA PARTENZA. Proponi solo cose che stanno in una mattinata, e chiedi come ' +
            'è andata la vacanza (cosa è piaciuto e cosa no) e salvala con save_feedback, poi salutali ' +
            'dicendo che li aspettiamo di nuovo.',
        )
      } else if (daysLeft <= 0) {
        // Not an ending: the guest can write whenever they like, and often
        // does (a phone left behind, a recipe, a question about next year).
        // What changes is the JOB — from planning their days to closing the
        // relationship well and keeping it open (Andrea, 2026-08-23).
        lines.push(
          'LA VACANZA È FINITA (o finisce oggi). Non proporre più attività da fare qui: non sono più in ' +
            'zona. Continua però a rispondere normalmente a qualsiasi cosa ti chiedano.',
          'In questo momento hai tre cose da fare, una per messaggio, senza affollarle:',
          '  1. Chiedi come è andata — cosa è piaciuto e cosa no — e salva con save_feedback.',
          '  2. Il consenso che avevano dato valeva SOLO per la permanenza, che ora è finita. Chiedi se ' +
            'vogliono RINNOVARLO per la prossima volta: ' +
            'gli eventi dell\'anno (il Carnevale, le feste d\'estate) e le offerte di alloggio. ' +
            'SOLO QUESTE DUE: fuori stagione le promozioni generiche del territorio non servono a chi ' +
            'non è qui, e un rinnovo più leggero si ottiene molto più facilmente. Chiedi su quale ' +
            'delle due, o entrambe, e registra con save_push_consent indicando SOLO i topics che ' +
            'hanno nominato — mai `offers` in questo momento. Ricorda anche qui, in una riga, che ' +
            'possono farli smettere quando vogliono, basta che ce lo dicano. ' +
            'Chiederlo ADESSO ha senso: hanno appena vissuto il posto, e un sì dato ora vale più di uno ' +
            'dato all\'arrivo.',
          '  3. Salutali dicendo che li aspettiamo di nuovo, con calore, come si saluta un ospite sulla porta.',
          stay.feedbackGiven
            ? '  ⚠️ IL FEEDBACK È GIÀ STATO DATO: non richiederlo, passa direttamente al punto 2 e 3.'
            : '  Il feedback non è ancora stato raccolto.',
        )
      }
    }
  }

  if (stay.operatorNotes) {
    lines.push(
      `NOTA DELLA PRO LOCO su questo ospite: ${stay.operatorNotes}. Tienine conto, ma non citarla ` +
        'mai apertamente: è scritta per noi, non per lui.',
    )
  }

  lines.push(
    'Se il cliente CORREGGE o AGGIORNA uno di questi dati — partono prima, si è aggiunta una persona, ' +
      'cambia l\'alloggio — richiama subito save_preferences con il valore NUOVO: sovrascrive quello vecchio, ' +
      'e da lì in poi i giorni rimanenti e i consigli si ricalcolano da soli.',
  )

  // The card the Pro Loco reads. Shown back to the model so it rewrites the
  // paragraph it already wrote instead of starting a new one each time.
  if (stay.notes) {
    lines.push(`SCHEDA (come l'hai scritta finora): ${stay.notes}`)
  }
  lines.push(
    'OGNI VOLTA che impari qualcosa di nuovo su di loro, insieme al campo giusto risalva anche `notes` ' +
      'con save_preferences: è la scheda che legge la Pro Loco, tutta la vacanza in un paragrafo — chi sono, ' +
      'quando ci sono, da dove vengono, cosa li limita, cosa gli piace, cosa hanno già fatto. ' +
      'Riscrivila INTERA ogni volta, non aggiungere righe in fondo. Non è un messaggio per il cliente: ' +
      'non parlargliene mai.',
  )

  if (stay.doneAlready) {
    lines.push(
      `GIÀ FATTO (non riproporlo, semmai costruiscici sopra): ${stay.doneAlready}`,
      // Not proposing it again is half the job. The other half is READING the
      // reaction: a walk that was too tiring rules out the other long ones,
      // a disappointing dinner means suggest a different kind of place, and
      // something they loved is the direction to go further in (Andrea,
      // 2026-08-23). This is what makes the next proposal follow from the
      // last one instead of restarting from a generic list.
      'Se accanto a una di queste cose c\'è come è andata, USALA per scegliere la prossima: se una ' +
        'non è piaciuta NON proporne una simile, cambia genere; se una è piaciuta molto, vai in ' +
        'quella direzione. Non commentare il fatto che te lo ricordi, usalo e basta.',
    )
  }

  // What they told us at the end of a PREVIOUS holiday. Saved and archived
  // since the beginning, but never shown to the model, so it changed nothing
  // (live check, 2026-08-23).
  if (stay.lastFeedback) {
    lines.push(
      `COSA CI AVEVA DETTO L'ULTIMA VOLTA: ${stay.lastFeedback}. Tienine conto in ogni proposta.`,
    )
  }

  // What is still open, and what must never be asked again. Computed here so
  // the model is told plainly instead of inferring it from absence — absence
  // is exactly what it gets wrong, re-asking a question the guest ignored.
  const asked = new Set(stay.asked ?? [])

  // WHICH question comes next is decided by the intake machine — one
  // declarative table, in intake-machine.ts, that is also consulted after the
  // model saves the guest's answer. Two callers, one authority: that is what
  // stops the queue and the guards from disagreeing (Andrea, 2026-08-25).
  const intakeCtx: IntakeContext = { profile: stay, asked, knownName }
  const nextStep = nextIntakeStep(intakeCtx)

  const askedKey = nextStep?.key ?? null
  // Only the key actually put to the guest is marked as asked.
  //
  // `party` used to retire `stay` with it, back when one question stood for
  // both. Now `stay` is its own step, asked when the guest answers only half
  // ("siamo due adulti") — and retiring it here meant it was gone before it
  // could ever be asked, so nobody learned the dates (2026-08-25).
  const askedKeys = askedKey ? [askedKey] : []

  // The question is DICTATED, not described.
  //
  // This block used to explain each question to the model and let it compose
  // the sentence ("with whom — NAME THE THREE CATEGORIES…"). Describing invites
  // composing, and composing is how three questions ended up in one numbered
  // list on a first turn (Andrea, live, 2026-08-24: "una alla volta le
  // domande"). The same lesson custom-demorobot learned: the code owns WHICH
  // question and its WORDING, the model owns only the language it is said in.
  const question = askedKey ? intakeQuestionFor(askedKey as IntakeKey, settings) : null

  if (askedKey && question) {
    lines.push(
      '🚨 RISPONDI SEMPRE PRIMA A QUELLO CHE TI HA CHIESTO. Se il cliente ha fatto una domanda — un',
      'prezzo, un orario, un consiglio, qualsiasi cosa — quella ha la precedenza assoluta: rispondi',
      'davvero, con i fatti che hai, e SOLO DOPO aggiungi la domanda qui sotto.',
      '',
      '## LA DOMANDA DA FARE ADESSO',
      '',
      'Questa istruzione ha la precedenza su qualsiasi altra cosa tu possa dedurre dalla',
      'conversazione. Fai QUESTA domanda, alla lettera, tradotta nella lingua del cliente:',
      '',
      question,
      '',
      // The sentence demorobot has and demosappada did not: the question IS
      // the reply, not something appended to one. Without it the model wrote
      // three museums with addresses, an offer of more detail and a link, and
      // put the question at the bottom (Andrea, 2026-08-25: "devono essere
      // domande secche una dopo l'altra").
      ...(askedKey === 'itinerary'
        ? []
        : [
            'MANDALA COME RISPOSTA INTERA. Se il cliente non ti ha chiesto niente, il tuo messaggio',
            'è SOLO questa domanda: niente consigli, niente elenchi di posti, niente link, niente',
            'meteo, niente offerte di ulteriori dettagli, nemmeno mezza riga di introduzione.',
          ]),
      'Se invece il cliente TI HA CHIESTO qualcosa, rispondi prima a lui — davvero, con i fatti',
      'che hai — e la domanda va in coda, da sola.',
      'NON aggiungere altre domande. NON elencarne altre. NON anticipare le prossime.',
      'NON riformularla e non aggiungere spiegazioni sul perché la fai: dilla e basta.',
      'NON toccare il campo `asked` di save_preferences: lo registra il sistema.',
    )

    // The branch question needs its reading key: the answer decides which of
    // the three flows this guest gets, and the model is the one reading the
    // nuance (contratto.md, 2026-08-27: "devi essere intelligente... in tutti
    // i casi il sistema deve rispondere bene").
    if (askedKey === 'location') {
      lines.push(
        '',
        'La risposta ti dice DOVE si trova, e va salvata SUBITO con save_preferences:',
        "- è già a Sappada («sì», «siamo qui», «arrivati ieri») → presence='in_loco'",
        "- la vacanza è decisa ma non è ancora qui («veniamo il prossimo mese», «arriviamo sabato») → presence='planned', e salva anche le date che nomina",
        "- non è qui e non ha piani («no», «cerco solo informazioni») → presence='remote'",
        'Se la risposta non chiarisce nulla, non salvare niente: la domanda resta aperta.',
      )
    }

    // The turn that closes the intake. Every question has been answered, the
    // guest has just given their name, and this is the first message where the
    // assistant has the whole picture — so it is the one that must READ like
    // it (Andrea, 2026-08-24: "Ciao [nome] oggi il meteo a Sappada è...").
    //
    // Shaped here rather than left to the model: without it the plan question
    // arrives bare, on the turn where using their name for the first time is
    // worth the most. The CONTENT stays the model's — the weather is whatever
    // get_weather returned, the suggestion whatever fits their card.
    if (askedKey === 'itinerary') {
      lines.push(
        '',
        '## COME SI APRE QUESTO MESSAGGIO',
        '',
        'È il messaggio che chiude le domande: hai tutte le risposte e sai come si chiama.',
        'Scrivilo in QUEST\'ORDINE, quattro pezzi e nient\'altro:',
        // The name is NOT interpolated here: on the very turn the guest gives
        // it, `remember` writes it to state AFTER this prompt was built, so
        // it would still be empty. The model has the name in front of it — it
        // is the message it is answering — so it is told to use it.
        '1. "Perfetto <NOME>," — chiamalo per nome, con il nome che ti ha appena detto.',
        '2. Com\'è il meteo a Sappada (il dato VERO da get_weather, mai stimato).',
        '3. UN consiglio solo, coerente con quel meteo e con la sua scheda.',
        '4. La domanda qui sopra, alla lettera, da sola in fondo.',
        ...(settings.closingLine?.trim()
          ? [`5. E per chiudere, esattamente questa riga: "${settings.closingLine.trim()}"`]
          : []),
        'Niente elenchi numerati di posti, niente riepilogo di quello che ti ha detto,',
        'niente altre domande, e NON offrire nulla che non ti abbia chiesto.',
      )
    }
  } else if (askedKey && !question) {
    // Configuration says nothing for this key, so nothing is asked. Silence
    // beats an English sentence sent to a guest writing in Italian, and beats
    // the model improvising a question of its own (CLAUDE.md §1A).
    // eslint-disable-next-line no-console
    console.error(`[demosappada][intake] no question configured for "${askedKey}" — skipped`)
    lines.push('NON FARE DOMANDE sul suo soggiorno in questo messaggio.')
  } else {
    lines.push('NON CHIEDERE PIÙ NULLA sul suo soggiorno: sai già tutto quello che serve.')
  }

  if (asked.size > 0 || stay.consentAsked || stay.itinerary) {
    // The key being dictated THIS turn must not also sit in the "never ask
    // again" list — since the second intake pass (intake-machine.ts) a
    // still-unanswered question CAN be dictated a second time, and listing
    // it here as forbidden would have the prompt contradict itself.
    const done = [
      ...Array.from(asked).filter((k) => k !== askedKey),
      ...(stay.consentAsked ? ['consent'] : []),
      ...(stay.itinerary ? ['itinerary'] : []),
    ]
    lines.push(
      `GIÀ CHIESTO (non richiederlo MAI più, nemmeno se non ha risposto): ${done.join(', ')}`,
    )
  }

  if (stay.consentAsked) {
    lines.push(
      'Il consenso per la permanenza è già stato chiesto. Non richiederlo ora: si torna sul tema SOLO ' +
        'alla partenza, e lì riguarda il rinnovo per la prossima volta (eventi dell\'anno e alloggi).',
    )
  }

  // The switch, always live. Not tied to consentAsked: someone can ask to be
  // left alone before anyone has asked them anything, and the request must be
  // honoured the moment it is made.
  lines.push(
    'SE IN QUALSIASI MOMENTO ti dicono che non vogliono più ricevere messaggi — anche solo "basta ' +
      'notifiche", "non scriveteci più" — chiama SUBITO save_push_consent con granted=false, ' +
      'confermaglielo in una riga e non tornarci sopra. Se invece chiedono di ricevere di nuovo ' +
      'qualcosa, chiama save_push_consent con granted=true e SOLO i topics che hanno nominato ' +
      '(eventi, alloggi, offerte del territorio). Non chiedere loro di scrivere UNSUBSCRIBE: ' +
      'basta che te lo dicano a parole.',
  )

  if (stay.itineraryPlan) {
    lines.push(
      'PROGRAMMA CONCORDATO (è il vostro piano: portalo avanti, non ricominciare da capo):',
      ...stay.itineraryPlan.split('\n').map((line) => `  ${line}`),
      'Quando qualcosa cambia — meteo, una cosa già fatta, una partenza anticipata — aggiorna SOLO i ' +
        'giorni interessati e risalvalo INTERO con save_itinerary.',
      // Asking during the stay, not only at the end: the answer is what feeds
      // `doneAlready`, and `doneAlready` is what stops the same excursion
      // being proposed twice. Left to the end of the holiday it arrives too
      // late to be useful to THIS guest (Andrea, 2026-08-23).
      'Se il programma prevedeva qualcosa per IERI o per OGGI e non sai ancora com\'è andata, chiedilo ' +
        'in una riga, con naturalezza, in coda alla tua risposta: sapere se ci sono stati e se è ' +
        'piaciuto è quello che ti evita di riproporglielo. Quello che ti dicono va salvato subito con ' +
        'save_preferences in `doneAlready`. Non insistere se non rispondono.',
    )
  }

  if (stay.itinerary === 'no') {
    lines.push('Ha detto che NON vuole un programma: rispondi solo alle sue domande, non pianificare.')
  } else if (stay.itinerary === 'yes') {
    lines.push('Vuole il programma: sei il suo pianificatore, porta avanti il piano.')
  }

  if (lines.length === 0) return { text: '', askedKey, askedKeys, askedQuestion: question }
  return { text: ['', '═══ QUESTO OSPITE ═══', ...lines].join('\n'), askedKey, askedKeys, askedQuestion: question }
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
/**
 * The words the guest was promised: writing one revokes the consent.
 *
 * This is NOT phrase-based intent detection (CLAUDE.md §14) — nothing here
 * guesses what the guest meant. These are COMMAND WORDS we ourselves published
 * to them when they opted in, in the same class as the numeric selection the
 * rule explicitly allows. Recognising them is honouring a promise, and the
 * GDPR right to withdraw cannot depend on the model noticing.
 *
 * They come from settings, NOT from a literal here: the tenant's own
 * `pushOptOutHint` is what promises them, and a promise the code does not
 * honour is worse than no promise at all. Before this, the hint said "scrivi
 * NO PUSH" while the module only ever matched "unsubscribe" (Andrea,
 * 2026-08-24). With nothing configured nothing is recognised — the tenant has
 * promised nothing either.
 *
 * Matched alone on the line, in any case, with optional trailing punctuation
 * and internal spacing normalised ("no  push." revokes): a sentence that
 * merely CONTAINS the words ("cosa vuol dire unsubscribe?") is a question,
 * not a revocation.
 */
function isUnsubscribeCommand(message: string, settings: Settings): boolean {
  const commands = settings.pushOptOutCommands ?? []
  const normalised = message.trim().replace(/[\s.!]+$/, '').replace(/\s+/g, ' ').toLowerCase()
  if (!normalised) return false
  return commands.some((cmd) => {
    const candidate = cmd.trim().replace(/\s+/g, ' ').toLowerCase()
    return candidate.length > 0 && candidate === normalised
  })
}

/**
 * Which season the guest is actually in, for the RUNTIME block.
 *
 * Sappada is a two-season destination and the FAQ block describes both at
 * once: proposing a chairlift in November or a snowshoe walk in July is the
 * failure this prevents. Months, not equinoxes — what matters is whether the
 * lifts and the trails are open, and the shoulder months are named as such so
 * the model hedges instead of promising.
 */
function seasonOf(now: Date): string {
  const month = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, month: 'numeric' }).format(now),
  )
  if (month === 12 || month <= 2) return 'inverno (neve, impianti, ciaspole)'
  if (month >= 6 && month <= 9) return 'estate (escursioni, malghe, rifugi aperti)'
  if (month >= 3 && month <= 5) return 'primavera — stagione di mezzo: impianti chiusi, quota alta ancora innevata, verifica sempre'
  return 'autunno — stagione di mezzo: impianti chiusi, molti rifugi chiusi, verifica sempre'
}

/**
 * Renewed consent for the NEXT holiday, given on the way home.
 *
 * The counterpart of INLOCO: that one says "is here now" and is kept in sync
 * from the dates; this one says "wants to hear from us before coming back",
 * and is set only when the guest says yes to the renewal (contratto.md).
 */
const TAG_NOT_IN_LOCO = 'NO-INLOCO'
/**
 * A prospect writing from home, with no stay at all (contratto.md,
 * 2026-08-27). Deliberately NOT `NO-INLOCO`: that one records a CONSENT (the
 * renewal for the next holiday) and reusing it here would drop people who
 * never agreed to anything into a consented campaign segment. This tag only
 * says who they are; any push to them still needs its own consent.
 */
const TAG_REMOTE_PROSPECT = 'NO-A-SAPPADA'
const TAG_INTEREST_EVENTS = 'INTERESSE-EVENTI'
const TAG_INTEREST_LODGING = 'INTERESSE-ALLOGGI'
const TAG_INTEREST_OFFERS = 'INTERESSE-OFFERTE'

// isCurrentlyInTown and TAG_IN_LOCO moved to shared/stay-inloco.ts: the
// scheduler's stale-inloco-cleanup job needs the SAME derivation for guests
// who departed and never wrote again. One authority, imported by both.

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
  "- You NEVER have a restaurant's menu. The FAQ block carries name, price band, address and phone — no dishes. If asked for a menu, say plainly you do not have it and give the phone number to ask directly. NEVER list dishes as if they were a specific restaurant's menu, and never OFFER to send a menu: a full invented menu was served to a coeliac guest (2026-08-25).",
  '- You cover the destination the FAQ block describes and its immediate surroundings — roughly 15-20 km, the everyday radius of someone staying there: the neighbouring villages, the valley they are in, the nearest town for shopping or a station. Anywhere beyond that is outside what you cover, however famous it is and however sure you are about it.',
  '- Inside that radius you still only state what the FAQ block or a tool gave you. The radius widens the SUBJECT you may discuss, never the facts you may assert: if the block does not say it, you do not know it, even about the village next door.',
  '- Asked about somewhere beyond the radius, say plainly that you only cover this area, then offer what you do have here. Do not first answer about the far place: not its season, its distance, its travel time, its size, nor whether it is worth going. Those are the facts you have no source for.',
  '- When your answer is about ONE place and its FAQ entry carries a photo, a video or a link, give it in that same reply. It is part of the answer, not a bonus to be produced only if the guest asks for it a second time.',
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
  /** The clock hour in Sappada the report was fetched in, e.g. "2026-08-25T14". */
  hourKey: string
}

const weatherCache = new Map<string, CachedForecast>()

/**
 * The current clock hour IN SAPPADA, as a cache key.
 *
 * Not the server's: the dyno runs on UTC, and between midnight and 02:00 Rome
 * it is still the previous day there — the same mismatch that once told a
 * guest writing at 02:08 that it was 00:08 (2026-08-23).
 */
function sappadaHourKey(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`
}

/**
 * The forecast for this session, cached WITHIN the clock hour.
 *
 * A forecast is not a static fact: its text carries hours ("pioggia debole
 * fino alle 11") and relative days ("oggi", "domani"). Held across the turn of
 * an hour it goes stale in the one way that matters — a guest writing at 11:20
 * was still being told it would rain "fino alle 11", and a cache filled at
 * 23:50 meant "domani" by 00:10 (Andrea, 2026-08-25: "la cache sul meteo può
 * essere pericolosa").
 *
 * So the key is the HOUR, not a duration: within it the text stays true, and
 * at the turn of it the forecast is fetched again. Three follow-ups about the
 * same afternoon remain one call, which is what the cache was for.
 *
 * Only a good report is cached: a transient outage is retried on the next
 * question, never remembered as "weather unavailable".
 */
async function fetchWeather(sessionId: string, now: Date): Promise<WeatherReport> {
  const hourKey = sappadaHourKey(now)
  const cached = weatherCache.get(sessionId)
  if (cached && cached.hourKey === hourKey) {
    return cached.report
  }
  const report = await getSappadaWeather(now)
  if (report.ok) weatherCache.set(sessionId, { report, hourKey })
  return report
}

// ── Prompt assembly ───────────────────────────────────────────────────────

/**
 * How many FAQ entries travel with a turn.
 *
 * All 85 of this tenant's entries used to go out on EVERY message — ~31k
 * tokens to answer "ciao" — which is most of what a turn costs and is what
 * pushed the prompt past the provider's per-request ceiling (Andrea,
 * 2026-08-25: "non va in locale").
 *
 * Twenty-four, not five: the entries are the assistant's ONLY source of facts,
 * so a relevant one left out is a question it can no longer answer. The number
 * is generous on purpose — the saving comes from dropping the long tail, not
 * from cutting close to the bone.
 */
const FAQ_BUDGET = 24

/**
 * The FAQ entries worth sending for THIS message.
 *
 * Ranked by the same topic-overlap measurement the media guard uses — no
 * phrasing or intent is read (CLAUDE.md §14), only how much an entry's
 * distinctive words overlap the conversation.
 *
 * Scored against the guest's message AND the recent history, because a
 * follow-up ("e gli orari?") carries almost no words of its own: the subject
 * lives in what was said before.
 *
 * Under the budget nothing is selected at all — with a short catalogue the
 * whole thing is cheaper than deciding what to leave out.
 */
function selectRelevantFaqs(faqs: FaqEntry[], context: string): FaqEntry[] {
  if (faqs.length <= FAQ_BUDGET) return faqs
  const ranked = faqs
    .map((faq) => ({ faq, score: subjectScore(faq, context, faqs) }))
    .sort((a, b) => b.score - a.score)
  const chosen = ranked.slice(0, FAQ_BUDGET).map((r) => r.faq)
  // eslint-disable-next-line no-console
  console.error(`[demosappada][faq-budget] ${chosen.length}/${faqs.length} entries sent`)
  return chosen
}

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
  // Every date and hour below is rendered in Sappada's zone, never the host's.
  // `it-IT` sets only the LANGUAGE — left to itself the formatter uses the
  // server clock, so the Heroku dyno (UTC, no TZ set) told a guest writing at
  // 02:08 that it was 00:08, and between midnight and 02:00 Rome it named the
  // wrong day too (Andrea, live, 2026-08-23).
  const inSappada: Intl.DateTimeFormatOptions = { timeZone: TIMEZONE }

  // The part of the day, spelled out. The model was given only a clock and
  // called 01:35 on a Sunday "sabato sera" — right about the feel of it,
  // wrong about the day, and confidently so (Andrea, 2026-08-23). Naming the
  // moment removes the guess, and naming what is CLOSED at that hour stops
  // the assistant proposing a museum in the middle of the night.
  const hour = Number(
    now.toLocaleString('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }),
  )
  const partOfDay =
    hour < 5
      ? 'notte fonda — quasi tutto è chiuso, e non ha senso proporre attività per adesso'
      : hour < 12
        ? 'mattina'
        : hour < 14
          ? 'ora di pranzo'
          : hour < 18
            ? 'pomeriggio'
            : hour < 22
              ? 'sera'
              : 'tarda sera — musei e negozi sono chiusi'

  const lines = [
    '═══ RUNTIME ═══',
    `Today: ${now.toLocaleDateString('it-IT', { ...inSappada, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`,
    `Local time: ${now.toLocaleTimeString('it-IT', { ...inSappada, hour: '2-digit', minute: '2-digit' })} (${partOfDay})`,
    'Use this date and this hour EXACTLY as given: never state a different weekday, and never guess',
    'what time it is. "Oggi" is the date above, whatever hour it is.',
    `Channel: ${channel}`,
    // The season decides which half of the FAQ block is even applicable —
    // the ski lifts and the Cascatelle are not alternatives, they are
    // different months. Derived from the date rather than asked, and stated
    // plainly because a model reasoning "August, so probably warm" is
    // guessing at exactly the point where it must not.
    `Season: ${seasonOf(now)}`,
  ]
  if (customerName) lines.push(`Customer name: ${customerName}`)
  if (settings.privacyPolicyUrl) lines.push(`Privacy policy URL: ${settings.privacyPolicyUrl}`)

  if (greeting === 'new') {
    // The welcome and the video are prepended by CODE after the model answers
    // (withWelcome above). Asking the model for them too is what made it drop
    // get_weather to make room for the greeting.
    lines.push(
      '',
      '🚨 A welcome line and the PRESENTATION video are added automatically ABOVE your reply. Do NOT write',
      'a greeting, do NOT introduce yourself, do NOT offer help in general, do NOT repeat the presentation',
      'video. Links that belong to a FAQ entry — including its videos — are content: quote them normally.',
      'Anything of that kind you write is deleted before sending, and what remains is what the guest',
      'reads — so start your very first sentence with the substance.',
      '🚨 Do NOT assume what they want. "Ciao" is not a request for dinner, or for a walk, or for',
      'anything else: it is a hello. When the message carries NO request, your whole reply is the first',
      'question from ANCORA DA CHIEDERE — that sentence and NOTHING else. No opening remark, no comment',
      'on the weather or the season, no "che bella giornata": the welcome above already greeted them,',
      'and a line like "Oggi è una giornata ideale per esplorare Sappada!" is filler in front of the',
      'only thing you were asked to say (Andrea, 2026-08-24). Never invent the topic on their behalf.',
      'On this first turn, when they asked something whose answer depends on WHO they are — what to do',
      'today, where to eat, which walk, a plan for the days — do NOT hand over a full set of',
      'recommendations and then ask who they are: ask FIRST, in one short line, joining the two things',
      'you need most ("siete in quanti, e quanto vi fermate?"). One line of recommendation before it is',
      'fine as a taster; six is a list you will have to throw away.',
      'When what they asked does not depend on it (a phone number, an opening time, how to get here),',
      'answer it fully, then ask the FIRST question from ANCORA DA CHIEDERE.',
      'Never end with a generic "how can I help you?" — the welcome above you already said that.',
    )
  } else if (greeting === 'returning') {
    lines.push(
      '',
      'A short welcome-back line is added automatically before your reply — do NOT greet the customer',
      'yourself, and never send the presentation video again. Start directly with the answer.',
    )
  } else {
    lines.push('', 'Mid-conversation: no greeting, no presentation video. Answer directly.')
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

  let knownName = state.name || (input.userName?.trim() ? input.userName.trim() : undefined)
  if (knownName && !state.name) {
    updateState(sessionId, { name: knownName }, { mirror: false })
  }

  // 🌍 What the guest WROTE beats what their browser says. The widget passes
  // the browser's Accept-Language, and "Ciao" from an English browser was
  // being answered in English (Andrea, 2026-08-25). Only for an opening
  // greeting whose language is unmistakable; anything else still seeds from
  // the host and is then decided by the model.
  const greetingLang = greetingLanguage(userMessage)
  const languageSeed =
    greetingLang && (settings.enabledLanguages ?? []).includes(greetingLang)
      ? greetingLang
      : input.config.language
  const seeded = seedLanguageIfNeeded(
    sessionId,
    languageSeed,
    settings.enabledLanguages,
    settings.defaultLanguage,
  )
  // A language read off the guest's own greeting is not a hint to be second
  // guessed: commit it, so the prompt says "the conversation language IS x"
  // rather than "the profile suggests x".
  if (greetingLang && seeded === greetingLang) {
    commitLanguageFromReply(sessionId, greetingLang)
  }

  const lastTimestamp = history.length > 0 ? history[history.length - 1]?.timestamp : undefined
  // The stay tools need a customer to write to: in the playground there is
  // none, so they are simply not offered rather than failing at call time.
  const customerId = input.context.customerId

  // Revocation, before ANY other guard: a guest withdrawing consent must not
  // be turned away by a rate limit or a session cap, and must not depend on
  // the model choosing to call a tool. Deterministic code, because this is
  // the promise made when the consent was taken (CLAUDE.md §16 iron rule 1).
  if (isUnsubscribeCommand(userMessage, settings) && customerId) {
    if (input.config.handlers?.savePushConsent) {
      await input.config.handlers.savePushConsent({
        workspaceId: input.config.workspaceId,
        customerId,
        granted: false,
      })
    }
    // The interest tags go with it: a consent that is revoked but leaves its
    // segments behind is a campaign waiting to reach someone who said stop.
    if (input.config.handlers?.setCustomerTags) {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        remove: [TAG_INTEREST_EVENTS, TAG_INTEREST_LODGING, TAG_INTEREST_OFFERS],
      })
    }
    // eslint-disable-next-line no-console
    console.error(`[demosappada][unsubscribe] consent revoked for ${customerId}`)
    return {
      reply: settings.unsubscribedMessage?.trim() || null,
      tokensUsed: 0,
      answeredFromFaq: false,
    }
  }

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
  // Closing a finished holiday is CODE, not a tool the model may or may not
  // call. A tool would leave the profile dirty on any turn where the model was
  // busy with something else — and a stale INLOCO tag means a "dinner tonight"
  // campaign reaching someone who went home in August (CLAUDE.md §16).
  let returningGuest = false
  // Two routes into the same rollover: the calendar says the stay is long
  // over, or the guest said so themselves through startNewStay.
  if (stayProfile && (stayProfile.restartRequested || isStayOverAndClosed(stayProfile, now))) {
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
    // The stay tags go with the stay. The interest tags do NOT: they record a
    // consent, which outlives the holiday and is what a campaign next spring
    // is sent on.
    if (customerId && input.config.handlers?.setCustomerTags) {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        remove: [TAG_IN_LOCO],
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

  // Anyone we have heard from BEFORE gets the welcome-back, not the full
  // welcome with the presentation video — however empty this conversation's
  // history looks. WhatsApp threads and widget sessions start fresh all the
  // time, and on the third day of a holiday that produced the whole welcome
  // and the video again (live check, 2026-08-23).
  //
  // The profile is the durable record, and it now carries `hasWrittenBefore`
  // — so it is non-null for anyone who ever wrote to us, including the guest
  // who chatted without ever stating dates and used to look brand new every
  // time (Andrea, 2026-08-25: "il primo check è sapere se l'utente esiste").
  if (greeting === 'new' && stayProfile) greeting = 'returning'

  // On the day they leave, no greeting at all. "Bentornato! Come va la
  // vacanza?" prefixed to someone writing "oggi ripartiamo" reads as if
  // nobody was listening — and this turn's job is the goodbye, not a hello
  // (live check, 2026-08-23).
  if (greeting === 'returning' && daysLeftInStay(stayProfile, now) !== null && daysLeftInStay(stayProfile, now)! <= 0) {
    greeting = 'none'
  }
  updateState(sessionId, { greeting }, { mirror: false })

  const faqs = input.config.handlers?.getFaqs
    ? await input.config.handlers.getFaqs({ workspaceId: input.config.workspaceId })
    : []

  // Only the entries this turn can plausibly need. The subject often lives in
  // the previous turns rather than in the message itself ("e gli orari?"), so
  // the last exchanges are part of what is scored against.
  const faqContext = [
    userMessage,
    ...history.slice(-4).map((h) => h.content),
  ].join(' ')
  const relevantFaqs = selectRelevantFaqs(faqs, faqContext)
  const faqBlock = formatFaqBlock(relevantFaqs)
  const accommodationEnabled = !!input.config.handlers?.getCatalogue

  // Every tool offered this turn: the module's own built-ins (seeded as rows
  // from tools.manifest.ts and switchable in Settings → Custom Tools) plus any
  // webhook the tenant defined. An absent handler or an empty list means this
  // workspace has none.
  const customTools = input.config.handlers?.getCustomTools
    ? await input.config.handlers.getCustomTools({ workspaceId: input.config.workspaceId })
    : []
  const customToolsByName = new Map(customTools.map((t) => [t.name, t]))

  // 🚨 Derived from the tools ACTUALLY offered, not from handler presence alone.
  //
  // An admin can now switch a built-in off in the UI, and the handler stays
  // wired either way. Gating only on the handler meant the module went on
  // instructing the model to call a tool it could no longer see: the forced
  // save below pushed "Chiama ORA save_preferences", the model could not comply, and
  // the hop was spent on nothing — a dead turn for the guest.
  const stayToolAvailable = customToolsByName.has('save_preferences')
  // Two switches, deliberately ANDed: the advanced-settings JSON flag and the
  // tool row. Either one off means off. Kept both rather than silently
  // retiring `weatherEnabled`, which is a working feature (Andrea, 2026-08-24).
  const weatherEnabled = settings.weatherEnabled !== false && customToolsByName.has('get_weather')

  // Says WHY the bot is about to behave less capably, at the one moment the
  // cause is knowable. Without it a disabled tool looks like a model failure.
  const missingBuiltIns = ['save_preferences', 'get_weather', 'remember'].filter(
    (name) => !customToolsByName.has(name),
  )
  if (missingBuiltIns.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[demosappada][tools-off] not offered this turn: ${missingBuiltIns.join(', ')}`)
  }


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
    // Same code-owned sync for the remote-prospect segment: the tag follows
    // `presence`, and leaves the moment the prospect becomes a guest (they
    // book, they arrive) — a stale NO-A-SAPPADA on someone in town would
    // route the wrong campaigns at them.
    if (stayProfile?.presence === 'remote') {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        add: [TAG_REMOTE_PROSPECT],
        remove: [TAG_IN_LOCO],
      })
    } else if (stayProfile?.presence === 'in_loco' || stayProfile?.presence === 'planned') {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        remove: [TAG_REMOTE_PROSPECT],
      })
    }
  }

  const stayBlock = formatStayBlock(stayProfile, now, returningGuest, knownName, settings)

  // Built once: it is part of the prompt AND part of what the reply may
  // quote. The local time and today's date live only here, so without it in
  // approvedContent the time guard deleted them — a guest was told "stasera
  // sono le e il tramonto è attorno alle" (Andrea, live, 2026-08-23).
  const runtimeBlock = formatRuntimeBlock({
    now,
    channel: input.channel,
    greeting,
    settings,
    customerName: knownName,
  })

  // 📋 {{userPreference}} — the guest's card, substituted into the tenant's own
  // main prompt so the author decides WHERE it lands (Andrea, 2026-08-24).
  // Done at runtime, not by the settings generator: the card is rewritten as
  // the conversation goes, while the generator renders the prompt once at save
  // time and would freeze whatever was in it then.
  //
  // With nothing learned yet the placeholder resolves to empty and the line
  // holding it collapses — the same rule as {{customerName}}, and better than
  // telling the model "nothing known" in a language it then echoes.
  // 📋 Everything we know about this guest, as variables the tenant can place
  // ANYWHERE in the main prompt from the backoffice — the same contract as
  // {{videoUrl}} and {{firstQuestion}} in the welcome (contratto.md: "tutti
  // questi campi devono riempire il main prompt", "il main prompt deve avere
  // tutte le variabili").
  //
  // Resolved at RUNTIME, not by the settings generator: these change with the
  // conversation, while the generator renders the prompt once at save time and
  // would freeze whatever was true then.
  //
  // Crossing them — weather against preferences against what the FAQ block
  // says — is what the assistant is for. Having them in the prompt as named
  // values, instead of buried in a block appended at the end, is what lets the
  // tenant tell it HOW to cross them.
  const daysLeftNow = daysLeftInStay(stayProfile ?? null, now)
  const partySummary = [
    stayProfile?.adults !== undefined ? `${stayProfile.adults} adulti` : '',
    stayProfile?.children ? `${stayProfile.children} bambini` : '',
    stayProfile?.seniors ? `${stayProfile.seniors} anziani` : '',
  ]
    .filter(Boolean)
    .join(', ')

  const promptVariables: Record<string, string> = {
    // The card the assistant re-reads every turn.
    userPreference: stayProfile?.notes?.trim() ?? '',
    // Who they are.
    customerName: knownName?.trim() ?? '',
    customerLanguage: getState(sessionId).language ?? settings.defaultLanguage ?? '',
    party: partySummary,
    childrenAges: stayProfile?.childrenAges?.trim() ?? '',
    // When.
    arrivalDate: stayProfile?.arrivalDate ?? '',
    departureDate: stayProfile?.departureDate ?? '',
    daysLeft: daysLeftNow !== null ? String(daysLeftNow) : '',
    // What shapes the advice.
    constraints: stayProfile?.constraints?.trim() ?? '',
    interests: stayProfile?.interests?.trim() ?? '',
    doneAlready: stayProfile?.doneAlready?.trim() ?? '',
    // Written by a person at the Pro Loco.
    operatorNotes: stayProfile?.operatorNotes?.trim() ?? '',
    // The season, so the crossing rule can forbid the impossible: skiing was
    // recommended at 17°C in August (Andrea, 2026-08-25: "con 17 gradi vado a
    // sciare senza neve???").
    season: seasonOf(now),
  }

  const mainPromptRendered = renderPromptVariables(settings.mainPrompt?.trim() || '', promptVariables)

  const systemPrompt = [
    mainPromptRendered,
    '',
    OPERATING_RULES,
    '',
    faqBlock,
    '',
    runtimeBlock,
    stayBlock.text,
    formatStateForPrompt(getState(sessionId)),
  ]
    .filter((part) => part !== '')
    .join('\n')

  // Carried on the block itself, not read back from module state: the pending
  // question belongs to THIS turn's guest.
  const questionShown = stayBlock.askedKey
  // eslint-disable-next-line no-console
  console.error(`[demosappada][turn-in] dictated=${questionShown} asked=${JSON.stringify(stayProfile?.asked ?? [])}`)
  // The keys actually put to the guest this turn. With one question per turn
  // this holds at most one, and it is the ONLY one marked as asked: marking a
  // question that was never pronounced would silently drop it from the queue.
  const questionsShown = stayBlock.askedKeys
  // The dictated wording, so the one-question guard does not cut a configured
  // question that spans several sentences.
  const dictatedQuestion = stayBlock.askedQuestion

  const nextWeekdayDate = (msg: string): string | undefined => {
    const DAY: Record<string, number> = {
      dome: 0, sund: 0, sonn: 0, dima: 0, domi: 0, zond: 0, sond: 0,
      lune: 1, mond: 1, mont: 1, lund: 1, maan: 1, mand: 1, segu: 1,
      mart: 2, tues: 2, dien: 2, mard: 2, dins: 2, tirs: 2, terc: 2,
      merc: 3, wedn: 3, mitt: 3, mier: 3, woen: 3, onsd: 3, quar: 3,
      giov: 4, thur: 4, donn: 4, jeud: 4, juev: 4, dond: 4, tors: 4, quin: 4,
      vene: 5, frid: 5, frei: 5, vend: 5, vier: 5, vrij: 5, fred: 5, sext: 5,
      saba: 6, satu: 6, sams: 6, same: 6, zate: 6, lord: 6,
    }
    for (const t of msg.toLowerCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/)) {
      if (t.length < 4) continue
      const d = DAY[t.slice(0, 4)]
      if (d !== undefined) {
        const cur = new Date(now)
        let add = (d - cur.getDay() + 7) % 7
        if (add === 0) add = 7
        return new Date(cur.getTime() + add * 86_400_000).toISOString().slice(0, 10)
      }
    }
    return undefined
  }

  // On the very first turn nothing has been asked yet, but the opening
  // message often volunteers everything ("siamo due adulti e stiamo fino a
  // domenica"): the dictated first question stands in as the capture key,
  // or those facts were lost and the composition question came back at
  // someone who had just said "adulti" (2026-08-25).
  // Number words and party categories — closed vocabularies (§14 lists
  // word-numbers alongside digits). "siamo DUE adulti e DUE bambini" gave
  // the machine nothing, because capture read only \d (2026-08-25). A
  // number (digit or word) followed by a category word assigns that
  // category; a lone number falls back to adults.
  const parseParty = (msg: string): { adults?: number; children?: number; seniors?: number; days?: number } => {
    const WORD_NUM: Record<string, number> = {
      un: 1, uno: 1, una: 1, one: 1, eins: 1, deux: 2, due: 2, dos: 2, dois: 2, two: 2, zwei: 2, twee: 2, to: 2,
      tre: 3, three: 3, drei: 3, trois: 3, tres: 3, drie: 3,
      quattro: 4, four: 4, vier: 4, quatre: 4, cuatro: 4, quatro: 4, fire: 4,
      cinque: 5, five: 5, cinq: 5, cinco: 5, vijf: 5, fem: 5,
      sei: 6, six: 6, sechs: 6, seis: 6, zes: 6, seks: 6,
      sette: 7, seven: 7, sieben: 7, sept: 7, siete: 7, sete: 7, zeven: 7, syv: 7,
      otto: 8, eight: 8, acht: 8, huit: 8, ocho: 8, oito: 8, otte: 8,
      nove: 9, nine: 9, neun: 9, neuf: 9, nueve: 9, negen: 9, ni: 9,
      dieci: 10, ten: 10, zehn: 10, dix: 10, diez: 10, dez: 10, tien: 10, ti: 10,
    }
    const isDayWord = (t: string): boolean =>
      /^(giorn|nott|day|nigh|tag|naech|nacht|jour|nuit|dia|noch|dag|naet)/.test(t)
    const cat = (t: string): 'children' | 'adults' | 'seniors' | null =>
      /^(bamb|bimb|figl|kind|child|enfant|nin|crian|born)/.test(t)
        ? 'children'
        : /^(adul|erwa|volw|voks)/.test(t)
          ? 'adults'
          : /^(anzi|senio|nonn|aelt|alte[rn])/.test(t)
            ? 'seniors'
            : null
    const toks = msg
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
    const out: { adults?: number; children?: number; seniors?: number; days?: number } = {}
    let loose: number | undefined
    for (let i = 0; i < toks.length; i++) {
      const n = /^\d+$/.test(toks[i]) ? parseInt(toks[i], 10) : WORD_NUM[toks[i]]
      if (n === undefined || n < 1 || n > 30) continue
      const nextTok = toks[i + 1]
      const c = nextTok ? cat(nextTok) : null
      if (c) out[c] = n
      // "3 giorni" / "2 notti": a number is a DURATION only when its own
      // next word says so — the positional "second number = days" guess
      // read the 2 of "2 adulti" as two days and invented a departure
      // date nobody stated (2026-08-25, live).
      else if (nextTok && isDayWord(nextTok)) out.days = n
      else if (loose === undefined) loose = n
    }
    if (out.adults === undefined && loose !== undefined) out.adults = loose
    return out
  }

  // The guest wrote a sentence that answers NOTHING we asked — no number,
  // no weekday, not a yes/no. "dove si butta la spazzatura" typed with a
  // stray key instead of the question mark is the live example (Andrea,
  // 2026-08-26 — the night the design was nearly thrown out over it):
  // gating everything on "?" alone let the composer replace the model's
  // correct answer with the bare intake question. This flag joins the
  // question mark everywhere "did they ask us something" is decided —
  // the dropped-reply guard below AND composeIntakeTurn's keep-the-prose
  // path. A real answer ("siamo in 3", "fino a domenica", "no") never
  // trips it.
  // Only questions whose answer has a SHAPE (a number, a date, a yes/no) can
  // tell "answer" from "aside" this way. For the free-text questions —
  // location, constraints, interests, the remote prospect's needs — any
  // sentence IS a legitimate answer ("no ma veniamo a dicembre" answers the
  // location question), and flagging it as an aside would tell the model the
  // opposite of the truth.
  const STRUCTURED_ANSWER_KEYS = new Set([
    'party',
    'headcount',
    'stay',
    'composition',
    'childrenAges',
    'consent',
  ])
  const probe = parseParty(userMessage)
  const guestSaidAside =
    !!questionShown &&
    STRUCTURED_ANSWER_KEYS.has(questionShown) &&
    probe.adults === undefined &&
    probe.children === undefined &&
    probe.seniors === undefined &&
    !/\d/.test(userMessage) &&
    nextWeekdayDate(userMessage) === undefined &&
    !/^(s[iì]|no|ok|yes|nein|ja)\.?$/i.test(userMessage.trim()) &&
    userMessage.trim().split(/\s+/).length >= 3

  const trimmedHistory = history.slice(-(settings.maxHistoryMessages ?? 30))
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory.map((h) => ({ role: h.role, content: h.content }) as Message),
    { role: 'user', content: userMessage },
  ]

  // Told UPFRONT, deterministically, when the guest's message answers nothing
  // we asked: without this the model read "dove si butta la spazzatura" as
  // information received — "Grazie per l'informazione!" — instead of a
  // request to serve (live, 2026-08-26). The flag is shape-only (§14): no
  // number, no weekday, no yes/no, three words or more.
  if (guestSaidAside && questionShown && dictatedQuestion) {
    messages.push({
      role: 'user',
      content:
        '[SYSTEM] Il messaggio del cliente NON risponde alla domanda che avevi in sospeso: è una ' +
        'richiesta o un\'osservazione a sé. PRIMA rispondigli davvero, con i fatti delle schede — se ' +
        'il dato non c\'è, dillo apertamente e indica l\'InfoPoint (0435 469131) — e SOLO DOPO, in ' +
        'coda e da sola, rifai la domanda in sospeso.',
    })
  }

  // `approvedContent` is everything the reply may legitimately quote: the FAQ
  // block, the tenant's own presentation video, and anything a tool returns
  // this turn. It grows as tools answer.
  //
  // The video has to be in here explicitly. It arrives from settings, not from
  // the FAQ block, and without it the guard stripped the very link the welcome
  // had just announced — leaving "here is a short presentation 👇" followed by
  // nothing (live run, 2026-08-22).
  let approvedContent = [
    faqBlock,
    runtimeBlock,
    settings.welcomeVideoUrl ?? '',
    settings.privacyPolicyUrl ?? '',
  ]
    .filter(Boolean)
    .join('\n')
  let tokensUsed = 0
  let answeredFromFaq = faqs.length > 0

  const maxHops = settings.maxToolHops ?? MAX_TOOL_HOPS

  // Whether the guest's answer was actually recorded this turn. The prompt
  // asks the model to call save_preferences the moment it learns something, and the
  // model regularly does not: it acknowledged "siamo in 4, due bambini di 7 e
  // 9 anni" in prose and saved nothing, so two turns later it asked again
  // (Andrea, 2026-08-23). An instruction cannot be the guarantee here.
  let stayWasSaved = false
  let forcedSaveDone = false
  /** True when save_push_consent granted the consent on THIS turn. */
  let consentJustGranted = false
  /** Last free-text answer the model produced, kept as a fallback. */
  let pendingReply = ''
  let emptyRetryDone = false
  let droppedQuestionRetryDone = false
  let missingExamplesRetryDone = false

  for (let hop = 0; hop < maxHops; hop++) {
    const result = await callLLM(
      messages,
      settings,
      buildTools(customTools),
    )
    tokensUsed += result.tokensUsed

    if (result.toolCalls.length === 0) {
      // The turn is about to end. If the guest told us something about their
      // stay and nothing was written, spend one hop forcing the tool rather
      // than letting the fact evaporate — asking the same question twice is
      // what makes the assistant feel like a form.
      //
      // The trigger is STRUCTURAL: an intake question was pending and the
      // guest wrote back. It used to be `mentionsStayFacts(userMessage)`, a
      // regex over Italian words — which is phrase detection on user text
      // (CLAUDE.md §14) and failed on most real answers: "siamo tutti adulti",
      // "in due, fino a sabato", and every reply in French, German, Spanish or
      // English sailed past it, so nothing was saved and the question came
      // back (Andrea, 2026-08-24: "se non salva... deve salvare").
      //
      // A guest answering our question is exactly the moment a fact exists to
      // record. Nothing here reads WHAT they wrote.
      //
      // `stayToolAvailable` guards the whole retry: with save_preferences switched off
      // there is nothing to force, and spending a hop ordering an absent tool
      // is how the guest ends up with an empty reply.
      // A guest ANSWERING our question wrote at least a couple of words —
      // the same bar save_preferences uses for accepting facts. On a bare
      // "ciao" there is nothing to save: firing the save/field retries anyway
      // burned every hop, the turn fell through to the fallback path, and the
      // guest got the question without the welcome, unmarked (2026-08-25).
      const answeredOurQuestion =
        !!questionShown && userMessage.trim().split(/\s+/).length >= 2
      if (stayEnabled && stayToolAvailable && !stayWasSaved && !forcedSaveDone && answeredOurQuestion) {
        forcedSaveDone = true
        // Keep what the model already wrote: the extra hop is for the save,
        // not for a better answer, and if the hop budget runs out afterwards
        // this is what the guest gets instead of silence.
        pendingReply = result.content || pendingReply
        messages.push({ role: 'assistant', content: result.content || null })
        messages.push({
          role: 'user',
          content:
            '[SYSTEM] Il cliente ti ha appena dato informazioni sul suo soggiorno e non le hai ancora ' +
            'salvate. Chiama ORA save_preferences con quello che hai imparato da questo messaggio (quante ' +
            'persone, bambini e le loro età, anziani, quanti giorni, da dove arrivano, esigenze ' +
            'particolari), e registra in `asked` le domande che hai fatto. Subito dopo il salvataggio ' +
            'scrivi al cliente la risposta: se resta una domanda da fare, falla; altrimenti conferma ' +
            'brevemente e prosegui. Non lasciarlo MAI senza risposta.',
        })
        continue
      }

      // (The field-retry that lived here is gone: it spent one LLM hop asking
      // the model to re-save, the model failed again, and with maxToolHops=4
      // the whole turn fell through to the fallback path — unmarked, uncaptured
      // ("C'è qualcosa di particolare..." three turns in a row, 2026-08-25).
      // Its job is done deterministically by the ANSWER CAPTURE before the
      // turn is composed: the guest's own words become the field, no hop
      // spent.)

      const { reply, lang } = extractLanguage(result.content)
      if (!reply.trim()) {
        // Silence is never an acceptable answer: the guest wrote something and
        // is watching an empty bubble. It happened when the forced save ate
        // the turn (Andrea, 2026-08-23). One more hop, asked plainly.
        if (!emptyRetryDone) {
          emptyRetryDone = true
          messages.push({ role: 'assistant', content: null })
          messages.push({
            role: 'user',
            content:
              '[SYSTEM] Non hai scritto nulla al cliente. Scrivi ORA la risposta: se c\'è una domanda ' +
              'in sospeso nel blocco QUESTO OSPITE falla, altrimenti rispondi a quello che ti ha detto. ' +
              'Una sola domanda, poche righe.',
          })
          continue
        }
        return { reply: null, tokensUsed, answeredFromFaq, error: 'empty_reply' }
      }

      const checked: { text: string; removed: string[] } = stripUnverifiableContacts(reply, approvedContent)
      checked.text = stripWeatherHedges(checked.text)
      {
        const inv = stripInventedLists(checked.text, approvedContent)
        if (inv.removed.length > 0) {
          // eslint-disable-next-line no-console
          console.error(`[demosappada][invented-list] dropped ${inv.removed.length} fabricated line(s)`)
          checked.text = inv.text
        }
      }
      if (checked.removed.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][stripped] ${checked.removed.join(' | ')}`)
      }

      // After the strip, never before: the links come from the FAQ block, so
      // they would survive the guard anyway, and appending first would only
      // make it re-scan text it already approved.
      if (contentMediaAllowed(greeting, sessionId, stayProfile, settings, now, !!questionShown)) {
        checked.text = withFaqMedia(checked.text, faqs, userMessage, [settings.welcomeVideoUrl ?? ''])
      }

      // Only while an intake question is pending: with the intake closed a
      // second question is the model talking to the guest normally, and
      // trimming it would cut a real conversation short.
      //
      // While it IS pending, exactly one question reaches the guest. The
      // prompt asks for one; this is what makes it true when the model
      // anticipates the next ones anyway.
      // The one-question trim runs AFTER the dictated question is resolved and
      // possibly re-attached — see below. Running it here compared the reply
      // against the ITALIAN wording only, so a correctly translated question
      // was not recognised as ours.

      if (lang) {
        const resolved = resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
        commitLanguageFromReply(sessionId, resolved)
      }

      // (The dropped-question guard now lives AFTER parseParty/nextWeekdayDate
      // below: it needs them to tell "they answered my question" from "they
      // said something else entirely", and both are declared later in this
      // block. See [guard] guest message ignored.)

      // GUARD: the intake question went out stripped of its examples. The
      // prompt lists them and says to pronounce them; asked for six examples
      // "in one line" the model kept the question and dropped the list, which
      // is how "c'è qualcosa che devo tenere presente?" reached a guest
      // (Andrea, live, 2026-08-23). One hop to put them back.
      // `constraints` is the question that collapses into a bare "c'è qualcosa
      // che devo sapere?" and gets a "no" (Andrea, live, 2026-08-23: "ma che
      // domande"). Kept a find over the keys shown rather than a single check,
      // so it still holds if a turn ever carries more than one again.
      const strippedKey =
        questionsShown.find((k) => intakeQuestionLacksExamples(checked.text, k)) ?? null
      if (!missingExamplesRetryDone && strippedKey) {
        missingExamplesRetryDone = true
        // eslint-disable-next-line no-console
        console.error(`[demosappada][guard] intake question without examples (${strippedKey}) — retrying`)
        pendingReply = result.content || pendingReply
        messages.push({ role: 'assistant', content: result.content || null })
        messages.push({
          role: 'user',
          content:
            '[SYSTEM] Hai chiesto se c\'è qualcosa da sapere senza dare gli esempi, e a una domanda ' +
            'generica si risponde "no". Riscrivi la risposta tenendo tutto il resto com\'è: la domanda ' +
            'deve nominare qualche esempio concreto — allergie o intolleranze, se sono senza auto, una ' +
            'gravidanza, difficoltà a camminare, un cane, o al contrario qualcosa che gli piace.',
        })
        continue
      }

      // The model declares the language correctly and then writes in another
      // one. Repaired here rather than asked for again in the prompt.
      if (lang) {
        const target = resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
        if (checked.text && looksLikeWrongLanguage(checked.text, target)) {
          // eslint-disable-next-line no-console
          console.error(`[demosappada][lang-fix] declared=${target} but reply was not`)
          checked.text = await translateText(checked.text, target, settings)
        }
      }

      // The question the block showed this turn is recorded as ASKED once it
      // has REACHED the guest — see the reachedGuest check below — and then
      // whether or not they answer it. It was put to them; asking again would
      // be the failure.
      //
      // Marking it unconditionally is what made `consent` disappear: dictated
      // on a turn where the model wrote its own question instead, it was
      // retired without anyone ever reading it (Andrea, 2026-08-24). A
      // question the guest never saw is not a question that was asked.
      //
      // `consent` and `itinerary` are marked HERE too, not only inside their
      // tools. They used to rely on save_push_consent / save_itinerary firing
      // — which happens only when the guest answers clearly. Asked at the end
      // of the intake and met with silence, a shrug or a change of subject,
      // the flag stayed false and the question came back on every single
      // message, for the rest of the holiday (Andrea, 2026-08-23: "solo la
      // prima volta … questo deve andare sì o sì"). Their tools still record
      // the ANSWER; this records that it was PUT.
      // Did the dictated question actually reach the guest? Measured on the
      // reply that is about to be sent, by looking for the question's own
      // longest sentence — the model translates, so a full-string match would
      // only work in Italian, while a sentence it reproduced verbatim proves
      // it did not silently drop the question. With no wording configured
      // there is nothing to check and nothing to mark.
      // The intake turn is composed in ONE place — see composeIntakeTurn.
      const askLangForCheck = lang
        ? resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
        : getState(sessionId).language
      const sourceLangForCheck = (settings.defaultLanguage || 'it').toLowerCase()
      const needsTranslation =
        !!askLangForCheck && askLangForCheck.toLowerCase() !== sourceLangForCheck

      // 🚨 WHICH question goes out is decided against the profile AS IT STANDS
      // NOW, not as it stood when the turn began. Mid-turn saves change the
      // answer both ways: "siamo in 2 fino a domenica" retires `stay` before
      // it was put — asking it repeats what the guest just said — while
      // "siamo due adulti" retires `party` and unlocks `stay` — asking
      // nothing stalls the queue for a whole turn (2026-08-25, both seen
      // live). One authority, the intake machine, consulted again here.
      // ANSWER CAPTURE — the guest replied to the question they LAST SAW
      // (state.lastAskedKey), and that is the field their words belong to.
      // Filing by the key dictated THIS turn misfiled "2 bambini" under
      // `constraints`; gating on their equality skipped capture almost every
      // turn, because the machine moves to the next key the moment the
      // previous one is marked asked (both live, 2026-08-25).
      //
      // Values are the guest's own words — verbatim for free text, digits for
      // the counts, plain date arithmetic for "3 giorni" (§14: numbers and
      // form only, no reading of meaning). Fired only when the model left the
      // field empty.
      // A detail exchange is NOT an intake answer. "mandami il menu della
      // Rustica" (no question mark) was captured as the guest's constraints,
      // and the coeliac question would never have been asked again
      // (2026-08-25). When the model's reply is a detail about a place the
      // guest named, their message was a REQUEST — the free-text capture
      // stands down.
      const detailAnswer = replyIsDetailAnswer(checked.text, userMessage, faqs)
      // A reply still carrying a VERIFIED phone or URL (they survived
      // stripUnverifiableContacts, so they exist in the approved content) is
      // answering a request — "non ho il menu, chiama lo 0435 469830". The
      // guest asked for something without a question mark ("mandami il menu")
      // and the bare-intake rule replaced the answer with the consent
      // question, while the capture filed the request as their constraints
      // (2026-08-25). Facts in the reply = request being served: prose stays,
      // capture stands down.
      const answersWithFacts = /(https?:\/\/|(?:\+39[ .]?)?\d(?:[ .]?\d){5,})/.test(checked.text)

      // (nextWeekdayDate, parseParty and guestSaidAside are declared at turn
      // scope, above the hop loop: the aside flag now steers the SYSTEM hint
      // injected before the first model call, not only the after-the-fact
      // guards here.)

      // GUARD: the guest said something and got ONLY our intake question back.
      // Their words were dropped — the one failure that makes people stop
      // writing. One more hop, spent answering them.
      if (
        !droppedQuestionRetryDone &&
        (guestAskedSomething(userMessage) || guestSaidAside) &&
        isBareIntakeQuestion(checked.text)
      ) {
        droppedQuestionRetryDone = true
        // eslint-disable-next-line no-console
        console.error('[demosappada][guard] guest message ignored — retrying')
        pendingReply = result.content || pendingReply
        messages.push({ role: 'assistant', content: result.content || null })
        messages.push({
          role: 'user',
          content:
            '[SYSTEM] Hai risposto solo con una tua domanda, ignorando quello che il cliente ha ' +
            'scritto. Riscrivi la risposta: PRIMA rispondi a quello che ha detto o chiesto — se non ' +
            'hai il dato, dillo apertamente e indica dove trovarlo (InfoPoint 0435 469131 o il sito ' +
            'ufficiale) — e SOLO DOPO, in coda, rimetti la tua domanda in una riga.',
        })
        continue
      }

      const captureKey = getState(sessionId).lastAskedKey ?? questionShown ?? undefined
      const guestReplied = !userMessage.includes('?') && userMessage.trim().length > 0
      if (stayEnabled && customerId && guestReplied && captureKey && input.config.handlers?.saveStayProfile) {
        const captured: StayProfile = {}
        const verbatim = userMessage.trim().slice(0, 200)
        if (captureKey === 'location') {
          // Only the unmistakable answers are captured in code: a bare yes is
          // "we are here", a bare no is "we are not". Anything richer — "no
          // ma veniamo a dicembre" — is the model's to read, and it saves
          // `presence` (in_loco / planned / remote) via save_preferences.
          if (/^(s[iì]|yes|ja)\.?$/i.test(verbatim)) captured.presence = 'in_loco'
          else if (/^(no|nein)\.?$/i.test(verbatim)) captured.presence = 'remote'
        } else if ((captureKey === 'constraints' || captureKey === 'interests') && !detailAnswer && !answersWithFacts) {
          // A rich answer often carries BOTH facts: "siamo a piedi e voglio
          // vedere sappada" states the constraint AND the interest in one
          // breath. The two free-text fields are filled INDEPENDENTLY — the
          // model may have filled one on its own, and nesting the cross-fill
          // under "primary empty" meant the other question came back at
          // someone who had already answered it (2026-08-25, twice). No
          // splitting, no reading (§14): the guest's whole sentence is the
          // value, the LLM extracts the meaning when it recommends.
          //
          // No word-count threshold: a fixed cutoff is exactly as arbitrary
          // whether it is 4 or 3 — "voglio vedere rifugi" (3 words) missed
          // the old bar of 4, and "voglio rifugi" (2) would have missed a
          // lower one too. The guest answered `interests` before it was ever
          // asked, and the intake asked it again later in the same
          // conversation (Andrea, 2026-08-26: "non sei lineare nel
          // dialogo" / "continua a chiedere fino a che non hai lo state
          // completo"). The only real signal for "this carries no interest"
          // is a bare yes/no/confirmation — CLAUDE.md §14's own example of an
          // allowed non-phrase-detection pattern — everything else is a
          // sentence worth trying.
          const bareConfirmation = /^(s[iì]|no|ok|yes|nein|ja)\.?$/i.test(verbatim)
          const rich = !bareConfirmation
          if (!stayProfile?.constraints && (captureKey === 'constraints' || rich)) {
            captured.constraints = verbatim
          }
          if (!stayProfile?.interests && (captureKey === 'interests' || rich)) {
            captured.interests = verbatim
          }
        } else if (captureKey === 'childrenAges' && !stayProfile?.childrenAges && /\d/.test(verbatim)) {
          captured.childrenAges = verbatim
        } else if (captureKey === 'stay') {
          const wd = nextWeekdayDate(userMessage)
          if (wd && stayProfile?.departureDate !== wd) captured.departureDate = wd
          const n = userMessage.match(/\d+/)
          if (!wd && !stayProfile?.departureDate && n) {
            const days = Math.min(60, parseInt(n[0], 10))
            captured.departureDate = new Date(now.getTime() + days * 86_400_000).toISOString().slice(0, 10)
          }
        } else if (captureKey === 'composition') {
          // "Ci sono bambini o anziani?" asks about TWO categories in one
          // breath. A number-bearing answer ("2 bambini") is unambiguous and
          // parseParty reads it below like it does for headcount/party. A
          // bare confirmation ("yes", "sì") is NOT an answer: it says
          // something exists but not which of the two, so nothing is
          // captured and the step stays unsatisfied (intake-machine.ts:83-86)
          // — the guest gets asked again, this time with the settings-owned
          // "quanti e di che tipo" follow-up, instead of the fact silently
          // vanishing (Andrea, 2026-08-26: "ho detto yes ma non sai se
          // anziani o bambini ..... come si fa?").
          const party = parseParty(userMessage)
          if (party.children !== undefined) {
            captured.children = Math.min(30, party.children)
          }
          if (party.seniors !== undefined) {
            captured.seniors = Math.min(30, party.seniors)
          }
          // An explicit negative ("no", "solo noi due") is a real answer:
          // adults-only.
          if (
            party.children === undefined &&
            party.seniors === undefined &&
            /^(no|nein|non|nope|niente|nessuno)\b/i.test(verbatim)
          ) {
            captured.children = 0
            captured.seniors = 0
          }
        } else if (captureKey === 'headcount' || captureKey === 'party') {
          const party = parseParty(userMessage)
          if (party.adults !== undefined && stayProfile?.adults === undefined) {
            captured.adults = Math.min(99, party.adults)
          }
          if (party.children !== undefined && stayProfile?.children === undefined) {
            captured.children = Math.min(30, party.children)
          }
          if (party.seniors !== undefined && stayProfile?.seniors === undefined) {
            captured.seniors = Math.min(30, party.seniors)
          }
          // "due ADULTI" with no child/senior word answers the composition:
          // adults-only. But "due adulti e due bambini" must NOT zero the
          // children it just named (2026-08-25, live).
          if (
            stayProfile?.children === undefined &&
            captured.children === undefined &&
            captured.seniors === undefined &&
            /\b(adul|erwa|volw|voks)/i.test(userMessage) &&
            !/\b(bamb|bimb|figl|kind|child|enfant|nin|crian|anzi|senio|nonn)/i.test(userMessage)
          ) {
            captured.children = 0
            captured.seniors = 0
          }
          // A FIRST message that says everything ("...e vogliamo visitare
          // sappada") also states the interests: their words fill the field,
          // or the interests question comes back at someone who already
          // answered it (2026-08-25). Rich messages only; when the opener is
          // pure logistics the same words land there and the LLM simply reads
          // nothing extra from them — re-asking is the worse failure per the
          // contract's owner.
          if (
            !getState(sessionId).lastAskedKey &&
            !stayProfile?.interests &&
            verbatim.split(/\s+/).length >= 6
          ) {
            captured.interests = verbatim
          }
          // A weekday the guest wrote beats whatever date the model computed:
          // "fino a domenica" was stored as a Friday (2026-08-25). Calendar
          // arithmetic is code's job (iron rule 1).
          const wdOverride = nextWeekdayDate(userMessage)
          if (wdOverride && stayProfile?.departureDate !== wdOverride) {
            captured.departureDate = wdOverride
          }
          if (!wdOverride && party.days !== undefined && !stayProfile?.departureDate) {
            captured.departureDate = new Date(now.getTime() + party.days * 86_400_000)
              .toISOString()
              .slice(0, 10)
          }
        } else if (
          captureKey === 'name' &&
          !knownName &&
          !/\d/.test(verbatim) &&
          verbatim.split(/\s+/).length <= 3
        ) {
          updateState(sessionId, { name: verbatim })
          knownName = verbatim
        }
        if (Object.keys(captured).length > 0) {
          // eslint-disable-next-line no-console
          console.error(`[demosappada][answer-capture] ${captureKey} <- guest words`)
          await input.config.handlers.saveStayProfile({
            workspaceId: input.config.workspaceId,
            customerId,
            profile: captured,
          })
          stayProfile = { ...(stayProfile ?? {}), ...captured }
        }
      }

      const freshStep = nextIntakeStep({
        profile: stayProfile,
        asked: new Set(stayProfile?.asked ?? []),
        knownName,
      })
      const effectiveKey = freshStep?.key ?? null
      const effectiveQuestion = freshStep
        ? intakeQuestionFor(freshStep.key as IntakeKey, settings)
        : null
      if (effectiveKey !== questionShown) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][intake-shift] "${questionShown}" → "${effectiveKey}"`)
      }

      // Every fixed line the code inserts travels through the same translation
      // as the question: the closing line went out in Italian under an English
      // conversation (Andrea, 2026-08-25: "scrive in due lingue").
      const questionTranslated =
        effectiveQuestion && needsTranslation
          ? await translateWelcome(effectiveQuestion, askLangForCheck, settings)
          : effectiveQuestion
      const closingTranslated =
        settings.closingLine?.trim() && needsTranslation
          ? await translateWelcome(settings.closingLine.trim(), askLangForCheck, settings)
          : settings.closingLine

      // A detail answer earns its media even mid-intake, and survives the
      // bare-question rule: the guest picked a place, the reply about it IS
      // the answer, with the pending question queued at the end.
      if (detailAnswer && contentMediaAllowed(greeting, sessionId, stayProfile, settings, now, false)) {
        checked.text = withFaqMedia(checked.text, faqs, userMessage, [settings.welcomeVideoUrl ?? ''])
      }
      const turn = composeIntakeTurn({
        reply: checked.text,
        key: effectiveKey,
        question: effectiveQuestion,
        questionTranslated,
        guestAsked: guestAskedSomething(userMessage) || guestSaidAside || detailAnswer || answersWithFacts,
        closingLine: closingTranslated,
        intakeOpen: !!freshStep,
      })
      checked.text = turn.text
      // eslint-disable-next-line no-console
      console.error(`[demosappada][turn-out] effective=${effectiveKey} reply="${turn.text.slice(0, 50)}"`)
      let reachedGuest = turn.asked
      if (turn.asked && effectiveKey) {
        updateState(sessionId, { lastAskedKey: effectiveKey }, { mirror: false })
      }
      if (turn.dropped.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][intake-turn] dropped: ${turn.dropped.join(' | ').slice(0, 200)}`)
      }
      // 🔔 The opt-out line, prepended by CODE on the turn the guest accepts.
      //
      // It used to be an instruction inside save_push_consent's tool output,
      // asking the model to say it — and the model said it one turn LATE,
      // stapled to the answer about the name instead of to the consent it
      // belongs to (Andrea, 2026-08-24). The promise of how to opt out has to
      // travel with the yes, so it is written here and not requested.
      //
      // Sent ONCE in the guest's life, tracked on the customer record.
      //
      // `consentJustGranted` alone was not enough: it is a per-turn flag, and
      // the model called save_push_consent again a couple of turns later, so
      // the line went out a second time (Andrea, 2026-08-25: "quante volte mi
      // dici di mettere NO PUSH?"). Comparing the reply's text was no help
      // either — the wording had been edited in between, so the old sentence
      // no longer matched the new one.
      if (
        consentJustGranted &&
        !stayProfile?.pushOptOutHintSent &&
        settings.pushOptOutHint?.trim() &&
        checked.text.trim()
      ) {
        // Translated like every other fixed line: it was the one Italian
        // sentence in an otherwise English conversation (Andrea, 2026-08-25).
        // The command word inside it ("NO PUSH") is what the guest must type,
        // so the translation is asked to leave it alone — and pushOptOutCommands
        // is matched case-insensitively either way.
        const hintSource = settings.pushOptOutHint.trim()
        const hint =
          askLangForCheck && askLangForCheck.toLowerCase() !== sourceLangForCheck
            ? await translateWelcome(hintSource, askLangForCheck, settings)
            : hintSource
        const already = checked.text.toLowerCase().includes(hint.toLowerCase())
        if (!already) checked.text = `${hint}\n\n${checked.text.trimStart()}`
        // Remembered on the customer, so it survives the session.
        if (customerId && input.config.handlers?.saveStayProfile) {
          await input.config.handlers.saveStayProfile({
            workspaceId: input.config.workspaceId,
            customerId,
            profile: { pushOptOutHintSent: true },
          })
        }
        if (stayProfile) stayProfile.pushOptOutHintSent = true
      }

      // The escape hatch. `reachedGuest` looks for the question's wording in
      // the reply, so a model that TRANSLATES it (which it is told to do, in
      // the guest's language) reads as a miss. Retrying forever would pin the
      // queue on one question for the rest of the holiday — the exact failure
      // the unconditional marking was protecting against. Two attempts, then
      // it is retired regardless: a question put twice has been put.
      // Everything below is about the question that ACTUALLY went out — the
      // effective one, recomputed after mid-turn saves — never the one chosen
      // at the top of the turn.
      const missedBefore = getState(sessionId).intakeMisses?.[effectiveKey ?? ''] ?? 0
      if (effectiveKey && !reachedGuest) {
        const misses = { ...(getState(sessionId).intakeMisses ?? {}) }
        misses[effectiveKey] = missedBefore + 1
        updateState(sessionId, { intakeMisses: misses }, { mirror: false })
        // eslint-disable-next-line no-console
        console.error(
          `[demosappada][intake-miss] "${effectiveKey}" dictated but not asked (${missedBefore + 1})`
        )
      }
      const retireAnyway = missedBefore >= 1

      if (effectiveKey && (reachedGuest || retireAnyway) && stayEnabled && customerId && input.config.handlers?.saveStayProfile) {
        const already = new Set(stayProfile?.asked ?? [])
        const profile: StayProfile = {}
        const before = already.size
        already.add(effectiveKey)
        if (already.size > before) {
          profile.asked = Array.from(already)
        }
        if (effectiveKey === 'consent' && !stayProfile?.consentAsked) {
          profile.consentAsked = true
        }
        // Same put-marks-it rule as consent: the remote prospect's needs
        // question is conversation-opening, not data-collecting — once it has
        // reached them the intake is over for this guest.
        if (effectiveKey === 'remoteNeeds' && !stayProfile?.remoteNeedsAsked) {
          profile.remoteNeedsAsked = true
        }
        if (effectiveKey === 'itinerary' && !stayProfile?.itinerary) {
          // 'asked' rather than yes/no: the answer, when it comes, overwrites
          // this with what they actually chose.
          profile.itinerary = 'asked'
        }
        if (Object.keys(profile).length > 0) {
          await input.config.handlers.saveStayProfile({
            workspaceId: input.config.workspaceId,
            customerId,
            profile,
          })
        }
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
        const sendVideo = isNew && !getState(sessionId).videoSent && !stayProfile?.videoSent
        // 🌍 The greeting is translated into the language the model ACTUALLY
        // replied in (⟦LANG:xx⟧, committed just above), never into the seeded
        // one. The seed comes from the browser's Accept-Language, and a guest
        // reaching an English browser and typing "Ciao" got the welcome in
        // English stapled on top of an Italian reply — two languages in one
        // message (Andrea, 2026-08-25).
        //
        // `lang` is this turn's declaration; the state is the fallback for a
        // turn where the model emitted no marker at all.
        const replyLang = lang
          ? resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
          : getState(sessionId).language
        // When the welcome hosts {{firstQuestion}}, the question belongs THERE
        // and must not also trail the reply: the tenant placed it, so this
        // strips the copy the turn had already appended.
        const questionForWelcome = (questionTranslated ?? effectiveQuestion ?? '').trim()
        const welcomeHostsQuestion =
          !!welcomeText && /\{\{\s*firstQuestion\s*\}\}/i.test(welcomeText)
        if (welcomeHostsQuestion && questionForWelcome) {
          finalReply = finalReply.split(questionForWelcome).join('').replace(/\n{3,}/g, '\n\n').trim()
        }

        finalReply = await withWelcome(
          finalReply,
          welcomeText,
          sendVideo ? settings.welcomeVideoUrl : undefined,
          replyLang,
          settings,
          knownName,
          questionForWelcome,
        )
        if (sendVideo) {
          updateState(sessionId, { videoSent: true }, { mirror: false })
          if (customerId && input.config.handlers?.saveStayProfile) {
            await input.config.handlers.saveStayProfile({
              workspaceId: input.config.workspaceId,
              customerId,
              profile: { videoSent: true },
            })
          }
        }
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
      } else if (name === 'save_preferences') {
        if (!stayEnabled || !customerId) {
          toolOutput = JSON.stringify({ ok: false, error: 'no_customer' })
        } else {
          const args = safeParseArgs(call.function.arguments)
          const profile: StayProfile = {}

          // 🚨 Facts come from the GUEST, never from the model's imagination.
          //
          // Asked nothing more than "Ciao", the model called save_preferences
          // with adults:1 and a departure date it had made up — and everything
          // downstream believed it: the intake skipped its first question, and
          // the card the Pro Loco reads described a holiday nobody had
          // described (Andrea, 2026-08-25).
          //
          // A greeting carries no facts. Measured on LENGTH alone — one or two
          // words cannot state a party size and a date — so nothing here reads
          // WHAT was written and it holds in every language (CLAUDE.md §14).
          // Fields the guest cannot state in passing are refused; the ones the
          // code itself owns (`asked`, `notes`) are unaffected.
          const guestStatedFacts = userMessage.trim().split(/\s+/).length >= 2
          const num = (v: unknown) =>
            guestStatedFacts && typeof v === 'number' && v >= 0 ? Math.round(v) : undefined
          const str = (v: unknown) =>
            guestStatedFacts && typeof v === 'string' && v.trim() ? v.trim() : undefined

          profile.adults = num(args.adults)
          profile.children = num(args.children)
          profile.childrenAges = str(args.childrenAges)

          // Where the guest stands with Sappada — the branch the whole intake
          // hangs on (contratto.md, 2026-08-27). A closed enum: anything else
          // the model invents is dropped, and the location question simply
          // stays open.
          if (
            typeof args.presence === 'string' &&
            ['in_loco', 'remote', 'planned'].includes(args.presence)
          ) {
            profile.presence = args.presence as StayProfile['presence']
          }

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
          // Appended for the same reason as constraints: what they enjoy comes
          // out over several turns, and a replacing write would lose the first.
          const interest = str(args.interests)
          if (interest) {
            const previous = stayProfile?.interests?.trim()
            profile.interests =
              previous && !previous.toLowerCase().includes(interest.toLowerCase())
                ? `${previous}; ${interest}`
                : interest
          }
          profile.seniors = num(args.seniors)

          // 📅 Dates are accepted only with PROVENANCE. From "siamo due
          // adulti" the model invented arrivo 25/8 and partenza 30/8, and the
          // machine — reading fields — believed the dates were answered and
          // never asked them (2026-08-25). So the tool demands the customer's
          // exact words (`dateSaidAs`) and verifies they really appear in the
          // message. The code reads no meaning — the model does the reading,
          // the code checks the quote exists (§14): a hallucinated date has
          // no quote to survive on.
          const dateQuote = str(args.dateSaidAs)
          // Verified by TOKEN PREFIX, not exact substring: the guest wrote
          // "fino a domenic" (typo), the model quoted the normalized
          // "fino a domenica", and an exact match rejected a real answer
          // (2026-08-25). A quote passes when at least one of its longer
          // words (≥4 chars) shares a 4-char prefix with a word the guest
          // actually typed — typos survive, inventions ("5 giorni" out of
          // "siamo due adulti") still have no word to anchor to.
          const tokensOf = (t: string): string[] =>
            t
              .toLowerCase()
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .split(/\s+/)
              .filter((w) => w.length >= 4)
          const msgTokens = tokensOf(userMessage)
          const quoteAnchored =
            !!dateQuote &&
            tokensOf(dateQuote).some((q) =>
              msgTokens.some((m) => m.slice(0, 4) === q.slice(0, 4))
            )
          // On the turns that ASK for the dates (party/stay) the quote is
          // optional: the guest's reply is the date, and gpt-4o-mini simply
          // never sends dateSaidAs, so requiring it there rejected every real
          // answer and looped the question (2026-08-25). Elsewhere the quote
          // stays mandatory — that is where the invented 25-30 agosto came
          // from.
          const dateTurn = questionsShown.includes('party') || questionsShown.includes('stay')
          const dateQuoteOk = quoteAnchored || dateTurn
          const datesRefused = !!(args.arrivalDate || args.departureDate) && !dateQuoteOk
          if (datesRefused) {
            // eslint-disable-next-line no-console
            console.error(
              `[demosappada][date-guard] refused dates — quote ${dateQuote ? `"${dateQuote}" not in message` : 'missing'}`
            )
          }
          profile.arrivalDate = dateQuoteOk ? str(args.arrivalDate) : undefined
          profile.departureDate = dateQuoteOk ? str(args.departureDate) : undefined
          profile.origin = str(args.origin)

          // Appended, never replaced: each visit adds to the list of what they
          // have seen, and a write that overwrote it would make the assistant
          // forget everything but the last thing.
          const done = str(args.doneAlready)
          if (done) {
            const previous = stayProfile?.doneAlready?.trim()
            profile.doneAlready = previous && !previous.includes(done) ? `${previous}; ${done}` : done
          }

          // An ANSWER to the itinerary question is only accepted once that
          // question has actually been put. The model was writing
          // itinerary:'yes' while answering the PUSH consent — one "si" in the
          // conversation, attributed to the wrong question — and the itinerary
          // was then treated as accepted and never asked at all (Andrea,
          // 2026-08-25: "non mi hai chiesto di fare l'itinerario?").
          //
          // Same rule as `asked` above: the model reports answers, the code
          // decides which questions exist.
          const itineraryAnswer = str(args.itinerary)
          const itineraryWasPut =
            stayProfile?.itinerary === 'asked' || questionsShown.includes('itinerary')
          if ((itineraryAnswer === 'yes' || itineraryAnswer === 'no') && itineraryWasPut) {
            profile.itinerary = itineraryAnswer
          } else if (itineraryAnswer) {
            // eslint-disable-next-line no-console
            console.error(`[demosappada][itinerary-guard] refused "${itineraryAnswer}" — never asked`)
          }

          // Overwritten whole, unlike doneAlready: the card is one paragraph
          // rewritten as the picture changes, and appending would turn it into
          // the log it is explicitly not.
          profile.notes = str(args.notes)

          // `asked` is NOT accepted from the model — the CODE marks it, after
          // the question has actually reached the guest (the block after
          // composeIntakeTurn).
          //
          // Every model-side variant failed live: unfiltered, it retired
          // questions never pronounced (consent vanished, 2026-08-24);
          // filtered to the dictated key, it marked the question AT SAVE TIME
          // — before it went out — so the machine, re-consulted mid-turn,
          // believed it already asked and skipped ahead ("E fino a quando vi
          // fermate?" as the very first question, 2026-08-25). Ownership is
          // the fix, not a better filter: the model reports ANSWERS, the code
          // decides which questions exist and when they were put.
          const saved = await input.config.handlers!.saveStayProfile!({
            workspaceId: input.config.workspaceId,
            customerId,
            profile,
          })
          if (saved) stayWasSaved = true

          // 🚨 Keep the in-memory profile in step with what was just written.
          //
          // `stayProfile` is loaded once at the top of the turn, and every
          // guard downstream reads it — including the one that decides whether
          // to ask about children. A guest who answered "ci sono 2 bambini"
          // had that saved HERE, but the guard was still looking at the stale
          // copy and asked "ci sono bambini o anziani?" in the very next
          // breath (Andrea, 2026-08-25: "ma come mi chiedi se ci sono
          // bambini? hai uno storico? uno state?").
          //
          // Merged, not replaced: `profile` carries only the fields this call
          // touched, and the rest of what we know must survive.
          if (saved) {
            // Merged the way the HOST merges: undefined never overwrites. A
            // plain spread let a refused date (profile.departureDate =
            // undefined) wipe the one already in memory — the DB kept it, the
            // turn forgot it, and the guest was asked the dates again with
            // the answer sitting in the database (2026-08-25).
            const cleaned: Partial<StayProfile> = {}
            for (const [k, v] of Object.entries(profile)) {
              if (v !== undefined && v !== null && v !== '') (cleaned as Record<string, unknown>)[k] = v
            }
            stayProfile = { ...(stayProfile ?? {}), ...cleaned }
          }

          // The refusal travels IN the tool output — the tool refuses, the
          // model corrects (iron rule 2). Silently dropping the dates left
          // the model believing they were saved, so it never resent them and
          // the machine kept asking the guest (2026-08-25).
          const dateNote = datesRefused
            ? ' ATTENZIONE: arrivalDate/departureDate SCARTATE — rimanda save_preferences aggiungendo ' +
              "dateSaidAs con le parole ESATTE del cliente che dicono le date (es. \"fino a domenica\")."
            : ''
          toolOutput = JSON.stringify({
            ok: saved,
            instruction:
              (done
                ? 'Saved. Now ask briefly how it went — one short question, in their language. Their answer ' +
                  'goes to save_feedback. Do not ask again about something already recorded.'
                : 'Saved. Do not thank them for the information or repeat it back: just carry on helping.') +
              dateNote,
          })
        }
      } else if (name === 'save_itinerary') {
        if (!stayEnabled || !customerId) {
          toolOutput = JSON.stringify({ ok: false, error: 'no_customer' })
        } else {
          const args = safeParseArgs(call.function.arguments)
          const plan = typeof args.plan === 'string' ? args.plan.trim() : ''
          // A multi-day plan built without ever checking get_weather is a plan
          // built on guesses — the one thing this bot's itinerary is FOR
          // (§ "L'itinerario" of the main prompt: "il meteo sta DENTRO la
          // frase, come motivo del consiglio"). The prompt already says so at
          // length, and the model still shipped four dry days with no
          // forecast in any of them (Andrea, 2026-08-26: "hai incrociato
          // tempo e eventi e preferenze?"). A guard here is deterministic
          // proof instead of one more sentence to ignore (iron rule 1): the
          // weather cache is keyed per session and fresh within the clock
          // hour (see fetchWeather above), so an empty/stale entry means
          // get_weather was never actually called for this guest THIS turn.
          const weatherChecked =
            !weatherEnabled ||
            weatherCache.get(sessionId)?.hourKey === sappadaHourKey(now)
          if (plan && !weatherChecked) {
            toolOutput = JSON.stringify({
              ok: false,
              error: 'weather_not_checked',
              instruction:
                'Call get_weather FIRST, then rebuild the plan around what it actually says for each day, ' +
                'and call save_itinerary again. Do not save a plan that never consulted the forecast.',
            })
          } else if (!plan) {
            toolOutput = JSON.stringify({ ok: false, error: 'empty_plan' })
          } else {
            const saved = await input.config.handlers!.saveStayProfile!({
              workspaceId: input.config.workspaceId,
              customerId,
              profile: { itineraryPlan: plan, itinerary: 'yes' },
            })
            toolOutput = JSON.stringify({
              ok: saved,
              instruction:
                'Plan saved. Do not read it back to the customer — they just agreed to it. Carry on.',
            })
          }
        }
      } else if (name === 'save_push_consent') {
        if (!customerId || !input.config.handlers?.savePushConsent) {
          toolOutput = JSON.stringify({ ok: false, error: 'no_customer' })
        } else {
          const args = safeParseArgs(call.function.arguments)
          const granted = args.granted === true
          if (granted) consentJustGranted = true
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
            const wanted = (topic: string): boolean => granted && topics.includes(topic)
            const byTopic: Array<[string, string]> = [
              ['events', TAG_INTEREST_EVENTS],
              ['lodging', TAG_INTEREST_LODGING],
              ['offers', TAG_INTEREST_OFFERS],
            ]
            // Two consents, two tags. DURING the stay it is INLOCO — kept in
            // sync from the dates, so a "cena stasera" campaign only reaches
            // whoever is actually here. On the way home it is the RENEWAL:
            // "vuoi che ti invii offerte per la prossima vacanza?" — a
            // different promise, for a guest who is leaving (contratto.md).
            //
            // Told apart by the calendar, never by the model: the holiday is
            // over or on its last day.
            const daysLeft = daysLeftInStay(stayProfile, now)
            const isRenewal = daysLeft !== null && daysLeft <= 0
            await input.config.handlers.setCustomerTags({
              workspaceId: input.config.workspaceId,
              customerId,
              add: [
                ...byTopic.filter(([topic]) => wanted(topic)).map(([, tag]) => tag),
                ...(granted && isRenewal ? [TAG_NOT_IN_LOCO] : []),
              ],
              remove: [
                ...byTopic.filter(([topic]) => !wanted(topic)).map(([, tag]) => tag),
                // The renewal replaces "is here now": they are on their way out.
                ...(isRenewal ? [TAG_IN_LOCO] : []),
                ...(granted ? [] : [TAG_NOT_IN_LOCO]),
              ],
            })
          }

          toolOutput = JSON.stringify({
            ok: saved,
            // The opt-out line is NOT requested here: the code prepends it to
            // this turn's reply (see `consentJustGranted`). Asking the model
            // for it is what made it arrive a turn late, attached to the
            // wrong answer (Andrea, 2026-08-24).
            instruction: granted
              ? 'Consent recorded. Do NOT thank them for it or mention it again — a line about it is ' +
                'added automatically. Just carry on with the answer.'
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

          // Recorded on the stay too: the prompt is told not to ask twice, but
          // only the profile can tell it whether it already has an answer.
          if (saved && input.config.handlers.saveStayProfile) {
            await input.config.handlers.saveStayProfile({
              workspaceId: input.config.workspaceId,
              customerId,
              profile: {
                feedbackGiven: true,
                ...(comment ? { lastFeedback: comment } : {}),
              },
            })
          }
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
          // 🌍 A tool that changed the customer's language must change it HERE
          // too. The host writes `customers.language`, but the conversation
          // runs on session state — so without this the reply after "voglio
          // parlare in inglese" came back in Italian, and the new language
          // only took effect on the NEXT visit (contratto.md: "al cambio di
          // lingua fai partire la CF che aggiorna").
          //
          // Filtered through the enabled list: a language the tenant does not
          // serve falls back to the default rather than being spoken badly.
          const changedLanguage =
            result.data && typeof result.data === 'object' && 'language' in result.data
              ? String((result.data as { language?: unknown }).language ?? '')
              : ''
          if (changedLanguage) {
            const resolved = resolveEnabledLanguage(
              changedLanguage,
              settings.enabledLanguages,
              settings.defaultLanguage,
            )
            commitLanguageFromReply(sessionId, resolved)
            // eslint-disable-next-line no-console
            console.error(`[demosappada][language] switched to ${resolved} via ${name}`)
          }

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

  // Hop budget exhausted. If the model wrote something before the forced save
  // took its last hop, send that rather than nothing: an answer the guest can
  // read beats silence, and silence is what they got (2026-08-23).
  if (pendingReply.trim()) {
    const { reply, lang } = extractLanguage(pendingReply)
    const checked = stripUnverifiableContacts(reply, approvedContent)
    checked.text = stripWeatherHedges(checked.text)
    {
      const inv = stripInventedLists(checked.text, approvedContent)
      if (inv.removed.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][invented-list] dropped ${inv.removed.length} fabricated line(s)`)
        checked.text = inv.text
      }
    }
    if (contentMediaAllowed(greeting, sessionId, stayProfile, settings, now, !!questionShown)) {
      checked.text = withFaqMedia(checked.text, faqs, userMessage, [settings.welcomeVideoUrl ?? ''])
    }
    // Same repair as the normal path (§3128): a heavy turn — an itinerary is
    // the prime example, several tool hops before any text — is exactly the
    // one most likely to exhaust the hop budget and land HERE, so skipping
    // the language check on this path is skipping it on the turns that need
    // it most. Missing here let a Spanish-opened itinerary finish in Italian
    // (Andrea, 2026-08-26: "apri in spagnolo e finisci in italiano").
    if (lang) {
      const fallbackTarget = resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
      if (checked.text && looksLikeWrongLanguage(checked.text, fallbackTarget)) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][lang-fix] (fallback) declared=${fallbackTarget} but reply was not`)
        checked.text = await translateText(checked.text, fallbackTarget, settings)
      }
    }
    // Same composition as the normal path: a turn that ran out of hops must
    // not be shaped by different rules than one that did not.
    if (questionShown) {
      const fallbackLang = lang
        ? resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
        : getState(sessionId).language
      const sourceLang = (settings.defaultLanguage || 'it').toLowerCase()
      // Same recompute as the normal path: the question that goes out is the
      // one the machine picks against the profile as it stands NOW.
      const freshStep = nextIntakeStep({
        profile: stayProfile,
        asked: new Set(stayProfile?.asked ?? []),
        knownName,
      })
      const fallbackKey = freshStep?.key ?? null
      const fallbackQuestion = freshStep
        ? intakeQuestionFor(freshStep.key as IntakeKey, settings)
        : null
      const translated =
        fallbackQuestion && fallbackLang && fallbackLang.toLowerCase() !== sourceLang
          ? await translateWelcome(fallbackQuestion, fallbackLang, settings)
          : fallbackQuestion
      const turn = composeIntakeTurn({
        reply: checked.text,
        key: fallbackKey,
        question: fallbackQuestion,
        questionTranslated: translated,
        // The full aside probe (parseParty/nextWeekdayDate) lives inside the
        // hop loop and is out of scope here; this reduced shape errs toward
        // KEEPING the model's prose — on this exhausted-budget path a kept
        // answer is always safer than a discarded one.
        guestAsked:
          guestAskedSomething(userMessage) ||
          (userMessage.trim().split(/\s+/).length >= 3 &&
            !/\d/.test(userMessage) &&
            !/^(s[iì]|no|ok|yes|nein|ja)\.?$/i.test(userMessage.trim())),
        closingLine: settings.closingLine,
        intakeOpen: !!freshStep,
      })
      checked.text = turn.text
      if (turn.dropped.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][intake-turn] dropped: ${turn.dropped.join(' | ').slice(0, 200)}`)
      }
    }
    if (lang) {
      commitLanguageFromReply(
        sessionId,
        resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage),
      )
    }
    if (checked.text.trim()) {
      return {
        reply: checked.text,
        language: getState(sessionId).language,
        tokensUsed,
        answeredFromFaq,
      }
    }
  }

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
  if (messages?.unsubscribed?.trim()) settings.unsubscribedMessage = messages.unsubscribed.trim()

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
