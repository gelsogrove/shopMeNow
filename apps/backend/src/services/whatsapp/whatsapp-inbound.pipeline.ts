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
import { SecurityCheckService } from "../../application/services/security-check.service"
import { WorkspaceAccessService } from "../../application/services/workspace-access.service"
import { SubscriptionBillingService } from "../../application/services/subscription-billing.service"
import { websocketService } from "../websocket.service"
import { splitCustomChatbotReply } from "../../utils/custom-chatbot-reply"
import { buildWelcomeVideoSplit, WELCOME_VIDEO_INTRO } from "../../utils/welcome-video"
import { detectLanguageFromPhonePrefix } from "../../utils/language-detector"
import { ingestInboundWebhookMedia } from "../inbound-media-webhook.service"
import { WhatsAppDirectSendService } from "../whatsapp-direct-send.service"
import { ExtractedMedia } from "../webhook-media.extract"
import { PipelineResult } from "./whatsapp-inbound.types"

/**
 * 🎤 Spoken-format instruction appended to the LLM input when the customer sent
 * a voice message. Forces a conversational, TTS-friendly reply: no markdown,
 * no lists, no parentheses, and a complete (not terse) spoken answer. Applied
 * identically on both the custom-ecolaundry and the standard chatEngine path so
 * "voice in → voice out" sounds natural on every workspace.
 */
