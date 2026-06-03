import express from "express"
import { ChatController } from "../controllers/chat.controller"
import { asyncHandler } from "../middlewares/async.middleware"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import rateLimit from "express-rate-limit"
import {
  uploadChatAttachments,
  handleChatUploadError,
} from "../middlewares/chatAttachmentUpload"

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatSession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique ID of the chat session
 *         name:
 *           type: string
 *           description: Name of the chat session
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the last message
 *         unreadCount:
 *           type: integer
 *           description: Number of unread messages
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the chat session was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: When the chat session was last updated
 *
 *     ChatMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique ID of the message
 *         sessionId:
 *           type: string
 *           description: ID of the chat session this message belongs to
 *         content:
 *           type: string
 *           description: Content of the message
 *         sender:
 *           type: string
 *           description: Sender of the message (user or system)
 *         isRead:
 *           type: boolean
 *           description: Whether the message has been read
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: When the message was created
 */

export const chatRouter = (chatController: ChatController): express.Router => {
  const router = express.Router()

  // 🔒 SECURITY: Rate limiter for message sending (10 msg/min per operator)
  const sendMessageLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Max 10 messages per minute
    message: {
      success: false,
      error: "Too many messages sent. Please wait before sending more.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  })

  // 🔒 SECURITY: Debug endpoint only in development
  if (process.env.NODE_ENV !== "production") {
    /**
     * @swagger
     * /api/chat/debug/{sessionId}:
     *   get:
     *     summary: Debug endpoint to get chat session details without auth (DEVELOPMENT ONLY)
     *     tags: [Chat]
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the chat session
     *     responses:
     *       200:
     *         description: Chat session details
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/ChatSession'
     *       500:
     *         description: Server error
     */
    router.get(
      "/debug/:sessionId",
      asyncHandler(chatController.getChatSession.bind(chatController))
    )
  }

  // Apply auth middleware to all remaining chat routes
  router.use(authMiddleware)

  // Apply workspace validation middleware to all routes
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/chat/recent:
   *   get:
   *     summary: Get all recent chats with unread counts
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *         description: Maximum number of chats to return (default 20)
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of recent chat sessions with unread counts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ChatSession'
   *       500:
   *         description: Server error
   */
  router.get(
    "/recent",
    // TEMPORARILY DISABLED: Rate limiter causing issues with Vite proxy
    // (req, res, next) => {
    //   const identifier = req.ip || req.socket.remoteAddress || "unknown"
    //   if (!recentChatsRateLimiter.isAllowed(identifier)) {
    //     const timeToReset = recentChatsRateLimiter.getTimeToReset(identifier)
    //     const currentCount = recentChatsRateLimiter.getCurrentCount(identifier)

    //     logger.info(
    //       `🚫 Rate limit exceeded for ${identifier}: ${currentCount} requests, reset in ${Math.ceil(timeToReset / 1000)}s`
    //     )

    //     return res.status(429).json({
    //       success: false,
    //       error: "Too many requests to /chat/recent",
    //       message: `Rate limit exceeded. Try again in ${Math.ceil(timeToReset / 1000)} seconds.`,
    //       retryAfter: Math.ceil(timeToReset / 1000),
    //     })
    //   }
    //   next()
    // },
    asyncHandler(chatController.getRecentChats.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/{sessionId}:
   *   get:
   *     summary: Get details for a specific chat session
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the chat session
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: Chat session details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   $ref: '#/components/schemas/ChatSession'
   *       400:
   *         description: Session ID is required
   *       500:
   *         description: Server error
   */
  router.get(
    "/:sessionId",
    asyncHandler(chatController.getChatSession.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/{sessionId}/messages:
   *   get:
   *     summary: Get messages for a specific chat session (with pagination)
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the chat session
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Page number for pagination (1-based)
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 40
   *           minimum: 1
   *           maximum: 100
   *         description: Number of messages per page (max 100)
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: Paginated list of chat messages
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/ChatMessage'
   *                 hasMore:
   *                   type: boolean
   *                   description: Whether there are more messages to load
   *                 total:
   *                   type: integer
   *                   description: Total number of messages in the chat
   *                 page:
   *                   type: integer
   *                   description: Current page number
   *                 limit:
   *                   type: integer
   *                   description: Messages per page
   *       400:
   *         description: Session ID is required
   *       500:
   *         description: Server error
   */
  router.get(
    "/:sessionId/messages",
    asyncHandler(chatController.getChatMessages.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/{sessionId}/mark-read:
   *   post:
   *     summary: Mark messages in a chat session as read
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the chat session
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: Messages marked as read
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     count:
   *                       type: integer
   *                       description: Number of messages marked as read
   *       400:
   *         description: Session ID is required
   *       500:
   *         description: Server error
   */
  router.post(
    "/:sessionId/mark-read",
    asyncHandler(chatController.markAsRead.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/{sessionId}/send:
   *   post:
   *     summary: Send a message in a chat session (manual operator mode)
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the chat session
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - content
   *               - sender
   *             properties:
   *               content:
   *                 type: string
   *                 description: Content of the message
   *               sender:
   *                 type: string
   *                 description: Sender of the message (should be "user" for operator)
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
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       description: Message ID
   *                     content:
   *                       type: string
   *                       description: Message content
   *                     sender:
   *                       type: string
   *                       description: Message sender
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                       description: Message timestamp
   *                     direction:
   *                       type: string
   *                       description: Message direction (OUTBOUND)
   *                     metadata:
   *                       type: object
   *                       description: Message metadata
   *       400:
   *         description: Invalid request or chatbot is active
   *       404:
   *         description: Chat session not found
   *       500:
   *         description: Server error
   */
  router.post(
    "/:sessionId/send",
    sendMessageLimiter, // 🔒 Rate limiting: max 10 msg/min
    asyncHandler(chatController.sendMessage.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/{sessionId}/messages/{messageId}/react:
   *   post:
   *     summary: Operator reacts to a customer message with an emoji (WhatsApp reaction)
   *     tags: [Chat]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema: { type: string }
   *       - in: path
   *         name: messageId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               emoji: { type: string, example: "👍", description: "Reaction emoji; empty string removes it" }
   *     responses:
   *       200: { description: Reaction sent }
   *       400: { description: Invalid request or message has no WhatsApp id }
   *       403: { description: Access denied to this workspace }
   *       404: { description: Chat session or message not found }
   *       422: { description: Active provider does not support reactions }
   *       502: { description: Provider failed to deliver the reaction }
   */
  router.post(
    "/:sessionId/messages/:messageId/react",
    sendMessageLimiter, // 🔒 reuse the send rate limit
    asyncHandler(chatController.reactToMessage.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/{sessionId}/attachments:
   *   post:
   *     summary: Upload one or more attachments (image/PDF) to a chat and send them
   *     tags: [Chat]
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         required: true
   *         schema: { type: string }
   *     requestBody:
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               files:
   *                 type: array
   *                 items: { type: string, format: binary }
   *               caption: { type: string }
   *     responses:
   *       200: { description: Attachments stored (and sent on the whatsapp channel) }
   *       400: { description: Invalid file type/size or too many files }
   *       404: { description: Chat session not found }
   */
  router.post(
    "/:sessionId/attachments",
    sendMessageLimiter, // 🔒 reuse the send rate limit
    uploadChatAttachments,
    handleChatUploadError,
    asyncHandler(chatController.uploadAttachments.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/translate-message:
   *   post:
   *     summary: Translate a single message into the logged-in user's preferred language
   *     description: |
   *       Lazy translation for the message tooltip in the operator chat UI.
   *       The operator hovers a customer/bot message, the UI calls this
   *       endpoint, the translated text is rendered inline and cached
   *       client-side (no need to retranslate on subsequent hovers).
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [content]
   *             properties:
   *               content: { type: string, description: "Raw message content" }
   *               sourceLanguage: { type: string, description: "ISO 2-letter source language (optional — auto-detected when missing)" }
   *     responses:
   *       200:
   *         description: Translated text
   */
  router.post(
    "/translate-message",
    asyncHandler(chatController.translateMessage.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/translate-messages:
   *   post:
   *     summary: Translate a batch of chat messages into a target language
   *     description: |
   *       Used by the global "Translate to" dropdown in the operator chat
   *       UI. The whole timeline is sent in one POST and the translations
   *       are returned together, so the UI can render them in one pass
   *       instead of fan-out per message.
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [messages]
   *             properties:
   *               messages:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     id: { type: string }
   *                     content: { type: string }
   *               targetLanguage: { type: string, description: "ISO 2-letter code (defaults to logged-in user's preferred language)" }
   *     responses:
   *       200:
   *         description: Translations
   */
  router.post(
    "/translate-messages",
    asyncHandler(chatController.translateMessages.bind(chatController))
  )

  /**
   * @swagger
   * /api/chat/{sessionId}:
   *   delete:
   *     summary: Delete a chat session and all its messages
   *     tags: [Chat]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: sessionId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the chat session
   *       - in: header
   *         name: x-workspace-id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: Chat session deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                   description: Success message
   *       400:
   *         description: Session ID is required
   *       500:
   *         description: Server error
   */
  router.delete(
    "/:sessionId",
    asyncHandler(chatController.deleteChat.bind(chatController))
  )

  // 🔒 SECURITY: Test endpoint only in development (TASK07)
  if (process.env.NODE_ENV !== "production") {
    /**
     * @swagger
     * /api/chat/test/{sessionId}:
     *   delete:
     *     summary: Test endpoint for deleting a chat session (DEVELOPMENT ONLY)
     *     tags: [Chat]
     *     parameters:
     *       - in: path
     *         name: sessionId
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the chat session
     *     responses:
     *       200:
     *         description: Chat session deleted successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 data:
     *                   type: object
     *                   properties:
     *                     deleted:
     *                       type: boolean
     *       400:
     *         description: Session ID is required
     *       500:
     *         description: Server error
     */
    router.delete(
      "/test/:sessionId",
      asyncHandler(chatController.deleteChat.bind(chatController))
    )
  }

  return router
}
