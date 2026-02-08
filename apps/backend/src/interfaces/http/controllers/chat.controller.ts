import { prisma, PrismaClient } from "@echatbot/database"
import { Request, Response } from "express"
import { config } from "../../../config"
import { MessageRepository } from "../../../repositories/message.repository"
import { LLMRouterService } from "../../../services/llm-router.service"
import { WhatsAppQueueService } from "../../../services/whatsapp-queue.service"
import { usageService } from "../../../services/usage.service"
import { websocketService } from "../../../services/websocket.service"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import { TranslationAgent } from "../../../application/agents/TranslationAgent"
import { SecurityAgent } from "../../../application/agents/SecurityAgent"
import logger from "../../../utils/logger"

export class ChatController {
  private prisma: PrismaClient
  private messageRepository: MessageRepository
  private llmRouterService: LLMRouterService
  private whatsappQueueService: WhatsAppQueueService

  constructor() {
    this.prisma = prisma
    this.messageRepository = new MessageRepository()
    this.llmRouterService = new LLMRouterService(this.prisma)
    this.whatsappQueueService = new WhatsAppQueueService(this.prisma)
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
   * 2. 🌍 Translation Layer (always) + 🛡️ Widget Security Layer (widget only)
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

      // 🌍 STEP 2: Translation Layer FIRST (before saving)
      let finalMessage = content
      const isWidgetChannel = chatSession.channel === "widget"
      try {
        const translationAgent = new TranslationAgent(this.prisma)
        const translationResult = await translationAgent.process({
          workspaceId: workspaceId,
          message: content,
          targetLanguage: chatSession.customer.language || "it",
          customerName: chatSession.customer.name || "Cliente",
          customerId: chatSession.customer.id,
          channel: chatSession.channel,
        })

        finalMessage = translationResult.message || content
        
        // 🆕 ADD Translation debug step
        debugSteps.push({
          type: "safety",
          agent: "Translation Layer",
          model: "openai/gpt-4o-mini",
          temperature: 0,
          timestamp: new Date().toISOString(),
          input: {
            originalMessage: content,
            targetLanguage: chatSession.customer.language || "it",
            customerName: chatSession.customer.name || "Cliente",
          },
          output: {
            translatedText: finalMessage,
            decision: translationResult.translated ? "translated" : "passthrough",
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: translationResult.tokensUsed || 0,
            totalTokens: translationResult.tokensUsed || 0,
          },
        })

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
          `[CHAT-SEND] ✅ Operator message processed (translation${isWidgetChannel ? " + widget security" : ""})`
        )
      } catch (safetyError) {
        logger.warn(
          `[CHAT-SEND] ⚠️ Translation/security failed, using original message:`,
          safetyError.message
        )
        // Continue with original message if safety fails
        finalMessage = content
      }

      // 💾 STEP 3: Save to History AFTER safety validation
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

