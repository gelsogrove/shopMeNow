import { PrismaClient } from "@prisma/client"
import logger from "../../utils/logger"
import { SecureTokenService } from "./secure-token.service"

/**
 * Service for replacing campaign tokens with secure URLs
 * Handles [FEEDBACK], [ORDER_REVIEW], and other dynamic tokens
 */
export class CampaignTokenService {
  private secureTokenService: SecureTokenService

  constructor(private prisma: PrismaClient) {
    this.secureTokenService = new SecureTokenService()
  }

  /**
   * Replace all tokens in message with actual URLs
   *
   * Supported tokens:
   * - [FEEDBACK] → https://shop.com/feedback?token=xxx
   * - [ORDER_REVIEW] → https://shop.com/order-review?token=xxx
   * - {{nome}} → Customer name
   * - {{email}} → Customer email
   *
   * @param message Original message with tokens
   * @param customerId Customer ID for token generation
   * @param workspaceId Workspace ID
   * @param campaignId Campaign ID (optional)
   * @returns Message with replaced tokens
   */
  async replaceTokens(
    message: string,
    customerId: string,
    workspaceId: string,
    campaignId?: string
  ): Promise<{ message: string; tokensUsed: string[] }> {
    try {
      let processedMessage = message
      const tokensUsed: string[] = []

      // Get customer data for variable replacement
      const customer = await this.prisma.customers.findUnique({
        where: { id: customerId },
        select: {
          name: true,
          email: true,
          phone: true,
        },
      })

      if (!customer) {
        throw new Error(`Customer ${customerId} not found`)
      }

      // Replace customer variables
      processedMessage = processedMessage.replace(
        /\{\{nome\}\}/gi,
        customer.name || "Cliente"
      )
      processedMessage = processedMessage.replace(
        /\{\{email\}\}/gi,
        customer.email || ""
      )
      processedMessage = processedMessage.replace(
        /\{\{telefono\}\}/gi,
        customer.phone || ""
      )

      // Replace [FEEDBACK] token
      if (processedMessage.includes("[FEEDBACK]")) {
        const feedbackToken = await this.secureTokenService.createToken(
          "any", // Type for campaign tokens
          workspaceId,
          { campaignId, type: "FEEDBACK" }, // Payload
          "2160h", // 90 days = 2160 hours
          undefined, // userId
          customer.phone || undefined, // phoneNumber
          undefined, // ipAddress
          customerId
        )

        const feedbackUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/feedback?token=${feedbackToken}`
        processedMessage = processedMessage.replace(
          /\[FEEDBACK\]/g,
          feedbackUrl
        )
        tokensUsed.push("FEEDBACK")

        logger.info(
          `Generated FEEDBACK token for customer ${customerId}, campaign ${campaignId}`
        )
      }

      // Replace [ORDER_REVIEW] token
      if (processedMessage.includes("[ORDER_REVIEW]")) {
        const reviewToken = await this.secureTokenService.createToken(
          "any",
          workspaceId,
          { campaignId, type: "ORDER_REVIEW" },
          "720h", // 30 days
          undefined,
          customer.phone || undefined,
          undefined,
          customerId
        )

        const reviewUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/order-review?token=${reviewToken}`
        processedMessage = processedMessage.replace(
          /\[ORDER_REVIEW\]/g,
          reviewUrl
        )
        tokensUsed.push("ORDER_REVIEW")

        logger.info(`Generated ORDER_REVIEW token for customer ${customerId}`)
      }

      // Replace [CAMPAIGN_LINK] token (generic link)
      if (processedMessage.includes("[CAMPAIGN_LINK]")) {
        const campaignToken = await this.secureTokenService.createToken(
          "any",
          workspaceId,
          { campaignId, type: "CAMPAIGN_LINK" },
          "4320h", // 180 days
          undefined,
          customer.phone || undefined,
          undefined,
          customerId
        )

        const campaignUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/campaign?token=${campaignToken}`
        processedMessage = processedMessage.replace(
          /\[CAMPAIGN_LINK\]/g,
          campaignUrl
        )
        tokensUsed.push("CAMPAIGN_LINK")
      }

      return {
        message: processedMessage,
        tokensUsed,
      }
    } catch (error) {
      logger.error("Error replacing campaign tokens:", error)
      throw new Error("Failed to replace campaign tokens")
    }
  }

  /**
   * Track token click (when customer clicks on link)
   */
  async trackTokenClick(token: string, campaignSentId: string): Promise<void> {
    try {
      await this.prisma.campaignSent.update({
        where: { id: campaignSentId },
        data: { clickedAt: new Date() },
      })

      logger.info(`Token click tracked for campaign sent ${campaignSentId}`)
    } catch (error) {
      logger.error(`Error tracking token click for ${campaignSentId}:`, error)
      // Non-critical error, don't throw
    }
  }
}
