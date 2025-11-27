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

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue/{id}:
   *   delete:
   *     summary: Delete a single message from queue
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
   *         description: Message ID to delete
   *     responses:
   *       200:
   *         description: Message deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *       404:
   *         description: Message not found
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Invalid workspace
   */
  async deleteQueueMessage(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      const { id } = req.params

      logger.info(
        `[WhatsAppQueueController] Deleting message ${id} from workspace ${workspaceId}`
      )

      const deleted = await this.service.deleteMessage(id, workspaceId)

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Message not found",
        })
      }

      return res.json({
        success: true,
        message: "Message deleted successfully",
      })
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in deleteQueueMessage:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to delete message",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue:
   *   delete:
   *     summary: Clear entire queue (delete all messages)
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
   *         description: Queue cleared successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 deletedCount:
   *                   type: number
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Invalid workspace
   */
  async clearQueue(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId

      logger.warn(
        `[WhatsAppQueueController] User requesting to clear entire queue for workspace: ${workspaceId}`
      )

      const deletedCount = await this.service.clearQueue(workspaceId)

      return res.json({
        success: true,
        deletedCount,
        message: `Deleted ${deletedCount} messages from queue`,
      })
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in clearQueue:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to clear queue",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue/status:
   *   get:
   *     summary: Get queue enabled/disabled status and debug mode
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
   *         description: Queue status retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 enabled:
   *                   type: boolean
   *                 debugMode:
   *                   type: boolean
   *                   description: When true, messages stay pending and are not sent
   */
  async getQueueStatus(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId

      logger.info(
        `[WhatsAppQueueController] Getting queue status for workspace: ${workspaceId}`
      )

      const result = await this.service.getQueueEnabledStatus(workspaceId)

      return res.json({
        success: true,
        ...result,
      })
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in getQueueStatus:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to get queue status",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue/status:
   *   put:
   *     summary: Enable or disable the queue
   *     tags: [WhatsApp Queue]
   *     security:
   *       - bearerAuth: []
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
   *             properties:
   *               enabled:
   *                 type: boolean
   *             required:
   *               - enabled
   *     responses:
   *       200:
   *         description: Queue status updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 enabled:
   *                   type: boolean
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Invalid workspace
   */
  async updateQueueStatus(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      const { enabled } = req.body

      console.log(`🔍 [updateQueueStatus] workspaceId: ${workspaceId}, enabled: ${enabled}`)

      if (typeof enabled !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Invalid request",
          message: "enabled must be a boolean",
        })
      }

      logger.info(
        `[WhatsAppQueueController] Updating queue status for workspace ${workspaceId}: ${
          enabled ? "ENABLED" : "DISABLED"
        }`
      )

      const result = await this.service.updateQueueStatus(workspaceId, enabled)

      return res.json({
        success: true,
        ...result,
      })
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in updateQueueStatus:", error)
      console.error(`🔴 [updateQueueStatus] Error details:`, error)
      return res.status(500).json({
        success: false,
        error: "Failed to update queue status",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/whatsapp-queue/debug-mode:
   *   put:
   *     summary: Enable or disable debug mode
   *     description: When debug mode is enabled, messages will NOT be sent and stay in "pending" status. Useful for testing without actually sending WhatsApp messages.
   *     tags: [WhatsApp Queue]
   *     security:
   *       - bearerAuth: []
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
   *               - debugMode
   *             properties:
   *               debugMode:
   *                 type: boolean
   *                 description: When true, messages stay pending and are not sent
   *     responses:
   *       200:
   *         description: Debug mode updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 debugMode:
   *                   type: boolean
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Forbidden - Invalid workspace
   */
  async updateDebugMode(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = (req as any).workspaceId
      const { debugMode } = req.body

      console.log(`🔍 [updateDebugMode] workspaceId: ${workspaceId}, debugMode: ${debugMode}`)

      if (typeof debugMode !== "boolean") {
        return res.status(400).json({
          success: false,
          error: "Invalid request",
          message: "debugMode must be a boolean",
        })
      }

      logger.info(
        `[WhatsAppQueueController] Updating debug mode for workspace ${workspaceId}: ${
          debugMode ? "ENABLED" : "DISABLED"
        }`
      )

      const result = await this.service.updateDebugMode(workspaceId, debugMode)

      return res.json({
        success: true,
        ...result,
      })
    } catch (error) {
      logger.error("[WhatsAppQueueController] Error in updateDebugMode:", error)
      console.error(`🔴 [updateDebugMode] Error details:`, error)
      return res.status(500).json({
        success: false,
        error: "Failed to update debug mode",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
