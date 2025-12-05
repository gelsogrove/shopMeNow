import { Request, Response } from "express"
import { PrismaClient } from "@echatbot/database"
import { TransportTypeService } from "../../../services/transport-type.service"
import logger from "../../../utils/logger"

export class TransportTypeController {
  private transportTypeService: TransportTypeService

  constructor(private prisma: PrismaClient) {
    this.transportTypeService = new TransportTypeService(prisma)
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types:
   *   get:
   *     summary: Get all transport types for workspace
   *     tags: [TransportTypes]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of transport types
   */
  async getAll(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId

      const transportTypes =
        await this.transportTypeService.getAllWithCounts(workspaceId)

      return res.json(transportTypes)
    } catch (error) {
      logger.error("Error getting transport types:", error)
      return res.status(500).json({
        error: "Failed to get transport types",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types/{id}:
   *   get:
   *     summary: Get transport type by ID
   *     tags: [TransportTypes]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: Transport type details
   *       404:
   *         description: Transport type not found
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      const transportType = await this.transportTypeService.getById(
        id,
        workspaceId
      )

      if (!transportType) {
        return res.status(404).json({ error: "Transport type not found" })
      }

      return res.json(transportType)
    } catch (error) {
      logger.error("Error getting transport type:", error)
      return res.status(500).json({
        error: "Failed to get transport type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types:
   *   post:
   *     summary: Create new transport type
   *     tags: [TransportTypes]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *                 example: "Air"
   *     responses:
   *       201:
   *         description: Transport type created
   *       400:
   *         description: Validation error
   */
  async create(req: Request, res: Response) {
    try {
      const { name } = req.body
      const workspaceId = (req as any).workspaceId

      if (!name) {
        return res.status(400).json({ error: "Transport type name is required" })
      }

      const transportType = await this.transportTypeService.create(
        workspaceId,
        name
      )

      logger.info(`Transport type created: ${transportType.id} (${name})`)
      return res.status(201).json(transportType)
    } catch (error) {
      logger.error("Error creating transport type:", error)

      if (
        error instanceof Error &&
        error.message === "Transport type already exists"
      ) {
        return res.status(400).json({ error: error.message })
      }

      if (
        error instanceof Error &&
        error.message.includes("Transport type name")
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({
        error: "Failed to create transport type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types/{id}:
   *   put:
   *     summary: Update transport type
   *     tags: [TransportTypes]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *       - in: path
   *         name: id
   *         required: true
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *     responses:
   *       200:
   *         description: Transport type updated
   *       404:
   *         description: Transport type not found
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name } = req.body
      const workspaceId = (req as any).workspaceId

      if (!name) {
        return res.status(400).json({ error: "Transport type name is required" })
      }

      const transportType = await this.transportTypeService.update(
        id,
        workspaceId,
        name
      )

      logger.info(`Transport type updated: ${id} (${name})`)
      return res.json(transportType)
    } catch (error) {
      logger.error("Error updating transport type:", error)

      if (
        error instanceof Error &&
        error.message === "Transport type not found"
      ) {
        return res.status(404).json({ error: error.message })
      }

      if (
        error instanceof Error &&
        (error.message === "Transport type name already exists" ||
          error.message.includes("Transport type name"))
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({
        error: "Failed to update transport type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types/{id}:
   *   delete:
   *     summary: Delete transport type
   *     tags: [TransportTypes]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: Transport type deleted
   *       400:
   *         description: Cannot delete - used by products
   *       404:
   *         description: Transport type not found
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      await this.transportTypeService.delete(id, workspaceId)

      logger.info(`Transport type deleted: ${id}`)
      return res.json({ message: "Transport type deleted successfully" })
    } catch (error) {
      logger.error("Error deleting transport type:", error)

      if (
        error instanceof Error &&
        error.message === "Transport type not found"
      ) {
        return res.status(404).json({ error: error.message })
      }

      if (
        error instanceof Error &&
        error.message.includes("Cannot delete")
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({
        error: "Failed to delete transport type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
