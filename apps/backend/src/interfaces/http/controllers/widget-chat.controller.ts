/**
 * Widget Chat Controller
 * Handles widget chat requests (send message + polling)
 * 
 * Endpoints:
 * - POST /api/v1/widget/chat/:workspaceId - Send message
 * - GET /api/v1/widget/poll/:messageId - Poll for response
 */

import { Request, Response } from "express"
import { prisma, PrismaClient } from "@echatbot/database"
import logger from "../../../utils/logger"
import { VisitorIdService } from "../../../application/services/visitor-id.service"
import { SecurityCheckService } from "../../../application/services/security-check.service"
import { LLMRouterService } from "../../../services/llm-router.service"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import {
  WIDGET_MESSAGE_SCHEMA,
  type WidgetMessageInput,
} from "../schemas/widget.schemas"

const llmRouterService = new LLMRouterService(prisma)

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

      const { visitorId, message, sessionId, language } = validation.data
      const requestedLanguage = this.normalizeLanguage(language)

      logger.info("📨 Widget message received", {
        workspaceId,
        visitorId,
        messageLength: message.length,
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

      // Verify workspace exists and is active
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          isActive: true,
          channelStatus: true,
          ownerId: true,
          language: true,
          debugMode: true,
          wipMessage: true, // 🚧 For WIP mode response
        },
      })

      if (!workspace) {
        return res.status(404).json({
          error: "WORKSPACE_NOT_FOUND",
          message: "Workspace not found",
        })
      }


      // � Debug Mode (debugMode = true): Return WIP message (system in test mode)
      if (workspace.debugMode === true) {
        logger.info("🐛 Debug Mode - returning wipMessage (system in test)", {
          workspaceId,
          visitorId,
        })
        
        // Extract WIP message in customer's language (or default)
        const wipMessageObj = workspace.wipMessage as Record<string, string> | null
        const requestedLanguage = (req.body.language as string)?.toLowerCase() || "it"
        const wipResponse = wipMessageObj?.[requestedLanguage] 
          || wipMessageObj?.it 
          || wipMessageObj?.en 
          || "Servizio temporaneamente non disponibile. Riprova più tardi."
        
        return res.status(200).json({
          success: true,
          status: "wip",
          response: wipResponse,
        })
      }

      if (!workspace.isActive) {
        return res.status(503).json({
          error: "SERVICE_UNAVAILABLE",
          message: "Chat service is temporarily unavailable",
          retryAfter: 3600000, // 1 hour
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

      // Find or create customer for this visitor
      logger.info("🔍 Finding or creating customer for visitor", { visitorId, workspaceId })
      let customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
          customId: visitorId,
        },
      })

      if (!customer) {
        // Create anonymous customer
        customer = await prisma.customers.create({
          data: {
            workspaceId,
            customId: visitorId,
            name: `Visitor ${visitorId.slice(-8)}`,
            email: `${visitorId}@visitor.local`,
            isActive: false, // Anonymous users are NOT registered
            language: requestedLanguage || workspace.language || "ENG",
          },
        })

        logger.info("👤 Created anonymous customer", {
          customerId: customer.id,
          visitorId,
        })
      } else if (requestedLanguage && customer.language !== requestedLanguage) {
        await prisma.customers.update({
          where: { id: customer.id },
          data: { language: requestedLanguage },
        })
        customer = { ...customer, language: requestedLanguage }
      }

      logger.info("✅ Customer ready", { customerId: customer.id, visitorId })

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
      // 🤖 Process message through LLM BEFORE saving to queue
      logger.info("🤖 Processing widget message through LLM", {
        workspaceId,
        visitorId,
        message: message.substring(0, 50) + "...",
      })

      const llmResult = await llmRouterService.routeMessage({
        workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        messageId: `widget-${visitorId}-${Date.now()}`,
        message,
        customerLanguage: requestedLanguage || customer.language || workspace.language || "ENG",
        customerName: customer.name,
        isSystemMessage: false,
      })

      logger.info("✅ LLM processing completed", {
        agentUsed: llmResult.agentUsed,
        tokensUsed: llmResult.tokensUsed,
        isBlocked: llmResult.isBlocked,
        responseLength: llmResult.response?.length,
      })

      // Determine status based on blocking
      const queueStatus: "sent" | "blocked" = llmResult.isBlocked ? "blocked" : "sent"

      // Create message in queue with LLM response already saved
      const queueMessage = await prisma.whatsAppQueue.create({
        data: {
          workspaceId,
          customerId: customer.id,
          phoneNumber: "", // Empty for widget
          messageContent: message,
          status: queueStatus,
          channel: "widget",
          visitorId,
          isAnonymous: true,
          expiresAt: VisitorIdService.getExpiryDate(visitorId),
          pollingAttempts: 0,
          responsePayload: {
            response: llmResult.response,
            agentUsed: llmResult.agentUsed,
            tokensUsed: llmResult.tokensUsed,
            isBlocked: llmResult.isBlocked,
            processedAt: new Date().toISOString(),
          },
          deliveredAt: new Date(),
        },
      })

      logger.info("✅ Message saved to queue", {
        messageId: queueMessage.id,
        workspaceId,
        visitorId,
        status: queueMessage.status,
      })

      if (!llmResult.isBlocked && workspace.ownerId) {
        try {
          const billingService = new SubscriptionBillingService(prisma)
          const billingResult = await billingService.deductOwnerWidgetMessageCredit(
            workspace.ownerId,
            workspaceId,
            queueMessage.id
          )
          if (!billingResult.success) {
            logger.warn("⚠️ Widget billing failed", {
              workspaceId,
              visitorId,
              error: billingResult.error,
            })
          }
        } catch (billingError) {
          logger.error("⚠️ Widget billing error", billingError)
        }
      }

      // Return response directly (immediate delivery)
      return res.status(200).json({
        success: true,
        messageId: queueMessage.id,
        sessionId: chatSession.id,
        response: llmResult.response || "Mi dispiace, non ho capito la tua richiesta.",
        status: "ready",
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
      const visitorId = req.headers["x-visitor-id"] as string
      const workspaceId = req.headers["x-workspace-id"] as string

      if (!visitorId || !workspaceId) {
        return res.status(400).json({
          error: "MISSING_HEADERS",
          message: "Missing x-visitor-id or x-workspace-id header",
        })
      }

      // Validate visitorId
      if (!VisitorIdService.validate(visitorId)) {
        return res.status(400).json({
          error: "INVALID_VISITOR_ID",
          message: "Invalid visitor ID format",
        })
      }

      // Find message
      const message = await prisma.whatsAppQueue.findUnique({
        where: { id: messageId },
      })

      if (!message) {
        return res.status(404).json({
          error: "MESSAGE_NOT_FOUND",
          message: "Message not found",
        })
      }

      // Verify ownership
      if (message.visitorId !== visitorId || message.workspaceId !== workspaceId) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Access denied",
        })
      }

      // Update polling attempts
      await prisma.whatsAppQueue.update({
        where: { id: messageId },
        data: {
          pollingAttempts: { increment: 1 },
          lastPolledAt: new Date(),
        },
      })

      // Check status
      if (message.status === "sent" || message.status === "delivered") {
        // Response ready
        return res.status(200).json({
          status: "ready",
          message: message.responsePayload
            ? (message.responsePayload as any).response
            : "Grazie per il tuo messaggio!",
          retryAfter: null,
          isComplete: true,
        })
      }

      if (message.status === "error" || message.status === "failed") {
        // Error occurred
        return res.status(200).json({
          status: "error",
          message: message.errorMessage || "Si è verificato un errore",
          retryAfter: 500,
          isComplete: false,
        })
      }

      // Check timeout (30 attempts = 15 seconds)
      if ((message.pollingAttempts ?? 0) >= 30) {
        return res.status(200).json({
          status: "error",
          message: "Timeout: risposta non disponibile",
          retryAfter: 500,
          isComplete: false,
        })
      }

      // Still pending
      return res.status(200).json({
        status: "pending",
        message: null,
        retryAfter: 500,
        isComplete: false,
      })
    } catch (error) {
      logger.error("❌ Error polling widget message", error)
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to poll message",
      })
    }
  }
}
