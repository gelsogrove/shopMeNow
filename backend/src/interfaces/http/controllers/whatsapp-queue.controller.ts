// External dependencies
import { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"

// Services
import { WhatsAppQueueService } from "../../../services/whatsapp-queue.service"

// Internal core
import logger from "../../../utils/logger"

/**
 * @swagger
 * tags:
 *   name: WhatsApp Queue
 *   description: WhatsApp message queue management
 */

export class WhatsAppQueueController {
  private service: WhatsAppQueueService

  constructor(private prisma: PrismaClient) {
    this.service = new WhatsAppQueueService(prisma)
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue:
   *   get:
   *     summary: Get WhatsApp queue messages
   *     tags: [WhatsApp Queue]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: Workspace ID
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [pending, sent, error]
   *         description: Filter by status
   *     responses:
   *       200:
   *         description: Queue messages retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Invalid workspace
   */
  async getQueueMessages(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId // Set by validateWorkspaceOperation middleware
      const { status } = req.query

      const messages = await this.service.getQueueStatus(
        workspaceId,
        status as string | undefined
      )

      return res.json(messages)
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in getQueueMessages:", error)
      return res.status(500).json({
        error: "Failed to get queue messages",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue/{id}:
   *   get:
   *     summary: Get single queue message
   *     tags: [WhatsApp Queue]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Message retrieved successfully
   *       404:
   *         description: Message not found
   *       401:
   *         description: Unauthorized
   */
  async getQueueMessage(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      const { id } = req.params

      const repository = this.service["repository"] // Access private repository
      const message = await repository.findById(id, workspaceId)

      if (!message) {
        return res.status(404).json({ error: "Message not found" })
      }

      return res.json(message)
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in getQueueMessage:", error)
      return res.status(500).json({
        error: "Failed to get message",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue/statistics:
   *   get:
   *     summary: Get queue statistics
   *     tags: [WhatsApp Queue]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 pending:
   *                   type: number
   *                 sent:
   *                   type: number
   *                 error:
   *                   type: number
   *                 total:
   *                   type: number
   */
  async getStatistics(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId

      const stats = await this.service.getStatistics(workspaceId)

      return res.json(stats)
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in getStatistics:", error)
      return res.status(500).json({
        error: "Failed to get statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
