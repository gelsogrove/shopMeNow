"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const whatsapp_send_controller_1 = require("../controllers/whatsapp-send.controller");
const whatsapp_webhook_controller_1 = require("../controllers/whatsapp-webhook.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const whatsapp_rate_limit_middleware_1 = require("../middlewares/whatsapp-rate-limit.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
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
const router = (0, express_1.Router)();
// Initialize controllers
const webhookController = new whatsapp_webhook_controller_1.WhatsAppWebhookController();
const sendController = new whatsapp_send_controller_1.WhatsAppSendController();
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
router.get("/webhook", webhookController.verifyWebhook.bind(webhookController));
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
router.post("/webhook", whatsapp_rate_limit_middleware_1.whatsappRateLimitMiddleware, webhookController.receiveMessage.bind(webhookController));
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
router.post("/send", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, whatsapp_rate_limit_middleware_1.whatsappRateLimitMiddleware, sendController.sendMessage.bind(sendController));
exports.default = router;
//# sourceMappingURL=whatsapp.routes.js.map