/**
 * Support Chat Routes
 * Token-based (no login) operator handoff endpoints.
 *
 * All three endpoints are PUBLIC — authenticated only by the support_chat token.
 */

import { Router } from "express"
import { supportChatController } from "../controllers/support-chat.controller"
import rateLimit from "express-rate-limit"
import logger from "../../../utils/logger"

const router = Router()

// Rate limiter: 30 req/min (operator actions are sparse)
const supportChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "RATE_LIMIT_EXCEEDED", message: "Too many requests." },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * GET /api/v1/support-chat/session?token=xxx
 * Load customer info + chat history for operator
 */
router.get(
  "/session",
  supportChatLimiter,
  supportChatController.getSession.bind(supportChatController)
)

/**
 * POST /api/v1/support-chat/reply
 * Operator sends a message to customer (channel-aware)
 */
router.post(
  "/reply",
  supportChatLimiter,
  supportChatController.reply.bind(supportChatController)
)

/**
 * POST /api/v1/support-chat/done
 * Operator is done — re-enable chatbot
 */
router.post(
  "/done",
  supportChatLimiter,
  supportChatController.done.bind(supportChatController)
)

export const supportChatRoutes = router

logger.info("✅ Support-chat routes loaded (3 endpoints, token-auth)")