const AUDIO_SPOKEN_INSTRUCTION =
  `[SYSTEM: The customer sent a voice message. Reply as if you are speaking out loud — use natural spoken sentences. Never use emoji, bullet points, dashes, parentheses, or markdown. Never read out URLs. If something is in parentheses, integrate it naturally into the sentence instead. For example, do not say "Samsung (7kg, A+++)" — say "a Samsung washing machine, seven kilos, energy class triple A". Give a complete, helpful answer of a few flowing sentences — do not be terse or clipped. Keep a warm, polite, conversational tone.]`

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
  /** True when the inbound message was an audio/voice message (triggers TTS reply). */
  inboundWasAudio?: boolean
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
   * 🔒 Shared security guard. Run BEFORE generating a reply, identical for every
   * provider. Returns null when the message is safe (caller continues); returns a
   * PipelineResult (429 blocked / 500 check-error) when the caller must stop and
   * emit that response. Skipped in playground. On block, persists the rejected
   * message for admin review — same behaviour as the canonical Meta controller.
   */
  async checkSecurity(input: {
    workspaceId: string
    customerId: string
    customerPhone: string
    conversationId: string
    messageMarkdown: string
    isPlayground: boolean
  }): Promise<PipelineResult | null> {
    const { workspaceId, customerId, customerPhone, conversationId, messageMarkdown, isPlayground } = input

    if (isPlayground) {
      logger.info("[PIPELINE] 🧪 Playground mode - skipping security validation", { customerId })
      return null
    }

    let securityResults: any[] = []
    try {
      securityResults = await SecurityCheckService.validateMessage({
        workspaceId,
        visitorId: customerPhone, // phone is the visitorId for WhatsApp
        message: messageMarkdown,
        channel: "whatsapp",
      })
    } catch (securityError) {
      logger.error("[PIPELINE] ❌ Security validation error", {
        error: securityError instanceof Error ? securityError.message : String(securityError),
        customerId,
        workspaceId,
      })
      return {
        statusCode: 500,
        status: "security_check_error",
        code: "SECURITY_CHECK_ERROR",
        body: {
          status: "security_check_error",
          code: "SECURITY_CHECK_ERROR",
          message: "Failed to validate message security",
        },
      }
    }

    const failedStep = securityResults.find((result) => !result.passed)
    if (failedStep) {
      logger.warn("[PIPELINE] 🚨 Security check failed - message blocked", {
        customerId,
        workspaceId,
        step: failedStep.step,
        reason: failedStep.reason,
      })

      // Save blocked message to history for admin review.
      await prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId,
          conversationId,
          role: "user",
          content: messageMarkdown,
          agentType: "NONE",
          tokensUsed: 0,
          debugInfo: JSON.stringify({
            securityBlocked: true,
            failedStep: failedStep.step,
            reason: failedStep.reason,
            timestamp: new Date().toISOString(),
            source: "whatsapp-webhook",
          }),
        },
      })

      return {
        statusCode: 429,
        status: "security_blocked",
        code: failedStep.step,
        body: {
          status: "security_blocked",
          code: failedStep.step,
          message: failedStep.reason || "Security check failed",
          retryAfter: failedStep.retryAfter,
        },
      }
    }

    logger.info("[PIPELINE] ✅ Security validation passed", { customerId })
    return null
  }

  /**
   * 💰 Shared billing/access guard. Run BEFORE generating a reply, identical for
   * every provider. Returns null when the workspace may process the message;
   * returns a PipelineResult when the caller must stop:
   *   - CHANNEL_DISABLED → 200, message saved silently, no reply
   *   - DEBUG_MODE       → 200, translated WIP message saved + sent
   *   - PAUSED/PAYMENT_FAILED/CREDIT_EXHAUSTED → 402 silent block (no save)
   *   - trial expired    → 402 TRIAL_EXPIRED (silent)
   *   - insufficient credit → 402 INSUFFICIENT_CREDIT (silent)
   * Playground skips access/trial/credit. Mirrors the canonical Meta controller.
   */
  async checkBillingAccess(input: {
    customer: any
    chatSession: any
    messageMarkdown: string
    whatsappMessageId: string
    isPlayground: boolean
  }): Promise<PipelineResult | null> {
    const { customer, chatSession, messageMarkdown, whatsappMessageId, isPlayground } = input
    const workspaceId = customer.workspaceId

    const workspaceAccessService = new WorkspaceAccessService(prisma)

    // RULE: debugMode=true → WIP message — but NOT for playground.
    const accessResult: any = isPlayground
      ? { canProcess: true, blockReason: null, message: null }
      : await workspaceAccessService.canProcessMessages(workspaceId, false)

    // 🛠️ DebugFlow: FLOW workspaces process normally in debugMode (strategy
    // appends a debug trace to the response instead of blocking with WIP).
    if (!accessResult.canProcess && accessResult.blockReason === "DEBUG_MODE") {
      const wsMode = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { channelMode: true },
      })
      if (wsMode?.channelMode === "FLOW") {
        logger.info("[PIPELINE] 🛠️ DebugFlow - FLOW workspace bypasses WIP, processing normally", {
          workspaceId,
          customerId: customer.id,
        })
        accessResult.canProcess = true
        accessResult.blockReason = null
      }
    }

    if (!accessResult.canProcess) {
      // 🚫 CHANNEL_DISABLED → silent block (save message, no reply).
      if (accessResult.blockReason === "CHANNEL_DISABLED") {
        logger.info("[PIPELINE] 🚫 Channel disabled - saving message without response", {
          workspaceId,
          customerId: customer.id,
        })

        const savedMessage = await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: "user",
            content: messageMarkdown,
            agentType: "NONE",
            tokensUsed: 0,
            whatsappMessageId, // 📲 inbound wamid → operator reaction forwarding
            debugInfo: JSON.stringify({
              channelDisabled: true,
              reason: "workspace.channelStatus = false",
              timestamp: new Date().toISOString(),
              source: "whatsapp-webhook",
            }),
          },
        })

        try {
          websocketService.notifyNewMessage(workspaceId, {
            id: savedMessage.id,
            sessionId: chatSession.id,
            content: messageMarkdown,
            sender: "customer",
            timestamp: savedMessage.createdAt.toISOString(),
            workspaceId,
            metadata: { channelDisabled: true, source: "whatsapp-webhook" },
          })
          websocketService.notifyChatUpdated(workspaceId, {
            sessionId: chatSession.id,
            lastMessage: messageMarkdown.substring(0, 100),
            lastMessageAt: savedMessage.createdAt.toISOString(),
            customerId: customer.id,
          })
        } catch (wsError) {
          logger.warn("[PIPELINE] ⚠️ Failed to notify WebSocket for channel-disabled message", {
            error: wsError,
            workspaceId,
            customerId: customer.id,
          })
        }

        return {
          statusCode: 200,
          status: "channel_disabled",
          code: "CHANNEL_DISABLED",
          body: { status: "channel_disabled", code: "CHANNEL_DISABLED", message: "Channel is disabled." },
        }
      }

      // 🚧 DEBUG_MODE → send a translated WIP "work in progress" message.
      if (accessResult.blockReason === "DEBUG_MODE") {
        logger.info("[PIPELINE] 🚧 Debug mode (WIP) - sending maintenance message", {
          workspaceId,
          customerId: customer.id,
        })

        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            wipMessage: true,
            defaultLanguage: true,
            ownerId: true,
            owner: { select: { status: true } },
          },
        })

        // 🚫 OWNER STATUS CHECK: block if owner is INACTIVE.
        if (workspace?.owner?.status === "INACTIVE") {
          logger.warn("[PIPELINE] ❌ WIP message blocked: Owner inactive", {
            workspaceId,
            ownerId: workspace.ownerId,
          })
          return {
            statusCode: 200,
            status: "ok",
            body: { success: true, message: "Message received" },
          }
        }

        const rawWipMessage = workspace?.wipMessage || "Work in progress. Please contact us later."
        const customerLang =
          customer.language ||
          detectLanguageFromPhonePrefix(customer.phone) ||
          workspace!.defaultLanguage

        let finalWipMessage = rawWipMessage
        let translationTokensUsed = 0
        try {
          const { TranslationAgent } = require("../../application/agents/TranslationAgent")
          const translationAgent = new TranslationAgent(prisma)
          const translationResult = await translationAgent.process({
            workspaceId,
            message: rawWipMessage,
            targetLanguage: customerLang,
            customerName: customer.name || "Customer",
            customerId: customer.id,
            channel: "whatsapp",
          })
          finalWipMessage = translationResult.message || rawWipMessage
          translationTokensUsed = translationResult.tokensUsed || 0
        } catch (translationError) {
          logger.warn("[PIPELINE] ⚠️ WIP translation failed, using raw message", {
            error: translationError,
          })
        }

        // Save WIP exchange to history so the operator sees the contact attempt.
        const userMessage = await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: "user",
            content: messageMarkdown,
            agentType: "NONE",
            tokensUsed: 0,
            whatsappMessageId,
            debugInfo: JSON.stringify({
              channelDisabled: true,
              reason: "workspace.channelStatus = false (WIP mode)",
              timestamp: new Date().toISOString(),
              source: "whatsapp-webhook",
            }),
          },
        })

        const assistantMessage = await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: "assistant",
            content: finalWipMessage,
            agentType: "ROUTER",
            tokensUsed: translationTokensUsed,
            deliveryStatus: "pending",
            debugInfo: JSON.stringify({
              channelDisabled: true,
              reason: "workspace.channelStatus = false (WIP mode)",
              timestamp: new Date().toISOString(),
              source: "whatsapp-webhook",
            }),
          },
        })

        try {
          websocketService.notifyNewMessage(workspaceId, {
            id: userMessage.id,
            sessionId: chatSession.id,
            content: messageMarkdown,
            sender: "customer",
            timestamp: userMessage.createdAt.toISOString(),
            workspaceId,
            metadata: { debugMode: true, source: "whatsapp-webhook" },
          })
          websocketService.notifyNewMessage(workspaceId, {
            id: assistantMessage.id,
            sessionId: chatSession.id,
            content: finalWipMessage,
            sender: "agent",
            timestamp: assistantMessage.createdAt.toISOString(),
            workspaceId,
            metadata: { debugMode: true, source: "whatsapp-webhook" },
          })
          websocketService.notifyChatUpdated(workspaceId, {
            sessionId: chatSession.id,
            lastMessage: finalWipMessage.substring(0, 100),
            lastMessageAt: assistantMessage.createdAt.toISOString(),
            customerId: customer.id,
          })
        } catch (wsError) {
          logger.warn("[PIPELINE] ⚠️ Failed to notify WebSocket for debug WIP message", {
            error: wsError,
            workspaceId,
            customerId: customer.id,
          })
        }

        try {
          const directSend = new WhatsAppDirectSendService(prisma)
          await directSend.send({
            workspaceId,
            customerId: customer.id,
            phoneNumber: customer.phone,
            messageContent: finalWipMessage,
            conversationMessageId: assistantMessage.id,
            skipSecurityCheck: true,
          })
        } catch (error) {
          logger.error("[PIPELINE] ❌ Failed to send WIP message", {
            error,
            workspaceId,
            customerId: customer.id,
          })
        }

        return {
          statusCode: 200,
          status: "debug_wip",
          code: "DEBUG_MODE",
          body: {
            status: "debug_wip",
            code: "DEBUG_MODE",
            message: "Channel is in maintenance mode. Your message has been saved.",
            wipMessage: finalWipMessage,
          },
        }
      }

      // 🚫 Silent block for billing issues (PAUSED, PAYMENT_FAILED,
      // CREDIT_EXHAUSTED, OWNER_DELETED) — DO NOT save, DO NOT respond.
      logger.warn("[PIPELINE] 🚫 Workspace blocked - SILENT BLOCK", {
        workspaceId,
        customerId: customer.id,
        blockReason: accessResult.blockReason,
        message: accessResult.message,
      })
      return {
        statusCode: 402,
        status: "workspace_blocked",
        code: accessResult.blockReason,
        body: { status: "workspace_blocked", code: accessResult.blockReason, message: accessResult.message },
      }
    }

    // 💰 BILLING: trial + credit (skip playground). Silent 402 blocks.
    if (!isPlayground) {
      const billingService = new SubscriptionBillingService(prisma)

      const trialStatus = await billingService.isTrialValid(workspaceId)
      if (trialStatus.isTrialPlan && !trialStatus.isValid) {
        logger.warn("[PIPELINE] 💰 Trial expired - SILENT BLOCK (no save, no response)", {
          workspaceId,
          customerId: customer.id,
        })
        return {
          statusCode: 402,
          status: "billing_error",
          code: "TRIAL_EXPIRED",
          body: {
            status: "billing_error",
            code: "TRIAL_EXPIRED",
            message: "Trial period has expired. Please upgrade your plan.",
          },
        }
      }

      const messageCost = await billingService.getOperationCost(workspaceId, "message")
      const creditCheck = await billingService.checkCredit(workspaceId, messageCost)
      if (!creditCheck.hasSufficientCredit) {
        logger.warn("[PIPELINE] 💰 Insufficient credit - SILENT BLOCK (no save, no response)", {
          workspaceId,
          customerId: customer.id,
          currentBalance: creditCheck.currentBalance,
          requiredAmount: messageCost,
        })
        return {
          statusCode: 402,
          status: "billing_error",
          code: "INSUFFICIENT_CREDIT",
          body: {
            status: "billing_error",
            code: "INSUFFICIENT_CREDIT",
            message: "Insufficient credit. Please recharge your account.",
            details: {
              currentBalance: creditCheck.currentBalance,
              requiredAmount: messageCost,
            },
          },
        }
      }
    } else {
      logger.info("[PIPELINE] 🧪 Playground mode - skipping trial/credit checks")
    }

    return null
  }

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
      inboundWasAudio = false,
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
      userMessage: inboundWasAudio
        ? `${messageMarkdown}\n\n${AUDIO_SPOKEN_INSTRUCTION}`
        : messageMarkdown,
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
          const welcomeVideoUrl = (customer as any).workspace?.welcomeVideoUrl as string | null | undefined

          // 📺 First message with a presentation video → mirror the playground's
          // WelcomeVideoCard ORDER (greeting → intro → video → rest). Works the
          // same on every provider (Meta/UltraMsg/Wasender) because it uses the
          // provider-agnostic send()/sendMedia() of WhatsAppDirectSendService.
          const videoSplit =
            messageCount === 0 && welcomeVideoUrl && !inboundWasAudio
              ? buildWelcomeVideoSplit(customerReply, welcomeVideoUrl, customerLanguage)
              : null

          if (videoSplit) {
            // YouTube video → two messages: (1) greeting + intro text, then
            // (2) the YouTube thumbnail as a real image with the rest of the
            // reply + clickable link as caption. Pass raw Markdown — send()/
            // sendMedia() apply mdToWhatsApp internally (one conversion step).
            await directSend.send({
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              phoneNumber: customer.phone,
              messageContent: videoSplit.textMessage,
              skipSecurityCheck: true, // bot-generated content, not user input
            })
            await directSend.sendMedia({
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              phoneNumber: customer.phone,
              mediaUrl: videoSplit.imageUrl,
              caption: videoSplit.caption,
              conversationMessageId: savedAssistantMessageId,
              skipSecurityCheck: true,
            })
          } else {
            // No video, or non-YouTube video (no resolvable thumbnail) → single
            // message. For a non-YouTube first-contact video, fall back to the
            // legacy inline intro + URL so the link still goes out.
            let finalReply = customerReply
            if (messageCount === 0 && welcomeVideoUrl && !inboundWasAudio) {
              const introText =
                WELCOME_VIDEO_INTRO[customerLanguage ?? "en"] ?? WELCOME_VIDEO_INTRO.en
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
              replyAsAudio: inboundWasAudio,
              customerLanguage,
            })
          }
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

    // 🎤 Audio mode: append spoken-format instruction so LLM skips emoji/lists/links.
    const messageForEngine = inboundWasAudio
      ? `${messageMarkdown}\n\n${AUDIO_SPOKEN_INSTRUCTION}`
      : messageMarkdown

    // 🤖 Standard path: main chat engine routing (saves inbound + outbound).
    const routerResult = await chatEngine.routeMessage({
      workspaceId: customer.workspaceId,
      customerId: customer.id,
      conversationId: chatSession.id,
      message: messageForEngine,
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
        replyAsAudio: inboundWasAudio,
        customerLanguage,
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
