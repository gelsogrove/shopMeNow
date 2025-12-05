import { prisma } from "@echatbot/database"
import { Request, Response } from "express"
import { LLMRouterService } from "../../../services/llm-router.service"
import logger from "../../../utils/logger"

/**
 * System notification types
 */
export enum SystemNotificationType {
  CHATBOT_REACTIVATED = "CHATBOT_REACTIVATED",
  ACCOUNT_ACTIVATED = "ACCOUNT_ACTIVATED",
  DISCOUNT_CHANGED = "DISCOUNT_CHANGED",
}

/**
 * Notification message templates (Italian base language)
 * Will be translated by SafetyTranslationAgent to customer's language
 */
const NOTIFICATION_TEMPLATES: Record<
  SystemNotificationType,
  (data: any) => string
> = {
  [SystemNotificationType.CHATBOT_REACTIVATED]: (data) =>
    `🤖 Ciao ${data.customerName}, il chatbot è ora disponibile, come posso aiutarti oggi?`,

  [SystemNotificationType.ACCOUNT_ACTIVATED]: (data) =>
    `👋 Benvenuto ${data.customerName}! Il tuo account è ora attivo. Puoi iniziare a fare acquisti.`,

  [SystemNotificationType.DISCOUNT_CHANGED]: (data) =>
    `💸 Ciao ${data.customerName}! Da oggi puoi usufruire del ${data.discountPercentage}% di sconto sui nostri prodotti.`,
}

/**
 * Controller for push notification operations
 */
export class PushController {
  private prisma: PrismaClient
  private llmRouterService: LLMRouterService

  constructor(prisma?: PrismaClient, llmRouterService?: LLMRouterService) {
    this.prisma = prisma
    this.llmRouterService =
      llmRouterService || new LLMRouterService(this.prisma)
  }
  /**
   * Send system notification to customers
   *
   * Unified endpoint for all system notifications:
   * - CHATBOT_REACTIVATED: When admin enables chatbot
   * - ACCOUNT_ACTIVATED: When admin activates a new customer
   * - DISCOUNT_CHANGED: When admin changes customer discount percentage
   *
   * @route POST /workspaces/:workspaceId/push/system-notification
   * @param req - Express request with workspaceId in params, type, customerIds, templateData in body
   * @param res - Express response
   * @returns Success response with sent/failed counts
   */
  async sendSystemNotification(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params
      const { type, customerIds, templateData = {} } = req.body

      // Validation
      if (
        !workspaceId ||
        !type ||
        !customerIds ||
        !Array.isArray(customerIds)
      ) {
        logger.error("[PUSH-CONTROLLER] Validation failed", {
          hasWorkspaceId: !!workspaceId,
          hasType: !!type,
          hasCustomerIds: !!customerIds,
          isArray: Array.isArray(customerIds),
        })
        return res.status(400).json({
          error: "Invalid request",
          message: "workspaceId, type, and customerIds array are required",
        })
      }

      // Validate notification type
      if (!Object.values(SystemNotificationType).includes(type)) {
        logger.error(`[PUSH-CONTROLLER] Invalid notification type: ${type}`)
        return res.status(400).json({
          error: "Invalid notification type",
          message: `Type must be one of: ${Object.values(SystemNotificationType).join(", ")}`,
        })
      }

      logger.info(
        `[PUSH-CONTROLLER] 🚀 Sending ${type} notification to ${customerIds.length} customer(s) in workspace ${workspaceId}`
      )

      const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[],
      }

      // Send notification to each customer
      for (const customerId of customerIds) {
        try {
          // Fetch customer data with workspace isolation
          const customer = await this.prisma.customers.findUnique({
            where: { id: customerId, workspaceId },
            select: {
              id: true,
              phone: true,
              name: true,
              language: true,
            },
          })

          if (!customer) {
            results.failed++
            results.errors.push(`Customer ${customerId}: Not found`)
            logger.warn(
              `[PUSH-CONTROLLER] Customer ${customerId} not found in workspace ${workspaceId}`
            )
            continue
          }

          if (!customer.phone) {
            results.failed++
            results.errors.push(
              `Customer ${customer.name}: Missing phone number`
            )
            logger.warn(
              `[PUSH-CONTROLLER] Customer ${customer.name} has no phone number`
            )
            continue
          }

          // Get or create chat session
          let chatSession = await this.prisma.chatSession.findFirst({
            where: {
              customerId: customer.id,
              workspaceId,
              status: "active",
            },
          })

          if (!chatSession) {
            chatSession = await this.prisma.chatSession.create({
              data: {
                customerId: customer.id,
                workspaceId,
                status: "active",
                context: {},
              },
            })
          }

          // Generate message from template (Italian base language)
          const messageTemplate =
            NOTIFICATION_TEMPLATES[type as SystemNotificationType]
          const notificationMessage = messageTemplate({
            customerName: customer.name,
            ...templateData,
          })

          const result = await this.llmRouterService.routeMessage({
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            messageId: `system-${type.toLowerCase()}-${Date.now()}`,
            message: notificationMessage,
            customerLanguage: customer.language,
            customerName: customer.name,
            isSystemMessage: true,
          })

          if (result.isBlocked) {
            results.failed++
            results.errors.push(
              `Customer ${customer.name}: Message blocked by security`
            )
            logger.warn(
              `[PUSH-CONTROLLER] Notification blocked for ${customer.name}`
            )
          } else {
            results.sent++
          }
        } catch (error) {
          logger.error(
            `[PUSH-CONTROLLER] Error processing customer ${customerId}:`,
            error
          )
          results.failed++
          results.errors.push(
            `Customer ${customerId}: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        }
      }

      return res.status(200).json({
        success: true,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors,
      })
    } catch (error) {
      logger.error("[PUSH-CONTROLLER] Error in sendSystemNotification:", error)
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
