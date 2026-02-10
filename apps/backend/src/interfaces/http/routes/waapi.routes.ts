import { Router } from 'express';
import { prisma } from '@echatbot/database';
import { authMiddleware } from '../middlewares/auth.middleware';
import { sessionValidationMiddleware } from '../middlewares/session-validation.middleware';
import { validateWorkspaceId } from '../middlewares/workspace-validation.middleware';
import { WorkspaceController } from '../controllers/workspace.controller';
import { WaapiWebhookController } from '../controllers/waapi-webhook.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

const workspaceController = new WorkspaceController();
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
  validateWorkspaceId,
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
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *     responses:
 *       200:
 *         description: Instance disconnected successfully
 *       400:
 *         description: Error disconnecting instance
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/workspaces/:workspaceId/waapi/disconnect',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceId,
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
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *     responses:
 *       200:
 *         description: QR code regenerated
 *       400:
 *         description: Error regenerating QR code
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/workspaces/:workspaceId/waapi/regenerate-qr',
  authMiddleware,
  sessionValidationMiddleware,
  validateWorkspaceId,
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [qr, authenticated, ready, disconnected, auth_failure]
 *               instance_id:
 *                 type: string
 *               timestamp:
 *                 type: string
 *               qr_code:
 *                 type: string
 *               phone_number:
 *                 type: string
 *               phone_name:
 *                 type: string
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
