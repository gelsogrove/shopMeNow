import { Request, Response } from "express"
import { PrismaClient } from "@prisma/client"
import { CertificationService } from "../../../services/certification.service"
import logger from "../../../utils/logger"

export class CertificationController {
  private certificationService: CertificationService

  constructor(private prisma: PrismaClient) {
    this.certificationService = new CertificationService(prisma)
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/certifications:
   *   get:
   *     summary: Get all certifications for workspace
   *     tags: [Certifications]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of certifications
   */
  async getAll(req: Request, res: Response) {
    try {
      const workspaceId = (req as any).workspaceId

      const certifications =
        await this.certificationService.getAllWithCounts(workspaceId)

      return res.json(certifications)
    } catch (error) {
      logger.error("Error getting certifications:", error)
      return res.status(500).json({
        error: "Failed to get certifications",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/certifications/{id}:
   *   get:
   *     summary: Get certification by ID
   *     tags: [Certifications]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: Certification details
   *       404:
   *         description: Certification not found
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      const certification = await this.certificationService.getById(
        id,
        workspaceId
      )

      if (!certification) {
        return res.status(404).json({ error: "Certification not found" })
      }

      return res.json(certification)
    } catch (error) {
      logger.error("Error getting certification:", error)
      return res.status(500).json({
        error: "Failed to get certification",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/certifications:
   *   post:
   *     summary: Create new certification
   *     tags: [Certifications]
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
   *                 example: "Kosher"
   *     responses:
   *       201:
   *         description: Certification created
   *       400:
   *         description: Validation error
   */
  async create(req: Request, res: Response) {
    try {
      const { name } = req.body
      const workspaceId = (req as any).workspaceId

      if (!name) {
        return res.status(400).json({ error: "Certification name is required" })
      }

      const certification = await this.certificationService.create(
        workspaceId,
        name
      )

      logger.info(`Certification created: ${certification.id} (${name})`)
      return res.status(201).json(certification)
    } catch (error) {
      logger.error("Error creating certification:", error)

      if (
        error instanceof Error &&
        error.message === "Certification already exists"
      ) {
        return res.status(400).json({ error: error.message })
      }

      if (
        error instanceof Error &&
        error.message.includes("Certification name")
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({
        error: "Failed to create certification",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/certifications/{id}:
   *   put:
   *     summary: Update certification
   *     tags: [Certifications]
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
   *         description: Certification updated
   *       404:
   *         description: Certification not found
   */
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params
      const { name } = req.body
      const workspaceId = (req as any).workspaceId

      if (!name) {
        return res.status(400).json({ error: "Certification name is required" })
      }

      const certification = await this.certificationService.update(
        id,
        workspaceId,
        name
      )

      logger.info(`Certification updated: ${id} (${name})`)
      return res.json(certification)
    } catch (error) {
      logger.error("Error updating certification:", error)

      if (
        error instanceof Error &&
        error.message === "Certification not found"
      ) {
        return res.status(404).json({ error: error.message })
      }

      if (
        error instanceof Error &&
        (error.message === "Certification name already exists" ||
          error.message.includes("Certification name"))
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({
        error: "Failed to update certification",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/certifications/{id}:
   *   delete:
   *     summary: Delete certification
   *     tags: [Certifications]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *       - in: path
   *         name: id
   *         required: true
   *     responses:
   *       200:
   *         description: Certification deleted
   *       400:
   *         description: Cannot delete - used by products
   *       404:
   *         description: Certification not found
   */
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params
      const workspaceId = (req as any).workspaceId

      await this.certificationService.delete(id, workspaceId)

      logger.info(`Certification deleted: ${id}`)
      return res.json({ message: "Certification deleted successfully" })
    } catch (error) {
      logger.error("Error deleting certification:", error)

      if (
        error instanceof Error &&
        error.message === "Certification not found"
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
        error: "Failed to delete certification",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
