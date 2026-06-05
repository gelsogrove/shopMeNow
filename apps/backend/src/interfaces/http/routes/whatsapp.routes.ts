import { Router } from "express"
import { WhatsAppSendController } from "../controllers/whatsapp-send.controller"
import { WhatsAppWebhookController } from "../controllers/whatsapp-webhook.controller"
import { ultraMsgWebhookController } from "../controllers/ultramsg-webhook.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { whatsappRateLimitMiddleware } from "../middlewares/whatsapp-rate-limit.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * WhatsApp Routes
 *
 * Endpoints:
 * - GET  /api/whatsapp/webhook/:webhookId       → Meta verification (no auth)
 * - POST /api/whatsapp/webhook/:webhookId       → Receive messages from Meta (no auth, HMAC signature)
 * - POST /api/whatsapp/ultramsg/:webhookId      → Receive messages from UltraMsg (no auth)
 * - POST /api/whatsapp/send                     → Send messages (auth required)
 *
 * Security:
 * - Meta webhook: HMAC signature verification + mTLS + rate limiting
 * - UltraMsg webhook: Rate limiting only (no signature verification)
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
 *     description: Meta uses this endpoint to verify webhook ownership. Returns hub.challenge if token matches.
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
router.get("/webhook/:webhookId", webhookController.verifyWebhook.bind(webhookController))

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
  "/webhook/:webhookId",
  // mTLS removed: Heroku does not pass through mTLS client certs.
  // Security is provided by HMAC signature (X-Hub-Signature-256) verified in the controller.
  whatsappRateLimitMiddleware,
  webhookController.receiveMessage.bind(webhookController)
)

/**
 * @swagger
 * /api/whatsapp/webhook:
 *   post:
 *     summary: Receive incoming WhatsApp messages (playground/no webhookId)
 *     description: Alternative webhook endpoint for playground and direct API calls without webhookId in path
 *     tags: [WhatsApp]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               workspaceId:
 *                 type: string
 *               isPlayground:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Message received and processed
 *       400:
 *         description: Missing required fields
 */
router.post(
  "/webhook",
  // mTLS removed: Heroku does not pass through mTLS client certs.
  // Security is provided by HMAC signature (X-Hub-Signature-256) verified in the controller.
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
  "/send",
  authMiddleware,
  workspaceValidationMiddleware,
  whatsappRateLimitMiddleware,
  sendController.sendMessage.bind(sendController)
)

/**
 * @swagger
 * /api/whatsapp/ultramsg/{webhookId}:
 *   post:
 *     summary: UltraMsg webhook endpoint
 *     description: Receives messages from UltraMsg and processes them through the LLM router
 *     tags: [WhatsApp]
 *     security: []  # No JWT auth
 *     parameters:
 *       - in: path
 *         name: webhookId
 *         required: true
 *         schema:
 *           type: string
 *         description: The webhook ID (UUID) configured in UltraMsg
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               from:
 *                 type: string
 *                 description: Sender phone number
 *               to:
 *                 type: string
 *                 description: Receiver phone number
 *               body:
 *                 type: string
 *                 description: Message text
 *               type:
 *                 type: string
 *                 description: Message type (chat, image, etc.)
 *               id:
 *                 type: string
 *                 description: Message ID from UltraMsg
 *     responses:
 *       200:
 *         description: Message received and processed
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Workspace not found
 */
router.post(
  "/ultramsg/:webhookId",
  whatsappRateLimitMiddleware,
  ultraMsgWebhookController.handleWebhook.bind(ultraMsgWebhookController)
)

export default router
