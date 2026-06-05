import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { prisma as defaultPrisma, PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { WhatsAppDirectSendService } from "../../services/whatsapp-direct-send.service"
import { sendEscalationEmail } from "./escalation-email.service"
import { googleCalendarService } from "../../services/google-calendar.service"
import { zoomService } from "../../services/zoom.service"

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
    // Real side-effect handlers injected by this host. The custom module
    // stays free of Prisma/Google/Zoom imports and calls these when present.
    handlers?: {
      scheduleConsultation?: (params: ScheduleConsultationParams) => Promise<ScheduleConsultationResult>
    }
  }
  context: {
    sessionId: string
    customerId?: string
    phoneNumber?: string
    history: HistoryEntry[]
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
  shouldEscalate: boolean
  escalationSummary?: string
  notificationEmails?: string
  operatorContactMethod?: 'email' | 'whatsapp'
  operatorWhatsappNumber?: string
  smtpConfig?: { user: string; pass: string; host?: string; port?: number; secure?: boolean; from?: string }
  error?: string
  patches?: CustomerPatch[]
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
  workspaceSlug?: string | null
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
  private readonly customClient0WorkspaceIds: Set<string>
  // Cache per chatbotId → modulo caricato. Ogni custom-client-N ha il proprio modulo.
  private readonly moduleCache = new Map<string, Promise<ChatbotModule>>()

  constructor() {
    const configuredIds = (process.env.CUSTOM_CLIENT_0_WORKSPACE_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)

    this.customClient0WorkspaceIds = new Set(configuredIds)
  }

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
          handlers: {
            scheduleConsultation: (p) => this.scheduleConsultation(p),
          },
        },
        context: {
          sessionId: params.sessionId,
          customerId: params.customerId,
          phoneNumber: params.phoneNumber,
          history: params.history,
        },
      })

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
   * Resolve which custom chatbot to use, in priority order:
   * 1. workspace.customChatbotId (DB field — authoritative, set in AI Personality settings)
   * 2. workspace.slug === "ecolaundry" (legacy fallback for existing setup)
   * 3. CUSTOM_CLIENT_0_WORKSPACE_IDS env var (legacy env var override)
   * Returns null if no custom chatbot is configured.
   */
  private resolveChatbotId(params: InvokeParams): string | null {
    if (params.customChatbotId) {
      return params.customChatbotId.trim()
    }
    if (params.workspaceSlug?.toLowerCase() === "ecolaundry") {
      return "ecolaundry"
    }
    if (this.customClient0WorkspaceIds.has(params.workspaceId)) {
      return "ecolaundry"
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
