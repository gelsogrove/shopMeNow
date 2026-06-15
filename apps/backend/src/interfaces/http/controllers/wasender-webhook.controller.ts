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
 * 15. 📤 Direct send (WhatsAppDirectSendService)
 */

import { Request, Response } from 'express'
import { prisma } from '@echatbot/database'
import { WasenderClientService } from '../../../services/wasender-client.service'
// 📎 Inbound media (image/PDF/audio): extract the media ref from the payload
import { extractWasenderMedia, extractWasenderAudio } from '../../../services/webhook-media.extract'
import { transcribeAudio } from '../../../services/audio-transcription.service'
// 😀 Inbound reaction (long-press emoji) → emoji + reacted-to message context for the LLM
import { extractWasenderReaction } from '../../../services/webhook-reaction.extract'
// ✓✓ Delivery receipts (delivered/read): messages.update webhook → advance outbound status
import { extractWasenderStatusUpdates } from '../../../services/webhook-status.extract'
import { applyManyStatusUpdates } from '../../../services/delivery-status.service'
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
import { OperatorRelayService } from '../../../application/services/operator-relay.service'
import { whatsAppInboundPipeline } from '../../../services/whatsapp/whatsapp-inbound.pipeline'

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

/** Delivery/read status update for a previously sent message (double-tick). */
interface WasenderMessageUpdatePayload {
  event: 'messages.update'
  sessionId?: string
  data: any // shape: { key:{id}, update:{status} } or an array of such — parsed leniently in webhook-status.extract
}

type WasenderWebhookPayload =
  | WasenderSessionStatusPayload
  | WasenderQrcodeUpdatedPayload
  | WasenderMessageReceivedPayload
  | WasenderMessageUpdatePayload

// ─── Controller ───────────────────────────────────────────────────────────

export class WasenderWebhookController {
  private readonly wasenderClient = new WasenderClientService()
  private readonly operatorRelayService = new OperatorRelayService(prisma)

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

