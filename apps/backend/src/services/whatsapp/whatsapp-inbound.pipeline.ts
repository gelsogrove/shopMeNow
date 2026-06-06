/**
 * WhatsApp inbound pipeline — provider-agnostic message processing
 *
 * The SINGLE place where an inbound customer message becomes a reply, identical
 * for every provider (Meta / UltraMsg / Wasender). Each provider webhook
 * controller parses its own payload + runs its guards, then calls into this
 * pipeline so the LLM path (custom-ecolaundry vs chatEngine), typing indicator,
 * media ingest and outbound send behave the same regardless of provider.
 *
 * This is the goal: switch provider → same result.
 *
 * TRANSPORT-AGNOSTIC: methods return a `PipelineResult`; they never touch the
 * Express `res`. The controller writes the HTTP response from the result.
 *
 * Phase 1a extracts the "generate + send reply" stage (the self-contained tail
 * of the canonical Meta controller). Earlier guard stages (dedup, billing,
 * security, welcome) move here in later phases.
 */

import { prisma } from "../../lib/prisma"
import logger from "../../utils/logger"
import { getChatEngine } from "../../application/chat-engine"
import {
  CustomClientChatbotService,
  applyCustomerPatches,
  applyEscalationNotification,
} from "../../application/services/custom-client-chatbot.service"
import { splitCustomChatbotReply } from "../../utils/custom-chatbot-reply"
import { detectLanguageFromPhonePrefix } from "../../utils/language-detector"
import { ingestInboundWebhookMedia } from "../inbound-media-webhook.service"
import { WhatsAppDirectSendService } from "../whatsapp-direct-send.service"
import { ExtractedMedia } from "../webhook-media.extract"
import { PipelineResult } from "./whatsapp-inbound.types"

/**
 * Inputs the reply stage needs once the controller has resolved the customer +
 * chat session and run its guards. Mirrors exactly the locals the Meta
 * controller held at this point in the flow.
 */
export interface ProcessReplyInput {
  /** Customer row WITH `.workspace` relation loaded (slug, customChatbotId,
   *  welcomeMessage, wipMessage, channelStatus, debugMode, defaultLanguage,
   *  welcomeVideoUrl). Also uses id, workspaceId, phone, name, language, discount. */
  customer: any
  /** Active chat session ({ id }). */
  chatSession: any
  /** Inbound text already converted to Markdown. */
  messageMarkdown: string
  /** Provider message id of the inbound message (wamid / id / key.id). */
  whatsappMessageId: string
  /** Inbound media reference or null. */
  inboundMedia: ExtractedMedia | null
  /** Playground/test run — skip send + typing, ignore DB language. */
  isPlayground: boolean
  /** Count of prior real user messages (drives first-message welcome video). */
  messageCount: number
  /** Registration nudge level for unregistered customers. */
  registrationPromptLevel: number
}

/**
 * Normalize a free-form language value to a 2-letter code (es/it/en/pt/fr/de).
 * Returns "" when unknown so the caller can fall back. Identical to the Meta
 * controller's inline normalizer.
 */
function normalizeLanguage(lang: string | null): string {
  if (!lang) return ""
  const lower = lang.toLowerCase().trim()
  const map: Record<string, string> = {
    "español": "es", spanish: "es", esp: "es", es: "es",
    italiano: "it", italian: "it", ita: "it", it: "it",
    english: "en", "inglés": "en", eng: "en", en: "en",
    "português": "pt", portuguese: "pt", por: "pt", pt: "pt",
    "français": "fr", french: "fr", fra: "fr", fr: "fr",
    deutsch: "de", german: "de", deu: "de", de: "de",
  }
  return map[lower] || ""
}

export class WhatsAppInboundPipeline {
  private readonly customClientChatbotService = new CustomClientChatbotService()

