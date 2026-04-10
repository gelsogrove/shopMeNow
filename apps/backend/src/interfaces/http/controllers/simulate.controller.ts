import { Request, Response } from "express"
import { prisma } from "../../../lib/prisma"
import { getChatEngine } from "../../../application/chat-engine"
import { detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
import { buildPhoneVariants } from "../../../utils/phone"
import logger from "../../../utils/logger"

/**
 * SimulateController
 *
 * Allows Claude MCP to run multi-turn conversations against a real workspace
 * without touching real customers. Test customers are prefixed with "test_".
 *
 * Used exclusively by the echatbot MCP server for automated scenario testing.
 */
export class SimulateController {
  /**
   * POST /api/v1/workspaces/:workspaceId/simulate
   *
   * Processes a single message turn in a simulated conversation.
   * - Creates a test customer if not found (phone must be fake)
   * - Finds or creates a chat session
   * - Runs the full ChatEngine pipeline
   * - Returns the bot response + sessionId for continuity
   */
  async simulateTurn(req: Request, res: Response): Promise<void> {
    const { workspaceId } = req.params
    const { customerPhone, customerName, isRegistered, message, sessionId } = req.body

    if (!customerPhone || !message) {
      res.status(400).json({ error: "customerPhone and message are required" })
      return
    }

    // Safety: only allow test_ prefix customers to prevent abuse
    const safeName = customerName || "test_unknown"
    if (!safeName.startsWith("test_")) {
      res.status(400).json({ error: "customerName must start with 'test_'" })
      return
    }

    try {
      // 1. Find or create the test customer
      const phoneVariants = buildPhoneVariants(customerPhone)
      let customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
          OR: phoneVariants.map((v) => ({ phone: v })),
        },
      })

      if (!customer) {
        customer = await prisma.customers.create({
          data: {
            workspaceId,
            phone: customerPhone,
            name: safeName,
            email: `${safeName}@test.simulate`,
            isActive: isRegistered ?? false,
            registrationStatus: isRegistered ? "ACTIVE" : "NEW",
            language: detectLanguageFromPhonePrefix(customerPhone) || "it",
          },
        })
        logger.info("[SIMULATE] ✅ Created test customer", { customerId: customer.id, phone: customerPhone })
      }

      // 2. Find or create chat session
      let chatSession = sessionId
        ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
        : null

      if (!chatSession) {
        chatSession = await prisma.chatSession.findFirst({
          where: { customerId: customer.id, status: "active" },
        })
      }

      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            workspaceId,
            customerId: customer.id,
            status: "active",
          },
        })
        logger.info("[SIMULATE] ✅ Created chat session", { sessionId: chatSession.id })
      }

      // 3. Run through ChatEngine (full real pipeline)
      const chatEngine = getChatEngine(prisma)
      const result = await chatEngine.routeMessage({
        workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        message,
        customerLanguage: customer.language || "it",
        customerName: customer.name,
        customerDiscount: customer.discount || 0,
        isPlayground: true, // 🧪 Skip billing in simulate mode
        channel: "whatsapp",
        registrationPromptLevel: 0,
      })

      res.json({
        sessionId: chatSession.id,
        customerId: customer.id,
        response: result.message || result.response || "",
        agentUsed: result.agentUsed || result.agentType,
        tokensUsed: result.tokensUsed,
        intent: result.intent,
        wasHandled: result.wasHandled,
      })
    } catch (error) {
      const err = error as Error
      logger.error("[SIMULATE] ❌ Error processing simulate turn", { error: err.message })
      res.status(500).json({ error: err.message })
    }
  }

  /**
   * DELETE /api/v1/workspaces/:workspaceId/customers/phone/:phone
   *
   * Deletes a test customer and all related data (sessions, messages).
   * Only allowed for test_ prefixed customers.
   */
  async deleteTestCustomer(req: Request, res: Response): Promise<void> {
    const { workspaceId, phone } = req.params
    const decodedPhone = decodeURIComponent(phone)

    try {
      const phoneVariants = buildPhoneVariants(decodedPhone)
      const customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
          OR: phoneVariants.map((v) => ({ phone: v })),
        },
        select: { id: true, name: true },
      })

      if (!customer) {
        res.status(404).json({ error: "Customer not found" })
        return
      }

      // Safety: only delete test_ customers
      if (!customer.name?.startsWith("test_")) {
        res.status(403).json({ error: "Can only delete test_ customers via this endpoint" })
        return
      }

      // Cascade delete related data
      const sessions = await prisma.chatSession.findMany({ where: { customerId: customer.id }, select: { id: true } })
      const sessionIds = sessions.map((s) => s.id)
      await prisma.conversationMessage.deleteMany({ where: { customerId: customer.id } })
      await prisma.message.deleteMany({ where: { chatSessionId: { in: sessionIds } } })
      await prisma.chatSession.deleteMany({ where: { customerId: customer.id } })
      await prisma.customers.delete({ where: { id: customer.id } })

      logger.info("[SIMULATE] 🗑️ Test customer deleted", { customerId: customer.id, phone: decodedPhone })
      res.json({ deleted: true, customerId: customer.id })
    } catch (error) {
      const err = error as Error
      logger.error("[SIMULATE] ❌ Error deleting test customer", { error: err.message })
      res.status(500).json({ error: err.message })
    }
  }
}

export const simulateController = new SimulateController()
