import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { prisma as defaultPrisma, PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { ensureCustomerFacingReply } from "../../utils/custom-chatbot-reply"
import { WhatsAppDirectSendService } from "../../services/whatsapp-direct-send.service"
import { sendEscalationEmail } from "./escalation-email.service"
import { buildChatbotSettingsJson } from "./chatbot-settings-json.service"
import { googleCalendarService } from "../../services/google-calendar.service"
import { zoomService } from "../../services/zoom.service"
import { runRetrieval } from "../flow-builder/flow-retrieval-orchestrator.service"
import { WebhookDispatchService } from "../../services/webhook-dispatch.service"
import { WorkspaceEnvironmentVariableService } from "./workspace-environment-variable.service"
import { OpenRouterEmbeddingProvider } from "../flow-builder/embedding-provider"

type ChatChannel = string

/**
 * Substitutes {{customerName}} in workspace-owned copy.
 *
 * Returns null when the template is empty, so the module can tell "not
 * configured" from "configured but blank". When the name is unknown the
 * placeholder is dropped rather than left visible — the bot asks for the name
 * before escalating, so the hand-off message normally has one.
 */
function renderCustomerName(template: string | undefined | null, customerName?: string): string | null {
  const text = template?.trim()
  if (!text) return null
  // Host convention: anonymous visitors get an auto-generated "Visitor <id>"
  // name (visitor-id.service.ts). That is NOT a customer name — substituting
  // it produced "Grazie, Visitor ba9143zb" in a live hand-off (2026-08-06).
  const trimmed = customerName?.trim()
  const name = trimmed && !/^visitor[\s_]/i.test(trimmed) ? trimmed : ""
  return text.replace(/\{\{\s*customerName\s*\}\}/gi, name).replace(/\s{2,}/g, " ").trim()
}

// Params/result for the injected schedule_consultation handler. Mirrors the
// exported types in custom-demowash/agent.ts (structural typing across the
// dynamic-import boundary).
type ScheduleConsultationParams = {
  workspaceId: string
  date: string // 'YYYY-MM-DD'
  time: string // 'HH:MM' 24h, wall-clock in the workspace timezone
  durationMinutes: number
  topic: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  location?: string
}
type ScheduleConsultationResult = {
  googleEventLink?: string | null
  zoomLink?: string | null
}

// Params/result for the injected book_appointment handler. Mirrors the
// exported types in custom-demobeauty/agent.ts (structural typing across the
// dynamic-import boundary).
type BookAppointmentCartItem = {
  kind: "service" | "product"
  name: string
  price: number
  durationMin?: number
  qty?: number
}
type BookAppointmentParams = {
  workspaceId: string
  date: string // 'YYYY-MM-DD'
  time: string // 'HH:MM' 24h, wall-clock in the workspace timezone
  durationMinutes: number
  topic: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  location?: string
  services: BookAppointmentCartItem[]
  products: BookAppointmentCartItem[]
}
type BookAppointmentResult = {
  googleEventLink?: string | null
  /** false when the booking was refused (e.g. workspace has booking disabled). */
  ok?: boolean
  /** Machine-readable refusal cause, present only when ok === false. */
  error?: string
  /** Guidance the module hands to the LLM so it can recover in-conversation. */
  instruction?: string
}

// Params/result for the injected retrieve_flow handler (currently
// custom-demorobot/agent.ts). Mirrors RetrievalHandler/RetrievalHandlerResult
// there — structural typing across the dynamic-import boundary.
type RetrieveFlowParams = {
  workspaceId: string
  conversationId: string
  serialNumber?: string
  query: string
}
// Flow catalogue handed to the LLM (mirrors FlowSummary/LoadedFlow in
// custom-demorobot/agent.ts — structural typing across the dynamic import).
type FlowSummary = {
  flowId: string
  title: string
  hint?: string
  category?: string
}
type LoadedFlow = {
  compiledPrompt: string
  hash?: string
  nodes?: Array<{
    id: string
    question: string
    fieldKey?: string | null
    terminalType?: string | null
    outgoingEdges: Array<{ label: string; targetNodeId: string | null; triggersEscalation?: boolean }>
  }>
}

// `robotModelId` / "unknown_model" are the WIRE names of the tool contract
// shared with custom-demorobot/agent.ts (and referenced by name in that
// module's prompts/common.md tool enum). The DB concept was renamed
// RobotModel -> FlowCategory, but renaming these would require changing the
// live prompt + tool schema in lockstep, so the wire format stays as-is and
// the orchestrator's flowCategoryId is mapped onto it here.
type RetrieveFlowResult = {
  selectedFlowId?: string
  compiledPrompt?: string
  hash?: string
  robotModelId?: string
  reason?: "unknown_model" | "no_matching_flow"
}

// Params/result for the injected get_faqs handler. FAQs are a small, fixed
// set per workspace — always injected as a prompt block, never searched
// semantically (unlike Flows). Mirrors GetFaqsHandler/FaqEntry in
// custom-demorobot/agent.ts.
type GetFaqsParams = { workspaceId: string }
// `keywords` is curated by the customer in the backoffice (FAQ.keywords in the
// schema) and is optional: modules that ignore it keep their current prompt.
type FaqEntry = { question: string; answer: string; keywords?: string[] }

// A catalogue row as a custom module sees it. Deliberately generic: the table
// is `products`, but what a row means is the tenant's business (for
// custom-demosappada a row is an accommodation). Mirrors CatalogueEntry in
// custom-demosappada/agent.ts — structural typing across the dynamic import.
type CatalogueEntry = {
  name: string
  description?: string
  price?: number
  link?: string
  type?: string
}

// A tenant-defined tool (WorkspaceCallingFunction, executionType WEBHOOK) as a
// custom module sees it. Only WEBHOOK is exposed: INTERNAL and
// DELEGATE_TO_AGENT are wired to the deprecated flow-builder pipeline
// (FlowAgentLLM), which custom modules do not run — surfacing them would let
// someone define a tool from the UI that silently never executes.
// Mirrors CustomToolDefinition in custom-demosappada/agent.ts.
type CustomToolDefinition = {
  name: string
  description: string
  /** JSON Schema for the arguments, already in OpenAI function-calling shape. */
  parameters: Record<string, unknown>
  /** How the LLM should present the result, authored by the tenant. */
  responseInstructions?: string
}

type CustomToolResult = {
  ok: boolean
  data?: unknown
  error?: string
}

// What a tourism module knows about a customer's stay. Structured (not a
// sentence in `notes`) because the days remaining are recomputed from
// departureDate on every turn — see custom-demosappada/agent.ts.
type StayProfile = {
  adults?: number
  children?: number
  childrenAges?: string
  /** Free text: coeliac, no car, pregnancy, limited walking, a dog… */
  constraints?: string
  /** What a person at the Pro Loco wrote on the card. Read-only for the module. */
  operatorNotes?: string
  seniors?: number
  arrivalDate?: string
  departureDate?: string
  origin?: string
  /** Free text: what they have already done, so it is not proposed again. */
  doneAlready?: string
  /** Finished holidays, oldest first — kept when a new stay starts. */
  pastStays?: Array<Record<string, unknown>>
  /** Intake questions already put to this guest — asked once, never again. */
  asked?: string[]
  consentAsked?: boolean
  /** 'yes' | 'no' — whether they wanted a day-by-day plan. */
  itinerary?: string
  /** Presentation video already shown to this guest. */
  videoSent?: boolean
  /** End-of-stay feedback already collected. */
  feedbackGiven?: boolean
  /** Their words about this stay, archived with it. */
  lastFeedback?: string
  notes?: string
}

// Resolve the UTC instant for a wall-clock time in an IANA timezone.
// Single-iteration offset computation via Intl — accurate except at the rare
// DST-transition minute, which never coincides with business booking slots.
function zonedWallClockToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number)
  const [h, mi] = timeStr.split(":").map(Number)
  const utcGuess = Date.UTC(y, mo - 1, d, h, mi)
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(new Date(utcGuess))
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second)
  const offset = asUtc - utcGuess
  return new Date(utcGuess - offset)
}

