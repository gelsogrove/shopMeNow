import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { prisma as defaultPrisma, PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { WhatsAppDirectSendService } from "../../services/whatsapp-direct-send.service"
import { sendEscalationEmail } from "./escalation-email.service"
import { googleCalendarService } from "../../services/google-calendar.service"
import { zoomService } from "../../services/zoom.service"
import { runRetrieval } from "../flow-builder/flow-retrieval-orchestrator.service"
import { OpenRouterEmbeddingProvider } from "../flow-builder/embedding-provider"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import { PromptVariables, VARIABLE_DEFAULTS } from "../../types/prompt-variables.types"

type ChatChannel = string

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
type FaqEntry = { question: string; answer: string }

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
    // Real side-effect handlers injected by this host. The custom module
    // stays free of Prisma/Google/Zoom imports and calls these when present.
    handlers?: {
      scheduleConsultation?: (params: ScheduleConsultationParams) => Promise<ScheduleConsultationResult>
      bookAppointment?: (params: BookAppointmentParams) => Promise<BookAppointmentResult>
      retrieveFlow?: (params: RetrieveFlowParams) => Promise<RetrieveFlowResult>
      getFaqs?: (params: GetFaqsParams) => Promise<FaqEntry[]>
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
  private readonly promptProcessor = new PromptProcessorService()

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
      const systemPromptOverride = await this.buildCustomChatbotSystemPrompt(params.workspaceId)
      // Durable state from a previous turn (possibly on another dyno). Read
      // before the module runs so it can hydrate before any tool touches state.
      const persistedState = await this.loadPersistedState(params.sessionId, chatbotId)
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
          // Editable main/system prompt (workspace.customChatbotSystemPrompt,
          // processed with {{variables}}) — null when the workspace has no
          // custom template, in which case the module falls back to its own
          // static prompt file (e.g. common.md).
          systemPromptOverride,
          handlers: {
            scheduleConsultation: (p) => this.scheduleConsultation(p),
            bookAppointment: (p) => this.bookAppointment(p),
            retrieveFlow: (p) => this.retrieveFlow(p),
            getFaqs: (p) => this.getFaqs(p),
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
      select: { timezone: true },
    })
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
        select: { question: true, answer: true },
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
   * Builds the processed main/system prompt for a custom chatbot workspace
   * from workspace.customChatbotSystemPrompt (editable in the backoffice),
   * substituting {{variables}} via the same PromptProcessorService used by
   * the standard chatbot agents. Returns null when the workspace has no
   * custom template set, so the calling module falls back to its own static
   * prompt file (e.g. common.md) — this is additive, not a hard requirement.
   */
  private async buildCustomChatbotSystemPrompt(workspaceId: string): Promise<string | null> {
    const workspace = await defaultPrisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        customChatbotSystemPrompt: true,
        name: true,
        chatbotName: true,
        welcomeMessage: true,
        humanSupportInstructions: true,
        operatorContactMethod: true,
        operatorWhatsappNumber: true,
        toneOfVoice: true,
        address: true,
        allowedExternalLinks: true,
      },
    })
    if (!workspace?.customChatbotSystemPrompt) return null

    const faqs = await this.getFaqs({ workspaceId })
    const faqsText = faqs.length > 0 ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n") : ""

    // VARIABLE_DEFAULTS covers customer-specific fields (customerName, etc.)
    // that are meaningless for a fixed system prompt with no single customer
    // in scope — this template is processed once per turn, not per-customer.
    const variables = {
      ...VARIABLE_DEFAULTS,
      companyName: workspace.name || VARIABLE_DEFAULTS.companyName,
      chatbotName: workspace.chatbotName || VARIABLE_DEFAULTS.chatbotName,
      welcomeMessage: workspace.welcomeMessage || "",
      humanSupportInstructions: workspace.humanSupportInstructions || "",
      operatorContactMethod: workspace.operatorContactMethod || VARIABLE_DEFAULTS.operatorContactMethod,
      operatorWhatsappNumber: workspace.operatorWhatsappNumber || "",
      toneOfVoice: workspace.toneOfVoice || VARIABLE_DEFAULTS.toneOfVoice,
      address: workspace.address || "",
      allowedExternalLinks: workspace.allowedExternalLinks || "",
      faqs: faqsText,
    } as PromptVariables

    return this.promptProcessor.processWithVariables(workspace.customChatbotSystemPrompt, variables)
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

  if (method === 'whatsapp') {
    const operatorPhone = settingsWhatsappNumber || workspace.operatorWhatsappNumber
    if (!operatorPhone) {
      logger.warn('[applyEscalationNotification] WhatsApp method set but no operatorWhatsappNumber configured', { workspaceId })
      return
    }
    try {
      const directSend = new WhatsAppDirectSendService(db)
      const messageContent = `🔔 *Human Support* — ${customerName}\n\n${escalationSummary}`
      await directSend.send({
        workspaceId,
        customerId,
        phoneNumber: operatorPhone,
        messageContent,
        skipSecurityCheck: true,
      })
      logger.info('[applyEscalationNotification] WhatsApp notification sent', { workspaceId, operatorPhone })
    } catch (err) {
      logger.error('[applyEscalationNotification] WhatsApp notification failed', { workspaceId, error: err instanceof Error ? err.message : String(err) })
    }
    return
  }

  // Default: email
  // notificationEmails from chatbot settings takes precedence over workspace.operatorEmail
  // (custom chatbot tenants configure emails in settings.json, not in the workspace DB record)
  const emailRecipients = notificationEmails || workspace.operatorEmail
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
