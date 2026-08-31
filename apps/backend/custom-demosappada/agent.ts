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
import { nextIntakeStep } from './intake-machine.js'
import { getSappadaWeather, TIMEZONE, type WeatherReport } from './weather.js'
import { MAX_TOOL_HOPS, WELCOME_BACK_STALE_MS } from './bounds.js'
// Relative on purpose, like the scheduler's import of the same file: this
// module is loaded at RUNTIME via tsx's tsImport, which does not resolve
// tsconfig path aliases — '@shared/stay-inloco' compiled fine and then took
// production down at import time ("Cannot find package '@shared/stay-inloco'",
// Heroku, 2026-08-27), every message falling through to the deprecated flow
// engine's hardcoded English greeting.
//
// shared/package.json declares "type": "module" precisely so this import
// works: without it tsx compiled the shared file as CommonJS and the ESM
// side could not see its named exports.
import { isCurrentlyInTown, TAG_IN_LOCO } from '../../../shared/stay-inloco.js'
import { CACHE_BREAK, callLLM, LLM_DEBUG, safeParseArgs, type Message } from './llm.js'
import {
  contentMediaAllowed,
  countNamedSubjects,
  formatFaqBlock,
  replyIsDetailAnswer,
  selectRelevantFaqs,
  withFaqMedia,
} from './faq-media.js'
import { greetingLanguage, looksLikeWrongLanguage } from './language-guards.js'
import { translateText, translateWelcome, withWelcome } from './welcome.js'
import { renderIntakeQuestion } from './intake-question.js'
import { parseParty } from './party-parse.js'
import { isRuleOutOnly, membersAnchored, partyTotal, quoteAnchoredIn, rulesOutParty, withinQuoteAnchoredCap } from './provenance.js'
import {
  classifyTurn,
  composeIntakeTurn,
  holdRepeatedQuestion,
  intakeQuestionLacksExamples,
  renderPromptVariables,
  replyLacksSubstance,
  stripInventedLists,
  stripSaveAcknowledgment,
  stripTrailingOffers,
  stripWeatherHedges,
} from './intake-compose.js'
import {
  daysLeftInStay,
  formatStayBlock,
  intakeQuestionFor,
  isStayOverAndClosed,
  rolloverStay,
  ALL_INTEREST_TAGS,
  TAG_PLANNED_VISIT,
  TAG_WITH_CHILDREN,
  TAG_NOT_IN_LOCO,
  TAG_REMOTE_PROSPECT,
  type IntakeKey,
} from './stay.js'

// Split out of this file on 2026-08-27 (it had reached 4,400 lines): the
// helpers live beside the concern they serve, the public surface of the
// module is unchanged — formatStayBlock and its types are re-exported below.
export { formatStayBlock } from './stay.js'
export type { IntakeKey, StayBlock } from './stay.js'

// ── Settings ──────────────────────────────────────────────────────────────
// Every value comes from the DB via chatbot-settings-json.service.ts, which
// re-renders settings.json on each workspace save. The defaults here exist so
// a missing key never crashes a turn — never so a tenant string lives in code
// (CLAUDE.md §1A).

