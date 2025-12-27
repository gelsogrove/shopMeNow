"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AgentChatController_1 = require("../controllers/AgentChatController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
const agentChatController = new AgentChatController_1.AgentChatController();
// All chat routes require authentication
// Auth middleware adds workspaceId to req from JWT token
router.use(auth_middleware_1.authMiddleware);
/**
 * POST /api/v1/agent-chat
 * Send a message and get AI response
 */
router.post("/", agentChatController.sendMessage.bind(agentChatController));
/**
 * GET /api/v1/agent-chat/history/:customerId
 * Get conversation history for a customer
 */
router.get("/history/:customerId", agentChatController.getHistory.bind(agentChatController));
/**
 * GET /api/v1/agent-chat/metrics
 * Get agent performance metrics
 */
router.get("/metrics", agentChatController.getMetrics.bind(agentChatController));
/**
 * GET /api/v1/agent-chat/faq-categories
 * Get available FAQ categories
 */
router.get("/faq-categories", agentChatController.getFAQCategories.bind(agentChatController));
/**
 * GET /api/v1/agent-chat/agents
 * Get active agents configuration
 */
router.get("/agents", agentChatController.getActiveAgents.bind(agentChatController));
exports.default = router;
//# sourceMappingURL=agentChatRoutes.js.map