  /**
   * Run the reply stage: language → typing → custom-ecolaundry (if mapped) or
   * chatEngine → media ingest → direct send. Returns the HTTP result for the
   * controller to emit. Never throws for normal control flow; unexpected errors
   * bubble to the controller's catch (same as before extraction).
   */
  async processReply(input: ProcessReplyInput): Promise<PipelineResult> {
    const {
      customer,
      chatSession,
      messageMarkdown,
      whatsappMessageId,
      inboundMedia,
      isPlayground,
      messageCount,
      registrationPromptLevel,
    } = input

    const chatEngine = getChatEngine(prisma)

    // 🌍 Language resolution. ALWAYS normalize to a 2-letter code. Playground
    // ignores DB language (may have been set wrong on first creation) and trusts
    // the phone prefix instead.
    const normalizedCustomerLang = normalizeLanguage(customer.language)
    const detectedLang = detectLanguageFromPhonePrefix(customer.phone)
    const customerLanguage = isPlayground
      ? detectedLang || normalizedCustomerLang || normalizeLanguage(customer.workspace?.defaultLanguage || "") || "en"
      : normalizedCustomerLang || detectedLang || normalizeLanguage(customer.workspace?.defaultLanguage || "") || "en"

    logger.info("🌍 [PIPELINE] Language resolution", {
      customerLanguageRaw: customer.language,
      normalizedCustomerLang,
      detectedFromPhone: detectedLang,
      finalLanguage: customerLanguage,
      phone: customer.phone,
    })

    // ⌨️ Typing indicator — show "typing…" while the LLM composes the reply.
    // Fire-and-forget: never blocks or breaks the reply. On Meta this also marks
    // the inbound message as read (blue ticks) and auto-clears on reply. Skip in
    // playground (no real WhatsApp channel).
    if (!isPlayground) {
      void new WhatsAppDirectSendService(prisma).sendTypingIndicator(
        customer.workspaceId,
        customer.phone,
        whatsappMessageId
      )
    }

    // 🎯 CUSTOM CLIENT 0: Use custom chatbot function when workspace is mapped.
    const historyMessages = await prisma.conversationMessage.findMany({
      where: {
        workspaceId: customer.workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        role: { in: ["user", "assistant"] },
      },
      select: { role: true, content: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    })

    const customClientResult = await this.customClientChatbotService.invoke({
      workspaceId: customer.workspaceId,
      workspaceSlug: customer.workspace?.slug,
      customChatbotId: customer.workspace?.customChatbotId,
      userMessage: messageMarkdown,
      userName: customer.name || "Customer",
      channel: isPlayground ? "playground" : "whatsapp",
      welcomeMessage: customer.workspace?.welcomeMessage || "",
      wipMessage: customer.workspace?.wipMessage || "Work in progress. Please contact us later.",
      channelActive: customer.workspace?.channelStatus !== false,
      debugChannel: customer.workspace?.debugMode === true,
      isPlayground,
      language: customerLanguage,
      sessionId: chatSession.id,
      customerId: customer.id,
      phoneNumber: customer.phone,
      history: historyMessages.map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content || "",
        timestamp: message.createdAt?.toISOString(),
      })),
    })

    if (customClientResult.handled && customClientResult.output) {
      const customOutput = customClientResult.output
      await applyCustomerPatches(customOutput.patches, customer.id, customer.workspaceId)

      if (customOutput.shouldEscalate && customOutput.escalationSummary) {
        void applyEscalationNotification({
          workspaceId: customer.workspaceId,
          customerId: customer.id,
          escalationSummary: customOutput.escalationSummary,
          history: historyMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content || "" })),
          customerName: customer.name || "Unknown",
          customerPhone: customer.phone || undefined,
          notificationEmails: customOutput.notificationEmails,
          operatorContactMethod: customOutput.operatorContactMethod,
          operatorWhatsappNumber: customOutput.operatorWhatsappNumber,
          smtpConfig: customOutput.smtpConfig,
        })

        // Disable chatbot so subsequent customer messages go to operator, not LLM.
        await prisma.customers.update({
          where: { id: customer.id },
          data: { activeChatbot: false },
        })
        logger.info("[PIPELINE] 👤 Escalation triggered — chatbot disabled for customer", {
          workspaceId: customer.workspaceId,
          customerId: customer.id,
        })
      }

      if (customOutput.error) {
        logger.warn("[PIPELINE] ⚠️ custom-ecolaundry returned error", {
          workspaceId: customer.workspaceId,
          customerId: customer.id,
          error: customOutput.error,
        })
      }

      const savedUserMessage = await prisma.conversationMessage.create({
        data: {
          workspaceId: customer.workspaceId,
          customerId: customer.id,
          conversationId: chatSession.id,
          role: "user",
          content: messageMarkdown,
          agentType: "CUSTOMER",
          tokensUsed: 0,
          deliveryStatus: "delivered",
          // 📲 Store inbound wamid so operator reactions on THIS customer
          // message can be forwarded back to WhatsApp (sendReaction needs it).
          whatsappMessageId,
          debugInfo: JSON.stringify({
            source: "whatsapp-webhook",
            pipeline: "custom-ecolaundry",
            timestamp: new Date().toISOString(),
          }),
        },
      })

      let savedAssistantMessageId: string | undefined
      if (customOutput.reply) {
        const savedAssistantMessage = await prisma.conversationMessage.create({
          data: {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: "assistant",
            content: customOutput.reply,
            agentType: "ROUTER",
            tokensUsed: customOutput.meta?.tokensUsed || 0,
            deliveryStatus: "pending",
            debugInfo: JSON.stringify({
              source: "whatsapp-webhook",
              pipeline: "custom-ecolaundry",
              shouldEscalate: customOutput.shouldEscalate,
              escalationSummary: customOutput.escalationSummary,
              meta: customOutput.meta,
            }),
          },
        })
        savedAssistantMessageId = savedAssistantMessage.id
      }

      if (!isPlayground && customOutput.reply) {
        try {
          const directSend = new WhatsAppDirectSendService(prisma)
          const { customerReply } = splitCustomChatbotReply(customOutput.reply)
          // 📺 First message: mirror the playground's WelcomeVideoCard logic.
          // Split at the first blank line, insert the localized intro + video URL
          // between the greeting and the rest of the reply. Pass raw Markdown —
          // WhatsAppDirectSendService.send() applies mdToWhatsApp internally so
          // there is exactly ONE conversion step.
          const welcomeVideoUrl = (customer as any).workspace?.welcomeVideoUrl as string | null | undefined
          let finalReply = customerReply
          if (messageCount === 0 && welcomeVideoUrl) {
            const INTRO: Record<string, string> = {
              es: "Antes de empezar, te dejo una breve presentación 👇",
              it: "Prima di iniziare, ecco una breve presentazione 👇",
              en: "Before we start, here's a short presentation 👇",
              ca: "Abans de començar, et deixo una breu presentació 👇",
              pt: "Antes de começar, deixo-te uma breve apresentação 👇",
              fr: "Avant de commencer, voici une brève présentation 👇",
              de: "Bevor wir beginnen, hier eine kurze Präsentation 👇",
              ar: "قبل أن نبدأ، إليك عرضًا تقديميًا موجزًا 👇",
            }
            const lang = customerLanguage ?? "en"
            const introText = INTRO[lang] ?? INTRO["en"]
            const breakIdx = customerReply.indexOf("\n\n")
            if (breakIdx !== -1) {
              const greeting = customerReply.slice(0, breakIdx)
              const rest = customerReply.slice(breakIdx + 2)
              finalReply = `${greeting}\n\n${introText}\n${welcomeVideoUrl}\n\n${rest}`
            } else {
              finalReply = `${customerReply}\n\n${introText}\n${welcomeVideoUrl}`
            }
          }
          await directSend.send({
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            phoneNumber: customer.phone,
            messageContent: finalReply,
            conversationMessageId: savedAssistantMessageId,
            skipSecurityCheck: true, // bot-generated content, not user input
          })
        } catch (sendError) {
          logger.error("[PIPELINE] ❌ Failed to send custom chatbot response", {
            error: sendError,
            workspaceId: customer.workspaceId,
            customerId: customer.id,
          })
        }
      }

      logger.info("[PIPELINE] ✅ custom-ecolaundry processed message", {
        workspaceId: customer.workspaceId,
        customerId: customer.id,
        hasReply: Boolean(customOutput.reply),
        shouldEscalate: customOutput.shouldEscalate,
        userMessageId: savedUserMessage.id,
        assistantMessageId: savedAssistantMessageId,
      })

      return {
        statusCode: 200,
        status: "processed",
        body: {
          success: true,
          status: "processed",
          data: {
            message: customOutput.reply,
            sessionId: chatSession.id,
            customerId: customer.id,
          },
          agentUsed: "custom-ecolaundry",
          tokensUsed: customOutput.meta?.tokensUsed || 0,
          response: customOutput.reply,
          debugInfo: customOutput.meta?.debug,
        },
      }
    }

    // 🤖 Standard path: main chat engine routing (saves inbound + outbound).
    const routerResult = await chatEngine.routeMessage({
      workspaceId: customer.workspaceId,
      customerId: customer.id,
      conversationId: chatSession.id,
      message: messageMarkdown,
      customerLanguage,
      customerName: customer.name,
      customerDiscount: customer.discount || 0,
      isPlayground,
      channel: "whatsapp",
      registrationPromptLevel,
    })

    logger.info("[PIPELINE] ✅ ChatEngineService completed", {
      agentUsed: routerResult.agentUsed,
      tokensUsed: routerResult.tokensUsed,
      executionTimeMs: routerResult.executionTimeMs,
      wasFAQ: routerResult.wasFAQ,
      responseLength: routerResult.response?.length ?? 0,
      isBlocked: routerResult.isBlocked,
    })

    // 📎 Inbound media: download from provider + persist linked to the inbound
    // message. Fail-safe: never blocks or breaks the text reply.
    if (inboundMedia) {
      await ingestInboundWebhookMedia({
        workspaceId: customer.workspaceId,
        conversationId: chatSession.id,
        media: inboundMedia,
      })
    }

    // 🚫 P1: blocked customer → 410 WITHOUT sending a message.
    if (routerResult.isBlocked) {
      logger.warn("[PIPELINE] 🚫 P1: Customer blocked - returning 410 Gone", {
        customerId: customer.id,
      })
      return {
        statusCode: 410,
        status: "blocked",
        body: { status: "blocked", message: "Customer is blocked" },
      }
    }

    // ✅ Messages already saved by ChatEngine. 📤 Direct send the reply.
    logger.info("[PIPELINE] 📤 Sending response directly via WhatsApp provider", {
      customerId: customer.id,
      workspaceId: customer.workspaceId,
      responseLength: routerResult.response.length,
    })

    try {
      // Find the assistant message saved by ChatEngine, to link the delivery.
      const assistantMessage = await prisma.conversationMessage.findFirst({
        where: {
          conversationId: chatSession.id,
          role: "assistant",
          content: routerResult.response,
        },
        orderBy: { createdAt: "desc" },
      })

      const directSend = new WhatsAppDirectSendService(prisma)
      await directSend.send({
        workspaceId: customer.workspaceId,
        customerId: customer.id,
        phoneNumber: customer.phone,
        messageContent: routerResult.response,
        conversationMessageId: assistantMessage?.id,
        isPlayground,
      })

      logger.info("[PIPELINE] ✅ Response sent directly to WhatsApp", { customerId: customer.id })
    } catch (sendError) {
      logger.error("[PIPELINE] ❌ Failed to send WhatsApp response", {
        error: sendError,
        workspaceId: customer.workspaceId,
        customerId: customer.id,
      })
    }

    return {
      statusCode: 200,
      status: "processed",
      body: {
        success: true,
        status: "processed",
        data: {
          message: routerResult.response,
          sessionId: chatSession.id,
          customerId: customer.id,
        },
        agentUsed: routerResult.agentUsed,
        tokensUsed: routerResult.tokensUsed,
        response: routerResult.response, // ✅ Backwards-compatible field
        debugInfo: routerResult.debugInfo,
      },
    }
  }
}

/** Shared singleton — stateless, safe to reuse across controllers. */
export const whatsAppInboundPipeline = new WhatsAppInboundPipeline()
