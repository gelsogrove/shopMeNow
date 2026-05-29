/**
 * UltraMsg Webhook Controller
 * 
 * Handles incoming webhooks from UltraMsg
 * Normalizes messages to internal format and processes them
 * 
 * Webhook URL format: POST /api/whatsapp/ultramsg/:webhookId
 * 
 * UltraMsg webhook payload format (VERIFIED - nested structure):
 * {
 *   "event_type": "message_received",
 *   "instanceId": "161048",
 *   "data": {
 *     "id": "false_104462211358855@lid_AC2AED...",
 *     "from": "34654728753@c.us",
 *     "to": "34602119358@c.us",
 *     "body": "Ciao",
 *     "type": "chat",
 *     "timestamp": 1770313487
 *   }
 * }
 * 
 * FLOW (IDENTICAL TO META WEBHOOK):
 * 1. 🔒 Customer-level locking (prevent race conditions)
 * 2. 🚦 Rate limiting (customer + workspace)
 * 3. 📞 Phone normalization (variants)
 * 4. 🔍 Customer lookup/create
 * 5. 🔁 Deduplication (prevent double processing)
 * 6. 💰 Billing checks (trial, credit, limits)
 * 7. 🚫 Workspace access checks
 * 8. 💾 Save user message FIRST
 * 9. 🔒 Security LLM
 * 10. 🤖 Chat Engine
 * 11. 📤 Queue delivery
 */

import { Request, Response } from 'express'
import { prisma } from '@echatbot/database'
import { SecurityCheckService } from '../../../application/services/security-check.service'
import { CustomClientChatbotService, applyCustomerPatches, applyEscalationNotification } from '../../../application/services/custom-client-chatbot.service'
import { getChatEngine } from '../../../application/chat-engine'
import { whatsappMessageRateLimiter, whatsappWorkspaceRateLimiter } from '../../../middlewares/rateLimiter'
import { platformConfigService } from '../../../services/platform-config.service'
import { websocketService } from '../../../services/websocket.service'
import logger from '../../../utils/logger'
import { whatsAppToMarkdown } from '../../../utils/whatsapp-formatter'
import { buildPhoneVariants } from '../../../utils/phone'
import { detectLanguageFromPhonePrefix } from '../../../utils/language-detector'
import { OperatorRelayService } from '../../../application/services/operator-relay.service'
import { WhatsAppDirectSendService } from '../../../services/whatsapp-direct-send.service'
import { splitCustomChatbotReply } from '../../../utils/custom-chatbot-reply'
import { mdToWhatsApp } from '../../../utils/markdown-to-whatsapp'

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

