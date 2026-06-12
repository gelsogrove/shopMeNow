/**
 * Widget Routes
 * Public API for web widget chat (unified with WhatsApp queue)
 * 
 * Security: Rate limited + 5-step validation (NO auth required)
 */

import { Router } from "express"
import { WidgetChatController } from "../controllers/widget-chat.controller"
import rateLimit from "express-rate-limit"
import logger from "../../../utils/logger"
import {
  uploadChatAudio,
  handleChatAudioUploadError,
} from "../middlewares/chatAudioUpload"
import {
  uploadChatAttachments,
  handleChatUploadError,
} from "../middlewares/chatAttachmentUpload"

const router = Router()
const controller = new WidgetChatController()

logger.info("🔧 Widget routes file loaded - defining routes...")

// Rate limiter: 20 requests per minute per IP
const widgetRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per window
  message: {
    error: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests. Please try again later.",
    retryAfter: 60000,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /api/v1/widget/register/:workspaceId
 * Register visitor and send first message (deduplicates by phone number)
 *
 * @swagger
 * /api/v1/widget/register/{workspaceId}:
 *   post:
 *     summary: Register visitor with first message
 *     tags: [Widget]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visitorId
 *               - name
 *               - phone
 *               - language
 *               - firstMessage
 *             properties:
 *               visitorId:
 *                 type: string
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               language:
 *                 type: string
 *               firstMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Registration successful with LLM response
 *       400:
 *         description: Invalid input
 *       403:
 *         description: Widget disabled
 *       503:
 *         description: Service unavailable
 */
router.post(
  "/register/:workspaceId",
  widgetRateLimiter,
  controller.registerAndStart.bind(controller)
)

logger.info("🔧 Widget POST /register/:workspaceId route registered")

/**
 * POST /api/v1/widget/chat/:workspaceId
 * Send a message from widget
 *
 * @swagger
 * /api/v1/widget/chat/{workspaceId}:
 *   post:
 *     summary: Send message from widget
 *     tags: [Widget]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - visitorId
 *               - message
 *             properties:
 *               visitorId:
 *                 type: string
 *                 example: visitor_1726262000000_a7k2m9x1
 *               message:
 *                 type: string
 *                 example: Ciao! Mi serve aiuto
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 example: optional-session-uuid
 *     responses:
 *       200:
 *         description: Message queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 messageId:
 *                   type: string
 *                 status:
 *                   type: string
 *                   enum: [pending]
 *                 retryAfter:
 *                   type: number
 *       400:
 *         description: Invalid input
 *       429:
 *         description: Rate limited
 *       503:
 *         description: Service unavailable
 */
router.post(
  "/chat/:workspaceId",
  widgetRateLimiter,
  controller.sendMessage.bind(controller)
)

logger.info("🔧 Widget POST /chat/:workspaceId route registered")

// 🎤 Voice note: transcribe (Whisper) → reuse the text chat turn.
router.post(
  "/chat-audio/:workspaceId",
  widgetRateLimiter,
  uploadChatAudio,
  handleChatAudioUploadError,
  controller.sendAudioMessage.bind(controller)
)

logger.info("🔧 Widget POST /chat-audio/:workspaceId route registered")

/**
 * @swagger
 * /api/v1/widget/chat-attachments/{workspaceId}:
 *   post:
 *     summary: Upload image/PDF attachments from the widget (visitor → operator)
 *     tags: [Widget]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - sessionId
 *               - files
 *             properties:
 *               sessionId:
 *                 type: string
 *                 format: uuid
 *                 description: Existing widget chat session (obtained after the first message)
 *               caption:
 *                 type: string
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Attachments stored and surfaced to the operator
 *       400:
 *         description: Missing sessionId / no files / invalid file type or size
 *       404:
 *         description: Chat session not found
 */
// 📎 Inbound attachments: visitor sends image/PDF from the widget composer.
router.post(
  "/chat-attachments/:workspaceId",
  widgetRateLimiter,
  uploadChatAttachments,
  handleChatUploadError,
  controller.uploadAttachments.bind(controller)
)

logger.info("🔧 Widget POST /chat-attachments/:workspaceId route registered")

/**
 * GET /api/v1/widget/status/:workspaceId
 * Get widget availability status
 */
router.get(
  "/status/:workspaceId",
  widgetRateLimiter,
  controller.getStatus.bind(controller)
)

/**
 * GET /api/v1/widget/poll/:messageId
 * Poll for message response
 * 
 * @swagger
 * /api/v1/widget/poll/{messageId}:
 *   get:
 *     summary: Poll for message response
 *     tags: [Widget]
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *       - in: header
 *         name: x-visitor-id
 *         required: true
 *         schema:
 *           type: string
 *         description: Visitor ID
 *       - in: header
 *         name: x-workspace-id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workspace ID
 *     responses:
 *       200:
 *         description: Polling response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [pending, ready, blocked, error]
 *                 message:
 *                   type: string
 *                   nullable: true
 *                 retryAfter:
 *                   type: number
 *                   nullable: true
 *                 isComplete:
 *                   type: boolean
 *       404:
 *         description: Message not found
 *       403:
 *         description: Access denied
 */
router.get(
  "/poll/:messageId",
  widgetRateLimiter,
  controller.pollMessage.bind(controller)
)

/**
 * GET /api/v1/widget/operator-messages
 * Poll for operator replies while activeChatbot=false
 * Query: visitorId, workspaceId, since (ISO)
 */
router.get(
  "/operator-messages",
  widgetRateLimiter,
  controller.getOperatorMessages.bind(controller)
)

/**
 * GET /api/v1/widget/profile/:workspaceId
 * Get customer profile for inline widget panel
 * Query: customerId (required)
 */
router.get(
  "/profile/:workspaceId",
  widgetRateLimiter,
  controller.getProfile.bind(controller)
)

/**
 * PATCH /api/v1/widget/profile/:workspaceId
 * Update customer profile from inline widget panel
 * Body: customerId (required) + fields to update
 */
router.patch(
  "/profile/:workspaceId",
  widgetRateLimiter,
  controller.updateProfile.bind(controller)
)

export default router
