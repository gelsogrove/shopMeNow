import { Request, Response } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { SecurityCheckService } from "../../../application/services/security-check.service"
import { UrlShortenerService } from "../../../application/services/url-shortener.service"
import { platformConfigService } from "../../../services/platform-config.service"
import { prisma } from "../../../lib/prisma"
import { whatsappMessageRateLimiter, whatsappWorkspaceRateLimiter } from "../../../middlewares/rateLimiter"
// 🆕 Chat Engine - Main conversation processor
import { ChatEngineService, getChatEngine } from "../../../application/chat-engine"
import { workspaceService } from "../../../services/workspace.service"
import { websocketService } from "../../../services/websocket.service"
import { getRegistrationText, detectLanguageFromPhonePrefix } from "../../../utils/language-detector"
import { registrationPromptService } from "../../../services/registration-prompt.service"
import logger from "../../../utils/logger"
import { whatsAppToMarkdown } from "../../../utils/whatsapp-formatter"
import { buildPhoneVariants } from "../../../utils/phone"
import { verifyWhatsAppSignature } from "../../../utils/whatsapp-signature"

const MINUTE_MS = 60_000
const buildTokenBucketConfig = (limitPerMin: number, burst: number) => ({
  capacity: limitPerMin + burst,
  refillPerMs: limitPerMin / MINUTE_MS,
})

/**
 * 🔒 CONCURRENCY CONTROL: Customer-level message processing locks
 * Prevents race conditions when customer sends multiple messages rapidly
 * See Constitution Principle VI: Chat Isolation & Concurrency Safety
 */
