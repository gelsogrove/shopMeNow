/**
 * WasenderAPI Routes
 *
 * Session management (protected — JWT required):
 *   POST /workspaces/:workspaceId/wasender/initialize   → create session + start QR flow
 *   POST /workspaces/:workspaceId/wasender/disconnect   → pause session
 *   POST /workspaces/:workspaceId/wasender/delete       → permanently delete session
 *   POST /workspaces/:workspaceId/wasender/regenerate-qr → refresh QR string
 *
 * Webhook (public — called by WasenderAPI servers):
 *   POST /wasender/webhook/:workspaceId → session status + QR updates + incoming messages
 *
 * Recovery:
 *   POST /workspaces/:workspaceId/wasender/restart        → restart stuck session
 */

import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth.middleware'
import { sessionValidationMiddleware } from '../middlewares/session-validation.middleware'
import { workspaceValidationMiddleware } from '../middlewares/workspace-validation.middleware'
import { WorkspaceController } from '../controllers/workspace.controller'
import { WasenderWebhookController } from '../controllers/wasender-webhook.controller'
import rateLimit from 'express-rate-limit'

const router = Router()

const workspaceController = new WorkspaceController()
const wasenderWebhookController = new WasenderWebhookController()

// Rate limiter for webhook endpoint (30 req/min per workspace)
const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => req.params.workspaceId,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many webhook requests' })
  },
})

// ─── Session Management (Protected) ──────────────────────────────────────────

router.post(
  '/workspaces/:workspaceId/wasender/initialize',
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  workspaceController.initializeWasenderSession.bind(workspaceController)
)

router.post(
  '/workspaces/:workspaceId/wasender/disconnect',
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  workspaceController.disconnectWasenderSession.bind(workspaceController)
)

router.post(
  '/workspaces/:workspaceId/wasender/delete',
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  workspaceController.deleteWasenderSession.bind(workspaceController)
)

router.post(
  '/workspaces/:workspaceId/wasender/regenerate-qr',
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  workspaceController.regenerateWasenderQr.bind(workspaceController)
)

router.post(
  '/workspaces/:workspaceId/wasender/restart',
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  workspaceController.restartWasenderSession.bind(workspaceController)
)

router.post(
  '/workspaces/:workspaceId/wasender/sync-status',
  authMiddleware,
  sessionValidationMiddleware,
  workspaceValidationMiddleware,
  workspaceController.syncWasenderStatus.bind(workspaceController)
)

// ─── Webhook (Public - called by WasenderAPI) ─────────────────────────────────

/**
 * @swagger
 * /api/wasender/webhook/{workspaceId}:
 *   post:
 *     summary: WasenderAPI webhook endpoint (public — called by WasenderAPI servers)
 *     tags: [Wasender]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID (encoded in webhook URL at session creation)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event:
 *                 type: string
 *                 enum: [qrcode.updated, session.status, messages.received]
 *               sessionId:
 *                 type: string
 *                 description: Session API key (for verification)
 *     responses:
 *       200:
 *         description: Webhook processed
 *       403:
 *         description: Invalid session
 *       404:
 *         description: Workspace not found
 */
router.post(
  '/wasender/webhook/:workspaceId',
  webhookRateLimiter,
  wasenderWebhookController.handleWebhook.bind(wasenderWebhookController)
)

export default router
