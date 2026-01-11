import { Router } from "express"
import { WidgetController } from "../controllers/widget.controller"
import { widgetChatLimiter, widgetConversionLimiter } from "../../../config/rate-limiters"
import logger from "../../../utils/logger"

export function createWidgetRouter(widgetController: WidgetController) {
  const router = Router()

  logger.info("🔌 Setting up PUBLIC widget routes (no authentication required)")

/**
 * @swagger
 * /api/v1/widget/message:
 *   post:
 *     summary: Send message from widget (PUBLIC - no auth)
 *     description: |
 *       Handles chat messages from embedded widget on external websites.
 *       Creates/finds customer by visitorId, routes message to LLM system.
 *       PUBLIC endpoint - rate limited to 50 messages/hour per IP.
 *     tags: [Widget]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - visitorId
 *               - message
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID (from widget embed code)
 *               visitorId:
 *                 type: string
 *                 description: Anonymous visitor ID from localStorage (e.g., "webvisitor-abc123")
 *               message:
 *                 type: string
 *                 description: User message text
 *               language:
 *                 type: string
 *                 enum: [it, en, es, pt, de, fr]
 *                 default: en
 *                 description: User interface language
 *     responses:
 *       200:
 *         description: Message sent successfully, LLM response returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 response:
 *                   type: string
 *                   description: LLM assistant response
 *                 customerId:
 *                   type: string
 *                   description: Customer ID created/found
 *       429:
 *         description: Rate limit exceeded (50 msg/hour per IP)
 *       400:
 *         description: Invalid request body
 *       500:
 *         description: Server error
 */
router.post(
  "/message",
  widgetChatLimiter, // 50 requests per hour
  widgetController.sendMessage.bind(widgetController)
)

/**
 * @swagger
 * /api/v1/widget/convert-visitor:
 *   post:
 *     summary: Convert anonymous visitor to registered customer (PUBLIC - no auth)
 *     description: |
 *       Converts webvisitor to real customer during registration.
 *       Merges visitor data with registration data, preserves chat history.
 *     tags: [Widget]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - visitorId
 *               - phone
 *               - firstName
 *               - lastName
 *               - email
 *             properties:
 *               workspaceId:
 *                 type: string
 *               visitorId:
 *                 type: string
 *               phone:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               language:
 *                 type: string
 *     responses:
 *       200:
 *         description: Visitor converted successfully
 *       400:
 *         description: Invalid data or visitor not found
 *       500:
 *         description: Server error
 */
router.post(
  "/convert-visitor",
  widgetConversionLimiter, // 10 requests per hour
  widgetController.convertVisitor.bind(widgetController)
)

  return router
}