export class UltraMsgWebhookController {
  private readonly operatorRelayService = new OperatorRelayService(prisma)
  private readonly customClientChatbotService = new CustomClientChatbotService()
  /**
   * Handle incoming webhook from UltraMsg
   * POST /api/whatsapp/ultramsg/:webhookId
   * 
   * FLOW (IDENTICAL TO META):
   * 1. Extract phone for locking
   * 2. Acquire customer-level lock
   * 3. Process message with lock held
   */
  async handleWebhook(req: Request, res: Response): Promise<Response> {
    const { webhookId } = req.params

    // 🔒 STEP 0: Extract phone number FIRST for locking (before any processing)
    let phoneNumberForLock: string | undefined
    
    try {
      // UltraMsg sends phone in format: "34654728753@c.us" - we need to clean it
      const payload = req.body.data || req.body
      const rawFrom = payload.from || req.body.from
      
      if (rawFrom) {
        // Remove WhatsApp suffix (@c.us, @g.us, @s.whatsapp.net, etc.)
        const cleanPhone = rawFrom.replace(/@.*$/, '').trim()
        phoneNumberForLock = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`
      }
    } catch (error) {
      logger.error('[ULTRAMSG] ❌ Failed to extract phone for locking', error)
    }
    
    // 🔒 STEP 1: ACQUIRE CUSTOMER LOCK (prevents concurrent message processing)
    if (phoneNumberForLock) {
      const lockKey = `customer:${phoneNumberForLock}`
      
      // Wait for any existing lock to release
      while (customerMessageLocks.has(lockKey)) {
        logger.info('[ULTRAMSG] ⏳ Waiting for customer lock', { phone: phoneNumberForLock })
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
        return await this._handleWebhookLocked(req, res)
      } finally {
        // Always release lock - MUST resolve promise BEFORE deleting from map
        try {
          releaseLock!()
        } catch (releaseError) {
          logger.error('[ULTRAMSG] Error releasing lock (continuing):', releaseError)
        }
        customerMessageLocks.delete(lockKey)
        logger.info('[ULTRAMSG] 🔓 Released customer lock', { phone: phoneNumberForLock })
      }
    } else {
      // No phone number - process without lock
      return await this._handleWebhookLocked(req, res)
    }
  }
  
  /**
   * Internal method - processes message with lock held
   * THIS IS THE CORE LOGIC - COPIED EXACTLY FROM META WEBHOOK
   */
  private async _handleWebhookLocked(req: Request, res: Response): Promise<Response> {
    const { webhookId } = req.params
    let workspaceId: string | undefined  // Declare at function scope

    // 🔍 DEBUG: Log RAW payload to understand UltraMsg format
    logger.info('🔍 [ULTRAMSG DEBUG] RAW WEBHOOK PAYLOAD', {
      headers: req.headers,
      params: req.params,
      query: req.query,
      body: req.body,
      bodyKeys: Object.keys(req.body || {}),
      contentType: req.headers['content-type']
    })

    // UltraMsg sends data in nested structure: { event_type, data: { id, from, body, ... } }
    const payload = req.body.data || req.body
    const { id, from, to, body, type, timestamp } = payload

    logger.info('📥 UltraMsg Webhook received', {
      webhookId,
      messageId: id,
      from,
      type,
      bodyLength: body?.length || 0,
      hasNestedData: !!req.body.data,
      extractedBody: body,  // DEBUG: See what we extracted
      payloadKeys: Object.keys(payload || {}),  // DEBUG: See available keys
    })

    try {
      // 1. Find workspace via webhookId (same pattern as Meta)
      const settings = await prisma.whatsappSettings.findUnique({
        where: { webhookId },
        select: {
          workspaceId: true,
          workspace: {
            select: {
              id: true,
              slug: true,
              name: true,
              welcomeMessage: true,
              defaultLanguage: true,
              channelStatus: true,
              channelMode: true,
              debugMode: true,
              wipMessage: true,
              whatsappProvider: true,
              ultraMsgInstanceId: true,
              ultraMsgToken: true,
              whatsappPhoneNumber: true,
              operatorWhatsappNumber: true,
              ownerId: true,
              customChatbotId: true, // 🤖 Custom chatbot module for FLOW workspaces
              owner: {
                select: { status: true }
              }
            }
          }
        }
      })

      if (!settings || !settings.workspace) {
        logger.error('[ULTRAMSG] ❌ Webhook not found', { webhookId })
        return res.status(404).json({ error: 'Webhook not found' })
      }

      const workspace = settings.workspace as any
      workspaceId = workspace.id  // Extract workspaceId from workspace

      if (!workspace || workspace.whatsappProvider !== 'ultramsg') {
        logger.warn('⚠️ UltraMsg Webhook: Workspace not found or not using UltraMsg', {
          webhookId,
          workspaceId: workspace?.id,
          provider: workspace?.whatsappProvider,
        })
        return res.status(404).json({
          error: 'Workspace not found or not configured for UltraMsg',
        })
      }

      // 🔒 SECURITY: Verify instanceId BEFORE checking channelStatus
      // This prevents information disclosure (workspace enumeration attack)
      const receivedInstanceId = req.body.instanceId
      const expectedInstanceId = workspace.ultraMsgInstanceId

      if (!receivedInstanceId) {
        logger.warn('[ULTRAMSG] ❌ Missing instanceId in payload', {
          webhookId,
          workspaceId,
        })
        return res.status(403).json({ error: 'missing_instance_id' })
      }

      // Normalize both IDs: UltraMsg sends "161048", we might store "instance161048" or "161048"
      const normalizeInstanceId = (id: string) => id.replace(/^instance/, '')
      const receivedNormalized = normalizeInstanceId(receivedInstanceId)
      const expectedNormalized = normalizeInstanceId(expectedInstanceId)

      if (receivedNormalized !== expectedNormalized) {
        logger.warn('[ULTRAMSG] ❌ Invalid instanceId', {
          webhookId,
          workspaceId,
          received: receivedInstanceId,
          expected: expectedInstanceId ? '***' : 'NOT_CONFIGURED',
        })
        return res.status(403).json({ error: 'invalid_instance_id' })
      }

      logger.info('[ULTRAMSG] ✅ InstanceId verified', { workspaceId })

      // Owner inactive or channel disabled (checked AFTER authentication)
      const isOwnerInactive = workspace.owner?.status === 'INACTIVE'
      const isChannelDisabled = workspace.channelStatus === false

      if (isOwnerInactive || isChannelDisabled) {
        logger.warn('[ULTRAMSG] 🚫 Channel disabled or owner inactive', {
          workspaceId,
          channelStatus: workspace.channelStatus,
          ownerStatus: workspace.owner?.status,
        })
        return res.status(200).json({ success: true, message: 'Channel disabled' })
      }

      // 2. 📞 Normalize phone number with variants (EXACTLY like Meta)
      // UltraMsg sends phone as "34654728753@c.us" - remove WhatsApp suffix and ensure + prefix
      const cleanFrom = from.replace(/@.*$/, '').trim()
      // 🔧 FIX: Add + prefix if missing (UltraMsg strips it)
      const phoneWithPrefix = cleanFrom.startsWith('+') ? cleanFrom : `+${cleanFrom}`
      const phoneVariants = buildPhoneVariants(phoneWithPrefix)
      const phoneNumber = phoneVariants[0]

      // 🎤 MEDIA HANDLING: For audio/image/video/document/sticker, UltraMSG sends body="" 
      // Instead of ignoring silently, pass a placeholder so LLM can respond appropriately
      // This matches WAAPI webhook behavior (whatsapp-webhook.controller.ts L237-242)
      const mediaTypes = ['audio', 'image', 'video', 'document', 'sticker', 'ptt']
      let messageText = body || ''
      if (!messageText.trim() && type && mediaTypes.includes(type)) {
        // Map 'ptt' (push-to-talk) to 'audio' for consistency
        const displayType = type === 'ptt' ? 'audio' : type
        messageText = `[${displayType} message]`
        logger.info('[ULTRAMSG] 🎤 Media message detected, using placeholder', {
          workspaceId,
          type,
          placeholder: messageText,
        })
      }

      if (!messageText || messageText.trim() === '') {
        logger.warn('[ULTRAMSG] ⚠️ No message text - ignoring', { workspaceId })
        return res.status(200).json({ status: 'ignored', reason: 'no text' })
      }

      if (!phoneNumber) {
        logger.error('[ULTRAMSG] ❌ Missing phone number', { workspaceId })
        return res.status(400).json({ error: 'missing_phone_number' })
      }

      const messageMarkdown = whatsAppToMarkdown(messageText)

      logger.info('[ULTRAMSG] 📞 Phone normalized', {
        rawPhone: from,
        cleanPhone: cleanFrom,
        normalizedPhone: phoneNumber,
        variants: phoneVariants.length,
      })

      // 2.5. 🎧 Operator Detection
      const isOperator =
        (workspace.operatorWhatsappNumber &&
          phoneVariants.includes(workspace.operatorWhatsappNumber)) ||
        (workspace.whatsappPhoneNumber &&
          phoneVariants.includes(workspace.whatsappPhoneNumber))

      // 3. 🔁 Deduplication - prevent double processing (EXACTLY like Meta)
      if (id) {
        try {
          const prismaAny = prisma as any
          await prismaAny.whatsappWebhookEvent.create({
            data: {
              workspaceId,
              externalMessageId: id, // UNIQUE constraint
              channel: 'whatsapp',
            },
          })
        } catch (error: any) {
          if (error?.code === 'P2002') {
            logger.info('[ULTRAMSG] 🔁 Duplicate message ignored', {
              workspaceId,
              messageId: id,
            })
            return res.status(200).json({
              status: 'duplicate',
              messageId: id,
            })
          }
          throw error
        }
      }

      // 4. 🔍 Find customer (with variants - EXACTLY like Meta)
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
            slug: true,
            name: true,
            welcomeMessage: true,
            defaultLanguage: true,
            wipMessage: true,
            channelStatus: true,
            debugMode: true,
          },
        },
      } as const

      let customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
          OR: phoneVariants.map((v) => ({ phone: v })),
        },
        select: customerSelect,
      }) as any

      if (customer) {
        logger.info('[ULTRAMSG] ✅ Customer found by phone match', {
          customerId: customer.id,
          phone: customer.phone,
        })

        if (customer.isBlacklisted) {
          logger.warn('[ULTRAMSG] 🚫 Blocked customer - returning 410', {
            customerId: customer.id,
          })
          return res.status(410).json({
            status: 'blocked',
            message: 'Customer is blocked',
          })
        }
      }

      // 5. Handle NEW customer (EXACTLY like Meta - with billing checks)
      if (!customer) {
        logger.info('[ULTRAMSG] 🆕 New customer detected - NOT IMPLEMENTED YET', {
          phoneNumber,
          workspaceId,
        })

        // 🔒 ACCESS CHECK (debug/channel/owner/billing blocks) BEFORE welcome flow
        const { WorkspaceAccessService } = await import(
          '../../../application/services/workspace-access.service'
        )
        const workspaceAccessService = new WorkspaceAccessService(prisma)
        const accessResult = await workspaceAccessService.canProcessMessages(
          workspaceId,
          false
        )

        if (!accessResult.canProcess) {
          // 🚧 DEBUG_MODE → Send WIP message (no welcome)
          if (accessResult.blockReason === 'DEBUG_MODE') {
            logger.info('[ULTRAMSG] 🚧 Debug mode (new user) - sending WIP message', {
              workspaceId,
              phoneNumber,
            })

            const detectedLanguageFromPhone = detectLanguageFromPhonePrefix(phoneNumber)
            const finalLanguage = detectedLanguageFromPhone || workspace.defaultLanguage
            const rawWipMessage =
              workspace.wipMessage || 'Work in progress. Please contact us later.'

            let wipMessage = rawWipMessage
            let translationTokensUsed = 0
            try {
              const { TranslationAgent } = require('../../../application/agents/TranslationAgent')
              const translationAgent = new TranslationAgent(prisma)
              const translationResult = await translationAgent.process({
                workspaceId,
                message: rawWipMessage,
                targetLanguage: finalLanguage,
                customerName: 'Customer',
                customerId: undefined,
                channel: 'whatsapp',
              })
              wipMessage = translationResult.message || rawWipMessage
              translationTokensUsed = translationResult.tokensUsed || 0
            } catch (translationError) {
              logger.warn('[ULTRAMSG] ⚠️ WIP translation failed (new user), using raw message', {
                error: translationError,
              })
            }

            const phoneForStorage =
              phoneVariants.find((v) => v.startsWith('+')) || phoneVariants[0] || phoneNumber

            const { tempCustomer, chatSession, assistantMessage } = await prisma.$transaction(async (tx) => {
              const tempCustomer = await tx.customers.create({
                data: {
                  phone: phoneForStorage,
                  workspaceId: workspaceId,
                  name: 'New Customer',
                  email: `${phoneForStorage.replace(/[^0-9]/g, '')}@whatsapp.ultramsg.temp`,
                  language: finalLanguage,
                  isActive: false,
                },
              })

              const chatSession = await tx.chatSession.create({
                data: {
                  customerId: tempCustomer.id,
                  workspaceId,
                  status: 'active',
                },
              })

              // 10. 🔄 Already converted at step 2.5
              await tx.conversationMessage.create({
                data: {
                  workspaceId,
                  customerId: tempCustomer.id,
                  conversationId: chatSession.id,
                  role: 'user',
                  content: messageMarkdown,
                  agentType: 'NONE',
                  tokensUsed: 0,
                  debugInfo: JSON.stringify({
                    debugMode: true,
                    reason: 'workspace.debugMode = true',
                    source: 'ultramsg-webhook',
                  }),
                },
              })

              const assistantMessage = await tx.conversationMessage.create({
                data: {
                  workspaceId,
                  customerId: tempCustomer.id,
                  conversationId: chatSession.id,
                  role: 'assistant',
                  content: wipMessage,
                  agentType: 'ROUTER',
                  tokensUsed: translationTokensUsed,
                  deliveryStatus: 'pending',
                  debugInfo: JSON.stringify({
                    debugMode: true,
                    reason: 'workspace.debugMode = true',
                    source: 'ultramsg-webhook',
                  }),
                },
              })

              return { tempCustomer, chatSession, assistantMessage }
            })

            try {
              const directSend = new WhatsAppDirectSendService(prisma)
              await directSend.send({
                workspaceId,
                customerId: tempCustomer.id,
                phoneNumber: tempCustomer.phone,
                messageContent: wipMessage,
                conversationMessageId: assistantMessage.id,
                skipSecurityCheck: true,
              })
            } catch (error) {
              logger.error('[ULTRAMSG] ❌ Failed to send WIP message (new user)', {
                error,
                workspaceId,
              })
            }

            return res.status(200).json({
              status: 'debug_wip',
              code: 'DEBUG_MODE',
              message: 'Channel is in maintenance mode.',
              wipMessage,
            })
          }

          // Silent block for billing/paused/disabled (no response)
          return res.status(402).json({
            status: 'workspace_blocked',
            code: accessResult.blockReason,
            message: accessResult.message,
          })
        }

        // TODO: Implement welcome message flow for UltraMsg
        // For now, create customer without welcome message
        
        // 💰 BILLING CHECK: Verify credit and plan limits BEFORE creating customer
        const { SubscriptionBillingService } = await import(
          '../../../application/services/subscription-billing.service'
        )
        const billingService = new SubscriptionBillingService(prisma)

        // Check trial validity
        const trialStatus = await billingService.isTrialValid(workspaceId)
        if (trialStatus.isTrialPlan && !trialStatus.isValid) {
          logger.warn('[ULTRAMSG] 💰 Trial expired - SILENT BLOCK for new user', {
            workspaceId,
            phoneNumber,
          })
          return res.status(402).json({
            status: 'billing_error',
            code: 'TRIAL_EXPIRED',
            message: 'Trial period has expired. Please upgrade your plan.',
          })
        }

        // Check credit balance
        const messageCost = await billingService.getOperationCost(workspaceId, 'message')
        const creditCheck = await billingService.checkCredit(workspaceId, messageCost)

        if (!creditCheck.hasSufficientCredit) {
          logger.warn('[ULTRAMSG] 💰 Insufficient credit - SILENT BLOCK for new user', {
            workspaceId,
            phoneNumber,
          })
          return res.status(402).json({
            status: 'billing_error',
            code: 'INSUFFICIENT_CREDIT',
            message: 'Insufficient credit. Please recharge your account.',
          })
        }

        // Check customer limit
        const customerLimitCheck = await billingService.checkPlanLimits(workspaceId, 'customers')
        if (!customerLimitCheck.withinLimits) {
          logger.warn('[ULTRAMSG] 📊 Customer limit reached - SILENT BLOCK', {
            workspaceId,
            phoneNumber,
          })
          return res.status(403).json({
            status: 'limit_reached',
            code: 'CUSTOMER_LIMIT_REACHED',
            message: `Customer limit reached. Please upgrade your plan.`,
          })
        }

        // Create customer
        const phoneForStorage = phoneVariants.find((v) => v.startsWith('+')) || phoneVariants[0] || phoneNumber
        
        // 🌍 Detect language from phone prefix (+34→es, +39→it, +351→pt) or use workspace default
        const detectedLanguage = detectLanguageFromPhonePrefix(phoneForStorage)
        const customerLanguage = detectedLanguage || workspace.defaultLanguage
        
        customer = await prisma.customers.create({
          data: {
            workspace: {
              connect: { id: workspaceId },
            },
            phone: phoneForStorage,
            email: `${phoneForStorage.replace(/[^0-9]/g, '')}@whatsapp.ultramsg.temp`,
            name: 'New Customer',
            language: customerLanguage, // 🌍 Detected from phone prefix or workspace default
            isActive: false, // Mark inactive until registration
          },
          select: customerSelect,
        }) as any

        logger.info('[ULTRAMSG] ✅ New customer created', {
          customerId: customer.id,
          phone: customer.phone,
          detectedLanguage,
          finalLanguage: customerLanguage,
        })
      }

      // 🧹 CLEANUP: Delete orphaned temp- conversation messages from old welcome flow
      // These were created before the fix that uses real chatSession IDs
      // Without this cleanup, messageCount would always be > 0 after first welcome attempt
      const cleanedUp = await prisma.conversationMessage.deleteMany({
        where: {
          customerId: customer.id,
          workspaceId: customer.workspaceId,
          conversationId: { startsWith: 'temp-' },
        },
      })
      if (cleanedUp.count > 0) {
        logger.info('[ULTRAMSG] 🧹 Cleaned up orphaned temp- messages', {
          customerId: customer.id,
          count: cleanedUp.count,
        })
      }

      // 🔍 CRITICAL: Check if customer has chat history (NEW + EXISTING customers)
      // If NO messages exist → send welcome message

      // Get all chat sessions for this customer on WhatsApp channel (UltraMsg = WhatsApp provider)
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
      const welcomeMessageCount = await prisma.conversationMessage.count({
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

      logger.info('[ULTRAMSG] 📊 Message count check for welcome decision', {
        customerId: customer.id,
        messageCount: welcomeMessageCount,
        willSendWelcome: welcomeMessageCount === 0,
      })

      if (welcomeMessageCount === 0) {
        // 🔧 CRITICAL: If customer has 0 messages but activeChatbot=false, reset it
        // This happens when chats are deleted but activeChatbot wasn't reset
        // BUT: do NOT reset if the customer was escalated to human support (contactOperator was called)
        if (customer && !customer.activeChatbot) {
          const escalatedSession = await prisma.chatSession.findFirst({
            where: {
              customerId: customer.id,
              workspaceId,
              escalatedAt: { not: null },
              status: 'active',
            },
          })

          if (!escalatedSession) {
            await prisma.customers.update({
              where: { id: customer.id },
              data: { activeChatbot: true },
            })
            customer.activeChatbot = true
            logger.info('[ULTRAMSG] 🔄 Reset activeChatbot=true (customer had 0 messages but chatbot was disabled)', {
              customerId: customer.id,
            })
          } else {
            logger.info('[ULTRAMSG] ⚠️ Customer has 0 messages but was escalated — NOT resetting activeChatbot', {
              customerId: customer.id,
              escalatedAt: escalatedSession.escalatedAt,
              sessionId: escalatedSession.id,
            })
          }
        }

        logger.info('[ULTRAMSG] 📭 Customer has NO chat history - deciding welcome strategy', {
          customerId: customer.id,
          phone: customer.phone,
          channelMode: workspace.channelMode,
        })

        // 🔄 FLOW workspaces: SKIP WelcomeMessageHandler here entirely.
        // Reason: calling WelcomeMessageHandler here sets the atomic welcomeSent flag AND saves
        // the user message + welcome to DB. When ChatEngine runs next, it finds welcomeSent=true
        // and skips the welcome → no welcomePrefix. But the router prompt (if it contains
        // {{welcomeMessage}}) makes the LLM echo the welcome anyway → DB history then has:
        //   [user: msg] [assistant: welcome] [user: msg DUPLICATE] [assistant: welcome+question]
        // The duplicate user message makes the LLM classify the next turn as a CONTRADICTION
        // and call contactOperator. Fix: let ChatEngine handle the welcome for FLOW workspaces
        // (it combines welcome + first LLM response into a single message via welcomePrefix).
        if (workspace.channelMode === 'FLOW') {
          logger.info('[ULTRAMSG] 🔄 FLOW workspace — ChatEngine handles welcome + response combined, skipping here')
          // fall through to LLM processing below
        } else {
          // NON-FLOW: standalone welcome message handled here

          // 🔧 FIX: Create a real chatSession for welcome messages
          // Without this, welcome messages get saved with temp-{customerId} conversationId
          let welcomeSession = await prisma.chatSession.findFirst({
            where: { customerId: customer.id, workspaceId, channel: 'whatsapp', status: 'active' },
          })
          if (!welcomeSession) {
            welcomeSession = await prisma.chatSession.create({
              data: {
                customerId: customer.id,
                workspaceId,
                channel: 'whatsapp',
                status: 'active',
              },
            })
            logger.info('[ULTRAMSG] ✅ Created chatSession for welcome message', {
              sessionId: welcomeSession.id,
              customerId: customer.id,
            })
          }

          // Import welcome message services
          const { WelcomeMessageHandler } = await import('../../../utils/welcome-message.handler')
          const welcomeHandler = new WelcomeMessageHandler(prisma)

          // Process welcome message with real chatSession ID
          const welcomeResult = await welcomeHandler.handleWelcomeMessage({
            customerId: customer.id,
            workspaceId: customer.workspaceId,
            customerLanguage: customer.language,
            customerMessage: messageText,
            channel: 'whatsapp',
            conversationId: welcomeSession.id,
          })

          if (welcomeResult.isWelcomeMessage && welcomeResult.welcomeText) {
            logger.info('[ULTRAMSG] ✅ Welcome message prepared', {
              customerId: customer.id,
              messageId: welcomeResult.assistantMessageId,
            })

            // 📤 Send welcome message directly
            try {
              const directSend = new WhatsAppDirectSendService(prisma)
              await directSend.send({
                workspaceId: customer.workspaceId,
                customerId: customer.id,
                phoneNumber: customer.phone,
                messageContent: welcomeResult.welcomeText,
                conversationMessageId: welcomeResult.assistantMessageId,
                skipSecurityCheck: true,
              })
              logger.info('[ULTRAMSG] ✅ Welcome message sent directly', { customerId: customer.id })
            } catch (sendError) {
              logger.error('[ULTRAMSG] ❌ Failed to send welcome message', {
                error: sendError instanceof Error ? sendError.message : String(sendError),
                customerId: customer.id,
              })
            }

            return res.status(200).json({
              status: 'welcomed',
              message: welcomeResult.welcomeText,
              customerId: customer.id,
              messageId: welcomeResult.assistantMessageId,
            })
          } else {
            logger.warn('[ULTRAMSG] ⚠️ Welcome message skipped', {
              reason: 'Not configured or disabled',
            })
          }
        }
      }

      // Customer has chat history → continue to normal LLM processing
      logger.info('[ULTRAMSG] 📚 Customer has chat history - continuing normal flow', {
        customerId: customer.id,
        messageCount: welcomeMessageCount,
      })

      // 4.5. 🎧 Operator Flow: If message is from operator, handle relaying back to customer
      if (isOperator) {
        logger.info('[ULTRAMSG] 🎧 Operator message detected - relaying to customer', {
          workspaceId,
          operatorPhone: phoneNumber,
        })
        await this.operatorRelayService.handleOperatorMessage(
          workspaceId,
          messageMarkdown
        )
        return res.status(200).json({ status: 'processed', source: 'operator_relay' })
      }

      // 4.7. 👤 Human Support Guard: If customer is in human support mode (chatbot disabled), relay to operator
      if (customer.activeChatbot === false) {
        logger.info('[ULTRAMSG] 👤 Customer in human support mode - relaying to operator', {
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

      // 6. 🚦 Rate limiting (EXACTLY like Meta)
      const [
        customerPerMin,
        customerBurst,
        workspacePerMin,
        workspaceBurst,
      ] = await Promise.all([
        platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_CUSTOMER_PER_MIN'),
        platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_CUSTOMER_BURST'),
        platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_WORKSPACE_PER_MIN'),
        platformConfigService.getLimit('WHATSAPP_RATE_LIMIT_WORKSPACE_BURST'),
      ])

      // Customer rate limit
      const customerRateLimitKey = `customer:${customer.id}`
      const customerLimiterConfig = buildTokenBucketConfig(customerPerMin, customerBurst)
      if (!whatsappMessageRateLimiter.isAllowed(customerRateLimitKey, customerLimiterConfig)) {
        const timeToReset = whatsappMessageRateLimiter.getTimeToReset(
          customerRateLimitKey,
          customerLimiterConfig
        )
        logger.warn('[ULTRAMSG] 🚫 Rate limit exceeded for customer', {
          customerId: customer.id,
          timeToResetMs: timeToReset,
        })
        return res.status(200).json({
          status: 'rate_limited',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many messages. Please wait before sending more.',
          retryAfterMs: timeToReset,
        })
      }

      // Workspace rate limit
      const workspaceRateLimitKey = `workspace:${workspaceId}`
      const workspaceLimiterConfig = buildTokenBucketConfig(workspacePerMin, workspaceBurst)
      if (!whatsappWorkspaceRateLimiter.isAllowed(workspaceRateLimitKey, workspaceLimiterConfig)) {
        const timeToReset = whatsappWorkspaceRateLimiter.getTimeToReset(
          workspaceRateLimitKey,
          workspaceLimiterConfig
        )
        logger.warn('[ULTRAMSG] 🚫 Rate limit exceeded for workspace', {
          workspaceId,
          timeToResetMs: timeToReset,
        })
        return res.status(200).json({
          status: 'rate_limited',
          code: 'WORKSPACE_RATE_LIMIT_EXCEEDED',
          message: 'Too many messages in this channel. Please wait.',
          retryAfterMs: timeToReset,
        })
      }

      // 7. 🔒 Check workspace access (EXACTLY like Meta)
      const { WorkspaceAccessService } = await import(
        '../../../application/services/workspace-access.service'
      )
      const workspaceAccessService = new WorkspaceAccessService(prisma)
      
      const accessResult = await workspaceAccessService.canProcessMessages(
        workspaceId,
        false // Check channelStatus
      )

      if (!accessResult.canProcess) {
        // 🚫 CHANNEL_DISABLED → Silent block (no response)
        if (accessResult.blockReason === 'CHANNEL_DISABLED') {
          logger.info('[ULTRAMSG] 🚫 Channel disabled - saving message without response', {
            workspaceId,
            customerId: customer.id,
          })

          let chatSession = await prisma.chatSession.findFirst({
            where: {
              customerId: customer.id,
              status: 'active',
            },
          })

          if (!chatSession) {
            chatSession = await prisma.chatSession.create({
              data: {
                customerId: customer.id,
                workspaceId,
                status: 'active',
              },
            })
          }

          await prisma.conversationMessage.create({
            data: {
              workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: 'user',
              content: whatsAppToMarkdown(messageText),
              agentType: 'NONE',
              tokensUsed: 0,
              debugInfo: JSON.stringify({
                channelDisabled: true,
                reason: 'workspace.channelStatus = false',
                source: 'ultramsg-webhook',
              }),
            },
          })

          return res.status(200).json({
            status: 'channel_disabled',
            code: 'CHANNEL_DISABLED',
            message: 'Channel is disabled.',
          })
        }

        // 🚧 DEBUG_MODE → Send WIP message
        if (accessResult.blockReason === 'DEBUG_MODE') {
          logger.info('[ULTRAMSG] 🚧 Debug mode (WIP) - sending maintenance message', {
            workspaceId,
            customerId: customer.id,
          })
          
          // Get or create chat session
          let chatSession = await prisma.chatSession.findFirst({
            where: {
              customerId: customer.id,
              status: 'active',
            },
          })

          if (!chatSession) {
            chatSession = await prisma.chatSession.create({
              data: {
                customerId: customer.id,
                workspaceId,
                status: 'active',
              },
            })
          }

          const rawWipMessage = workspace.wipMessage || 'Work in progress. Please contact us later.'
          
          // 🌍 TRANSLATE WIP message to customer's language
          // Language priority: customer.language → phone prefix (only IT/ES/PT) → workspace.defaultLanguage
          const customerLang = customer.language 
            || detectLanguageFromPhonePrefix(customer.phone) 
            || workspace.defaultLanguage // NOT nullable - set during channel registration
          
          let wipMessage = rawWipMessage
          
          try {
            const { TranslationAgent } = require('../../../application/agents/TranslationAgent')
            const translationAgent = new TranslationAgent(prisma)
            const translationResult = await translationAgent.process({
              workspaceId,
              message: rawWipMessage,
              targetLanguage: customerLang,
              customerName: customer.name || 'Customer',
              customerId: customer.id,
              channel: 'whatsapp',
            })
            wipMessage = translationResult.message || rawWipMessage
            logger.info('[ULTRAMSG] 🌍 WIP message translated', {
              language: customerLang,
            })
          } catch (translationError) {
            logger.warn('[ULTRAMSG] ⚠️ WIP translation failed, using raw message', {
              error: translationError,
            })
          }
          
          // Save user message + WIP message
          await prisma.conversationMessage.create({
            data: {
              workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: 'user',
              content: whatsAppToMarkdown(messageText),
              agentType: 'NONE',
              tokensUsed: 0,
              debugInfo: JSON.stringify({
                channelDisabled: true,
                reason: 'workspace.debugMode = true (WIP mode)',
                source: 'ultramsg-webhook',
              }),
            },
          })

          const assistantMessage = await prisma.conversationMessage.create({
            data: {
              workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: 'assistant',
              content: wipMessage,
              agentType: 'ROUTER',
              tokensUsed: 0,
              deliveryStatus: 'pending',
              debugInfo: JSON.stringify({
                channelDisabled: true,
                reason: 'workspace.debugMode = true (WIP mode)',
                source: 'ultramsg-webhook',
              }),
            },
          })

          // Send WIP message directly
          try {
            const directSend = new WhatsAppDirectSendService(prisma)
            await directSend.send({
              workspaceId,
              customerId: customer.id,
              phoneNumber: customer.phone,
              messageContent: wipMessage,
              conversationMessageId: assistantMessage.id,
              skipSecurityCheck: true,
            })
          } catch (error) {
            logger.error('[ULTRAMSG] ❌ Failed to send WIP message', { error })
          }
          
          return res.status(200).json({
            status: 'debug_wip',
            code: 'DEBUG_MODE',
            message: 'Channel is in maintenance mode.',
            wipMessage,
          })
        }
        
        // Silent block for billing issues
        logger.warn('[ULTRAMSG] 🚫 Workspace blocked - SILENT BLOCK', {
          workspaceId,
          customerId: customer.id,
          blockReason: accessResult.blockReason,
        })

        return res.status(402).json({
          status: 'workspace_blocked',
          code: accessResult.blockReason,
          message: accessResult.message,
        })
      }

      // 8. 💰 Additional billing check for existing customers (EXACTLY like Meta)
      const { SubscriptionBillingService: BillingService2 } = await import(
        '../../../application/services/subscription-billing.service'
      )
      const billingService2 = new BillingService2(prisma)

      const trialStatus2 = await billingService2.isTrialValid(workspaceId)
      if (trialStatus2.isTrialPlan && !trialStatus2.isValid) {
        logger.warn('[ULTRAMSG] 💰 Trial expired - SILENT BLOCK', {
          workspaceId,
          customerId: customer.id,
        })
        return res.status(402).json({
          status: 'billing_error',
          code: 'TRIAL_EXPIRED',
          message: 'Trial period has expired.',
        })
      }

      const messageCost2 = await billingService2.getOperationCost(workspaceId, 'message')
      const creditCheck2 = await billingService2.checkCredit(workspaceId, messageCost2)

      if (!creditCheck2.hasSufficientCredit) {
        logger.warn('[ULTRAMSG] 💰 Insufficient credit - SILENT BLOCK', {
          workspaceId,
          customerId: customer.id,
        })
        return res.status(200).json({
          status: 'billing_error',
          code: 'INSUFFICIENT_CREDIT',
          message: 'Insufficient credit.',
        })
      }

      // 9. 💾 Get or create active chat session
      let chatSession = await prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          status: 'active',
        },
      })

      if (!chatSession) {
        logger.info('[ULTRAMSG] Creating new chat session', {
          customerId: customer.id,
        })
        chatSession = await prisma.chatSession.create({
          data: {
            customerId: customer.id,
            workspaceId,
            status: 'active',
            context: {
              createdBy: 'ultramsg-webhook',
              phoneNumber,
            },
          },
        })
      }

      // 10. Already converted at step 2.5

      // 11. 🔒 CRITICAL: If chatbot is disabled, ONLY save message (EXACTLY like Meta)
      if (customer && !customer.activeChatbot) {
        logger.info('[ULTRAMSG] 🚫 Chatbot disabled - saving message without LLM', {
          customerId: customer.id,
        })

        const savedMessage = await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: 'user',
            content: messageMarkdown,
            agentType: 'NONE',
            tokensUsed: 0,
            debugInfo: JSON.stringify({
              chatbotDisabled: true,
              reason: 'activeChatbot = false',
              source: 'ultramsg-webhook',
            }),
          },
        })

        // 🔔 Notify realtime clients (chat list + message thread)
        try {
          websocketService.notifyNewMessage(workspaceId, {
            id: savedMessage.id,
            sessionId: chatSession.id,
            content: messageMarkdown,
            sender: 'user',
            timestamp: savedMessage.createdAt.toISOString(),
            workspaceId,
            metadata: {
              chatbotDisabled: true,
              source: 'ultramsg-webhook',
            },
          })
          websocketService.notifyChatUpdated(workspaceId, {
            sessionId: chatSession.id,
            lastMessage: messageMarkdown.substring(0, 100),
            lastMessageAt: savedMessage.createdAt.toISOString(),
            customerId: customer.id,
          })
        } catch (wsError) {
          logger.warn('[ULTRAMSG] ⚠️ Failed to notify WebSocket for chatbot-disabled message', {
            error: wsError,
            workspaceId,
            customerId: customer.id,
          })
        }

        return res.status(200).json({
          status: 'message_saved',
          message: 'Message saved (chatbot disabled)',
          chatbotDisabled: true,
          sessionId: chatSession.id,
        })
      }

      // 12. 💾 SAVE USER MESSAGE **FIRST** (CRITICAL - EXACTLY like Meta)
      // 🔄 FLOW workspaces SKIP this step: FlowWorkspaceStrategy.saveUserAndAssistantAtomic()
      // saves user+assistant together. Saving here would:
      //   (a) create DUPLICATE user message in history → LLM sees contradiction
      //   (b) make WelcomeMessageHandler count=1 → isFirstMessage=false → no welcome prefix
      let savedUserMessage: { id: string } | null = null
      if (workspace.channelMode !== 'FLOW') {
        savedUserMessage = await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: 'user',
            content: messageMarkdown,
            agentType: 'CUSTOMER',
            tokensUsed: 0,
            deliveryStatus: 'delivered', // User messages are always delivered
            debugInfo: JSON.stringify({
              source: 'ultramsg-webhook',
              timestamp: new Date().toISOString(),
            }),
          },
        })

        logger.info('[ULTRAMSG] 💾 User message saved to history', {
          customerId: customer.id,
          conversationId: chatSession.id,
          messageId: savedUserMessage.id,
        })
      } else {
        logger.info('[ULTRAMSG] 🔄 FLOW workspace — skipping user message save (FlowWorkspaceStrategy handles it)', {
          customerId: customer.id,
          conversationId: chatSession.id,
        })
      }

      // 13. 🔒 SECURITY CHECK (same as Meta)
      logger.info('[ULTRAMSG] 🔍 Starting security validation', {
        customerId: customer.id,
        workspaceId,
      })

      let securityResults
      try {
        securityResults = await SecurityCheckService.validateMessage({
          workspaceId,
          visitorId: phoneNumber,
          message: messageMarkdown,
          channel: 'whatsapp',
        })
        logger.info('[ULTRAMSG] ✅ Security validation completed', { 
          resultsCount: securityResults.length,
          customerId: customer.id,
        })
      } catch (securityError) {
        logger.error('[ULTRAMSG] ❌ Security validation error', {
          error: securityError instanceof Error ? securityError.message : String(securityError),
          customerId: customer.id,
        })
        
        return res.status(500).json({
          status: 'security_check_error',
          message: 'Failed to validate message security',
        })
      }

      // Check if any security step failed
      const failedStep = securityResults.find((result) => !result.passed)
      if (failedStep) {
        logger.warn('[ULTRAMSG] 🚨 Security check failed - message blocked', {
          customerId: customer.id,
          step: failedStep.step,
          reason: failedStep.reason,
        })

        // Update the user message with security blocked flag
        // (message already saved above)

        return res.status(429).json({
          status: 'security_blocked',
          code: failedStep.step,
          message: failedStep.reason || 'Security check failed',
        })
      }

      logger.info('[ULTRAMSG] ✅ Security validation passed', { customerId: customer.id })

      // 13.5. 📊 REGISTRATION PROMPT LOGIC (Progressive invitation system)
      // Count user messages to determine registration prompt level
      const messageCount = await prisma.conversationMessage.count({
        where: {
          conversationId: chatSession.id,
          role: 'user',
          customerId: customer.id,
        },
      })

      logger.info('[ULTRAMSG] 📊 Message count check', {
        customerId: customer.id,
        messageCount,
        isRegistered: customer.isActive, // isActive = registered in DB schema
      })

      // Import registration prompt service
      const { registrationPromptService } = require('../../../services/registration-prompt.service')

      // Check if user should be blocked (15+ messages without registration)
      if (registrationPromptService.shouldBlockUser(messageCount, customer.isActive)) {
        logger.warn('[ULTRAMSG] ⛔ Blocking unregistered user (15+ messages)', {
          customerId: customer.id,
          messageCount,
        })

        // Block customer
        // TODO: Need migration to add isBlocked, blockedReason, blockedAt to Customers table
        await prisma.customers.update({
          where: { id: customer.id },
          data: {
            isBlacklisted: true, // 🚨 TEMP: Using isBlacklisted until migration adds isBlocked
            // isBlocked: true,
            // blockedReason: 'MAX_MESSAGES_UNREGISTERED',
            // blockedAt: new Date(),
          },
        })

        return res.status(403).json({
          status: 'blocked',
          code: 'MAX_MESSAGES_UNREGISTERED',
          message: 'Account blocked. Please register to continue chatting.',
        })
      }

      // Get registration prompt level (0-3)
      const registrationPromptLevel = registrationPromptService.getPromptLevel(
        messageCount,
        customer.isActive // isActive = registered in DB schema
      )

      logger.info('[ULTRAMSG] 📊 Registration prompt level', {
        customerId: customer.id,
        messageCount,
        promptLevel: registrationPromptLevel,
      })

      // 14. 🤖 CHAT ENGINE (same as Meta)
      logger.info('[ULTRAMSG] 🎯 Calling ChatEngineService', {
        customerId: customer.id,
        conversationId: chatSession.id,
        messageLength: messageMarkdown.length,
        registrationPromptLevel, // Pass level to chat engine
      })

      const customerLanguage =
        customer.language ||
        detectLanguageFromPhonePrefix(customer.phone) ||
        workspace.defaultLanguage

      const historyMessages = await prisma.conversationMessage.findMany({
        where: {
          workspaceId,
          customerId: customer.id,
          conversationId: chatSession.id,
          role: { in: ['user', 'assistant'] },
          ...(savedUserMessage ? { id: { not: savedUserMessage.id } } : {}),
        },
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      })

      const customClientResult = await this.customClientChatbotService.invoke({
        workspaceId,
        workspaceSlug: workspace.slug,
        customChatbotId: workspace.customChatbotId, // 🤖 DB field (authoritative)
        userMessage: messageMarkdown,
        userName: customer.name || 'Customer',
        channel: 'whatsapp',
        welcomeMessage: workspace.welcomeMessage || '',
        wipMessage: workspace.wipMessage || 'Work in progress. Please contact us later.',
        channelActive: workspace.channelStatus !== false,
        debugChannel: workspace.debugMode === true,
        isPlayground: false,
        language: customerLanguage,
        sessionId: chatSession.id,
        customerId: customer.id,
        phoneNumber: customer.phone,
        history: historyMessages.map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content || '',
          timestamp: message.createdAt?.toISOString(),
        })),
      })

      if (customClientResult.handled && customClientResult.output) {
        const customOutput = customClientResult.output
        await applyCustomerPatches(customOutput.patches, customer.id, workspaceId)

        if (customOutput.shouldEscalate && customOutput.escalationSummary) {
          void applyEscalationNotification({
            workspaceId,
            customerId: customer.id,
            escalationSummary: customOutput.escalationSummary,
            history: (historyMessages ?? []).map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content || '' })),
            customerName: customer.name || 'Unknown',
            customerPhone: customer.phone || undefined,
            notificationEmails: customOutput.notificationEmails,
            operatorContactMethod: customOutput.operatorContactMethod,
            operatorWhatsappNumber: customOutput.operatorWhatsappNumber,
            smtpConfig: customOutput.smtpConfig,
          })

          // Hand the conversation to the human operator: stop the bot from
          // replying. Mirrors the same pattern in whatsapp-webhook and the
          // playground controller.
          try {
            await prisma.customers.update({
              where: { id: customer.id },
              data: { activeChatbot: false },
            })
          } catch (err: any) {
            logger.error('[Ultramsg] Failed to disable chatbot after escalation', {
              customerId: customer.id,
              error: err?.message,
            })
          }
        }

        if (!savedUserMessage) {
          savedUserMessage = await prisma.conversationMessage.create({
            data: {
              workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: 'user',
              content: messageMarkdown,
              agentType: 'CUSTOMER',
              tokensUsed: 0,
              deliveryStatus: 'delivered',
              debugInfo: JSON.stringify({
                source: 'ultramsg-webhook',
                pipeline: 'custom-ecolaundry',
                timestamp: new Date().toISOString(),
              }),
            },
            select: { id: true },
          })
        }

        let assistantMessageId: string | undefined
        if (customOutput.reply) {
          const savedAssistantMessage = await prisma.conversationMessage.create({
            data: {
              workspaceId,
              customerId: customer.id,
              conversationId: chatSession.id,
              role: 'assistant',
              content: customOutput.reply,
              agentType: 'ROUTER',
              tokensUsed: customOutput.meta?.tokensUsed || 0,
              deliveryStatus: 'pending',
              debugInfo: JSON.stringify({
                source: 'ultramsg-webhook',
                pipeline: 'custom-ecolaundry',
                shouldEscalate: customOutput.shouldEscalate,
                escalationSummary: customOutput.escalationSummary,
                meta: customOutput.meta,
              }),
            },
          })
          assistantMessageId = savedAssistantMessage.id
        }

        if (customOutput.reply) {
          try {
            const directSend = new WhatsAppDirectSendService(prisma)
            const { customerReply } = splitCustomChatbotReply(customOutput.reply)
            // Custom chatbots produce rich Markdown for the web playground.
            // WhatsApp supports a very limited subset (no tables, no `##`
            // headers, only single-asterisk bold). Down-convert before send.
            const whatsappReply = mdToWhatsApp(customerReply)
            await directSend.send({
              workspaceId,
              customerId: customer.id,
              phoneNumber: customer.phone,
              messageContent: whatsappReply,
              conversationMessageId: assistantMessageId,
            })
          } catch (sendError) {
            logger.error('[ULTRAMSG] ❌ Failed to send custom chatbot response', {
              error: sendError,
              workspaceId,
              customerId: customer.id,
            })
          }
        }

        logger.info('[ULTRAMSG] ✅ custom-ecolaundry processed message', {
          workspaceId,
          customerId: customer.id,
          hasReply: Boolean(customOutput.reply),
          shouldEscalate: customOutput.shouldEscalate,
        })

        return res.status(200).json({
          success: true,
          status: 'processed',
          data: {
            message: customOutput.reply,
            sessionId: chatSession.id,
            customerId: customer.id,
          },
          agentUsed: 'custom-ecolaundry',
          tokensUsed: customOutput.meta?.tokensUsed || 0,
          response: customOutput.reply,
          debugInfo: customOutput.meta?.debug,
        })
      }