type ChatbotInput = {
  userMessage: string
  userName: string
  channel: ChatChannel
  config: {
    workspaceId: string
    debugChannel: boolean
    isPlayground: boolean
    language?: SupportedLanguage
    // Per-turn override for the operator briefing language only. The
    // playground forwards the flag selected in the Use Cases panel here so
    // the "Human Support message" comes back in that language WITHOUT
    // overriding the customer-facing reply language.
    operatorBriefingLanguageOverride?: string | null
    // Editable main/system prompt for this workspace (workspace.
    // customChatbotSystemPrompt, already processed with {{variables}}).
    // null when the workspace has no custom template — the module falls
    // back to its own static prompt file.
    systemPromptOverride?: string | null
    /**
     * Per-workspace feature flags. The module reads these to decide which
     * tools to expose to the LLM. A capability that is false is also backed
     * by the corresponding handler being absent, so the feature cannot be
     * reached even if the module ignores the flag.
     */
    capabilities?: {
      /** workspace.enableCalendarBooking — appointment booking is opt-in. */
      calendarBooking?: boolean
    }
    /**
     * Effective chatbot settings resolved from the database (model, maxTokens,
     * temperature, operator email, audio…). The module merges these over its
     * own settings.json defaults, so a value saved in the Settings UI takes
     * effect on the very next message — no restart, no deploy.
     */
    settings?: Record<string, unknown> | null
    /**
     * Customer-facing copy owned by the workspace and editable in the app,
     * with {{customerName}} already substituted. The module hands these to the
     * LLM, which renders them in the customer's language.
     */
    messages?: {
      welcomeBack?: string | null
      humanSupport?: string | null
      /** Shown when the customer exceeds the per-minute message cap. */
      rateLimited?: string | null
      /** Shown when the conversation exceeds maxTurnsPerSession. */
      sessionTooLong?: string | null
      /** Intake wording — the module fixes WHEN to ask, the workspace HOW. */
      intakeQuestions?: Record<string, string> | null
    } | null
    // Real side-effect handlers injected by this host. The custom module
    // stays free of Prisma/Google/Zoom imports and calls these when present.
    handlers?: {
      scheduleConsultation?: (params: ScheduleConsultationParams) => Promise<ScheduleConsultationResult>
      bookAppointment?: (params: BookAppointmentParams) => Promise<BookAppointmentResult>
      retrieveFlow?: (params: RetrieveFlowParams) => Promise<RetrieveFlowResult>
      getFaqs?: (params: GetFaqsParams) => Promise<FaqEntry[]>
      // LLM-driven flow selection: the module lists these in the prompt and
      // the model attaches one by id via its start_flow tool.
      listFlows?: (params: { workspaceId: string }) => Promise<FlowSummary[]>
      loadFlow?: (params: { workspaceId: string; flowId: string }) => Promise<LoadedFlow | null>
      // The workspace's catalogue rows. Used by custom-demosappada to serve
      // accommodation the Pro Loco keeps up to date (stock = places declared
      // free); any module that does not ask for it is unaffected.
      getCatalogue?: (params: { workspaceId: string }) => Promise<CatalogueEntry[]>
      // Tenant-defined webhook tools, configured in Settings → Custom Tools.
      getCustomTools?: (params: { workspaceId: string }) => Promise<CustomToolDefinition[]>
      executeCustomTool?: (params: {
        workspaceId: string
        customerId?: string
        customerLanguage?: string
        name: string
        args: Record<string, unknown>
      }) => Promise<CustomToolResult>
      // Tourism: read/merge the customer's stay profile, and store the
      // end-of-stay feedback shown on the customer card.
      getStayProfile?: (params: {
        workspaceId: string
        customerId: string
      }) => Promise<StayProfile | null>
      saveStayProfile?: (params: {
        workspaceId: string
        customerId: string
        profile: StayProfile
        replace?: boolean
      }) => Promise<boolean>
      saveFeedback?: (params: {
        workspaceId: string
        customerId: string
        rating?: number
        comment?: string
      }) => Promise<boolean>
      // GDPR consent for promotional messages. Separate from the stay profile
      // on purpose: a marketing consent is a legal record, not a note.
      savePushConsent?: (params: {
        workspaceId: string
        customerId: string
        granted: boolean
      }) => Promise<boolean>
      // Add/remove tags on the customer record (e.g. INLOCO while the guest
      // is actually in town, so a campaign can target only who is here now).
      setCustomerTags?: (params: {
        workspaceId: string
        customerId: string
        add?: string[]
        remove?: string[]
      }) => Promise<string[]>
    }
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: HistoryEntry[]
    /**
     * Durable per-session state a module persisted on a previous turn, read
     * back from ChatSession.context[customChatbotId]. Absent on the first turn
     * or when the module never returned any. Modules that keep state only in
     * a per-process Map would otherwise lose it on a dyno restart or when a
     * turn lands on a different dyno.
     */
    persistedState?: unknown
  }
}

export type CustomerPatch = {
  // 'email' is consent-gated PII: emitted only on explicit invoice request.
  key: 'name' | 'language' | 'phone' | 'company' | 'address' | 'notes' | 'email'
  value: string
}

type ChatbotOutput = {
  reply: string | null
  wipMessage?: string
  /** ISO 2-letter code of the language the bot actually replied in (detected
   *  from the customer's message by the module). The host uses this so the
   *  deterministic welcome-video intro line matches the reply language. */
  language?: string
  shouldEscalate: boolean
  escalationSummary?: string
  notificationEmails?: string
  operatorContactMethod?: 'email' | 'whatsapp'
  operatorWhatsappNumber?: string
  smtpConfig?: { user: string; pass: string; host?: string; port?: number; secure?: boolean; from?: string }
  error?: string
  patches?: CustomerPatch[]
  /** Flow-step media (flow builder Assets, url/type/title) served with this reply — channel rendering is the host's job. */
  attachments?: Array<{ url: string; type: string; title: string }>
  /**
   * Durable per-session state the module wants carried to its next turn.
   * Persisted by this service into ChatSession.context[customChatbotId].
   * null/undefined means "nothing to store" and skips the write.
   */
  persistedState?: unknown
  /** Tenant audio policy from the module's settings.json. When false the host
   *  must always reply with text; when true it may mirror input modality. */
  audioOutput?: boolean
  /** Per-language ElevenLabs voice IDs from the module's settings.json. */
  audioVoices?: Record<string, string>
  meta: {
    tokensUsed: number
    agentChain: string[]
    debug?: unknown
  }
}

type HistoryEntry = {
  role: "user" | "assistant"
  content: string
  /**
   * ISO timestamp of when this message was created. Optional — kept for
   * backward compatibility. When provided, the chatbot can apply time-based
   * heuristics (e.g. carry the customer's location across incidents within
   * the same hour, but not across longer gaps).
   */
  timestamp?: string
}

type SupportedLanguage = "it" | "es" | "pt" | "en" | "ca" | "fr" | "de"

type InvokeParams = {
  workspaceId: string
  customChatbotId?: string | null  // from workspace.customChatbotId (DB field)
  userMessage: string
  userName: string
  channel: ChatChannel
  welcomeMessage: string
  wipMessage: string
  channelActive: boolean
  debugChannel: boolean
  isPlayground: boolean
  language?: string | null
  // Optional per-turn override for the operator briefing language only.
  // The playground forwards the flag selected in the Use Cases panel here
  // so the "Human Support message" comes back in that language, WITHOUT
  // overriding the customer-facing reply language (which stays driven by
  // the deterministic detector on the customer's own message).
  operatorBriefingLanguageOverride?: string | null
  sessionId: string
  customerId?: string
  phoneNumber?: string
  history: HistoryEntry[]
}

type InvokeResult = {
  handled: boolean
  output?: ChatbotOutput
}

type ChatbotModule = {
  chatbotFn: (input: ChatbotInput) => Promise<ChatbotOutput>
}

type TsImportFn = (
  specifier: string,
  options: {
    parentURL: string
  }
) => Promise<any>

export class CustomClientChatbotService {
  // Cache per chatbotId → modulo caricato. Ogni custom-client-N ha il proprio modulo.
  private readonly moduleCache = new Map<string, Promise<ChatbotModule>>()

