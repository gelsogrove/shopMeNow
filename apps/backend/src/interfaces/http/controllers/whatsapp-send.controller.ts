import { PrismaClient } from "@echatbot/database"
import { Request, Response } from "express"
import messageSendingService from "../../../services/message-sending.service"
import logger from "../../../utils/logger"

/**
 * WhatsApp Send Controller
 *
 * Single Responsibility: Handle OUTBOUND messages from operators
 *
 * SECURITY (CRITICO!):
 * - ✅ RICHIEDE X-Session-Id header (validato da middleware)
 * - ✅ Valida workspaceId (deve matchare session)
 * - ✅ Valida customerId (deve appartenere a workspace)
 * - ✅ Valida phoneNumber (deve matchare customer)
 * - ✅ Audit trail completo (chi ha inviato cosa e quando)
 *
 * Flow:
 * 1. Extract sessionId from header (already validated by middleware)
 * 2. Validate workspaceId matches session
 * 3. Validate customerId belongs to workspace
 * 4. Validate phoneNumber matches customer
 * 5. Convert Markdown → WhatsApp format
 * 6. Send via WhatsApp API
 * 7. Save to database with audit trail
 */

const prisma = new PrismaClient()

interface SendMessageRequest {
  workspaceId: string
  customerId: string
  phoneNumber: string
  message: string
}

export class WhatsAppSendController {
  /**
   * POST /api/whatsapp/send
   * Send message to customer (operator manual send)
   *
   * SECURITY:
   * - ✅ Requires X-Session-Id (validated by authMiddleware)
   * - ✅ All IDs cross-validated
   * - ✅ Audit trail logged
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      // 🔒 SECURITY: Get validated session from middleware
      const session = (req as any).session // Set by authMiddleware

      if (!session) {
        logger.error("[WHATSAPP-SEND] ❌ No session found - middleware failed?")
        res.status(401).json({ error: "Unauthorized - invalid session" })
        return
      }

      // Extract request parameters
      const { workspaceId, customerId, phoneNumber, message } =
        req.body as SendMessageRequest

      logger.info("[WHATSAPP-SEND] 📤 Send request received", {
        userId: session.userId,
        workspaceId,
        customerId,
        phoneNumber,
      })

      // 🔒 VALIDATION 1: WorkspaceId must match session
      if (session.workspaceId && session.workspaceId !== workspaceId) {
        logger.error("[WHATSAPP-SEND] ❌ Workspace mismatch", {
          sessionWorkspace: session.workspaceId,
          requestWorkspace: workspaceId,
          userId: session.userId,
        })
        res.status(403).json({
          error: "Workspace mismatch",
          message: "Session does not belong to this workspace",
        })
        return
      }

      // 🔒 VALIDATION 2: Customer must exist and belong to workspace
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        include: { workspace: true },
      })

      if (!customer) {
        logger.error("[WHATSAPP-SEND] ❌ Customer not found", { customerId })
        res.status(404).json({ error: "Customer not found" })
        return
      }

      if (customer.workspaceId !== workspaceId) {
        logger.error("[WHATSAPP-SEND] ❌ Customer workspace mismatch", {
          customerWorkspace: customer.workspaceId,
          requestWorkspace: workspaceId,
          customerId,
        })
        res.status(403).json({
          error: "Customer does not belong to this workspace",
        })
        return
      }

      // 🔒 VALIDATION 3: Phone number must match customer
      if (customer.phone !== phoneNumber) {
        logger.error("[WHATSAPP-SEND] ❌ Phone number mismatch", {
          customerPhone: customer.phone,
          requestPhone: phoneNumber,
          customerId,
        })
        res.status(400).json({
          error: "Phone number mismatch",
          message: "Provided phone number does not match customer record",
        })
        return
      }

      // 🔒 VALIDATION 4: Workspace must have WhatsApp configured
      if (
        !customer.workspace.whatsappApiKey ||
        !customer.workspace.whatsappPhoneNumber
      ) {
        logger.error("[WHATSAPP-SEND] ❌ WhatsApp not configured", {
          workspaceId,
        })
        res.status(400).json({
          error: "WhatsApp not configured for this workspace",
          message:
            "Please configure WhatsApp API credentials in workspace settings",
        })
        return
      }

      logger.info("[WHATSAPP-SEND] ✅ All validations passed", {
        customerId,
        workspaceId,
        userId: session.userId,
      })

      // � Send via MessageSendingService
      // Admin manual send: NO security layer (admin è fidato)
      // Ma passa comunque dal service per centralizzazione e audit
      const sendResult = await messageSendingService.sendMessage({
        phoneNumber,
        message, // Already in markdown format
        workspaceId,
        customerId,
        sendType: "ADMIN_MANUAL",
        skipSecurityLayer: true, // Admin è fidato, no security check
        userLanguage: (customer.language as "it" | "es" | "pt" | "en") || "it",
        metadata: {
          sentBy: session.userId,
          sentByEmail: session.user?.email,
          operatorName: session.user?.name || "Unknown",
        },
      })

      const { success, error, messageId } = sendResult.success
        ? { success: true, error: undefined, messageId: sendResult.messageId }
        : { success: false, error: sendResult.error, messageId: undefined }

      // 💾 Get or create active chat session
      let chatSession = await prisma.chatSession.findFirst({
        where: {
          customerId,
          workspaceId,
          status: "active",
        },
      })

      if (!chatSession) {
        logger.info("[WHATSAPP-SEND] Creating new chat session", {
          customerId,
          workspaceId,
        })
        chatSession = await prisma.chatSession.create({
          data: {
            customerId,
            workspaceId,
            status: "active",
            context: {
              createdBy: "operator-manual-send",
              createdByUserId: session.userId,
            },
          },
        })
      }

      // 💾 Save to database with AUDIT TRAIL
      const savedMessage = await prisma.message.create({
        data: {
          chatSessionId: chatSession.id,
          direction: "OUTBOUND",
          content: message, // Original markdown
          whatsappStatus: success ? "sent" : "failed",
          whatsappError: error || null,
          whatsappMessageId: messageId || null,
          sentBy: session.userId, // 🔒 AUDIT: Who sent it
          metadata: {
            sendType: "OPERATOR_MANUAL",
            phoneNumber,
            customerId,
            workspaceId,
            sentByUserId: session.userId,
            sentByEmail: session.user?.email,
            timestamp: new Date().toISOString(),
          },
        },
      })

      logger.info("[WHATSAPP-SEND] ✅ Message sent and saved", {
        success,
        messageId,
        savedMessageId: savedMessage.id,
        customerId,
        workspaceId,
        sentBy: session.userId,
      })

      // 📤 Return success response
      res.status(200).json({
        success,
        messageId,
        savedMessageId: savedMessage.id,
        error: error || null,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
        },
      })
    } catch (error: any) {
      logger.error("[WHATSAPP-SEND] ❌ Error sending message:", {
        error: error.message,
        stack: error.stack,
      })

      res.status(500).json({
        error: "Failed to send message",
        message: error.message,
      })
    }
  }
}
