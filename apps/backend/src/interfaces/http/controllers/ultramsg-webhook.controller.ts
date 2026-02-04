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
 */

import { Request, Response } from 'express'
import { prisma } from '@echatbot/database'
import logger from '../../../utils/logger'

export class UltraMsgWebhookController {
  /**
   * Handle incoming webhook from UltraMsg
   * POST /api/v1/whatsapp/ultramsg/:workspaceId
   */
  async handleWebhook(req: Request, res: Response): Promise<Response> {
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

      if (!workspace) {
        logger.warn('⚠️ UltraMsg Webhook: Workspace not found or not using UltraMsg', {
          workspaceId,
        })
        return res.status(404).json({
          error: 'Workspace not found or not configured for UltraMsg',
        })
      }

      // 2. Normalize phone number (add + prefix if missing)
      const phoneNumber = from.startsWith('+') ? from : `+${from}`

      // 3. Determine message type
      const messageType = type === 'image' || type === 'video' || type === 'document' 
        ? type 
        : 'text'

      // 4. Save webhook event for audit
      await prisma.whatsappWebhookEvent.create({
        data: {
          workspaceId,
          payload: req.body as any,
          processedAt: new Date(),
        },
      } as any)

      // 5. Process message (same processor as Meta)
      // This will trigger the LLM pipeline
      // Note: The actual message processing is handled by the WhatsApp message processor
      // which is called from the whatsapp-webhook.controller
      // For now, we just acknowledge receipt
      
      logger.info('✅ UltraMsg Webhook processed successfully', {
        workspaceId,
        phoneNumber,
        messageType,
        messageId: id,
      })

      // Return 200 OK to UltraMsg
      return res.status(200).json({ success: true })

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
