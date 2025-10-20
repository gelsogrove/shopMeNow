import express from "express"
import { recentChatsRateLimiter } from "../../../middlewares/rateLimiter"
import logger from "../../../utils/logger"
import { ChatController } from "../controllers/chat.controller"
import { asyncHandler } from "../middlewares/async.middleware"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

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
    (req, res, next) => {
      const identifier = req.ip || req.socket.remoteAddress || "unknown"
      if (!recentChatsRateLimiter.isAllowed(identifier)) {
        const timeToReset = recentChatsRateLimiter.getTimeToReset(identifier)
        const currentCount = recentChatsRateLimiter.getCurrentCount(identifier)

        logger.info(
          `🚫 Rate limit exceeded for ${identifier}: ${currentCount} requests, reset in ${Math.ceil(timeToReset / 1000)}s`
        )

        return res.status(429).json({
          success: false,
          error: "Too many requests to /chat/recent",
          message: `Rate limit exceeded. Try again in ${Math.ceil(timeToReset / 1000)} seconds.`,
          retryAfter: Math.ceil(timeToReset / 1000),
        })
      }
      next()
    },
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
   *     summary: Get messages for a specific chat session
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
   *         description: List of chat messages
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
    asyncHandler(chatController.sendMessage.bind(chatController))
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

  /**
   * @swagger
   * /api/chat/test/{sessionId}:
   *   delete:
   *     summary: Test endpoint for deleting a chat session (no auth required)
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

  return router
}
