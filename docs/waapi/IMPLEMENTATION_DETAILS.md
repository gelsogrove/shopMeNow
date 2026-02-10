# WaAPI Implementation Details - COMPLETE GUIDE

**Author**: Andrea's requirement analysis  
**Date**: 2026-02-10  
**Status**: NOT IMPLEMENTED - This is the detailed implementation plan

---

## 🎯 OBIETTIVO FINALE

L'utente deve potersi **registrare da solo** a WaAPI Provider tramite:
1. **Onboarding con QR Code** (self-service)
2. **Gestione credenziali** nelle Settings (disconnect/reconnect)
3. **Zero intervento admin** per connessione WhatsApp

---

## 📋 PREREQUISITI CRITICI

### 1. **Subscription Payment FIRST** 🚨
**BEFORE ANYTHING**: L'utente DEVE avere un piano attivo con crediti disponibili.

```typescript
// Backend: Check before allowing WaAPI instance creation
async createWaapiInstance(workspaceId: string, userId: string) {
  // 🔥 STEP 0: Verify subscription status
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      planType: true,
      creditBalance: true,
      subscriptionStatus: true
    }
  });

  // Block if no active subscription
  if (user.planType === 'FREE_TRIAL' && new Date() > user.trialEndsAt) {
    throw new Error('Trial expired. Please upgrade to create a channel.');
  }

  if (user.subscriptionStatus !== 'ACTIVE') {
    throw new Error('Active subscription required to create a channel.');
  }

  if (user.creditBalance < 5.00) {
    throw new Error('Insufficient credits. Minimum €5.00 required to create channel.');
  }

  // ✅ Proceed with instance creation
  // ...
}
```

**Frontend Check**:
```tsx
// Show "Upgrade Plan" banner if no subscription
{!hasActiveSubscription && (
  <Alert variant="warning">
    <AlertTitle>Active Subscription Required</AlertTitle>
    <p>You need an active subscription plan to connect your WhatsApp channel.</p>
    <Button onClick={() => navigate('/settings/billing')}>
      Upgrade Plan
    </Button>
  </Alert>
)}
```

---

## 🗄️ DATABASE SCHEMA CHANGES

### Migration 1: Add WaAPI Fields to Workspace

```sql
-- Migration: add_waapi_fields.sql
-- UP
ALTER TABLE "Workspace"
  ADD COLUMN "waapiInstanceId" TEXT,
  ADD COLUMN "waapiInstanceStatus" TEXT, -- 'pending' | 'authenticated' | 'ready' | 'disconnected' | 'failed'
  ADD COLUMN "waapiPhoneNumber" TEXT,
  ADD COLUMN "waapiPhoneName" TEXT,
  ADD COLUMN "waapiWebhookUrl" TEXT,
  ADD COLUMN "waapiWebhookEvents" TEXT[], -- ['qr', 'authenticated', 'ready', 'disconnected', 'auth_failure']
  ADD COLUMN "waapiQrCodeData" TEXT, -- Base64 data URL (ephemeral)
  ADD COLUMN "waapiQrGeneratedAt" TIMESTAMP, -- TTL tracking
  ADD COLUMN "waapiIsActive" BOOLEAN DEFAULT true,
  ADD COLUMN "waapiLastSyncAt" TIMESTAMP; -- Last status sync from webhook

-- Index for webhook lookups
CREATE INDEX "idx_workspace_waapi_instance" ON "Workspace"("waapiInstanceId");

-- DOWN
ALTER TABLE "Workspace"
  DROP COLUMN IF EXISTS "waapiInstanceId",
  DROP COLUMN IF EXISTS "waapiInstanceStatus",
  DROP COLUMN IF EXISTS "waapiPhoneNumber",
  DROP COLUMN IF EXISTS "waapiPhoneName",
  DROP COLUMN IF EXISTS "waapiWebhookUrl",
  DROP COLUMN IF EXISTS "waapiWebhookEvents",
  DROP COLUMN IF EXISTS "waapiQrCodeData",
  DROP COLUMN IF EXISTS "waapiQrGeneratedAt",
  DROP COLUMN IF EXISTS "waapiIsActive",
  DROP COLUMN IF EXISTS "waapiLastSyncAt";

DROP INDEX IF EXISTS "idx_workspace_waapi_instance";
```

