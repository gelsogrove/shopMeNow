import { PrismaClient } from "@prisma/client"
import { Request, Response } from "express"
import { config } from "../../../config"
import { MessageRepository } from "../../../repositories/message.repository"
import { usageService } from "../../../services/usage.service"
import logger from "../../../utils/logger"

export class ChatController {
  private messageRepository: MessageRepository
  private prisma: PrismaClient

  constructor() {
    this.messageRepository = new MessageRepository()
    this.prisma = new PrismaClient()
    logger.info("ChatController initialized")
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

      // Get chat session details including workspace information
      const chatSession = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          ...(workspaceId ? { workspaceId } : {}),
        },
        include: {
          customer: true,
          workspace: {
            select: {
              id: true,
              name: true,
              isActive: true,
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

      if (!sessionId) {
        res.status(400).json({
          success: false,
          error: "Session ID is required",
        })
        return
      }

      // Pass the workspaceId to the repository method for proper filtering
      const messages = await this.messageRepository.getChatSessionMessages(
        sessionId,
        workspaceId
      )

      if (messages.length === 0 && workspaceId) {
        // If no messages found and workspace ID was provided, it could mean the chat session doesn't belong to this workspace
        res.status(404).json({
          success: false,
          error:
            "Chat session not found in this workspace or no messages available",
        })
        return
      }

      // Mark messages as read when they are viewed
      await this.messageRepository.markMessagesAsRead(sessionId)

      res.status(200).json({
        success: true,
        data: messages,
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
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params
      const { content, sender } = req.body
      const workspaceId = (req as any).workspaceId

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

      logger.info(
        `[CHAT-SEND] 📱 Sending operator message in session ${sessionId}: "${content}"`
      )

      // Find the chat session and check if chatbot is active
      const chatSession = await this.prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          workspaceId: workspaceId,
        },
        include: {
          customer: true,
        },
      })

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

      // Save the operator message to chat history with proper metadata
      // For operator messages, we create only ONE outbound message directly
      const savedMessage = await this.prisma.message.create({
        data: {
          chatSessionId: sessionId,
          content: content,
          direction: "OUTBOUND",
          type: "TEXT",
          aiGenerated: false,
          metadata: {
            isOperatorMessage: true,
            sentBy: "HUMAN_OPERATOR",
            agentSelected: "MANUAL_OPERATOR",
          },
        },
      })

      logger.info(
        `[CHAT-SEND] ✅ Operator message saved to database successfully`
      )

      // 🛡️ IMPORTANT: Pass operator message through Safety & Translation
      // This ensures security validation even for manual messages
      let finalMessage = content
      try {
        const {
          SafetyTranslationAgent,
        } = require("../../../application/agents/SafetyTranslationAgent")
        const safetyAgent = new SafetyTranslationAgent()

        const safetyResult = await safetyAgent.process(
          content,
          chatSession.customer.language || "it",
          workspaceId,
          {
            customerName: chatSession.customer.name || "Cliente",
            allowedLinks: [], // Operator messages typically don't have tokens
          }
        )

        if (!safetyResult.safe) {
          logger.warn(
            `[CHAT-SEND] ⚠️ Safety check blocked operator message:`,
            safetyResult.blockedReason
          )
          // Use blocked message instead
          finalMessage = safetyResult.translatedText
        } else {
          // Use translated/validated message
          finalMessage = safetyResult.translatedText
        }

        logger.info(
          `[CHAT-SEND] ✅ Message passed through Safety & Translation`
        )
      } catch (safetyError) {
        logger.warn(
          `[CHAT-SEND] ⚠️ Safety layer failed, using original message:`,
          safetyError.message
        )
        // Continue with original message if safety fails
      }

      // Track usage cost for manual operator response (€0.005)
      try {
        await usageService.trackUsage({
          workspaceId: workspaceId,
          clientId: chatSession.customer.id,
          price: config.llm.defaultPrice,
        })
        logger.info(
          `[CHAT-SEND] 💰 Usage tracked for operator response: €${config.llm.defaultPrice}`
        )
      } catch (usageError) {
        logger.warn(
          `[CHAT-SEND] ⚠️ Usage tracking failed (message still saved):`,
          usageError.message
        )
        // Continue - message is saved even if usage tracking fails
      }

      // Try to send the message via WhatsApp (use finalMessage after safety check)
      try {
        await this.sendWhatsAppMessage(
          chatSession.customer.phone || "",
          finalMessage, // Use validated/translated message
          workspaceId
        )
        logger.info(`[CHAT-SEND] ✅ WhatsApp message sent successfully`)
      } catch (whatsappError) {
        logger.warn(
          `[CHAT-SEND] ⚠️ WhatsApp sending failed (message still saved):`,
          whatsappError.message
        )
        // Continue - message is saved even if WhatsApp fails
      }

      logger.info(`[CHAT-SEND] ✅ Operator message processing completed`)

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
   * Send a WhatsApp message (copied from WhatsAppController)
   */
  private async sendWhatsAppMessage(
    phoneNumber: string,
    message: string,
    workspaceId: string
  ): Promise<void> {
    try {
      logger.info(
        `[WHATSAPP-SEND] 📱 Sending message to ${phoneNumber}: "${message}"`
      )

      // Get workspace WhatsApp settings
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          whatsappApiKey: true,
          whatsappPhoneNumber: true,
        },
      })

      if (!workspace || !workspace.whatsappApiKey) {
        throw new Error(
          `WhatsApp settings not found for workspace ${workspaceId}`
        )
      }

      // Send message via WhatsApp Business API
      const whatsappApiUrl = `https://graph.facebook.com/v18.0/${workspace.whatsappPhoneNumber}/messages`

      const whatsappPayload = {
        messaging_product: "whatsapp",
        to: phoneNumber.replace("+", ""),
        type: "text",
        text: {
          body: message,
        },
      }

      const response = await fetch(whatsappApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${workspace.whatsappApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(whatsappPayload),
      })

      if (!response.ok) {
        const errorData = await response.text()
        throw new Error(
          `WhatsApp API error: ${response.status} ${response.statusText} - ${errorData}`
        )
      }

      const responseData = await response.json()
      logger.info(`[WHATSAPP-SEND] ✅ Message sent successfully:`, responseData)
    } catch (error) {
      logger.error(`[WHATSAPP-SEND] ❌ Error sending WhatsApp message:`, error)
      throw error
    }
  }
}