      // ✓✓ DELIVERY RECEIPTS: Wasender emits `messages.update` with the message
      // status (delivered/read). Advance the matching outbound message.
      case 'messages.update': {
        const updates = extractWasenderStatusUpdates(payload)
        if (updates.length > 0) {
          await applyManyStatusUpdates(prisma, workspaceId, updates)
        }
        return res.status(200).json({ status: 'ok', handled: 'delivery_status' })
      }

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
            websocketService.notifyChannelStatusChanged(workspaceId, {
              channelStatus: true,
              source: "wasender",
              reason: "connected",
            })
          } catch { /* optional */ }
          break
        }

        case 'disconnected':
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              wasenderSessionStatus: 'disconnected',
              wasenderIsActive: false,
              // 🚀 NEW LOGIC: Channel stays ACTIVE because Widget still works!
              // Only WhatsApp provider is disabled, not the channel itself.
            },
          })
          logger.warn('[WASENDER-Webhook] ⚠️ Session disconnected:', { workspaceId })

          try {
            websocketService.notifyChatUpdated(workspaceId, { type: 'wasender:disconnected' })
            websocketService.notifyChannelStatusChanged(workspaceId, {
              channelStatus: true, // Channel stays active for Widget
              source: "wasender",
              reason: "disconnected",
            })
          } catch { /* optional */ }
          break

        case 'need_scan':
          await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
              wasenderSessionStatus: 'need_scan',
              wasenderIsActive: false,
              // 🚀 NEW LOGIC: Channel stays ACTIVE because Widget still works!
            },
          })
          logger.info('[WASENDER-Webhook] 📱 Session needs QR scan:', { workspaceId })
          try {
            websocketService.notifyChannelStatusChanged(workspaceId, {
              channelStatus: true, // Channel stays active for Widget
              source: "wasender",
              reason: "need_scan",
            })
          } catch { /* optional */ }
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
    // 📎 image/document/audio → media ref (direct URL); null for text/other types.
    // Audio voice notes are stored + played back in /chat via the same pipeline;
    // the Whisper transcription below still feeds the LLM as message text.
    const inboundMedia = extractWasenderMedia(message) || extractWasenderAudio(message)
    // 😀 reaction → emoji + reacted-to message id (null if none)
    const inboundReaction = extractWasenderReaction(message)

    // 😀 Inbound reaction handler: update original message's reaction field
    // instead of creating a new message.
    if (inboundReaction && inboundReaction.messageId) {
      try {
        const updatedMsg = await prisma.conversationMessage.updateMany({
          where: {
            whatsappMessageId: inboundReaction.messageId,
            workspaceId: workspaceId,
          },
          data: { reaction: inboundReaction.emoji },
        })

        logger.info('[WASENDER] 😀 Reaction updated on original message', {
          workspaceId,
          emoji: inboundReaction.emoji,
          whatsappMessageId: inboundReaction.messageId,
          messagesUpdated: updatedMsg.count,
        })

        // Reaction handled — skip message creation
        return res.status(200).json({ status: 'ok', type: 'reaction_updated' })
      } catch (updateError) {
        logger.warn('[WASENDER] ⚠️ Failed to update reaction on original message', {
          error: updateError instanceof Error ? updateError.message : String(updateError),
          whatsappMessageId: inboundReaction.messageId,
        })
        // Fall through to ignore (no new message for reaction-only input)
      }
    }

    // Parse message data
    const rawPhone =
      key.cleanedSenderPn ||
      key.cleanedParticipantPn ||
      key.remoteJid?.replace(/@.*$/, '') ||
      ''
    const messageId = key.id
    let rawMessageText =
      messageBody ||
      message.message?.conversation ||
      message.message?.extendedTextMessage?.text ||
      ''

    if (!rawPhone) {
      logger.error('[WASENDER] ❌ Missing phone number in payload', { workspaceId, messageId })
      return res.status(200).json({ status: 'ignored', reason: 'no_phone' })
    }

    if (!rawMessageText || rawMessageText.trim() === '') {
      // 🎤 Check for audio message before ignoring
      const audioRef = extractWasenderAudio(message)
      if (audioRef?.ref?.mediaUrl) {
        const transcription = await transcribeAudio({
          audioUrl: audioRef.ref.mediaUrl,
          declaredMime: audioRef.declaredMime,
          provider: 'wasender',
          workspaceId,
        })
        if (transcription?.text) {
          rawMessageText = transcription.text
          logger.info('[WASENDER] 🎤 Audio transcribed', {
            chars: transcription.text.length,
            workspaceId,
          })
        } else {
          rawMessageText = '[audio message]'
        }
      } else {
        logger.warn('[WASENDER] ⚠️ Empty message body - ignoring', { workspaceId })
        return res.status(200).json({ status: 'ignored', reason: 'no_text' })
      }
    }

    // 1. 🏠 Load workspace with owner
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        wasenderSessionId: true,
        wasenderApiKey: true,
        wasenderSessionStatus: true,
        wasenderIsActive: true,
        channelStatus: true,
        defaultLanguage: true,
        owner: {
          select: { status: true },
        },
        whatsappPhoneNumber: true,
        operatorWhatsappNumber: true,
      },
    })

    if (!workspace) {
      logger.warn('[WASENDER] ❌ Workspace not found:', { workspaceId })
      return res.status(404).json({ error: 'Workspace not found' })
    }

    // 🔒 SECURITY: Verify this webhook is for THIS workspace by comparing sessionId
    // Wasender session ID is numeric but stored as string.
    // Payload sessionId might be number depending on Wasender version.
    const payloadAny = payload as any
    const receivedSessionId = payloadAny.sessionId || payloadAny.session_id || payloadAny.data?.sessionId || payloadAny.data?.session_id
    
    if (workspace.wasenderSessionId || workspace.wasenderApiKey) {
      const matchesSessionId = workspace.wasenderSessionId && (String(receivedSessionId) === workspace.wasenderSessionId)
      const matchesApiKey = workspace.wasenderApiKey && (String(receivedSessionId) === workspace.wasenderApiKey)
      
      if (!matchesSessionId && !matchesApiKey) {
        logger.error('[WASENDER] 🔒 SessionId mismatch - potential spoofing', {
          workspaceId,
          expectedSessionId: workspace.wasenderSessionId,
          expectedApiKey: workspace.wasenderApiKey?.substring(0, 10) + '...',
          receivedSessionId: receivedSessionId,
          receivedType: typeof receivedSessionId,
          event: payloadAny.event,
          fullPayload: JSON.stringify(payloadAny, null, 2)
        })
        
        return res.status(403).json({ error: 'Invalid session identification' })
      }
    }

    // 3. 🚦 Channel status check
    const isOwnerInactive = workspace.owner?.status === 'INACTIVE'
    const isChannelDisabled = workspace.channelStatus === false

    if (isOwnerInactive || (isChannelDisabled && !workspace.wasenderIsActive)) {
      logger.warn('[WASENDER] 🚫 Channel disabled or owner inactive', {
        workspaceId,
        isOwnerInactive,
        isChannelDisabled,
        wasenderIsActive: workspace.wasenderIsActive,
      })
      return res.status(200).json({ status: 'ignored', reason: 'channel_disabled' })
    }

    // 4. 📞 Normalize phone number
    const phoneWithPrefix = rawPhone.startsWith('+') ? rawPhone : `+${rawPhone}`
    const phoneVariants = buildPhoneVariants(phoneWithPrefix)
    const phoneNumber = phoneVariants[0]

    // 4.5. 🎧 Operator Detection
    const isOperator =
      (workspace.operatorWhatsappNumber &&
        phoneVariants.includes(workspace.operatorWhatsappNumber)) ||
      (workspace.whatsappPhoneNumber &&
        phoneVariants.includes(workspace.whatsappPhoneNumber))

    logger.info('[WASENDER] 📞 Processing message:', {
      workspaceId,
      phone: phoneNumber.substring(0, 6) + '***',
      messageId,
      isOperator,
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

    // 6. 🔄 Convert WhatsApp format → Markdown
    const messageMarkdown = whatsAppToMarkdown(rawMessageText)

    // 6.5. 🎧 Operator Flow: If message is from operator, handle relaying back to customer
    if (isOperator) {
      logger.info('[WASENDER] 🎧 Operator message detected - relaying to customer', {
        workspaceId,
        operatorPhone: phoneNumber,
      })
      await this.operatorRelayService.handleOperatorMessage(
        workspaceId,
        messageMarkdown
      )
      return res.status(200).json({ status: 'processed', source: 'operator_relay' })
    }

    // 6.7. 👤 Human Support Guard: If customer is in human support mode (chatbot disabled), relay to operator
    if (customer.activeChatbot === false) {
      logger.info('[WASENDER] 👤 Customer in human support mode - relaying to operator', {
        workspaceId,
        customerId: customer.id,
      })
      await this.operatorRelayService.relayCustomerMessageToOperator(
        workspaceId,
        customer,
        messageMarkdown
      )
      return res.status(200).json({ status: 'processed', source: 'customer_relay' })
    }

    // 7. 💰 Workspace access/billing is enforced below (after chat session) by the
    // shared pipeline guard — channel-disabled, debug WIP, trial and credit — so
    // it behaves identically to Meta/UltraMsg.

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

    // 10. 🔄 Already converted at step 6

    // 10.4. 🔒 SECURITY CHECK — shared pipeline guard (same as Meta/UltraMsg).
    const securityBlock = await whatsAppInboundPipeline.checkSecurity({
      workspaceId,
      customerId: customer.id,
      customerPhone: customer.phone,
      conversationId: chatSession.id,
      messageMarkdown,
      isPlayground: false,
    })
    if (securityBlock) {
      return res
        .status(securityBlock.statusCode)
        .json(securityBlock.body ?? { status: securityBlock.status, code: securityBlock.code })
    }

    // 10.45. 💰 BILLING / ACCESS guard — shared pipeline (channel-disabled, debug
    // WIP, PAUSED/credit-exhausted, trial, credit). Same result as Meta/UltraMsg.
    const billingBlock = await whatsAppInboundPipeline.checkBillingAccess({
      customer,
      chatSession,
      messageMarkdown,
      whatsappMessageId: messageId || `wasender-${chatSession.id}`,
      isPlayground: false,
    })
    if (billingBlock) {
      return res
        .status(billingBlock.statusCode)
        .json(billingBlock.body ?? { status: billingBlock.status, code: billingBlock.code })
    }

    // 10.5. ⌨️  Typing indicator — show "composing" while LLM processes
    if (workspace.wasenderApiKey && key.remoteJid) {
      this.wasenderClient
        .sendPresenceUpdate(workspace.wasenderApiKey, key.remoteJid, 'composing')
        .catch(() => { /* non-critical */ })
    }

    // 11. 🤖 Shared provider-agnostic pipeline — same result as Meta/UltraMsg
    // (custom-ecolaundry → chatEngine, typing, media ingest, direct send).
    // processReply reads the full workspace off customer.workspace; the workspace
    // loaded at step 1 has a limited select, so fetch the fields it needs.
    const pipelineWorkspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        slug: true,
        customChatbotId: true,
        welcomeMessage: true,
        wipMessage: true,
        channelStatus: true,
        debugMode: true,
        defaultLanguage: true,
      },
    })
    ;(customer as any).workspace = pipelineWorkspace

    // First-message welcome-video trigger: count prior real user messages.
    const messageCount = await prisma.conversationMessage.count({
      where: { conversationId: chatSession.id, role: 'user' },
    })

    // Inbound media ingest happens inside the pipeline (chatEngine path), matching
    // Meta — no separate ingest here (avoids double-ingestion of the same media).
    const inboundWasAudio = !!((message?.message as any)?.audioMessage)
    const result = await whatsAppInboundPipeline.processReply({
      customer,
      chatSession,
      messageMarkdown,
      whatsappMessageId: messageId || `wasender-${chatSession.id}`,
      inboundMedia,
      inboundWasAudio,
      isPlayground: false,
      messageCount,
      registrationPromptLevel: 0,
    })

    // Stop typing indicator
    if (workspace.wasenderApiKey && key.remoteJid) {
      this.wasenderClient
        .sendPresenceUpdate(workspace.wasenderApiKey, key.remoteJid, 'paused')
        .catch(() => { /* non-critical */ })
    }

    return res
      .status(result.statusCode)
      .json(result.body ?? { status: result.status, code: result.code })
  }
}
