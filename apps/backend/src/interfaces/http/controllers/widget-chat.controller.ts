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
import { VisitorIdService } from "../../../application/services/visitor-id.service"
import { SecurityCheckService } from "../../../application/services/security-check.service"
import { LLMRouterService } from "../../../services/llm-router.service"
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
              `Language for output: ${langName[lang] || "same as the chatbot reply"}.\n` +
              `\n` +
              `STRICT RULES:\n` +
              `- You MUST only pick questions from the FAQ LIST below — NEVER invent new ones\n` +
              `- Pick EXACTLY 3 FAQ questions that are NATURALLY relevant as follow-ups to the chatbot reply\n` +
              `- Write each suggestion in FIRST PERSON (e.g. "Voglio sapere i prezzi" not "Prezzi")\n` +
              `- Max 40 characters per suggestion — shorten if the FAQ question is longer\n` +
              `- No links, no emoji, no punctuation at the end\n` +
              `- Return ONLY a raw JSON array of EXACTLY 3 strings. Example: ["Come posso pagare?","Dove è il mio ordine?","Posso modificare?"]`,
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
  if (!raw) return "it"
  const l = raw.toLowerCase().slice(0, 3)
  const map: Record<string, string> = { eng: "en", ita: "it", esp: "es", por: "pt", por2: "pt", en: "en", it: "it", es: "es", pt: "pt" }
  return map[l] || map[l.slice(0, 2)] || "it"
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