export interface Settings {
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
  intakeQuestions?: Partial<Record<IntakeKey, string>> & {
    /** Singular wording for `childrenAges` when exactly one child is on the card. */
    childAge?: string
  }
  /**
   * One line put BEFORE the first intake question of a stay ("Permettimi di
   * farti qualche domanda per consigliarti meglio…"), so the questions that
   * follow read as a favour asked, not a form. Content, tenant-owned (§1A);
   * sent once per stay (`intakeIntroSent`), translated like the questions.
   */
  intakeIntro?: string
  /**
   * Which turn implementation runs: 'v1' the single-call loop in this file,
   * 'v2' the four-step turn in turn.ts (docs/turn-design.md). Defaults to
   * v2; 'v1' is the fallback for one release, then removed.
   */
  turnEngine?: 'v1' | 'v2'
  /**
   * What the guest reads when they asked for something the assistant has no
   * data for. Configuration, translated at runtime; absent → the answer is
   * simply the next question (§1A: never an English literal).
   */
  noDataMessage?: string
  /**
   * The line that opens the intake's closing turn, with {{customerName}}:
   * "Perfetto {{customerName}}!" (contratto.md). Prepended by code when the
   * model did not open with the name; absent → nothing is prepended.
   */
  closingGreeting?: string
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
  /**
   * How the itinerary-delivery message ends, after the plan — e.g. "Vuoi
   * consigli su dove andare a mangiare prodotti tipici locali?".
   *
   * Appended by CODE on the turn save_itinerary first succeeds, once per
   * stay; the model's own trailing offers ("se avete domande, fatemelo
   * sapere") are stripped on the same turn (Andrea, 2026-08-27). Configuration,
   * not a literal (§1A): with nothing configured, nothing is appended.
   */
  itineraryClosingQuestion?: string
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
  /** True once `settings.intakeIntro` has gone out — once per stay, cleared by the rollover. */
  intakeIntroSent?: boolean
  /** 'yes' | 'no' — whether they wanted an itinerary. Asked once. */
  itinerary?: string
  /**
   * True once the configured itinerary closing question has been appended to
   * a delivered plan. Once per stay, like pushOptOutHintSent: the model
   * re-saves the plan on every change, and re-appending the question each
   * time would read like a script. Cleared by the rollover with the rest of
   * the stay.
   */
  closingQuestionAsked?: boolean
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
  /**
   * What the guest asked for and has NOT fully received yet, in their own
   * words — "un'escursione max 4h, 500m dislivello, pranzo in rifugio".
   * `undefined`/absent once satisfied.
   *
   * The single replacement for a pile of per-turn heuristics that each
   * caught one shape of "the guest's words got dropped" and missed the
   * next: a bare intake question with no "?" in the message (2026-08-23), a
   * free-text answer read as a fact instead of a request ("cerchiamo un
   * albergo" filed under `constraints`, 2026-08-28), a direct question
   * answered with only a save acknowledgment ("com'è il tempo?" → "ho
   * registrato il vostro arrivo", 2026-08-28), and a request made before the
   * intake even started that never came back once the intake had something
   * else to ask (an itinerary request buried under "fino a quando vi
   * fermate?", 2026-08-28: "non hai risposto alla domanda").
   *
   * The MODEL declares it via save_preferences — the code reads no intent
   * from the guest's words (§14), it only keeps what the model reported
   * pending in front of the model on every turn until it reports it
   * resolved (contratto.md: "devi rispondere e poi portare l'utente a
   * rispondere alle tue domande" — never the reverse, and never skipped).
   */
  pendingRequest?: string
  /**
   * True when `pendingRequest` was written by CODE (the served-nothing carry),
   * not declared by the model. A code-carried request lives ONE turn: the
   * next answer with substance clears it. Left alone, a greeting carried as
   * a request ("hola que tal?") made every later turn an answer-turn owed a
   * substantive reply (sim, 2026-08-28).
   */
  pendingRequestCarried?: boolean
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
 * Render the structures for the model: who they are, how to reach them.
 *
 * Deliberately WITHOUT the price — same decision as the availability count on
 * CatalogueEntry (2026-08-22). The DB's `price` fed "prezzo indicativo da €70"
 * into every accommodation list, and nobody keeps those numbers fresh: a rate
 * that is wrong the day the guest calls reads as invented (Andrea, live,
 * 2026-08-27: "NON METTERE PREZZO INDICATIVO! QUI STAI INVENTANDO"). Dropping
 * it here also drops it from approvedContent, so a price the model invents for
 * a structure is now stripped by the content guard instead of approved by it.
 * The structure quotes its own rates when the guest calls.
 */
export function formatCatalogue(entries: CatalogueEntry[]): string {
  const lines = entries.map((e) => {
    const bits = [e.type ? `[${e.type}]` : '', e.name].filter(Boolean)
    const detail: string[] = []
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

export const OPERATING_RULES = [
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
/** True when get_weather was actually called for this session within the clock hour (save_itinerary guard). */
export function weatherCheckedThisHour(sessionId: string, now: Date): boolean {
  return weatherCache.get(sessionId)?.hourKey === sappadaHourKey(now)
}

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
export async function fetchWeather(sessionId: string, now: Date): Promise<WeatherReport> {
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
      '🚨 RULE, NO EXCEPTIONS (Andrea, 2026-08-28: "devi rispondere e poi portare l\'utente a rispondere',
      'alle tue domande"): when their message carries a request, you ALWAYS answer it FIRST — even in one',
      'short line, even generically if you do not have all their details yet ("un\'escursione così di',
      'solito ci vogliono 3-4 ore; appena so quanti siete affino il consiglio") — and ONLY THEN, at the',
      'end, ask the FIRST question from ANCORA DA CHIEDERE. Never the reverse, never skipped: a full set',
      'of six recommendations is too much, silence in front of their request is worse. If your answer',
      'this turn cannot fully serve what they asked — it needs another turn or more of their answers —',
      'call save_preferences with `pendingRequest` set to what they asked, in their own words, so it is',
      'not lost once the intake moves on; call it again with pendingRequest="RISOLTO" the moment you have',
      'actually served it.',
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
        remove: [...ALL_INTEREST_TAGS],
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
        remove: [TAG_IN_LOCO, TAG_PLANNED_VISIT],
      })
    } else if (stayProfile?.presence === 'in_loco' || stayProfile?.presence === 'planned') {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        remove: [TAG_REMOTE_PROSPECT],
      })
    }
    // The pre-arrival segment (Andrea, 2026-09-01): booked but not here yet —
    // the golden audience for "cosa trovi quando arrivi" pushes. Same
    // discipline as INLOCO: derived from the state, never set by the model,
    // and it leaves the moment the guest is actually in town.
    if (stayProfile?.presence === 'planned' && inTown !== true) {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        add: [TAG_PLANNED_VISIT],
      })
    } else if (inTown === true || stayProfile?.presence === 'in_loco') {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        remove: [TAG_PLANNED_VISIT],
      })
    }
    // Families: derived from the party in the stay profile (children count is
    // intake data the code already owns) — a family-friendly push segments on
    // this, and it corrects itself if the profile is amended.
    if (typeof stayProfile?.children === 'number') {
      await input.config.handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        ...(stayProfile.children > 0
          ? { add: [TAG_WITH_CHILDREN] }
          : { remove: [TAG_WITH_CHILDREN] }),
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

  // Ordered by stability for prompt caching (llm.ts CACHE_BREAK): what is
  // the same every turn first — the tenant's prompt and the operating rules
  // — then what changes with the turn: the FAQ subset, the clock, the guest.
  // The tenant prompt carries the guest's variables ({{party}}, {{interests}}
  // …), so it is stable across hops always and across turns whenever the
  // state did not change — most of a conversation once the intake is done.
  const systemPrompt = [
    mainPromptRendered,
    '',
    OPERATING_RULES,
    CACHE_BREAK,
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
      role: 'system',
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
  /** True when save_itinerary stored a plan on THIS turn — the delivery turn. */
  let itineraryJustSaved = false
  /** Accommodation names check_accommodation rendered for the model THIS turn. */
  const accommodationOffered: string[] = []

  // A structure counts as SHOWN only when its name is in the reply the guest
  // actually reads — the tool may render ten entries while the model lists
  // four, and marking all ten would wrongly exhaust the catalogue. Matched on
  // the name verbatim, the same way withFaqMedia requires the winner to be
  // named: nothing here reads phrasing or intent (§14).
  const recordShownAccommodations = (finalText: string): void => {
    if (accommodationOffered.length === 0 || !finalText.trim()) return
    const lower = finalText.toLowerCase()
    const shownNow = accommodationOffered.filter((n) => lower.includes(n.toLowerCase()))
    if (shownNow.length === 0) return
    const already = getState(sessionId).accommodationShown ?? []
    updateState(
      sessionId,
      { accommodationShown: [...new Set([...already, ...shownNow])] },
      { mirror: false },
    )
  }
  /** Last free-text answer the model produced, kept as a fallback. */
  let pendingReply = ''
  const carriedAtStart = !!stayProfile?.pendingRequestCarried
  let lastTurnKind: 'answer' | 'advance' | null = null
  let emptyRetryDone = false
  let droppedQuestionRetryDone = false
  let missingExamplesRetryDone = false
  /** One forecast-demand retry per turn — see the proposal-weather guard. */
  let weatherRetryDone = false
  // The ONE signal that replaces the pile of per-turn heuristics that each
  // caught a different shape of "the guest's words got dropped" and missed
  // the next one: `guestSaidAside` (off by design for free-text keys),
  // `detailAnswer`/`answersWithFacts` (only catch a place-specific or
  // link-carrying reply), the old per-turn `guestMadeRequestThisTurn`. None
  // of them survive a turn — a request made before the intake even started
  // ("un'escursione max 4h, 500m dislivello, pranzo in rifugio", answered
  // with only the welcome + first intake question) was gone two turns later,
  // once the guest had answered something else in between (Andrea,
  // 2026-08-28 live: "non hai risposto alla domanda").
  //
  // The model reports it via save_preferences.pendingRequest (§14: the code
  // reads no intent from the guest's words) and it is carried on the PROFILE,
  // not a turn-local flag, so it survives exactly as long as it needs to —
  // cleared only when the model reports the request served, or by the
  // escape hatch below if it never is.
  let pendingRequestThisTurn: string | undefined

  // 🍽️ The end of the itinerary-delivery message, shaped by CODE.
  //
  // The plan went out ending in "Se avete bisogno di ulteriori dettagli…
  // contattare l'InfoPoint…" and "Se avete domande o volete modificare
  // qualcosa, fatemelo sapere!" — model filler where the tenant's follow-up
  // belongs (Andrea, live, 2026-08-27: "da togliere; che l'itinerario finisca
  // con vuoi consigli su dove andare a mangiare prodotti tipici locali?").
  // Same mechanism as the opt-out hint: the trailing offers are stripped and
  // the configured question appended deterministically, once per stay, on the
  // turn the plan is saved (the prompt makes that the delivery turn:
  // "salvalo SUBITO con save_itinerary, nella stessa risposta").
  //
  // Shared by the normal path and the hops-exhausted fallback — an itinerary
  // is exactly the heavy turn most likely to land on the fallback.
  // `intakeQuestionWentOut` keeps the one-question rule: while an intake
  // question is going out, nothing is appended under it.
  const applyItineraryClosing = async (
    text: string,
    replyLang: string | null | undefined,
    intakeQuestionWentOut: boolean,
  ): Promise<string> => {
    if (!itineraryJustSaved || !text.trim()) return text
    const firstDelivery = !stayProfile?.closingQuestionAsked && !intakeQuestionWentOut
    const cleaned = stripTrailingOffers(text, firstDelivery)
    if (cleaned.removed.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `[demosappada][itinerary-close] dropped: ${cleaned.removed.join(' | ').slice(0, 200)}`,
      )
    }
    let out = cleaned.text
    const questionSource = settings.itineraryClosingQuestion?.trim()
    if (firstDelivery && questionSource) {
      const sourceLang = (settings.defaultLanguage || 'it').toLowerCase()
      const question =
        replyLang && replyLang.toLowerCase() !== sourceLang
          ? await translateWelcome(questionSource, replyLang, settings)
          : questionSource
      if (!out.toLowerCase().includes(question.toLowerCase())) out = `${out}\n\n${question}`
      if (customerId && input.config.handlers?.saveStayProfile) {
        await input.config.handlers.saveStayProfile({
          workspaceId: input.config.workspaceId,
          customerId,
          profile: { closingQuestionAsked: true },
        })
        if (stayProfile) stayProfile.closingQuestionAsked = true
      }
    }
    return out
  }

  // Did the model FETCH something to serve the guest this turn — the
  // forecast, the accommodation list, a tenant webhook? A code-observable
  // fact, read by classifyTurn: a turn in which content was fetched is an
  // answer turn whatever the message's shape. "cerchiamo un rifugio con
  // funivia" (5 words, no "?") was classed as a plain intake answer, and the
  // list the model had just fetched was thrown away for "E fino a quando vi
  // fermate?" (sim, 2026-08-28). Bookkeeping tools do not count.
  const BOOKKEEPING_TOOLS = new Set(['remember', 'save_preferences', 'save_itinerary', 'save_push_consent', 'save_feedback'])
  let contentFetched = false
  // Set by the ignored-message retry: on the next hop the model is offered
  // ONLY the content tools and MUST call one. Asked twice in prose to serve
  // "cerchiamo un albergo e vogliamo spendere poco", gpt-4o-mini wrote
  // filler twice and never fetched the accommodation list (sim, 2026-08-28);
  // the fix is not a third sentence but a hop with no prose allowed.
  let forceContentTool = false
  // A guard that needs ONE specific tool (the save, the forecast) forces THAT
  // tool on the next hop: with `tool_choice` set the model cannot answer the
  // note with prose — and prose was the leak: told "[SYSTEM] salva le
  // preferenze" on a greeting, a capable model wrote "I appreciate the
  // system message, but the customer's last message was just 'hello how
  // are you?'" and the composer shipped it to the guest (live 16:32,
  // 2026-08-28). The note still says WHAT to save; the hop can only save.
  let forceNamedTool: string | null = null
  // The retry needs room: the model had spent the budget on bookkeeping
  // (save_preferences, remember) before writing its filler, so the retry
  // landed on the LAST hop and the loop fell straight into the hops-exhausted
  // fallback — the forced tool hop never ran (sim, 2026-08-28). One retry
  // earns two hops: one to fetch, one to write.
  let extraHops = 0

  // v2 is the turn (docs/turn-design.md; four acceptance scenarios passed on
  // Haiku 4.5, 2026-08-28). The loop below is kept for ONE release as the
  // fallback (`turnEngine: 'v1'` in the advanced settings), then removed.
  if (settings.turnEngine !== 'v1') {
    const { runTurnV2 } = await import('./turn.js')
    return runTurnV2({
      input,
      settings,
      sessionId,
      now,
      userMessage,
      history,
      customerId,
      stayEnabled,
      stayProfile,
      knownName,
      greeting,
      returningGuest,
      faqs,
      faqBlock,
      approvedContent,
      customTools,
      weatherEnabled,
      accommodationEnabled,
      runtimeBlock,
      mainPromptRendered,
    })
  }

  for (let hop = 0; hop < maxHops + extraHops; hop++) {
    const allTools = buildTools(customTools)
    // The tool list is never changed between hops: tools render FIRST in the
    // request, so a different list on one hop invalidates the whole cached
    // prefix (measured: 14k tokens rewritten on the retry hop, 2026-08-28).
    // The retry forces "any tool" instead; the note says which.
    const hopTools = allTools
    const namedAvailable =
      !!forceNamedTool && allTools.some((t) => String((t as any)?.function?.name) === forceNamedTool)
    const result = await callLLM(
      messages,
      settings,
      hopTools,
      namedAvailable
        ? { toolChoice: { name: forceNamedTool! } }
        : forceContentTool && hopTools.length > 0
          ? { toolChoice: 'required' }
          : {},
    )
    forceNamedTool = null
    if (forceContentTool) {
      // eslint-disable-next-line no-console
      console.error(`[demosappada][forced-tool] hop ${hop}: ${hopTools.map((t) => String((t as any)?.function?.name)).join(',')} → ${result.toolCalls.map((c) => c.function.name).join(',') || 'NO CALL'}`)
    }
    forceContentTool = false
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
      // A guest ASKING something is not answering: "hola que tal?" — three
      // words and a question mark — tripped this, the model was ordered to
      // save facts that did not exist, and it argued back to the guest, in
      // Italian, in a Spanish conversation ("non hai fornito informazioni…
      // era solo un saluto", live 16:30, 2026-08-28). Shape only (§14).
      const answeredOurQuestion =
        !!questionShown && userMessage.trim().split(/\s+/).length >= 2 && !userMessage.includes('?')
      if (stayEnabled && stayToolAvailable && !stayWasSaved && !forcedSaveDone && answeredOurQuestion) {
        forcedSaveDone = true
        forceNamedTool = 'save_preferences'
        // Keep what the model already wrote: the extra hop is for the save,
        // not for a better answer, and if the hop budget runs out afterwards
        // this is what the guest gets instead of silence.
        pendingReply = result.content || pendingReply
        messages.push({ role: 'assistant', content: result.content || null })
        messages.push({
          role: 'system',
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

      // An empty closing hop falls back to the prose the model wrote earlier
      // in this turn (alongside its tool calls) before asking for more.
      const finalContent = result.content?.trim() ? result.content : pendingReply
      const { reply, lang } = extractLanguage(finalContent)
      // With an intake question dictated this turn, an empty model reply is
      // LEGITIMATE: the guest answered ("si, hasta el domingo"), the code
      // puts the next question, the model has nothing to add — and Haiku
      // 4.5 says so by writing nothing but the language tag (13 tokens,
      // twice, then `empty_reply`; sim 2026-08-28). The composer turns the
      // empty prose into the dictated question; the substance guard below
      // still catches an empty reply to a real request.
      if (!reply.trim() && !questionShown) {
        // Silence is never an acceptable answer: the guest wrote something and
        // is watching an empty bubble. It happened when the forced save ate
        // the turn (Andrea, 2026-08-23). One more hop, asked plainly. No
        // empty assistant placeholder: Anthropic rejects an empty message.
        if (!emptyRetryDone) {
          emptyRetryDone = true
          messages.push({
            role: 'system',
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
        // UNCONDITIONAL — no longer gated on stayWasSaved: the model writes
        // "Perfetto, ho salvato le tue informazioni" even on turns where the
        // save was done by the deterministic answer-capture, or by nobody
        // (2026-08-28 live, 01:37). The guest must never read it either way
        // ("LO DEVI FARE MA NON SCRIVERE").
        const noAck = stripSaveAcknowledgment(checked.text)
        if (noAck && noAck !== checked.text) {
          // eslint-disable-next-line no-console
          console.error('[demosappada][save-ack] dropped save acknowledgment opener')
          checked.text = noAck
        }
      }
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
          role: 'system',
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

      // GUARD: the guest's message could carry a request and the reply has no
      // substance beyond bookkeeping — an ack, a filler offer, or the dictated
      // question itself. Their words were dropped — the one failure that makes
      // people stop writing. One more hop, spent answering them.
      //
      // `replyLacksSubstance` replaces the narrower `isBareIntakeQuestion`
      // here: that one only caught a reply that WAS the question, so "Ho
      // registrato il vostro arrivo... Se hai bisogno di suggerimenti,
      // fammelo sapere!" sailed past it (no "?", not short) while "com'è il
      // tempo?" went unanswered (Andrea, 2026-08-28 live).
      //
      // ONE authority decides what kind of turn this is — see classifyTurn
      // (intake-compose.ts). The guard here, the composer below and the
      // hops-exhausted fallback all read THIS value: tonight's regressions
      // were each a pair of them deciding "did the guest bring content?"
      // from different signals and disagreeing (Andrea, 2026-08-28: "non
      // voglio accrocchi, voglio un bel design pattern").
      //
      // `machineAdvanced` is measured on the profile as it stands NOW — the
      // model's mid-turn saves included. `hasPendingRequest` covers both the
      // request declared THIS turn and one still carried from earlier turns.
      const turnKind = classifyTurn(userMessage, {
        machineAdvanced:
          nextIntakeStep({
            profile: stayProfile,
            asked: new Set(stayProfile?.asked ?? []),
            knownName,
          })?.key !== questionShown,
        hasPendingRequest: !!pendingRequestThisTurn || !!stayProfile?.pendingRequest,
        contentFetched,
      })
      lastTurnKind = turnKind
      if (
        !droppedQuestionRetryDone &&
        turnKind === 'answer' &&
        replyLacksSubstance(checked.text, dictatedQuestion)
      ) {
        droppedQuestionRetryDone = true
        forceContentTool = true
        extraHops = 2
        // eslint-disable-next-line no-console
        console.error('[demosappada][guard] guest message ignored — retrying')
        pendingReply = result.content || pendingReply
        messages.push({ role: 'assistant', content: result.content || null })
        messages.push({
          role: 'system',
          content:
            '[SYSTEM] Hai risposto solo con una tua domanda, ignorando quello che il cliente ha ' +
            'scritto. Riscrivi la risposta: PRIMA rispondi a quello che ha detto o chiesto — usa i ' +
            'tool: check_accommodation se cerca dove dormire (hotel, rifugio, B&B, appartamento), ' +
            'get_weather per il meteo; se non hai il dato, dillo apertamente e indica dove trovarlo ' +
            '(InfoPoint 0435 469131 o il sito ufficiale) — e SOLO DOPO, in coda, rimetti la tua ' +
            'domanda in una riga.',
        })
        continue
      }

      // The retry above is one hop and the model may waste it — the same
      // opening request got its answer at 01:37 and lost it at 01:39, same
      // code, same message (gpt-4o-mini simply not complying twice in a
      // row). The DETERMINISTIC net: a served-nothing answer-turn writes the
      // guest's message itself into `pendingRequest` — verbatim, no reading
      // of meaning (§14) — so the next turn's prompt opens with RICHIESTA IN
      // SOSPESO and the request survives the model's bad turn instead of
      // vanishing. The model's own declaration, when it made one, wins.
      if (
        droppedQuestionRetryDone &&
        turnKind === 'answer' &&
        replyLacksSubstance(checked.text, dictatedQuestion) &&
        !pendingRequestThisTurn &&
        !stayProfile?.pendingRequest &&
        stayEnabled &&
        customerId &&
        input.config.handlers?.saveStayProfile
      ) {
        const carried = userMessage.trim().slice(0, 200)
        // eslint-disable-next-line no-console
        console.error('[demosappada][pending-carry] request carried to next turn')
        await input.config.handlers.saveStayProfile({
          workspaceId: input.config.workspaceId,
          customerId,
          profile: { pendingRequest: carried, pendingRequestCarried: true },
        })
        stayProfile = { ...(stayProfile ?? {}), pendingRequest: carried, pendingRequestCarried: true }
      }

      // GUARD: a PROPOSAL turn that never consulted the forecast. Same
      // mechanism save_itinerary already has (weather_not_checked): the
      // product promise is crossing meteo × preferences × schede, and the
      // weekend excursions went out with no forecast at all — then the next
      // turn quoted "domani" at a guest arriving NEXT weekend (Andrea,
      // 2026-08-28 live, 01:37: "non vedo che mi dici nulla sul meteo").
      // Proposal shape is measured by IDF overlap (two or more FAQ places
      // featured), never by reading the guest's words (§14). One hop, once.
      if (
        !weatherRetryDone &&
        weatherEnabled &&
        turnKind === 'answer' &&
        weatherCache.get(sessionId)?.hourKey !== sappadaHourKey(now) &&
        countNamedSubjects(checked.text, faqs) >= 2
      ) {
        weatherRetryDone = true
        forceNamedTool = 'get_weather'
        // eslint-disable-next-line no-console
        console.error('[demosappada][guard] proposals without forecast — retrying with get_weather')
        pendingReply = checked.text || pendingReply
        messages.push({ role: 'assistant', content: result.content || null })
        messages.push({
          role: 'system',
          content:
            '[SYSTEM] Stai proponendo attività senza aver consultato il meteo. Chiama ORA get_weather ' +
            'e riscrivi la STESSA proposta incrociando le condizioni dei giorni della permanenza — il ' +
            'meteo sta dentro la frase, come motivo del consiglio. Se il bollettino non copre i giorni ' +
            'della visita, dillo in una riga e consiglia in base alla stagione.',
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
        } else if (
          (captureKey === 'constraints' || captureKey === 'interests') &&
          !detailAnswer &&
          !answersWithFacts &&
          !pendingRequestThisTurn
        ) {
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
          // The constraints wording (settings, tenant-owned) asks about
          // children and seniors in the same breath as the other limits.
          // "no nessuna" answers ALL of it — but the machine keeps
          // `composition` as its own step, so the negative was recorded as a
          // constraint only and "Ci sono bambini o anziani?" went out at a
          // guest who had just said no (Andrea, 2026-08-28 live, 14:40).
          // Same rule-out capture as the composition branch below, on this
          // turn too. A guest who named children instead ("2 bimbi") is read
          // by parseParty, not zeroed.
          if (
            captureKey === 'constraints' &&
            stayProfile?.children === undefined &&
            stayProfile?.seniors === undefined &&
            rulesOutParty(verbatim)
          ) {
            const party = parseParty(userMessage)
            if (party.children === undefined && party.seniors === undefined) {
              captured.children = 0
              captured.seniors = 0
            }
          }
        } else if (captureKey === 'consent' && !stayProfile?.consentAsked) {
          // The consent answer is captured by CODE, like every other answer
          // to a dictated question: the question was put, whatever they
          // said it is answered (asked once, never again). A bare yes/no —
          // the §14 closed class — also records the grant itself, so the
          // opt-in does not hang on the model calling save_push_consent.
          captured.consentAsked = true
          const yes = /^(s[iì]|yes|ja|oui|s[ií]|ok|okay|va bene|certo)\.?!?$/i.test(verbatim)
          const no = /^(no|nein|non|nope)\.?!?$/i.test(verbatim)
          if ((yes || no) && input.config.handlers?.savePushConsent) {
            await input.config.handlers.savePushConsent({
              workspaceId: input.config.workspaceId,
              customerId,
              granted: yes,
            })
            if (yes) consentJustGranted = true
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
        // A FIRST message that says everything ("io e mio marito vogliamo
        // vedere Sappada e non abbiamo la macchina") also states the
        // interests: their words fill the field, or the interests question
        // comes back at someone who already answered it (2026-08-25). This
        // rule used to live inside the party/headcount branch — dead since
        // `location` became the first question — and "Cosa ti piacerebbe
        // fare? Visitare Sappada…" went out at a guest who had just written
        // "vogliamo vedere Sappada" (Andrea, live 16:14, 2026-08-28). Rich
        // messages only; the LLM reads the meaning when it recommends.
        if (
          !getState(sessionId).lastAskedKey &&
          !stayProfile?.interests &&
          verbatim.split(/\s+/).length >= 6
        ) {
          captured.interests = verbatim
        }
        // People named one by one ("io e mio marito") are captured on ANY
        // turn, whatever question was pending: the opening message is where
        // guests introduce themselves, and it is answered to `location`,
        // not to `party`. Unnamed categories are 0 — the guest listed
        // everyone (Andrea, 2026-08-28: "io e mio marito = 2 persone e non
        // ci sono bambini"). Never overwrites a count already on file.
        if (probe.enumerated && stayProfile?.adults === undefined && stayProfile?.children === undefined) {
          captured.adults = probe.adults ?? 0
          captured.children = probe.children ?? 0
          captured.seniors = probe.seniors ?? 0
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
      let effectiveKey = freshStep?.key ?? null
      let effectiveQuestion = freshStep
        ? intakeQuestionFor(freshStep.key as IntakeKey, settings)
        : null
      if (effectiveKey !== questionShown) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][intake-shift] "${questionShown}" → "${effectiveKey}"`)
      }
      // The composer obeys the SAME classification as the retry guard above —
      // one authority, no second vote. The old OR of seven signals is gone:
      // its members each caught one shape and missed the next, and the
      // composer reading a different subset than the guard is how a forced
      // answer got thrown away one line later (2026-08-28 live, 01:25: the
      // excursion request met with "Perfetto. E fino a quando vi fermate?" —
      // while the 01:16 run survived only because its answer happened to
      // carry phone numbers). detailAnswer/answersWithFacts keep their real
      // jobs (media, capture stand-down); they no longer vote here.
      const guestEngaged = turnKind === 'answer'
      if (holdRepeatedQuestion(sessionId, effectiveKey, guestEngaged)) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][repeat-hold] "${effectiveKey}" held this turn`)
        effectiveKey = null
        effectiveQuestion = null
      }

      // Every fixed line the code inserts travels through the same translation
      // as the question: the closing line went out in Italian under an English
      // conversation (Andrea, 2026-08-25: "scrive in due lingue").
      // The question itself is RENDERED, not just translated: the parts the
      // profile already answers are dropped (intake-question.ts, 2026-08-28).
      let questionTranslated = effectiveQuestion
        ? await renderIntakeQuestion(effectiveQuestion, stayProfile, askLangForCheck, needsTranslation, settings)
        : effectiveQuestion
      // The configured intro line, once, ahead of the FIRST question of the
      // stay (Andrea, 2026-08-28: "non avevamo detto di fare la domanda
      // 'permettimi di farti delle domande per…'?"). Travels with the
      // question so the composer treats the pair as ours.
      const intro = settings.intakeIntro?.trim()
      const introDue = !!intro && !!questionTranslated && !stayProfile?.intakeIntroSent
      if (introDue && questionTranslated) {
        const introOut = needsTranslation && askLangForCheck ? await translateWelcome(intro!, askLangForCheck, settings) : intro!
        questionTranslated = `${introOut}\n\n${questionTranslated}`
      }
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
        guestAsked: guestEngaged,
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
      if (turn.asked && introDue && customerId && input.config.handlers?.saveStayProfile) {
        await input.config.handlers.saveStayProfile({
          workspaceId: input.config.workspaceId,
          customerId,
          profile: { intakeIntroSent: true },
        })
        stayProfile = { ...(stayProfile ?? {}), intakeIntroSent: true }
      }
      if (turn.dropped.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][intake-turn] dropped: ${turn.dropped.join(' | ').slice(0, 200)}`)
      }
      checked.text = await applyItineraryClosing(checked.text, askLangForCheck, turn.asked)
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

      recordShownAccommodations(finalReply)

      return {
        reply: finalReply || null,
        language: getState(sessionId).language,
        tokensUsed,
        answeredFromFaq,
      }
    }

    // Claude writes the answer AND calls its tools in the same message; the
    // hop after the tool results then has nothing left to say and returns
    // only the language tag (Haiku 4.5, sim 2026-08-28: output=13 tokens,
    // "empty_reply" twice in a row). gpt-4o-mini never did this, so the code
    // only ever read the LAST hop. The prose written alongside a tool call
    // is the draft answer: kept, and used when the closing hop is empty.
    if (result.content?.trim()) pendingReply = result.content
    messages.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls })

    for (const call of result.toolCalls) {
      const name = call.function.name
      let toolOutput: string
      if (!BOOKKEEPING_TOOLS.has(name)) contentFetched = true

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
        // Only the structures the guest has NOT already been given. The tool
        // used to return the full catalogue on every call, so "altri hotel?"
        // got the same three structures reshuffled (Andrea, live, 2026-08-27:
        // "chiedo altri hotel e mi ridai gli stessi"). The session remembers
        // what actually reached the guest (recordShownAccommodations below);
        // here the repeat is simply not offered — the model cannot re-list
        // what it was never given (iron rule 1).
        const shownBefore = new Set(
          (getState(sessionId).accommodationShown ?? []).map((n) => n.toLowerCase()),
        )
        const fresh = entries.filter((e) => !shownBefore.has(e.name.toLowerCase()))
        if (entries.length === 0) {
          toolOutput = JSON.stringify({
            ok: false,
            instruction:
              'No accommodation is on file. Do NOT invent any. Point the customer to the official ' +
              'accommodation page and the InfoPoint named in the FAQ block.',
          })
        } else if (fresh.length === 0) {
          toolOutput = JSON.stringify({
            ok: false,
            instruction:
              'Every structure on file has ALREADY been given to this guest. Do NOT repeat the same ' +
              'list and do NOT invent new structures: say plainly that these are all the ones on file, ' +
              'and point them to the official accommodation page in the FAQ block for the full, ' +
              'up-to-date list.',
          })
        } else {
          const rendered = formatCatalogue(fresh)
          accommodationOffered.push(...fresh.map((e) => e.name))
          approvedContent += `\n${rendered}`
          toolOutput = JSON.stringify({
            ok: true,
            accommodation: rendered,
            instruction:
              'Written in Italian as the source language — translate it. These are contacts, NOT ' +
              'availability: you have no idea whether any of them has a room free. Never say a structure ' +
              'is full, never say one has space, never say Sappada is booked out. Give the contact and ' +
              'let the customer call. You take no bookings. You have NO prices for any structure: never ' +
              'state, estimate or hint at a rate — the structure quotes its own when the guest calls.',
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

          // 👥 Party numbers with PROVENANCE, same contract as the dates
          // below: the message itself must carry a number — a digit or one of
          // the number-words parseParty reads — for the model's numbers to
          // have come from. From "VOGLIAMO VEDERE I RIFUGI" it saved adults:1,
          // children:0, seniors:0; the machine believed the headcount was
          // answered and never asked it again (Andrea, 2026-08-27 live: "tu
          // hai inventato adulti 1"). The code reads no meaning (§14): real
          // answers flow through the deterministic answer-capture regardless,
          // so only inventions are lost.
          //
          // A number is not the only way to state a party: "io e mio marito"
          // says two adults and no children in as many words, and the model
          // reads it perfectly — then this guard threw its numbers away and
          // "E in quanti siete?" went out at a guest who had just answered
          // (Andrea, 2026-08-28: "se dico io e mio marito devi capire che
          // sono 2 persone e non ci sono bambini"). So the numbers may also
          // be anchored by `partySaidAs` — the guest's exact words naming the
          // party, verified to exist in the message — the same provenance
          // contract as `dateSaidAs` below. Still no meaning read in code.
          const partyQuote = str(args.partySaidAs)
          // Zeros on a turn that ASKED about the party are the guest ruling
          // people out ("no nessuna" to the constraints/composition question)
          // — the provenance is our own question, like `dateTurn` for the
          // dates below. A positive count still needs a number or a quote.
          const partyTurn = ['party', 'headcount', 'composition', 'constraints'].some((k) =>
            questionsShown.includes(k)
          )
          const partyAnchored =
            probe.adults !== undefined ||
            probe.children !== undefined ||
            probe.seniors !== undefined ||
            /\d/.test(userMessage) ||
            // No number in the message: the count is accepted only when the
            // model can point to each person it counted (`partyMembers`),
            // every one of them in the guest's own words, up to the cap.
            (quoteAnchoredIn(partyQuote, userMessage) &&
              withinQuoteAnchoredCap(args) &&
              membersAnchored(args.partyMembers, userMessage) === partyTotal(args)) ||
            (partyTurn && isRuleOutOnly(args))
          const partyRefused =
            !partyAnchored &&
            (num(args.adults) !== undefined ||
              num(args.children) !== undefined ||
              num(args.seniors) !== undefined)
          if (partyRefused) {
            // eslint-disable-next-line no-console
            console.error(
              `[demosappada][party-guard] refused adults/children/seniors — no number in message, quote ${partyQuote ? `"${partyQuote}"` : 'missing'}, members anchored ${membersAnchored(args.partyMembers, userMessage)}/${partyTotal(args)}`
            )
          }
          profile.adults = partyAnchored ? num(args.adults) : undefined
          profile.children = partyAnchored ? num(args.children) : undefined
          // The guest ENUMERATED the party ("io e mio marito") and named no
          // child and no senior: those are 0, deterministically — the model
          // sends the zeros only sometimes (sim, 2026-08-28), and without
          // them "Ci sono bambini o anziani?" went out at a couple who had
          // just introduced themselves (Andrea: "devi capire che sono 2
          // persone e non ci sono bambini").
          const enumerated =
            !!probe.enumerated ||
            (partyAnchored &&
              !/\d/.test(userMessage) &&
              probe.adults === undefined &&
              membersAnchored(args.partyMembers, userMessage) === partyTotal(args) &&
              partyTotal(args) > 0)
          if (enumerated && profile.children === undefined) profile.children = 0
          if (enumerated && num(args.seniors) === undefined) args.seniors = 0
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

          // NOT gated on `guestStatedFacts` like the fields above: this is the
          // MODEL reporting on ITS OWN reply ("I finished serving what I was
          // carrying"), not a fact read off the guest's words, so a guest
          // reply as short as "sì" must not block it — the whole point is to
          // let a resolved request stop being carried the moment it is.
          //
          // "RISOLTO" is a deliberate CLEAR sentinel, not the guest's words:
          // the host's own merge skips empty/undefined values so a guest's
          // blank answer never erases a field an earlier turn filled in —
          // which means an ordinary empty string can never CLEAR
          // `pendingRequest` either, it would just be ignored and the OLD
          // request would stay stuck forever. Sent straight through in
          // `profile` so the host's merge (which recognises the same
          // sentinel) actually deletes it, not just this turn's copy.
          const rawPendingRequest =
            typeof args.pendingRequest === 'string' ? args.pendingRequest.trim() : ''
          if (rawPendingRequest === 'RISOLTO') {
            profile.pendingRequest = 'RISOLTO'
          } else if (rawPendingRequest) {
            profile.pendingRequest = rawPendingRequest
            pendingRequestThisTurn = rawPendingRequest
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
          profile.seniors = partyAnchored ? num(args.seniors) : undefined

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
            // the answer sitting in the database (2026-08-25). "RISOLTO"
            // (below, after the merge) mirrors the host's own CLEAR
            // sentinel: `cleaned` starts empty, so simply never copying the
            // literal string into it is enough — it must still delete the
            // key already sitting in memory from an earlier turn, which the
            // spread on its own would not touch.
            const cleaned: Partial<StayProfile> = {}
            for (const [k, v] of Object.entries(profile)) {
              if (v !== 'RISOLTO' && v !== undefined && v !== null && v !== '') {
                ;(cleaned as Record<string, unknown>)[k] = v
              }
            }
            stayProfile = { ...(stayProfile ?? {}), ...cleaned }
            if (rawPendingRequest === 'RISOLTO') stayProfile.pendingRequest = undefined
          }

          // The refusal travels IN the tool output — the tool refuses, the
          // model corrects (iron rule 2). Silently dropping the dates left
          // the model believing they were saved, so it never resent them and
          // the machine kept asking the guest (2026-08-25).
          const dateNote = datesRefused
            ? ' ATTENZIONE: arrivalDate/departureDate SCARTATE — rimanda save_preferences aggiungendo ' +
              "dateSaidAs con le parole ESATTE del cliente che dicono le date (es. \"fino a domenica\")."
            : ''
          // Same shape as dateNote (iron rule 2): a silent drop would leave
          // the model believing the numbers were saved.
          const partyNote = partyRefused
            ? ' ATTENZIONE: adults/children/seniors SCARTATI — in questo messaggio non c\'è un numero né ' +
              'partySaidAs + partyMembers (una voce per persona, con le parole ESATTE del cliente: ' +
              '["io", "mio marito"]). Se il cliente ha davvero nominato le persone, rimanda save_preferences ' +
              'con partySaidAs e partyMembers; se ha solo detto "noi" o "un gruppo" NON sai quanti sono: non inventare.'
            : ''
          toolOutput = JSON.stringify({
            ok: saved,
            instruction:
              (done
                ? 'Saved. Now ask briefly how it went — one short question, in their language. Their answer ' +
                  'goes to save_feedback. Do not ask again about something already recorded.'
                : 'Saved. Do not thank them for the information or repeat it back: just carry on helping.') +
              dateNote +
              partyNote,
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
            // `itinerary: 'yes'` only when the offer was actually PUT — the
            // same rule save_preferences enforces. The model called
            // save_itinerary on its own while chatting about rifugi, the flag
            // closed the step, and the intake ended without the offer the
            // contract closes on (Andrea, 2026-08-27 live: "alla fine non
            // chiedi se vogliono un itinerario?"). The PLAN itself is always
            // kept: a guest who asked for one spontaneously must not lose it,
            // and the still-open step guarantees the offer goes out anyway.
            const offerWasPut =
              stayProfile?.itinerary === 'asked' || questionsShown.includes('itinerary')
            if (!offerWasPut) {
              // eslint-disable-next-line no-console
              console.error("[demosappada][itinerary-guard] plan saved, 'yes' refused — offer never put")
            }
            const saved = await input.config.handlers!.saveStayProfile!({
              workspaceId: input.config.workspaceId,
              customerId,
              profile: offerWasPut
                ? { itineraryPlan: plan, itinerary: 'yes' }
                : { itineraryPlan: plan },
            })
            if (saved) itineraryJustSaved = true
            toolOutput = JSON.stringify({
              ok: saved,
              instruction:
                'Plan saved. Do not read it back to the customer — they just agreed to it. End the ' +
                'message with the plan itself: no offers of further help, no contact suggestions, no ' +
                'extra questions after it — the closing line is added automatically.',
            })
          }
        }
      } else if (name === 'save_push_consent') {
        const consentArgs = safeParseArgs(call.function.arguments)
        // A bare "si" is an answer to whatever WE just asked — "Siete già a
        // Sappada?" in the sim of 2026-08-28 — and the model filed it as a
        // push consent, so the opt-out hint went out to a guest who had
        // consented to nothing. Consent needs its question: a yes of one or
        // two words is refused unless the consent question was put (this
        // turn or before). A sentence ("sì, mandatemi gli eventi") can still
        // be a spontaneous opt-in — shape only, no reading of words (§14).
        const consentWasAsked = questionsShown.includes('consent') || !!stayProfile?.consentAsked
        const bareYes = userMessage.trim().split(/\s+/).length <= 2
        if (consentArgs.granted === true && !consentWasAsked && bareYes) {
          // eslint-disable-next-line no-console
          console.error('[demosappada][consent-guard] refused granted=true — consent not asked, bare answer')
          toolOutput = JSON.stringify({
            ok: false,
            instruction:
              'Refused: the consent question has not been asked yet, and a one-word answer cannot be a ' +
              'consent to notifications. It answers the question you just put. Do not call this again ' +
              'until the consent question is dictated.',
          })
        } else if (!customerId || !input.config.handlers?.savePushConsent) {
          toolOutput = JSON.stringify({ ok: false, error: 'no_customer' })
        } else {
          const args = consentArgs
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
            // In memory too: the machine that picks the outgoing question
            // reads THIS object. Saved only to the host, `consent` stayed
            // open and the question was appended again under the reply the
            // guest had just said "Si" to (live 16:56, 2026-08-28).
            stayProfile = { ...(stayProfile ?? {}), consentAsked: true }
          }

          // ONE consent, ALL channels (Andrea, 2026-09-01: "non abbiamo
          // distinzione — riceve tutto"): granted adds every interest tag,
          // revoked removes every one. The per-topic bookkeeping is gone —
          // a tourist on holiday wants to know, and the OFF switch (NO PUSH
          // or granted=false) always kills everything at once.
          if (input.config.handlers.setCustomerTags) {
            // Two consents, two presence tags. DURING the stay it is INLOCO —
            // kept in sync from the dates, so a "cena stasera" campaign only
            // reaches whoever is actually here. On the way home it is the
            // RENEWAL: "vuoi che ti invii offerte per la prossima vacanza?" —
            // a different promise, for a guest who is leaving (contratto.md).
            //
            // Told apart by the calendar, never by the model: the holiday is
            // over or on its last day.
            const daysLeft = daysLeftInStay(stayProfile, now)
            const isRenewal = daysLeft !== null && daysLeft <= 0
            await input.config.handlers.setCustomerTags({
              workspaceId: input.config.workspaceId,
              customerId,
              add: [
                ...(granted ? [...ALL_INTEREST_TAGS] : []),
                ...(granted && isRenewal ? [TAG_NOT_IN_LOCO] : []),
              ],
              remove: [
                ...(granted ? [] : [...ALL_INTEREST_TAGS]),
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
      // Unconditional, mirroring the main path — see the comment there.
      const noAck = stripSaveAcknowledgment(checked.text)
      if (noAck && noAck !== checked.text) {
        // eslint-disable-next-line no-console
        console.error('[demosappada][save-ack] dropped save acknowledgment opener (fallback)')
        checked.text = noAck
      }
    }
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
    let fallbackAsked = false
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
      let fallbackKey = freshStep?.key ?? null
      let fallbackQuestion = freshStep
        ? intakeQuestionFor(freshStep.key as IntakeKey, settings)
        : null
      // Same single authority as the main path — no reduced local variant:
      // the fallback keeping its own shape rules is exactly the divergence
      // classifyTurn exists to end (Andrea, 2026-08-28: "non voglio
      // accrocchi").
      const fallbackGuestEngaged =
        classifyTurn(userMessage, {
          machineAdvanced: fallbackKey !== questionShown,
          hasPendingRequest: !!pendingRequestThisTurn || !!stayProfile?.pendingRequest,
          contentFetched,
        }) === 'answer'
      if (holdRepeatedQuestion(sessionId, fallbackKey, fallbackGuestEngaged)) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][repeat-hold] "${fallbackKey}" held this turn (fallback)`)
        fallbackKey = null
        fallbackQuestion = null
      }
      // Same rendering as the main path (intake-question.ts): translated AND
      // trimmed of what the profile already answers.
      const translated = fallbackQuestion
        ? await renderIntakeQuestion(
            fallbackQuestion,
            stayProfile,
            fallbackLang,
            !!fallbackLang && fallbackLang.toLowerCase() !== sourceLang,
            settings,
          )
        : fallbackQuestion
      const turn = composeIntakeTurn({
        reply: checked.text,
        key: fallbackKey,
        question: fallbackQuestion,
        questionTranslated: translated,
        guestAsked: fallbackGuestEngaged,
        closingLine: settings.closingLine,
        intakeOpen: !!freshStep,
      })
      checked.text = turn.text
      fallbackAsked = turn.asked
      if (turn.dropped.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][intake-turn] dropped: ${turn.dropped.join(' | ').slice(0, 200)}`)
      }
    }
    checked.text = await applyItineraryClosing(
      checked.text,
      lang
        ? resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage)
        : getState(sessionId).language,
      fallbackAsked,
    )
    if (lang) {
      commitLanguageFromReply(
        sessionId,
        resolveEnabledLanguage(lang, settings.enabledLanguages, settings.defaultLanguage),
      )
    }
    if (checked.text.trim()) {
      recordShownAccommodations(checked.text)
      // A code-carried request has now been served with substance: cleared
      // by code, with the host's CLEAR sentinel (see pendingRequestCarried).
      if (
        carriedAtStart &&
        lastTurnKind === 'answer' &&
        !replyLacksSubstance(checked.text, dictatedQuestion) &&
        customerId &&
        input.config.handlers?.saveStayProfile
      ) {
        await input.config.handlers.saveStayProfile({
          workspaceId: input.config.workspaceId,
          customerId,
          profile: { pendingRequest: 'RISOLTO', pendingRequestCarried: 'RISOLTO' as unknown as boolean },
        })
      }
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