  async invoke(params: InvokeParams): Promise<InvokeResult> {
    const chatbotId = this.resolveChatbotId(params)
    if (!chatbotId) {
      return { handled: false }
    }

    // Guard: channel disabled — return immediately, no LLM call.
    if (!params.channelActive) {
      return {
        handled: true,
        output: {
          reply: null,
          wipMessage: params.debugChannel ? params.wipMessage : undefined,
          shouldEscalate: false,
          meta: { tokensUsed: 0, agentChain: [] },
        },
      }
    }

    try {
      const module = await this.loadChatbotModule(chatbotId)
      // Durable state from a previous turn (possibly on another dyno). Read
      // before the module runs so it can hydrate before any tool touches state.
      const persistedState = await this.loadPersistedState(params.sessionId, chatbotId)
      // Appointment booking is opt-in per workspace. When disabled, the
      // handler is not injected at all, so the module hides the tool from the
      // LLM (see `capabilities` below) and a stale prompt asking for a booking
      // still cannot produce a calendar event.
      const calendarBookingEnabled = await this.isCalendarBookingEnabled(params.workspaceId)
      // Effective settings from the DATABASE, resolved per turn. The module
      // used to read only its committed settings.json, so a value saved in the
      // Settings UI never took effect (the file was read once at boot, and
      // every deploy reverted it). See loadChatbotSettings below.
      const chatbotSettings = await this.loadChatbotSettings(params.workspaceId, chatbotId)
      const output = await module.chatbotFn({
        userMessage: params.userMessage,
        userName: params.userName,
        channel: params.channel,
        config: {
          workspaceId: params.workspaceId,
          // channelActive/wipMessage/welcomeMessage handled above — not passed to chatbotFn
          debugChannel: params.debugChannel,
          isPlayground: params.isPlayground,
          language: this.normalizeLanguage(params.language),
          operatorBriefingLanguageOverride:
            this.normalizeLanguage(params.operatorBriefingLanguageOverride) ??
            null,
          // Feature flags the module uses to decide which tools to expose to
          // the LLM. Source of truth is the workspace row, never the module.
          capabilities: {
            calendarBooking: calendarBookingEnabled,
          },
          settings: chatbotSettings,
          // Workspace-owned copy. {{customerName}} is substituted here so the
          // module never has to know about template variables.
          messages: {
            welcomeBack: renderCustomerName(
              chatbotSettings?.welcomeBackMessage as string | undefined,
              params.userName
            ),
            humanSupport: renderCustomerName(
              chatbotSettings?.humanSupportMessage as string | undefined,
              params.userName
            ),
            // Guard messages and intake wording: configured per workspace, so
            // the module carries no customer-facing copy of its own. Absent
            // values mean "not configured" — the module then stays silent
            // rather than falling back to hardcoded English.
            rateLimited: (chatbotSettings?.rateLimitedMessage as string | undefined) ?? null,
            sessionTooLong: (chatbotSettings?.sessionTooLongMessage as string | undefined) ?? null,
            intakeQuestions: (chatbotSettings?.intakeQuestions as Record<string, string> | undefined) ?? null,
          },
          handlers: {
            scheduleConsultation: (p) => this.scheduleConsultation(p),
            // Omitted entirely when the workspace has booking disabled.
            ...(calendarBookingEnabled
              ? { bookAppointment: (p: BookAppointmentParams) => this.bookAppointment(p) }
              : {}),
            retrieveFlow: (p) => this.retrieveFlow(p),
            getFaqs: (p) => this.getFaqs(p),
            listFlows: (p) => this.listFlows(p),
            loadFlow: (p) => this.loadFlow(p),
            getCatalogue: (p) => this.getCatalogue(p),
            getCustomTools: (p) => this.getCustomTools(p),
            executeCustomTool: (p) => this.executeCustomTool(p),
            getStayProfile: (p) => this.getStayProfile(p),
            saveStayProfile: (p) => this.saveStayProfile(p),
            saveFeedback: (p) => this.saveFeedback(p),
            savePushConsent: (p) => this.savePushConsent(p),
            setCustomerTags: (p) => this.setCustomerTags(p),
          },
        },
        context: {
          sessionId: params.sessionId,
          customerId: params.customerId,
          phoneNumber: params.phoneNumber,
          history: params.history,
          persistedState,
        },
      })

      // Flush the module's durable state back to ChatSession.context so the
      // next turn survives a restart or a different dyno. Awaited (not
      // fire-and-forget) so a fast follow-up message cannot read stale state.
      await this.savePersistedState(params.sessionId, chatbotId, output.persistedState)

      // NOTE: previously this service prepended `params.welcomeMessage`
      // (taken from `workspace.welcomeMessage`, e.g. "Hi! 👋 I'm Ecolaundry,
      // your Ecolaundry assistant.") to the chatbot reply on the first turn.
      // That caused a DOUBLE welcome on ecolaundry, because ecolaundry already
      // emits its own localized welcome from agent.ts via
      // `settings.welcomeMessage` in custom-ecolaundry/json/settings.json.
      // The custom chatbot module is the single source of truth for its own
      // greeting; the host workspace.welcomeMessage stays unused for these
      // chatbots. If a future chatbot module needs the host welcome, it can
      // accept it via `config` and prepend it itself.

      // Attach wipMessage from workspace settings (used by widget/WhatsApp to show debug banner)
      if (params.debugChannel && params.wipMessage) {
        output.wipMessage = params.wipMessage
      }
      // F85 — When the chatbot module signals `llm_unavailable` (OpenRouter
      // failure after retries), attach the workspace WIP message regardless
      // of debugChannel so the widget controller can serve a graceful WIP
      // status instead of a generic error. No extra OpenRouter cost: the
      // module has already exhausted its retry budget before returning.
      if (output.error === 'llm_unavailable' && params.wipMessage) {
        output.wipMessage = params.wipMessage
      }

      // Escalation turn must never leave the customer in silence: when the
      // model wrote only the operator briefing, prepend the configured
      // hand-off message. Done here, at the single point every channel
      // (widget, WhatsApp, UltraMsg) receives the reply from.
      if (output.reply) {
        output.reply = ensureCustomerFacingReply(
          output.reply,
          renderCustomerName(
            chatbotSettings?.humanSupportMessage as string | undefined,
            params.userName
          )
        )
      }

      return { handled: true, output }
    } catch (error) {
      logger.error("[CustomClientChatbotService] Failed to invoke custom chatbot", {
        workspaceId: params.workspaceId,
        chatbotId,
        error: error instanceof Error ? error.message : String(error),
      })

      return { handled: false }
    }
  }

