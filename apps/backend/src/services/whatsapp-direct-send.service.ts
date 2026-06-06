import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"
import { mdToWhatsApp } from "../utils/markdown-to-whatsapp"
import { WhatsAppProviderFactory } from "./whatsapp/whatsapp-provider.factory"
import { SecurityAgent } from "../application/agents/SecurityAgent"
import { SubscriptionBillingService } from "../application/services/subscription-billing.service"
import { generateSpeech } from "./tts-elevenlabs.service"

export interface DirectSendParams {
  workspaceId: string
  customerId: string
  phoneNumber: string
  messageContent: string
  conversationMessageId?: string
  skipSecurityCheck?: boolean
  isPlayground?: boolean
  /** When true: attempt TTS reply; fall back to text if TTS fails. */
  replyAsAudio?: boolean
  /** Customer language code (e.g. "it", "es") — selects TTS voice. */
  customerLanguage?: string
}

export interface DirectSendResult {
  success: boolean
  blocked?: boolean
  error?: string
  messageId?: string
}

/**
 * WhatsAppDirectSendService
 *
 * Sends WhatsApp messages directly without going through the queue.
 * Handles: security check → provider send → billing deduction → timeline update.
 *
 * Used by all webhook controllers (Meta, UltraMsg, Wasender) and system services.
 * NOT used for push campaigns (those still use WhatsAppQueue).
 * NOT used for widget (widget is synchronous, handled by widget controller).
 */
export class WhatsAppDirectSendService {
  private securityAgent: SecurityAgent
  private billingService: SubscriptionBillingService

  constructor(private prisma: PrismaClient) {
    this.securityAgent = new SecurityAgent(prisma)
    this.billingService = new SubscriptionBillingService(prisma)
  }

