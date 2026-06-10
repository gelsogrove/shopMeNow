/**
 * Widget Chat Controller
 * Handles widget chat requests (send message + polling)
 * 
 * Endpoints:
 * - POST /api/v1/widget/chat/:workspaceId - Send message
 * - GET /api/v1/widget/poll/:messageId - Poll for response
 */

import { Request, Response } from "express"
import axios from "axios"
import { prisma, PrismaClient, AgentType } from "@echatbot/database"
import logger from "../../../utils/logger"
import fs from "fs"
import { transcribeAudio } from "../../../services/audio-transcription.service"
import { VisitorIdService } from "../../../application/services/visitor-id.service"
import { SecurityCheckService } from "../../../application/services/security-check.service"
import { LLMRouterService } from "../../../services/llm-router.service"
import { getChatEngine } from "../../../application/chat-engine"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import { WorkspaceAccessService } from "../../../application/services/workspace-access.service"
import { detectLanguageFromHeader } from "../../../utils/email-templates"
import { detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
import { registrationPromptService } from "../../../services/registration-prompt.service"
import { TranslationAgent } from "../../../application/agents/TranslationAgent"
import { WelcomeMessageHandler } from "../../../utils/welcome-message.handler"
import {
  WIDGET_MESSAGE_SCHEMA,
  WIDGET_REGISTER_SCHEMA,
  WIDGET_PUSH_CONSENT_SCHEMA,
  type WidgetMessageInput,
} from "../schemas/widget.schemas"
import { CustomClientChatbotService, applyCustomerPatches, applyEscalationNotification } from "../../../application/services/custom-client-chatbot.service"

const llmRouterService = new LLMRouterService(prisma)
const translationAgent = new TranslationAgent(prisma)
const welcomeMessageHandler = new WelcomeMessageHandler(prisma)

/**
 * Validate that widget requests originate from allowed domains.
 * - If an allow-list is provided, match against it; otherwise fallback to websiteUrl.
 * - Origin/Referer is mandatory when any domain is configured.
 * - Accept exact host or subdomains.
 */
function isOriginAllowed(
  req: Request,
  websiteUrl?: string | null,
  allowedOrigins?: string[] | null
): boolean {
  const originsList = (allowedOrigins || []).filter(Boolean)
  const fallback = websiteUrl ? [websiteUrl] : []
  const domainPool = originsList.length ? originsList : fallback

  if (domainPool.length === 0) return true // nothing configured → allow (legacy)

  const originHeader = req.headers.origin || req.headers.referer
  if (!originHeader || typeof originHeader !== "string") return false

  const incomingHost = (() => {
    try {
      return new URL(originHeader).host.toLowerCase()
    } catch {
      return null
    }
  })()
  if (!incomingHost) return false

  const normalizeHost = (url: string) => {
    try {
      const host = new URL(url.startsWith("http") ? url : `https://${url}`).host.toLowerCase()
      return host
    } catch {
      return null
    }
  }

  return domainPool.some((entry) => {
    const allowedHost = normalizeHost(entry)
    if (!allowedHost) return false
    return incomingHost === allowedHost || incomingHost.endsWith(`.${allowedHost}`)
  })
}

/**
 * Ask a cheap LLM to generate 2-3 contextually-relevant, language-correct
 * follow-up suggestions for the last bot message.
 *
 * - Model: gpt-4o-mini (cheapest / fastest on OpenRouter, ~$0.000015 / call)
 * - Timeout: 2.5 s — falls back silently to heuristic on any error
 * - Input: bot response truncated to 500 chars to keep tokens minimal
 * - Output: string[] of 2-3 short replies (≤40 chars each)
 */
async function buildWidgetSuggestionsWithAI(
  response: string,
  language: string,
  fallbackQuickReplies?: string[],
  workspaceId?: string
): Promise<string[]> {
  // Prepare static quick replies as fallback
  const staticReplies = (fallbackQuickReplies || [])
    .filter((q) => typeof q === "string" && q.trim().length > 0)
    .slice(0, 4)

  // If no valid response or API key, use static fallback
  if (!response || response.trim().length < 10) return staticReplies
  
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return staticReplies

  // 📚 Fetch active FAQ questions from DB to ground suggestions in real knowledge
  // If no FAQs exist → use static quick replies as fallback
  let faqQuestions: string[] = []
  if (workspaceId) {
    try {
      const faqs = await prisma.fAQ.findMany({
        where: { workspaceId, isActive: true },
        select: { question: true },
        orderBy: { createdAt: "asc" },
        take: 40, // cap to avoid huge prompts
      })
      faqQuestions = faqs.map((f: { question: string }) => f.question.trim()).filter(Boolean)
    } catch (err) {
      logger.warn("[WIDGET-SUGGESTIONS-AI] Failed to load FAQs, using static fallback", {
        error: err instanceof Error ? err.message : String(err),
      })
      return staticReplies
    }
  }

  // No FAQ knowledge base → use static quick replies as fallback
  if (faqQuestions.length === 0) return staticReplies

  const lang = normLang(language)
  const langName: Record<string, string> = { it: "Italian", en: "English", es: "Spanish", pt: "Portuguese" }
  const truncated = response.slice(0, 600)
  const faqList = faqQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")

  try {
    const res = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        max_tokens: 150,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              `You select clickable follow-up suggestions for a chat widget from a fixed FAQ list.\n` +
              `Output language: ${langName[lang] || "English"}. ALL suggestions MUST be written in this language — regardless of the language of the FAQ list.\n` +
              `\n` +
              `WHEN TO RETURN EMPTY: Return [] (empty array, no suggestions) if the chatbot reply is about ANY of these topics:\n` +
              `- Appointment booking, scheduling, available slots, confirming/cancelling/rescheduling appointments\n` +
              `- Product or service prices, costs, pricing, discounts, offers\n` +
              `- Specific products or services (descriptions, details, availability)\n` +
              `- User registration, login, account creation, sign up\n` +
              `In these cases the user needs to act, not browse more FAQ topics — suggestions would distract them.\n` +
              `\n` +
              `STRICT RULES (when NOT returning empty):\n` +
              `- Select EXACTLY 3 FAQ topics that are NATURALLY relevant as follow-ups to the chatbot reply\n` +
              `- TRANSLATE and REWRITE each selected topic in ${langName[lang] || "English"} — do NOT copy the original FAQ text verbatim\n` +
              `- Write each suggestion in FIRST PERSON (e.g. "I want to know the prices" not "Prices")\n` +
              `- Max 40 characters per suggestion — shorten if needed\n` +
              `- No links, no emoji, no punctuation at the end\n` +
              `- Return ONLY a raw JSON array of EXACTLY 3 strings, or [] if the reply matches the empty cases above. Example: ["How can I pay?","Where is my order?","Can I modify it?"]`,
          },
          {
            role: "user",
            content: `Chatbot reply:\n"${truncated}"\n\nFAQ LIST:\n${faqList}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
          "X-Title": "eChatbot Widget Suggestions",
        },
        timeout: 2500,
      }
    )

    const raw: string = res.data?.choices?.[0]?.message?.content?.trim() || "[]"
    const cleaned = raw.replace(/^```[\w]*\n?/, "").replace(/```$/, "").trim()
    const parsed: unknown = JSON.parse(cleaned)

    if (Array.isArray(parsed)) {
      const valid = (parsed as unknown[])
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0 && s.length <= 45)
      
      // RULE: [] means the AI intentionally suppressed suggestions (booking/prices/products/registration)
      if (Array.isArray(parsed) && parsed.length === 0) {
        logger.info("[WIDGET-SUGGESTIONS-AI] AI suppressed suggestions for this response topic")
        return []
      }

      // RULE: We need EXACTLY 3 suggestions. If LLM returned <3, use static fallback
      if (valid.length >= 3) {
        return valid.slice(0, 3)
      } else {
        logger.warn("[WIDGET-SUGGESTIONS-AI] LLM returned <3 suggestions, using static fallback", {
          returnedCount: valid.length
        })
        return staticReplies
      }
    }
  } catch (err) {
    logger.warn("[WIDGET-SUGGESTIONS-AI] Failed, using static fallback", {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // Final fallback to static quick replies
  return staticReplies
}

// Suggestion labels per language for each context key
const SUGGESTIONS_I18N: Record<string, Record<string, string[]>> = {
  profile: {
    it: ["Apri il mio profilo", "Non riesco ad aprire il link", "Grazie!"],
    en: ["Open my profile", "Link not working", "Thank you!"],
    es: ["Abrir mi perfil", "El link no funciona", "¡Gracias!"],
    pt: ["Abrir meu perfil", "Link não funciona", "Obrigado!"],
  },
  order: {
    it: ["Dov'è il mio ordine?", "Voglio modificare l'ordine", "Contatta corriere"],
    en: ["Where's my order?", "Modify my order", "Contact courier"],
    es: ["¿Dónde está mi pedido?", "Modificar pedido", "Contactar mensajero"],
    pt: ["Onde está meu pedido?", "Modificar pedido", "Contatar entregador"],
  },
  price: {
    it: ["Voglio acquistare", "Ci sono sconti?", "Altre info sui prodotti"],
    en: ["I want to buy", "Any discounts?", "More product info"],
    es: ["Quiero comprar", "¿Hay descuentos?", "Más info sobre productos"],
    pt: ["Quero comprar", "Tem descontos?", "Mais info sobre produtos"],
  },
  products: {
    it: ["Vedi il catalogo", "Qual è il prezzo?", "Come ordino?"],
    en: ["View catalog", "What's the price?", "How do I order?"],
    es: ["Ver catálogo", "¿Cuál es el precio?", "¿Cómo compro?"],
    pt: ["Ver catálogo", "Qual é o preço?", "Como faço um pedido?"],
  },
  payment: {
    it: ["Come pago?", "Altre modalità di pagamento", "Problema col pagamento"],
    en: ["How do I pay?", "Other payment methods", "Payment issue"],
    es: ["¿Cómo pago?", "Otros métodos de pago", "Problema con el pago"],
    pt: ["Como pago?", "Outros métodos de pagamento", "Problema com pagamento"],
  },
  shipping: {
    it: ["Quando arriva?", "Traccia la spedizione", "Modifica indirizzo"],
    en: ["When will it arrive?", "Track shipment", "Change address"],
    es: ["¿Cuándo llega?", "Rastrear envío", "Cambiar dirección"],
    pt: ["Quando chega?", "Rastrear envio", "Alterar endereço"],
  },
  yesno: {
    it: ["Sì, esatto", "No, grazie", "Dimmi di più"],
    en: ["Yes, exactly", "No, thank you", "Tell me more"],
    es: ["Sí, exacto", "No, gracias", "Cuéntame más"],
    pt: ["Sim, exato", "Não, obrigado", "Me diga mais"],
  },
  greeting: {
    it: ["Vedi i prodotti", "Stato del mio ordine", "Parla con un operatore"],
    en: ["View products", "My order status", "Talk to an agent"],
    es: ["Ver productos", "Estado de mi pedido", "Hablar con un agente"],
    pt: ["Ver produtos", "Status do meu pedido", "Falar com um agente"],
  },
  fallback: {
    it: ["Dimmi di più", "Parla con un operatore"],
    en: ["Tell me more", "Talk to an agent"],
    es: ["Cuéntame más", "Hablar con un agente"],
    pt: ["Me diga mais", "Falar com um agente"],
  },
}

/** Normalise language code: "ENG" | "ITA" | "ESP" | "POR" | "en" | "it" | … → "en" | "it" | "es" | "pt" */
function normLang(raw?: string): string {
  if (!raw) return "en"
  const l = raw.toLowerCase().slice(0, 3)
  const map: Record<string, string> = { eng: "en", ita: "it", esp: "es", por: "pt", por2: "pt", en: "en", it: "it", es: "es", pt: "pt" }
  return map[l] || map[l.slice(0, 2)] || "en"
}

// Quick, deterministic auto-suggestions for widget replies.
// Returns [] when response needs no follow-up (e.g. short confirmations).
export function buildWidgetSuggestions(responseText: string, quickReplies?: string[], language?: string): string[] {
  // 1. Static workspace quick replies take priority
  const baseQuickReplies = (quickReplies || []).filter(
    (q) => typeof q === "string" && q.trim().length > 0
  )
  if (baseQuickReplies.length) {
    return Array.from(new Set(baseQuickReplies)).slice(0, 4)
  }

  if (!responseText || responseText.trim().length < 10) return []

  const lang = normLang(language)
  const lower = responseText.toLowerCase()
  const get = (key: string) => (SUGGESTIONS_I18N[key][lang] || SUGGESTIONS_I18N[key]["en"] || [])

  // 2. Context detection (language-agnostic keywords + response text)
  // Profile / account link
  if (/profil|dati.*link|account.*link|link.*profil/i.test(lower)) {
    return get("profile")
  }
  // Order tracking
  if (/ordin|order|pedido|encomenda/.test(lower) && /spediz|track|conseg|deliver|envio|entrega/.test(lower)) {
    return get("order")
  }
  // Price / cost
  if (/prezzo|costo|€|\$|price|precio|preço|discount|sconto/.test(lower)) {
    return get("price")
  }
  // Products / catalog
  if (/prodott|catalog|articol|product|produto|artículo/.test(lower)) {
    return get("products")
  }
  // Payment
  if (/pagament|payment|pago|pagamento|pay /.test(lower)) {
    return get("payment")
  }
  // Shipping / delivery
  if (/spediz|consegna|shipping|delivery|envío|envio/.test(lower)) {
    return get("shipping")
  }
  // Generic greeting / "how can I help" → show action shortcuts, NOT yes/no
  if (/assist|help|aiut|ayud|ajud|come posso|how can|cómo puedo|how may/.test(lower)) {
    return get("greeting")
  }
  // Question without greeting context → yes/no
  if (lower.includes("?")) {
    return get("yesno")
  }
  // Short acknowledgment → no suggestions
  if (responseText.trim().length < 60) {
    return []
  }
  // Default
  return get("fallback")
}

// 🛡️ Demo anti-abuse kill switch — only for demo workspaces (customChatbotId).
// If a demo channel receives more than DEMO_RATE_LIMIT requests within
// DEMO_RATE_WINDOW_MS, the channel is disabled (channelStatus=false) for the
// WHOLE channel until an admin re-enables it manually. In-memory sliding window
// keyed by workspaceId (resets on process restart — acceptable for a throttle).
const DEMO_RATE_LIMIT = 10
const DEMO_RATE_WINDOW_MS = 10_000
const demoRequestWindows = new Map<string, number[]>()
function demoRateLimitExceeded(workspaceId: string): boolean {
  const now = Date.now()
  const hits = (demoRequestWindows.get(workspaceId) || []).filter(
    (t) => now - t < DEMO_RATE_WINDOW_MS
  )
  hits.push(now)
  demoRequestWindows.set(workspaceId, hits)
  return hits.length > DEMO_RATE_LIMIT
}

export class WidgetChatController {
  private readonly customClientChatbotService = new CustomClientChatbotService()

  private normalizeLanguage(raw?: string | null): string | null {
    if (!raw) return null
    const code = raw.toLowerCase().split("-")[0]
    // Normalize to 2-letter ISO 639-1 codes (consistent with changeLanguage() and Prisma defaults)
    const map: Record<string, string> = {
      it: "it", ita: "it",
      en: "en", eng: "en",
      es: "es", esp: "es",
      pt: "pt", por: "pt",
      fr: "fr", fra: "fr",
      de: "de", deu: "de",
    }
    return map[code] || raw.toLowerCase()
  }

  /**
   * Translate WIP message using TranslationAgent (same as WhatsApp flow).
   * Falls back to raw text if translation fails.
   */
  private async translateWipMessage(
    rawMessage: Record<string, string> | string | null | undefined,
    targetLanguage: string | null,
    workspaceId: string
  ): Promise<string> {
    // Extract raw text from wipMessage (could be JSON object or string)
    const rawText =
      typeof rawMessage === "string"
        ? rawMessage
        : typeof rawMessage === "object" && rawMessage !== null
          ? (rawMessage as Record<string, string>).en ||
            (rawMessage as Record<string, string>).it ||
            Object.values(rawMessage as Record<string, string>)[0] ||
            "Work in progress. Please contact us later."
          : "Work in progress. Please contact us later."

    // Translate via TranslationAgent (matches WhatsApp WIP behavior)
    try {
      const translationResult = await translationAgent.process({
        workspaceId,
        message: rawText,
        targetLanguage: targetLanguage || "en",
        customerName: "Customer",
        customerId: undefined,
        channel: "widget",
      })
      return translationResult.message || rawText
    } catch (translationError) {
      logger.warn("[WIDGET] ⚠️ WIP translation failed, using raw message", {
        error: translationError,
        workspaceId,
      })
      return rawText
    }
  }

  /**
   * GET /api/v1/widget/status/:workspaceId
   * Get widget availability status
   */
  async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params
      const requestedLanguage = (req.query.language as string | undefined) || null
      const visitorId = (req.query.visitorId as string | undefined) || null

      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: workspaceId },
            { slug: workspaceId }
          ]
        },
        select: {
          id: true,
          deletedAt: true,
          channelStatus: true,
          ownerId: true,
          debugMode: true,
          wipMessage: true,
          widgetLanguage: true, // 🌍 Widget language configuration
          widgetPrimaryColor: true, // 🎨 Widget color
          widgetIcon: true, // 🎨 Widget icon
          widgetUseChannelLogo: true,
          enableWidget: true, // 🚫 CRITICAL: Check if widget is enabled in workspace settings
          whatsappPhoneNumber: true,
          name: true,
          websiteUrl: true,
          customChatbotId: true, // 🎮 demo workspaces bypass enableWidget/debugMode gates
          allowedExternalLinks: true, // reuse as allow-list for widget origins
        },
      })

      if (!workspace) {
        return res.status(404).json({
          success: false,
          status: "disabled",
          message: "Workspace not found",
        })
      }

      const resolvedWorkspaceId = workspace.id

      // 🔒 Origin allow-list: only allow requests coming from configured domains
      if (!isOriginAllowed(req, workspace.websiteUrl, workspace.allowedExternalLinks as string[] | null)) {
        return res.status(403).json({
          success: false,
          status: "forbidden",
          message: "Origin not allowed for this widget",
        })
      }

      // 👤 LIFECYCLE CHECK: If visitorId is provided, check if already registered
      let registeredCustomer = null
      if (visitorId) {
        registeredCustomer = await prisma.customers.findFirst({
          where: {
            workspaceId: resolvedWorkspaceId,
            customId: visitorId,
            isActive: true, // Only recognized if fully registered
            deletedAt: null
          },
          select: {
            id: true,
            name: true,
            language: true
          }
        })

        if (registeredCustomer) {
          logger.info("[WIDGET-STATUS] 👤 Recognizing returning visitor", {
            visitorId,
            customerId: registeredCustomer.id,
            workspaceId: resolvedWorkspaceId
          })
        }
      }

      if (workspace.deletedAt !== null) {
        return res.status(200).json({
          success: true,
          status: "disabled",
          channelStatus: workspace.channelStatus ?? false,
          debugMode: workspace.debugMode ?? false,
        workspace: {
          channelStatus: workspace.channelStatus ?? false,
          debugMode: workspace.debugMode ?? false,
          whatsappPhoneNumber: workspace.whatsappPhoneNumber,
          name: workspace.name,
          websiteUrl: workspace.websiteUrl,
          allowedOrigins: workspace.allowedExternalLinks,
        },
      })
    }

      if (workspace.ownerId) {
        const owner = await prisma.user.findUnique({
          where: { id: workspace.ownerId },
          select: { status: true },
        })

        if (owner?.status === "INACTIVE") {
          return res.status(200).json({
            success: true,
            status: "disabled",
            channelStatus: workspace.channelStatus ?? false,
            debugMode: workspace.debugMode ?? false,
          })
        }
      }

      // 🚫 CRITICAL: Check if widget is enabled (from backoffice toggle)
      // Only explicitly TRUE enables the widget (false/null/undefined = disabled)
      // 🎮 DEMO BYPASS: demo workspaces (customChatbotId) are always widget-enabled
      if (workspace.enableWidget !== true && !workspace.customChatbotId) {
        return res.status(200).json({
          success: true,
          status: "disabled",
          channelStatus: false,
          debugMode: workspace.debugMode ?? false,
          workspace: {
            channelStatus: workspace.channelStatus ?? false,
            debugMode: workspace.debugMode ?? false,
            whatsappPhoneNumber: workspace.whatsappPhoneNumber,
            name: workspace.name,
          },
          message: "Widget is disabled",
        })
      }

      // 🚫 channelStatus=false = total shutdown (no WIP)
      // 🧪 EXCEPTION: Playground mode with debugMode=true bypasses this (admin testing)
      if (workspace.channelStatus === false) {
        // ⚠️ PUBLIC ACCESS BLOCKED - return disabled status
        return res.status(200).json({
          success: true,
          status: "disabled",
          channelStatus: false,
          debugMode: workspace.debugMode ?? false,
          workspace: {
            channelStatus: workspace.channelStatus ?? false,
            debugMode: workspace.debugMode ?? false,
            whatsappPhoneNumber: workspace.whatsappPhoneNumber,
            name: workspace.name,
          },
          message: "Channel is disabled",
        })
      }

      // 🎮 DEMO BYPASS: demo workspaces always serve the real bot (never WIP)
      if (workspace.debugMode === true && !workspace.customChatbotId) {
        const wipMessage = await this.translateWipMessage(
          workspace.wipMessage as Record<string, string> | string | null,
          requestedLanguage,
          resolvedWorkspaceId
        )
        return res.status(200).json({
          success: true,
          status: "wip",
          channelStatus: workspace.channelStatus ?? false,
          debugMode: workspace.debugMode ?? false,
          wipMessage,
        workspace: {
          channelStatus: workspace.channelStatus ?? false,
          debugMode: workspace.debugMode ?? false,
          whatsappPhoneNumber: workspace.whatsappPhoneNumber,
          name: workspace.name,
          websiteUrl: workspace.websiteUrl,
          allowedOrigins: workspace.allowedExternalLinks,
        },
        customer: registeredCustomer ? {
          id: registeredCustomer.id,
          name: registeredCustomer.name,
          language: registeredCustomer.language,
            pushNotificationsConsent: registeredCustomer.push_notifications_consent ?? false,
          } : null
        })
      }

      return res.status(200).json({
        success: true,
        status: "active",
        channelStatus: workspace.channelStatus ?? true,
        debugMode: workspace.debugMode ?? false,
        language: workspace.widgetLanguage || "en", // 🌍 Widget configured language
        primaryColor: workspace.widgetPrimaryColor || "#22c55e", // 🎨 Widget color
        icon: workspace.widgetIcon || "sparkles", // 🎨 Widget icon
        useChannelLogo: workspace.widgetUseChannelLogo ?? false,
        workspaceId: resolvedWorkspaceId,
        workspace: {
          channelStatus: workspace.channelStatus ?? true,
          debugMode: workspace.debugMode ?? false,
          whatsappPhoneNumber: workspace.whatsappPhoneNumber,
          name: workspace.name,
          websiteUrl: workspace.websiteUrl,
          allowedOrigins: workspace.allowedExternalLinks,
        },
        customer: registeredCustomer ? {
          id: registeredCustomer.id,
          name: registeredCustomer.name,
          language: registeredCustomer.language,
          pushNotificationsConsent: registeredCustomer.push_notifications_consent ?? false,
        } : null
      })
    } catch (error) {
      logger.error("❌ Error getting widget status", error)
      return res.status(500).json({
        success: false,
        status: "error",
        message: "Failed to fetch widget status",
      })
    }
  }

  /**
   * POST /api/v1/widget/register/:workspaceId
   * Register visitor with first message (deduplicates by phone)
   */
  async registerAndStart(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      // 1. Validate schema
      const validation = WIDGET_REGISTER_SCHEMA.safeParse(req.body)
      if (!validation.success) {
        logger.error("[WIDGET-REGISTER] ❌ Validation failed", {
          errors: validation.error.errors,
        })
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid registration data",
          details: validation.error.errors,
        })
      }

      const {
        visitorId,
        name,
        phone,
        email,
        language,
        firstMessage,
        pushNotificationsConsent,
        isPlayground,
      } = validation.data

      // Normalize phone (strip spaces/dashes) for lookup + creation
      const normalizedPhone = phone.replace(/[\s-]/g, "")

      // 2. Validate visitorId format + expiry
      if (!VisitorIdService.validate(visitorId)) {
        return res.status(400).json({
          error: "INVALID_VISITOR_ID",
          message: "Invalid visitor ID format",
        })
      }
      if (VisitorIdService.isExpired(visitorId)) {
        return res.status(400).json({
          error: "EXPIRED_VISITOR_ID",
          message: "Visitor ID expired. Please refresh the page.",
        })
      }

      // 3. Verify workspace (Resolved by ID or Slug)
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: workspaceId },
            { slug: workspaceId }
          ]
        },
        select: {
          id: true,
          slug: true,
          deletedAt: true,
          channelStatus: true,
          ownerId: true,
          enableWidget: true,
          defaultLanguage: true,
          debugMode: true,
          wipMessage: true,
          welcomeMessage: true,
          widgetAutoSuggestionsEnabled: true,
          widgetQuickReplies: true,
          websiteUrl: true,
          allowedExternalLinks: true,
          customChatbotId: true,
        },
      })

      if (!workspace) {
        logger.error("[WIDGET-REGISTER] ❌ Workspace not found", { workspaceId })
        return res.status(404).json({
          error: "WORKSPACE_NOT_FOUND",
          message: "Workspace not found",
        })
      }

      // Use the resolved DB ID for all downstream operations
      const resolvedWorkspaceId = workspace.id

      if (workspace.deletedAt !== null) {
        return res.status(503).json({
          error: "SERVICE_UNAVAILABLE",
          message: "Service temporarily unavailable",
          retryAfter: 3600000,
        })
      }

      if (workspace.enableWidget !== true && !isPlayground && !workspace.customChatbotId) {
        return res.status(403).json({
          error: "WIDGET_DISABLED",
          message: "Widget chat is disabled for this workspace",
        })
      }

      if (workspace.channelStatus === false && !isPlayground) {
        return res.status(403).json({
          error: "CHANNEL_DISABLED",
          message: "Channel is disabled",
        })
      }

      // 🛠️ DEBUG MODE (WIP) — block registration + LLM when workspace is under maintenance
      // NOTE: canProcessMessages below uses skipChannelCheck=true (avoids double channelStatus check),
      // which also skips debugMode. We must check it explicitly here.
      // 🧪 PLAYGROUND BYPASS: isPlayground=true skips WIP (admin testing)
      if (workspace.debugMode === true && !isPlayground && !workspace.customChatbotId) {
        const lang = this.normalizeLanguage(language) || workspace.defaultLanguage || "en"
        const wipResponse = await this.translateWipMessage(
          workspace.wipMessage as Record<string, string> | string | null,
          lang,
          resolvedWorkspaceId
        )
        return res.status(200).json({
          success: true,
          status: "wip",
          response: wipResponse,
        })
      }

      // 🔒 Origin allow-list: only allow requests coming from configured domains
      // 🧪 PLAYGROUND BYPASS: admin calls from dashboard domain bypass origin check
      if (!isPlayground && !isOriginAllowed(req, workspace.websiteUrl, workspace.allowedExternalLinks as string[] | null)) {
        return res.status(403).json({
          error: "FORBIDDEN_ORIGIN",
          message: "Origin not allowed for this widget",
        })
      }

      // 4. Check owner status
      if (workspace.ownerId) {
        const owner = await prisma.user.findUnique({
          where: { id: workspace.ownerId },
          select: { status: true },
        })
        if (owner?.status === "INACTIVE") {
          return res.status(503).json({
            error: "SERVICE_UNAVAILABLE",
            message: "Service temporarily unavailable",
            retryAfter: 3600000,
          })
        }
      }

      // 5. Billing access check — skip for playground (admin testing, no credit deduction)
      if (!isPlayground) {
        const workspaceAccessService = new WorkspaceAccessService(prisma)
        const accessResult = await workspaceAccessService.canProcessMessages(resolvedWorkspaceId, true)
        if (!accessResult.canProcess) {
          logger.warn("[WIDGET-REGISTER] 🚫 Workspace blocked by billing", {
            workspaceId: resolvedWorkspaceId,
            blockReason: accessResult.blockReason,
          })
          const isBillingBlock =
            accessResult.blockReason === "PAUSED" ||
            accessResult.blockReason === "PAYMENT_FAILED" ||
            accessResult.blockReason === "CREDIT_EXHAUSTED"
          return res.status(isBillingBlock ? 402 : 403).json({
            error: accessResult.blockReason || "WORKSPACE_BLOCKED",
            message: accessResult.message || "Workspace blocked",
          })
        }
      } else {
        logger.info("[WIDGET-REGISTER] 🧪 Playground mode - skipping billing check", { workspaceId: resolvedWorkspaceId })
      }

      // 6. Normalize language
      const normalizedLanguage =
        this.normalizeLanguage(language) || workspace.defaultLanguage || "en"

      // 7. Deduplication: find or create customer by phone within workspace
      let isNewCustomer = false
      let customer = await prisma.customers.findFirst({
        where: { workspaceId: resolvedWorkspaceId, phone: normalizedPhone, deletedAt: null },
      })

      // Fallback: look up by customId (visitorId) across ALL workspaces
      // Handles case where customer was created with old slug-based workspaceId
      if (!customer) {
        customer = await prisma.customers.findFirst({
          where: { customId: visitorId, deletedAt: null },
        })
        if (customer) {
          logger.info("[WIDGET-REGISTER] 👤 Found customer by customId (potential slug→UUID migration)", {
            customerId: customer.id,
            existingWorkspaceId: customer.workspaceId,
            resolvedWorkspaceId,
          })
        }
      }

      if (customer) {
        // ✅ RETURNING USER: Update existing customer with latest data
        const updateData: Record<string, unknown> = {
          customId: visitorId,
          workspaceId: resolvedWorkspaceId, // migrate slug→UUID if needed
          isActive: true,     // ensure active on re-registration
          deletedAt: null,    // reactivate if soft-deleted
        }
        if (name && name !== customer.name) updateData.name = name
        if (email && email.length > 0 && email !== customer.email) updateData.email = email
        if (normalizedLanguage && normalizedLanguage !== customer.language) {
          updateData.language = normalizedLanguage
        }
        if (pushNotificationsConsent === true) {
          updateData.push_notifications_consent = true
          updateData.push_notifications_consent_at = new Date()
        }
        
        try {
          customer = await prisma.customers.update({
            where: { id: customer.id },
            data: updateData,
          })
        } catch (updateError: any) {
          // Handle unique constraint violation on customId (visitorId already linked to another phone)
          if (updateError?.code === "P2002" && updateError?.meta?.target?.includes("customId")) {
            logger.warn("[WIDGET-REGISTER] 👤 visitorId already linked to another customer, stripping for update", {
              customerId: customer.id,
              visitorId
            })
            delete updateData.customId
            customer = await prisma.customers.update({
              where: { id: customer.id },
              data: updateData,
            })
          } else {
            throw updateError
          }
        }

        logger.info("[WIDGET-REGISTER] 👤 RETURNING USER - Updated profile", {
          customerId: customer.id,
          phone,
          isNewCustomer: false,
          updatedFields: Object.keys(updateData),
        })
      } else {
        // ✅ NEW USER: Create new registered customer
        isNewCustomer = true
        try {
          customer = await prisma.customers.create({
            data: {
              workspaceId: resolvedWorkspaceId,
              customId: visitorId,
              name,
              phone: normalizedPhone,
              email: email && email.length > 0 ? email : `${visitorId}@visitor.local`,
              isActive: true, // Registered user
              language: normalizedLanguage,
              push_notifications_consent: pushNotificationsConsent === true,
              push_notifications_consent_at: pushNotificationsConsent === true ? new Date() : undefined,
            },
          })
        } catch (createError: any) {
          // Unique constraint (phone) → race/format mismatch: reuse existing
          if (createError?.code === "P2002") {
            const isPhoneConflict = createError?.meta?.target?.includes("phone")
            const isCustomIdConflict = createError?.meta?.target?.includes("customId")

            if (isPhoneConflict) {
              logger.warn("[WIDGET-REGISTER] Duplicate phone, reusing existing customer", {
                workspaceId: resolvedWorkspaceId,
                phone: normalizedPhone,
              })
              customer = await prisma.customers.findFirst({
                where: { workspaceId: resolvedWorkspaceId, phone: normalizedPhone },
              })
            } else if (isCustomIdConflict) {
              // visitorId already exists (e.g. customer was created with old slug-based workspaceId)
              // → find that existing customer and update it with resolved UUID workspaceId + latest data
              logger.warn("[WIDGET-REGISTER] visitorId already linked to existing customer, updating it", {
                resolvedWorkspaceId,
                visitorId,
              })
              const existingByCustomId = await prisma.customers.findFirst({
                where: { customId: visitorId },
              })
              if (existingByCustomId) {
                customer = await prisma.customers.update({
                  where: { id: existingByCustomId.id },
                  data: {
                    workspaceId: resolvedWorkspaceId, // migrate from slug → UUID
                    name: name || existingByCustomId.name,
                    phone: normalizedPhone || existingByCustomId.phone,
                    email:
                      email && email.length > 0
                        ? email
                        : existingByCustomId.email,
                    isActive: true,
                    language: normalizedLanguage || existingByCustomId.language,
                    push_notifications_consent:
                      pushNotificationsConsent === true
                        ? true
                        : existingByCustomId.push_notifications_consent,
                    push_notifications_consent_at:
                      pushNotificationsConsent === true
                        ? new Date()
                        : existingByCustomId.push_notifications_consent_at,
                  },
                })
                isNewCustomer = false
                logger.info("[WIDGET-REGISTER] 👤 Migrated customer to resolved workspaceId", {
                  customerId: customer.id,
                  resolvedWorkspaceId,
                })
              } else {
                // Truly orphaned customId with no matching record → create fresh without customId
                customer = await prisma.customers.create({
                  data: {
                    workspaceId: resolvedWorkspaceId,
                    name,
                    phone: normalizedPhone,
                    email: email && email.length > 0 ? email : `${visitorId}@visitor.local`,
                    isActive: true,
                    language: normalizedLanguage,
                    push_notifications_consent: pushNotificationsConsent === true,
                    push_notifications_consent_at: pushNotificationsConsent === true ? new Date() : undefined,
                  },
                })
              }
            } else {
              throw createError
            }
          } else {
            throw createError
          }
        }
        
        if (!customer) {
          throw new Error("Failed to resolve or create customer")
        }

        logger.info("[WIDGET-REGISTER] 👤 NEW USER - Created customer", {
          customerId: customer.id,
          phone,
          isNewCustomer: true,
        })
      }

      // 8. Find or create chat session
      let chatSession = await prisma.chatSession.findFirst({
        where: { customerId: customer.id, status: "active" },
      })

      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            workspaceId: resolvedWorkspaceId,
            customerId: customer.id,
            status: "active",
            isAnonymous: false,
            visitorId,
            channel: "widget",
            expiresAt: VisitorIdService.getExpiryDate(visitorId),
          },
        })
        logger.info("[WIDGET-REGISTER] 💬 Created chat session", {
          sessionId: chatSession.id,
        })
      }

      // 9. Save user's first message to conversation history
      await prisma.conversationMessage.create({
        data: {
          workspaceId: resolvedWorkspaceId,
          customerId: customer.id,
          conversationId: chatSession.id,
          role: "user",
          content: firstMessage,
          agentType: AgentType.ROUTER,
          tokensUsed: 0,
        },
      })

      // 10. Process first message through LLM (registrationPromptLevel=0: user is registered)
      // NOTE: Wrapped in try-catch so a transient LLM failure doesn't fail the whole registration.
      // Customer + session are already created at this point — registration must succeed regardless.
      logger.info("[WIDGET-REGISTER] 🤖 Processing first message through LLM", {
        customerId: customer.id,
        language: normalizedLanguage,
        workspaceId: resolvedWorkspaceId,
      })

      let llmResponse = "Welcome! How can I help you?"
      let llmAgentUsed: string = AgentType.ROUTER
      let llmTokensUsed = 0
      let suggestions: string[] = []

      // 🎯 CUSTOM CLIENT: Try custom chatbot first (e.g. ecolaundry)
      // Pass history: [] because this is the first message of a new session.
      // chatbotFn will prepend welcomeMessage automatically when history is empty.
      let customClientRegHandled = false
      try {
        const wipRegMessageStr =
          typeof workspace.wipMessage === "string"
            ? workspace.wipMessage
            : typeof workspace.wipMessage === "object" && workspace.wipMessage !== null
              ? (workspace.wipMessage as Record<string, string>).en ||
                (workspace.wipMessage as Record<string, string>).it ||
                Object.values(workspace.wipMessage as Record<string, string>)[0] ||
                "Work in progress."
              : "Work in progress."

        const customClientRegResult = await this.customClientChatbotService.invoke({
          workspaceId: resolvedWorkspaceId,
          workspaceSlug: workspace.slug,
          customChatbotId: workspace.customChatbotId,
          userMessage: firstMessage,
          userName: customer.name,
          channel: isPlayground ? "playground" : "widget",
          welcomeMessage: typeof workspace.welcomeMessage === "string" ? workspace.welcomeMessage : "",
          wipMessage: wipRegMessageStr,
          channelActive: workspace.channelStatus !== false,
          debugChannel: workspace.debugMode === true,
          isPlayground: isPlayground || false,
          language: normalizedLanguage,
          sessionId: chatSession.id,
          customerId: customer.id,
          phoneNumber: normalizedPhone,
          history: [], // first message: no prior history in this fresh session
        })

        if (customClientRegResult.handled && customClientRegResult.output) {
          customClientRegHandled = true
          const customOutput = customClientRegResult.output
          await applyCustomerPatches(customOutput.patches, customer.id, resolvedWorkspaceId)
          llmResponse = customOutput.reply || llmResponse
          llmAgentUsed = AgentType.ROUTER
          llmTokensUsed = customOutput.meta?.tokensUsed || 0
          if (!customOutput.shouldEscalate && workspace.widgetAutoSuggestionsEnabled === true && customOutput.reply) {
            suggestions = await buildWidgetSuggestionsWithAI(
              customOutput.reply,
              normalizedLanguage || "en",
              workspace.widgetQuickReplies as any,
              resolvedWorkspaceId
            )
          }
          logger.info("[WIDGET-REGISTER-CUSTOM-CLIENT] ✅ custom-client processed first message", {
            workspaceId: resolvedWorkspaceId,
            customerId: customer.id,
            hasReply: Boolean(customOutput.reply),
          })
        }
      } catch (customClientError) {
        logger.error("[WIDGET-REGISTER-CUSTOM-CLIENT] ❌ custom-client failed (non-fatal), falling back to LLM", {
          error: customClientError instanceof Error ? customClientError.message : String(customClientError),
          workspaceId: resolvedWorkspaceId,
        })
      }

      if (!customClientRegHandled) {
        try {
          const llmResult = await llmRouterService.routeMessage({
            workspaceId: resolvedWorkspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            messageId: `widget-reg-${visitorId}-${Date.now()}`,
            message: firstMessage,
            customerLanguage: normalizedLanguage,
            customerName: customer.name,
            isSystemMessage: false,
            channel: "widget",
            registrationPromptLevel: 0, // Registered user - no registration prompts
          })

          logger.info("[WIDGET-REGISTER] ✅ LLM response received", {
            agentUsed: llmResult.agentUsed,
            tokensUsed: llmResult.tokensUsed,
          })

          llmResponse = llmResult.response || llmResponse
          llmAgentUsed = llmResult.agentUsed || llmAgentUsed
          llmTokensUsed = llmResult.tokensUsed || 0

          // Generate AI suggestions for first message too (so user sees quick reply buttons)
          if (workspace.widgetAutoSuggestionsEnabled === true) {
            suggestions = await buildWidgetSuggestionsWithAI(
              llmResponse,
              normalizedLanguage || "en",
              workspace.widgetQuickReplies as any,
              resolvedWorkspaceId
            )
          }
        } catch (llmError) {
          logger.error("[WIDGET-REGISTER] ❌ LLM call failed (non-fatal) — returning fallback response", {
            error: llmError instanceof Error ? llmError.message : String(llmError),
            customerId: customer.id,
            workspaceId: resolvedWorkspaceId,
          })
          // Registration still succeeds — user can continue chatting normally
        }
      }

      // 11. Save LLM response to conversation history
      await prisma.conversationMessage.create({
        data: {
          workspaceId: resolvedWorkspaceId,
          customerId: customer.id,
          conversationId: chatSession.id,
          role: "assistant",
          content: llmResponse,
          agentType: llmAgentUsed,
          tokensUsed: llmTokensUsed,
        },
      })

      // 12. Billing: deduct widget message credit — skip for playground and debug mode
      if (workspace.ownerId && !isPlayground && !workspace.debugMode) {
        try {
          const billingService = new SubscriptionBillingService(prisma)
          await billingService.deductOwnerWidgetMessageCredit(
            workspace.ownerId,
            resolvedWorkspaceId,
            `widget-reg-${visitorId}-${Date.now()}`
          )
        } catch (billingError) {
          logger.error("[WIDGET-REGISTER] ❌ Billing error (non-fatal):", billingError)
          // Don't fail the response - billing failure shouldn't break registration UX
        }
      }

      return res.status(200).json({
        success: true,
        customerId: customer.id,
        sessionId: chatSession.id,
        response: llmResponse,
        isNewCustomer,
        suggestions,
        // 🌍 Return customer language — widget can sync its dropdown
        language: normalizedLanguage,
        // 👤 Profile data — widget saves this in localStorage to show profile badge in header
        customerProfile: {
          name: customer.name,
          email: customer.email?.endsWith("@visitor.local") ? null : customer.email,
          phone: customer.phone,
          isActive: customer.isActive,
        },
      })
    } catch (error) {
      logger.error("[WIDGET-REGISTER] ❌ Registration error", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        workspaceId: req.params.workspaceId,
      })
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Registration failed",
      })
    }
  }

  /**
   * POST /api/v1/widget/chat-audio/:workspaceId
   * 🎤 Voice note from the widget composer (MediaRecorder blob).
   * Pipeline: transcribe (Whisper) → the transcription becomes the message →
   * reuse sendMessage for the bot turn (single source of truth). The widget
   * shows a "voice message" bubble; the bot reasons on the transcription.
   */
  async sendAudioMessage(req: Request, res: Response): Promise<Response> {
    const file = (req as any).file as Express.Multer.File | undefined
    const cleanup = () => {
      if (file?.path) {
        try {
          fs.unlinkSync(file.path)
        } catch {
          /* ignore */
        }
      }
    }
    try {
      if (!file) {
        return res.status(400).json({ error: "audio file is required" })
      }
      const { workspaceId } = req.params
      const buffer = fs.readFileSync(file.path)
      const declaredMime = (file.mimetype || "audio/webm").split(";")[0].trim()

      const transcription = await transcribeAudio({
        audioBuffer: buffer,
        declaredMime,
        provider: "widget",
        workspaceId,
      })
      cleanup()
      if (!transcription?.text) {
        return res.status(422).json({ error: "Could not transcribe audio" })
      }

      // Hand off to the normal text turn — the transcription IS the message.
      req.body = { ...req.body, message: transcription.text }
      return this.sendMessage(req, res)
    } catch (error: any) {
      cleanup()
      logger.error("[WIDGET] audio message error", { error: error?.message })
      return res.status(500).json({ error: "Failed to process audio message" })
    }
  }

  /**
   * POST /api/v1/widget/chat/:workspaceId
   * Send a message from widget
   */
  async sendMessage(req: Request, res: Response): Promise<Response> {
    try {
      logger.info("🎯 WidgetChatController.sendMessage called", { 
        workspaceId: req.params.workspaceId,
        body: req.body 
      })
      
      const { workspaceId } = req.params

      // Validate request body
      const validation = WIDGET_MESSAGE_SCHEMA.safeParse(req.body)
      if (!validation.success) {
        logger.error("❌ Widget message validation failed", {
          workspaceId,
          body: req.body,
          errors: validation.error.errors,
        })
        return res.status(400).json({
          error: "INVALID_INPUT",
          message: "Invalid request format",
          details: validation.error.errors,
        })
      }

      const { visitorId, message, sessionId, language, phoneNumber, customerId, isPlayground } = validation.data
      
      // 🌍 Language detection priority:
      // 1. Explicit language from widget body/API (if provided) - HIGHEST PRIORITY! ✅
      // 2. Phone number prefix (if provided) - second priority 📱
      // 3. Accept-Language HTTP header (browser preference) 🌐
      // 4. Customer's saved language (if exists) 💾
      // 5. Workspace default language 🏢
      // 6. English (system default) 🇬🇧
      
      // Detect from explicit language parameter
      const explicitLanguage = this.normalizeLanguage(language)
      
      // Detect from phone number prefix
      let detectedLanguageFromPhone: string | null = null
      if (phoneNumber) {
        const langCode = detectLanguageFromPhonePrefix(phoneNumber)
        detectedLanguageFromPhone = this.normalizeLanguage(langCode)
        logger.info("📱 Language detected from phone number", {
          phoneNumber,
          detectedCode: langCode,
          normalized: detectedLanguageFromPhone,
        })
      }
      
      // Detect from browser
      const acceptLanguageHeader = req.headers['accept-language']
      const browserLanguage = acceptLanguageHeader 
        ? detectLanguageFromHeader(acceptLanguageHeader)
        : null
      const normalizedBrowserLang = browserLanguage 
        ? this.normalizeLanguage(browserLanguage)
        : null
      
      // Apply priority: explicit > phone > browser
      const requestedLanguage = explicitLanguage || detectedLanguageFromPhone || normalizedBrowserLang

      logger.info("📨 Widget message received", {
        workspaceId,
        visitorId,
        messageLength: message.length,
        phoneNumber: phoneNumber || '(none)',
        explicitLanguage: explicitLanguage || '(none)',
        detectedFromPhone: detectedLanguageFromPhone || '(none)',
        detectedFromBrowser: normalizedBrowserLang || '(none)',
        finalLanguage: requestedLanguage || '(fallback to workspace/customer)',
        languagePriority: explicitLanguage ? 'explicit' : detectedLanguageFromPhone ? 'phone' : normalizedBrowserLang ? 'browser' : 'fallback',
      })

      // Validate visitorId format
      const isValidFormat = VisitorIdService.validate(visitorId)
      logger.info("🔍 VisitorId format validation", { visitorId, isValidFormat })
      if (!isValidFormat) {
        logger.error("❌ Invalid visitorId format", { visitorId })
        return res.status(400).json({
          error: "INVALID_VISITOR_ID",
          message: "Invalid visitor ID format",
        })
      }

      // Check if visitorId is expired (older than 24 hours)
      const isExpired = VisitorIdService.isExpired(visitorId)
      logger.info("🔍 VisitorId expiry check", { visitorId, isExpired })
      if (isExpired) {
        logger.error("❌ VisitorId expired", { visitorId })
        return res.status(400).json({
          error: "EXPIRED_VISITOR_ID",
          message: "Visitor ID has expired. Please refresh the page.",
        })
      }

      // Verify workspace exists and is active (supports both ID and slug)
      const workspace = await prisma.workspace.findFirst({
        where: {
          OR: [
            { id: workspaceId },
            { slug: workspaceId }
          ]
        },
        select: {
          id: true,
          slug: true,
          deletedAt: true,
          channelStatus: true,
          ownerId: true,
          language: true,
          defaultLanguage: true, // 🌍 Business Configuration default language
          debugMode: true,
          wipMessage: true, // 🚧 For WIP mode response
          enableWidget: true, // 🚫 CRITICAL: Check if widget is enabled in workspace settings
          welcomeMessage: true, // 👋 For first-visitor welcome message (parity with WhatsApp)
          widgetAutoSuggestionsEnabled: true,
          widgetQuickReplies: true,
          websiteUrl: true,
          allowedExternalLinks: true,
          customChatbotId: true,
        },
      })

      if (!workspace) {
        return res.status(404).json({
          error: "WORKSPACE_NOT_FOUND",
          message: "Workspace not found",
        })
      }

      // Use resolved workspace ID for all downstream operations
      const resolvedWorkspaceId = workspace.id


      if (workspace.deletedAt !== null) {
        return res.status(503).json({
          error: "SERVICE_UNAVAILABLE",
          message: "Chat service is temporarily unavailable",
          retryAfter: 3600000, // 1 hour
        })
      }

      // 🚫 CRITICAL: Check if widget is enabled (from backoffice toggle)
      // 🧪 PLAYGROUND BYPASS: admin testing always allowed
      if (workspace.enableWidget !== true && !isPlayground && !workspace.customChatbotId) {
        logger.warn("❌ Widget message blocked: Widget disabled in settings", {
          workspaceId,
          visitorId,
        })
        return res.status(403).json({
          error: "WIDGET_DISABLED",
          message: "Widget chat is disabled for this workspace",
        })
      }

      // 🚫 channelStatus=false = total shutdown (no WIP)
      // 🧪 PLAYGROUND BYPASS
      if (workspace.channelStatus === false && !isPlayground) {
        logger.warn("❌ Widget message blocked: Channel disabled", {
          workspaceId,
          visitorId,
        })
        return res.status(403).json({
          error: "CHANNEL_DISABLED",
          message: "Channel is disabled",
        })
      }

      // 🛡️ DEMO KILL SWITCH: throttle abuse on the public demo channel.
      // >DEMO_RATE_LIMIT requests / DEMO_RATE_WINDOW_MS on a demo workspace
      // (customChatbotId) disables the WHOLE channel (channelStatus=false) until
      // an admin re-enables it manually. Anti-abuse safety for the public demo.
      if (workspace.customChatbotId && demoRateLimitExceeded(workspace.id)) {
        logger.warn("🛡️ Demo rate limit exceeded — disabling channel", {
          workspaceId,
          visitorId,
        })
        await prisma.workspace
          .update({ where: { id: workspace.id }, data: { channelStatus: false } })
          .catch((e) => logger.error("Failed to disable demo channel", { error: e }))
        return res.status(429).json({
          error: "RATE_LIMITED",
          message: "Demo temporarily disabled due to high traffic.",
          activeChatbot: false,
        })
      }

      // Check owner status (same pattern as workspace validation middleware)
      if (workspace.ownerId) {
        const owner = await prisma.user.findUnique({
          where: { id: workspace.ownerId },
          select: { status: true },
        })

        if (owner?.status === "INACTIVE") {
          logger.warn("❌ Widget message blocked: Owner inactive", {
            workspaceId,
            ownerId: workspace.ownerId,
          })
          return res.status(503).json({
            error: "SERVICE_UNAVAILABLE",
            message: "Chat service is temporarily unavailable",
            retryAfter: 3600000, // 1 hour
          })
        }
      }

      // 🔒 Origin allow-list: only allow requests coming from the configured website domain
      // 🧪 PLAYGROUND BYPASS: admin calls from dashboard bypass origin check
      if (!isPlayground && !isOriginAllowed(req, workspace.websiteUrl, workspace.allowedExternalLinks as string[] | null)) {
        return res.status(403).json({
          error: "FORBIDDEN_ORIGIN",
          message: "Origin not allowed for this widget",
        })
      }

      // Execute 5-step security validation
      // 🧪 PLAYGROUND BYPASS: skip security checks for admin testing
      if (!isPlayground) {
        let securityResults
        try {
          logger.info("🔍 Starting security validation...")
          securityResults = await SecurityCheckService.validateMessage({
            workspaceId,
            visitorId,
            message,
            channel: "widget",
          })
          logger.info("✅ Security validation completed", { resultsCount: securityResults.length })
        } catch (securityError) {
          logger.error("❌ Security validation error", {
            error: securityError instanceof Error ? securityError.message : String(securityError),
            stack: securityError instanceof Error ? securityError.stack : undefined,
          })
          return res.status(500).json({
            error: "SECURITY_CHECK_ERROR",
            message: "Failed to validate message",
          })
        }

        // Check if any security step failed
        const failedStep = securityResults.find((result: any) => !result.passed)
        if (failedStep) {
          logger.warn("🚨 Security check failed", {
            workspaceId,
            visitorId,
            step: failedStep.step,
            reason: failedStep.reason,
          })

          return res.status(429).json({
            error: failedStep.step,
            message: failedStep.reason || "Security check failed",
            retryAfter: failedStep.retryAfter,
            })
        }
      } else {
        logger.info("[WIDGET-SEND] 🧪 Playground mode - skipping security validation", { workspaceId, visitorId })
      }

      logger.info("✅ Workspace validation passed")

      // 💰 SUBSCRIPTION + CREDIT CHECK (skip for debugMode or playground)
      // RULE: Billing ONLY for widget/WhatsApp when debugMode=false and not playground
      if (workspace.debugMode !== true && !isPlayground) {
        const workspaceAccessService = new WorkspaceAccessService(prisma)
        const accessResult = await workspaceAccessService.canProcessMessages(
          workspaceId,
          true // skip channelStatus/debugMode checks (handled above)
        )

        if (!accessResult.canProcess) {
          logger.warn("[WIDGET-BILLING] 🚫 Workspace blocked by billing/access rules", {
            workspaceId,
            blockReason: accessResult.blockReason,
          })

          const isBillingBlock =
            accessResult.blockReason === "PAUSED" ||
            accessResult.blockReason === "PAYMENT_FAILED" ||
            accessResult.blockReason === "CREDIT_EXHAUSTED"

          const errorCode =
            accessResult.blockReason === "CREDIT_EXHAUSTED"
              ? "INSUFFICIENT_CREDIT"
              : accessResult.blockReason || "WORKSPACE_BLOCKED"

          return res.status(isBillingBlock ? 402 : 403).json({
            error: errorCode,
            message: accessResult.message || "Workspace blocked",
            details: accessResult.details,
          })
        }
      } else {
        logger.info("[WIDGET-BILLING] 🧪 Debug mode - skipping billing/access checks", {
          debugMode: workspace.debugMode,
        })
      }

      // 🛠️ DEBUG MODE (WIP) - after security checks, return WIP message
      // 🧪 PLAYGROUND BYPASS: isPlayground=true skips WIP so admin can test the full AI flow
      if (workspace.debugMode === true && !isPlayground && !workspace.customChatbotId) {
        logger.info("🛠️ Widget WIP - debug mode", {
          workspaceId,
          visitorId,
          debugMode: workspace.debugMode,
          channelStatus: workspace.channelStatus,
        })

        const rawLanguage = requestedLanguage || workspace.defaultLanguage || "en"
        const wipResponse = await this.translateWipMessage(
          workspace.wipMessage as Record<string, string> | string | null,
          rawLanguage,
          workspaceId
        )

        return res.status(200).json({
          success: true,
          status: "wip",
          response: wipResponse,
        })
      }

      // 🚫 channelStatus=false → WIP message (skipped for playground)
      if (!workspace.channelStatus && !isPlayground) {
        logger.info("🛠️ Widget WIP - channel disabled", {
          workspaceId,
          visitorId,
          channelStatus: workspace.channelStatus,
        })

        const rawLanguage = requestedLanguage || workspace.defaultLanguage || "en"
        const wipResponse = await this.translateWipMessage(
          workspace.wipMessage as Record<string, string> | string | null,
          rawLanguage,
          workspaceId
        )

        return res.status(200).json({
          success: true,
          status: "wip",
          response: wipResponse,
        })
      }

      // Find or create customer for this visitor
      // Priority: customerId (registered returning user) > visitorId (anonymous/new)
      logger.info("🔍 Finding customer", { visitorId, customerId: customerId || "(none)", workspaceId })
      let customer = null

      // If customerId provided (registered returning user from localStorage), look up by ID first
      if (customerId) {
        customer = await prisma.customers.findFirst({
          where: { workspaceId, id: customerId },
        })
        if (customer) {
          // Update visitorId link for this session (visitor session may have refreshed)
          if (customer.customId !== visitorId) {
            await prisma.customers.update({
              where: { id: customer.id },
              data: { customId: visitorId },
            })
            customer = { ...customer, customId: visitorId }
          }
          logger.info("👤 Found registered returning customer", {
            customerId: customer.id,
            visitorId,
          })
        }
      }

      // Fallback: lookup by visitorId (anonymous user or customerId not found)
      if (!customer) {
        customer = await prisma.customers.findFirst({
          where: { workspaceId, customId: visitorId },
        })
      }

      if (!customer) {
        // Create anonymous customer
        customer = await prisma.customers.create({
          data: {
            workspaceId,
            customId: visitorId,
            name: `Visitor ${visitorId.slice(-8)}`,
            email: `${visitorId}@visitor.local`,
            phone: phoneNumber || undefined, // 📱 Save phone if provided (playground scenario)
            isActive: false, // Anonymous users are NOT registered
            language: requestedLanguage || workspace.defaultLanguage, // 🌍 workspace.defaultLanguage NOT nullable - set during channel registration
          },
        })

        logger.info("👤 Created anonymous customer", {
          customerId: customer.id,
          visitorId,
          phone: phoneNumber || '(none)',
          language: customer.language,
        })
      } else {
        // 🌍 DO NOT overwrite customer.language with widget dropdown language.
        // Customer language is only changed via: (1) registerAndStart(), (2) changeLanguage() chatbot function.
        // Widget dropdown language affects THIS message only (via customerLanguage param to LLM).
        // This prevents chatbot language changes from being overwritten by stale widget dropdown values.
        const updateData: any = {}
        
        if (phoneNumber && !customer.phone) {
          updateData.phone = phoneNumber
        }
        
        if (Object.keys(updateData).length > 0) {
          await prisma.customers.update({
            where: { id: customer.id },
            data: updateData,
          })
          customer = { ...customer, ...updateData }
          logger.info("📝 Updated customer data", {
            customerId: customer.id,
            updates: Object.keys(updateData),
          })
        } else {
          logger.info("👤 Using existing customer (no changes)", {
            customerId: customer.id,
            visitorId,
            language: customer.language,
          })
        }
      }

      logger.info("✅ Customer ready", { customerId: customer.id, visitorId })

      // 🚫 OPERATOR HANDOFF GUARD: If activeChatbot=false an operator is handling the chat.
      // NEVER call LLM — but DO save the user message so the operator can read it in backoffice.
      // RULE: operator takes over → LLM is completely disabled until operator re-enables it.
      if (customer.activeChatbot === false) {
        logger.info("[WIDGET] 🚫 LLM blocked — operator handoff active, saving customer message", {
          customerId: customer.id,
          visitorId,
        })

        // Save customer message to conversation so operator can see it in backoffice
        try {
          const operatorSession = await prisma.chatSession.findFirst({
            where: { customerId: customer.id, status: "active" },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          })
          if (operatorSession) {
            await prisma.conversationMessage.create({
              data: {
                workspaceId,
                customerId: customer.id,
                conversationId: operatorSession.id,
                role: "user",
                content: message,
              },
            })
            logger.info("[WIDGET] 💬 Customer message saved (operator mode)", {
              customerId: customer.id,
              sessionId: operatorSession.id,
            })

            // 🚀 WEBSOCKET: Notify admin dashboard about new customer message in operator mode
            try {
              const { websocketService } = require("../../../services/websocket.service")
              websocketService.notifyNewMessage(workspaceId, {
                id: `widget-operator-${Date.now()}`,
                sessionId: operatorSession.id,
                content: message,
                sender: "customer",
                timestamp: new Date().toISOString(),
                workspaceId,
              })
            } catch (wsError) {
              logger.warn("[WIDGET] ⚠️ WebSocket notification failed (operator mode)", wsError)
            }
          }

          // Relay customer message to operator's WhatsApp number (same as WhatsApp channel)
          // This fills the gap: widget customers' messages must reach the operator on WhatsApp
          try {
            const { OperatorRelayService } = require("../../../application/services/operator-relay.service")
            const operatorRelayService = new OperatorRelayService(prisma)
            await operatorRelayService.relayCustomerMessageToOperator(workspaceId, customer, message)
          } catch (relayError) {
            // Non-blocking — if relay fails, operator can still read messages in backoffice
            logger.error("[WIDGET] ⚠️ Could not relay customer message to operator WhatsApp", relayError)
          }
        } catch (saveError) {
          // Non-blocking — log but don't fail the request
          logger.error("[WIDGET] ⚠️ Could not save customer message in operator mode", saveError)
        }

        return res.status(200).json({
          activeChatbot: false,
          blocked: true,
        })
      }

      // Find or create chat session
      logger.info("🔍 Finding or creating chat session", { customerId: customer.id })
      let chatSession = await prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          status: "active",
        },
      })

      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            workspaceId,
            customerId: customer.id,
            status: "active",
            isAnonymous: true,
            visitorId,
            channel: "widget",
            expiresAt: VisitorIdService.getExpiryDate(visitorId),
          },
        })

        logger.info("💬 Created widget chat session", {
          sessionId: chatSession.id,
          visitorId,
        })
      }
      logger.info("✅ Chat session ready", { sessionId: chatSession?.id, customerId: customer.id })

      // VALIDATION: Ensure chat session exists before routing to LLM
      // This prevents message loss from null conversationId in LLM processing
      if (!chatSession || !chatSession.id) {
        logger.error("[WIDGET] ❌ Chat session creation/retrieval failed - cannot route to LLM", {
          customerId: customer.id,
          visitorId,
          chatSessionExists: !!chatSession,
          chatSessionId: chatSession?.id,
        })
        return res.status(500).json({
          error: "CHAT_SESSION_ERROR",
          message: "Failed to establish chat session. Please refresh and try again.",
          activeChatbot: false,
          blocked: true,
        })
      }

      // VALIDATION: Ensure chat session is valid before routing to LLM
      // This prevents null conversationId which would cause silent message loss
      if (!chatSession || !chatSession.id) {
        logger.error("[WIDGET] ❌ Chat session creation/retrieval failed", {
          customerId: customer.id,
          visitorId,
          sessionExists: !!chatSession,
          hasId: !!chatSession?.id,
        })
        return res.status(500).json({
          error: "CHAT_SESSION_ERROR",
          message: "Failed to create chat session. Please refresh and try again.",
        })
      }

      // 👋 WELCOME MESSAGE: DISABLED for widget channel
      // Widget uses llmRouterService.routeMessage() which handles [LINK_REGISTRATION]
      // replacement correctly (with final catch-all link replacement pass).
      // WelcomeMessageHandler was failing to replace [LINK_REGISTRATION] for anonymous
      // visitors (no phone → raw token leaked to user).
      // All widget messages go through the full LLM pipeline instead.
      logger.info("👋 [WIDGET] Welcome message DISABLED - using LLM flow for all messages")

      // 🤖 Process message through LLM
      logger.info("🤖 Processing widget message through LLM", {
        workspaceId,
        visitorId,
        message: message.substring(0, 50) + "...",
      })

      // � REGISTRATION PROMPT: Count messages BEFORE saving (to get correct count for first message)
      // 🔧 CRITICAL FIX: Count BEFORE saving message, not after
      // This allows welcome message detection to work correctly (count=0 for first message)
      const widgetMessageCount = await prisma.conversationMessage.count({
        where: {
          customerId: customer.id,
          workspaceId,
          role: "user",
        },
      })

      // Widget channel: registrationPromptLevel is always 0.
      // Registration is optional on widget — the FunctionExecutor guard injects [LINK_REGISTRATION]
      // only when the user tries a restricted action (book, cart, orders).
      // Passing a level > 0 here would pollute every FAQ response with registration notes.
      const registrationPromptLevel = 0

      logger.info("[WIDGET] 📊 Registration prompt level", {
        customerId: customer.id,
        widgetMessageCount,
        isRegistered: customer.isActive,
        promptLevel: registrationPromptLevel, // always 0 on widget
      })

      // 🌍 LANGUAGE PRIORITY for this message:
      // 1) customer.language stored in DB (set by registration or changeLanguage chatbot function) - HIGHEST
      // 2) requestedLanguage (explicit widget dropdown/browser/phone) - fallback for new users
      // 3) workspace.defaultLanguage
      // RULE: DB-stored language wins because it represents the customer's explicit preference
      // (set via registration or chatbot changeLanguage). Widget dropdown only affects new users.
      const customerLanguage =
        customer.language ||
        requestedLanguage ||
        workspace.defaultLanguage
      logger.info("🌍 Widget calling LLM Router with language", {
        requestedLanguage,
        customerLanguage,
        customerStoredLanguage: customer.language,
        workspaceLanguage: workspace.language,
        workspaceDefaultLanguage: workspace.defaultLanguage,
        workspaceId,
        customerId: customer.id,
        explicitLanguageFromWidget: language,
        normalizedExplicitLanguage: explicitLanguage,
      })

      // 🎯 CUSTOM CLIENT: Check if this workspace uses a custom chatbot function (e.g. ecolaundry)
      // Wrapped in try-catch: any failure falls through gracefully to the normal LLM pipeline.
      try {
        const historyForCustomClient = await prisma.conversationMessage.findMany({
          where: {
            workspaceId: resolvedWorkspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: { in: ["user", "assistant"] },
          },
          select: { role: true, content: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        })

        // Extract wipMessage string (could be JSON object or plain string in DB)
        const wipMessageStr =
          typeof workspace.wipMessage === "string"
            ? workspace.wipMessage
            : typeof workspace.wipMessage === "object" && workspace.wipMessage !== null
              ? (workspace.wipMessage as Record<string, string>).en ||
                (workspace.wipMessage as Record<string, string>).it ||
                Object.values(workspace.wipMessage as Record<string, string>)[0] ||
                "Work in progress."
              : "Work in progress."

        const customClientResult = await this.customClientChatbotService.invoke({
          workspaceId: resolvedWorkspaceId,
          workspaceSlug: workspace.slug,
          customChatbotId: workspace.customChatbotId,
          userMessage: message,
          userName: customer.name,
          channel: isPlayground ? "playground" : "widget",
          welcomeMessage: typeof workspace.welcomeMessage === "string" ? workspace.welcomeMessage : "",
          wipMessage: wipMessageStr,
          channelActive: workspace.channelStatus !== false,
          debugChannel: workspace.debugMode === true,
          isPlayground: isPlayground || false,
          language: customerLanguage,
          sessionId: chatSession.id,
          customerId: customer.id,
          phoneNumber: phoneNumber || customer.phone || undefined,
          history: historyForCustomClient.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content || "",
            timestamp: m.createdAt?.toISOString(),
          })),
        })

        if (customClientResult.handled && customClientResult.output) {
          const customOutput = customClientResult.output
          await applyCustomerPatches(customOutput.patches, customer.id, resolvedWorkspaceId)

          if (customOutput.shouldEscalate && customOutput.escalationSummary) {
            void applyEscalationNotification({
              workspaceId: resolvedWorkspaceId,
              customerId: customer.id,
              escalationSummary: customOutput.escalationSummary,
              history: historyForCustomClient.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' })),
              customerName: customer.name || 'Unknown',
              customerPhone: customer.phone || undefined,
              notificationEmails: customOutput.notificationEmails,
              operatorContactMethod: customOutput.operatorContactMethod,
              operatorWhatsappNumber: customOutput.operatorWhatsappNumber,
              smtpConfig: customOutput.smtpConfig,
            })
            // Disable chatbot so subsequent messages go to operator, not LLM (mirrors WhatsApp behavior)
            await prisma.customers.update({
              where: { id: customer.id },
              data: { activeChatbot: false },
            })
            logger.info('[WIDGET-CUSTOM-CLIENT] Escalation triggered — chatbot disabled for customer', {
              customerId: customer.id,
              workspaceId: resolvedWorkspaceId,
            })
          }

          if (customOutput.error) {
            logger.warn("[WIDGET-CUSTOM-CLIENT] ⚠️ custom-ecolaundry returned error", {
              workspaceId: resolvedWorkspaceId,
              customerId: customer.id,
              error: customOutput.error,
            })
          }

          // F85 — When OpenRouter is unreachable (auth/credits/rate/timeout/network
          // exhausted), the module returns error='llm_unavailable' with reply=null.
          // Serve the workspace WIP message to the customer as a graceful fallback
          // and skip persistence + billing (no real conversation happened).
          if (customOutput.error === "llm_unavailable") {
            const wipText = customOutput.wipMessage || workspace.wipMessage || ""
            return res.status(200).json({
              success: true,
              messageId: `widget-${visitorId}-${Date.now()}`,
              sessionId: chatSession.id,
              response: wipText,
              wipMessage: wipText,
              status: "wip",
              suggestions: [],
              language: customerLanguage || "en",
              customerProfile: {
                name: customer.name,
                email: customer.email?.endsWith("@visitor.local") ? null : customer.email,
                phone: customer.phone,
                isActive: customer.isActive,
              },
            })
          }

          // Save user message to conversation history
          await prisma.conversationMessage.create({
            data: {
              workspaceId: resolvedWorkspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: "user",
              content: message,
              agentType: AgentType.ROUTER,
              tokensUsed: 0,
            },
          })

          // Save assistant message if present
          if (customOutput.reply) {
            await prisma.conversationMessage.create({
              data: {
                workspaceId: resolvedWorkspaceId,
                customerId: customer.id,
                conversationId: chatSession.id,
                role: "assistant",
                content: customOutput.reply,
                agentType: AgentType.ROUTER,
                tokensUsed: customOutput.meta?.tokensUsed || 0,
              },
            })
          }

          // Billing: deduct widget message credit — only when a reply was actually generated.
          // If reply is null (e.g. channel inactive guard), skip billing.
          if (!workspace.debugMode && !isPlayground && workspace.ownerId && customOutput.reply) {
            try {
              const billingService = new SubscriptionBillingService(prisma)
              await billingService.deductOwnerWidgetMessageCredit(
                workspace.ownerId,
                resolvedWorkspaceId,
                `widget-custom-${visitorId}-${Date.now()}`
              )
            } catch (billingError) {
              logger.error("[WIDGET-CUSTOM-CLIENT] ❌ Billing error (non-fatal):", billingError)
            }
          }

          // WebSocket notification for admin dashboard
          try {
            const { websocketService } = require("../../../services/websocket.service")
            websocketService.notifyNewMessage(resolvedWorkspaceId, {
              id: `widget-custom-${Date.now()}`,
              sessionId: chatSession.id,
              content: customOutput.reply || "",
              sender: "assistant",
              timestamp: new Date().toISOString(),
              workspaceId: resolvedWorkspaceId,
            })
          } catch (wsError) {
            logger.warn("[WIDGET-CUSTOM-CLIENT] ⚠️ WebSocket notification failed", wsError)
          }

          // AI suggestions (same as normal flow)
          const customSuggestions =
            !customOutput.shouldEscalate && workspace.widgetAutoSuggestionsEnabled === true && customOutput.reply
              ? await buildWidgetSuggestionsWithAI(
                  customOutput.reply,
                  customerLanguage || "en",
                  workspace.widgetQuickReplies as any,
                  resolvedWorkspaceId
                )
              : []

          logger.info("[WIDGET-CUSTOM-CLIENT] ✅ custom-client processed message", {
            workspaceId: resolvedWorkspaceId,
            customerId: customer.id,
            hasReply: Boolean(customOutput.reply),
            shouldEscalate: customOutput.shouldEscalate,
          })

          return res.status(200).json({
            success: true,
            messageId: `widget-${visitorId}-${Date.now()}`,
            sessionId: chatSession.id,
            response: customOutput.reply || "",
            status: "ready",
            suggestions: customSuggestions,
            language: customerLanguage || "en",
            ...(customOutput.shouldEscalate && { activeChatbot: false }),
            customerProfile: {
              name: customer.name,
              email: customer.email?.endsWith("@visitor.local") ? null : customer.email,
              phone: customer.phone,
              isActive: customer.isActive,
            },
          })
        }
      } catch (customClientError) {
        logger.error("[WIDGET-CUSTOM-CLIENT] ❌ Error in custom client path, falling through to normal LLM", {
          error: customClientError instanceof Error ? customClientError.message : String(customClientError),
          workspaceId: resolvedWorkspaceId,
        })
      }

      // 🔄 Use ChatEngine (not LLMRouterService directly) so the FAST-PATH for numeric
      // selections (e.g. APPOINTMENT_SLOTS → bookAppointment) works correctly.
      const chatEngine = getChatEngine(prisma)
      const engineResult = await chatEngine.routeMessage({
        workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        message,
        customerLanguage,
        customerName: customer.name,
        customerDiscount: customer.discount || 0,
        isPlayground: isPlayground || false,
        channel: "widget",
        registrationPromptLevel,
      })
      // Normalize to the shape the rest of this handler expects
      const llmResult = {
        response: engineResult.message || engineResult.response || "",
        agentUsed: engineResult.agentUsed || engineResult.agentType,
        tokensUsed: engineResult.tokensUsed || 0,
        isBlocked: engineResult.isBlocked || false,
      }

      logger.info("✅ LLM processing completed", {
        agentUsed: llmResult.agentUsed,
        tokensUsed: llmResult.tokensUsed,
        isBlocked: llmResult.isBlocked,
        responseLength: llmResult.response?.length,
      })

      // Check if operator handoff was triggered by this LLM call (contactOperator CF sets activeChatbot=false)
      // Also reload customer language (may have changed via changeLanguage chatbot function)
      const freshCustomer = await prisma.customers.findUnique({
        where: { id: customer.id },
        select: { activeChatbot: true, language: true },
      })
      const operatorHandoffTriggered = freshCustomer?.activeChatbot === false
      // Use fresh language for suggestions and response (changeLanguage may have updated it)
      const freshLanguage = freshCustomer?.language || customerLanguage || "en"

      // RULE: Never generate suggestions when operator handoff was just triggered
      const suggestions =
        !operatorHandoffTriggered && workspace.widgetAutoSuggestionsEnabled === true
          ? await buildWidgetSuggestionsWithAI(llmResult.response || "", freshLanguage || "en", workspace.widgetQuickReplies as any, workspaceId)
          : []

      // � CRITICAL FIX: DO NOT save assistant message here
      // ChatEngine.saveMessages() already saves BOTH user + assistant messages
      // Saving here would create duplicate assistant messages in conversation history
      
      // ✅ Messages already saved by ChatEngine (via LLMRouterService → ChatEngine.routeMessage → ChatEngine.saveMessages)
      // - User message: saved by ChatEngine.saveMessages()
      // - Assistant message: saved by ChatEngine.saveMessages()
      
      logger.debug("💾 [Widget] Messages already saved by ChatEngine - skipping duplicate save")

      // 💰 BILLING: Deduct widget message credit ($0.005) unless debug mode
      if (workspace.debugMode || isPlayground) {
        logger.info("[WIDGET-BILLING] 🧪 Debug/playground mode - skipping widget message billing")
      } else {
        try {
          if (!workspace.ownerId) {
            logger.warn(`[WIDGET-BILLING] ⚠️ No owner for workspace ${workspaceId} - skipping billing`)
          } else {
            const billingService = new SubscriptionBillingService(prisma)
            const messageId = `widget-${visitorId}-${Date.now()}`
            
            const billingResult = await billingService.deductOwnerWidgetMessageCredit(
              workspace.ownerId,
              workspaceId,
              messageId
            )

            if (billingResult.success) {
              logger.info(
                `[WIDGET-BILLING] 💰 Widget message charged: $0.05 deducted. New balance: $${billingResult.newBalance.toFixed(3)}`
              )
            } else {
              logger.error(
                `[WIDGET-BILLING] ❌ Failed to deduct widget message credit: ${billingResult.error}`,
                { workspaceId, ownerId: workspace.ownerId, messageId }
              )
              // Don't fail the response - user already got their answer
            }
          }
        } catch (billingError) {
          logger.error(
            `[WIDGET-BILLING] ❌ Widget billing exception:`,
            billingError
          )
          // Don't fail the response - billing failure shouldn't break UX
        }
      }

      // Return response directly (immediate delivery, no WhatsApp queue)
      return res.status(200).json({
        success: true,
        messageId: `widget-${visitorId}-${Date.now()}`,
        sessionId: chatSession.id,
        response: llmResult.response || "Sorry, I couldn't understand your request.",
        status: "ready",
        suggestions,
        // 🌍 Return current customer language — widget can sync its dropdown if chatbot changed it
        language: freshLanguage,
        // Tell widget immediately if operator handoff was triggered (no separate poll needed)
        ...(operatorHandoffTriggered && { activeChatbot: false }),
        // 👤 Profile data — widget keeps localStorage in sync after each message
        customerProfile: {
          name: customer.name,
          email: customer.email?.endsWith("@visitor.local") ? null : customer.email,
          phone: customer.phone,
          isActive: customer.isActive,
        },
      })
    } catch (error) {
      logger.error("❌ Error sending widget message", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        workspaceId: req.params.workspaceId,
        body: req.body,
      })
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to process message",
      })
    }
  }

  /**
   * GET /api/v1/widget/poll/:messageId
   * Poll for message response
   */
  async pollMessage(req: Request, res: Response): Promise<Response> {
    try {
      const { messageId } = req.params
      // Widget now responds immediately; polling is no longer supported
      return res.status(410).json({
        error: "POLL_NOT_SUPPORTED",
        message: "Widget responses are returned immediately; polling is no longer required.",
        messageId,
      })
    } catch (error) {
      logger.error("❌ Error polling widget message", error)
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to poll message",
      })
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  GET /api/v1/widget/operator-messages
  //  Poll for operator messages while activeChatbot=false
  //  Query params: visitorId, workspaceId, since (ISO string)
  // ─────────────────────────────────────────────────────────────
  async getOperatorMessages(req: Request, res: Response): Promise<Response> {
    try {
      const { visitorId, workspaceId, since } = req.query as {
        visitorId?: string
        workspaceId?: string
        since?: string
      }

      if (!visitorId || !workspaceId) {
        return res.status(400).json({ error: "visitorId and workspaceId required" })
      }

      // 🔐 CORS check — same as all other widget endpoints
      const workspaceForCors = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { websiteUrl: true, allowedExternalLinks: true },
      })
      if (
        workspaceForCors &&
        !isOriginAllowed(req, workspaceForCors.websiteUrl, workspaceForCors.allowedExternalLinks as string[] | null)
      ) {
        return res.status(403).json({ error: "Origin not allowed" })
      }

      // Find customer by customId (widget visitorId) — primary lookup path for widget visitors.
      // Also check id directly (backoffice/playground) and phone as last resort.
      const customer = await prisma.customers.findFirst({
        where: {
          OR: [
            { customId: visitorId },
            { id: visitorId },
            { phone: visitorId.replace(/\D/g, "") || visitorId },
          ],
          workspaceId,
        },
        select: { id: true, activeChatbot: true },
      })

      if (!customer) {
        // Anonymous visitor with no account yet — no handoff possible, chatbot is active
        return res.json({ messages: [], activeChatbot: true })
      }

      // Find active session
      const session = await prisma.chatSession.findFirst({
        where: { customerId: customer.id, status: "active" },
        orderBy: { createdAt: "desc" },
      })

      if (!session) {
        return res.json({ messages: [], activeChatbot: customer.activeChatbot })
      }

      // Return new assistant messages since `since`
      const sinceDate = since ? new Date(since) : new Date(0)
      const messages = await prisma.conversationMessage.findMany({
        where: {
          conversationId: session.id,
          role: "assistant",
          createdAt: { gt: sinceDate },
        },
        orderBy: { createdAt: "asc" },
        take: 20,
      })

      return res.json({
        messages: messages.map((m) => ({
          id: m.id,
          content: m.content,
          createdAt: m.createdAt,
        })),
        activeChatbot: customer.activeChatbot,
      })
    } catch (error) {
      logger.error("❌ Error getting operator messages", error)
      return res.status(500).json({ error: "INTERNAL_ERROR" })
    }
  }

  /**
   * GET /api/v1/widget/profile/:workspaceId
   * Get customer profile data for inline widget profile panel.
   * Auth: customerId passed as query param (validated against workspace).
   */
  async getProfile(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params
      const customerId = req.query.customerId as string

      if (!workspaceId || !customerId) {
        return res.status(400).json({ error: "MISSING_PARAMS", message: "workspaceId and customerId are required" })
      }

      const customer = await prisma.customers.findFirst({
        where: { id: customerId, workspaceId, deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          address: true,
          language: true,
          currency: true,
          invoiceAddress: true,
          push_notifications_consent: true,
          push_notifications_consent_at: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (!customer) {
        return res.status(404).json({ error: "CUSTOMER_NOT_FOUND", message: "Customer not found in this workspace" })
      }

      return res.json(customer)
    } catch (error) {
      logger.error("❌ Error getting widget profile", error)
      return res.status(500).json({ error: "INTERNAL_ERROR" })
    }
  }

  /**
   * PATCH /api/v1/widget/profile/:workspaceId
   * Update customer profile data from inline widget profile panel.
   * Auth: customerId passed in body (validated against workspace).
   */
  async updateProfile(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params
      const { customerId, ...updateData } = req.body

      if (!workspaceId || !customerId) {
        return res.status(400).json({ error: "MISSING_PARAMS", message: "workspaceId and customerId are required" })
      }

      // Verify customer belongs to workspace
      const customer = await prisma.customers.findFirst({
        where: { id: customerId, workspaceId, deletedAt: null },
      })

      if (!customer) {
        return res.status(404).json({ error: "CUSTOMER_NOT_FOUND", message: "Customer not found in this workspace" })
      }

      // Whitelist allowed fields
      const allowedFields = ["name", "email", "company", "address", "language", "currency", "invoiceAddress", "push_notifications_consent"]
      const sanitized: Record<string, unknown> = {}
      for (const key of allowedFields) {
        if (key in updateData) {
          sanitized[key] = updateData[key]
        }
      }

      // Handle push_notifications_consent timestamp
      if ("push_notifications_consent" in sanitized) {
        sanitized.push_notifications_consent_at = sanitized.push_notifications_consent ? new Date() : null
      }

      const updated = await prisma.customers.update({
        where: { id: customerId },
        data: sanitized,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          address: true,
          language: true,
          currency: true,
          invoiceAddress: true,
          push_notifications_consent: true,
          push_notifications_consent_at: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      return res.json(updated)
    } catch (error) {
      logger.error("❌ Error updating widget profile", error)
      return res.status(500).json({ error: "INTERNAL_ERROR" })
    }
  }
}
