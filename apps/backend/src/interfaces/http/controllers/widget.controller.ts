import { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { CustomerService } from "../../../application/services/customer.service"
import { LLMRouterService } from "../../../services/llm-router.service"
import logger from "../../../utils/logger"
import { prisma } from "@echatbot/database"

/**
 * Widget Controller
 * Handles public widget API endpoints (no authentication required)
 * Security: Validates origin against workspace's websiteUrl
 */
export class WidgetController {
  constructor(
    private customerService: CustomerService,
    private llmRouterService: LLMRouterService
  ) {}

  /**
   * Validate request origin against workspace's websiteUrl
   * @returns true if origin is allowed, false otherwise
   */
  private async validateOrigin(
    req: Request,
    workspaceId: string
  ): Promise<{ isValid: boolean; origin: string | null; error?: string }> {
    const origin = req.headers.origin || req.headers.referer || null

    // Get workspace with websiteUrl
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { websiteUrl: true },
    })

    if (!workspace) {
      return { isValid: false, origin, error: "Workspace not found" }
    }

    // If no website URL configured, deny all (security by default)
    if (!workspace.websiteUrl || workspace.websiteUrl.trim().length === 0) {
      logger.warn(
        `⚠️ Widget request blocked: No website URL configured for workspace ${workspaceId}`
      )
      return {
        isValid: false,
        origin,
        error: "Widget not configured. Add Website URL in Settings → Basic → Website URL",
      }
    }

    const allowedUrl = workspace.websiteUrl.trim().toLowerCase()

    // If origin is missing, check if localhost is allowed (for development)
    if (!origin) {
      if (allowedUrl.includes("localhost") || allowedUrl.includes("127.0.0.1")) {
        logger.debug(`✅ Widget request allowed: No origin but localhost is permitted`)
        return { isValid: true, origin: "localhost" }
      }
      logger.warn(`⚠️ Widget request blocked: Missing origin header`)
      return { isValid: false, origin: null, error: "Origin header required" }
    }

    // Normalize origin for comparison
    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "")

    // Remove protocol for flexible matching
    const cleanAllowed = allowedUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    const cleanOrigin = normalizedOrigin.replace(/^https?:\/\//, "")
    
    // Check exact match or domain match
    const isAllowed = cleanOrigin === cleanAllowed || 
                      cleanOrigin.startsWith(cleanAllowed) ||
                      cleanOrigin.endsWith(cleanAllowed)

    if (isAllowed) {
      logger.debug(`✅ Widget request allowed from origin: ${origin}`)
      return { isValid: true, origin }
    }

    logger.warn(
      `⚠️ Widget request blocked: Origin ${origin} does not match website URL for workspace ${workspaceId}`
    )
    return {
      isValid: false,
      origin,
      error: `Origin not allowed. Current website URL: ${workspace.websiteUrl}`,
    }
  }

  /**
   * Send message from widget
   * PUBLIC endpoint - creates/finds customer by visitorId
   * Security: Validates origin against workspace's websiteUrl
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { workspaceId, visitorId, message, customerLanguage = "it" } = req.body

      // Validate required fields
      if (!workspaceId || !visitorId || !message) {
        return res.status(400).json({
          error: "Missing required fields: workspaceId, visitorId, message",
        })
      }

      // ========================================
      // SECURITY: Validate origin against allowed URLs
      // ========================================
      const originValidation = await this.validateOrigin(req, workspaceId)
      if (!originValidation.isValid) {
        logger.warn(
          `🚫 Widget request blocked from ${originValidation.origin || "unknown"} for workspace ${workspaceId}`
        )
        return res.status(403).json({
          error: "Origin not allowed",
          message: originValidation.error,
        })
      }

      logger.info(
        `🔌 Widget message from visitor ${visitorId} in workspace ${workspaceId} (origin: ${originValidation.origin})`
      )

      // Log the exact visitorId for debugging
      logger.info(`📝 Full visitorId: "${visitorId}" (length: ${visitorId.length}, type: ${typeof visitorId})`)

      // Validate that workspace exists
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
      })

      if (!workspace) {
        logger.error(`❌ Workspace not found: ${workspaceId}`)
        return res.status(400).json({
          error: `Invalid workspaceId: workspace not found`,
        })
      }

      // Find or create customer by visitorId
      const customer = await this.customerService.findOrCreateByVisitorId(
        workspaceId,
        visitorId
      )

      // Find or create conversation session
      let conversation = await prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          workspaceId,
          status: "active",
        },
      })

      if (!conversation) {
        conversation = await prisma.chatSession.create({
          data: {
            customerId: customer.id,
            workspaceId,
            status: "active",
          },
        })
      }

      // Create message ID
      const messageId = uuidv4()

      // Route message through LLM system (SAME flow as WhatsApp)
      const llmResponse = await this.llmRouterService.routeMessage({
        workspaceId,
        customerId: customer.id,
        conversationId: conversation.id,
        messageId,
        message,
        customerLanguage,
        customerName: customer.name || "Customer",
      })

      return res.json({
        success: true,
        response: llmResponse.response,
        customerId: customer.id,
      })
    } catch (error) {
      logger.error("❌ Widget message error:", error)
      return res.status(500).json({
        error: "Failed to process widget message",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * Convert anonymous visitor to registered customer
   * Called during registration form submission
   * Security: Validates origin against workspace's allowedExternalLinks
   */
  async convertVisitor(req: Request, res: Response) {
    try {
      const { workspaceId, visitorId, phone, firstName, lastName, email, language } =
        req.body

      // Validate required fields
      if (!workspaceId || !visitorId || !phone || !firstName || !lastName || !email) {
        return res.status(400).json({
          error:
            "Missing required fields: workspaceId, visitorId, phone, firstName, lastName, email",
        })
      }

      // ========================================
      // SECURITY: Validate origin against allowed URLs
      // ========================================
      const originValidation = await this.validateOrigin(req, workspaceId)
      if (!originValidation.isValid) {
        logger.warn(
          `🚫 Widget convert blocked from ${originValidation.origin || "unknown"} for workspace ${workspaceId}`
        )
        return res.status(403).json({
          error: "Origin not allowed",
          message: originValidation.error,
        })
      }

      logger.info(
        `🔄 Converting visitor ${visitorId} to customer in workspace ${workspaceId} (origin: ${originValidation.origin})`
      )

      // Convert visitor to customer
      const customer = await this.customerService.convertVisitorToCustomer(
        visitorId,
        {
          workspaceId,
          phone,
          firstName,
          lastName,
          email,
          language,
        }
      )

      logger.info(`✅ Visitor converted successfully: ${customer.id}`)

      return res.json({
        success: true,
        customerId: customer.id,
        message: "Visitor converted to customer successfully",
      })
    } catch (error) {
      logger.error("❌ Visitor conversion error:", error)
      return res.status(400).json({
        error: "Failed to convert visitor",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