  async send(params: DirectSendParams): Promise<DirectSendResult> {
    const {
      workspaceId,
      customerId,
      phoneNumber,
      messageContent,
      conversationMessageId,
      skipSecurityCheck = false,
      isPlayground = false,
      replyAsAudio = false,
      customerLanguage,
    } = params

    if (isPlayground) {
      logger.info("[DirectSend] 🧪 Playground mode - skipping actual send", { workspaceId, customerId })
      return { success: true }
    }

    if (!phoneNumber) {
      logger.error("[DirectSend] ❌ Missing phone number", { workspaceId, customerId })
      return { success: false, error: "Missing destination phone number" }
    }

    // 🔒 SECURITY CHECK (skip for system notifications like operator alerts)
    if (!skipSecurityCheck) {
      try {
        const securityResult = await this.securityAgent.process({
          workspaceId,
          message: messageContent,
          customerId,
          customerName: undefined,
        })

        await this.appendTimelineStep(conversationMessageId, {
          type: "sub_agent",
          agent: "Security Check",
          timestamp: new Date().toISOString(),
          model: "security-patterns/v1",
          systemPrompt: "Pattern-based + LLM security validation",
          input: { messageContent: messageContent.substring(0, 500) },
          output: {
            textResponse: securityResult.safe
              ? "✅ Message passed security validation"
              : `🚫 Blocked: ${securityResult.blockedReason}`,
          },
        })

        if (!securityResult.safe) {
          logger.warn("[DirectSend] 🚫 Message blocked by security check", {
            workspaceId,
            customerId,
            reason: securityResult.blockedReason,
          })
          return { success: false, blocked: true, error: securityResult.blockedReason }
        }
      } catch (error) {
        // Security check failure: log and allow (fail-open to avoid blocking legitimate messages)
        logger.error("[DirectSend] ⚠️ Security check failed - allowing message", {
          workspaceId,
          customerId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // 📤 SEND VIA PROVIDER
    const workspace = await this.prisma.workspace.findUnique({ where: { id: workspaceId } }) as any

    if (!workspace) {
      return { success: false, error: "Workspace not found" }
    }

    if (!WhatsAppProviderFactory.isConfigured(workspace)) {
      const providerName = WhatsAppProviderFactory.getProviderDisplayName(workspace)
      return { success: false, error: `WhatsApp not configured (${providerName})` }
    }

    const provider = WhatsAppProviderFactory.create(workspace)
    const formattedMessage = mdToWhatsApp(messageContent)

    let sendResult: { success: boolean; messageId?: string; error?: string }
    try {
      if (replyAsAudio && provider.sendAudioMessage) {
        // 🎤 TTS path: generate MP3 → upload → send as audio message
        const tts = await generateSpeech(messageContent, workspaceId, customerLanguage)
        if (tts?.audioUrl) {
          logger.info("[DirectSend] 🎤 Sending audio reply via TTS", { workspaceId, customerId })
          sendResult = await provider.sendAudioMessage(phoneNumber, tts.audioUrl)
        } else {
          // TTS failed — fall back to text
          logger.warn("[DirectSend] ⚠️ TTS failed — falling back to text reply", { workspaceId, customerId })
          sendResult = await provider.sendTextMessage(phoneNumber, formattedMessage)
        }
      } else {
        sendResult = await provider.sendTextMessage(phoneNumber, formattedMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error("[DirectSend] ❌ Provider send failed", { workspaceId, customerId, error: errorMessage })
      sendResult = { success: false, error: errorMessage }
    }

    if (!sendResult.success) {
      logger.error("[DirectSend] ❌ Failed to send message", {
        workspaceId,
        customerId,
        error: sendResult.error,
      })
      return { success: false, error: sendResult.error }
    }

    logger.info("[DirectSend] ✅ Message sent", {
      workspaceId,
      customerId,
      provider: provider.getProviderName(),
      messageId: sendResult.messageId,
    })

    // 📊 Append delivery step to timeline
    await this.appendTimelineStep(conversationMessageId, {
      type: "sub_agent",
      agent: "Send to WhatsApp",
      timestamp: new Date().toISOString(),
      model: "WhatsApp Cloud API",
      input: { phoneNumber, messageContent: messageContent.substring(0, 200) },
      output: {
        textResponse: `✅ Message delivered to ${phoneNumber}${sendResult.messageId ? ` (waId: ${sendResult.messageId})` : ""}\n\n${messageContent}`,
      },
    })

    // ✅ Update ConversationMessage delivery status + wamid (for reaction forwarding)
    if (conversationMessageId) {
      try {
        await this.prisma.conversationMessage.update({
          where: { id: conversationMessageId },
          data: {
            deliveryStatus: "sent",
            deliveredAt: new Date(),
            ...(sendResult.messageId ? { whatsappMessageId: sendResult.messageId } : {}),
          },
        })
      } catch (error) {
        logger.warn("[DirectSend] ⚠️ Failed to update delivery status", {
          conversationMessageId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    // 💰 BILLING: Deduct credit after successful send
    try {
      const deductResult = await this.billingService.deductMessageCredit(workspaceId)
      if (deductResult.success) {
        logger.info("[DirectSend] 💰 Credit deducted", { workspaceId, newBalance: deductResult.newBalance })
      } else {
        logger.warn("[DirectSend] ⚠️ Billing failed after delivery — must be reconciled manually", {
          workspaceId,
          error: deductResult.error,
        })
      }
    } catch (error) {
      logger.warn("[DirectSend] ⚠️ Billing exception after delivery", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return { success: true, messageId: sendResult.messageId }
  }

  /**
   * Send an image (with optional caption) directly via the workspace's provider.
   *
   * Same pipeline as send() — provider resolution, billing deduction, timeline —
   * but uses provider.sendMediaMessage(..., 'image'). The caption is run through
   * mdToWhatsApp so bold/links render correctly. Used for the welcome-video
   * thumbnail (works identically across Meta, UltraMsg and Wasender).
   */
  async sendMedia(params: {
    workspaceId: string
    customerId: string
    phoneNumber: string
    mediaUrl: string
    caption?: string
    conversationMessageId?: string
    skipSecurityCheck?: boolean
    isPlayground?: boolean
  }): Promise<DirectSendResult> {
    const {
      workspaceId,
      customerId,
      phoneNumber,
      mediaUrl,
      caption,
      conversationMessageId,
      skipSecurityCheck = false,
      isPlayground = false,
    } = params

    if (isPlayground) {
      logger.info("[DirectSend] 🧪 Playground mode - skipping media send", { workspaceId, customerId })
      return { success: true }
    }

    if (!phoneNumber) {
      logger.error("[DirectSend] ❌ Missing phone number (media)", { workspaceId, customerId })
      return { success: false, error: "Missing destination phone number" }
    }

    // 🔒 SECURITY CHECK on the caption (skip for bot-generated content).
    if (!skipSecurityCheck && caption) {
      try {
        const securityResult = await this.securityAgent.process({
          workspaceId,
          message: caption,
          customerId,
          customerName: undefined,
        })
        if (!securityResult.safe) {
          logger.warn("[DirectSend] 🚫 Media caption blocked by security check", {
            workspaceId,
            customerId,
            reason: securityResult.blockedReason,
          })
          return { success: false, blocked: true, error: securityResult.blockedReason }
        }
      } catch (error) {
        logger.error("[DirectSend] ⚠️ Media security check failed - allowing", {
          workspaceId,
          customerId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const workspace = (await this.prisma.workspace.findUnique({ where: { id: workspaceId } })) as any
    if (!workspace) {
      return { success: false, error: "Workspace not found" }
    }
    if (!WhatsAppProviderFactory.isConfigured(workspace)) {
      const providerName = WhatsAppProviderFactory.getProviderDisplayName(workspace)
      return { success: false, error: `WhatsApp not configured (${providerName})` }
    }

    const provider = WhatsAppProviderFactory.create(workspace)
    const formattedCaption = caption ? mdToWhatsApp(caption) : undefined

    let sendResult: { success: boolean; messageId?: string; error?: string }
    try {
      sendResult = await provider.sendMediaMessage(phoneNumber, mediaUrl, formattedCaption, "image")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error("[DirectSend] ❌ Provider media send failed", { workspaceId, customerId, error: errorMessage })
      sendResult = { success: false, error: errorMessage }
    }

    if (!sendResult.success) {
      logger.error("[DirectSend] ❌ Failed to send media", { workspaceId, customerId, error: sendResult.error })
      return { success: false, error: sendResult.error }
    }

    logger.info("[DirectSend] ✅ Media sent", {
      workspaceId,
      customerId,
      provider: provider.getProviderName(),
      messageId: sendResult.messageId,
    })

    await this.appendTimelineStep(conversationMessageId, {
      type: "sub_agent",
      agent: "Send media to WhatsApp",
      timestamp: new Date().toISOString(),
      model: "WhatsApp Cloud API",
      input: { phoneNumber, mediaUrl, caption: caption?.substring(0, 200) },
      output: {
        textResponse: `✅ Image delivered to ${phoneNumber}${sendResult.messageId ? ` (waId: ${sendResult.messageId})` : ""}`,
      },
    })

    // 💰 BILLING: each delivered WhatsApp message is billable.
    try {
      const deductResult = await this.billingService.deductMessageCredit(workspaceId)
      if (!deductResult.success) {
        logger.warn("[DirectSend] ⚠️ Media billing failed after delivery — reconcile manually", {
          workspaceId,
          error: deductResult.error,
        })
      }
    } catch (error) {
      logger.warn("[DirectSend] ⚠️ Media billing exception after delivery", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
    }

    return { success: true, messageId: sendResult.messageId }
  }

  /**
   * Show the "typing…" indicator to the customer while the LLM composes a reply.
   *
   * Resolves the workspace's configured provider (same factory path as send())
   * and delegates to provider.sendTypingIndicator — a no-op for providers that
   * don't implement it. Fully fire-and-forget: never throws, so callers can
   * `void` it before the LLM call without risking the reply path.
   *
   * @param workspaceId       workspace whose provider config drives the send
   * @param phoneNumber       customer phone in E.164 format
   * @param inboundMessageId  provider id (wamid) of the message being replied to
   */
  async sendTypingIndicator(
    workspaceId: string,
    phoneNumber: string,
    inboundMessageId?: string
  ): Promise<void> {
    try {
      if (!phoneNumber) return

      const workspace = (await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      })) as any

      if (!workspace || !WhatsAppProviderFactory.isConfigured(workspace)) return

      const provider = WhatsAppProviderFactory.create(workspace)
      await provider.sendTypingIndicator?.(phoneNumber, inboundMessageId)
    } catch (error) {
      // Non-critical — must never block the reply.
      logger.debug("[DirectSend] ⌨️ Typing indicator failed (non-critical)", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async appendTimelineStep(
    conversationMessageId: string | undefined,
    step: Record<string, unknown>
  ): Promise<void> {
    if (!conversationMessageId) return

    try {
      const existing = await this.prisma.conversationMessage.findUnique({
        where: { id: conversationMessageId },
        select: { debugInfo: true },
      })

      if (!existing) return

      const debugInfo = existing.debugInfo
        ? (typeof existing.debugInfo === "string" ? JSON.parse(existing.debugInfo) : existing.debugInfo) as Record<string, unknown>
        : { steps: [] }

      const steps = Array.isArray(debugInfo.steps) ? [...debugInfo.steps, step] : [step]

      await this.prisma.conversationMessage.update({
        where: { id: conversationMessageId },
        data: { debugInfo: JSON.stringify({ ...debugInfo, steps }) },
      })
    } catch (error) {
      logger.warn("[DirectSend] ⚠️ Failed to append timeline step", {
        conversationMessageId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