export class WidgetChatController {
  private normalizeLanguage(raw?: string | null): string | null {
    if (!raw) return null
    const code = raw.toLowerCase().split("-")[0]
    const map: Record<string, string> = {
      it: "ITA",
      en: "ENG",
      es: "ESP",
      pt: "POR",
      fr: "FRA",
      de: "DEU",
    }
    return map[code] || raw
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
        targetLanguage: targetLanguage || "ENG",
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
      if (workspace.enableWidget !== true) {
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
      if (workspace.channelStatus === false) {
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

      if (workspace.debugMode === true) {
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
          deletedAt: true,
          channelStatus: true,
          ownerId: true,
          enableWidget: true,
          defaultLanguage: true,
          debugMode: true,
          wipMessage: true,
          widgetAutoSuggestionsEnabled: true,
          widgetQuickReplies: true,
          websiteUrl: true,
          allowedExternalLinks: true,
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

      if (workspace.enableWidget !== true) {
        return res.status(403).json({
          error: "WIDGET_DISABLED",
          message: "Widget chat is disabled for this workspace",
        })
      }

      if (workspace.channelStatus === false) {
        return res.status(403).json({
          error: "CHANNEL_DISABLED",
          message: "Channel is disabled",
        })
      }

      // 🔒 Origin allow-list: only allow requests coming from configured domains
      if (!isOriginAllowed(req, workspace.websiteUrl, workspace.allowedExternalLinks as string[] | null)) {
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

      // 5. Billing access check
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

      // 6. Normalize language
      const normalizedLanguage =
        this.normalizeLanguage(language) || workspace.defaultLanguage || "ENG"

      // 7. Deduplication: find or create customer by phone within workspace
      let isNewCustomer = false
      let customer = await prisma.customers.findFirst({
        where: { workspaceId: resolvedWorkspaceId, phone: normalizedPhone },
      })

      // Fallback: look up by customId (visitorId) across ALL workspaces
      // Handles case where customer was created with old slug-based workspaceId
      if (!customer) {
        customer = await prisma.customers.findFirst({
          where: { customId: visitorId },
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
      logger.info("[WIDGET-REGISTER] 🤖 Processing first message through LLM", {
        customerId: customer.id,
        language: normalizedLanguage,
        workspaceId: resolvedWorkspaceId,
      })

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

      // RULE: First message (welcome) has NO suggestions
      const suggestions: string[] = []

      // 11. Save LLM response to conversation history
      await prisma.conversationMessage.create({
        data: {
          workspaceId: resolvedWorkspaceId,
          customerId: customer.id,
          conversationId: chatSession.id,
          role: "assistant",
          content: llmResult.response || "Response unavailable",
          agentType: llmResult.agentUsed || AgentType.ROUTER,
          tokensUsed: llmResult.tokensUsed || 0,
        },
      })

      // 12. Billing: deduct widget message credit
      if (workspace.ownerId) {
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
        response: llmResult.response || "Welcome! How can I help you?",
        isNewCustomer,
        suggestions,
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

      const { visitorId, message, sessionId, language, phoneNumber, isPlayground, customerId } = validation.data
      
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
        isPlayground: isPlayground === true
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
      // Only explicitly TRUE enables the widget (false/null/undefined = disabled)
      if (workspace.enableWidget !== true) {
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
      if (workspace.channelStatus === false) {
        logger.warn("❌ Widget message blocked: Channel disabled", {
          workspaceId,
          visitorId,
        })
        return res.status(403).json({
          error: "CHANNEL_DISABLED",
          message: "Channel is disabled",
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
      if (!isOriginAllowed(req, workspace.websiteUrl, workspace.allowedExternalLinks as string[] | null)) {
        return res.status(403).json({
          error: "FORBIDDEN_ORIGIN",
          message: "Origin not allowed for this widget",
        })
      }

      // Execute 5-step security validation
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
      const failedStep = securityResults.find((result) => !result.passed)
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

      logger.info("✅ Workspace validation passed")

      // 💰 SUBSCRIPTION + CREDIT CHECK (skip for playground OR debugMode)
      // RULE: Billing ONLY for widget/WhatsApp when debugMode=false AND NOT playground
      if (isPlayground !== true && workspace.debugMode !== true) {
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
        const skipReason = isPlayground === true ? "Playground mode" : "Debug mode"
        logger.info(`[WIDGET-BILLING] 🧪 ${skipReason} - skipping billing/access checks`, {
          isPlayground,
          debugMode: workspace.debugMode,
        })
      }

      // 🛠️ DEBUG MODE (WIP) - after security checks, return WIP message
      if (workspace.debugMode === true) {
        logger.info("🛠️ Widget WIP - debug mode", {
          workspaceId,
          visitorId,
          debugMode: workspace.debugMode,
          channelStatus: workspace.channelStatus,
        })

        const rawLanguage = requestedLanguage || workspace.defaultLanguage || "ENG"
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
        // 🌍 Update customer language if widget explicitly requests different language
        const updateData: any = {}
        
        if (phoneNumber && !customer.phone) {
          updateData.phone = phoneNumber
        }
        
        if (requestedLanguage && requestedLanguage !== customer.language) {
          updateData.language = requestedLanguage
          logger.info("🌍 Widget language changed - updating customer", {
            customerId: customer.id,
            oldLanguage: customer.language,
            newLanguage: requestedLanguage,
          })
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
            language: updateData.language || customer.language,
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

      // 📝 Save user message to conversation history
      await prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId: customer.id,
          conversationId: chatSession.id,
          role: "user",
          content: message,
          agentType: AgentType.ROUTER,
          tokensUsed: 0,
        },
      })

      // 📊 REGISTRATION PROMPT: Count messages and calculate prompt level
      const widgetMessageCount = await prisma.conversationMessage.count({
        where: {
          customerId: customer.id,
          workspaceId,
          role: "user",
        },
      })

      const registrationPromptLevel = registrationPromptService.getPromptLevel(
        widgetMessageCount,
        customer.isActive // isActive = registered in DB schema
      )

      logger.info("[WIDGET] 📊 Registration prompt level", {
        customerId: customer.id,
        widgetMessageCount,
        isRegistered: customer.isActive,
        promptLevel: registrationPromptLevel,
      })

      // ⛔ BLOCK: If user sent 15+ messages without registering
      if (registrationPromptService.shouldBlockUser(widgetMessageCount, customer.isActive)) {
        logger.warn("[WIDGET] ⛔ Blocking unregistered user (15+ messages)", {
          customerId: customer.id,
          widgetMessageCount,
        })

        await prisma.customers.update({
          where: { id: customer.id },
          data: {
            isBlacklisted: true,
          },
        })

        return res.status(403).json({
          error: "MAX_MESSAGES_UNREGISTERED",
          message: "Account blocked. Please register to continue chatting.",
        })
      }

      // 🌍 LANGUAGE PRIORITY for this message:
      // 1) requestedLanguage (explicit/browser/phone) if present
      // 2) customer.language stored in DB
      // 3) workspace.defaultLanguage
      const customerLanguage =
        requestedLanguage ||
        customer.language ||
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

      const llmResult = await llmRouterService.routeMessage({
        workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        messageId: `widget-${visitorId}-${Date.now()}`,
        message,
        customerLanguage,
        customerName: customer.name,
        isSystemMessage: false,
        channel: "widget", // 🚫 WIDGET CHANNEL - disables personalized greetings
        registrationPromptLevel, // 🆕 Progressive registration invitation
      })

      logger.info("✅ LLM processing completed", {
        agentUsed: llmResult.agentUsed,
        tokensUsed: llmResult.tokensUsed,
        isBlocked: llmResult.isBlocked,
        responseLength: llmResult.response?.length,
      })

      // Check if operator handoff was triggered by this LLM call (contactOperator CF sets activeChatbot=false)
      const freshCustomer = await prisma.customers.findUnique({
        where: { id: customer.id },
        select: { activeChatbot: true },
      })
      const operatorHandoffTriggered = freshCustomer?.activeChatbot === false

      // RULE: Never generate suggestions when operator handoff was just triggered
      const suggestions =
        !operatorHandoffTriggered && workspace.widgetAutoSuggestionsEnabled === true
          ? await buildWidgetSuggestionsWithAI(llmResult.response || "", customerLanguage || "it", workspace.widgetQuickReplies as any, workspaceId)
          : []

      // 📝 Save assistant message to conversation history
      await prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId: customer.id,
          conversationId: chatSession.id,
          role: "assistant",
          content: llmResult.response || "Response unavailable",
          agentType: llmResult.agentUsed || AgentType.ROUTER,
          tokensUsed: llmResult.tokensUsed || 0,
        },
      })

      // 💰 BILLING: Deduct widget message credit ($0.005) unless playground
      if (isPlayground === true) {
        logger.info("[WIDGET-BILLING] 🧪 Playground mode - skipping billing")
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
        // Tell widget immediately if operator handoff was triggered (no separate poll needed)
        ...(operatorHandoffTriggered && { activeChatbot: false }),
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
}
