import { prisma, PrismaClient } from "@echatbot/database"
import { Request, Response } from "express"
import axios from "axios"
import fs from "fs"
import { config } from "../../../config"
import { getLLMConfig } from "../../../config/llm.config"
import { MessageRepository } from "../../../repositories/message.repository"
import { storageService } from "../../../services/storage.service"
import { messageAttachmentRepository } from "../../../repositories/message-attachment.repository"
import { sniffMime, validateAttachment } from "../../../services/chat-attachment.validation"
import { sendOperatorAttachment } from "../../../services/outbound-attachment.service"
import { WhatsAppProviderFactory } from "../../../services/whatsapp/whatsapp-provider.factory"
import { LLMRouterService } from "../../../services/llm-router.service"
import { usageService } from "../../../services/usage.service"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import { websocketService } from "../../../services/websocket.service"
import { SecurityAgent } from "../../../application/agents/SecurityAgent"
import logger from "../../../utils/logger"

export class ChatController {
  private prisma: PrismaClient
  private messageRepository: MessageRepository
  private llmRouterService: LLMRouterService

  constructor() {
    this.prisma = prisma
    this.messageRepository = new MessageRepository()
    this.llmRouterService = new LLMRouterService(this.prisma)
  }

  /**
   * Get all recent chats with unread counts
   */
  async getRecentChats(req: Request, res: Response): Promise<void> {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20
      const workspaceId = (req as any).workspaceId

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "Workspace ID is required",
        })
        return
      }

      logger.info(`Getting recent chats for workspace ${workspaceId}`)

      const chats =
        await this.messageRepository.getChatSessionsWithUnreadCounts(
          limit,
          workspaceId
        )

      res.status(200).json({
        success: true,
        data: chats,
      })
    } catch (error) {
      logger.error("Error getting recent chats:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get recent chats",
      })
    }
  }

  /**
   * Get details for a specific chat session
   */
  async getChatSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params
      const workspaceId = (req as any).workspaceId

      logger.info(
        `Getting chat session details for sessionId: ${sessionId}, workspaceId: ${workspaceId}`
      )

      if (!sessionId) {
        logger.warn("Session ID is missing in request")
        res.status(400).json({
          success: false,
          error: "Session ID is required",
        })
        return
      }

      // 🔐 SECURITY: workspaceId is MANDATORY
      if (!workspaceId) {
        logger.error("getChatSession: workspaceId not found in request context")
        res.status(401).json({
          success: false,
          error: "Workspace context required",
        })
        return
      }

      // Get chat session details including workspace information
      const chatSession = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          workspaceId: workspaceId,
        },
        include: {
          customer: true,
          workspace: {
            select: {
              id: true,
              name: true,
              channelStatus: true,
              deletedAt: true,
            },
          },
        },
      })

      if (!chatSession) {
        logger.warn(`Chat session not found for sessionId: ${sessionId}`)
        res.status(404).json({
          success: false,
          error: "Chat session not found",
        })
        return
      }

      logger.info(
        `Found chat session: ${JSON.stringify({
          id: chatSession.id,
          customerId: chatSession.customerId,
          workspaceId: chatSession.workspaceId,
          customerName: chatSession.customer?.name || "Unknown Customer",
        })}`
      )

      res.status(200).json({
        success: true,
        data: chatSession,
      })
    } catch (error) {
      logger.error(
        `Error getting chat session details for ${req.params.sessionId}:`,
        error
      )
      res.status(500).json({
        success: false,
        error: "Failed to get chat session details",
      })
    }
  }

  /**
   * Get messages for a specific chat session
   */
  async getChatMessages(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params
      const workspaceId = (req as any).workspaceId
      const { page = 1, limit = 50 } = req.query

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: "Session ID is required",
        })
        return
      }

      // 📋 Parse and validate pagination params
      const pageNum = Math.max(1, parseInt(String(page)) || 1)
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50))

      // Pass the workspaceId to the repository method for proper filtering
      const result = await this.messageRepository.getChatSessionMessages(
        sessionId,
        workspaceId,
        pageNum,
        limitNum
      )

      // Note: Empty messages array is valid (new session with no messages yet)
      // We only return 404 if the session itself doesn't exist in this workspace

      // Mark messages as read when they are viewed
      await this.messageRepository.markMessagesAsRead(sessionId, workspaceId)

      // 📎 Hydrate attachments onto each message (fail-safe: a hydration error
      // must not break the messages response).
      try {
        const data = Array.isArray(result.data) ? result.data : []
        const ids = data.map((m: any) => m.id).filter(Boolean)
        if (ids.length > 0) {
          const atts = await messageAttachmentRepository.listByConversationMessageIds(ids)
          const byMessage: Record<string, any[]> = {}
          for (const a of atts) {
            ;(byMessage[a.conversationMessageId] ||= []).push({
              id: a.id,
              url: a.url,
              kind: a.kind,
              mimeType: a.mimeType,
              filename: a.filename,
              sizeBytes: a.sizeBytes,
            })
          }
          for (const m of data) {
            if (byMessage[m.id]) (m as any).attachments = byMessage[m.id]
          }
        }
      } catch (hydrationError) {
        logger.error("Failed to hydrate message attachments:", hydrationError)
      }

      // 📋 Return paginated response with metadata
      res.status(200).json({
        success: true,
        data: result.data,
        hasMore: result.hasMore,
        total: result.total,
        page: result.page,
        limit: result.limit,
      })
    } catch (error) {
      logger.error("Error getting chat messages:", error)
      res.status(500).json({
        success: false,
        error: "Failed to get chat messages",
      })
    }
  }

  /**
   * Mark messages in a chat session as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params
      const workspaceId = (req as any).workspaceId

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: "Session ID is required",
        })
        return
      }

      // Pass the workspaceId to ensure we only mark messages for the right workspace
      const success = await this.messageRepository.markMessagesAsRead(
        sessionId,
        workspaceId
      )

      if (!success && workspaceId) {
        res.status(404).json({
          success: false,
          error: "Chat session not found in this workspace",
        })
        return
      }

      res.status(200).json({
        success,
        message: success
          ? "Messages marked as read"
          : "Failed to mark messages as read",
      })
    } catch (error) {
      logger.error("Error marking messages as read:", error)
      res.status(500).json({
        success: false,
        error: "Failed to mark messages as read",
      })
    }
  }

  /**
   * Delete a chat session and all its messages
   */
  async deleteChat(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params
      const workspaceId = (req as any).workspaceId

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: "Session ID is required",
        })
        return
      }

      // Pass workspaceId to ensure we only delete the right chat session
      const success = await this.messageRepository.deleteChat(
        sessionId,
        workspaceId
      )

      if (!success && workspaceId) {
        res.status(404).json({
          success: false,
          error: "Chat session not found in this workspace",
        })
        return
      }

      res.status(success ? 200 : 500).json({
        success,
        message: success
          ? "Chat deleted successfully"
          : "Failed to delete chat",
      })
    } catch (error) {
      logger.error("Error deleting chat:", error)
      res.status(500).json({
        success: false,
        error: "Failed to delete chat",
      })
    }
  }

  /**
   * Send a message in a chat session (manual operator mode)
   * This endpoint is used when isActiveChatbot = false
   * 
   * 🚨🚨🚨 CRITICAL RULE - MESSAGE FLOW TIMELINE COMPLIANCE 🚨🚨🚨
   * 
   * THE MESSAGE FLOW TIMELINE **MUST** ALWAYS REPRESENT THE REAL MESSAGE JOURNEY!
   * NEVER let the real flow and the UI representation be different!
   * 
   * OPERATOR MESSAGE FLOW (MUST be represented in timeline):
   * 1. 🎧 Human Operator Input
   * 2. 🌍 Translation Layer (always) + 🛡️ Security Layer
   * 3. 📤 WhatsApp Queue (MANDATORY - always include in debugSteps)
   * 
   * CRITICAL: Update conversationMessage.debugInfo with COMPLETE debugSteps 
   * at the END of the process, not at the beginning!
   * 
   * IF Safety is skipped → ADD debug step showing it was skipped
   * IF WhatsApp fails → ADD debug step showing the failure  
   * IF any step is missing → The timeline representation is WRONG and UNACCEPTABLE
   * 
   * This is the HEART of the software - debug steps MUST match reality!
   * 🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨
   */
  /**
   * 📎 Upload one or more attachments (image/PDF) for a chat and send them.
   *
   * Multipart "files" (validated by chatAttachmentUpload middleware). For each
   * file we: re-validate by magic bytes + size (never trust the client), upload
   * to private storage, create an OUTBOUND Message + MessageAttachment, and —
   * on the whatsapp channel — send via the workspace's active provider. Widget
   * sessions persist only (rendered via polling). Best-effort send: a provider
   * failure still stores the message so the operator sees it.
   */
  async uploadAttachments(req: Request, res: Response): Promise<void> {
    const files = ((req as any).files as Express.Multer.File[]) || []
    try {
      const { sessionId } = req.params
      const workspaceId = (req as any).workspaceId
      const userId = (req as any).user?.userId || (req as any).user?.id
      const caption = typeof req.body?.caption === "string" ? req.body.caption : ""

      if (!sessionId || !workspaceId) {
        res.status(400).json({ success: false, error: "Session ID and workspace are required" })
        return
      }
      if (files.length === 0) {
        res.status(400).json({ success: false, error: "No files provided" })
        return
      }

      const chatSession = await this.prisma.chatSession.findFirst({
        where: { id: sessionId, workspaceId },
        include: { customer: true, workspace: true },
      })
      if (!chatSession) {
        res.status(404).json({ success: false, error: "Chat session not found in this workspace" })
        return
      }

      const channel: "whatsapp" | "widget" =
        chatSession.channel === "widget" ? "widget" : "whatsapp"

      // Resolve the active provider once (whatsapp channel only). If the channel
      // is not active/configured, provider stays undefined → no send (Andrea's
      // "if active is false it neither receives nor sends" rule).
      let provider: any = undefined
      if (channel === "whatsapp") {
        try {
          provider = WhatsAppProviderFactory.create(chatSession.workspace)
        } catch (e) {
          provider = undefined
        }
      }

      const createdAttachments: any[] = []
      for (const file of files) {
        const buffer = fs.readFileSync(file.path)
        const trueMime = sniffMime(buffer) || file.mimetype
        const validation = validateAttachment({
          mimeType: trueMime,
          filename: file.originalname,
          sizeBytes: buffer.length,
        })
        if (!validation.ok || !validation.kind) {
          res.status(400).json({ success: false, error: validation.error || "Invalid file" })
          return
        }

        const folder = `chat-attachments/${workspaceId}/${sessionId}`
        const ext = trueMime === "application/pdf" ? "pdf" : trueMime === "image/png" ? "png" : "jpg"
        const rand = Math.random().toString(36).slice(2, 8)
        const uploaded = await storageService.upload(buffer, {
          filename: `${Date.now()}_${rand}.${ext}`,
          folder,
          contentType: trueMime,
          // v1: public + unguessable key so the provider can fetch it on send
          // and the operator UI can render it. Production = signed URLs (§11).
          isPublic: true,
        })

        // Persist into the LIVE conversation table (the chat UI reads this).
        // role "assistant" → rendered on the operator/right side.
        const message = await this.prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: chatSession.customerId,
            conversationId: sessionId,
            role: "assistant",
            content: caption || "",
            deliveryStatus: "sent",
          },
        })

        const att = await messageAttachmentRepository.create({
          conversationMessageId: message.id,
          workspaceId,
          kind: validation.kind,
          url: uploaded.url,
          storageKey: uploaded.key,
          mimeType: trueMime,
          filename: file.originalname,
          sizeBytes: buffer.length,
        })

        const sendResult = await sendOperatorAttachment(
          { provider, logger },
          {
            active: channel === "whatsapp" ? !!provider : true,
            channel,
            to: chatSession.customer.phone || "",
            attachment: { kind: validation.kind, publicUrl: uploaded.url },
            caption,
          }
        )

        createdAttachments.push({
          id: att.id,
          messageId: message.id,
          url: uploaded.url,
          kind: validation.kind,
          mimeType: trueMime,
          filename: file.originalname,
          sizeBytes: buffer.length,
          sent: sendResult.sent,
        })

        try {
          fs.unlinkSync(file.path)
        } catch {
          /* temp file cleanup best-effort */
        }
      }

      res.status(200).json({ success: true, attachments: createdAttachments })
    } catch (error: any) {
      logger.error("[CHAT-ATTACH] ❌ Upload failed:", error)
      // Best-effort temp cleanup on error.
      for (const f of files) {
        try {
          fs.unlinkSync(f.path)
        } catch {
          /* ignore */
        }
      }
      res.status(500).json({ success: false, error: "Failed to upload attachments" })
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params
      const { content, sender } = req.body
      const workspaceId = (req as any).workspaceId
      const userId = (req as any).user?.userId || (req as any).user?.id

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: "Session ID is required",
        })
        return
      }

      if (!content || !sender) {
        res.status(400).json({
          success: false,
          error: "Content and sender are required",
        })
        return
      }

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "Workspace ID is required",
        })
        return
      }

      // 🔒 SECURITY: Verify user has access to this workspace (IDOR protection)
      if (userId) {
        const userWorkspace = await this.prisma.userWorkspace.findFirst({
          where: {
            userId: userId,
            workspaceId: workspaceId,
          },
        })

        if (!userWorkspace) {
          logger.warn(
            `🚫 SECURITY: User ${userId} attempted to access workspace ${workspaceId} without permission`
          )
          res.status(403).json({
            success: false,
            error: "Access denied to this workspace",
          })
          return
        }

        logger.info(
          `✅ SECURITY: User ${userId} authorized for workspace ${workspaceId} (role: ${userWorkspace.role})`
        )
      }

      logger.info(
        `[CHAT-SEND] 📱 Sending operator message in session ${sessionId}: "${content}"`
      )

      // Find the chat session and check if chatbot is active
      const [chatSession, workspace] = await Promise.all([
        this.prisma.chatSession.findFirst({
          where: { id: sessionId, workspaceId: workspaceId },
          include: { customer: true },
        }),
        this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { translateOperatorMessages: true },
        }),
      ])

      if (!chatSession) {
        res.status(404).json({
          success: false,
          error: "Chat session not found in this workspace",
        })
        return
      }

      // Check if chatbot is disabled (manual operator mode)
      if (chatSession.customer.activeChatbot === true) {
        res.status(400).json({
          success: false,
          error:
            "Cannot send manual message: chatbot is active. Disable chatbot first.",
        })
        return
      }

      // 🔀 "END" COMMAND DETECTION (Operator Dashboard)
      // If the operator sends "END" from the backoffice chat, it should trigger the same
      // logic as sending "END" from WhatsApp: close session and process next in queue.
      const isEndCommand = content.trim().toUpperCase() === "END"
      if (isEndCommand) {
        logger.info(`[CHAT-SEND] 🔒 "END" command detected from dashboard - closing session for customer ${chatSession.customerId}`)

        try {
          const { OperatorRelayService } = require("../../../application/services/operator-relay.service")
          const operatorRelayService = new OperatorRelayService(this.prisma)
          await operatorRelayService.processEndCommand(workspaceId)

          res.status(200).json({
            success: true,
            message: "Session closed successfully via END command",
            isEndCommand: true
          })
          return
        } catch (endError) {
          logger.error(`[CHAT-SEND] ❌ Failed to process END command:`, endError)
          res.status(500).json({
            success: false,
            error: "Failed to close session via END command"
          })
          return
        }
      }

      logger.info(
        `[CHAT-SEND] 📱 Processing operator message: "${content}"`
      )

      // 🆕 CREATE DEBUG STEPS for Operator Message (for timeline visibility)
      const debugSteps = []

      // Step 1: Operator Input
      const operatorDebugStep = {
        type: "operator_message",
        agent: "Human Operator",
        model: "N/A",
        temperature: 0,
        timestamp: new Date().toISOString(),
        input: {
          messageContent: content,
          sessionId: sessionId,
          customerId: chatSession.customerId,
        },
        output: {
          message: content,
          messageId: "pending", // Will be updated after save
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      }

      debugSteps.push(operatorDebugStep)

      // 🌍 Translate operator message to customer's language when they differ
      // Skipped when workspace.translateOperatorMessages=false
      const translationEnabled = workspace?.translateOperatorMessages !== false
      let finalMessage = content
      const customerLanguage = chatSession.customer.language || "en"
      let operatorLanguage = customerLanguage // detected lang of the operator message
      let wasTranslated = false
      // Per-language "AI translation" suffix appended to operator messages
      // that were auto-translated into the customer's language. Falls back
      // to English when the customer language isn't in the map.
      const translationSuffix: Record<string, string> = {
        es: "*(traducción IA)*",
        it: "*(traduzione IA)*",
        en: "*(AI translation)*",
        ca: "*(traducció IA)*",
        pt: "*(tradução IA)*",
        fr: "*(traduction IA)*",
        de: "*(KI-Übersetzung)*",
      }
      try {
        if (!translationEnabled) throw new Error("translation_disabled")
        const llmConfig = getLLMConfig("openai/gpt-4o-mini")
        const detectResponse = await axios.post(
          `${llmConfig.baseURL}/chat/completions`,
          {
            model: llmConfig.model,
            temperature: 0,
            messages: [
              {
                role: "system",
                content: `Detect the language of the text and reply with ONLY the ISO 639-1 code (e.g. "es", "it", "en", "ca", "pt", "fr"). No other text.`,
              },
              { role: "user", content },
            ],
          },
          { headers: { Authorization: `Bearer ${llmConfig.apiKey}`, "Content-Type": "application/json" } }
        )
        const detectedLang = detectResponse.data.choices?.[0]?.message?.content?.trim().toLowerCase() || "unknown"
        operatorLanguage = detectedLang

        if (detectedLang !== customerLanguage) {
          const langNames: Record<string, string> = {
            es: "Spanish", it: "Italian", en: "English",
            ca: "Catalan", pt: "Portuguese", fr: "French",
          }
          const targetLangName = langNames[customerLanguage] || customerLanguage
          const translateResponse = await axios.post(
            `${llmConfig.baseURL}/chat/completions`,
            {
              model: llmConfig.model,
              temperature: 0,
              messages: [
                {
                  role: "system",
                  content: `Translate the following text to ${targetLangName}. Reply with ONLY the translated text, no explanations.`,
                },
                { role: "user", content },
              ],
            },
            { headers: { Authorization: `Bearer ${llmConfig.apiKey}`, "Content-Type": "application/json" } }
          )
          const translated = translateResponse.data.choices?.[0]?.message?.content?.trim()
          if (translated) {
            const suffix = translationSuffix[customerLanguage] || "*(AI translation)*"
            finalMessage = `${translated}\n\n${suffix}`
            wasTranslated = true
            logger.info(`[CHAT-SEND] 🌍 Operator message translated from ${detectedLang} to ${customerLanguage}`)
          }
        }
      } catch (translateError) {
        logger.warn(`[CHAT-SEND] ⚠️ Translation failed, using original message:`, translateError.message)
        finalMessage = content
      }

      const isWidgetChannel = chatSession.channel === "widget"
      try {
        if (isWidgetChannel) {
          const securityAgent = new SecurityAgent(this.prisma)
          const securityResult = await securityAgent.process({
            workspaceId: workspaceId,
            message: finalMessage,
            customerName: chatSession.customer.name || "Cliente",
            customerId: chatSession.customer.id,
          })

          if (!securityResult.safe) {
            logger.warn(
              `[CHAT-SEND] ⚠️ Operator message blocked by Widget Security Layer: ${securityResult.blockedReason}`
            )
            res.status(400).json({
              success: false,
              error: "Message blocked by security filter",
              reason: securityResult.blockedReason,
            })
            return
          }

          finalMessage = securityResult.message || finalMessage

          debugSteps.push({
            type: "safety",
            agent: "Widget Security Layer",
            model: "openai/gpt-4o-mini",
            temperature: 0,
            timestamp: new Date().toISOString(),
            input: {
              originalMessage: finalMessage,
            },
            output: {
              safe: securityResult.safe,
              blockedReason: securityResult.blockedReason || null,
              textResponse: finalMessage,
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: securityResult.tokensUsed || 0,
              totalTokens: securityResult.tokensUsed || 0,
            },
            safe: securityResult.safe,
            blocked: !securityResult.safe,
            blockedReason: securityResult.blockedReason,
          })
        }

        logger.info(
          `[CHAT-SEND] ✅ Operator message processed${isWidgetChannel ? " (widget security applied)" : " (no translation - operator direct)"}`
        )
      } catch (safetyError) {
        logger.warn(
          `[CHAT-SEND] ⚠️ Translation/security failed, using original message:`,
          safetyError.message
        )
        // Continue with original message if safety fails
        finalMessage = content
      }

      // 💾 STEP 3: Save to History AFTER safety validation.
      //
      // `content` is what the customer sees on WhatsApp (translated into
      // their language when the operator wrote in another language). We
      // also persist `originalContent` + `originalLanguage` in metadata so
      // the operator UI can render a "view original" toggle without going
      // back to the LLM.
      const savedMessage = await this.prisma.message.create({
        data: {
          chatSessionId: sessionId,
          content: finalMessage, // Use safe/translated message
          direction: "OUTBOUND",
          type: "TEXT",
          aiGenerated: false,
          metadata: {
            isOperatorMessage: true,
            sentBy: "HUMAN_OPERATOR",
            agentSelected: "MANUAL_OPERATOR",
            originalContent: wasTranslated ? content : null,
            originalLanguage: wasTranslated ? operatorLanguage : null,
            translatedTo: wasTranslated ? customerLanguage : null,
          },
        },
      })

      // Update operator debug step with messageId
      operatorDebugStep.output.messageId = savedMessage.id

      // Add Save to History debug step
      debugSteps.push({
        type: "function_call",
        agent: "💾 Save to History",
        model: "N/A",
        temperature: 0,
        timestamp: new Date().toISOString(),
        functionName: "saveMessage",
        input: {
          content: finalMessage,
          direction: "OUTBOUND",
          sessionId: sessionId,
          customerId: chatSession.customerId,
          customerName: chatSession.customer.name || "Unknown",
        },
        output: {
          messageId: savedMessage.id,
          success: true,
          executionTimeMs: 50,
        },
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      })

      logger.info(
        `[CHAT-SEND] ✅ Operator message saved to database successfully`
      )

      // 🆕 CRITICAL: ALSO save to conversationMessage table for chat history visibility
      let deliveryStatus = "not_queued" // Default: not queued yet
      try {
        const customer = await this.prisma.customers.findUnique({
          where: { id: chatSession.customerId },
          select: { phone: true },
        })

        // Tentatively mark as "pending" if customer has phone (will be in queue)
        if (customer?.phone) {
          deliveryStatus = "pending"
        }
      } catch (e) {
        // Ignore - default to not_queued
      }

      // 🆕 Mirror in conversationMessage (the table the operator chat UI
      //    reads from). Same content (customer-facing language) +
      //    originalContent/originalLanguage in debugInfo for the upcoming
      //    "view original" toggle in the operator UI.
      const conversationMessage = await this.prisma.conversationMessage.create({
        data: {
          workspaceId: workspaceId,
          customerId: chatSession.customerId,
          conversationId: sessionId,
          role: "assistant", // Operator messages appear as assistant messages
          content: finalMessage, // Use safe/translated message
          agentType: "OPERATOR",
          tokensUsed: 0,
          deliveryStatus: deliveryStatus, // ✅ Track delivery status
          debugInfo: JSON.stringify({
            isOperatorMessage: true,
            sentBy: "HUMAN_OPERATOR",
            operatorLanguage,
            customerLanguage,
            wasTranslated,
            originalContent: wasTranslated ? content : null,
            originalLanguage: wasTranslated ? operatorLanguage : null,
            translatedTo: wasTranslated ? customerLanguage : null,
            timestamp: new Date().toISOString(),
            steps: debugSteps, // Include all current debug steps
          }),
        },
        select: { id: true },
      })

      logger.info(
        `[CHAT-SEND] 🚨 DEBUG: Saved ${debugSteps.length} debug steps to conversationMessage`
      )
      logger.info(
        `[CHAT-SEND] 🚨 DEBUG: Steps types: ${debugSteps.map(s => s.type).join(", ")}`
      )

      logger.info(
        `[CHAT-SEND] ✅ Operator message ALSO saved to conversationMessage for chat history`
      )

      // 🆕 SAVE DEBUG INFO to agentInteractions table (for timeline)
      const debugInfo = {
        steps: [operatorDebugStep],
        totalTokens: 0,
        totalCost: 0,
        executionTimeMs: 0,
        timestamp: new Date().toISOString(),
      }

      try {
        // Access loggerService through the router service instance
        const loggerService = (this.llmRouterService as any).loggerService
        if (loggerService) {
          await loggerService.logAgentInteraction({
            workspaceId: workspaceId,
            customerId: chatSession.customerId,
            conversationId: sessionId,
            messageId: savedMessage.id,
            step: 1,
            agentType: "OPERATOR", // Now part of AgentType enum
            agentAction: "SEND_MESSAGE",
            inputMessage: content,
            agentPrompt: "N/A - Manual operator message", // Required field
            llmModel: "N/A", // Required field
            llmResponse: content, // Required field - use message content
            tokensUsed: 0,
            executionTimeMs: 0,
          })
        }
        logger.info("✅ Operator message debug info saved to AgentConversationLog")
      } catch (debugError) {
        logger.warn("⚠️ Failed to save operator message debug info:", debugError)
        // Continue - message is saved even if debug logging fails
      }

      // 📤 STEP 4: Deduct wallet credit (ONLY if debugMode=false)
      try {
        const workspaceForBilling = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { debugMode: true, ownerId: true },
        })

        if (workspaceForBilling?.debugMode === true) {
          logger.info(`[CHAT-SEND] 🆓 DEBUG MODE: Skipping billing for operator message (free)`)
        } else if (workspaceForBilling?.ownerId) {
          const billingService = new SubscriptionBillingService(this.prisma)
          const messageId = `operator-${chatSession.id}-${Date.now()}`
          const billingResult = await billingService.deductOwnerMessageCredit(
            workspaceForBilling.ownerId,
            workspaceId,
            messageId
          )
          if (billingResult.success) {
            logger.info(`[CHAT-SEND] 💰 Operator message charged: $${config.llm.defaultPrice} deducted. New balance: $${billingResult.newBalance?.toFixed(3)}`)
          } else {
            logger.error(`[CHAT-SEND] ❌ Failed to deduct operator message credit: ${billingResult.error}`, { workspaceId })
          }
        }
      } catch (usageError) {
        logger.warn(`[CHAT-SEND] ⚠️ Billing failed (message still saved):`, usageError.message)
        // Don't fail the response — billing failure shouldn't break UX
      }

      // 📤 STEP 5: CHANNEL-SPECIFIC DELIVERY (WhatsApp vs Widget)
      // 🔧 CRITICAL FIX: Route message based on channel, NOT blindly to WhatsApp
      if (chatSession.channel === "whatsapp") {
        // WhatsApp customer: send directly via provider
        try {
          const { WhatsAppDirectSendService } = require("../../../services/whatsapp-direct-send.service")
          const directSend = new WhatsAppDirectSendService(this.prisma)
          await directSend.send({
            workspaceId,
            customerId: chatSession.customerId,
            phoneNumber: chatSession.customer.phone || "",
            messageContent: finalMessage,
            conversationMessageId: conversationMessage.id,
            skipSecurityCheck: true, // manual operator send — no LLM security needed
          })
          logger.info(`[CHAT-SEND] ✅ Message sent directly to WhatsApp (channel: whatsapp)`)

          debugSteps.push({
            type: "function_call",
            agent: "📤 Send to WhatsApp",
            model: "N/A",
            temperature: 0,
            timestamp: new Date().toISOString(),
            functionName: "sendWhatsAppDirect",
            input: {
              channel: "whatsapp",
              phoneNumber: chatSession.customer.phone || "",
              message: finalMessage,
              customerId: chatSession.customerId,
              customerName: chatSession.customer.name || "Unknown",
            },
            output: {
              success: true,
              conversationMessageId: conversationMessage.id,
              status: "sent",
              executionTimeMs: 10,
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          })
        } catch (sendError) {
          logger.warn(
            `[CHAT-SEND] ⚠️ Failed to send message to WhatsApp (message still saved):`,
            sendError instanceof Error ? sendError.message : sendError
          )

          debugSteps.push({
            type: "function_call",
            agent: "📤 Send to WhatsApp",
            model: "N/A",
            temperature: 0,
            timestamp: new Date().toISOString(),
            functionName: "sendWhatsAppDirect",
            input: {
              channel: "whatsapp",
              phoneNumber: chatSession.customer.phone || "",
              message: finalMessage,
              customerId: chatSession.customerId,
              customerName: chatSession.customer.name || "Unknown",
            },
            output: {
              success: false,
              conversationMessageId: conversationMessage.id,
              status: "failed",
              error: sendError instanceof Error ? sendError.message : "Unknown error",
              executionTimeMs: 20,
            },
            tokenUsage: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
            },
          })
        }
      } else if (chatSession.channel === "widget") {
        // Widget customer: message already saved to conversationMessage table
        // Widget polls for new messages via GET /widget/operator-messages endpoint
        logger.info(`[CHAT-SEND] ✅ Widget message saved - delivery via polling (channel: widget)`)

        // 🆕 ADD Widget polling delivery debug step
        debugSteps.push({
          type: "function_call",
          agent: "💬 Widget Delivery (Polling)",
          model: "N/A",
          temperature: 0,
          timestamp: new Date().toISOString(),
          functionName: "widgetPollingDelivery",
          input: {
            channel: "widget",
            customerId: chatSession.customerId,
            conversationMessageId: conversationMessage.id,
            pollingEndpoint: "/widget/operator-messages",
          },
          output: {
            success: true,
            deliveryMethod: "polling",
            pollingEndpoint: "/widget/operator-messages",
            note: "Widget polls this endpoint every 2-3 seconds for new operator messages",
            executionTimeMs: 5,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        })
      } else {
        // Unknown channel - log warning but don't fail
        logger.warn(`[CHAT-SEND] ⚠️ Unknown channel: ${chatSession.channel} - message saved but delivery uncertain`)

        debugSteps.push({
          type: "function_call",
          agent: "⚠️ Unknown Channel",
          model: "N/A",
          temperature: 0,
          timestamp: new Date().toISOString(),
          functionName: "unknownChannelDelivery",
          input: {
            channel: chatSession.channel,
            customerId: chatSession.customerId,
          },
          output: {
            success: false,
            warning: `Unknown channel: ${chatSession.channel}`,
            note: "Message saved to conversationMessage but delivery uncertain",
            executionTimeMs: 5,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        })
      }

      // 🚨 CRITICAL: UPDATE conversationMessage with COMPLETE debug info BEFORE finalizing
      // This ensures frontend gets ALL debug steps, not just the initial one
      await this.prisma.conversationMessage.update({
        where: { id: conversationMessage.id },
        data: {
          debugInfo: JSON.stringify({
            isOperatorMessage: true,
            sentBy: "HUMAN_OPERATOR",
            timestamp: new Date().toISOString(),
            steps: debugSteps, // 🚨 COMPLETE debug steps with Safety & delivery
            totalTokens: 0,
            totalCost: 0,
            executionTimeMs: 0,
          }),
        },
      })

      logger.info(`[CHAT-SEND] ✅ Operator message processing completed (channel: ${chatSession.channel})`)

      try {
        // Access loggerService through the router service instance
        const loggerService = (this.llmRouterService as any).loggerService
        if (loggerService) {
          await loggerService.logAgentInteraction({
            workspaceId: workspaceId,
            customerId: chatSession.customerId,
            conversationId: sessionId,
            messageId: savedMessage.id,
            step: 1,
            agentType: "OPERATOR", // Now part of AgentType enum
            agentAction: "SEND_MESSAGE",
            inputMessage: content,
            agentPrompt: "N/A - Manual operator message", // Required field
            llmModel: "N/A", // Required field
            llmResponse: finalMessage, // Use final processed message
            tokensUsed: 0,
            executionTimeMs: 0,
          })
        }
        logger.info("✅ Operator message debug info saved to AgentConversationLog")
      } catch (debugError) {
        logger.warn("⚠️ Failed to save operator message debug info:", debugError)
        // Continue - message is saved even if debug logging fails
      }

      // 🔔 CRITICAL: Notify WebSocket clients AFTER complete update (so frontend gets all debug steps)
      websocketService.notifyNewMessage(workspaceId, {
        id: savedMessage.id,
        sessionId: sessionId,
        content: content,
        sender: "agent", // Operator message appears as agent message
        timestamp: savedMessage.createdAt.toISOString(),
        workspaceId: workspaceId,
        metadata: {
          isOperatorMessage: true,
          sentBy: "HUMAN_OPERATOR",
        },
      })

      // 🔔 CRITICAL: Also notify chat list update (for last message preview)
      websocketService.notifyChatUpdated(workspaceId, {
        sessionId: sessionId,
        lastMessage: content.substring(0, 100), // Preview text
        lastMessageAt: savedMessage.createdAt.toISOString(),
        customerId: chatSession.customerId,
      })

      logger.info(
        `[CHAT-SEND] 🔔 WebSocket notifications sent AFTER complete update (new-message + chat-updated)`
      )

      res.status(200).json({
        success: true,
        data: {
          id: savedMessage.id,
          content: content,
          sender: "user", // This ensures it appears on the right side
          timestamp: savedMessage.createdAt,
          direction: "OUTBOUND",
          metadata: {
            isOperatorMessage: true,
            sentBy: "HUMAN_OPERATOR",
            agentSelected: "MANUAL_OPERATOR",
          },
        },
      })
    } catch (error) {
      logger.error("[CHAT-SEND] ❌ Error sending operator message:", error)
      res.status(500).json({
        success: false,
        error: "Failed to send message",
      })
    }
  }

  /**
   * Translate a single chat message into the logged-in operator's preferred
   * language. Used by the chat UI as a lazy on-hover translation tooltip so
   * the operator can read customer / bot messages written in a foreign
   * language without changing the stored message itself.
   *
   * Body: { content: string, sourceLanguage?: string }
   * Returns: { translated: string, targetLanguage: string }
   */
  async translateMessage(req: Request, res: Response): Promise<void> {
    try {
      const { content, sourceLanguage } = req.body as {
        content?: string
        sourceLanguage?: string
      }
      const user = (req as any).user as { language?: string } | undefined

      if (!content || typeof content !== "string" || !content.trim()) {
        res.status(400).json({ success: false, error: "content is required" })
        return
      }

      // Map User.language (3-letter codes in the DB) → ISO 639-1.
      const targetLanguage = mapUserLangToIso(user?.language) || "en"

      // No-op if source matches target — return as-is so the client can
      // still cache the response and skip future fetches for this message.
      if (sourceLanguage && sourceLanguage.toLowerCase() === targetLanguage) {
        res.status(200).json({
          success: true,
          data: { translated: content, targetLanguage, alreadyMatches: true },
        })
        return
      }

      const llmConfig = getLLMConfig("openai/gpt-4o-mini")
      const langName = ISO_LANG_NAMES[targetLanguage] || targetLanguage
      const response = await axios.post(
        `${llmConfig.baseURL}/chat/completions`,
        {
          model: llmConfig.model,
          temperature: 0,
          messages: [
            {
              role: "system",
              content: `Translate the following text to ${langName}. Reply with ONLY the translated text, no explanations, no quotes.`,
            },
            { role: "user", content },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${llmConfig.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      )
      const translated =
        response.data.choices?.[0]?.message?.content?.trim() || ""

      if (!translated) {
        res.status(502).json({
          success: false,
          error: "Translation upstream returned empty",
        })
        return
      }

      res.status(200).json({
        success: true,
        data: { translated, targetLanguage },
      })
    } catch (error: any) {
      logger.error("[CHAT-TRANSLATE] Failed:", error?.message || error)
      res.status(500).json({
        success: false,
        error: "Translation failed",
      })
    }
  }

  /**
   * Translate a batch of chat messages into a target language in a single
   * request. Used by the global "Translate to" dropdown in the operator
   * chat UI so the whole timeline can be retranslated in one round-trip.
   *
   * Body: { messages: [{id, content}], targetLanguage }
   * Returns: { translations: [{id, translated}], targetLanguage }
   */
  async translateMessages(req: Request, res: Response): Promise<void> {
    try {
      const { messages, targetLanguage } = req.body as {
        messages?: Array<{ id?: string; content?: string }>
        targetLanguage?: string
      }
      const user = (req as any).user as { language?: string } | undefined

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({
          success: false,
          error: "messages is required and must be a non-empty array",
        })
        return
      }

      const target =
        (typeof targetLanguage === "string" && targetLanguage.trim()
          ? targetLanguage.toLowerCase()
          : null) ||
        mapUserLangToIso(user?.language) ||
        "es"

      const langName = ISO_LANG_NAMES[target] || target
      const llmConfig = getLLMConfig("openai/gpt-4o-mini")

      // Run all translations in parallel — the gpt-4o-mini latency at 0
      // temperature is low and stable enough that parallelizing 30 short
      // messages takes about as long as a single 200-token reply.
      const results = await Promise.all(
        messages.map(async (m) => {
          const id = String(m.id || "")
          const content = (m.content || "").trim()
          if (!id || !content) return { id, translated: "" }
          try {
            const response = await axios.post(
              `${llmConfig.baseURL}/chat/completions`,
              {
                model: llmConfig.model,
                temperature: 0,
                messages: [
                  {
                    role: "system",
                    content: `Translate the following text to ${langName}. Reply with ONLY the translated text, no explanations, no quotes.`,
                  },
                  { role: "user", content },
                ],
              },
              {
                headers: {
                  Authorization: `Bearer ${llmConfig.apiKey}`,
                  "Content-Type": "application/json",
                },
                timeout: 30_000,
              }
            )
            const translated =
              response.data.choices?.[0]?.message?.content?.trim() || ""
            return { id, translated }
          } catch (err: any) {
            logger.warn("[CHAT-TRANSLATE-BATCH] one message failed", {
              id,
              error: err?.message,
            })
            return { id, translated: "" }
          }
        })
      )

      res.status(200).json({
        success: true,
        data: { translations: results, targetLanguage: target },
      })
    } catch (error: any) {
      logger.error(
        "[CHAT-TRANSLATE-BATCH] Failed:",
        error?.message || error
      )
      res.status(500).json({
        success: false,
        error: "Batch translation failed",
      })
    }
  }

  // 🗑️ REMOVED: sendWhatsAppMessage method (dead code)
  // WhatsApp messages sent directly via WhatsAppDirectSendService
  // This ensures: 1) Debug Mode is respected, 2) Security Agent validates, 3) Billing is tracked
}

// ── Translation helpers ─────────────────────────────────────────────────────
// User.language stores 3-letter codes (ENG/ITA/ESP/POR/FRA/DEU) but the rest
// of the system speaks ISO 639-1 (en/it/es/pt/fr/de). One central mapping so
// future endpoints stay consistent.
const USER_LANG_TO_ISO: Record<string, string> = {
  ENG: "en",
  ITA: "it",
  ESP: "es",
  POR: "pt",
  FRA: "fr",
  DEU: "de",
  CAT: "ca",
}

const ISO_LANG_NAMES: Record<string, string> = {
  en: "English",
  it: "Italian",
  es: "Spanish",
  pt: "Portuguese",
  fr: "French",
  de: "German",
  ca: "Catalan",
  ar: "Arabic",
  zh: "Chinese",
}

function mapUserLangToIso(userLang: string | undefined | null): string | null {
  if (!userLang) return null
  const upper = userLang.toUpperCase().trim()
  if (USER_LANG_TO_ISO[upper]) return USER_LANG_TO_ISO[upper]
  // Fall back to the 2-letter form if the DB already stored an ISO code.
  if (upper.length === 2) return upper.toLowerCase()
  return null
}
