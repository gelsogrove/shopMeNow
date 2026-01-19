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
import { WelcomeMessageHandler } from "../../../utils/welcome-message.handler"
import { detectLanguageFromHeader } from "../../../utils/email-templates"
import {
  WIDGET_MESSAGE_SCHEMA,
  type WidgetMessageInput,
} from "../schemas/widget.schemas"

const llmRouterService = new LLMRouterService(prisma)
const welcomeMessageHandler = new WelcomeMessageHandler(prisma)

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

  private resolveWipMessage(
    rawMessage: Record<string, string> | string | null | undefined,
    requestedLanguage: string | null
  ): string {
    const wipMessageObj =
      typeof rawMessage === "object" && rawMessage !== null
        ? (rawMessage as Record<string, string>)
        : null
    const lang = (requestedLanguage || "it").toLowerCase()
    return (
      wipMessageObj?.[lang] ||
      wipMessageObj?.it ||
      wipMessageObj?.en ||
      (typeof rawMessage === "string" ? rawMessage : "") ||
      "Work in progress. Please contact us later."
    )
  }

  /**
   * GET /api/v1/widget/status/:workspaceId
   * Get widget availability status
   */
  async getStatus(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params
      const requestedLanguage = (req.query.language as string | undefined) || null

      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          deletedAt: true,
          channelStatus: true,
          ownerId: true,
          debugMode: true,
          wipMessage: true,
          widgetLanguage: true, // 🌍 Widget language configuration
          enableWidget: true, // 🚫 CRITICAL: Check if widget is enabled in workspace settings
        },
      })

      if (!workspace) {
        return res.status(404).json({
          success: false,
          status: "disabled",
          message: "Workspace not found",
        })
      }

      if (workspace.deletedAt !== null) {
        return res.status(200).json({
          success: true,
          status: "disabled",
          channelStatus: workspace.channelStatus ?? false,
          debugMode: workspace.debugMode ?? false,
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
          message: "Widget is disabled",
        })
      }

      if (workspace.debugMode === true || workspace.channelStatus === false) {
        const wipMessage = this.resolveWipMessage(
          workspace.wipMessage as Record<string, string> | string | null,
          requestedLanguage
        )
        return res.status(200).json({
          success: true,
          status: "wip",
          channelStatus: workspace.channelStatus ?? false,
          debugMode: workspace.debugMode ?? false,
          wipMessage,
        })
      }

      return res.status(200).json({
        success: true,
        status: "active",
        channelStatus: workspace.channelStatus ?? true,
        debugMode: workspace.debugMode ?? false,
        language: workspace.widgetLanguage || "it", // 🌍 Widget configured language
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
      
      // 🌍 Language detection priority:
      // 1. Explicit language from widget body (if provided)
      // 2. Accept-Language HTTP header (browser preference)
      // 3. Customer's saved language (if exists)
      // 4. Workspace default language
      // 5. Italian (system default)
      const acceptLanguageHeader = req.headers['accept-language']
      const browserLanguage = acceptLanguageHeader 
        ? detectLanguageFromHeader(acceptLanguageHeader)
        : null
      
      // Convert browser language (it/en/es/pt) to system format (ITA/ENG/ESP/PRT)
      const normalizedBrowserLang = browserLanguage 
        ? this.normalizeLanguage(browserLanguage)
        : null
      
      const requestedLanguage = this.normalizeLanguage(language) || normalizedBrowserLang

      logger.info("📨 Widget message received", {
        workspaceId,
        visitorId,
        messageLength: message.length,
        bodyLanguage: language || '(none)',
        acceptLanguageHeader: acceptLanguageHeader || '(none)',
        detectedFromHeader: browserLanguage || '(none)',
        finalLanguage: requestedLanguage || '(fallback to workspace/customer)'
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
          deletedAt: true,
          channelStatus: true,
          ownerId: true,
          language: true,
          debugMode: true,
          wipMessage: true, // 🚧 For WIP mode response
          enableWidget: true, // 🚫 CRITICAL: Check if widget is enabled in workspace settings
        },
      })

      if (!workspace) {
        return res.status(404).json({
          error: "WORKSPACE_NOT_FOUND",
          message: "Workspace not found",
        })
      }


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

      if (workspace.channelStatus === false || workspace.debugMode === true) {
        logger.info("🛠️ Widget WIP - channel disabled or debug mode", {
          workspaceId,
          visitorId,
          debugMode: workspace.debugMode,
          channelStatus: workspace.channelStatus,
        })

        const rawLanguage = (req.body.language as string)?.toLowerCase() || "it"
        const wipResponse = this.resolveWipMessage(
          workspace.wipMessage as Record<string, string> | string | null,
          rawLanguage
        )

        return res.status(200).json({
          success: true,
          status: "wip",
          response: wipResponse,
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
          language: customer.language,
        })
      } else if (requestedLanguage && customer.language !== requestedLanguage) {
        const oldLanguage = customer.language
        await prisma.customers.update({
          where: { id: customer.id },
          data: { language: requestedLanguage },
        })
        customer = { ...customer, language: requestedLanguage }
        logger.info("🌍 Updated customer language", {
          customerId: customer.id,
          oldLanguage,
          newLanguage: requestedLanguage,
        })
      } else {
        logger.info("👤 Using existing customer", {
          customerId: customer.id,
          visitorId,
          language: customer.language,
        })
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

      // 👋 Welcome message (first user message only)
      const welcomeResult = await welcomeMessageHandler.handleWelcomeMessage({
        customerId: customer.id,
        workspaceId,
        customerLanguage: requestedLanguage || customer.language || workspace.language || "ENG",
        customerMessage: message,
        conversationId: chatSession.id,
      })

      if (welcomeResult.isWelcomeMessage) {
        const queueMessage = await prisma.whatsAppQueue.create({
          data: {
            workspaceId,
            customerId: customer.id,
            phoneNumber: "",
            messageContent: message,
            status: "sent",
            channel: "widget",
            visitorId,
            isAnonymous: true,
            expiresAt: VisitorIdService.getExpiryDate(visitorId),
            pollingAttempts: 0,
            responsePayload: {
              response: welcomeResult.welcomeText,
              agentUsed: "WELCOME",
              tokensUsed: 0,
              isBlocked: false,
              processedAt: new Date().toISOString(),
            },
            deliveredAt: new Date(),
          },
        })

        if (workspace.ownerId) {
          try {
            const billingService = new SubscriptionBillingService(prisma)
            const billingResult = await billingService.deductOwnerWidgetMessageCredit(
              workspace.ownerId,
              workspaceId,
              queueMessage.id
            )
            if (!billingResult.success) {
              logger.warn("⚠️ Widget billing failed for welcome message", {
                workspaceId,
                visitorId,
                error: billingResult.error,
              })
            }
          } catch (billingError) {
            logger.error("⚠️ Widget billing error for welcome message", billingError)
          }
        }

        return res.status(200).json({
          success: true,
          messageId: queueMessage.id,
          sessionId: chatSession.id,
          response: welcomeResult.welcomeText || "Welcome!",
          status: "ready",
        })
      }

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
