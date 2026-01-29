import { Request, Response } from "express"
import { PrismaClient } from "@echatbot/database"
import { TypeService } from "../../../application/services/type.service"
import logger from "../../../utils/logger"

export class TypeController {
  private typeService: TypeService

  constructor(private prisma: PrismaClient) {
    this.typeService = new TypeService(prisma)
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types:
   *   get:
   *     summary: Get all types for workspace
   *     tags: [Types]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of types
   */
  async getAll(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId

      const types =
        await this.typeService.getAllWithCounts(workspaceId)

      return res.json(types)
    } catch (error) {
      logger.error("Error getting types:", error)
      return res.status(500).json({
        error: "Failed to get types",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types/{id}:
   *   get:
   *     summary: Get type by ID
   *     tags: [Types]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: type details
   *       404:
   *         description: type not found
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      const type = await this.typeService.getById(
        id,
        workspaceId
      )

      if (!type) {
        return res.status(404).json({ error: "type not found" })
      }

      return res.json(type)
    } catch (error) {
      logger.error("Error getting type:", error)
      return res.status(500).json({
        error: "Failed to get type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types:
   *   post:
   *     summary: Create new type
   *     tags: [Types]
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
   *         description: type created
   *       400:
   *         description: Validation error
   */
  async create(req: Request, res: Response) {
    try {
      const { name } = req.body
      const workspaceId = (req as any).workspaceId

      if (!name) {
        return res.status(400).json({ error: "type name is required" })
      }

      const type = await this.typeService.create(
        workspaceId,
        name
      )

      logger.info(`type created: ${type.id} (${name})`)
      return res.status(201).json(type)
    } catch (error) {
      logger.error("Error creating type:", error)

      if (
        error instanceof Error &&
        error.message === "type already exists"
      ) {
        return res.status(400).json({ error: error.message })
      }

      if (
        error instanceof Error &&
        error.message.includes("type name")
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({
        error: "Failed to create type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types/{id}:
   *   put:
   *     summary: Update type
   *     tags: [Types]
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
   *         description: type updated
   *       404:
   *         description: type not found
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name } = req.body
      const workspaceId = (req as any).workspaceId

      if (!name) {
        return res.status(400).json({ error: "type name is required" })
      }

      const type = await this.typeService.update(
        id,
        workspaceId,
        name
      )

      logger.info(`type updated: ${id} (${name})`)
      return res.json(type)
    } catch (error) {
      logger.error("Error updating type:", error)

      if (
        error instanceof Error &&
        error.message === "type not found"
      ) {
        return res.status(404).json({ error: error.message })
      }

      if (
        error instanceof Error &&
        (error.message === "type name already exists" ||
          error.message.includes("type name"))
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({
        error: "Failed to update type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/transport-types/{id}:
   *   delete:
   *     summary: Delete type
   *     tags: [Types]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: type deleted
   *       400:
   *         description: Cannot delete - used by products
   *       404:
   *         description: type not found
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      await this.typeService.delete(id, workspaceId)

      logger.info(`type deleted: ${id}`)
      return res.json({ message: "type deleted successfully" })
    } catch (error) {
      logger.error("Error deleting type:", error)

      if (
        error instanceof Error &&
        error.message === "type not found"
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
        error: "Failed to delete type",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
