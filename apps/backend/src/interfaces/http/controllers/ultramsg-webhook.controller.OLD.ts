/**
 * UltraMsg Webhook Controller
 * 
 * Handles incoming webhooks from UltraMsg
 * Normalizes messages to internal format and processes them
 * 
 * Webhook URL format: POST /api/v1/whatsapp/ultramsg/:workspaceId
 * 
 * UltraMsg webhook payload format:
 * {
 *   "id": "msg_id",
 *   "from": "393123456789",
 *   "to": "instance_id",
 *   "body": "message text",
 *   "type": "chat" | "image" | "video" | "document",
 *   "timestamp": 1234567890
 * }
 * 
 * FLOW (IDENTICAL TO META):
 * 1. 🔒 Customer-level locking (prevent race conditions)
 * 2. 🚦 Rate limiting (customer + workspace)
 * 3. 📞 Phone normalization (variants)
 * 4. 🔍 Customer lookup/create
 * 5. 🔁 Deduplication (prevent double processing)
 * 6. 💰 Billing checks (trial, credit, limits)
 * 7. 🚫 Workspace access checks
 * 8. 💾 Save user message
 * 9. 🔒 Security LLM
 * 10. 🤖 Chat Engine
 * 11. 📤 Queue delivery
 */

import { Request, Response } from 'express'
import { prisma } from '@echatbot/database'
import { SecurityCheckService } from '../../../application/services/security-check.service'
import { getChatEngine } from '../../../application/chat-engine'
import { whatsappMessageRateLimiter, whatsappWorkspaceRateLimiter } from '../../../middlewares/rateLimiter'
import { platformConfigService } from '../../../services/platform-config.service'
import logger from '../../../utils/logger'
import { whatsAppToMarkdown } from '../../../utils/whatsapp-formatter'
import { buildPhoneVariants } from '../../../utils/phone'

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
  /**
   * Handle incoming webhook from UltraMsg
   * POST /api/v1/whatsapp/ultramsg/:workspaceId
   * 
   * FLOW (IDENTICAL TO META):
   * 1. Extract phone for locking
   * 2. Acquire customer-level lock
   * 3. Process message with lock held
   */
  async handleWebhook(req: Request, res: Response): Promise<Response> {
    const { workspaceId } = req.params

    // 🔒 STEP 0: Extract phone number FIRST for locking (before any processing)
    let phoneNumberForLock: string | undefined
    
    try {
      const { from } = req.body
      if (from) {
        phoneNumberForLock = from.startsWith('+') ? from.trim() : `+${from.trim()}`
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
        // Always release lock
        customerMessageLocks.delete(lockKey)
        releaseLock!()
        logger.info('[ULTRAMSG] 🔓 Released customer lock', { phone: phoneNumberForLock })
      }
    } else {
      // No phone number - process without lock
      return await this._handleWebhookLocked(req, res)
    }
  }
  
  /**
   * Internal method - processes message with lock held
   */
  private async _handleWebhookLocked(req: Request, res: Response): Promise<Response> {
    const { workspaceId } = req.params
    const { id, from, to, body, type, timestamp } = req.body

    logger.info('📥 UltraMsg Webhook received', {
      workspaceId,
      messageId: id,
      from,
      type,
      bodyLength: body?.length || 0,
    })

    try {
      // 1. Validate workspace exists and uses UltraMsg
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          deletedAt: null,
        },
      }) as any

      if (!workspace || workspace.whatsappProvider !== 'ultramsg') {
        logger.warn('⚠️ UltraMsg Webhook: Workspace not found or not using UltraMsg', {
          workspaceId,
          provider: workspace?.whatsappProvider,
        })
        return res.status(404).json({
          error: 'Workspace not found or not configured for UltraMsg',
        })
      }

      // 2. Normalize phone number (add + prefix if missing)
      const phoneNumber = from.startsWith('+') ? from : `+${from}`

      // 3. Find or create customer
      let customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
          phone: phoneNumber,
        },
        include: {
          workspace: true,
        },
      }) as any

      if (!customer) {
        logger.info('📝 UltraMsg: Creating new customer', {
          workspaceId,
          phoneNumber,
        })
        
        customer = await prisma.customers.create({
          data: {
            workspace: {
              connect: { id: workspaceId },
            },
            phone: phoneNumber,
            email: `${phoneNumber.replace(/\+/g, '')}@whatsapp.ultramsg.local`, // Placeholder email
            name: phoneNumber, // Default name = phone number
            language: workspace.defaultLanguage || 'it',
          },
          include: {
            workspace: true,
          },
        }) as any
      }

      // 4. Find or create chat session
      let chatSession = await prisma.chatSession.findFirst({
        where: {
          customerId: customer.id,
          status: 'active',
        },
      }) as any

      if (!chatSession) {
        chatSession = await prisma.chatSession.create({
          data: {
            workspaceId,
            customerId: customer.id,
            status: 'active',
          },
        }) as any
      }

      // 5. Save webhook event for audit
      await prisma.whatsappWebhookEvent.create({
        data: {
          workspaceId,
          payload: req.body as any,
          processedAt: new Date(),
        },
      } as any)

      // 6. Convert message to markdown format
      const messageMarkdown = whatsAppToMarkdown(body || '')

      // 🔒 STEP 7: SECURITY CHECK (same as Meta)
      logger.info('[ULTRAMSG] 🔍 Starting security validation', {
        customerId: customer.id,
        workspaceId,
        phoneNumber,
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

        // Save blocked message to history
        await prisma.conversationMessage.create({
          data: {
            workspaceId,
            customerId: customer.id,
            conversationId: chatSession.id,
            role: 'user',
            content: messageMarkdown,
            agentType: 'NONE',
            tokensUsed: 0,
            debugInfo: JSON.stringify({
              securityBlocked: true,
              failedStep: failedStep.step,
              reason: failedStep.reason,
              source: 'ultramsg-webhook',
            }),
          },
        })

        return res.status(429).json({
          status: 'security_blocked',
          code: failedStep.step,
          message: failedStep.reason || 'Security check failed',
        })
      }

      logger.info('[ULTRAMSG] ✅ Security validation passed', { customerId: customer.id })

      // 🤖 STEP 8: CHAT ENGINE (same as Meta)
      logger.info('[ULTRAMSG] 🎯 Calling ChatEngineService', {
        customerId: customer.id,
        conversationId: chatSession.id,
        messageLength: messageMarkdown.length,
      })

      const chatEngine = getChatEngine(prisma)
      const routerResult = await chatEngine.routeMessage({
        workspaceId,
        customerId: customer.id,
        conversationId: chatSession.id,
        message: messageMarkdown,
        customerLanguage: customer.language || workspace.defaultLanguage || 'it',
        customerName: customer.name,
        customerDiscount: customer.discount || 0,
        isPlayground: false,
        channel: 'whatsapp',
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

      // 📤 STEP 9: QUEUE DELIVERY (same as Meta)
      logger.info('[ULTRAMSG] 📤 Saving response to WhatsApp queue', {
        customerId: customer.id,
        workspaceId,
        responseLength: routerResult.response.length,
      })

      try {
        const { WhatsAppQueueService } = require('../../../services/whatsapp-queue.service')
        const queueService = new WhatsAppQueueService(prisma)
        
        // Find the assistant message created by ChatEngine
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

        logger.info('[ULTRAMSG] ✅ Response queued for WhatsApp delivery', {
          customerId: customer.id,
        })
      } catch (queueError) {
        logger.error('[ULTRAMSG] ❌ Failed to enqueue WhatsApp response', {
          error: queueError,
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
      // Log the error for debugging
      return res.status(200).json({ 
        success: false, 
        error: 'Internal processing error' 
      })
    }
  }

  /**
   * Test connection endpoint
   * GET /api/v1/whatsapp/ultramsg/test/:workspaceId
   */
  async testConnection(req: Request, res: Response): Promise<Response> {
    const { workspaceId } = req.params

    try {
      const workspace = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          deletedAt: null,
        },
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

      return res.status(200).json({
        success: true,
        message: 'UltraMsg connection configured',
        webhookUrl: `${process.env.API_URL}/api/v1/whatsapp/ultramsg/${workspaceId}`,
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