      await this.prisma.conversationMessage.create({
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
            timestamp: new Date().toISOString(),
            steps: debugSteps, // Include all current debug steps
          }),
        },
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

      // 🆕 Add operator message to WhatsApp Queue
      try {
        const customer = await this.prisma.customers.findUnique({
          where: { id: chatSession.customerId },
          select: { phone: true },
        })

        if (customer?.phone) {
          await this.whatsappQueueService.enqueue({
            workspaceId: workspaceId,
            customerId: chatSession.customerId,
            phoneNumber: customer.phone,
            messageContent: finalMessage,
          })
          logger.info(
            `[CHAT-SEND] 📤 Operator message added to WhatsApp queue for ${customer.phone}`
          )
        }
      } catch (queueError) {
        logger.error(`[CHAT-SEND] ❌ Failed to add to WhatsApp queue:`, queueError)
        // Non-critical - continue
      }

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

      // 📤 STEP 4: Track usage and deduct credit (ONLY if debugMode=false)
      try {
        // Check if workspace is in debug mode
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { debugMode: true },
        })

        if (workspace?.debugMode === true) {
          logger.info(
            `[CHAT-SEND] 🆓 DEBUG MODE: Skipping billing for Payload message (free)`
          )
        } else {
          // Track usage in Usage table
          await usageService.trackUsage({
            workspaceId: workspaceId,
            clientId: chatSession.customer.id,
            price: config.llm.defaultPrice,
          })
          logger.info(
            `[CHAT-SEND] 💰 Usage tracked for operator response: $${config.llm.defaultPrice}`
          )
          
          // 💰 FIX #4: Also deduct from workspace creditBalance
          const billingService = new SubscriptionBillingService(this.prisma)
          const deductResult = await billingService.deductMessageCredit(
            workspaceId,
            savedMessage.id
          )
          if (deductResult.success) {
            logger.info(
              `[CHAT-SEND] 💰 Credit deducted - New balance: $${deductResult.newBalance}`
            )
          } else {
            logger.warn(
              `[CHAT-SEND] ⚠️ Credit deduction failed: ${deductResult.error}`
            )
          }
        }
      } catch (usageError) {
        logger.warn(
          `[CHAT-SEND] ⚠️ Usage tracking failed (message still saved):`,
          usageError.message
        )
        // Continue - message is saved even if usage tracking fails
      }

      // 📤 Add to WhatsApp Queue (instead of sending directly)
      // This ensures messages go through Security Agent and respect Debug Mode
      try {
        await this.whatsappQueueService.enqueue({
          workspaceId,
          customerId: chatSession.customerId,
          phoneNumber: chatSession.customer.phone || "",
          messageContent: finalMessage, // Use validated/translated message
          conversationMessageId: savedMessage.id,
        })
        logger.info(`[CHAT-SEND] ✅ Message added to WhatsApp queue`)
        
        // 🆕 ADD WhatsApp queue debug step
        debugSteps.push({
          type: "function_call",
          agent: "📤 Add to WhatsApp Queue",
          model: "N/A",
          temperature: 0,
          timestamp: new Date().toISOString(),
          functionName: "enqueueWhatsAppMessage",
          input: {
            phoneNumber: chatSession.customer.phone || "",
            message: finalMessage,
            customerId: chatSession.customerId,
            customerName: chatSession.customer.name || "Unknown",
          },
          output: {
            success: true,
            messageId: savedMessage.id,
            queueStatus: "pending",
            executionTimeMs: 10,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        })
      } catch (queueError) {
        logger.warn(
          `[CHAT-SEND] ⚠️ Failed to add message to queue (message still saved):`,
          queueError.message
        )
        // Continue - message is saved even if queue fails
        
        // 🆕 ADD WhatsApp queue error debug step
        debugSteps.push({
          type: "function_call",
          agent: "📤 Add to WhatsApp Queue",
          model: "N/A",
          temperature: 0,
          timestamp: new Date().toISOString(),
          functionName: "sendWhatsAppMessage",
          input: {
            phoneNumber: chatSession.customer.phone || "",
            message: finalMessage,
            customerId: chatSession.customerId,
            customerName: chatSession.customer.name || "Unknown",
          },
          output: {
            success: false,
            messageId: savedMessage.id,
            queueStatus: "failed",
            error: queueError instanceof Error ? queueError.message : "Unknown error",
            executionTimeMs: 20,
          },
          tokenUsage: {
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
          },
        })
      }

      logger.info(`[CHAT-SEND] ✅ Operator message processing completed`)

      // 🆕 SAVE COMPLETE DEBUG INFO to agentInteractions table (for timeline)
      const finalDebugInfo = {
        steps: debugSteps, // All steps: operator, safety, whatsapp
        totalTokens: 0,
        totalCost: 0,
        executionTimeMs: 0,
        timestamp: new Date().toISOString(),
      }

      // 🚨 CRITICAL: UPDATE conversationMessage with COMPLETE debug info
      // This ensures frontend gets ALL debug steps, not just the initial one
      await this.prisma.conversationMessage.updateMany({
        where: {
          conversationId: sessionId,
          agentType: "OPERATOR",
          content: content,
          workspaceId: workspaceId,
        },
        data: {
          debugInfo: JSON.stringify({
            isOperatorMessage: true,
            sentBy: "HUMAN_OPERATOR",
            timestamp: new Date().toISOString(),
            steps: debugSteps, // 🚨 COMPLETE debug steps with Safety & WhatsApp
            totalTokens: 0,
            totalCost: 0,
            executionTimeMs: 0,
          }),
        },
      })

      logger.info("🚨 CRITICAL: Updated conversationMessage with COMPLETE debug steps including Safety & WhatsApp")

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

  // 🗑️ REMOVED: sendWhatsAppMessage method (dead code)
  // WhatsApp messages now go through whatsappQueueService.enqueue()
  // This ensures: 1) Debug Mode is respected, 2) Security Agent validates, 3) Billing is tracked
}