      const chatEngine = getChatEngine(prisma)
      const routerResult = await chatEngine.routeMessage({
        workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        message: messageMarkdown,
        customerLanguage, // 🌍 Priority: customer.language → phone prefix (IT/ES/PT) → workspace.defaultLanguage (NOT nullable)
        customerName: customer.name,
        customerDiscount: customer.discount || 0,
        isPlayground: false,
        channel: 'whatsapp',
        registrationPromptLevel, // 🆕 NEW: Pass registration prompt level to Router
      })

      logger.info('[ULTRAMSG] ✅ ChatEngineService completed', {
        agentUsed: routerResult.agentUsed,
        tokensUsed: routerResult.tokensUsed,
        responseLength: routerResult.response?.length ?? 0,
      })

      // 🚫 Check if customer is blocked
      if (routerResult.isBlocked) {
        logger.warn('[ULTRAMSG] 🚫 Customer blocked - returning 410 Gone', {
          customerId: customer.id,
        })

        return res.status(410).json({
          status: 'blocked',
          message: 'Customer is blocked',
        })
      }

      // 15. 📤 QUEUE DELIVERY (same as Meta)
      logger.info('[ULTRAMSG] 📤 Saving response to WhatsApp queue', {
        customerId: customer.id,
        workspaceId,
        responseLength: routerResult.response.length,
      })

