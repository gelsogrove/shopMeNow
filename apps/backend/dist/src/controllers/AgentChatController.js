"use strict";
/**
 * AgentChatController
 *
 * Handles customer chat messages through the multi-agent system.
 * This is the MAIN ENTRY POINT for all customer interactions via WhatsApp/API.
 *
 * Endpoints:
 * - POST /api/v1/agent-chat - Send message and get response
 * - GET /api/v1/agent-chat/history/:customerId - Get conversation history
 * - GET /api/v1/agent-chat/metrics - Get agent performance metrics
 *
 * Flow:
 * 1. Validate request (workspace, customer, message)
 * 2. Call LLMRouterService.routeMessage()
 * 3. Return response with agent info
 * All logging handled automatically by service layer
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentChatController = void 0;
const database_1 = require("@echatbot/database");
const uuid_1 = require("uuid");
const agent_logger_service_1 = require("../services/agent-logger.service");
const llm_router_service_1 = require("../services/llm-router.service");
const logger_1 = __importDefault(require("../utils/logger"));
class AgentChatController {
    constructor() {
        this.prisma = database_1.prisma;
        this.routerService = new llm_router_service_1.LLMRouterService(this.prisma);
        this.loggerService = new agent_logger_service_1.AgentLoggerService(this.prisma);
    }
    /**
     * POST /api/v1/agent-chat
     *
     * Send a message and get AI response
     *
     * @swagger
     * /api/v1/agent-chat:
     *   post:
     *     summary: Send chat message
     *     tags: [Chat]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - message
     *               - customerId
     *             properties:
     *               message:
     *                 type: string
     *                 description: Customer message
     *                 example: "cerco formaggi italiani"
     *               customerId:
     *                 type: string
     *                 description: Customer ID (from Customers table)
     *                 example: "customer-uuid"
     *               conversationId:
     *                 type: string
     *                 description: Conversation ID (optional, auto-generated if missing)
     *                 example: "conv-uuid"
     *               customerLanguage:
     *                 type: string
     *                 description: Customer language code
     *                 example: "it"
     *                 enum: [it, es, en, pt]
     *               customerName:
     *                 type: string
     *                 description: Customer name for personalization
     *                 example: "Mario"
     *     responses:
     *       200:
     *         description: AI response
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
     *                     response:
     *                       type: string
     *                       description: AI response message
     *                     agentUsed:
     *                       type: string
     *                       description: Which agent handled the request
     *                     confidence:
     *                       type: number
     *                       description: Confidence score (0-1)
     *                     wasFAQ:
     *                       type: boolean
     *                       description: Was this answered by FAQ (no LLM)?
     *                     tokensUsed:
     *                       type: number
     *                       description: LLM tokens consumed
     *                     executionTimeMs:
     *                       type: number
     *                       description: Processing time in milliseconds
     *                     conversationId:
     *                       type: string
     *                       description: Conversation ID for tracking
     *                     messageId:
     *                       type: string
     *                       description: Message ID for tracking
     *       400:
     *         description: Invalid request
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    sendMessage(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get workspace from middleware
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    return res.status(401).json({
                        success: false,
                        error: "Workspace ID required (authentication failed)",
                    });
                }
                // Validate request body
                const { message, customerId, conversationId, customerLanguage, customerName, } = req.body;
                if (!message || typeof message !== "string") {
                    return res.status(400).json({
                        success: false,
                        error: "Message is required and must be a string",
                    });
                }
                if (!customerId) {
                    return res.status(400).json({
                        success: false,
                        error: "Customer ID is required",
                    });
                }
                // Generate IDs if not provided
                const finalConversationId = conversationId || `conv-${(0, uuid_1.v4)()}`;
                const messageId = `msg-${(0, uuid_1.v4)()}`;
                logger_1.default.info(`Chat message received from customer ${customerId} in workspace ${workspaceId}`);
                // Route through multi-agent system
                const result = yield this.routerService.routeMessage({
                    workspaceId,
                    customerId,
                    conversationId: finalConversationId,
                    messageId,
                    message,
                    customerLanguage: customerLanguage || "it",
                    customerName,
                });
                logger_1.default.info(`Chat response generated: agent=${result.agentUsed}, tokens=${result.tokensUsed}, time=${result.executionTimeMs}ms`);
                // Return response
                return res.status(200).json({
                    success: true,
                    data: {
                        response: result.response,
                        agentUsed: result.agentUsed,
                        confidence: result.confidence,
                        wasFAQ: result.wasFAQ,
                        tokensUsed: result.tokensUsed,
                        executionTimeMs: result.executionTimeMs,
                        conversationId: finalConversationId,
                        messageId,
                        debugInfo: result.debugInfo, // ✅ Include debug information for frontend
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error in sendMessage:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to process message",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
    /**
     * GET /api/v1/chat/history/:customerId
     *
     * Get conversation history for a customer
     *
     * @swagger
     * /api/v1/chat/history/{customerId}:
     *   get:
     *     summary: Get customer conversation history
     *     tags: [Chat]
     *     parameters:
     *       - in: path
     *         name: customerId
     *         required: true
     *         schema:
     *           type: string
     *         description: Customer ID
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 50
     *         description: Max number of messages to return
     *     responses:
     *       200:
     *         description: Conversation history
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    getHistory(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    return res.status(401).json({
                        success: false,
                        error: "Workspace ID required",
                    });
                }
                const { customerId } = req.params;
                const limit = parseInt(req.query.limit) || 50;
                if (!customerId) {
                    return res.status(400).json({
                        success: false,
                        error: "Customer ID is required",
                    });
                }
                // Get conversation history
                const history = yield this.loggerService.getCustomerInteractionHistory(workspaceId, customerId, limit);
                return res.status(200).json({
                    success: true,
                    data: history,
                });
            }
            catch (error) {
                logger_1.default.error("Error in getHistory:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to get conversation history",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
    /**
     * GET /api/v1/chat/metrics
     *
     * Get agent performance metrics
     *
     * @swagger
     * /api/v1/chat/metrics:
     *   get:
     *     summary: Get agent performance metrics
     *     tags: [Chat]
     *     parameters:
     *       - in: query
     *         name: days
     *         schema:
     *           type: integer
     *           default: 7
     *         description: Number of days to analyze
     *     responses:
     *       200:
     *         description: Performance metrics
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    getMetrics(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    return res.status(401).json({
                        success: false,
                        error: "Workspace ID required",
                    });
                }
                const days = parseInt(req.query.days) || 7;
                const since = new Date();
                since.setDate(since.getDate() - days);
                // Get performance metrics
                const metrics = yield this.loggerService.getAgentPerformanceMetrics(workspaceId, since);
                // Get real-time stats
                const realtimeStats = yield this.loggerService.getRealtimeStats(workspaceId);
                return res.status(200).json({
                    success: true,
                    data: {
                        period: `Last ${days} days`,
                        metrics,
                        realtime: realtimeStats,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error in getMetrics:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to get metrics",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
    /**
     * GET /api/v1/chat/faq-categories
     *
     * Get available FAQ categories
     *
     * @swagger
     * /api/v1/chat/faq-categories:
     *   get:
     *     summary: Get FAQ categories
     *     tags: [Chat]
     *     responses:
     *       200:
     *         description: FAQ categories list
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    getFAQCategories(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    return res.status(401).json({
                        success: false,
                        error: "Workspace ID required",
                    });
                }
                // Get FAQ categories from repository directly
                const faqRepo = new (yield Promise.resolve().then(() => __importStar(require("../repositories/faq.repository")))).FAQRepository(this.routerService["prisma"]);
                const allFaqs = yield faqRepo.findAll(workspaceId);
                // Extract unique categories
                const categories = [
                    ...new Set(allFaqs.map((faq) => faq.category).filter(Boolean)),
                ];
                return res.status(200).json({
                    success: true,
                    data: categories,
                });
            }
            catch (error) {
                logger_1.default.error("Error in getFAQCategories:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to get FAQ categories",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
    /**
     * GET /api/v1/chat/agents
     *
     * Get active agents configuration
     *
     * @swagger
     * /api/v1/chat/agents:
     *   get:
     *     summary: Get active agents
     *     tags: [Chat]
     *     responses:
     *       200:
     *         description: Active agents list
     *       401:
     *         description: Unauthorized
     *       500:
     *         description: Server error
     */
    getActiveAgents(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    return res.status(401).json({
                        success: false,
                        error: "Workspace ID required",
                    });
                }
                // Get active agents from repository directly
                const agentRepo = new (yield Promise.resolve().then(() => __importStar(require("../repositories/agent-config.repository")))).AgentConfigRepository(this.routerService["prisma"]);
                const agents = yield agentRepo.findActiveAgents(workspaceId);
                return res.status(200).json({
                    success: true,
                    data: agents,
                });
            }
            catch (error) {
                logger_1.default.error("Error in getActiveAgents:", error);
                return res.status(500).json({
                    success: false,
                    error: "Failed to get active agents",
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        });
    }
}
exports.AgentChatController = AgentChatController;
//# sourceMappingURL=AgentChatController.js.map