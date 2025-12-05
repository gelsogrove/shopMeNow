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

import { PrismaClient } from "@echatbot/database"
import { Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"
import { AgentLoggerService } from "../services/agent-logger.service"
import { LLMRouterService } from "../services/llm-router.service"
import logger from "../utils/logger"

export class AgentChatController {
  private prisma: PrismaClient
  private routerService: LLMRouterService
  private loggerService: AgentLoggerService

  constructor() {
    this.prisma = new PrismaClient()
    this.routerService = new LLMRouterService(this.prisma)
    this.loggerService = new AgentLoggerService(this.prisma)
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
  async sendMessage(req: Request, res: Response): Promise<Response> {
    try {
      // Get workspace from middleware
      const workspaceId = (req as any).workspaceId
      if (!workspaceId) {
        return res.status(401).json({
          success: false,
          error: "Workspace ID required (authentication failed)",
        })
      }

      // Validate request body
      const {
        message,
        customerId,
        conversationId,
        customerLanguage,
        customerName,
      } = req.body

      if (!message || typeof message !== "string") {
        return res.status(400).json({
          success: false,
          error: "Message is required and must be a string",
        })
      }

      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: "Customer ID is required",
        })
      }

      // Generate IDs if not provided
      const finalConversationId = conversationId || `conv-${uuidv4()}`
      const messageId = `msg-${uuidv4()}`

      logger.info(
        `Chat message received from customer ${customerId} in workspace ${workspaceId}`
      )

      // Route through multi-agent system
      const result = await this.routerService.routeMessage({
        workspaceId,
        customerId,
        conversationId: finalConversationId,
        messageId,
        message,
        customerLanguage: customerLanguage || "it",
        customerName,
      })

      logger.info(
        `Chat response generated: agent=${result.agentUsed}, tokens=${result.tokensUsed}, time=${result.executionTimeMs}ms`
      )

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
      })
    } catch (error) {
      logger.error("Error in sendMessage:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to process message",
        message: error instanceof Error ? error.message : String(error),
      })
    }
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
  async getHistory(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      if (!workspaceId) {
        return res.status(401).json({
          success: false,
          error: "Workspace ID required",
        })
      }

      const { customerId } = req.params
      const limit = parseInt(req.query.limit as string) || 50

      if (!customerId) {
        return res.status(400).json({
          success: false,
          error: "Customer ID is required",
        })
      }

      // Get conversation history
      const history = await this.loggerService.getCustomerInteractionHistory(
        workspaceId,
        customerId,
        limit
      )

      return res.status(200).json({
        success: true,
        data: history,
      })
    } catch (error) {
      logger.error("Error in getHistory:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to get conversation history",
        message: error instanceof Error ? error.message : String(error),
      })
    }
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
  async getMetrics(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      if (!workspaceId) {
        return res.status(401).json({
          success: false,
          error: "Workspace ID required",
        })
      }

      const days = parseInt(req.query.days as string) || 7
      const since = new Date()
      since.setDate(since.getDate() - days)

      // Get performance metrics
      const metrics = await this.loggerService.getAgentPerformanceMetrics(
        workspaceId,
        since
      )

      // Get real-time stats
      const realtimeStats =
        await this.loggerService.getRealtimeStats(workspaceId)

      return res.status(200).json({
        success: true,
        data: {
          period: `Last ${days} days`,
          metrics,
          realtime: realtimeStats,
        },
      })
    } catch (error) {
      logger.error("Error in getMetrics:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to get metrics",
        message: error instanceof Error ? error.message : String(error),
      })
    }
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
  async getFAQCategories(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      if (!workspaceId) {
        return res.status(401).json({
          success: false,
          error: "Workspace ID required",
        })
      }

      // Get FAQ categories from repository directly
      const faqRepo = new (
        await import("../repositories/faq.repository")
      ).FAQRepository(this.routerService["prisma"])
      const allFaqs = await faqRepo.findAll(workspaceId)

      // Extract unique categories
      const categories = [
        ...new Set(allFaqs.map((faq) => faq.category).filter(Boolean)),
      ]

      return res.status(200).json({
        success: true,
        data: categories,
      })
    } catch (error) {
      logger.error("Error in getFAQCategories:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to get FAQ categories",
        message: error instanceof Error ? error.message : String(error),
      })
    }
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
  async getActiveAgents(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      if (!workspaceId) {
        return res.status(401).json({
          success: false,
          error: "Workspace ID required",
        })
      }

      // Get active agents from repository directly
      const agentRepo = new (
        await import("../repositories/agent-config.repository")
      ).AgentConfigRepository(this.routerService["prisma"])
      const agents = await agentRepo.findActiveAgents(workspaceId)

      return res.status(200).json({
        success: true,
        data: agents,
      })
    } catch (error) {
      logger.error("Error in getActiveAgents:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to get active agents",
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
