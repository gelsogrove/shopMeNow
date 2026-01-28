/**
 * Widget Chat Controller
 * Handles widget chat requests (send message + polling)
 * 
 * Endpoints:
 * - POST /api/v1/widget/chat/:workspaceId - Send message
 * - GET /api/v1/widget/poll/:messageId - Poll for response
 */

import { Request, Response } from "express"
import { prisma, PrismaClient, AgentType } from "@echatbot/database"
import logger from "../../../utils/logger"
import { VisitorIdService } from "../../../application/services/visitor-id.service"
import { SecurityCheckService } from "../../../application/services/security-check.service"
import { LLMRouterService } from "../../../services/llm-router.service"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import { WorkspaceAccessService } from "../../../application/services/workspace-access.service"
import { WelcomeMessageHandler } from "../../../utils/welcome-message.handler"
import { detectLanguageFromHeader } from "../../../utils/email-templates"
import { detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
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
          widgetPrimaryColor: true, // 🎨 Widget color
          widgetIcon: true, // 🎨 Widget icon
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

      // 🚫 channelStatus=false = total shutdown (no WIP)
      if (workspace.channelStatus === false) {
        return res.status(200).json({
          success: true,
          status: "disabled",
          channelStatus: false,
          debugMode: workspace.debugMode ?? false,
          message: "Channel is disabled",
        })
      }

      if (workspace.debugMode === true) {
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
        primaryColor: workspace.widgetPrimaryColor || "#22c55e", // 🎨 Widget color
        icon: workspace.widgetIcon || "sparkles", // 🎨 Widget icon
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

      const { visitorId, message, sessionId, language, phoneNumber, isPlayground } = validation.data
      
      // 🌍 Language detection priority:
      // 1. Explicit language from widget body/API (if provided) - HIGHEST PRIORITY! ✅
      // 2. Phone number prefix (if provided) - second priority 📱
      // 3. Accept-Language HTTP header (browser preference) 🌐
      // 4. Customer's saved language (if exists) 💾
      // 5. Workspace default language 🏢
      // 6. Italian (system default) 🇮🇹
      
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
            phone: phoneNumber || undefined, // 📱 Save phone if provided (playground scenario)
            isActive: false, // Anonymous users are NOT registered
            language: requestedLanguage || workspace.language || "ENG",
          },
        })

        logger.info("👤 Created anonymous customer", {
          customerId: customer.id,
          visitorId,
          phone: phoneNumber || '(none)',
          language: customer.language,
        })
      } else if (requestedLanguage && customer.language !== requestedLanguage) {
        // Update language if changed (respects priority: explicit > phone > browser)
        const oldLanguage = customer.language
        const updateData: any = { language: requestedLanguage }
        
        // Update phone if provided and not set yet
        if (phoneNumber && !customer.phone) {
          updateData.phone = phoneNumber
        }
        
        await prisma.customers.update({
          where: { id: customer.id },
          data: updateData,
        })
        customer = { ...customer, ...updateData }
        logger.info("🌍 Updated customer", {
          customerId: customer.id,
          oldLanguage,
          newLanguage: requestedLanguage,
          phoneUpdated: !!phoneNumber && !customer.phone,
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
        channel: "widget",
      })

      if (welcomeResult.isWelcomeMessage) {
        // No queue for widget: respond immediately
        return res.status(200).json({
          success: true,
          messageId: `widget-${visitorId}-${Date.now()}`,
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

      // 🌍 DEBUG: Log language BEFORE calling LLM Router
      const customerLanguage = requestedLanguage || customer.language || workspace.language || "ENG"
      logger.info("🌍 Widget calling LLM Router with language", {
        requestedLanguage,
        customerLanguage,
        customerStoredLanguage: customer.language,
        workspaceLanguage: workspace.language,
        workspaceId,
        customerId: customer.id,
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
      })

      logger.info("✅ LLM processing completed", {
        agentUsed: llmResult.agentUsed,
        tokensUsed: llmResult.tokensUsed,
        isBlocked: llmResult.isBlocked,
        responseLength: llmResult.response?.length,
      })

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
                `[WIDGET-BILLING] 💰 Widget message charged: $0.005 deducted. New balance: $${billingResult.newBalance.toFixed(3)}`
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
}
