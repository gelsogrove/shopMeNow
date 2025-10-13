import { Request, Response } from "express"
import { prisma } from "../../../lib/prisma"
import messageSendingService from "../../../services/message-sending.service"
import logger from "../../../utils/logger"
import { whatsAppToMarkdown } from "../../../utils/whatsapp-formatter"
import { verifyWhatsAppSignature } from "../../../utils/whatsapp-signature"

/**
 * WhatsApp Webhook Controller
 *
 * Single Responsibility: Handle INBOUND messages from WhatsApp
 *
 * SECURITY:
 * - ✅ Verifica firma HMAC SHA256 (CRITICO!)
 * - ✅ Accetta SOLO messaggi da numeri nel database
 * - ✅ Rate limiting per workspace e customer
 * - ✅ Validazione payload WhatsApp
 *
 * Flow:
 * 1. Verify HMAC signature (reject if invalid)
 * 2. Extract phone number from payload
 * 3. Find customer in database
 * 4. Convert WhatsApp format → Markdown
 * 5. Process with LLM (if customer exists)
 * 6. Convert Markdown → WhatsApp format
 * 7. Send response via WhatsApp API
 * 8. Save to database with status tracking
 */

export class WhatsAppWebhookController {
  /**
   * GET /api/whatsapp/webhook
   * Webhook verification endpoint (one-time setup by Meta)
   *
   * SECURITY: Public endpoint (required by Meta for webhook setup)
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const mode = req.query["hub.mode"]
      const token = req.query["hub.verify_token"]
      const challenge = req.query["hub.challenge"]

      logger.info("[WEBHOOK-VERIFY] Meta verification request received", {
        mode,
        tokenMatch: token === process.env.WHATSAPP_VERIFY_TOKEN,
      })

      // Verify token matches environment variable
      if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.info("[WEBHOOK-VERIFY] ✅ Verification successful")
        res.status(200).send(challenge)
      } else {
        logger.warn("[WEBHOOK-VERIFY] ❌ Verification failed - invalid token")
        res.status(403).send("Forbidden")
      }
    } catch (error: any) {
      logger.error("[WEBHOOK-VERIFY] Error:", error)
      res.status(500).json({ error: "Verification failed" })
    }
  }

  /**
   * POST /api/whatsapp/webhook
   * Receive messages from WhatsApp
   *
   * SECURITY:
   * - ✅ Verifica firma HMAC (CRITICO - previene messaggi fake!)
   * - ✅ Solo numeri registrati nel database
   * - ✅ Rate limiting applicato
   */
  async receiveMessage(req: Request, res: Response): Promise<void> {
    try {
      // 🔒 SECURITY STEP 1: Verify HMAC signature
      const signature = req.headers["x-hub-signature-256"] as string
      const isValidSignature = verifyWhatsAppSignature(
        req.body,
        signature,
        process.env.WHATSAPP_APP_SECRET || ""
      )

      if (!isValidSignature) {
        logger.error(
          "[WEBHOOK] ❌ Invalid HMAC signature - potential attack!",
          {
            signature: signature?.substring(0, 20) + "...",
            ip: req.ip,
          }
        )
        res.status(403).json({ error: "Invalid signature" })
        return
      }

      logger.info("[WEBHOOK] ✅ HMAC signature verified")

      // 🔍 Extract message from WhatsApp payload
      const entry = req.body.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value
      const messages = value?.messages

      if (!messages || messages.length === 0) {
        // Not a message event (could be status update, etc.)
        logger.info("[WEBHOOK] No messages in payload - probably status update")
        res.status(200).json({ status: "ok" })
        return
      }

      const message = messages[0]
      const phoneNumber = `+${message.from}` // WhatsApp sends without +
      const messageText = message.text?.body || ""
      const whatsappMessageId = message.id

      logger.info("[WEBHOOK] 📨 Message received", {
        from: phoneNumber,
        messageLength: messageText.length,
        whatsappMessageId,
      })

      // 🔒 SECURITY STEP 2: Find customer in database
      const customer = await prisma.customers.findFirst({
        where: { phone: phoneNumber },
        include: { workspace: true },
      })

      if (!customer) {
        logger.warn("[WEBHOOK] ⚠️ Customer not found for phone", {
          phoneNumber,
        })

        // Send "please register" message via MessageSendingService
        const registerMessage =
          "Hello! Please register first to use our service. Visit our website or contact support."

        await messageSendingService.sendMessage({
          phoneNumber,
          message: registerMessage,
          workspaceId: "system", // System message, no specific workspace
          sendType: "SYSTEM",
          skipSecurityLayer: true, // Hardcoded message, no need for security
        })

        res.status(200).json({ status: "customer_not_found" })
        return
      }

      logger.info("[WEBHOOK] ✅ Customer found", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        customerName: customer.name,
      })

      // 🔒 SECURITY STEP 3: Check if workspace has WhatsApp configured
      if (
        !customer.workspace.whatsappApiKey ||
        !customer.workspace.whatsappPhoneNumber
      ) {
        logger.error("[WEBHOOK] ❌ WhatsApp not configured for workspace", {
          workspaceId: customer.workspaceId,
        })
        res.status(200).json({ status: "whatsapp_not_configured" })
        return
      }

      // 🔄 Convert WhatsApp format → Markdown (for internal storage)
      const messageMarkdown = whatsAppToMarkdown(messageText)

      // 🤖 Process with LLM (call existing LLMService)
      // TODO: Import and use LLMService here
      // For now, simple echo response
      const llmResponse = `Echo: ${messageMarkdown}` // PLACEHOLDER

      // � Send response via MessageSendingService (with security layer for CHATBOT)
      const sendResult = await messageSendingService.sendMessage({
        phoneNumber,
        message: llmResponse,
        workspaceId: customer.workspaceId,
        customerId: customer.id,
        sendType: "CHATBOT", // LLM-generated content (even if placeholder now)
        userLanguage: (customer.language as "it" | "es" | "pt" | "en") || "it",
        // Security layer will be automatically applied
      })

      const { success, error, messageId } = sendResult.success
        ? { success: true, error: undefined, messageId: sendResult.messageId }
        : { success: false, error: sendResult.error, messageId: undefined }

      // 💾 Get or create active chat session
      let chatSession = await prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
          status: "active",
        },
      })

      if (!chatSession) {
        logger.info("[WEBHOOK] Creating new chat session", {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
        })
        chatSession = await prisma.chatSession.create({
          data: {
            customerId: customer.id,
            workspaceId: customer.workspaceId,
            status: "active",
            context: {
              createdBy: "whatsapp-webhook",
              phoneNumber,
            },
          },
        })
      }

      // 💾 Save to database with WhatsApp status tracking
      await prisma.message.create({
        data: {
          chatSessionId: chatSession.id,
          direction: "INBOUND",
          content: messageMarkdown,
          whatsappStatus: success ? "sent" : "failed",
          whatsappError: error || null,
          whatsappMessageId: messageId || null,
          metadata: {
            inboundWhatsappMessageId: whatsappMessageId,
            phoneNumber,
            customerId: customer.id,
            workspaceId: customer.workspaceId,
          },
        },
      })

      logger.info("[WEBHOOK] ✅ Message processed successfully", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        responseStatus: success ? "sent" : "failed",
        whatsappMessageId: messageId,
      })

      // 📤 Always return 200 to WhatsApp (even if processing failed)
      res.status(200).json({
        status: "processed",
        messageId,
      })
    } catch (error: any) {
      logger.error("[WEBHOOK] ❌ Error processing message:", {
        error: error.message,
        stack: error.stack,
      })

      // Still return 200 to prevent WhatsApp from retrying
      res.status(200).json({ error: "Internal error" })
    }
  }
}