const customerMessageLocks = new Map<string, Promise<void>>()

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
   * GET /api/whatsapp/webhook/:webhookId
   * Webhook verification endpoint (one-time setup by Meta)
   *
   * SECURITY: Public endpoint (required by Meta for webhook setup)
   */
  async verifyWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { webhookId } = req.params
      const mode = req.query["hub.mode"]
      const token = req.query["hub.verify_token"]
      const challenge = req.query["hub.challenge"]

      logger.info("[WEBHOOK-VERIFY] Meta verification request received", {
        mode,
        webhookId,
        tokenReceived: !!token,
      })

      const settings = await prisma.whatsappSettings.findUnique({
        where: { webhookId },
        select: { webhookToken: true },
      })

      if (!settings) {
        res.status(404).send("Webhook not found")
        return
      }

      if (mode === "subscribe" && token === settings.webhookToken) {
        logger.info("[WEBHOOK-VERIFY] ✅ Verification successful", { webhookId })
        if (challenge === undefined) {
          res.status(400).send("Missing hub.challenge")
          return
        }
        res.status(200).send(String(challenge))
      } else {
        logger.warn("[WEBHOOK-VERIFY] ❌ Verification failed - invalid token", { webhookId })
        res.status(403).send("Forbidden")
      }
    } catch (error: any) {
      logger.error("[WEBHOOK-VERIFY] Error:", error)
      res.status(500).json({ error: "Verification failed" })
    }
  }

  /**
   * POST /api/whatsapp/webhook/:webhookId
   * Receive messages from WhatsApp
   *
   * SECURITY:
   * - ✅ Verifica firma HMAC (CRITICO - previene messaggi fake!)
   * - ✅ Solo numeri registrati nel database
   * - ✅ Rate limiting applicato
   * - ✅ Customer-level locking (prevents race conditions)
   */
  async receiveMessage(req: Request, res: Response): Promise<void> {
    const { webhookId } = req.params
    // webhookId is optional - playground doesn't provide it
    // if (!webhookId) {
    //   res.status(400).json({ error: "missing_webhook_id" })
    //   return
    // }

    // 🔒 STEP 0: Extract phone number FIRST for locking (before any processing)
    let phoneNumberForLock: string | undefined
    
    try {
      const data = req.body
      const entry = data.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value
      const messages = value?.messages
      
      // 🔧 FIX: Use EXACT phone number for lock (no normalization)
      // This ensures lock key matches the phone saved in database
      if (messages && messages.length > 0) {
        phoneNumberForLock = messages[0].from?.startsWith("+") 
          ? messages[0].from.trim() 
          : `+${messages[0].from?.trim() || ""}`
      } else if (data.message && data.phoneNumber) {
        phoneNumberForLock = data.phoneNumber.trim()
      } else if (data.phoneNumber) {
        phoneNumberForLock = data.phoneNumber.trim()
      }
    } catch (error) {
      logger.error("[WEBHOOK] ❌ Failed to extract phone for locking", error)
    }
    
    // 🔒 STEP 1: ACQUIRE CUSTOMER LOCK (prevents concurrent message processing)
    if (phoneNumberForLock) {
      const lockKey = `customer:${phoneNumberForLock}`
      
      // Wait for any existing lock to release
      while (customerMessageLocks.has(lockKey)) {
        logger.info("[WEBHOOK] ⏳ Waiting for customer lock", { phone: phoneNumberForLock })
        await customerMessageLocks.get(lockKey)
      }
      
      // Create new lock
      let releaseLock: () => void
      const lockPromise = new Promise<void>((resolve) => { 
        releaseLock = resolve 
      })
      customerMessageLocks.set(lockKey, lockPromise)
      
      try {
        // Process message with lock held
        await this._receiveMessageLocked(req, res)
      } finally {
        // Always release lock - MUST resolve promise BEFORE deleting from map
        try {
          releaseLock!()
        } catch (releaseError) {
          logger.error("[WEBHOOK] Error releasing lock (continuing):", releaseError)
        }
        customerMessageLocks.delete(lockKey)
        logger.info("[WEBHOOK] 🔓 Released customer lock", { phone: phoneNumberForLock })
      }
    } else {
      // No phone number - process without lock
      await this._receiveMessageLocked(req, res)
    }
  }
  
  /**
   * Internal method - processes message with lock held
   */
  private async _receiveMessageLocked(req: Request, res: Response): Promise<void> {
    const { webhookId } = req.params
    try {
      logger.info("[WEBHOOK] 📨 Receiving message")

      // ✅ FIX: Extract message from weird frontend format
      // Frontend sends: { "Ciao": { phoneNumber, workspaceId } }
      let extractedMessage: string | undefined
      let extractedData: any = req.body

      if (req.body && typeof req.body === "object") {
        const keys = Object.keys(req.body)
        // Check if first key looks like a message (not standard fields)
        if (
          keys.length > 0 &&
          ![
            "message",
            "phoneNumber",
            "workspaceId",
            "chatInput",
            "entry",
          ].includes(keys[0])
        ) {
          extractedMessage = keys[0] // "Ciao"
          extractedData = req.body[keys[0]] // { phoneNumber, workspaceId, ... }
          logger.info(
            `📝 [WEBHOOK CONTROLLER] Extracted message from key: "${extractedMessage}"`
          )
        }
      }

      const data = extractedData

      // Helper to extract text from WhatsApp message (text, button, interactive, media captions)
      const extractMessageText = (msg: any): string => {
        if (msg?.text?.body) return msg.text.body
        if (msg?.button?.text) return msg.button.text
        if (msg?.interactive?.button_reply?.title) return msg.interactive.button_reply.title
        if (msg?.interactive?.list_reply?.title) return msg.interactive.list_reply.title
        if (msg?.interactive?.type === "list" && msg?.interactive?.body?.text) return msg.interactive.body.text

        const mediaTypes = ["image", "video", "document", "audio", "sticker"]
        if (mediaTypes.includes(msg?.type)) {
          const media = msg[msg.type]
          const caption = media?.caption || media?.filename
          if (caption) return caption
          return `[${msg.type} message]`
        }
        return ""
      }

      // 🔍 Extract message - Support THREE formats:
      // 1. WhatsApp API format: req.body.entry[0].changes[0].value.messages[0]
      // 2. Frontend simulator format (standard): req.body.message + req.body.phoneNumber
      // 3. Frontend simulator format (weird): message as object key

      let phoneNumber: string
      let phoneVariants: string[] = []
      let messageText: string
      let whatsappMessageId: string
      let workspaceId: string | undefined
      let messageTimestamp: number | undefined
      let isPlayground: boolean = false // 🧪 Playground flag (only from frontend simulator)

      // Check if it's WhatsApp API format
      const entry = data.entry?.[0]
      const changes = entry?.changes?.[0]
      const value = changes?.value
      const messages = value?.messages
      const contactName: string | undefined = value?.contacts?.[0]?.profile?.name?.trim()

      if (messages && messages.length > 0) {
        // WhatsApp API format
        const message = messages[0]
        
        // Validate required fields
        if (!message.from) {
          logger.warn("[WEBHOOK] ⚠️ WhatsApp message missing 'from' field", { message })
          res.status(200).json({ status: "ignored", reason: "missing from field" })
          return
        }
        
        phoneVariants = buildPhoneVariants(message.from)
        phoneNumber = phoneVariants[0]
        messageText = extractMessageText(message)
        whatsappMessageId = message.id || `wa-${Date.now()}`
        workspaceId = value.workspaceId // ✅ Extract workspaceId from WhatsApp format
        isPlayground = value.isPlayground === true // 🧪 Extract playground flag from value (frontend simulator uses entry format)
        messageTimestamp = message.timestamp ? Number(message.timestamp) * 1000 : undefined

        logger.info("[WEBHOOK] 📨 WhatsApp API format detected", {
          from: phoneNumber,
          messageLength: messageText.length,
          whatsappMessageId,
          workspaceId,
          isPlayground,
        })
      } else if (data.message && data.phoneNumber) {
        // Frontend simulator format (standard)
        phoneVariants = buildPhoneVariants(data.phoneNumber)
        phoneNumber = phoneVariants[0]
        messageText = data.message
        whatsappMessageId = `frontend-${Date.now()}-${Math.random().toString(36).substring(7)}`
        workspaceId = data.workspaceId // ✅ Extract workspaceId from standard format
        isPlayground = data.isPlayground === true // 🧪 Extract playground flag

        logger.info(
          "[WEBHOOK] 📨 Frontend simulator format (standard) detected",
          {
            from: phoneNumber,
            messageLength: messageText.length,
            workspaceId: data.workspaceId,
            isPlayground,
          }
        )
      } else if (extractedMessage && data.phoneNumber) {
        // Frontend simulator format (weird: message as key)
        phoneVariants = buildPhoneVariants(data.phoneNumber)
        phoneNumber = phoneVariants[0]
        messageText = extractedMessage
        whatsappMessageId = `frontend-${Date.now()}-${Math.random().toString(36).substring(7)}`
        workspaceId = data.workspaceId // ✅ Extract workspaceId from weird format
        isPlayground = data.isPlayground === true // 🧪 Extract playground flag

        logger.info("[WEBHOOK] 📨 Frontend simulator format (weird) detected", {
          from: phoneNumber,
          messageLength: messageText.length,
          workspaceId: data.workspaceId,
          isPlayground,
        })
      } else {
        // Not a message event (could be status update, etc.)
        logger.info(
          "[WEBHOOK] No message found in payload - probably status update"
        )
        res.status(200).json({ status: "ok" })
        return
      }
      
      if (!messageText || messageText.trim() === "") {
        logger.warn("[WEBHOOK] ⚠️ No message text extracted - ignoring", { webhookId })
        res.status(200).json({ status: "ignored", reason: "no text" })
        return
      }
      
      if (!phoneNumber) {
        logger.error("[WEBHOOK] ❌ Missing phone number in payload", { payloadKeys: Object.keys(data || {}) })
        res.status(400).json({ error: "missing_phone_number", message: "WhatsApp payload missing 'from' / phoneNumber" })
        return
      }

      // 🔒 SECURITY STEP 2: Find customer in database OR handle new user
      // workspaceId already extracted above based on format
      // If not provided, try to lookup from channel phone number

      // 🔍 Load workspace by webhookId OR workspaceId (for playground)
      let whatsappSettings: any
      
      if (webhookId) {
        // Production: lookup by webhookId
        whatsappSettings = await prisma.whatsappSettings.findUnique({
          where: { webhookId },
          select: {
            workspaceId: true,
            phoneNumber: true,
            appSecret: true,
            workspace: {
              select: {
                id: true,
                name: true,
                channelStatus: true,
                deletedAt: true,
                ownerId: true,
                operatorWhatsappNumber: true, // 🔀 Relay tunnel: detect operator messages
                owner: { select: { status: true } },
              },
            },
          },
        })
      } else if (workspaceId) {
        // Playground: lookup by workspaceId
        whatsappSettings = await prisma.whatsappSettings.findUnique({
          where: { workspaceId },
          select: {
            workspaceId: true,
            phoneNumber: true,
            appSecret: true,
            workspace: {
              select: {
                id: true,
                name: true,
                channelStatus: true,
                deletedAt: true,
                ownerId: true,
                operatorWhatsappNumber: true, // 🔀 Relay tunnel: detect operator messages
                owner: { select: { status: true } },
              },
            },
          },
        })
      }

      if (!whatsappSettings?.workspace || whatsappSettings.workspace.deletedAt) {
        logger.error("[WEBHOOK] ❌ Webhook not linked to active workspace", { webhookId, workspaceId })
        res.status(404).json({ error: "workspace_not_found_for_webhook" })
        return
      }

      // 🔒 SECURITY: Verify Meta signature (skip for playground — no HMAC header)
      if (!isPlayground) {
        const sigHeader = req.header("x-hub-signature-256")
        if (!sigHeader) {
          logger.warn("[WEBHOOK] ❌ Missing signature header", { webhookId })
          res.status(403).json({ error: "missing_signature" })
          return
        }

        try {
          const appSecret = whatsappSettings.appSecret
          if (!appSecret) {
            logger.error("[WEBHOOK] ❌ Missing app secret in WhatsApp settings", { webhookId })
            res.status(500).json({ error: "webhook_signature_config_missing" })
            return
          }

          const rawBody = (req as any).rawBody || req.body || {}
          const isValid = verifyWhatsAppSignature(rawBody, sigHeader, appSecret)

          if (!isValid) {
            logger.warn("[WEBHOOK] ❌ Invalid signature", { webhookId })
            res.status(403).json({ error: "invalid_signature" })
            return
          }
        } catch (err) {
          logger.warn("[WEBHOOK] ⚠️ Signature verification failed", {
            error: (err as Error).message,
          })
          res.status(403).json({ error: "invalid_signature" })
          return
        }
      }

      // Owner inactive or channel disabled (checked AFTER authentication)
      if (whatsappSettings.workspace.owner?.status === "INACTIVE") {
        logger.warn("[WEBHOOK] 🚫 Owner inactive", {
          webhookId,
          workspaceId: whatsappSettings.workspace.id,
          ownerStatus: whatsappSettings.workspace.owner?.status,
        })
        res.status(200).json({ success: true, message: "Owner inactive" })
        return
      }

      if (!whatsappSettings.workspace.channelStatus) {
        logger.warn("[WEBHOOK] 🚫 Channel disabled", {
          webhookId,
          workspaceId: whatsappSettings.workspace.id,
          channelStatus: whatsappSettings.workspace.channelStatus,
        })
        res.status(200).json({ success: true, message: "Channel disabled" })
        return
      }

      workspaceId = whatsappSettings.workspaceId

      // 🔁 Deduplicate inbound webhook events (Meta retries can send same message multiple times)
      if (whatsappMessageId) {
        try {
          const prismaAny = prisma as any
          await prismaAny.whatsappWebhookEvent.create({
            data: {
              workspaceId,
              externalMessageId: whatsappMessageId,
              channel: "whatsapp",
            },
          })
        } catch (error: any) {
          if (error?.code === "P2002") {
            logger.info("[WEBHOOK] 🔁 Duplicate message ignored", {
              webhookId,
              workspaceId,
              whatsappMessageId,
            })
            res.status(200).json({
              status: "duplicate",
              messageId: whatsappMessageId,
            })
            return
          }
          throw error
        }
      }

      // Anti-replay: reject stale messages (>5 minutes) when timestamp present
      if (messageTimestamp) {
        const now = Date.now()
        const drift = Math.abs(now - messageTimestamp)
        if (drift > 5 * 60 * 1000) {
          logger.warn("[WEBHOOK] ⏱️ Stale message rejected", { webhookId, driftMs: drift })
          res.status(409).json({ error: "stale_message" })
          return
        }
      }

      // Guardrail: ensure to-number/metadata matches channel phone
      const channelVariants = buildPhoneVariants(whatsappSettings.phoneNumber)
      const toVariants = buildPhoneVariants(
        value?.metadata?.display_phone_number || messages?.[0]?.to
      )
      if (toVariants.length > 0 && channelVariants.length > 0) {
        const match = toVariants.some((v) => channelVariants.includes(v))
        if (!match) {
          logger.warn("[WEBHOOK] 🚫 To-number mismatch with channel phone", {
            webhookId,
            toVariants,
            channelVariants,
          })
          res.status(404).json({ error: "channel_mismatch" })
          return
        }
      }

      // 🔀 OPERATOR RELAY TUNNEL: Check if the sender is the workspace operator.
      // Two detection paths:
      //  1. Workspace generic operator number (Workspace.operatorWhatsappNumber)
      //  2. Sales agent's personal phone (Sales.phone) when that agent has an active
      //     customer in the operator queue — this handles the case where the notification
      //     was sent to the assigned sales agent instead of the generic operator number.
      const operatorPhone = whatsappSettings.workspace.operatorWhatsappNumber
      let isOperator = false

      if (operatorPhone) {
        const operatorVariants = buildPhoneVariants(operatorPhone)
        isOperator = phoneVariants.some((v) => operatorVariants.includes(v))
      }

      // Path 2: Check if the sender is a Sales agent with an active customer in queue
      if (!isOperator) {
        try {
          const salesAgent = await prisma.sales.findFirst({
            where: {
              workspaceId,
              phone: { in: phoneVariants },
              customers: {
                some: {
                  workspaceId,
                  activeChatbot: false,
                  operatorQueuePosition: { not: null },
                  deletedAt: null,
                },
              },
            },
            select: { id: true, firstName: true, lastName: true, phone: true },
          })

          if (salesAgent) {
            isOperator = true
            logger.info("[WEBHOOK] 🔀 Sales agent message detected — routing to OperatorRelayService", {
              workspaceId,
              senderPhone: phoneNumber,
              agentId: salesAgent.id,
              agentName: `${salesAgent.firstName} ${salesAgent.lastName}`.trim(),
            })
          }
        } catch (salesCheckError) {
          logger.warn("[WEBHOOK] ⚠️ Failed to check sales agent phone — skipping relay", {
            error: salesCheckError instanceof Error ? salesCheckError.message : String(salesCheckError),
          })
        }
      }

      if (isOperator) {
        logger.info("[WEBHOOK] 🔀 Operator message detected — routing to OperatorRelayService", {
          workspaceId,
          senderPhone: phoneNumber,
          operatorPhone: operatorPhone ?? "(sales agent)",
        })

        try {
          const { OperatorRelayService } = require("../../../application/services/operator-relay.service")
          const operatorRelayService = new OperatorRelayService(prisma)
          await operatorRelayService.handleOperatorMessage(workspaceId, messageText)
        } catch (relayError) {
          logger.error("[WEBHOOK] ❌ OperatorRelayService.handleOperatorMessage failed", {
            error: relayError,
            workspaceId,
          })
        }

        // Always return 200 to WhatsApp (regardless of relay outcome)
        res.status(200).json({ status: "ok", source: "operator_relay" })
        return
      }

      // �🔍 DEBUG: Log phone lookup
      logger.info("[WEBHOOK] 📞 Phone lookup debug", {
        phoneNumber: phoneNumber,
        workspaceId,
        webhookId,
      })
      
      const customerSelect = {
        id: true,
        phone: true,
        name: true,
        email: true,
        language: true,
        workspaceId: true,
        isActive: true,
        isBlacklisted: true,
        activeChatbot: true,
        discount: true,
        workspace: {
          select: {
            id: true,
            name: true,
            welcomeMessage: true,
            defaultLanguage: true, // 🌍 Language fallback
            needRegistration: true, // 🔧 Controls whether registration is required
          },
        },
      } as const

      let customer = null

      // 🔧 LOOKUP: search by phone variants within workspace
      const lookupVariants = phoneVariants.length > 0 ? phoneVariants : buildPhoneVariants(phoneNumber)
      customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
          OR: lookupVariants.map((v) => ({ phone: v })),
        },
        select: customerSelect,
      })
      
      if (customer) {
        logger.info("[WEBHOOK] ✅ Customer found by EXACT phone match", {
          customerId: customer.id,
          phone: customer.phone,
          phoneSearched: phoneNumber,
        })

        if (customer.isBlacklisted) {
          logger.warn("[WEBHOOK] 🚫 Blocked customer - returning 410", {
            customerId: customer.id,
            workspaceId: customer.workspaceId,
          })
          res.status(410).json({
            status: "blocked",
            message: "Customer is blocked",
          })
          return
        }
      } else {
        logger.info("[WEBHOOK] ❌ Customer NOT found", {
          phoneSearched: phoneNumber,
          workspaceId,
        })
      }

      if (customer && contactName && (!customer.name || customer.name.startsWith("New Customer"))) {
        // Update name for existing customer if missing/placeholder
        try {
          await prisma.customers.update({
            where: { id: customer.id },
            data: { name: contactName },
          })
          customer = { ...customer, name: contactName }
          logger.info("[WEBHOOK] ✏️ Updated customer name from contact", { customerId: customer.id, contactName })
        } catch (err) {
          logger.warn("[WEBHOOK] ⚠️ Failed to update customer name", { error: (err as Error).message })
        }
      }

      if (!customer) {
        logger.info(
          "[WEBHOOK] 🆕 New user detected - sending welcome message",
          {
            phoneNumber,
            workspaceId,
          }
        )

        // 🆕 Feature 174: Removed STEP 1&2 (RegistrationAttempts check) - users receive welcome freely

        // 🔒 ACCESS CHECK (debug/channel/owner/billing blocks) BEFORE welcome flow
        // 🧪 PLAYGROUND: skip debug/WIP check — playground must always work regardless of debugMode
        const { WorkspaceAccessService } = await import(
          "../../../application/services/workspace-access.service"
        )
        const workspaceAccessService = new WorkspaceAccessService(prisma)
        const accessResult = isPlayground
          ? { canProcess: true, blockReason: null, message: null }
          : await workspaceAccessService.canProcessMessages(
              workspaceId,
              false // check channelStatus + debugMode
            )

        // Get workspace config early (needed for WIP + language)
        const workspace = await prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: {
            id: true,
            name: true,
            welcomeMessage: true,
            defaultLanguage: true, // 🌍 Business Configuration default language
            wipMessage: true,
            debugMode: true,
            channelStatus: true,
            channelMode: true, // 🛠️ DebugFlow: FLOW workspaces bypass WIP
            needRegistration: true, // 🔧 Controls whether registration is required
            ownerId: true,
            owner: {
              select: { status: true },
            },
          },
        })

        if (!workspace) {
          logger.error("[WEBHOOK] ⚠️ Workspace not found", { workspaceId })
          res.status(404).json({ error: "Workspace not found" })
          return
        }

        // 🚫 OWNER STATUS CHECK: Block if owner is INACTIVE
        if (workspace.owner?.status === "INACTIVE") {
          logger.warn("[WEBHOOK] ❌ Message blocked: Owner inactive", {
            workspaceId,
            ownerId: workspace.ownerId,
          })
          res.status(200).json({ success: true, message: "Message received" })
          return
        }

        // 🛠️ DebugFlow: FLOW workspaces process normally in debugMode
        // Strategy appends debug trace to response instead of blocking with WIP
        if (!accessResult.canProcess && accessResult.blockReason === "DEBUG_MODE" && workspace.channelMode === "FLOW") {
          logger.info("[WEBHOOK] 🛠️ DebugFlow (new user) - FLOW workspace bypasses WIP, processing normally", { workspaceId })
          accessResult.canProcess = true
          accessResult.blockReason = null
        }

        if (!accessResult.canProcess) {
          // 🚫 CHANNEL_DISABLED → Save message, no response
          if (accessResult.blockReason === "CHANNEL_DISABLED") {
            logger.info("[WEBHOOK] 🚫 Channel disabled (new user) - saving message only", {
              workspaceId,
              phoneNumber,
            })

            const phoneForStorage =
              lookupVariants.find((v) => v.startsWith("+")) ||
              lookupVariants[0] ||
              phoneNumber

            // 🌍 Detect language from phone prefix (+34→es, +39→it, +351→pt) or use workspace default
            const detectedLanguage = detectLanguageFromPhonePrefix(phoneForStorage)
            const customerLanguage = detectedLanguage || workspace.defaultLanguage

            const tempCustomer = await prisma.customers.create({
              data: {
                phone: phoneForStorage,
                workspaceId: workspaceId,
                name: contactName || "New Customer",
                email: `temp_${phoneForStorage.replace(/[^0-9]/g, "")}@pending.com`,
                language: customerLanguage, // 🌍 Detected from phone prefix or workspace default
                isActive: false,
              },
            })

            const chatSession = await prisma.chatSession.create({
              data: {
                customerId: tempCustomer.id,
                workspaceId: workspaceId,
                status: "active",
              },
            })

            const messageMarkdown = whatsAppToMarkdown(messageText)
            const savedMessage = await prisma.conversationMessage.create({
              data: {
                workspaceId: workspaceId,
                customerId: tempCustomer.id,
                conversationId: chatSession.id,
                role: "user",
                content: messageMarkdown,
                agentType: "NONE",
                tokensUsed: 0,
                debugInfo: JSON.stringify({
                  channelDisabled: true,
                  reason: "workspace.channelStatus = false",
                  timestamp: new Date().toISOString(),
                  source: "whatsapp-webhook",
                }),
              },
            })

            // 🔔 Notify realtime clients (chat list + message thread)
            try {
              websocketService.notifyNewMessage(workspaceId, {
                id: savedMessage.id,
                sessionId: chatSession.id,
                content: messageMarkdown,
                sender: "customer",
                timestamp: savedMessage.createdAt.toISOString(),
                workspaceId,
                metadata: { channelDisabled: true, source: "whatsapp-webhook" },
              })
              websocketService.notifyChatUpdated(workspaceId, {
                sessionId: chatSession.id,
                lastMessage: messageMarkdown.substring(0, 100),
                lastMessageAt: savedMessage.createdAt.toISOString(),
                customerId: tempCustomer.id,
              })
            } catch (wsError) {
              logger.warn("[WEBHOOK] ⚠️ WebSocket notify failed for channel-disabled new user", {
                error: wsError,
                workspaceId,
              })
            }

            res.status(200).json({
              status: "channel_disabled",
              code: "CHANNEL_DISABLED",
              message: "Channel is disabled.",
            })
            return
          }

          // 🚧 DEBUG_MODE → Send WIP message
          if (accessResult.blockReason === "DEBUG_MODE") {
            logger.info("[WEBHOOK] 🚧 Debug mode (new user) - sending WIP message", {
              workspaceId,
              phoneNumber,
            })

            const detectedLanguageFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
            const finalLanguage = detectedLanguageFromPhone || workspace.defaultLanguage
            const rawWipMessage =
              workspace.wipMessage || "Work in progress. Please contact us later."

            let finalWipMessage = rawWipMessage
            let translationTokensUsed = 0
            try {
              const { TranslationAgent } = require("../../../application/agents/TranslationAgent")
              const translationAgent = new TranslationAgent(prisma)
              const translationResult = await translationAgent.process({
                workspaceId,
                message: rawWipMessage,
                targetLanguage: finalLanguage,
                customerName: contactName || "Customer",
                customerId: undefined,
                channel: "whatsapp",
              })
              finalWipMessage = translationResult.message || rawWipMessage
              translationTokensUsed = translationResult.tokensUsed || 0
            } catch (translationError) {
              logger.warn("[WEBHOOK] ⚠️ WIP translation failed (new user), using raw message", {
                error: translationError,
              })
            }

            const phoneForStorage =
              lookupVariants.find((v) => v.startsWith("+")) ||
              lookupVariants[0] ||
              phoneNumber

            const { tempCustomer, chatSession, assistantMessage } = await prisma.$transaction(async (tx) => {
              const tempCustomer = await tx.customers.create({
                data: {
                  phone: phoneForStorage,
                  workspaceId: workspaceId,
                  name: contactName || "New Customer",
                  email: `temp_${phoneForStorage.replace(/[^0-9]/g, "")}@pending.com`,
                  language: finalLanguage,
                  isActive: false,
                },
              })

              const chatSession = await tx.chatSession.create({
                data: {
                  customerId: tempCustomer.id,
                  workspaceId: workspaceId,
                  status: "active",
                },
              })

              const messageMarkdown = whatsAppToMarkdown(messageText)
              await tx.conversationMessage.create({
                data: {
                  workspaceId: workspaceId,
                  customerId: tempCustomer.id,
                  conversationId: chatSession.id,
                  role: "user",
                  content: messageMarkdown,
                  agentType: "NONE",
                  tokensUsed: 0,
                  debugInfo: JSON.stringify({
                    debugMode: true,
                    reason: "workspace.debugMode = true",
                    timestamp: new Date().toISOString(),
                    source: "whatsapp-webhook",
                  }),
                },
              })

              const assistantMessage = await tx.conversationMessage.create({
                data: {
                  workspaceId: workspaceId,
                  customerId: tempCustomer.id,
                  conversationId: chatSession.id,
                  role: "assistant",
                  content: finalWipMessage,
                  agentType: "ROUTER",
                  tokensUsed: translationTokensUsed,
                  deliveryStatus: "pending",
                  debugInfo: JSON.stringify({
                    debugMode: true,
                    reason: "workspace.debugMode = true",
                    timestamp: new Date().toISOString(),
                    source: "whatsapp-webhook",
                  }),
                },
              })

              return { tempCustomer, chatSession, assistantMessage }
            })

            try {
              const { WhatsAppQueueService } = require("../../../services/whatsapp-queue.service")
              const queueService = new WhatsAppQueueService(prisma)
              await queueService.enqueue({
                workspaceId,
                customerId: tempCustomer.id,
                phoneNumber: tempCustomer.phone,
                messageContent: finalWipMessage,
                conversationMessageId: assistantMessage.id,
              })
            } catch (error) {
              logger.error("[WEBHOOK] ❌ Failed to enqueue WIP message (new user)", {
                error,
                workspaceId,
              })
            }

            res.status(200).json({
              status: "debug_wip",
              code: "DEBUG_MODE",
              message: "Channel is in maintenance mode.",
              wipMessage: finalWipMessage,
            })
            return
          }

          // Silent block for billing issues (PAUSED, PAYMENT_FAILED, CREDIT_EXHAUSTED, OWNER_DELETED)
          res.status(402).json({
            status: "workspace_blocked",
            code: accessResult.blockReason,
            message: accessResult.message,
          })
          return
        }

        // ✅ STEP 3: Check billing before sending welcome message
        
        // 💰 BILLING CHECK: Verify credit and plan limits BEFORE creating customer
        const { SubscriptionBillingService } = await import(
          "../../../application/services/subscription-billing.service"
        )
        const billingService = new SubscriptionBillingService(prisma)

        // Check trial validity first
        const trialStatus = await billingService.isTrialValid(workspaceId)
        if (trialStatus.isTrialPlan && !trialStatus.isValid) {
          logger.warn("[WEBHOOK] 💰 Trial expired - SILENT BLOCK for new user (no save, no response)", {
            workspaceId,
            phoneNumber,
          })
          // 🚨 CRITICAL: DO NOT create customer, DO NOT respond - completely silent
          res.status(402).json({
            status: "billing_error",
            code: "TRIAL_EXPIRED",
            message: "Trial period has expired. Please upgrade your plan.",
          })
          return
        }

        // Check credit balance
        const messageCost = await billingService.getOperationCost(workspaceId, "message")
        const creditCheck = await billingService.checkCredit(workspaceId, messageCost)

        if (!creditCheck.hasSufficientCredit) {
          logger.warn("[WEBHOOK] 💰 Insufficient credit - SILENT BLOCK for new user (no save, no response)", {
            workspaceId,
            phoneNumber,
            currentBalance: creditCheck.currentBalance,
            requiredAmount: messageCost,
          })
          // 🚨 CRITICAL: DO NOT create customer, DO NOT respond - completely silent
          res.status(402).json({
            status: "billing_error",
            code: "INSUFFICIENT_CREDIT",
            message: "Insufficient credit. Please recharge your account.",
          })
          return
        }

        // Check customer limit (50 for FREE_TRIAL/BASIC, 100 for PREMIUM)
        const customerLimitCheck = await billingService.checkPlanLimits(workspaceId, "customers")
        if (!customerLimitCheck.withinLimits) {
          logger.warn("[WEBHOOK] 📊 Customer limit reached - SILENT BLOCK for new user (no save, no response)", {
            workspaceId,
            phoneNumber,
            current: customerLimitCheck.current,
            max: customerLimitCheck.max,
          })
          // 🚨 CRITICAL: DO NOT create customer, DO NOT respond - completely silent
          // The 51st (or 101st for PREMIUM) customer will never be saved
          res.status(403).json({
            status: "limit_reached",
            code: "CUSTOMER_LIMIT_REACHED",
            message: `Customer limit reached (${customerLimitCheck.current}/${customerLimitCheck.max}). Please upgrade your plan.`,
          })
          return
        }

        logger.info(
          "[WEBHOOK] 📨 Billing checks passed - sending welcome message",
          {
            phoneNumber,
            creditBalance: creditCheck.currentBalance,
            customersUsed: customerLimitCheck.current,
            customersMax: customerLimitCheck.max,
          }
        )

      // 🌍 LANGUAGE PRIORITY: customer.language → phone prefix (only IT/ES/PT) → workspace.defaultLanguage
        const detectedLanguageFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
        const finalLanguage = detectedLanguageFromPhone || workspace.defaultLanguage // workspace.defaultLanguage NOT nullable
        logger.info("[WEBHOOK] 📱 Detected language from phone for NEW customer", {
          phoneNumber,
          detectedFromPhone: detectedLanguageFromPhone,
          finalLanguage,
        })

        // 🔧 Generate registration link ONLY if workspace requires registration
        let registrationLink = ""
        let registrationTexts: any = { link: "", validity: "" }

        if (workspace.needRegistration !== false) {
          const secureTokenService = new SecureTokenService()
          const urlShortenerService = new UrlShortenerService()

          // Create secure token for registration (24 hours validity)
          const registrationToken = await secureTokenService.createToken(
            "registration",
            workspaceId,
            { phoneNumber, language: finalLanguage },
            "24h",
            undefined, // userId - not yet created
            phoneNumber,
            undefined, // ipAddress
            undefined // customerId - not yet created (registration)
          )

          // Get workspace URL and custom registration page (if configured)
          const { url: workspaceUrl, registrationPage } =
            await workspaceService.getWorkspaceURLWithRegistration(workspaceId)

          // Use centralized link generator service for registration link
          const { LinkGeneratorService } = require("../../../application/services/link-generator.service")
          const linkGeneratorService = new LinkGeneratorService()
          registrationLink = await linkGeneratorService.generateRegistrationLink(
            registrationToken,
            workspaceUrl,
            workspaceId,
            registrationPage, // Pass custom registration page if configured
            finalLanguage // 🌍 Pass customer language for registration page i18n
          )

          // Get localized registration texts
          registrationTexts = getRegistrationText(finalLanguage)
        } else {
          logger.info("[WEBHOOK] 📋 needRegistration=false — skipping registration link for new customer", { workspaceId })
        }

        // 🆕 Process variables in welcome message BEFORE using it
        const { PromptVariableBuilder } = require("../../../application/services/prompt-variable-builder.service")
        const { PromptProcessorService } = require("../../../services/prompt-processor.service")
        
        const variables = PromptVariableBuilder.build(customer, workspace, {})
        const promptProcessor = new PromptProcessorService()
        
        const welcomeMessageTemplate = workspace.welcomeMessage || "Welcome! How can I help you?"
        const welcomeMessage = promptProcessor.processWithVariables(
          welcomeMessageTemplate,
          variables
        )
        
        // 🔧 FIX: Replace [LINK_REGISTRATION] inline in welcome message template
        // If template contains [LINK_REGISTRATION], replace it with actual link
        // Only append registration footer if template does NOT contain [LINK_REGISTRATION]
        const hasRegistrationToken = welcomeMessage.includes("[LINK_REGISTRATION]")
        let rawWelcomeMessage: string
        
        if (hasRegistrationToken && registrationLink) {
          // Template has [LINK_REGISTRATION] AND we have a link → replace inline, no footer
          rawWelcomeMessage = welcomeMessage.replace(/\[LINK_REGISTRATION\]/g, registrationLink)
        } else if (hasRegistrationToken && !registrationLink) {
          // Template has [LINK_REGISTRATION] but no link (needRegistration=false) → remove placeholder
          rawWelcomeMessage = welcomeMessage.replace(/\[LINK_REGISTRATION\]/g, "").replace(/\n{3,}/g, "\n\n").trim()
        } else if (registrationLink) {
          // Template does NOT have [LINK_REGISTRATION] → append footer
          rawWelcomeMessage = `${welcomeMessage}\n\n${registrationTexts.link}: ${registrationLink}\n${registrationTexts.validity}`
        } else {
          rawWelcomeMessage = welcomeMessage
        }

        // 🌍 STEP 4: Pass welcome message through Translation Layer
        let finalMessage = rawWelcomeMessage
        let translationTokensUsed = 0
        const debugSteps: any[] = []

        try {
          const { TranslationAgent } = require("../../../application/agents/TranslationAgent")
          const translationAgent = new TranslationAgent(prisma)

          debugSteps.push({
            type: "welcome",
            agent: "Welcome Message Generator",
            timestamp: new Date().toISOString(),
            input: {
              phoneNumber: phoneNumber,
              language: finalLanguage,
            },
            output: {
              welcomeMessage: rawWelcomeMessage,
            },
            tokenUsage: {
              totalTokens: 0,
            },
          })

          const translationResult = await translationAgent.process({
            workspaceId: workspaceId,
            message: rawWelcomeMessage,
            targetLanguage: finalLanguage, // 🌍 Already resolved: phonePrefix || workspace.defaultLanguage
            customerName: "New Customer",
            channel: "whatsapp",
          })

          finalMessage = translationResult.message || rawWelcomeMessage
          translationTokensUsed = translationResult.tokensUsed || 0

          debugSteps.push({
            type: "safety",
            agent: "Translation Layer",
            model: "openai/gpt-4o-mini",
            temperature: 0.2,
            timestamp: new Date().toISOString(),
            systemPrompt: translationResult.systemPrompt || "Translation Layer",
            input: {
              originalMessage: rawWelcomeMessage,
              targetLanguage: finalLanguage,
              customerName: "New Customer",
            },
            output: {
              translatedMessage: finalMessage,
              decision: translationResult.translated ? "translated" : "passthrough",
            },
            tokenUsage: {
              totalTokens: translationTokensUsed,
            },
          })

          logger.info(
            "[WEBHOOK] 🌍 Welcome message passed through Translation Layer",
            {
              tokensUsed: translationTokensUsed,
            }
          )
        } catch (safetyError) {
          logger.error(
            "[WEBHOOK] ❌ Translation error - using raw message",
            safetyError
          )
          // Fallback to raw message on error
          finalMessage = rawWelcomeMessage
        }

        // 🔒 TRANSACTION: Ensure customer, session, and welcome message are created atomically
        // Prevents: orphan customers without sessions, or sessions without messages
        logger.info("[WEBHOOK] 🆕 Creating NEW customer and session", {
          phoneNumber,
          workspaceId,
          workspaceName: workspace?.name || "unknown",
        })
        
        const welcomeMessagePrice = await platformConfigService.getPrice("MESSAGE")
        const phoneForStorage =
          lookupVariants.find((v) => v.startsWith("+")) ||
          lookupVariants[0] ||
          phoneNumber

        const { tempCustomer, chatSession } = await prisma.$transaction(async (tx) => {
          // ✅ STEP 5: CREATE TEMPORARY CUSTOMER RECORD (will be updated after registration)
          // This allows us to save the welcome message in chat history
          // 🔧 FIX: Save phone EXACTLY as received (with international prefix) to avoid normalization issues
          const tempCustomer = await tx.customers.create({
            data: {
              phone: phoneForStorage, // Save sanitized/normalized value
              workspaceId: workspaceId,
              name: contactName || "New Customer", // Temporary name
              email: `temp_${phoneForStorage.replace(/[^0-9]/g, "")}@pending.com`, // Temporary email (required field)
              language: finalLanguage,
              isActive: workspace.needRegistration === false ? true : false, // Active immediately if registration not required
            },
          })
          
          logger.info("[WEBHOOK] ✅ Customer created", {
            customerId: tempCustomer.id,
            workspaceId: tempCustomer.workspaceId,
            phoneSaved: tempCustomer.phone,
          })

          // ✅ STEP 6: CREATE CHAT SESSION
          const chatSession = await tx.chatSession.create({
            data: {
              customerId: tempCustomer.id,
              workspaceId: workspaceId,
              status: "active",
            },
          })
          
          logger.info("[WEBHOOK] ✅ ChatSession created", {
            sessionId: chatSession.id,
            workspaceId: chatSession.workspaceId,
            customerId: chatSession.customerId,
          })

          // ✅ STEP 7: SAVE USER MESSAGE IN CHAT HISTORY (CRITICAL for first message detection)
          // This is ESSENTIAL so ChatEngine can detect that user already sent a message
          await tx.conversationMessage.create({
            data: {
              workspaceId: workspaceId,
              customerId: tempCustomer.id,
              conversationId: chatSession.id,
              role: "user", // User message
              content: messageText,
              agentType: "CUSTOMER",
              tokensUsed: 0,
              deliveryStatus: "delivered", // User messages are always "delivered"
            },
          })

          // ✅ STEP 8: SAVE WELCOME MESSAGE IN CHAT HISTORY
          // 🔧 CRITICAL: Use conversationMessage table (NEW) not message table (OLD)
          // This ensures messages appear in frontend (getChatSessionMessages queries conversationMessage)
          // 🚫 NOTE: deliveryStatus='not_queued' because welcome messages are system messages, NOT sent via WhatsApp queue
          await tx.conversationMessage.create({
            data: {
              workspaceId: workspaceId,
              customerId: tempCustomer.id,
              conversationId: chatSession.id,
              role: "assistant", // Bot response
              content: finalMessage,
              agentType: "REGISTRATION_FLOW",
              tokensUsed: translationTokensUsed,
              deliveryStatus: "not_queued", // 🚫 Welcome messages are NOT sent via WhatsApp queue
              debugInfo: JSON.stringify({
                source: "whatsapp-webhook",
                type: "welcome_new_user",
                language: finalLanguage,
                registrationLink: registrationLink,
                timestamp: new Date().toISOString(),
                flow: ["welcome", "safety", "save", "whatsapp"],
                messagePrice: welcomeMessagePrice,
                debugSteps: debugSteps,
              }),
            },
          })

          return { tempCustomer, chatSession }
        })

        // ✅ STEP 9: SAVE debugSteps for Message Flow Timeline (AFTER transaction)
        debugSteps.push({
          type: "save",
          agent: "Database Save",
          timestamp: new Date().toISOString(),
          output: {
            conversationId: chatSession.id,
            customerId: tempCustomer.id,
          },
        })

        debugSteps.push({
          type: "whatsapp",
          agent: "WhatsApp Send",
          timestamp: new Date().toISOString(),
          output: {
            status: "queued",
            recipient: phoneNumber,
          },
        })

        // 💰 STEP 9: Track welcome message cost
        // NOTE: This is OUTSIDE transaction intentionally - billing failure shouldn't rollback user creation
        try {
          const { BillingService } = await import(
            "../../../application/services/billing.service"
          )
          const billingService = new BillingService(prisma)

          await billingService.trackMessage(
            workspaceId,
            tempCustomer.id,
            "Welcome message - New user registration",
            finalMessage
          )

          logger.info(
            `[WEBHOOK] 💰 Welcome message cost tracked: $${welcomeMessagePrice.toFixed(2)} for customer ${tempCustomer.id}`
          )
        } catch (billingError) {
          logger.error(
            `[WEBHOOK] ❌ Failed to track welcome message billing:`,
            billingError
          )
          // Don't fail the flow if billing fails
        }

        // ✅ STEP 10: Return success response
        logger.info(
          "[WEBHOOK] ✅ Welcome message prepared and saved to chat history",
          {
            message: finalMessage,
            language: finalLanguage,
            registrationLink,
            customerId: tempCustomer.id,
            sessionId: chatSession.id,
          }
        )

        res.status(200).json({
          status: "new_user_welcomed",
          message: finalMessage,
          language: finalLanguage,
          registrationLink,
          customerId: tempCustomer.id,
          sessionId: chatSession.id,
        })
        return
      }

      logger.info("[WEBHOOK] ✅ Customer found", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        customerName: customer.name,
      })

      // 🔍 CRITICAL FIX: Check if customer has chat history
      // If NO messages exist → send welcome message (even if customer is registered)
      // This handles scenario: registered customer with deleted chat history

      // Get all chat sessions for this customer on WhatsApp channel
      const sessions = await prisma.chatSession.findMany({
        where: {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
          channel: "whatsapp", // 🔧 CHANNEL ISOLATION (Widget messages don't affect WhatsApp)
        },
        select: { id: true },
      })

      const sessionIds = sessions.map((s) => s.id)

      // Count only REAL user messages (exclude assistant/system/REGISTRATION_FLOW)
      const messageCount = await prisma.conversationMessage.count({
        where: {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
          role: "user", // 🔧 ONLY user messages (exclude assistant/system)
          agentType: {
            not: "REGISTRATION_FLOW", // 🔧 EXCLUDE registration flow messages
          },
          ...(sessionIds.length > 0 ? { conversationId: { in: sessionIds } } : {}), // 🔧 CHANNEL SCOPING
        },
      })

      if (messageCount === 0) {
        logger.info("[WEBHOOK] 📭 Customer has NO chat history - sending welcome message", {
          customerId: customer.id,
          phone: customer.phone,
        })

        // 🎉 REDIRECT TO WELCOME MESSAGE FLOW
        // Re-use same logic as new customer (lines 598-993)
        // But skip customer creation - use existing customer record

        // ✅ STEP 1: Billing checks (credit + customer limit already met)
        // Skip trial check - existing customer already passed this
        // Skip customer limit check - customer already exists
        // Only check credit balance for welcome message

        const { SubscriptionBillingService } = await import(
          "../../../application/services/subscription-billing.service"
        )
        const billingService = new SubscriptionBillingService(prisma)

        const messageCost = await billingService.getOperationCost(
          customer.workspaceId,
          "message"
        )
        const creditCheck = await billingService.checkCredit(
          customer.workspaceId,
          messageCost
        )

        if (!creditCheck.hasSufficientCredit) {
          logger.warn("[WEBHOOK] ❌ Insufficient credit for welcome message", {
            workspaceId: customer.workspaceId,
            balance: creditCheck.currentBalance,
            required: messageCost,
          })
          res.status(402).json({
            status: "billing_error",
            code: "INSUFFICIENT_CREDIT",
            message: "Insufficient credit. Please recharge your account.",
            currentBalance: creditCheck.currentBalance,
            required: messageCost,
          })
          return
        }

        // ✅ STEP 2: Get workspace data
        const workspace = await prisma.workspace.findUnique({
          where: { id: customer.workspaceId },
          select: {
            id: true,
            name: true,
            welcomeMessage: true,
            defaultLanguage: true,
            needRegistration: true, // 🔧 Controls whether registration is required
            ownerId: true,
            owner: {
              select: { status: true },
            },
          },
        })

        if (!workspace) {
          logger.error("[WEBHOOK] ⚠️ Workspace not found", {
            workspaceId: customer.workspaceId,
          })
          res.status(404).json({ error: "Workspace not found" })
          return
        }

        // 🚫 OWNER STATUS CHECK: Block if owner is INACTIVE
        if (workspace.owner?.status === "INACTIVE") {
          logger.warn("[WEBHOOK] ❌ Message blocked: Owner inactive", {
            workspaceId: customer.workspaceId,
            ownerId: workspace.ownerId,
          })
          res.status(200).json({ success: true, message: "Message received" })
          return
        }

        // ✅ STEP 3: Language detection
        // Priority: customer.language (from profile) → phone prefix → workspace.defaultLanguage
        const detectedLanguageFromPhone =
          detectLanguageFromPhonePrefix(customer.phone)
        const finalLanguage =
          customer.language ||
          detectedLanguageFromPhone ||
          workspace.defaultLanguage
        logger.info(
          "[WEBHOOK] 📱 Language resolution for EXISTING customer",
          {
            customerId: customer.id,
            customerLanguage: customer.language,
            detectedFromPhone: detectedLanguageFromPhone,
            workspaceDefault: workspace.defaultLanguage,
            finalLanguage,
          }
        )

        // ✅ STEP 4: Generate registration link (if not already registered)
        let registrationLink = ""
        let registrationTexts: any = { link: "", validity: "" }

        if (!customer.isActive && workspace.needRegistration !== false) {
          // Customer exists but not registered AND workspace requires registration → generate link
          const secureTokenService = new SecureTokenService()
          const urlShortenerService = new UrlShortenerService()

          const registrationToken = await secureTokenService.createToken(
            "registration",
            customer.workspaceId,
            { phoneNumber: customer.phone, language: finalLanguage },
            "24h",
            undefined,
            customer.phone,
            undefined,
            customer.id // Pass existing customerId
          )

          const { url: workspaceUrl, registrationPage } =
            await workspaceService.getWorkspaceURLWithRegistration(
              customer.workspaceId
            )

          const { LinkGeneratorService } = require("../../../application/services/link-generator.service")
          const linkGeneratorService = new LinkGeneratorService()
          registrationLink =
            await linkGeneratorService.generateRegistrationLink(
              registrationToken,
              workspaceUrl,
              customer.workspaceId,
              registrationPage,
              finalLanguage // 🌍 Pass customer language for registration page i18n
            )

          registrationTexts = getRegistrationText(finalLanguage)
        } else if (!customer.isActive && workspace.needRegistration === false) {
          logger.info("[WEBHOOK] 📋 needRegistration=false — skipping registration link for existing customer", {
            customerId: customer.id,
            workspaceId: customer.workspaceId,
          })
        }

        // ✅ STEP 5: Process welcome message template
        const { PromptVariableBuilder } = require("../../../application/services/prompt-variable-builder.service")
        const { PromptProcessorService } = require("../../../services/prompt-processor.service")

        const variables = PromptVariableBuilder.build(customer, workspace, {})
        const promptProcessor = new PromptProcessorService()

        const welcomeMessageTemplate =
          workspace.welcomeMessage || "Welcome! How can I help you?"
        const welcomeMessage = promptProcessor.processWithVariables(
          welcomeMessageTemplate,
          variables
        )

        // Replace [LINK_REGISTRATION] placeholder with actual link
        // 🔧 FIX: Only append footer if template does NOT contain [LINK_REGISTRATION]
        const hasRegistrationToken = welcomeMessage.includes("[LINK_REGISTRATION]")
        let rawWelcomeMessage: string
        
        if (hasRegistrationToken && registrationLink) {
          // Template has [LINK_REGISTRATION] AND we have a link → replace inline, no footer
          rawWelcomeMessage = welcomeMessage.replace(/\[LINK_REGISTRATION\]/g, registrationLink)
        } else if (hasRegistrationToken && !registrationLink) {
          // Template has [LINK_REGISTRATION] but no link (needRegistration=false) → remove placeholder
          rawWelcomeMessage = welcomeMessage.replace(/\[LINK_REGISTRATION\]/g, "").replace(/\n{3,}/g, "\n\n").trim()
        } else if (!customer.isActive && registrationLink) {
          // Template does NOT have [LINK_REGISTRATION] → append footer
          rawWelcomeMessage = `${welcomeMessage}\n\n${registrationTexts.link}: ${registrationLink}\n${registrationTexts.validity}`
        } else {
          rawWelcomeMessage = welcomeMessage
        }

        // ✅ STEP 6: Translation Layer
        let finalMessage = rawWelcomeMessage
        let translationTokensUsed = 0
        const debugSteps: any[] = []

        try {
          const { TranslationAgent } = require("../../../application/agents/TranslationAgent")
          const translationAgent = new TranslationAgent(prisma)

          debugSteps.push({
            type: "welcome",
            agent: "Welcome Message Generator (Existing Customer)",
            timestamp: new Date().toISOString(),
            input: {
              phoneNumber: customer.phone,
              language: finalLanguage,
              customerId: customer.id,
            },
            output: {
              welcomeMessage: rawWelcomeMessage,
            },
            tokenUsage: {
              totalTokens: 0,
            },
          })

          const translationResult = await translationAgent.process({
            workspaceId: customer.workspaceId,
            message: rawWelcomeMessage,
            targetLanguage: finalLanguage,
            customerName: customer.name,
            channel: "whatsapp",
          })

          finalMessage = translationResult.message || rawWelcomeMessage
          translationTokensUsed = translationResult.tokensUsed || 0

          debugSteps.push({
            type: "safety",
            agent: "Translation Layer",
            model: "openai/gpt-4o-mini",
            temperature: 0.2,
            timestamp: new Date().toISOString(),
            systemPrompt: translationResult.systemPrompt || "Translation Layer",
            input: {
              originalMessage: rawWelcomeMessage,
              targetLanguage: finalLanguage,
              customerName: customer.name,
            },
            output: {
              translatedMessage: finalMessage,
              decision: translationResult.translated
                ? "translated"
                : "passthrough",
            },
            tokenUsage: {
              totalTokens: translationTokensUsed,
            },
          })

          logger.info(
            "[WEBHOOK] 🌍 Welcome message translated for existing customer",
            {
              customerId: customer.id,
              tokensUsed: translationTokensUsed,
            }
          )
        } catch (translationError) {
          logger.error(
            "[WEBHOOK] ❌ Translation error - using raw message",
            translationError
          )
          finalMessage = rawWelcomeMessage
        }

        // ✅ STEP 7: Create session + save messages (transaction)
        const welcomeMessagePrice = await platformConfigService.getPrice(
          "MESSAGE"
        )

        const chatSession = await prisma.$transaction(async (tx) => {
          // Create new chat session for existing customer
          const session = await tx.chatSession.create({
            data: {
              customerId: customer.id,
              workspaceId: customer.workspaceId,
              status: "active",
              context: {
                createdBy: "whatsapp-webhook",
                phoneNumber: customer.phone,
                trigger: "no_chat_history",
              },
            },
          })

          // Save user's first message
          await tx.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: session.id,
              role: "user",
              content: messageMarkdown,
              agentType: "CUSTOMER",
              tokensUsed: 0,
              deliveryStatus: "delivered",
              debugInfo: JSON.stringify({
                source: "whatsapp-webhook",
                type: "first_message_existing_customer",
                timestamp: new Date().toISOString(),
              }),
            },
          })

          // Save welcome message
          await tx.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: session.id,
              role: "assistant",
              content: finalMessage,
              agentType: "REGISTRATION_FLOW",
              tokensUsed: translationTokensUsed,
              deliveryStatus: "not_queued",
              debugInfo: JSON.stringify({
                source: "whatsapp-webhook",
                type: "welcome_existing_customer_no_history",
                language: finalLanguage,
                registrationLink: registrationLink || "already_registered",
                timestamp: new Date().toISOString(),
                flow: ["welcome", "safety", "save", "whatsapp"],
                messagePrice: welcomeMessagePrice,
                debugSteps: debugSteps,
              }),
            },
          })

          return session
        })

        // ✅ STEP 8: Track billing (outside transaction)
        try {
          const { BillingService } = await import(
            "../../../application/services/billing.service"
          )
          const billingServiceTracker = new BillingService(prisma)

          await billingServiceTracker.trackMessage(
            customer.workspaceId,
            customer.id,
            "Welcome message - Existing customer (no history)",
            finalMessage
          )

          logger.info(
            `💰 [WEBHOOK] Welcome message cost tracked for existing customer: $${welcomeMessagePrice.toFixed(2)}`,
            {
              customerId: customer.id,
              sessionId: chatSession.id,
            }
          )
        } catch (billingError) {
          logger.error(
            "❌ [WEBHOOK] Failed to track welcome message billing:",
            billingError
          )
          // Don't fail the flow
        }

        debugSteps.push({
          type: "save",
          agent: "Database Save",
          timestamp: new Date().toISOString(),
          output: {
            conversationId: chatSession.id,
            customerId: customer.id,
          },
        })

        debugSteps.push({
          type: "whatsapp",
          agent: "WhatsApp Send",
          timestamp: new Date().toISOString(),
          output: {
            status: "queued",
            recipient: customer.phone,
          },
        })

        logger.info(
          "[WEBHOOK] ✅ Welcome message sent to existing customer (no history)",
          {
            customerId: customer.id,
            sessionId: chatSession.id,
            language: finalLanguage,
            translated: translationTokensUsed > 0,
          }
        )

        res.status(200).json({
          status: "existing_customer_welcomed",
          message: finalMessage,
          language: finalLanguage,
          registrationLink: registrationLink || "already_registered",
          customerId: customer.id,
          sessionId: chatSession.id,
        })
        return
      }

      // Customer has chat history → continue to normal LLM processing
      logger.info("[WEBHOOK] 📚 Customer has chat history - continuing normal flow", {
        customerId: customer.id,
        messageCount,
      })

      // 🚦 RATE LIMIT CHECK (token bucket): prevent abuse but allow bursts
      const [
        customerPerMin,
        customerBurst,
        workspacePerMin,
        workspaceBurst,
      ] = await Promise.all([
        platformConfigService.getLimit("WHATSAPP_RATE_LIMIT_CUSTOMER_PER_MIN"),
        platformConfigService.getLimit("WHATSAPP_RATE_LIMIT_CUSTOMER_BURST"),
        platformConfigService.getLimit("WHATSAPP_RATE_LIMIT_WORKSPACE_PER_MIN"),
        platformConfigService.getLimit("WHATSAPP_RATE_LIMIT_WORKSPACE_BURST"),
      ])

      const customerRateLimitKey = `customer:${customer.id}`
      const customerLimiterConfig = buildTokenBucketConfig(
        customerPerMin,
        customerBurst
      )
      if (!whatsappMessageRateLimiter.isAllowed(customerRateLimitKey, customerLimiterConfig)) {
          const timeToReset = whatsappMessageRateLimiter.getTimeToReset(
            customerRateLimitKey,
            customerLimiterConfig
          )
          logger.warn("[WEBHOOK] 🚫 Rate limit exceeded for customer", {
            customerId: customer.id,
            timeToResetMs: timeToReset,
            limitPerMin: customerPerMin,
          })
          // ✅ Return 200 to prevent Meta retries (duplicates)
          res.status(200).json({
            status: "rate_limited",
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many messages. Please wait before sending more.",
            retryAfterMs: timeToReset,
          })
          return
        }

        // 🚦 RATE LIMIT CHECK: Workspace-wide cap (token bucket)
        const workspaceRateLimitKey = `workspace:${customer.workspaceId}`
        const workspaceLimiterConfig = buildTokenBucketConfig(
          workspacePerMin,
          workspaceBurst
        )
        if (!whatsappWorkspaceRateLimiter.isAllowed(workspaceRateLimitKey, workspaceLimiterConfig)) {
          const timeToReset = whatsappWorkspaceRateLimiter.getTimeToReset(
            workspaceRateLimitKey,
            workspaceLimiterConfig
          )
          logger.warn("[WEBHOOK] 🚫 Rate limit exceeded for workspace", {
            workspaceId: customer.workspaceId,
            timeToResetMs: timeToReset,
            limitPerMin: workspacePerMin,
          })
          // ✅ Return 200 to prevent Meta retries (duplicates)
          res.status(200).json({
            status: "rate_limited",
            code: "WORKSPACE_RATE_LIMIT_EXCEEDED",
            message: "Too many messages in this channel. Please wait.",
            retryAfterMs: timeToReset,
          })
          return
        }

      // 🆕 Feature 174: Removed 5-message limit for unregistered users - they can chat freely
      // Registration required only when attempting protected functions (cart/orders/profile)

      // ❌ REMOVED: WhatsApp config check (not needed - we're not sending via WhatsApp yet)
      // TODO: Re-enable when WhatsApp queue is implemented
      // For now: process message → save to DB → return ok (no actual WhatsApp sending)

      // 🔄 Convert WhatsApp format → Markdown (for internal storage)
      const messageMarkdown = whatsAppToMarkdown(messageText)

      // 🔒 CRITICAL: If chatbot is disabled, ONLY save message - DO NOT process with LLM
      if (customer && !customer.activeChatbot) {
        logger.info(
          `🚫 [WEBHOOK] Chatbot disabled for customer ${customer.id} - saving message without LLM processing`
        )

        // Get or create chat session
        let chatSession = await prisma.chatSession.findFirst({
          where: {
            customerId: customer.id,
            workspaceId: customer.workspaceId,
            status: "active",
          },
        })

        if (!chatSession) {
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

        // Save customer message to conversationMessage table
        const savedMessage = await prisma.conversationMessage.create({
          data: {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: "user", // Customer message
            content: messageMarkdown,
            agentType: "NONE", // No agent processing
            tokensUsed: 0,
            debugInfo: JSON.stringify({
              chatbotDisabled: true,
              reason: "activeChatbot = false",
              timestamp: new Date().toISOString(),
              source: "whatsapp-webhook",
            }),
          },
        })

        // 🔔 Notify realtime clients (chat list + message thread)
        try {
          websocketService.notifyNewMessage(customer.workspaceId, {
            id: savedMessage.id,
            sessionId: chatSession.id,
            content: messageMarkdown,
            sender: "customer",
            timestamp: savedMessage.createdAt.toISOString(),
            workspaceId: customer.workspaceId,
            metadata: {
              chatbotDisabled: true,
              source: "whatsapp-webhook",
            },
          })
          websocketService.notifyChatUpdated(customer.workspaceId, {
            sessionId: chatSession.id,
            lastMessage: messageMarkdown.substring(0, 100),
            lastMessageAt: savedMessage.createdAt.toISOString(),
            customerId: customer.id,
          })
        } catch (wsError) {
          logger.warn("[WEBHOOK] ⚠️ Failed to notify WebSocket for chatbot-disabled message", {
            error: wsError,
            workspaceId: customer.workspaceId,
            customerId: customer.id,
          })
        }

        // 🔀 RELAY TUNNEL: Forward customer message to operator via WhatsApp
        // Only relay if the customer has a queue position (actively in operator mode)
        try {
          const { OperatorRelayService } = require("../../../application/services/operator-relay.service")
          const operatorRelayService = new OperatorRelayService(prisma)
          await operatorRelayService.relayCustomerMessageToOperator(
            customer.workspaceId,
            { id: customer.id, name: customer.name, phone: customer.phone },
            messageMarkdown
          )
        } catch (relayError) {
          // Non-critical: relay failure should not prevent the response
          logger.warn("[WEBHOOK] ⚠️ Failed to relay customer message to operator", {
            error: relayError,
            customerId: customer.id,
            workspaceId: customer.workspaceId,
          })
        }

        // Return success WITHOUT processing with LLM
        res.status(200).json({
          status: "message_saved",
          message: "Message saved (chatbot disabled)",
          chatbotDisabled: true,
          sessionId: chatSession.id,
        })
        return
      }

      // 💾 Get or create active chat session BEFORE LLM call
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

      // 🔒 SECURITY CHECK: Validate message before processing with LLM
      logger.info("[WEBHOOK] 🔍 Starting security validation for WhatsApp message", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        phoneNumber: customer.phone,
      })

      let securityResults
      try {
        securityResults = await SecurityCheckService.validateMessage({
          workspaceId: customer.workspaceId,
          visitorId: customer.phone, // Use phone as visitorId for WhatsApp
          message: messageMarkdown,
          channel: "whatsapp",
        })
        logger.info("[WEBHOOK] ✅ Security validation completed", { 
          resultsCount: securityResults.length,
          customerId: customer.id,
        })
      } catch (securityError) {
        logger.error("[WEBHOOK] ❌ Security validation error", {
          error: securityError instanceof Error ? securityError.message : String(securityError),
          stack: securityError instanceof Error ? securityError.stack : undefined,
          customerId: customer.id,
          workspaceId: customer.workspaceId,
        })
        
        // Return 500 to prevent message processing
        res.status(500).json({
          status: "security_check_error",
          code: "SECURITY_CHECK_ERROR",
          message: "Failed to validate message security",
        })
        return
      }

      // Check if any security step failed
      const failedStep = securityResults.find((result) => !result.passed)
      if (failedStep) {
        logger.warn("[WEBHOOK] 🚨 Security check failed - message blocked", {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
          phoneNumber: customer.phone,
          step: failedStep.step,
          reason: failedStep.reason,
        })

        // Save blocked message to history for admin review
        await prisma.conversationMessage.create({
          data: {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: "user",
            content: messageMarkdown,
            agentType: "NONE",
            tokensUsed: 0,
            debugInfo: JSON.stringify({
              securityBlocked: true,
              failedStep: failedStep.step,
              reason: failedStep.reason,
              timestamp: new Date().toISOString(),
              source: "whatsapp-webhook",
            }),
          },
        })

        // Return 429 with retry information
        res.status(429).json({
          status: "security_blocked",
          code: failedStep.step,
          message: failedStep.reason || "Security check failed",
          retryAfter: failedStep.retryAfter,
        })
        return
      }

      logger.info("[WEBHOOK] ✅ Security validation passed", { customerId: customer.id })

      // 🔒 Feature 197: Check workspace access BEFORE billing
      // This handles: PAUSED, PAYMENT_FAILED, CREDIT_EXHAUSTED (< -$10), DEBUG_MODE (WIP), CHANNEL_DISABLED (silent)
      // 🧪 PLAYGROUND: skip debug/WIP check — playground must always work regardless of debugMode
      const { WorkspaceAccessService } = await import(
        "../../../application/services/workspace-access.service"
      )
      const workspaceAccessService = new WorkspaceAccessService(prisma)
      
      // Check ALL access conditions including channel status
      // RULE: debugMode=true → WIP message — but NOT for Playground!
      const accessResult = isPlayground
        ? { canProcess: true, blockReason: null, message: null }
        : await workspaceAccessService.canProcessMessages(
            customer.workspaceId,
            false // DO check channelStatus - WIP mode needs special handling
          )

      // 🛠️ DebugFlow: FLOW workspaces process normally in debugMode
      // Strategy appends debug trace to response instead of blocking with WIP
      if (!accessResult.canProcess && accessResult.blockReason === "DEBUG_MODE") {
        const wsMode = await prisma.workspace.findUnique({
          where: { id: customer.workspaceId },
          select: { channelMode: true },
        })
        if (wsMode?.channelMode === "FLOW") {
          logger.info("[WEBHOOK] 🛠️ DebugFlow (existing user) - FLOW workspace bypasses WIP, processing normally", {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
          })
          accessResult.canProcess = true
          accessResult.blockReason = null
        }
      }

      if (!accessResult.canProcess) {
        // 🚫 CHANNEL_DISABLED → Silent block (no response)
        if (accessResult.blockReason === "CHANNEL_DISABLED") {
          logger.info("[WEBHOOK] 🚫 Channel disabled - saving message without response", {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
          })

          const savedMessage = await prisma.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: "user",
              content: messageMarkdown,
              agentType: "NONE",
              tokensUsed: 0,
              debugInfo: JSON.stringify({
                channelDisabled: true,
                reason: "workspace.channelStatus = false",
                timestamp: new Date().toISOString(),
                source: "whatsapp-webhook",
              }),
            },
          })

          // 🔔 Notify realtime clients (chat list + message thread)
          try {
            websocketService.notifyNewMessage(customer.workspaceId, {
              id: savedMessage.id,
              sessionId: chatSession.id,
              content: messageMarkdown,
              sender: "customer",
              timestamp: savedMessage.createdAt.toISOString(),
              workspaceId: customer.workspaceId,
              metadata: {
                channelDisabled: true,
                source: "whatsapp-webhook",
              },
            })
            websocketService.notifyChatUpdated(customer.workspaceId, {
              sessionId: chatSession.id,
              lastMessage: messageMarkdown.substring(0, 100),
              lastMessageAt: savedMessage.createdAt.toISOString(),
              customerId: customer.id,
            })
          } catch (wsError) {
            logger.warn("[WEBHOOK] ⚠️ Failed to notify WebSocket for channel-disabled message", {
              error: wsError,
              workspaceId: customer.workspaceId,
              customerId: customer.id,
            })
          }

          res.status(200).json({
            status: "channel_disabled",
            code: "CHANNEL_DISABLED",
            message: "Channel is disabled.",
          })
          return
        }

        // 🚧 DEBUG_MODE → Send WIP message
        if (accessResult.blockReason === "DEBUG_MODE") {
          logger.info("[WEBHOOK] 🚧 Debug mode (WIP) - sending maintenance message", {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
          })
          
          const workspace = await prisma.workspace.findUnique({
            where: { id: customer.workspaceId },
            select: { 
              wipMessage: true,
              defaultLanguage: true, // 🌍 For language fallback
              ownerId: true,
              owner: {
                select: { status: true }
              }
            },
          })

          // 🚫 OWNER STATUS CHECK: Block if owner is INACTIVE
          if (workspace?.owner?.status === "INACTIVE") {
            logger.warn("[WEBHOOK] ❌ WIP message blocked: Owner inactive", {
              workspaceId: customer.workspaceId,
              ownerId: workspace.ownerId,
            })
            res.status(200).json({ success: true, message: "Message received" })
            return
          }

          const rawWipMessage = workspace?.wipMessage || "Work in progress. Please contact us later."
          
          // 🌍 TRANSLATE WIP message to customer's language
          // Language priority: customer.language → phone prefix (only IT/ES/PT) → workspace.defaultLanguage
          const customerLang = customer.language 
            || detectLanguageFromPhonePrefix(customer.phone) 
            || workspace.defaultLanguage // NOT nullable - set during channel registration
          
          let finalWipMessage = rawWipMessage
          let translationTokensUsed = 0
          
          try {
            const { TranslationAgent } = require("../../../application/agents/TranslationAgent")
            const translationAgent = new TranslationAgent(prisma)
            const translationResult = await translationAgent.process({
              workspaceId: customer.workspaceId,
              message: rawWipMessage,
              targetLanguage: customerLang,
              customerName: customer.name || "Customer",
              customerId: customer.id,
              channel: "whatsapp",
            })
            finalWipMessage = translationResult.message || rawWipMessage
            translationTokensUsed = translationResult.tokensUsed || 0
            logger.info("[WEBHOOK] 🌍 WIP message translated", {
              from: rawWipMessage.substring(0, 50),
              to: finalWipMessage.substring(0, 50),
              language: customerLang,
            })
          } catch (translationError) {
            logger.warn("[WEBHOOK] ⚠️ WIP translation failed, using raw message", {
              error: translationError,
            })
          }

          // Save WIP message to history so operator can see customer tried to contact
          const userMessage = await prisma.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: "user",
              content: messageMarkdown,
              agentType: "NONE",
              tokensUsed: 0,
              debugInfo: JSON.stringify({
                channelDisabled: true,
                reason: "workspace.channelStatus = false (WIP mode)",
                timestamp: new Date().toISOString(),
                source: "whatsapp-webhook",
              }),
            },
          })

          const assistantMessage = await prisma.conversationMessage.create({
            data: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: "assistant",
              content: finalWipMessage,
              agentType: "ROUTER",
              tokensUsed: translationTokensUsed,
              deliveryStatus: "pending",
              debugInfo: JSON.stringify({
                channelDisabled: true,
                reason: "workspace.channelStatus = false (WIP mode)",
                timestamp: new Date().toISOString(),
                source: "whatsapp-webhook",
              }),
            },
          })

          // 🔔 Notify realtime clients (user + assistant)
          try {
            websocketService.notifyNewMessage(customer.workspaceId, {
              id: userMessage.id,
              sessionId: chatSession.id,
              content: messageMarkdown,
              sender: "customer",
              timestamp: userMessage.createdAt.toISOString(),
              workspaceId: customer.workspaceId,
              metadata: {
                debugMode: true,
                source: "whatsapp-webhook",
              },
            })
            websocketService.notifyNewMessage(customer.workspaceId, {
              id: assistantMessage.id,
              sessionId: chatSession.id,
              content: finalWipMessage,
              sender: "agent",
              timestamp: assistantMessage.createdAt.toISOString(),
              workspaceId: customer.workspaceId,
              metadata: {
                debugMode: true,
                source: "whatsapp-webhook",
              },
            })
            websocketService.notifyChatUpdated(customer.workspaceId, {
              sessionId: chatSession.id,
              lastMessage: finalWipMessage.substring(0, 100),
              lastMessageAt: assistantMessage.createdAt.toISOString(),
              customerId: customer.id,
            })
          } catch (wsError) {
            logger.warn("[WEBHOOK] ⚠️ Failed to notify WebSocket for debug WIP message", {
              error: wsError,
              workspaceId: customer.workspaceId,
              customerId: customer.id,
            })
          }

          try {
            const { WhatsAppQueueService } = require("../../../services/whatsapp-queue.service")
            const queueService = new WhatsAppQueueService(prisma)
            await queueService.enqueue({
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              phoneNumber: customer.phone,
              messageContent: finalWipMessage,
              conversationMessageId: assistantMessage.id,
            })
          } catch (error) {
            logger.error("[WEBHOOK] ❌ Failed to enqueue WIP message", {
              error,
              workspaceId: customer.workspaceId,
              customerId: customer.id,
            })
          }
          
          res.status(200).json({
            status: "debug_wip",
            code: "DEBUG_MODE",
            message: "Channel is in maintenance mode. Your message has been saved.",
            wipMessage: finalWipMessage,
          })
          return
        }
        
        // Silent block for billing issues (PAUSED, PAYMENT_FAILED, CREDIT_EXHAUSTED, OWNER_DELETED)
        logger.warn("[WEBHOOK] 🚫 Feature 197: Workspace blocked - SILENT BLOCK", {
          workspaceId: customer.workspaceId,
          customerId: customer.id,
          blockReason: accessResult.blockReason,
          message: accessResult.message,
        })

        // 🚨 CRITICAL: DO NOT save message, DO NOT respond - completely silent
        // Customer won't see any response, message won't appear in history
        res.status(402).json({
          status: "workspace_blocked",
          code: accessResult.blockReason,
          message: accessResult.message,
        })
        return
      }

      // 💰 BILLING CHECK: Verify credit before processing with LLM (skip for playground)
      if (!isPlayground) {
        const { SubscriptionBillingService } = await import(
          "../../../application/services/subscription-billing.service"
        )
        const billingService = new SubscriptionBillingService(prisma)

        // Check trial validity first
        const trialStatus = await billingService.isTrialValid(customer.workspaceId)
        if (trialStatus.isTrialPlan && !trialStatus.isValid) {
          logger.warn("[WEBHOOK] 💰 Trial expired - SILENT BLOCK (no save, no response)", {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
          })

          // 🚨 CRITICAL: DO NOT save message, DO NOT respond - completely silent
          // Customer won't see any response, message won't appear in history
          res.status(402).json({
            status: "billing_error",
            code: "TRIAL_EXPIRED",
            message: "Trial period has expired. Please upgrade your plan.",
          })
          return
        }

        // Check credit balance
        const messageCost = await billingService.getOperationCost(customer.workspaceId, "message")
        const creditCheck = await billingService.checkCredit(customer.workspaceId, messageCost)

        if (!creditCheck.hasSufficientCredit) {
          logger.warn("[WEBHOOK] 💰 Insufficient credit - SILENT BLOCK (no save, no response)", {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            currentBalance: creditCheck.currentBalance,
            requiredAmount: messageCost,
          })

          // 🚨 CRITICAL: DO NOT save message, DO NOT respond - completely silent
          // Chatbot remains "mute" - no history, no LLM processing, nothing
          res.status(402).json({
            status: "billing_error",
            code: "INSUFFICIENT_CREDIT",
            message: "Insufficient credit. Please recharge your account.",
            details: {
              currentBalance: creditCheck.currentBalance,
              requiredAmount: messageCost,
            },
          })
          return
        }
      } else {
        logger.info("[WEBHOOK] 🧪 Playground mode - skipping trial/credit checks")
      }

      // 📊 REGISTRATION PROMPT: Calculate level for unregistered users
      // If workspace does not require registration, always use level 0 (no nudge)
      const registrationPromptLevel = customer.workspace?.needRegistration === false
        ? 0
        : registrationPromptService.getPromptLevel(
          messageCount,
          customer.isActive // isActive = registered in DB schema
        )

      logger.info("[WEBHOOK] 📊 Registration prompt level", {
        customerId: customer.id,
        messageCount,
        isRegistered: customer.isActive,
        promptLevel: registrationPromptLevel,
      })

      // 🤖 Process with ChatEngineService (CODE decides, LLM formats)
      logger.info("[WEBHOOK] 🎯 Calling ChatEngineService", {
        customerId: customer.id,
        conversationId: chatSession.id,
        messageLength: messageMarkdown.length,
        customerLanguage: customer.language, // 🔍 DEBUG: What language is in DB?
        customerName: customer.name,
        customerDiscount: customer.discount, // 💰 DEBUG: What discount is configured?
        registrationPromptLevel,
      })

      const chatEngine = getChatEngine(prisma)
      
      // 🌍 Language detection with normalization
      // ALWAYS normalize customer.language to 2-letter code (es, it, en, pt, fr, de)
      const normalizeLanguage = (lang: string | null): string => {
        if (!lang) return ""
        const lower = lang.toLowerCase().trim()
        // Map common variants to 2-letter codes
        const map: Record<string, string> = {
          "español": "es", "spanish": "es", "esp": "es", "es": "es",
          "italiano": "it", "italian": "it", "ita": "it", "it": "it",
          "english": "en", "inglés": "en", "eng": "en", "en": "en",
          "português": "pt", "portuguese": "pt", "por": "pt", "pt": "pt",
          "français": "fr", "french": "fr", "fra": "fr", "fr": "fr",
          "deutsch": "de", "german": "de", "deu": "de", "de": "de"
        }
        return map[lower] || ""
      }
      
      const normalizedCustomerLang = normalizeLanguage(customer.language)
      const detectedLang = detectLanguageFromPhonePrefix(customer.phone)
      const customerLanguage =
        normalizedCustomerLang ||
        detectedLang ||
        normalizeLanguage(customer.workspace?.defaultLanguage || "") ||
        "en" // Fallback to workspace default; final safety is English
      
      logger.info("🌍 [ULTRAMSG] Language resolution", {
        customerLanguageRaw: customer.language,
        normalizedCustomerLang,
        detectedFromPhone: detectedLang,
        finalLanguage: customerLanguage,
        phone: customer.phone
      })
      
      const routerResult = await chatEngine.routeMessage({
        workspaceId: customer.workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        message: messageMarkdown,
        customerLanguage, // 🌍 Normalized language
        customerName: customer.name,
        customerDiscount: customer.discount || 0, // 💰 Pass customer discount
        isPlayground, // 🧪 Pass playground flag
        channel: "whatsapp",
        registrationPromptLevel, // 🆕 Progressive registration invitation
      })

      logger.info("[WEBHOOK] ✅ ChatEngineService completed", {
        agentUsed: routerResult.agentUsed,
        tokensUsed: routerResult.tokensUsed,
        executionTimeMs: routerResult.executionTimeMs,
        wasFAQ: routerResult.wasFAQ,
        responseLength: routerResult.response?.length ?? 0,
        isBlocked: routerResult.isBlocked, // 🆕 P1: Log if customer was blocked
      })

      // 🚫 P1: If customer is blocked, return 410 Gone WITHOUT sending message
      if (routerResult.isBlocked) {
        logger.warn("[WEBHOOK] 🚫 P1: Customer blocked - returning 410 Gone", {
          customerId: customer.id,
        })

        res.status(410).json({
          status: "blocked",
          message: "Customer is blocked",
        })
        return
      }

      // ✅ Messages already saved by ChatEngine.saveMessages() (INBOUND + OUTBOUND)
      // ✅ debugInfo already saved with timeline
      // 💰 BILLING: Credit is deducted by WhatsApp Queue Cronjob when message is actually sent
      //    (not here - we only check credit availability before processing)

      // 📤 QUEUE: Save response to WhatsApp queue for delivery
      logger.info("[WEBHOOK] 📤 Saving response to WhatsApp queue", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        responseLength: routerResult.response.length,
      })

      // 🧪 PLAYGROUND: Skip queue for playground messages (testing environment)
      if (!isPlayground) {
        try {
          const { WhatsAppQueueService } = require("../../../services/whatsapp-queue.service")
          const queueService = new WhatsAppQueueService(prisma)
          
          // Find the assistant message that was just created by ChatEngine
          const assistantMessage = await prisma.conversationMessage.findFirst({
            where: {
              conversationId: chatSession.id,
              role: "assistant",
              content: routerResult.response,
            },
            orderBy: { createdAt: "desc" },
          })

          await queueService.enqueue({
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            phoneNumber: customer.phone,
            messageContent: routerResult.response,
            conversationMessageId: assistantMessage?.id,
            isPlayground, // 🧪 Pass playground flag
          })

          logger.info("[WEBHOOK] ✅ Response queued for WhatsApp delivery", {
            customerId: customer.id,
            queueStatus: "pending",
          })
        } catch (queueError) {
          logger.error("[WEBHOOK] ❌ Failed to enqueue WhatsApp response", {
            error: queueError,
            workspaceId: customer.workspaceId,
            customerId: customer.id,
          })
          // Don't fail the flow if queue fails - message is already saved in conversation
        }
      } else {
        logger.info("[WEBHOOK] 🧪 Playground mode - skipping queue (no WhatsApp send)", {
          customerId: customer.id,
        })
      }

      logger.info("[WEBHOOK] ✅ Message processed successfully", {
        customerId: customer.id,
        workspaceId: customer.workspaceId,
        responseLength: routerResult.response.length,
      })

      // 📤 Return success to client WITH THE RESPONSE MESSAGE
      res.status(200).json({
        success: true,
        status: "processed",
        data: {
          message: routerResult.response,
          sessionId: chatSession.id,
          customerId: customer.id,
        },
        agentUsed: routerResult.agentUsed,
        tokensUsed: routerResult.tokensUsed,
        response: routerResult.response, // ✅ Backwards-compatible field
        debugInfo: routerResult.debugInfo, // ✅ Include debug info for frontend debugging
      })
    } catch (error: any) {
      // 🔴 DEBUG: Log complete error stack
      console.error("[WEBHOOK CATCH BLOCK] ERROR DETAILS:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
      })
      
      logger.error("[WEBHOOK] ❌ Error processing message:", {
        error: error.message,
        stack: error.stack,
        fullError: JSON.stringify(error, null, 2),
      })

      // Still return 200 to prevent WhatsApp from retrying
      const showErrors =
        (process.env.SHOW_ERRORS ?? process.env.DEBUG_MODE ?? "true").toLowerCase() !== "false"

      res.status(200).json({ 
        error: showErrors && error?.message ? error.message : "Internal error",
        debugMessage: showErrors ? error?.message : undefined,
        code: showErrors && (error as any)?.code ? (error as any).code : undefined,
      })
    }
  }
}
