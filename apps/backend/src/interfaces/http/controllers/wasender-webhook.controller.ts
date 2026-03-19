/**
 * WasenderAPI Webhook Controller
 *
 * Handles ALL webhook events from WasenderAPI in a single endpoint:
 *   - qrcode.updated → update QR string in DB (frontend polls to show it)
 *   - session.status → update wasenderSessionStatus + channelStatus
 *   - messages.received → route to LLM chat engine (same pipeline as UltraMsg)
 *
 * WEBHOOK URL:  POST /api/wasender/webhook/:workspaceId
 * SECURITY:     Verify payload.sessionId matches workspace.wasenderApiKey
 *
 * MESSAGE PROCESSING FLOW (identical to UltraMsg):
 * 1. 🔒 Customer-level lock (race condition prevention)
 * 2. 📦 Parse payload → phone, messageBody, messageId
 * 3. 🏠 Workspace lookup by workspaceId URL param
 * 4. 🔑 SessionId verification (payload.sessionId === wasenderApiKey)
 * 5. 🚦 channelStatus check
 * 6. 📞 Phone normalization
 * 7. 👤 Customer lookup / creation
 * 8. 🔁 Deduplication (WhatsappWebhookEvent unique constraint)
 * 9. 💰 Billing / access checks
 * 10. 💬 Welcome message (first-time customer)
 * 11. 🚦 Rate limiting
 * 12. 💾 Save customer message
 * 13. 🔒 Security LLM check
 * 14. 🤖 Chat Engine (routeMessage)
 * 15. 📤 Queue delivery (WhatsAppQueueService)
 */

import { Request, Response } from 'express'
import { prisma } from '@echatbot/database'
import { WasenderClientService } from '../../../services/wasender-client.service'
import { SecurityCheckService } from '../../../application/services/security-check.service'
import { getChatEngine } from '../../../application/chat-engine'
import {
  whatsappMessageRateLimiter,
  whatsappWorkspaceRateLimiter,
} from '../../../middlewares/rateLimiter'
import { platformConfigService } from '../../../services/platform-config.service'
import { websocketService } from '../../../services/websocket.service'
import logger from '../../../utils/logger'
import { whatsAppToMarkdown } from '../../../utils/whatsapp-formatter'
import { buildPhoneVariants } from '../../../utils/phone'
import { detectLanguageFromPhonePrefix } from '../../../utils/language-detector'

const MINUTE_MS = 60_000
const buildTokenBucketConfig = (limitPerMin: number, burst: number) => ({
  capacity: limitPerMin + burst,
  refillPerMs: limitPerMin / MINUTE_MS,
})

/**
 * 🔒 CONCURRENCY CONTROL: Customer-level locks
 * Prevents race conditions when same customer sends multiple messages rapidly.
 */
const customerMessageLocks = new Map<string, Promise<void>>()

// ─── Webhook payload types ────────────────────────────────────────────────

interface WasenderSessionStatusPayload {
  event: 'session.status'
  sessionId: string // = workspace.wasenderApiKey
  data: {
    status: 'connected' | 'disconnected' | 'need_scan'
  }
}

interface WasenderQrcodeUpdatedPayload {
  event: 'qrcode.updated'
  sessionId: string
  data: {
    qr: string // raw QR string — use qrcode library to render image
  }
}

interface WasenderMessageReceivedPayload {
  event:
    | 'messages.received'
    | 'messages.upsert'
    | 'messages-personal.received'
    | 'messages-group.received'
    | 'messages-newsletter.received'
  timestamp: number
  data: {
    messages:
      | {
          key: {
            id: string
            fromMe: boolean
            remoteJid: string       // e.g. "1234567890@s.whatsapp.net"
            cleanedSenderPn?: string // e.g. "1234567890"
            senderPn?: string       // e.g. "1234567890@s.whatsapp.net"
            cleanedParticipantPn?: string // group messages
            participantPn?: string
          }
          messageBody?: string
          message?: {
            conversation?: string
            extendedTextMessage?: { text: string }
          }
        }
      | Array<{
          key: {
            id: string
            fromMe: boolean
            remoteJid: string
            cleanedSenderPn?: string
            senderPn?: string
            cleanedParticipantPn?: string
            participantPn?: string
          }
          messageBody?: string
          message?: {
            conversation?: string
            extendedTextMessage?: { text: string }
          }
        }>
  }
}