  /**
   * Real schedule_consultation side-effect injected into custom chatbot modules.
   * Creates a Google Calendar event + a Zoom meeting using the workspace's
   * stored connections. Both underlying services return null gracefully when
   * the workspace has not connected Calendar/Zoom, so a missing integration
   * degrades to "no link" instead of throwing — the booking still confirms.
   */
  private async scheduleConsultation(
    p: ScheduleConsultationParams
  ): Promise<ScheduleConsultationResult> {
    const workspace = await defaultPrisma.workspace.findUnique({
      where: { id: p.workspaceId },
      select: { timezone: true },
    })
    const timezone = workspace?.timezone || "Europe/Rome"

    const startTime = zonedWallClockToUtc(p.date, p.time, timezone)
    const endTime = new Date(startTime.getTime() + p.durationMinutes * 60_000)

    const description = [
      `Franchising consultation — ${p.customerName}`,
      p.customerPhone ? `Phone: ${p.customerPhone}` : null,
      p.location ? `Location: ${p.location}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const [calendar, zoom] = await Promise.all([
      googleCalendarService
        .createEvent({
          workspaceId: p.workspaceId,
          summary: p.topic,
          description,
          startTime,
          endTime,
          timezone,
          attendeeEmail: p.customerEmail,
        })
        .catch((err) => {
          logger.error("[CustomClientChatbotService] calendar event failed", {
            workspaceId: p.workspaceId,
            error: err instanceof Error ? err.message : String(err),
          })
          return null
        }),
      zoomService
        .createMeeting({
          workspaceId: p.workspaceId,
          topic: p.topic,
          startTime,
          duration: p.durationMinutes,
          timezone,
          attendeeEmail: p.customerEmail,
        })
        .catch((err) => {
          logger.error("[CustomClientChatbotService] zoom meeting failed", {
            workspaceId: p.workspaceId,
            error: err instanceof Error ? err.message : String(err),
          })
          return null
        }),
    ])

    return {
      googleEventLink: calendar?.googleEventLink ?? null,
      zoomLink: zoom?.zoomLink ?? null,
    }
  }

  /**
   * Real book_appointment side-effect injected into custom chatbot modules
   * (currently custom-demobeauty). Creates a Google Calendar event on the
   * workspace's connected calendar, tagged with sede/services/products in the
   * description. Degrades to "no link" (never throws) when the workspace has
   * not connected a calendar — the booking still confirms without an event.
   */
  private async bookAppointment(
    p: BookAppointmentParams
  ): Promise<BookAppointmentResult> {
    const workspace = await defaultPrisma.workspace.findUnique({
      where: { id: p.workspaceId },
      select: { timezone: true, enableCalendarBooking: true },
    })

    // Second line of defence. invoke() already withholds this handler when the
    // workspace has booking disabled; re-checking here means no future call
    // path (a cached module, a direct call, a new chatbot) can create a
    // calendar event for a workspace that never enabled the feature.
    if (workspace?.enableCalendarBooking !== true) {
      logger.warn("[CustomClientChatbotService] bookAppointment blocked: calendar booking disabled", {
        workspaceId: p.workspaceId,
      })
      return {
        ok: false,
        error: "calendar_booking_disabled",
        instruction:
          "Appointment booking is not available for this business. Tell the customer you cannot book an appointment, and offer to put them in touch with a human operator instead. Do not call book_appointment again.",
      }
    }

    const timezone = workspace?.timezone || "Europe/Rome"

    const startTime = zonedWallClockToUtc(p.date, p.time, timezone)
    const endTime = new Date(startTime.getTime() + p.durationMinutes * 60_000)

    const formatItem = (item: BookAppointmentCartItem) => {
      const qtyOrDuration = item.durationMin
        ? ` (${item.durationMin} min)`
        : item.qty && item.qty > 1
          ? ` x${item.qty}`
          : ""
      return `${item.name}${qtyOrDuration} — ${item.price}€`
    }

    const description = [
      `Appointment — ${p.customerName}`,
      p.location ? `Sede: ${p.location}` : null,
      p.customerPhone ? `Phone: ${p.customerPhone}` : null,
      p.services.length > 0 ? `Services: ${p.services.map(formatItem).join(", ")}` : null,
      p.products.length > 0 ? `Products: ${p.products.map(formatItem).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const calendar = await googleCalendarService
      .createEvent({
        workspaceId: p.workspaceId,
        summary: p.topic,
        description,
        startTime,
        endTime,
        timezone,
        attendeeEmail: p.customerEmail,
      })
      .catch((err) => {
        logger.error("[CustomClientChatbotService] appointment calendar event failed", {
          workspaceId: p.workspaceId,
          error: err instanceof Error ? err.message : String(err),
        })
        return null
      })

    return {
      googleEventLink: calendar?.googleEventLink ?? null,
    }
  }

  /**
   * Real retrieve_flow side-effect injected into custom-demorobot: two-step
   * retrieval (deterministic serial->model lookup, then semantic search
   * scoped to that model) via the compiler/retrieval services in
   * apps/backend/src/application/flow-builder. Degrades to no_matching_flow on
   * any embedding/DB failure — never blocks or throws into the turn.
   */
  private async retrieveFlow(p: RetrieveFlowParams): Promise<RetrieveFlowResult> {
    try {
      const embeddingProvider = new OpenRouterEmbeddingProvider(process.env.OPENROUTER_API_KEY || "")
      const result = await runRetrieval(
        {
          workspaceId: p.workspaceId,
          conversationId: p.conversationId,
          serialNumber: p.serialNumber,
          query: p.query,
        },
        embeddingProvider,
      )
      if (!result.selectedFlowId) {
        return { reason: result.reason, robotModelId: result.flowCategoryId }
      }
      const flow = await defaultPrisma.flow.findUnique({
        where: { id: result.selectedFlowId },
        select: { compiledPrompt: true, hash: true },
      })
      if (!flow) return { reason: "no_matching_flow" }
      return {
        selectedFlowId: result.selectedFlowId,
        compiledPrompt: flow.compiledPrompt,
        hash: flow.hash,
        robotModelId: result.flowCategoryId,
      }
    } catch (error) {
      logger.error("[CustomClientChatbotService] retrieveFlow failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return { reason: "no_matching_flow" }
    }
  }

  /**
   * The diagnostic flows offered to the LLM, which picks one by id.
   *
   * Andrea 2026-08-02: replaces embedding search as the primary selection
   * mechanism. In production semantic similarity scored 0.23-0.31 against a
   * 0.70 threshold and got worse every turn (it searched the latest message —
   * "IERI", "IMMBOLE" — not the problem), so no flow was ever attached and the
   * model invented diagnostics instead. The LLM sees the whole conversation
   * and matches "mi dà ERROR 001" to the right flow with no threshold to tune.
   *
   * Flows with an empty compiledPrompt are excluded: attaching one would give
   * the LLM a blank script and invite exactly the improvisation we are trying
   * to prevent.
   */
  private async listFlows(p: { workspaceId: string }): Promise<FlowSummary[]> {
    try {
      const flows = await defaultPrisma.flow.findMany({
        where: { workspaceId: p.workspaceId, isActive: true },
        select: {
          id: true,
          title: true,
          description: true,
          keywords: true,
          compiledPrompt: true,
          // Grouping the catalogue by category gives the LLM one more signal
          // for picking the right flow — and is what a per-category filter
          // would build on once a workspace outgrows a flat list.
          flowCategory: { select: { name: true } },
        },
      })

      return flows
        .filter((f) => f.compiledPrompt && f.compiledPrompt.trim().length > 0)
        .map((f) => {
          // Description and keywords are optional in the builder; when present
          // they give the model extra signal for matching the problem.
          const keywords = Array.isArray(f.keywords) ? f.keywords.filter(Boolean) : []
          const hintParts = [f.description?.trim(), keywords.length ? keywords.join(", ") : null].filter(Boolean)
          return {
            flowId: f.id,
            title: f.title,
            hint: hintParts.length > 0 ? hintParts.join(" | ") : undefined,
            // Absent for workspace-generic flows (flowCategoryId null).
            category: f.flowCategory?.name ?? undefined,
          }
        })
    } catch (error) {
      logger.error("[CustomClientChatbotService] listFlows failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Loads the compiled prompt of the flow the LLM selected via start_flow.
   *
   * Scoped by workspaceId as well as id: a flow id is model-supplied input, so
   * it must never be able to reach another tenant's flow (CLAUDE.md §2).
   */
  private async loadFlow(p: { workspaceId: string; flowId: string }): Promise<LoadedFlow | null> {
    try {
      const flow = await defaultPrisma.flow.findFirst({
        where: { id: p.flowId, workspaceId: p.workspaceId, isActive: true },
        select: {
          compiledPrompt: true,
          hash: true,
          nodes: {
            select: {
              id: true,
              question: true,
              fieldKey: true,
              terminalType: true,
              // Node media (flow builder → FlowNodeAttachment → Asset):
              // only url/type/title travel — the flow snapshot is persisted
              // per session, so it must stay light (never inline content).
              // The step then answers with text AND media, deterministically:
              // the attachment is node data, the LLM never sees it.
              attachments: {
                select: { asset: { select: { url: true, type: true, title: true } } },
              },
              outgoingEdges: {
                select: { label: true, targetNodeId: true, targetFlowId: true, triggersEscalation: true },
              },
            },
          },
        },
      })
      if (!flow?.compiledPrompt) return null
      return {
        compiledPrompt: flow.compiledPrompt,
        hash: flow.hash,
        nodes: flow.nodes.map((n) => ({
          ...n,
          attachments: n.attachments.map((a) => a.asset),
        })),
      }
    } catch (error) {
      logger.error("[CustomClientChatbotService] loadFlow failed", {
        workspaceId: p.workspaceId,
        flowId: p.flowId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Effective chatbot settings for this workspace: the module's settings.json
   * with every value configured in the Settings UI layered on top.
   *
   * Reuses buildChatbotSettingsJson — the same resolution the settings-save
   * path uses to regenerate the file — so the UI, the file and the running
   * chatbot can never disagree about what a value means.
   *
   * Returns null on any failure: the module then falls back to its own
   * settings.json, which is always a valid configuration.
   */
  private async loadChatbotSettings(
    workspaceId: string,
    chatbotId: string
  ): Promise<Record<string, unknown> | null> {
    try {
      const workspace = await defaultPrisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          customChatbotId: true,
          customChatbotSystemPrompt: true,
          chatbotName: true,
          humanSupportInstructions: true,
          toneOfVoice: true,
          address: true,
          businessType: true,
          currency: true,
          websiteUrl: true,
          url: true,
          whatsappPhoneNumber: true,
          whatsappSettings: { select: { adminEmail: true } },
          allowedExternalLinks: true,
          customChatbotModel: true,
          customChatbotTemperature: true,
          customChatbotMaxTokens: true,
          customChatbotOperatorEmail: true,
          customChatbotEmailFrom: true,
          customChatbotEmailSubjectPrefix: true,
          operatorEmail: true,
          operatorEmails: true,
          operatorWhatsappNumbers: true,
          operatorDeliveryMode: true,
          defaultLanguage: true,
          enabledLanguages: true,
          audioOutput: true,
          audioVoices: true,
          welcomeMessage: true,
          welcomeBackMessage: true,
          humanSupportMessage: true,
          termsAndConditions: true,
        },
      })
      if (!workspace) return null

      // customChatbotId may be unset on the row while the caller resolved the
      // module some other way — fall back to the id actually being invoked.
      const settings = await buildChatbotSettingsJson({
        ...workspace,
        customChatbotId: workspace.customChatbotId ?? chatbotId,
      })
      return settings as unknown as Record<string, unknown> | null
    } catch (error) {
      logger.warn("[CustomClientChatbotService] loadChatbotSettings failed, module defaults apply", {
        workspaceId,
        chatbotId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Whether this workspace allows the chatbot to book appointments
   * (workspace.enableCalendarBooking, default false).
   *
   * Fails CLOSED: if the flag cannot be read, booking stays disabled. Creating
   * a calendar event for a workspace that did not enable the feature is worse
   * than telling the customer booking is unavailable.
   */
  private async isCalendarBookingEnabled(workspaceId: string): Promise<boolean> {
    try {
      const workspace = await defaultPrisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { enableCalendarBooking: true },
      })
      return workspace?.enableCalendarBooking === true
    } catch (error) {
      logger.warn("[CustomClientChatbotService] isCalendarBookingEnabled failed, disabling booking", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Reads back the durable state a module stored on a previous turn.
   *
   * Stored under ChatSession.context[chatbotId] so two modules (or a module
   * and the legacy context payload already living in that column) never
   * overwrite each other. Returns undefined on any failure: a missing or
   * corrupt blob must degrade to "first turn", never break the conversation.
   */
  private async loadPersistedState(
    sessionId: string,
    chatbotId: string
  ): Promise<unknown> {
    try {
      const session = await defaultPrisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { context: true },
      })
      const context = session?.context
      if (!context || typeof context !== "object" || Array.isArray(context)) return undefined
      return (context as Record<string, unknown>)[chatbotId]
    } catch (error) {
      logger.warn("[CustomClientChatbotService] loadPersistedState failed", {
        sessionId,
        chatbotId,
        error: error instanceof Error ? error.message : String(error),
      })
      return undefined
    }
  }

  /**
   * Persists the module's durable state, merged into the existing context
   * object so unrelated keys written by other code survive.
   *
   * Never throws: failing to persist costs the next turn some context, but
   * must not fail the reply the customer is waiting for.
   */
  private async savePersistedState(
    sessionId: string,
    chatbotId: string,
    state: unknown
  ): Promise<void> {
    if (state === undefined || state === null) return

    try {
      const session = await defaultPrisma.chatSession.findUnique({
        where: { id: sessionId },
        select: { context: true },
      })
      const current =
        session?.context && typeof session.context === "object" && !Array.isArray(session.context)
          ? (session.context as Record<string, unknown>)
          : {}

      await defaultPrisma.chatSession.update({
        where: { id: sessionId },
        data: { context: { ...current, [chatbotId]: state } as any },
      })
    } catch (error) {
      logger.warn("[CustomClientChatbotService] savePersistedState failed", {
        sessionId,
        chatbotId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Real get_faqs side-effect injected into custom-demorobot: the workspace's
   * FAQs, injected as a fixed prompt block (never retrieval — FAQs are a
   * small, bounded set, see design.md). Reuses the same FAQ table/repository
   * as the standard chatbot agents.
   */
  private async getFaqs(p: GetFaqsParams): Promise<FaqEntry[]> {
    try {
      const faqs = await defaultPrisma.fAQ.findMany({
        where: { workspaceId: p.workspaceId, isActive: true },
        orderBy: { order: "asc" },
        select: { question: true, answer: true, keywords: true },
      })
      return faqs
    } catch (error) {
      logger.error("[CustomClientChatbotService] getFaqs failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * The workspace's catalogue rows, workspace-scoped like every other read.
   *
   * Generic on purpose: the table is `products`, but what a row MEANS belongs
   * to the tenant — for custom-demosappada a row is an accommodation and the
   * module serves it as a contact, not as live availability (Andrea
   * 2026-08-22: how availability would be kept current is still an open
   * question, and a stale count is worse than none).
   */
  private async getCatalogue(p: { workspaceId: string }): Promise<CatalogueEntry[]> {
    try {
      const rows = await defaultPrisma.products.findMany({
        where: { workspaceId: p.workspaceId, isActive: true },
        orderBy: { name: "asc" },
        select: { name: true, description: true, price: true, link: true, type: true },
      })
      return rows.map((r) => ({
        name: r.name,
        description: r.description ?? undefined,
        price: r.price !== null && r.price !== undefined ? Number(r.price) : undefined,
        link: r.link ?? undefined,
        type: r.type ?? undefined,
      }))
    } catch (error) {
      logger.error("[CustomClientChatbotService] getCatalogue failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * The tenant's own tools, defined in Settings → Custom Tools.
   *
   * WEBHOOK only, on purpose. The other two execution types (INTERNAL,
   * DELEGATE_TO_AGENT) resolve inside FunctionExecutor/FlowAgentLLM — the
   * deprecated flow-builder pipeline that custom modules never run. Handing
   * them to a module would produce a tool the LLM can call and nothing can
   * execute, which is worse than not offering it.
   */
  private async getCustomTools(p: { workspaceId: string }): Promise<CustomToolDefinition[]> {
    try {
      const rows = await defaultPrisma.workspaceCallingFunction.findMany({
        where: { workspaceId: p.workspaceId, isActive: true, executionType: "WEBHOOK" },
        select: { functionName: true, description: true, parameters: true, responseInstructions: true },
      })

      return rows
        .filter((r) => r.functionName?.trim() && r.description?.trim())
        .map((r) => ({
          name: r.functionName.trim(),
          description: r.description!.trim(),
          // A tool with no schema still needs a valid empty one, or the LLM
          // provider rejects the whole request.
          parameters:
            r.parameters && typeof r.parameters === "object" && !Array.isArray(r.parameters)
              ? (r.parameters as Record<string, unknown>)
              : { type: "object", properties: {}, additionalProperties: false },
          responseInstructions: r.responseInstructions?.trim() || undefined,
        }))
    } catch (error) {
      logger.error("[CustomClientChatbotService] getCustomTools failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Execute one tenant tool by dispatching its webhook.
   *
   * Reuses WebhookDispatchService — HMAC signing, timeout and the encrypted
   * credential injection all already live there, and a second implementation
   * would be a second thing to keep correct.
   *
   * Never throws: a failing webhook must come back as a refusal the model can
   * act on honestly, not as a dead turn.
   */
  private async executeCustomTool(p: {
    workspaceId: string
    customerId?: string
    customerLanguage?: string
    name: string
    args: Record<string, unknown>
  }): Promise<CustomToolResult> {
    try {
      const fn = await defaultPrisma.workspaceCallingFunction.findUnique({
        where: { workspaceId_functionName: { workspaceId: p.workspaceId, functionName: p.name } },
      })

      // Re-checked here, not trusted from the definition list: the row may have
      // been deactivated or retyped between the two calls.
      if (!fn || !fn.isActive || fn.executionType !== "WEBHOOK") {
        return { ok: false, error: `tool "${p.name}" is not an active webhook tool` }
      }

      const workspace = await defaultPrisma.workspace.findUnique({
        where: { id: p.workspaceId },
        select: { webhookUrl: true, webhookSecret: true, webhookTimeout: true },
      })

      const url = fn.webhookUrl || workspace?.webhookUrl
      if (!url) {
        return { ok: false, error: `no webhook URL configured for tool "${p.name}"` }
      }

      let credentials: Map<string, string> | undefined
      const mapping = fn.credentialsMapping as Record<string, unknown> | null
      if (mapping && Object.keys(mapping).length > 0) {
        credentials = await new WorkspaceEnvironmentVariableService(
          defaultPrisma
        ).getAllCredentialsForDispatch(p.workspaceId)
      }

      const data = await new WebhookDispatchService().dispatch({
        url,
        secret: workspace?.webhookSecret || undefined,
        timeout: workspace?.webhookTimeout || undefined,
        payload: {
          function: p.name,
          parameters: p.args,
          context: {
            workspaceId: p.workspaceId,
            customerId: p.customerId,
            customerLanguage: p.customerLanguage,
          },
        },
        credentialsMapping: (fn.credentialsMapping as never) || undefined,
        credentials,
      })

      return { ok: true, data }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error("[CustomClientChatbotService] executeCustomTool failed", {
        workspaceId: p.workspaceId,
        tool: p.name,
        error: message,
      })
      return { ok: false, error: message }
    }
  }

  /**
   * The customer's stay profile, workspace-scoped like every other read.
   */
  private async getStayProfile(p: {
    workspaceId: string
    customerId: string
  }): Promise<StayProfile | null> {
    try {
      const customer = await defaultPrisma.customers.findFirst({
        where: { id: p.customerId, workspaceId: p.workspaceId },
        select: { stayProfile: true, notes: true },
      })
      const profile = customer?.stayProfile
      const manual = extractManualNotes(customer?.notes)
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        // Even with no stay on record, an operator's note is worth carrying.
        return manual ? ({ operatorNotes: manual } as StayProfile) : null
      }
      return { ...(profile as StayProfile), ...(manual ? { operatorNotes: manual } : {}) }
    } catch (error) {
      logger.error("[CustomClientChatbotService] getStayProfile failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  /**
   * Merge new facts into the stay profile.
   *
   * MERGE, never replace: the assistant learns the stay one answer at a time
   * ("we're four", then "until Sunday", then "we came from Vienna"), and a
   * write that replaced the object would erase what the previous turns
   * collected. Undefined values are skipped for the same reason.
   */
  private async saveStayProfile(p: {
    workspaceId: string
    customerId: string
    profile: StayProfile
    replace?: boolean
  }): Promise<boolean> {
    try {
      // `replace` is for the one case a merge would be wrong: a guest starting
      // a NEW holiday, where last summer's dates and activities must actually
      // go away rather than survive the write.
      const current = p.replace ? {} : ((await this.getStayProfile(p)) ?? {})
      const merged: Record<string, unknown> = { ...current }
      for (const [key, value] of Object.entries(p.profile)) {
        if (value !== undefined && value !== null && value !== "") merged[key] = value
      }

      // The same facts, once as data and once as a sentence: `stayProfile` is
      // what the code computes on (days left, tags), `notes` is what a person
      // at the Pro Loco reads on the customer card — and what the chatbot's
      // own prompt carries, so it always knows who it is talking to. Derived
      // from the structured record, never the other way round.
      const existing = await defaultPrisma.customers.findFirst({
        where: { id: p.customerId, workspaceId: p.workspaceId },
        select: { notes: true },
      })

      const updated = await defaultPrisma.customers.updateMany({
        where: { id: p.customerId, workspaceId: p.workspaceId },
        data: {
          stayProfile: merged as never,
          notes: renderStayNotes(merged as StayProfile, extractManualNotes(existing?.notes)),
        },
      })
      return updated.count > 0
    } catch (error) {
      logger.error("[CustomClientChatbotService] saveStayProfile failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Store the end-of-stay feedback on the customer card.
   */
  private async saveFeedback(p: {
    workspaceId: string
    customerId: string
    rating?: number
    comment?: string
  }): Promise<boolean> {
    try {
      const data: Record<string, unknown> = { feedbackAt: new Date() }
      if (typeof p.rating === "number" && p.rating >= 1 && p.rating <= 5) {
        data.feedbackRating = Math.round(p.rating)
      }
      if (p.comment?.trim()) data.feedbackComment = p.comment.trim()
      if (Object.keys(data).length === 1) return false // nothing but the timestamp

      const updated = await defaultPrisma.customers.updateMany({
        where: { id: p.customerId, workspaceId: p.workspaceId },
        data: data as never,
      })
      return updated.count > 0
    } catch (error) {
      logger.error("[CustomClientChatbotService] saveFeedback failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Record the customer's consent to promotional messages.
   *
   * Kept out of `notes` and out of the stay profile deliberately: this is the
   * legal basis for every campaign sent to this person, so it lives in the
   * dedicated column with its timestamp, where the platform already looks for
   * it. A consent buried in free text is a consent nobody can prove.
   */
  private async savePushConsent(p: {
    workspaceId: string
    customerId: string
    granted: boolean
  }): Promise<boolean> {
    try {
      const updated = await defaultPrisma.customers.updateMany({
        where: { id: p.customerId, workspaceId: p.workspaceId },
        data: {
          push_notifications_consent: p.granted,
          push_notifications_consent_at: new Date(),
        },
      })
      return updated.count > 0
    } catch (error) {
      logger.error("[CustomClientChatbotService] savePushConsent failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  /**
   * Add and remove tags on a customer, returning the resulting list.
   *
   * Read-modify-write on purpose: tags are a shared list (a campaign segment,
   * a manual label someone typed in the UI), so a blind overwrite would drop
   * whatever the module did not know about. Comparison is case-insensitive so
   * "inloco" and "INLOCO" never both end up on the record.
   */
  private async setCustomerTags(p: {
    workspaceId: string
    customerId: string
    add?: string[]
    remove?: string[]
  }): Promise<string[]> {
    try {
      const customer = await defaultPrisma.customers.findFirst({
        where: { id: p.customerId, workspaceId: p.workspaceId },
        select: { tags: true },
      })
      if (!customer) return []

      const removeSet = new Set((p.remove ?? []).map((t) => t.trim().toUpperCase()))
      const kept = (customer.tags ?? []).filter(
        (tag) => !removeSet.has(tag.trim().toUpperCase())
      )

      const present = new Set(kept.map((t) => t.trim().toUpperCase()))
      for (const raw of p.add ?? []) {
        const tag = raw.trim()
        if (!tag) continue
        if (present.has(tag.toUpperCase())) continue
        kept.push(tag)
        present.add(tag.toUpperCase())
      }

      await defaultPrisma.customers.updateMany({
        where: { id: p.customerId, workspaceId: p.workspaceId },
        data: { tags: kept },
      })
      return kept
    } catch (error) {
      logger.error("[CustomClientChatbotService] setCustomerTags failed", {
        workspaceId: p.workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
      return []
    }
  }

  /**
   * Resolve which custom chatbot to use from workspace.customChatbotId (DB field
   * — authoritative, set in AI Personality settings). Returns null if no custom
   * chatbot is configured.
   */
  private resolveChatbotId(params: InvokeParams): string | null {
    if (params.customChatbotId) {
      return params.customChatbotId.trim()
    }
    return null
  }

  private normalizeLanguage(language?: string | null): SupportedLanguage | undefined {
    if (!language) {
      return undefined
    }

    const normalized = language.toLowerCase().trim()
    const map: Record<string, SupportedLanguage> = {
      it: "it",
      italiano: "it",
      italian: "it",
      es: "es",
      esp: "es",
      español: "es",
      spanish: "es",
      en: "en",
      eng: "en",
      english: "en",
      pt: "pt",
      por: "pt",
      português: "pt",
      portuguese: "pt",
      ca: "ca",
      cat: "ca",
      català: "ca",
      catalan: "ca",
      fr: "fr",
      fra: "fr",
      français: "fr",
      french: "fr",
      de: "de",
      deu: "de",
      deutsch: "de",
      german: "de",
    }

    return map[normalized]
  }

  private async loadChatbotModule(chatbotId: string): Promise<ChatbotModule> {
    const cached = this.moduleCache.get(chatbotId)
    if (cached) return cached

    const promise = this.importChatbotModule(chatbotId)
    this.moduleCache.set(chatbotId, promise)
    return promise
  }

  private async importChatbotModule(chatbotId: string): Promise<ChatbotModule> {
    const entryPath = this.resolveCustomClientEntryPath(chatbotId)
    const entryUrl = pathToFileURL(entryPath).href
    const parentURL = pathToFileURL(__filename).href

    const { tsImport } = require("tsx/esm/api") as { tsImport: TsImportFn }
    const importedModule = await tsImport(entryUrl, { parentURL })
    if (!importedModule?.chatbotFn || typeof importedModule.chatbotFn !== "function") {
      throw new Error(`${chatbotId}/index.ts does not export chatbotFn`)
    }

    return importedModule as ChatbotModule
  }

  private resolveCustomClientEntryPath(chatbotId: string): string {
    // Security: only allow safe chatbotId values (lowercase letters, digits, hyphens).
    // This prevents path traversal attacks if the DB field contains "../../" sequences.
    if (!/^[a-z0-9-]+$/.test(chatbotId)) {
      throw new Error(`Invalid chatbotId "${chatbotId}": only lowercase letters, digits and hyphens are allowed`)
    }

    // Map chatbotId → folder name. Conventions:
    //   "cliente-N"        → "custom-client-N"   (legacy)
    //   "custom-<name>"    → "custom-<name>"     (already prefixed)
    //   "<name>"           → "custom-<name>"     (e.g. "ecolaundry" → "custom-ecolaundry")
    const folderName = chatbotId.startsWith("cliente-")
      ? chatbotId.replace("cliente-", "custom-client-")
      : chatbotId.startsWith("custom-")
        ? chatbotId
        : `custom-${chatbotId}`

    const candidates = [
      path.resolve(process.cwd(), `${folderName}/index.ts`),
      path.resolve(process.cwd(), `apps/backend/${folderName}/index.ts`),
      path.resolve(__dirname, `../../../${folderName}/index.ts`),
      path.resolve(__dirname, `../../../../${folderName}/index.ts`),
    ]

    const existing = candidates.find((candidate) => fs.existsSync(candidate))
    if (!existing) {
      throw new Error(`${folderName}/index.ts not found (chatbotId: ${chatbotId})`)
    }

    return existing
  }
}

/**
 * Everything below this line in `notes` was written by a person, not by the
 * assistant, and must survive every automatic rewrite of the note.
 *
 * The Pro Loco writes things the chatbot could never infer — "affezionato,
 * viene da dieci anni", "lamentela sul parcheggio" — and a generated summary
 * that overwrote them would quietly destroy the only place they live.
 */
const MANUAL_NOTES_SEPARATOR = "--- note operatore ---"

/** The hand-written part of a note, if any. */
export function extractManualNotes(notes: string | null | undefined): string {
  if (!notes) return ""
  const index = notes.indexOf(MANUAL_NOTES_SEPARATOR)
  if (index === -1) {
    // No separator: either the note is entirely hand-written (it predates the
    // assistant) or entirely generated. A note that does not look generated is
    // treated as the operator's — losing their text is the worse mistake.
    return notes.trimStart().startsWith("Da tenere presente:") ||
      /^\d+ (adulti|bambini|anziani)/.test(notes.trim())
      ? ""
      : notes.trim()
  }
  return notes.slice(index + MANUAL_NOTES_SEPARATOR.length).trim()
}

/**
 * The stay profile as a person would write it, for the customer card.
 *
 * Italian because it is what the Pro Loco reads on their own screen; the
 * chatbot translates it for the guest like everything else. Kept short: a
 * note nobody can take in at a glance is a note nobody reads.
 */
function renderStayNotes(profile: StayProfile, manualNotes: string): string {
  const parts: string[] = []

  const party: string[] = []
  if (profile.adults) party.push(`${profile.adults} adulti`)
  if (profile.children) {
    party.push(
      profile.childrenAges
        ? `${profile.children} bambini (${profile.childrenAges})`
        : `${profile.children} bambini`
    )
  }
  if (profile.seniors) party.push(`${profile.seniors} anziani`)
  if (party.length > 0) parts.push(party.join(", "))

  if (profile.origin) parts.push(`da ${profile.origin}`)
  if (profile.arrivalDate || profile.departureDate) {
    parts.push(`soggiorno ${profile.arrivalDate ?? "?"} → ${profile.departureDate ?? "?"}`)
  }

  const lines = parts.length > 0 ? [parts.join(" · ")] : []
  if (profile.constraints) lines.push(`⚠️ Da tenere presente: ${profile.constraints}`)
  if (profile.doneAlready) lines.push(`Ha fatto: ${profile.doneAlready}`)
  // The guest's own words about the stay: the single most useful line on the
  // card for whoever picks the phone up next.
  if (profile.lastFeedback) lines.push(`Feedback: "${profile.lastFeedback}"`)
  if (profile.itinerary === "no") lines.push("Non vuole un programma: preferisce chiedere man mano")
  if (profile.pastStays?.length) {
    const previous = profile.pastStays
      .map((stay) => {
        const s = stay as Record<string, unknown>
        const when = typeof s.departureDate === "string" ? s.departureDate : "?"
        const what = typeof s.doneAlready === "string" && s.doneAlready ? ` — ${s.doneAlready}` : ""
        return `${when}${what}`
      })
      .join("; ")
    lines.push(`Visite precedenti (${profile.pastStays.length}): ${previous}`)
  }

  if (manualNotes) lines.push("", MANUAL_NOTES_SEPARATOR, manualNotes)

  return lines.join("\n")
}

const PATCH_KEY_TO_DB: Record<CustomerPatch['key'], string> = {
  name: 'name',
  language: 'language',
  phone: 'phone',
  company: 'company',
  address: 'address',
  notes: 'notes',
  email: 'email', // consent-gated: persisted only when customer requests an invoice
}

/**
 * Applies patches emitted by the custom chatbot to the Customers table.
 * Call this immediately after a successful customClientResult.output is obtained.
 * workspaceId is mandatory — enforces workspace isolation on every update.
 */
export async function applyCustomerPatches(
  patches: CustomerPatch[] | undefined,
  customerId: string,
  workspaceId: string,
  db: PrismaClient = defaultPrisma
): Promise<void> {
  if (!patches || patches.length === 0) return
  const data: Record<string, string> = {}
  for (const patch of patches) {
    const dbField = PATCH_KEY_TO_DB[patch.key]
    if (dbField) data[dbField] = patch.value
  }
  if (Object.keys(data).length === 0) return
  await db.customers.updateMany({
    where: { id: customerId, workspaceId },
    data,
  })
  logger.info('[applyCustomerPatches] Customer profile updated', { customerId, workspaceId, fields: Object.keys(data) })
}

/**
 * Picks the recipients for an escalation according to the workspace's
 * `operatorDeliveryMode`.
 *
 * Andrea 2026-08-02: the mode was written into settings.json but no code ever
 * read it — every escalation went to a single address regardless. Now:
 *   'all'    → every configured operator is notified
 *   'random' → one operator picked at random (round-robin-ish load spreading)
 *   'custom' → the chatbot module owns routing; the lists are emitted empty,
 *              so this falls back to the single legacy address
 *
 * Falls back to the singular legacy field when no list is configured, so
 * existing workspaces keep working untouched.
 */
function selectOperatorRecipients(
  list: string[] | null | undefined,
  fallback: string | null | undefined,
  deliveryMode: string | null | undefined
): string[] {
  const configured = (list ?? []).map((v) => v.trim()).filter(Boolean)

  if (configured.length === 0) {
    const single = fallback?.trim()
    return single ? [single] : []
  }

  if (deliveryMode === "random") {
    return [configured[Math.floor(Math.random() * configured.length)]]
  }

  // 'all' (default) and anything unrecognised: notify everyone. Erring towards
  // more people seeing an escalation is safer than silently dropping it.
  return configured
}

/** Exposed for unit tests: recipient selection is a pure decision worth pinning. */
export const selectOperatorRecipientsForTest = selectOperatorRecipients

export interface EscalationNotificationParams {
  workspaceId: string
  customerId: string
  escalationSummary: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  customerName: string
  customerPhone?: string
  /** Comma-separated email list from chatbot settings.notificationEmails — takes precedence over workspace.operatorEmail for custom chatbot tenants. */
  notificationEmails?: string
  /** Notification channel from chatbot settings.operatorContactMethod — takes precedence over workspace.operatorContactMethod for custom chatbot tenants. */
  operatorContactMethod?: 'email' | 'whatsapp'
  /** Operator WhatsApp number from chatbot settings.operatorWhatsappNumber — used when operatorContactMethod='whatsapp'. */
  operatorWhatsappNumber?: string
  /** SMTP config from chatbot settings.smtp — takes precedence over global SMTP_* env vars. */
  smtpConfig?: { user: string; pass: string; host?: string; port?: number; secure?: boolean; from?: string }
}

/**
 * Dispatches the escalation notification to the operator using the workspace
 * Human Support settings (operatorContactMethod, operatorEmail, operatorWhatsappNumber).
 * The custom chatbot declares shouldEscalate=true; this function decides HOW to notify.
 * Never throws — notification failure must not block the chat reply to the customer.
 */
export async function applyEscalationNotification(
  params: EscalationNotificationParams,
  db: PrismaClient = defaultPrisma
): Promise<void> {
  const {
    workspaceId,
    customerId,
    escalationSummary,
    history,
    customerName,
    customerPhone,
    notificationEmails,
    operatorContactMethod: settingsContactMethod,
    operatorWhatsappNumber: settingsWhatsappNumber,
    smtpConfig,
  } = params

  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId },
    select: {
      hasHumanSupport: true,
      operatorContactMethod: true,
      operatorEmail: true,
      operatorWhatsappNumber: true,
      // Multi-operator routing: which addresses/numbers, and how to pick.
      operatorEmails: true,
      operatorWhatsappNumbers: true,
      operatorDeliveryMode: true,
      name: true,
    },
  })

  // For custom chatbot tenants, notificationEmails in settings.json is the source of truth.
  // hasHumanSupport from the DB only gates standard (non-custom) tenants.
  const hasCustomEmails = !!notificationEmails
  if (!workspace || (!workspace.hasHumanSupport && !hasCustomEmails)) {
    logger.info('[applyEscalationNotification] Human support disabled or workspace not found', { workspaceId })
    return
  }

  // Settings from the chatbot module take precedence over the workspace DB record
  // (custom chatbot tenants configure everything in settings.json, not in the DB)
  const method = settingsContactMethod || workspace.operatorContactMethod || 'email'
  logger.info('[applyEscalationNotification] Dispatching escalation', { workspaceId, customerId, method })

  const deliveryMode = workspace.operatorDeliveryMode

  if (method === 'whatsapp') {
    const operatorPhones = selectOperatorRecipients(
      workspace.operatorWhatsappNumbers,
      settingsWhatsappNumber || workspace.operatorWhatsappNumber,
      deliveryMode
    )
    if (operatorPhones.length === 0) {
      logger.warn('[applyEscalationNotification] WhatsApp method set but no operator number configured', { workspaceId })
      return
    }
    const directSend = new WhatsAppDirectSendService(db)
    const messageContent = `🔔 *Human Support* — ${customerName}\n\n${escalationSummary}`
    // Sent per recipient: one operator being unreachable must not stop the
    // others from being notified.
    for (const phoneNumber of operatorPhones) {
      try {
        await directSend.send({
          workspaceId,
          customerId,
          phoneNumber,
          messageContent,
          skipSecurityCheck: true,
        })
        logger.info('[applyEscalationNotification] WhatsApp notification sent', { workspaceId, phoneNumber, deliveryMode })
      } catch (err) {
        logger.error('[applyEscalationNotification] WhatsApp notification failed', { workspaceId, phoneNumber, error: err instanceof Error ? err.message : String(err) })
      }
    }
    return
  }

  // Default: email
  // notificationEmails from chatbot settings takes precedence over workspace.operatorEmail
  // (custom chatbot tenants configure emails in settings.json, not in the workspace DB record)
  // notificationEmails (chatbot settings) wins when set; otherwise the
  // workspace operator list, selected according to the delivery mode.
  const emailRecipients =
    notificationEmails ||
    selectOperatorRecipients(workspace.operatorEmails, workspace.operatorEmail, deliveryMode).join(",")
  if (!emailRecipients) {
    logger.warn('[applyEscalationNotification] Email method set but no email configured', { workspaceId })
    return
  }
  try {
    await sendEscalationEmail(
      {
        summary: escalationSummary,
        history,
        customerName,
        customerPhone,
        companyName: workspace.name || 'Chatbot',
        timestamp: new Date().toISOString(),
      },
      emailRecipients,
      smtpConfig
    )
    logger.info('[applyEscalationNotification] Email notification sent', { workspaceId, emailRecipients })
  } catch (err) {
    logger.error('[applyEscalationNotification] Email notification failed', { workspaceId, error: err instanceof Error ? err.message : String(err) })
  }
}

export interface EscalationSideEffectsParams {
  output: Pick<
    ChatbotOutput,
    | 'shouldEscalate'
    | 'escalationSummary'
    | 'notificationEmails'
    | 'operatorContactMethod'
    | 'operatorWhatsappNumber'
    | 'smtpConfig'
  >
  workspaceId: string
  customerId: string
  customerName: string
  customerPhone?: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
}

/**
 * The host-side effects of a module escalation (shouldEscalate=true): notify
 * the operator and disable the chatbot for the customer, so their next
 * messages reach a human instead of the LLM.
 *
 * ONE definition for every entry point that invokes a custom chatbot. Andrea
 * 2026-08-18, seen live (demoam, "the Robot cut my cat"): these two effects
 * were inlined only in the widget's ongoing-message branch — an emergency
 * escalated on a visitor's FIRST message went through the registration branch,
 * which announced the hand-off and then silently dropped it: no operator
 * notification, chat still active. A branch that consumes ChatbotOutput must
 * call this, never re-implement the effects inline.
 *
 * Returns true when the escalation was applied. Never throws — the customer
 * reply must go out regardless.
 */
export async function applyEscalationSideEffects(
  params: EscalationSideEffectsParams,
  db: PrismaClient = defaultPrisma
): Promise<boolean> {
  const { output, workspaceId, customerId, customerName, customerPhone, history } = params
  if (!output.shouldEscalate || !output.escalationSummary) return false

  // Fire-and-forget: notification latency must not delay the chat response.
  void applyEscalationNotification(
    {
      workspaceId,
      customerId,
      escalationSummary: output.escalationSummary,
      history,
      customerName,
      customerPhone,
      notificationEmails: output.notificationEmails,
      operatorContactMethod: output.operatorContactMethod,
      operatorWhatsappNumber: output.operatorWhatsappNumber,
      smtpConfig: output.smtpConfig,
    },
    db
  )

  try {
    await db.customers.update({
      where: { id: customerId, workspaceId },
      data: { activeChatbot: false },
    })
    logger.info('[applyEscalationSideEffects] Escalation applied — chatbot disabled for customer', {
      workspaceId,
      customerId,
    })
  } catch (err) {
    logger.error('[applyEscalationSideEffects] Failed to disable chatbot', {
      workspaceId,
      customerId,
      error: err instanceof Error ? err.message : String(err),
    })
  }
  return true
}
