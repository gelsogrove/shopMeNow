import { Router } from 'express'
import { WhatsAppWebhookController } from '../controllers/whatsapp-webhook.controller'
import { WhatsAppSendController } from '../controllers/whatsapp-send.controller'
import { authMiddleware } from '../middlewares/auth.middleware'
import { workspaceValidationMiddleware } from '../middlewares/workspace-validation.middleware'
import { whatsappRateLimitMiddleware } from '../middlewares/whatsapp-rate-limit.middleware'

/**
 * WhatsApp Routes
 * 
 * Endpoints:
 * - GET  /api/whatsapp/webhook       → Meta verification (no auth)
 * - POST /api/whatsapp/webhook       → Receive messages (no auth, HMAC signature)
 * - POST /api/whatsapp/send          → Send messages (auth required)
 * 
 * Security:
 * - Webhook endpoints: HMAC signature verification + rate limiting
 * - Send endpoint: JWT auth + workspace validation + rate limiting
 */

const router = Router()

// Initialize controllers
const webhookController = new WhatsAppWebhookController()
const sendController = new WhatsAppSendController()

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   get:
 *     summary: WhatsApp webhook verification endpoint
 *     description: Meta uses this endpoint to verify webhook ownership. Returns the challenge value if token matches.
 *     tags: [WhatsApp]
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         schema:
 *           type: string
 *         required: true
 *         description: Must be 'subscribe'
 *       - in: query
 *         name: hub.verify_token
 *         schema:
 *           type: string
 *         required: true
 *         description: Verification token (must match WHATSAPP_VERIFY_TOKEN)
 *       - in: query
 *         name: hub.challenge
 *         schema:
 *           type: string
 *         required: true
 *         description: Challenge value to return
 *     responses:
 *       200:
 *         description: Verification successful, returns challenge
 *       403:
 *         description: Invalid verification token
 */
router.get(
  '/webhook',
  webhookController.verifyWebhook.bind(webhookController)
)

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   post:
 *     summary: Receive incoming WhatsApp messages
 *     description: Webhook endpoint for incoming messages from WhatsApp. Verifies HMAC signature and processes messages.
 *     tags: [WhatsApp]
 *     security: []  # No JWT auth, uses HMAC signature
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               object:
 *                 type: string
 *                 example: whatsapp_business_account
 *               entry:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Message received and processed
 *       403:
 *         description: Invalid HMAC signature
 *       500:
 *         description: Processing error
 */
router.post(
  '/webhook',
  whatsappRateLimitMiddleware,
  webhookController.receiveMessage.bind(webhookController)
)

/**
 * @swagger
 * /api/whatsapp/send:
 *   post:
 *     summary: Send WhatsApp message to customer
 *     description: Send a message to a customer via WhatsApp. Requires authentication and validates all IDs.
 *     tags: [WhatsApp]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - customerId
 *               - phoneNumber
 *               - message
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID (must match session)
 *               customerId:
 *                 type: string
 *                 description: Customer ID (must belong to workspace)
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number (must match customer, format +39...)
 *               message:
 *                 type: string
 *                 description: Message text in Markdown format
 *     responses:
 *       200:
 *         description: Message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messageId:
 *                   type: string
 *                 whatsappMessageId:
 *                   type: string
 *       400:
 *         description: Validation error (phone mismatch, WhatsApp not configured)
 *       403:
 *         description: Workspace mismatch
 *       404:
 *         description: Customer not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Server error
 */
router.post(
  '/send',
  authMiddleware,
  workspaceValidationMiddleware,
  whatsappRateLimitMiddleware,
  sendController.sendMessage.bind(sendController)
)

export default router