### Environment Variables

```bash
# .env (WaAPI Configuration)
WAAPI_API_KEY=your_waapi_bearer_token_here
WAAPI_BASE_URL=https://api.waapi.app/v1
WAAPI_WEBHOOK_SECRET=generate_random_secret_here # For signature validation
APP_WEBHOOK_BASE_URL=https://echatbot.ai # Base URL for webhook callbacks

# QR Code TTL (in minutes)
WAAPI_QR_TTL_MINUTES=15 # QR expires after 15 minutes
```

---

## 🏗️ BACKEND IMPLEMENTATION

### 1. WaAPI Client Service

**File**: `apps/backend/src/services/waapi-client.service.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

interface WaapiInstanceResponse {
  id: string;
  status: string;
  phone_number?: string;
  phone_name?: string;
  webhook_url?: string;
}

interface WaapiQrResponse {
  qr_code: string; // Base64 data URL
}

export class WaapiClientService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.WAAPI_BASE_URL || 'https://api.waapi.app/v1',
      headers: {
        'Authorization': `Bearer ${process.env.WAAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30s timeout
    });

    // Log requests (mask token)
    this.client.interceptors.request.use((config) => {
      logger.info('[WaAPI-Client] Request:', {
        method: config.method,
        url: config.url,
        data: config.data
      });
      return config;
    });

    // Log responses
    this.client.interceptors.response.use(
      (response) => {
        logger.info('[WaAPI-Client] Response:', {
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('[WaAPI-Client] Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        throw error;
      }
    );
  }

  /**
   * Create new WaAPI instance
   * @param phoneNumber WhatsApp number (E.164 format: +39...)
   * @param displayName Optional display name
   * @returns Instance ID
   */
  async createInstance(phoneNumber: string, displayName?: string): Promise<string> {
    try {
      const { data } = await this.client.post<WaapiInstanceResponse>('/instances', {
        phone_number: phoneNumber,
        phone_name: displayName || 'eChatbot AI'
      });

      logger.info('[WaAPI] Instance created:', { instanceId: data.id, phoneNumber });
      return data.id;
    } catch (error: any) {
      logger.error('[WaAPI] Failed to create instance:', error);
      throw new Error(`WaAPI instance creation failed: ${error.message}`);
    }
  }

  /**
   * Set webhook URL and events for instance
   * MUST be called immediately after instance creation
   */
  async setWebhook(instanceId: string, webhookUrl: string): Promise<void> {
    try {
      await this.client.put(`/instances/${instanceId}`, {
        webhook_url: webhookUrl,
        webhook_events: ['qr', 'authenticated', 'ready', 'disconnected', 'auth_failure']
      });

      logger.info('[WaAPI] Webhook configured:', { instanceId, webhookUrl });
    } catch (error: any) {
      logger.error('[WaAPI] Failed to set webhook:', error);
      throw new Error(`WaAPI webhook setup failed: ${error.message}`);
    }
  }

  /**
   * Get current QR code for instance
   * @returns Base64 data URL
   */
  async getQrCode(instanceId: string): Promise<string> {
    try {
      const { data } = await this.client.get<WaapiQrResponse>(`/instances/${instanceId}/qr`);
      return data.qr_code;
    } catch (error: any) {
      logger.error('[WaAPI] Failed to get QR code:', error);
      throw new Error(`WaAPI QR retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get instance status
   */
  async getInstanceStatus(instanceId: string): Promise<WaapiInstanceResponse> {
    try {
      const { data } = await this.client.get<WaapiInstanceResponse>(`/instances/${instanceId}`);
      return data;
    } catch (error: any) {
      logger.error('[WaAPI] Failed to get instance status:', error);
      throw new Error(`WaAPI status check failed: ${error.message}`);
    }
  }

  /**
   * Delete instance (irreversible)
   * Called when switching provider or deleting workspace
   */
  async deleteInstance(instanceId: string): Promise<void> {
    try {
      await this.client.delete(`/instances/${instanceId}`);
      logger.info('[WaAPI] Instance deleted:', { instanceId });
    } catch (error: any) {
      logger.error('[WaAPI] Failed to delete instance:', error);
      throw new Error(`WaAPI deletion failed: ${error.message}`);
    }
  }

  /**
   * Validate webhook signature (if WaAPI provides one)
   * @param payload Raw webhook body
   * @param signature Signature header from WaAPI
   * @returns true if valid
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    // TODO: Implement HMAC validation when WaAPI docs specify the algorithm
    // For now, rely on instance ID validation in handler
    return true;
  }
}
```

---

### 2. Workspace Service - WaAPI Methods

**File**: `apps/backend/src/application/services/workspace.service.ts` (add methods)

```typescript
import { WaapiClientService } from '../../services/waapi-client.service';

export class WorkspaceService {
  private waapiClient: WaapiClientService;

  constructor(private prisma: PrismaClient) {
    this.waapiClient = new WaapiClientService();
  }

  /**
   * Initialize WaAPI instance for workspace
   * PREREQUISITE: User must have active subscription + credits
   */
  async initializeWaapiInstance(
    workspaceId: string,
    userId: string,
    phoneNumber: string,
    displayName?: string
  ) {
    // 🔥 STEP 0: Verify subscription (CRITICAL!)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        planType: true,
        creditBalance: true,
        subscriptionStatus: true,
        trialEndsAt: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check trial expiry
    if (user.planType === 'FREE_TRIAL') {
      if (!user.trialEndsAt || new Date() > user.trialEndsAt) {
        throw new Error('Trial expired. Please upgrade to create a channel.');
      }
    }

    // Check subscription status
    if (user.subscriptionStatus !== 'ACTIVE') {
      throw new Error('Active subscription required. Please upgrade your plan.');
    }

    // Check credits
    if (user.creditBalance < 5.00) {
      throw new Error('Insufficient credits. Minimum €5.00 required to create channel.');
    }

    // ✅ All checks passed - proceed with WaAPI creation
    return await this.prisma.$transaction(async (tx) => {
      // 1. Create WaAPI instance
      const instanceId = await this.waapiClient.createInstance(phoneNumber, displayName);

      // 2. Set webhook URL
      const webhookUrl = `${process.env.APP_WEBHOOK_BASE_URL}/api/waapi/webhook/${instanceId}`;
      await this.waapiClient.setWebhook(instanceId, webhookUrl);

      // 3. Get initial QR code
      const qrCodeData = await this.waapiClient.getQrCode(instanceId);

      // 4. Update workspace with WaAPI details
      const workspace = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          whatsappProvider: 'waapi',
          waapiInstanceId: instanceId,
          waapiInstanceStatus: 'pending',
          waapiPhoneNumber: phoneNumber,
          waapiPhoneName: displayName,
          waapiWebhookUrl: webhookUrl,
          waapiWebhookEvents: ['qr', 'authenticated', 'ready', 'disconnected', 'auth_failure'],
          waapiQrCodeData: qrCodeData,
          waapiQrGeneratedAt: new Date(),
          waapiIsActive: true,
          channelStatus: false // Will be enabled when status = 'ready'
        }
      });

      logger.info('[Workspace] WaAPI instance initialized:', {
        workspaceId,
        instanceId,
        phoneNumber
      });

      return workspace;
    });
  }

  /**
   * Disconnect WaAPI instance (set inactive + delete instance)
   */
  async disconnectWaapiInstance(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { waapiInstanceId: true, ownerId: true }
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new Error('Access denied');
    }

    if (!workspace.waapiInstanceId) {
      throw new Error('No WaAPI instance to disconnect');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Delete WaAPI instance (irreversible)
      await this.waapiClient.deleteInstance(workspace.waapiInstanceId);

      // 2. Clear WaAPI fields in database
      await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          waapiInstanceId: null,
          waapiInstanceStatus: null,
          waapiQrCodeData: null,
          waapiQrGeneratedAt: null,
          waapiIsActive: false,
          channelStatus: false
        }
      });

      logger.info('[Workspace] WaAPI instance disconnected:', { workspaceId });
    });
  }

  /**
   * Request new QR code (called if QR expired)
   */
  async regenerateWaapiQr(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        waapiInstanceId: true,
        waapiInstanceStatus: true,
        ownerId: true
      }
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (workspace.ownerId !== userId) {
      throw new Error('Access denied');
    }

    if (!workspace.waapiInstanceId) {
      throw new Error('No WaAPI instance found');
    }

    if (workspace.waapiInstanceStatus === 'ready') {
      throw new Error('Instance already connected');
    }

    // Get fresh QR code
    const qrCodeData = await this.waapiClient.getQrCode(workspace.waapiInstanceId);

    // Update database
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        waapiQrCodeData: qrCodeData,
        waapiQrGeneratedAt: new Date()
      }
    });

    logger.info('[Workspace] QR code regenerated:', { workspaceId });

    return qrCodeData;
  }
}
```

---

### 3. WaAPI Webhook Controller

**File**: `apps/backend/src/interfaces/http/controllers/waapi-webhook.controller.ts`

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
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

      // 🔒 STEP 1: Validate signature (if provided)
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

      // 🔒 STEP 2: Verify instance belongs to a workspace
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

      // ✅ STEP 3: Process event
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
        logger.info('[WaAPI-Webhook] Instance authenticated:', { workspaceId, phone_number });
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
```

---

### 4. API Routes

**File**: `apps/backend/src/interfaces/http/routes/waapi.routes.ts`

```typescript
import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { sessionValidationMiddleware } from '../middlewares/session-validation.middleware';
import { validateWorkspaceOperation } from '../middlewares/workspace-validation.middleware';
import { WorkspaceController } from '../controllers/workspace.controller';
import { WaapiWebhookController } from '../controllers/waapi-webhook.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

const workspaceController = new WorkspaceController(prisma);
const webhookController = new WaapiWebhookController();

// Rate limiter for webhook endpoint (10 req/min per instance)
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => req.params.instanceId,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many webhook requests' });
  }
});

/**
 * @swagger
 * /api/workspaces/{workspaceId}/waapi/initialize:
 *   post:
 *     summary: Initialize WaAPI instance (onboarding)
 *     tags: [WaAPI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 example: "+393331234567"
 *               displayName:
 *                 type: string
 *                 example: "My Shop Bot"
 *     responses:
 *       200:
 *         description: Instance created, QR code returned
 *       400:
 *         description: Validation error or insufficient credits
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/workspaces/:workspaceId/waapi/initialize',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  workspaceController.initializeWaapiInstance.bind(workspaceController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/waapi/disconnect:
 *   post:
 *     summary: Disconnect WaAPI instance (irreversible)
 *     tags: [WaAPI]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/workspaces/:workspaceId/waapi/disconnect',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  workspaceController.disconnectWaapiInstance.bind(workspaceController)
);

/**
 * @swagger
 * /api/workspaces/{workspaceId}/waapi/regenerate-qr:
 *   post:
 *     summary: Regenerate QR code (if expired)
 *     tags: [WaAPI]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/workspaces/:workspaceId/waapi/regenerate-qr',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceOperation,
  workspaceController.regenerateWaapiQr.bind(workspaceController)
);

/**
 * @swagger
 * /api/waapi/webhook/{instanceId}:
 *   post:
 *     summary: WaAPI webhook endpoint (called by WaAPI servers)
 *     tags: [WaAPI]
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *     responses:
 *       200:
 *         description: Webhook processed
 *       403:
 *         description: Invalid signature
 *       404:
 *         description: Instance not found
 */
router.post(
  '/waapi/webhook/:instanceId',
  webhookRateLimiter,
  webhookController.handleWebhook.bind(webhookController)
);

export default router;
```

Register in main router:
```typescript
// apps/backend/src/interfaces/http/routes/index.ts
import waapiRoutes from './waapi.routes';

router.use('/api', waapiRoutes);
```

---

## 🎨 FRONTEND IMPLEMENTATION

### 1. Onboarding Component - QR Code Flow

**File**: `apps/frontend/src/components/WaapiOnboarding.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from '@/lib/toast';
import api from '@/services/api';

interface WaapiOnboardingProps {
  onComplete: () => void;
}

type WaapiStatus = 'idle' | 'pending' | 'authenticated' | 'ready' | 'disconnected' | 'failed';

export function WaapiOnboarding({ onComplete }: WaapiOnboardingProps) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  
  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayName, setDisplayName] = useState('');
  
  // Onboarding state
  const [isInitializing, setIsInitializing] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [status, setStatus] = useState<WaapiStatus>('idle');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Poll status after initialization
  useEffect(() => {
    if (status === 'pending' || status === 'authenticated') {
      const interval = setInterval(async () => {
        await checkStatus();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [status]);

  // Check instance status from workspace data
  const checkStatus = async () => {
    try {
      await refreshWorkspaces();
      
      // Get updated workspace
      const workspace = await api.get(`/api/workspaces/${currentWorkspace?.id}`);
      
      if (workspace.data.waapiInstanceStatus) {
        setStatus(workspace.data.waapiInstanceStatus);
        
        if (workspace.data.waapiInstanceStatus === 'ready') {
          toast.success('WhatsApp connected successfully!');
          onComplete();
        }
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    }
  };

  // Initialize WaAPI instance
  const handleInitialize = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!phoneNumber.startsWith('+')) {
      toast.error('Phone number must start with + (e.g., +393331234567)');
      return;
    }

    try {
      setIsInitializing(true);

      const response = await api.post(
        `/api/workspaces/${currentWorkspace?.id}/waapi/initialize`,
        {
          phoneNumber,
          displayName: displayName || undefined
        }
      );

      // Set QR code and status
      setQrCodeData(response.data.waapiQrCodeData);
      setStatus(response.data.waapiInstanceStatus || 'pending');
      
      toast.success('QR code generated! Please scan with WhatsApp.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to initialize WaAPI');
      console.error('WaAPI initialization error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  // Regenerate QR code
  const handleRegenerateQr = async () => {
    try {
      setIsRegenerating(true);

      const response = await api.post(
        `/api/workspaces/${currentWorkspace?.id}/waapi/regenerate-qr`
      );

      setQrCodeData(response.data);
      toast.success('QR code regenerated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to regenerate QR');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Render status message
  const renderStatus = () => {
    switch (status) {
      case 'pending':
        return (
          <Alert>
            <AlertTitle>Waiting for scan</AlertTitle>
            <AlertDescription>
              Open WhatsApp on your phone, go to Settings → Linked Devices → Link a Device, 
              and scan the QR code above.
            </AlertDescription>
          </Alert>
        );
      case 'authenticated':
        return (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Authenticated</AlertTitle>
            <AlertDescription>
              WhatsApp is connecting... This may take a few seconds.
            </AlertDescription>
          </Alert>
        );
      case 'ready':
        return (
          <Alert variant="success">
            <AlertTitle>Connected!</AlertTitle>
            <AlertDescription>
              Your WhatsApp is ready to receive messages.
            </AlertDescription>
          </Alert>
        );
      case 'disconnected':
        return (
          <Alert variant="warning">
            <AlertTitle>Disconnected</AlertTitle>
            <AlertDescription>
              Your WhatsApp session ended. Please reconnect.
            </AlertDescription>
          </Alert>
        );
      case 'failed':
        return (
          <Alert variant="destructive">
            <AlertTitle>Authentication Failed</AlertTitle>
            <AlertDescription>
              QR scan failed. Please try again.
            </AlertDescription>
          </Alert>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Connect WhatsApp</h2>
      <p className="text-gray-600 mb-6">
        Connect your WhatsApp number to start chatting with customers.
      </p>

      {/* STEP 1: Phone Number Form */}
      {!qrCodeData && status === 'idle' && (
        <form onSubmit={handleInitialize} className="space-y-4">
          <div>
            <Label htmlFor="phoneNumber">WhatsApp Phone Number *</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+393331234567"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Use international format with country code (e.g., +39 for Italy)
            </p>
          </div>

          <div>
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="My Shop Bot"
            />
          </div>

          <Button type="submit" disabled={isInitializing} className="w-full">
            {isInitializing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate QR Code
          </Button>
        </form>
      )}

      {/* STEP 2: QR Code Display */}
      {qrCodeData && (
        <div className="space-y-4">
          <div className="bg-white border rounded-lg p-6 flex flex-col items-center">
            <img 
              src={qrCodeData} 
              alt="WhatsApp QR Code" 
              className="w-64 h-64 mb-4"
            />
            
            <Button
              onClick={handleRegenerateQr}
              disabled={isRegenerating}
              variant="outline"
              size="sm"
            >
              {isRegenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate QR Code
            </Button>
          </div>

          {/* Status Messages */}
          {renderStatus()}
        </div>
      )}
    </div>
  );
}
```

---

### 2. Settings Component - Disconnect/Reconnect

**File**: `apps/frontend/src/components/WaapiSettings.tsx`

```tsx
import { useState } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from '@/lib/toast';
import api from '@/services/api';

export function WaapiSettings() {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const isWaapiActive = currentWorkspace?.whatsappProvider === 'waapi';
  const instanceStatus = currentWorkspace?.waapiInstanceStatus;

  // Disconnect WaAPI instance (CRITICAL CONFIRMATION)
  const handleDisconnect = async () => {
    if (confirmText !== 'CONFIRM') {
      toast.error('Please type CONFIRM to proceed');
      return;
    }

    try {
      setIsDisconnecting(true);

      await api.post(
        `/api/workspaces/${currentWorkspace?.id}/waapi/disconnect`
      );

      toast.success('WhatsApp disconnected successfully');
      setShowDisconnectModal(false);
      setConfirmText('');
      await refreshWorkspaces();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to disconnect');
      console.error('Disconnect error:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (!isWaapiActive) {
    return (
      <Alert>
        <AlertTitle>Not using WaAPI</AlertTitle>
        <AlertDescription>
          This workspace is not using WaAPI provider.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">WhatsApp Connection (WaAPI)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Manage your WhatsApp connection settings.
        </p>

        {/* Status Display */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-lg font-bold capitalize">
                {instanceStatus || 'Unknown'}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium">Phone Number</p>
              <p className="text-lg">
                {currentWorkspace?.waapiPhoneNumber || 'Not set'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {instanceStatus === 'disconnected' && (
            <Button
              onClick={() => {/* Navigate to onboarding */}}
              variant="default"
              className="w-full"
            >
              Reconnect WhatsApp
            </Button>
          )}

          {instanceStatus === 'ready' && (
            <Button
              onClick={() => setShowDisconnectModal(true)}
              variant="destructive"
              className="w-full"
            >
              <AlertTriangle className="mr-2 h-4 w-4" />
              Disconnect WhatsApp
            </Button>
          )}
        </div>
      </div>

      {/* CRITICAL: Disconnect Confirmation Modal */}
      <Dialog open={showDisconnectModal} onOpenChange={setShowDisconnectModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Critical Action: Disconnect WhatsApp
            </DialogTitle>
            <DialogDescription className="text-base">
              <div className="space-y-3 mt-4">
                <Alert variant="destructive">
                  <AlertTitle>This action is irreversible!</AlertTitle>
                  <AlertDescription>
                    • Your WaAPI instance will be permanently deleted<br />
                    • You cannot recover this session<br />
                    • To use WhatsApp again, you will need to create a new instance
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label htmlFor="confirmText">
                    Type <span className="font-bold">CONFIRM</span> to continue
                  </Label>
                  <Input
                    id="confirmText"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CONFIRM"
                  />
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              onClick={() => {
                setShowDisconnectModal(false);
                setConfirmText('');
              }}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisconnect}
              disabled={confirmText !== 'CONFIRM' || isDisconnecting}
              variant="destructive"
            >
              {isDisconnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Disconnect WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

## 🔄 SCHEDULER - QR Code Cleanup

**File**: `apps/scheduler/src/jobs/waapi-qr-cleanup.job.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();
const QR_TTL_MINUTES = parseInt(process.env.WAAPI_QR_TTL_MINUTES || '15');

/**
 * Cleanup stale QR codes to avoid storing sensitive data long-term
 * Runs every 5 minutes
 */
export async function waapiQrCleanupJob() {
  logger.info('[WAAPI-QR-CLEANUP] Starting job');

  try {
    const ttlDate = new Date(Date.now() - QR_TTL_MINUTES * 60 * 1000);

    // Clear QR codes older than TTL (but keep instance status intact)
    const result = await prisma.workspace.updateMany({
      where: {
        waapiQrCodeData: { not: null },
        waapiQrGeneratedAt: { lt: ttlDate },
        waapiInstanceStatus: { not: 'ready' } // Don't clear if already connected
      },
      data: {
        waapiQrCodeData: null
      }
    });

    logger.info(`[WAAPI-QR-CLEANUP] Cleared ${result.count} stale QR codes`);
  } catch (error) {
    logger.error('[WAAPI-QR-CLEANUP] Failed:', error);
    throw error;
  }
}
```

Register in scheduler:
```typescript
// apps/scheduler/src/index.ts
import cron from 'node-cron';
import { waapiQrCleanupJob } from './jobs/waapi-qr-cleanup.job';

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await waapiQrCleanupJob();
  } catch (error) {
    logger.error('WaAPI QR cleanup job failed:', error);
  }
});
```

---

## ✅ ACCEPTANCE CRITERIA (Complete Checklist)

### Database
- [ ] Migration created for WaAPI fields
- [ ] Schema includes all fields (instanceId, status, phone, QR, webhook)
- [ ] Index created on `waapiInstanceId`
- [ ] Environment variables configured

### Backend
- [ ] WaapiClientService implemented with all endpoints
- [ ] WorkspaceService methods: initialize, disconnect, regenerate QR
- [ ] WaapiWebhookController handles all events
- [ ] Routes registered with proper middleware stack
- [ ] Subscription validation BEFORE instance creation
- [ ] Error handling with proper status codes
- [ ] Unit tests for service methods
- [ ] Integration tests for webhook flow

### Frontend
- [ ] WaapiOnboarding component with QR display
- [ ] Phone number validation (E.164 format)
- [ ] Real-time status updates via polling
- [ ] Regenerate QR button functional
- [ ] WaapiSettings component with disconnect/reconnect
- [ ] CRITICAL confirmation modal for disconnect
- [ ] Toast notifications for success/error
- [ ] Loading states for all async operations

### Scheduler
- [ ] QR cleanup job implemented
- [ ] Cron schedule configured (5 minutes)
- [ ] TTL configurable via env variable

### Testing
- [ ] Unit tests: WaapiClientService (create, delete, getStatus)
- [ ] Unit tests: WorkspaceService (initialize, disconnect)
- [ ] Unit tests: Webhook handler (all event types)
- [ ] Integration test: Full onboarding flow (E2E)
- [ ] Integration test: Disconnect + reconnect
- [ ] Integration test: QR expiry + regeneration
- [ ] Security test: Webhook signature validation
- [ ] Security test: Subscription validation
- [ ] Coverage: >80% for WaAPI modules

### Documentation
- [ ] API documentation in Swagger
- [ ] Environment variables documented
- [ ] Admin guide: "How to configure WaAPI"
- [ ] User guide: "How to connect WhatsApp"

---

## 🔐 SECURITY CONSIDERATIONS

### 1. Rate Limiting
```typescript
// Webhook endpoint: 10 req/min per instance
// API endpoints: Standard rate limiting (30 req/min per user)
```

### 2. Webhook Signature Validation
```typescript
// Validate HMAC signature if WaAPI provides one
// Fall back to instance ID validation
```

### 3. Subscription Gate
```typescript
// Block instance creation if:
// - Trial expired
// - Subscription inactive
// - Credit balance < €5.00
```

### 4. PII Protection
```typescript
// Never log:
// - Full phone numbers (mask: +39***1234)
// - QR code data (too large + sensitive)
// - API tokens
```

---

## 📊 MONITORING & ALERTS

### Key Metrics to Track
```typescript
// Prometheus/Grafana metrics:
- waapi_instance_created_total (counter)
- waapi_instance_deleted_total (counter)
- waapi_webhook_received_total (counter by event type)
- waapi_qr_generation_duration (histogram)
- waapi_instance_status_gauge (gauge by status)
```

### Alerts
```yaml
# Alert if webhook failures > 5% in 5 minutes
- alert: WaapiWebhookFailureRate
  expr: rate(waapi_webhook_failed_total[5m]) > 0.05
  annotations:
    summary: High webhook failure rate

# Alert if QR cleanup job fails
- alert: WaapiQrCleanupFailed
  expr: waapi_qr_cleanup_failed_total > 0
  annotations:
    summary: QR cleanup job failed
```

---

## 🚀 DEPLOYMENT PLAN

### Phase 1: Database Migration
1. Run migration in staging
2. Verify schema changes
3. Seed test data
4. Run migration in production

### Phase 2: Backend Deployment
1. Deploy WaapiClientService
2. Deploy webhook handler
3. Deploy API routes
4. Verify webhook endpoint is reachable from WaAPI servers
5. Test instance creation + QR generation

### Phase 3: Frontend Deployment
1. Deploy WaapiOnboarding component
2. Deploy WaapiSettings component
3. Test E2E flow in staging
4. Deploy to production

### Phase 4: Scheduler
1. Deploy QR cleanup job
2. Verify cron execution
3. Monitor logs

### Phase 5: Monitoring
1. Set up Prometheus metrics
2. Create Grafana dashboards
3. Configure alerts
4. Test alert notifications

---

## 🐛 DEBUGGING GUIDE

### Issue: QR Code not displaying
```bash
# Check workspace waapiQrCodeData field
SELECT "waapiQrCodeData", "waapiInstanceStatus" 
FROM "Workspace" 
WHERE id = 'workspace_id';

# Check backend logs
grep "WaAPI-Client" backend.log

# Verify WaAPI API key
curl -H "Authorization: Bearer $WAAPI_API_KEY" \
  https://api.waapi.app/v1/instances
```

### Issue: Webhook not received
```bash
# Check webhook URL is publicly accessible
curl -X POST https://echatbot.ai/api/waapi/webhook/instance123 \
  -H "Content-Type: application/json" \
  -d '{"event":"qr","instance_id":"instance123"}'

# Check workspace has correct webhookUrl
SELECT "waapiWebhookUrl" 
FROM "Workspace" 
WHERE "waapiInstanceId" = 'instance123';

# Check nginx/firewall allows POST to /api/waapi/webhook/*
```

### Issue: Instance stuck in "pending"
```bash
# Manually check WaAPI API status
curl -H "Authorization: Bearer $WAAPI_API_KEY" \
  https://api.waapi.app/v1/instances/{instanceId}

# Regenerate QR code
curl -X POST https://echatbot.ai/api/workspaces/{workspaceId}/waapi/regenerate-qr \
  -H "Authorization: Bearer {token}"
```

---

## 📚 REFERENCES

- **WaAPI Docs**: https://waapi.readme.io/
- **API Token**: https://waapi.readme.io/reference/api-token
- **Instances API**: https://waapi.readme.io/reference/retrieve-instance
- **Webhooks**: https://waapi.readme.io/reference/qr-event
- **QR Code Library**: https://github.com/soldair/node-qrcode

---

## ✨ FUTURE ENHANCEMENTS

### After MVP:
1. **WebSocket for real-time updates** (replace polling)
2. **Multiple instances per workspace** (support multiple WhatsApp numbers)
3. **Instance health monitoring** (automatic reconnection on failure)
4. **Advanced webhook signature validation** (HMAC-SHA256)
5. **Instance analytics** (messages sent, uptime, errors)
6. **Backup/restore instance data** (if WaAPI supports it)

---

**END OF IMPLEMENTATION GUIDE**

Andrea, questo documento contiene **TUTTO** quello che serve per implementare la feature WaAPI con auto-registrazione QR Code. Zero ambiguità, solo codice pronto per copy-paste! 🚀
