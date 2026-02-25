/**
 * SupportChatController
 *
 * No-login operator handoff page endpoints.
 * Token-based (support_chat type, 48h, AES-256 encrypted).
 *
 * Endpoints:
 *  GET  /api/v1/support-chat/session?token=xxx  → customer info + last 50 messages
 *  POST /api/v1/support-chat/reply              → operator reply (channel-aware)
 *  POST /api/v1/support-chat/done               → re-enable chatbot
 */

// ============================================================================
// IMPORTS
// ============================================================================
import { Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import logger from "../../../utils/logger"

const secureTokenService = new SecureTokenService()

export class SupportChatController {
  // ----------------------------------------------------------------
  // GET /session?token=xxx
  // ----------------------------------------------------------------
  async getSession(req: Request, res: Response): Promise<void> {
    const { token } = req.query as { token?: string }

    if (!token) {
      res.status(400).json({ error: "token required" })
      return
    }

    try {
      // Validate token — no workspaceId restriction here so any workspace works
      const validation = await secureTokenService.validateToken(token)
      if (!validation.valid || !validation.data) {
        res.status(401).json({ error: "Token non valido o scaduto" })
        return
      }

      const { customerId, workspaceId } = validation.data as {
        customerId: string
        workspaceId: string
        type: string
        expiresAt: Date
        createdAt: Date
      }
      const payload = validation.payload as {
        customerId: string
        sessionId?: string
        channel?: string
      } | null

      if (!customerId || !workspaceId) {
        res.status(401).json({ error: "Token malformato" })
        return
      }

      // Fetch customer (workspace-isolated)
      const customer = await prisma.customers.findFirst({
        where: { id: customerId, workspaceId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          language: true,
          activeChatbot: true,
          originChannel: true,
          operatorRequestedAt: true,
        },
      })

      if (!customer) {
        res.status(404).json({ error: "Customer non trovato" })
        return
      }

      // Fetch active session (prefer sessionId from token payload)
      const sessionId = payload?.sessionId
      const session = sessionId
        ? await prisma.chatSession.findFirst({
            where: { id: sessionId, workspaceId },
          })
        : await prisma.chatSession.findFirst({
            where: { customerId, status: "active" },
            orderBy: { createdAt: "desc" },
          })

      // Fetch last 50 messages
      const messages = session
        ? await prisma.conversationMessage.findMany({
            where: { conversationId: session.id },
            orderBy: { createdAt: "asc" },
            take: 50,
          })
        : []

      res.json({
        customer,
        session: session ? { id: session.id } : null,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
        channel: customer.originChannel || payload?.channel || "widget",
        tokenMeta: {
          expiresAt: validation.data.expiresAt,
        },
      })
    } catch (error) {
      logger.error("[SupportChat] getSession error:", error)
      res.status(500).json({ error: "Server error" })
    }
  }

  // ----------------------------------------------------------------
  // POST /reply   body: { token, message }
  // ----------------------------------------------------------------
  async reply(req: Request, res: Response): Promise<void> {
    const { token, message } = req.body as { token?: string; message?: string }

    if (!token || !message?.trim()) {
      res.status(400).json({ error: "token e message sono obbligatori" })
      return
    }

    try {
      const validation = await secureTokenService.validateToken(token)
      if (!validation.valid || !validation.data) {
        res.status(401).json({ error: "Token non valido o scaduto" })
        return
      }

      const { customerId, workspaceId } = validation.data as {
        customerId: string
        workspaceId: string
      }
      const payload = validation.payload as {
        customerId: string
        sessionId?: string
        channel?: string
      } | null

      // Get customer + channel
      const customer = await prisma.customers.findFirst({
        where: { id: customerId, workspaceId },
        select: { id: true, phone: true, originChannel: true },
      })
      if (!customer) {
        res.status(404).json({ error: "Customer non trovato" })
        return
      }

      const channel = customer.originChannel || payload?.channel || "widget"

      // Find session
      const sessionId = payload?.sessionId
      const session = sessionId
        ? await prisma.chatSession.findFirst({ where: { id: sessionId, workspaceId } })
        : await prisma.chatSession.findFirst({
            where: { customerId, status: "active" },
            orderBy: { createdAt: "desc" },
          })

      if (channel === "whatsapp") {
        // Route via WhatsApp queue → customer's phone
        await prisma.whatsAppQueue.create({
          data: {
            workspaceId,
            customerId,
            phoneNumber: customer.phone,
            messageContent: message.trim(),
            status: "pending",
            channel: "whatsapp",
          },
        })
        logger.info("[SupportChat] reply queued via WhatsApp for customer:", customerId)
      } else {
        // Route via ConversationMessage (widget polling picks it up)
        if (!session) {
          res.status(404).json({ error: "Sessione non trovata" })
          return
        }
        await prisma.conversationMessage.create({
          data: {
            conversationId: session.id,
            customerId: customer.id,
            workspaceId: workspaceId as string,
            role: "assistant",
            content: message.trim(),
          },
        })
        logger.info("[SupportChat] reply saved to ConversationMessage for session:", session.id)
      }

      res.json({ success: true, channel })
    } catch (error) {
      logger.error("[SupportChat] reply error:", error)
      res.status(500).json({ error: "Server error" })
    }
  }

  // ----------------------------------------------------------------
  // POST /done   body: { token }
  // ----------------------------------------------------------------
  async done(req: Request, res: Response): Promise<void> {
    const { token } = req.body as { token?: string }

    if (!token) {
      res.status(400).json({ error: "token obbligatorio" })
      return
    }

    try {
      const validation = await secureTokenService.validateToken(token)
      if (!validation.valid || !validation.data) {
        res.status(401).json({ error: "Token non valido o scaduto" })
        return
      }

      const { customerId, workspaceId } = validation.data as {
        customerId: string
        workspaceId: string
      }

      // 🔀 RELAY TUNNEL: use OperatorRelayService to re-enable chatbot,
      // clear queue fields, and process the next customer in queue.
      // This replaces the previous direct updateMany call.
      try {
        const { OperatorRelayService } = require("../../../application/services/operator-relay.service")
        const operatorRelayService = new OperatorRelayService(prisma)
        await operatorRelayService.releaseCustomerAndProcessNext(workspaceId, customerId)
      } catch (relayError) {
        // Fallback: manually re-enable chatbot if relay service fails
        logger.warn("[SupportChat] ⚠️ OperatorRelayService failed in done — falling back to manual update", {
          error: relayError,
          customerId,
          workspaceId,
        })
        await prisma.customers.updateMany({
          where: { id: customerId, workspaceId },
          data: {
            activeChatbot: true,
            operatorRequestedAt: null,
            operatorQueuePosition: null,
            operatorQueueEnteredAt: null,
            originChannel: null,
          },
        })
      }

      // Revoke token so it can't be reused
      await secureTokenService.revokeToken(token)

      logger.info("[SupportChat] chatbot re-enabled and queue processed for customer:", customerId)
      res.json({ success: true, message: "Chatbot riabilitato con successo" })
    } catch (error) {
      logger.error("[SupportChat] done error:", error)
      res.status(500).json({ error: "Server error" })
    }
  }
}

export const supportChatController = new SupportChatController()