type WasenderWebhookPayload =
  | WasenderSessionStatusPayload
  | WasenderQrcodeUpdatedPayload
  | WasenderMessageReceivedPayload

// ─── Controller ───────────────────────────────────────────────────────────

export class WasenderWebhookController {
  private readonly wasenderClient = new WasenderClientService()

  /**
   * POST /api/wasender/webhook/:workspaceId
   * Single entry point for all WasenderAPI events.
   */
  async handleWebhook(req: Request, res: Response): Promise<Response> {
    const { workspaceId } = req.params
    const payload = req.body as WasenderWebhookPayload

    logger.info('[WASENDER-Webhook] Event received:', {
      workspaceId,
      event: payload.event,
    })

    // ── Route by event type ────────────────────────────────────────────────
    switch (payload.event) {
      case 'qrcode.updated':
        return await this.handleQrcodeUpdated(workspaceId, payload, res)

      case 'session.status':
        return await this.handleSessionStatus(workspaceId, payload, res)

      case 'messages.received':
      case 'messages.upsert':
      case 'messages-personal.received':
      case 'messages-group.received':
      case 'messages-newsletter.received': {
        const messagesAny = (payload as WasenderMessageReceivedPayload).data.messages
        const message = Array.isArray(messagesAny)
          ? messagesAny.find(m => !m.key?.fromMe) || messagesAny[0]
          : messagesAny

        // Skip messages the bot sent (fromMe = true)
        if (message?.key?.fromMe) {
          return res.status(200).json({ status: 'ignored', reason: 'own_message' })
        }

        // Skip messages the bot sent (fromMe = true)
        // Extract phone for customer-level locking
        const rawPhone =
          message?.key?.cleanedSenderPn ||
          message?.key?.cleanedParticipantPn ||
          ''
        if (!rawPhone) {
          return res.status(200).json({ status: 'ignored', reason: 'no_phone' })
        }
        const phoneForLock = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`

        const lockKey = `customer:${phoneForLock}`
        while (customerMessageLocks.has(lockKey)) {
          logger.info('[WASENDER] ⏳ Waiting for customer lock', { phone: phoneForLock })
          await customerMessageLocks.get(lockKey)
        }
        let releaseLock!: () => void
        const lockPromise = new Promise<void>((resolve) => { releaseLock = resolve })
        customerMessageLocks.set(lockKey, lockPromise)
        try {
          return await this.handleMessageReceived(workspaceId, payload, res)
        } finally {
          customerMessageLocks.delete(lockKey)
          releaseLock()
          logger.info('[WASENDER] 🔓 Released customer lock', { phone: phoneForLock })
        }
      }

      default:
        logger.info('[WASENDER-Webhook] Unhandled event, ignoring:', { event: (payload as any).event })
        return res.status(200).json({ status: 'ignored' })
    }
  }

  // ─── Session: QR code updated ──────────────────────────────────────────

  private async handleQrcodeUpdated(
    workspaceId: string,
    payload: WasenderQrcodeUpdatedPayload,
    res: Response
  ): Promise<Response> {
    try {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          wasenderQrString: payload.data.qr,
          wasenderQrGeneratedAt: new Date(),
          wasenderSessionStatus: 'need_scan',
        },
      })

      // Notify frontend via WebSocket (if connected)
      try {
        websocketService.notifyChatUpdated(workspaceId, {
          type: 'wasender:qr_updated',
          qrString: payload.data.qr,
          timestamp: new Date().toISOString(),
        })
      } catch {
        // WebSocket is optional — don't fail if not connected
      }

      logger.info('[WASENDER-Webhook] QR code updated:', { workspaceId })
      return res.status(200).json({ success: true })
    } catch (error: any) {
      logger.error('[WASENDER-Webhook] Failed to update QR code:', error)
      return res.status(500).json({ error: 'Failed to update QR' })
    }
  }

  // ─── Session: Status change ────────────────────────────────────────────

  private async handleSessionStatus(
    workspaceId: string,
    payload: WasenderSessionStatusPayload,
    res: Response
  ): Promise<Response> {
    const { status } = payload.data

    try {
      switch (status) {
        case 'connected': {
          // Fetch the connected phone number from WasenderAPI to store in DB
          const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { wasenderApiKey: true },
          })
          let connectedPhone: string | null = null
          if (workspace?.wasenderApiKey) {
            connectedPhone = await this.wasenderClient.getConnectedUserPhone(workspace.wasenderApiKey)
          }

          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              wasenderSessionStatus: 'connected',
              wasenderIsActive: true,
              wasenderQrString: null,
              wasenderQrGeneratedAt: null,
              channelStatus: true,
              ...(connectedPhone && { whatsappPhoneNumber: connectedPhone }),
            },
          })
          logger.info('[WASENDER-Webhook] ✅ Session connected:', { workspaceId, connectedPhone: connectedPhone ? '****' : 'unknown' })

          // Notify frontend
          try {
            websocketService.notifyChatUpdated(workspaceId, { type: 'wasender:connected' })
          } catch { /* optional */ }
          break
        }

        case 'disconnected':
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              wasenderSessionStatus: 'disconnected',
              wasenderIsActive: false,
              channelStatus: false, // Disable message queue
            },
          })
          logger.warn('[WASENDER-Webhook] ⚠️ Session disconnected:', { workspaceId })

          try {
            websocketService.notifyChatUpdated(workspaceId, { type: 'wasender:disconnected' })
          } catch { /* optional */ }
          break

        case 'need_scan':
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              wasenderSessionStatus: 'need_scan',
              wasenderIsActive: false,
              channelStatus: false,
            },
          })
          logger.info('[WASENDER-Webhook] 📱 Session needs QR scan:', { workspaceId })
          break

        default:
          logger.warn('[WASENDER-Webhook] Unknown session status:', { workspaceId, status })
      }

      return res.status(200).json({ success: true })
    } catch (error: any) {
      logger.error('[WASENDER-Webhook] Failed to handle session status:', error)
      return res.status(500).json({ error: 'Failed to update session status' })
    }
  }

  // ─── Message received → LLM pipeline ──────────────────────────────────

  private async handleMessageReceived(
    workspaceId: string,
    payload: WasenderMessageReceivedPayload,
    res: Response
  ): Promise<Response> {
    const { messages } = payload.data
    const message = Array.isArray(messages)
      ? messages.find(m => !m.key?.fromMe) || messages[0]
      : messages
    if (!message || !message.key) {
      logger.warn('[WASENDER] ⚠️ Missing message payload', { workspaceId })
      return res.status(200).json({ status: 'ignored', reason: 'no_message' })
    }
    const { key, messageBody } = message

    // Parse message data
    const rawPhone =
      key.cleanedSenderPn ||
      key.cleanedParticipantPn ||
      key.remoteJid?.replace(/@.*$/, '') ||
      ''
    const messageId = key.id
    const rawMessageText =
      messageBody ||
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      ''

    if (!rawPhone) {
      logger.error('[WASENDER] ❌ Missing phone number in payload', { workspaceId, messageId })
      return res.status(200).json({ status: 'ignored', reason: 'no_phone' })
    }

    if (!rawMessageText || rawMessageText.trim() === '') {
      logger.warn('[WASENDER] ⚠️ Empty message body - ignoring', { workspaceId })
      return res.status(200).json({ status: 'ignored', reason: 'no_text' })
    }

    // 1. 🏠 Load workspace with owner
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        wasenderApiKey: true,
        wasenderSessionStatus: true,
        wasenderIsActive: true,
        channelStatus: true,
        defaultLanguage: true,
        owner: {
          select: { status: true },
        },
      },
    })

    if (!workspace) {
      logger.warn('[WASENDER] ❌ Workspace not found:', { workspaceId })
      return res.status(404).json({ error: 'Workspace not found' })
    }

    // 2. 🔑 Verify sessionId matches workspace API key (security check)
    // messages.received payload doesn't have sessionId at top level; cast to any for session routing events
    const payloadAny = payload as any
    if (workspace.wasenderApiKey && payloadAny.sessionId && payloadAny.sessionId !== workspace.wasenderApiKey) {
      logger.warn('[WASENDER] ❌ SessionId mismatch - potential spoofing', {
        workspaceId,
        receivedSessionId: (payloadAny.sessionId as string)?.substring(0, 8) + '...',
      })
      return res.status(403).json({ error: 'Invalid session' })
    }

    // 3. 🚦 Channel status check
    if (workspace.owner?.status === 'INACTIVE' || workspace.channelStatus === false) {
      logger.warn('[WASENDER] 🚫 Channel disabled or owner inactive', { workspaceId })
      return res.status(200).json({ status: 'ignored', reason: 'channel_disabled' })
    }

    // 4. 📞 Normalize phone number
    const phoneWithPrefix = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`
    const phoneVariants = buildPhoneVariants(phoneWithPrefix)
    const phoneNumber = phoneVariants[0]

    logger.info('[WASENDER] 📞 Processing message:', {
      workspaceId,
      phone: phoneNumber.substring(0, 6) + '***',
      messageId,
    })

    // 5. 🔁 Deduplication
    if (messageId) {
      try {
        const prismaAny = prisma as any
        await prismaAny.whatsappWebhookEvent.create({
          data: {
            workspaceId,
            externalMessageId: messageId,
            channel: 'whatsapp',
          },
        })
      } catch (error: any) {
        if (error?.code === 'P2002') {
          logger.info('[WASENDER] 🔁 Duplicate message ignored', { workspaceId, messageId })
          return res.status(200).json({ status: 'duplicate' })
        }
        logger.error('[WASENDER] Deduplication error:', error)
      }
    }

    // 5.5. 👁️ Mark incoming message as read (blue ticks) — fire & forget
    if (messageId && key.remoteJid && workspace.wasenderApiKey) {
      this.wasenderClient
        .markMessageAsRead(workspace.wasenderApiKey, messageId, key.remoteJid)
        .catch(() => { /* non-critical */ })
    }

    // 6. 👤 Find or create customer
    let customer = await prisma.customers.findFirst({
      where: {
        workspaceId,
        phone: { in: phoneVariants },
      },
    })

    if (!customer) {
      logger.info('[WASENDER] 👤 New customer - creating:', { workspaceId, phone: phoneNumber })
      try {
        customer = await prisma.customers.create({
          data: {
            workspaceId,
            name: phoneNumber,
            email: `${phoneNumber.replace(/\+/, '')}@whatsapp.placeholder`,
            phone: phoneNumber,
            language: detectLanguageFromPhonePrefix(phoneNumber) || workspace.defaultLanguage,
          },
        })
      } catch (createError: any) {
        if (createError?.code === 'P2002') {
          // Race condition - retry lookup
          customer = await prisma.customers.findFirst({
            where: { workspaceId, phone: { in: phoneVariants } },
          })
        }
        if (!customer) {
          logger.error('[WASENDER] Failed to create customer:', createError)
          return res.status(500).json({ error: 'Failed to create customer' })
        }
      }
    }

    // 7. 💰 Workspace access check (billing, trial, channel limits)
    const { WorkspaceAccessService } = await import(
      '../../../application/services/workspace-access.service'
    )
    const workspaceAccessService = new WorkspaceAccessService(prisma)
    const accessResult = await workspaceAccessService.canProcessMessages(workspaceId, false)

    if (!accessResult.canProcess) {
      logger.warn('[WASENDER] 🚫 Workspace access denied:', {
        workspaceId,
        reason: accessResult.blockReason,
      })
      return res.status(200).json({ status: 'denied', reason: accessResult.blockReason })
    }

    // 8. 🚦 Rate limiting
    const [customerPerMin, customerBurst, workspacePerMin, workspaceBurst] = await Promise.all([
      platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_CUSTOMER_PER_MIN'),
      platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_CUSTOMER_BURST'),
      platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_WORKSPACE_PER_MIN'),
      platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_WORKSPACE_BURST'),
    ])

    if (
      !whatsappMessageRateLimiter.isAllowed(
        `customer:${customer.id}`,
        buildTokenBucketConfig(customerPerMin, customerBurst)
      )
    ) {
      logger.warn('[WASENDER] 🚫 Customer rate limit exceeded', { customerId: customer.id })
      return res.status(200).json({ status: 'rate_limited' })
    }

    if (
      !whatsappWorkspaceRateLimiter.isAllowed(
        `workspace:${workspaceId}`,
        buildTokenBucketConfig(workspacePerMin, workspaceBurst)
      )
    ) {
      logger.warn('[WASENDER] 🚫 Workspace rate limit exceeded', { workspaceId })
      return res.status(200).json({ status: 'rate_limited' })
    }

    // 9. 💬 Find or create chat session
    let chatSession = await prisma.chatSession.findFirst({
      where: { customerId: customer.id, status: 'active' },
    })

    if (!chatSession) {
      try {
        chatSession = await prisma.chatSession.create({
          data: {
            workspaceId,
            customerId: customer.id,
            status: 'active',
          },
        })
      } catch (error: any) {
        if (error?.code === 'P2002') {
          chatSession = await prisma.chatSession.findFirst({
            where: { customerId: customer.id, status: 'active' },
          })
        }
        if (!chatSession) {
          logger.error('[WASENDER] Failed to create chat session:', error)
          return res.status(500).json({ error: 'Failed to create chat session' })
        }
      }
    }

    // 10. 🔄 Convert WhatsApp format → Markdown
    const messageMarkdown = whatsAppToMarkdown(rawMessageText)

    // 10.5. ⌨️  Typing indicator — show "composing" while LLM processes
    if (workspace.wasenderApiKey && key.remoteJid) {
      this.wasenderClient
        .sendPresenceUpdate(workspace.wasenderApiKey, key.remoteJid, 'composing')
        .catch(() => { /* non-critical */ })
    }

    logger.info('[WASENDER] 🎯 Calling Chat Engine:', {
      customerId: customer.id,
      conversationId: chatSession.id,
    })

    // 11. 🤖 Chat Engine
    const chatEngine = getChatEngine(prisma)
    const routerResult = await chatEngine.routeMessage({
      workspaceId,
      customerId: customer.id,
      conversationId: chatSession.id,
      message: messageMarkdown,
      customerLanguage:
        customer.language ||
        detectLanguageFromPhonePrefix(customer.phone) ||
        workspace.defaultLanguage,
      customerName: customer.name,
      customerDiscount: customer.discount || 0,
      isPlayground: false,
      channel: 'whatsapp',
    })

    logger.info('[WASENDER] ✅ Chat Engine completed:', {
      agentUsed: routerResult.agentUsed,
      tokensUsed: routerResult.tokensUsed,
    })

    // Stop typing indicator
    if (workspace.wasenderApiKey && key.remoteJid) {
      this.wasenderClient
        .sendPresenceUpdate(workspace.wasenderApiKey, key.remoteJid, 'paused')
        .catch(() => { /* non-critical */ })
    }

    if (routerResult.isBlocked) {
      logger.warn('[WASENDER] 🚫 Customer blocked:', { customerId: customer.id })
      return res.status(410).json({ status: 'blocked' })
    }

    // 12. 📤 Queue delivery
    try {
      const { WhatsAppQueueService } = require('../../../services/whatsapp-queue.service')
      const queueService = new WhatsAppQueueService(prisma)

      const assistantMessage = await prisma.conversationMessage.findFirst({
        where: {
          conversationId: chatSession.id,
          role: 'assistant',
          content: routerResult.response,
        },
        orderBy: { createdAt: 'desc' },
      })

      await queueService.enqueue({
        workspaceId,
        customerId: customer.id,
        phoneNumber: customer.phone,
        messageContent: routerResult.response,
        conversationMessageId: assistantMessage?.id,
        isPlayground: false,
      })

      logger.info('[WASENDER] ✅ Response queued for delivery', { customerId: customer.id })
    } catch (queueError) {
      logger.error('[WASENDER] ❌ Failed to enqueue response:', queueError)
    }

    return res.status(200).json({ status: 'processed' })
  }
}