      try {
        const assistantMessage = await prisma.conversationMessage.findFirst({
          where: {
            conversationId: chatSession.id,
            role: 'assistant',
            content: routerResult.response,
          },
          orderBy: { createdAt: 'desc' },
        })

        const directSend = new WhatsAppDirectSendService(prisma)
        await directSend.send({
          workspaceId,
          customerId: customer.id,
          phoneNumber: customer.phone,
          messageContent: routerResult.response,
          conversationMessageId: assistantMessage?.id,
        })

        logger.info('[ULTRAMSG] ✅ Response sent directly to WhatsApp', { customerId: customer.id })
      } catch (sendError) {
        logger.error('[ULTRAMSG] ❌ Failed to send WhatsApp response', {
          error: sendError,
          customerId: customer.id,
        })
      }

      logger.info('✅ UltraMsg Webhook processed successfully', {
        workspaceId,
        phoneNumber,
        messageId: id,
      })

      // Return 200 OK to UltraMsg
      return res.status(200).json({ 
        success: true,
        status: 'processed',
        data: {
          message: routerResult.response,
          sessionId: chatSession.id,
          customerId: customer.id,
        },
      })

    } catch (error: any) {
      logger.error('❌ UltraMsg Webhook processing failed', {
        workspaceId,
        error: error.message,
        stack: error.stack,
      })

      // Still return 200 to prevent UltraMsg from retrying
      return res.status(200).json({ 
        success: false, 
        error: 'Internal processing error' 
      })
    }
  }

  /**
   * Test connection endpoint
   * GET /api/whatsapp/ultramsg/test/:workspaceId
   */
  async testConnection(req: Request, res: Response): Promise<Response> {
    const { workspaceId } = req.params

    try {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          deletedAt: null,
        },
        include: {
          whatsappSettings: {
            select: { webhookId: true }
          }
        }
      })

      if (!workspace) {
        return res.status(404).json({ error: 'Workspace not found' })
      }

      const ws = workspace as any

      if (ws.whatsappProvider !== 'ultramsg') {
        return res.status(400).json({ 
          error: 'Workspace is not configured to use UltraMsg' 
        })
      }

      if (!ws.ultraMsgInstanceId || !ws.ultraMsgToken) {
        return res.status(400).json({ 
          error: 'UltraMsg credentials not configured' 
        })
      }

      const webhookId = workspace.whatsappSettings?.webhookId || workspaceId

      return res.status(200).json({
        success: true,
        message: 'UltraMsg connection configured',
        webhookUrl: `https://www.echatbot.ai/api/whatsapp/ultramsg/${webhookId}`,
      })

    } catch (error: any) {
      logger.error('❌ UltraMsg test connection failed', {
        workspaceId,
        error: error.message,
      })

      return res.status(500).json({ 
        error: 'Failed to test connection',
        message: error.message,
      })
    }
  }
}

export const ultraMsgWebhookController = new UltraMsgWebhookController()
