/**
 * Agent Chat Routes
 *
 * Routes for multi-agent chat system
 * All routes require authentication (authMiddleware)
 *
 * Security: workspaceId is extracted from JWT token by authMiddleware
 * and validated in controller methods
 *
 * Base path: /api/v1/agent-chat
 */

import { Router } from "express"
import { AgentChatController } from "../controllers/AgentChatController"
import { authMiddleware } from "../middlewares/auth.middleware"

const router = Router()
const agentChatController = new AgentChatController()

// All chat routes require authentication
// Auth middleware adds workspaceId to req from JWT token
router.use(authMiddleware)

/**
 * POST /api/v1/agent-chat
 * Send a message and get AI response
 */
router.post("/", agentChatController.sendMessage.bind(agentChatController))

/**
 * GET /api/v1/agent-chat/history/:customerId
 * Get conversation history for a customer
 */
router.get(
  "/history/:customerId",
  agentChatController.getHistory.bind(agentChatController)
)

/**
 * GET /api/v1/agent-chat/metrics
 * Get agent performance metrics
 */
router.get("/metrics", agentChatController.getMetrics.bind(agentChatController))

/**
 * GET /api/v1/agent-chat/faq-categories
 * Get available FAQ categories
 */
router.get(
  "/faq-categories",
  agentChatController.getFAQCategories.bind(agentChatController)
)

/**
 * GET /api/v1/agent-chat/agents
 * Get active agents configuration
 */
router.get(
  "/agents",
  agentChatController.getActiveAgents.bind(agentChatController)
)

export default router
