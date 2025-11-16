import { PrismaClient } from "@prisma/client"
import { Request, Response } from "express"
import { LLMRouterService } from "../../../services/llm-router.service"
import logger from "../../../utils/logger"

const prisma = new PrismaClient()
const llmRouterService = new LLMRouterService(prisma)

/**
 * Controller for push notification operations
 */
export class PushController {
  /**
   * Send chatbot reactivation notification to customers
   *
   * @route POST /workspaces/:workspaceId/push/chatbot-reactivated
   * @param req - Express request with workspaceId in params, customerIds in body
   * @param res - Express response
   * @returns Success response with sent/failed counts
   */
  async sendChatbotReactivated(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params
      const { customerIds } = req.body

      // 🔍 DEBUG: Log EVERYTHING we received
      logger.info("[PUSH-CONTROLLER] 🔍 Full request details:", {
        url: req.url,
        method: req.method,
        params: req.params,
        body: req.body,
        paramsWorkspaceId: workspaceId,
        bodyCustomerIds: customerIds,
        bodyKeys: Object.keys(req.body || {}),
        isArray: Array.isArray(customerIds),
      })

      // Validation
      if (!workspaceId || !customerIds || !Array.isArray(customerIds)) {
        logger.error("[PUSH-CONTROLLER] ❌ Validation failed:", {
          hasWorkspaceId: !!workspaceId,
          hasCustomerIds: !!customerIds,
          isArray: Array.isArray(customerIds),
          bodyType: typeof req.body,
          bodyValue: req.body,
        })
        return res.status(400).json({
          error: "Invalid request",
          message: "workspaceId and customerIds array are required",
        })
      }

      logger.info(
        `[PUSH-CONTROLLER] 🚀 Sending chatbot reactivation notification to ${customerIds.length} customer(s) in workspace ${workspaceId}`
      )

      const results = {
        sent: 0,
        failed: 0,
        errors: [] as string[],
      }

      // Send notification to each customer
      for (const customerId of customerIds) {
        try {
          logger.info(
            `[PUSH-CONTROLLER] 📍 STEP 1: Fetching customer ${customerId}`
          )

          // Fetch customer data with workspace isolation
          const customer = await prisma.customers.findUnique({
            where: { id: customerId, workspaceId }, // ✅ Workspace isolation (Constitution Principle I)
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
              `[PUSH-CONTROLLER] ❌ STEP 1 FAILED: Customer ${customerId} not found in workspace ${workspaceId}`
            )
            continue
          }

          logger.info(
            `[PUSH-CONTROLLER] ✅ STEP 1 SUCCESS: Customer found - ${customer.name} (${customer.phone})`
          )

          if (!customer.phone) {
            results.failed++
            results.errors.push(
              `Customer ${customer.name}: Missing phone number`
            )
            logger.warn(
              `[PUSH-CONTROLLER] ❌ Customer ${customer.name} (${customerId}) has no phone number`
            )
            continue
          }

          logger.info(
            `[PUSH-CONTROLLER] 📍 STEP 2: Getting/creating chat session`
          )

          // Get or create chat session
          let chatSession = await prisma.chatSession.findFirst({
            where: {
              customerId: customer.id,
              workspaceId,
              status: "active",
            },
          })

          if (!chatSession) {
            chatSession = await prisma.chatSession.create({
              data: {
                customerId: customer.id,
                workspaceId,
                status: "active",
                context: {},
              },
            })
            logger.info(
              `[PUSH-CONTROLLER] ✅ STEP 2 SUCCESS: Created new chat session ${chatSession.id}`
            )
          } else {
            logger.info(
              `[PUSH-CONTROLLER] ✅ STEP 2 SUCCESS: Using existing chat session ${chatSession.id}`
            )
          }

          // Send chatbot reactivation notification via Router with isSystemMessage flag
          logger.info(
            `[PUSH-CONTROLLER] � STEP 3: Calling llmRouterService.routeMessage()`
          )

          // Message in Italian (base language) - will be translated by SafetyTranslationAgent
          const notificationMessage = `🤖 Ciao ${customer.name}, il chatbot è ora disponibile, come posso aiutarti oggi?`

          logger.info(`[PUSH-CONTROLLER] 📍 STEP 3 PARAMS:`, {
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            messageId: `system-notify-${Date.now()}`,
            message: notificationMessage,
            customerLanguage: customer.language,
            customerName: customer.name,
            isSystemMessage: true,
          })

          const result = await llmRouterService.routeMessage({
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            messageId: `system-notify-${Date.now()}`,
            message: notificationMessage,
            customerLanguage: customer.language,
            customerName: customer.name,
            isSystemMessage: true, // 🆕 Skip Router/SubLLM, go direct to Safety+Translation
          })

          logger.info(
            `[PUSH-CONTROLLER] ✅ STEP 3 SUCCESS: LLM Router returned response`
          )
          logger.info(`[PUSH-CONTROLLER] 📊 STEP 3 RESULT:`, {
            response: result.response,
            agentUsed: result.agentUsed,
            tokensUsed: result.tokensUsed,
            executionTimeMs: result.executionTimeMs,
          })

          if (result.isBlocked) {
            results.failed++
            results.errors.push(
              `Customer ${customer.name}: Message blocked by security`
            )
            logger.warn(
              `[PUSH-CONTROLLER] ⚠️ Notification blocked for ${customer.name}`
            )
          } else {
            results.sent++
            logger.info(
              `[PUSH-CONTROLLER] ✅ Notification sent to ${customer.name} (${customer.phone})`
            )
          }
        } catch (error) {
          logger.error(
            `[PUSH-CONTROLLER] ❌ Error processing customer ${customerId}:`,
            error
          )
          results.failed++
          results.errors.push(
            `Customer ${customerId}: ${error instanceof Error ? error.message : "Unknown error"}`
          )
        }
      }

      // Return results
      logger.info(
        `[PUSH-CONTROLLER] 📊 Results: ${results.sent} sent, ${results.failed} failed`
      )

      return res.status(200).json({
        success: true,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors,
      })
    } catch (error) {
      logger.error(
        "[PUSH-CONTROLLER] ❌ Error in sendChatbotReactivated:",
        error
      )
      return res.status(500).json({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
