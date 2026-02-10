import { Request, Response } from 'express';
import { PrismaClient } from '@echatbot/database';
import { WaapiClientService } from '../../../services/waapi-client.service';
import logger from '../../../utils/logger';

const prisma = new PrismaClient();

interface WaapiWebhookPayload {
  event: 'qr' | 'authenticated' | 'ready' | 'disconnected' | 'auth_failure';
  instance_id: string;
  timestamp: string;
  qr_code?: string; // Base64 data URL (only for 'qr' event)
  phone_number?: string; // Authenticated number
  phone_name?: string;
}

export class WaapiWebhookController {
  private waapiClient: WaapiClientService;

  constructor() {
    this.waapiClient = new WaapiClientService();
  }

  /**
   * POST /api/waapi/webhook/:instanceId
   * Webhook endpoint for WaAPI events
   *
   * SECURITY: Public endpoint (called by WaAPI servers)
   * - Rate limited (10 req/min per instance)
   * - Signature validation via x-waapi-signature header (if available)
   * - Instance ID must belong to existing workspace
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { instanceId } = req.params;
      const payload: WaapiWebhookPayload = req.body;
      const signature = req.headers['x-waapi-signature'] as string | undefined;

      logger.info('[WaAPI-Webhook] Event received:', {
        instanceId,
        event: payload.event,
        timestamp: payload.timestamp
      });

      // STEP 1: Validate signature (if provided)
      if (signature && process.env.WAAPI_WEBHOOK_SECRET) {
        const isValid = this.waapiClient.validateWebhookSignature(
          JSON.stringify(req.body),
          signature
        );
        if (!isValid) {
          logger.warn('[WaAPI-Webhook] Invalid signature:', { instanceId });
          res.status(403).json({ error: 'Invalid signature' });
          return;
        }
      }

      // STEP 2: Verify instance belongs to a workspace
      const workspace = await prisma.workspace.findFirst({
        where: {
          waapiInstanceId: instanceId,
          deletedAt: null
        }
      });

      if (!workspace) {
        logger.warn('[WaAPI-Webhook] Instance not found:', { instanceId });
        res.status(404).json({ error: 'Instance not found' });
        return;
      }

      // STEP 3: Process event
      await this.processWebhookEvent(workspace.id, payload);

      res.status(200).json({ success: true });
    } catch (error: any) {
      logger.error('[WaAPI-Webhook] Error processing webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Process webhook event and update workspace
   * IDEMPOTENT: Can be called multiple times with same event
   */
  private async processWebhookEvent(
    workspaceId: string,
    payload: WaapiWebhookPayload
  ): Promise<void> {
    const { event, qr_code, phone_number, phone_name } = payload;

    switch (event) {
      case 'qr':
        // Store new QR code (ephemeral)
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            waapiQrCodeData: qr_code,
            waapiQrGeneratedAt: new Date(),
            waapiInstanceStatus: 'pending',
            waapiLastSyncAt: new Date()
          }
        });
        logger.info('[WaAPI-Webhook] QR code updated:', { workspaceId });
        break;

      case 'authenticated':
        // User scanned QR, authenticating...
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            waapiInstanceStatus: 'authenticated',
            waapiPhoneNumber: phone_number,
            waapiPhoneName: phone_name,
            waapiQrCodeData: null, // Clear QR (no longer needed)
            waapiLastSyncAt: new Date()
          }
        });
        logger.info('[WaAPI-Webhook] Instance authenticated:', { workspaceId, phoneNumber: phone_number });
        break;

      case 'ready':
        // Instance fully connected and ready to send/receive messages
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            waapiInstanceStatus: 'ready',
            waapiQrCodeData: null,
            channelStatus: true, // Enable message queue
            waapiIsActive: true,
            waapiLastSyncAt: new Date()
          }
        });
        logger.info('[WaAPI-Webhook] Instance ready:', { workspaceId });
        break;

      case 'disconnected':
        // User logged out or phone disconnected
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            waapiInstanceStatus: 'disconnected',
            channelStatus: false, // Disable message queue
            waapiIsActive: false,
            waapiLastSyncAt: new Date()
          }
        });
        logger.warn('[WaAPI-Webhook] Instance disconnected:', { workspaceId });
        break;

      case 'auth_failure':
        // Authentication failed
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            waapiInstanceStatus: 'failed',
            channelStatus: false,
            waapiQrCodeData: null,
            waapiLastSyncAt: new Date()
          }
        });
        logger.error('[WaAPI-Webhook] Instance auth failed:', { workspaceId });
        break;

      default:
        logger.warn('[WaAPI-Webhook] Unknown event type:', { event });
    }
  }
}
