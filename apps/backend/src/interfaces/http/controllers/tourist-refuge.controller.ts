import { Request, Response } from "express"
import { TouristRefugeService } from "../../../application/services/tourist-refuge.service"
import logger from "../../../utils/logger"

/**
 * TouristRefugeController class
 * Handles HTTP requests related to tourist mountain refuge recommendations
 */
export class TouristRefugeController {
  private touristRefugeService: TouristRefugeService

  constructor() {
    this.touristRefugeService = new TouristRefugeService()
  }

  /**
   * Get all TouristRefuges for a workspace
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges:
   *   get:
   *     summary: Get all tourist refuges for a workspace
   *     tags: [TouristRefuges]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of tourist refuges
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristRefuge'
   *       400:
   *         description: Workspace ID is required
   *       500:
   *         description: Failed to get tourist refuges
   */
  async getAllTouristRefuges(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristRefuges = await this.touristRefugeService.getAllForWorkspace(
        workspaceId
      )
      return res.json(touristRefuges)
    } catch (error) {
      logger.error("Error getting tourist refuges:", error)
      return res.status(500).json({ error: "Failed to get tourist refuges" })
    }
  }

  /**
   * Get TouristRefuge by ID
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges/{id}:
   *   get:
   *     summary: Get a tourist refuge by ID
   *     tags: [TouristRefuges]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: TouristRefuge ID
   *     responses:
   *       200:
   *         description: TouristRefuge details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRefuge'
   *       404:
   *         description: TouristRefuge not found
   *       500:
   *         description: Failed to get tourist refuge
   */
  async getTouristRefugeById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristRefuge = await this.touristRefugeService.getById(
        id,
        workspaceId
      )

      if (!touristRefuge) {
        return res.status(404).json({ error: "TouristRefuge not found" })
      }

      return res.json(touristRefuge)
    } catch (error) {
      logger.error(`Error getting tourist refuge ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist refuge" })
    }
  }

  /**
   * Create a new TouristRefuge
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges:
   *   post:
   *     summary: Create a new tourist refuge
   *     tags: [TouristRefuges]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateTouristRefugeRequest'
   *     responses:
   *       201:
   *         description: TouristRefuge created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRefuge'
   *       400:
   *         description: Invalid tourist refuge data or missing required fields
   *       500:
   *         description: Failed to create tourist refuge
   */
  async createTouristRefuge(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        climbTime,
        difficulty,
        openFrom,
        openTo,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristRefugeData = {
        name,
        description,
        climbTime,
        difficulty,
        openFrom,
        openTo,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristRefuge = await this.touristRefugeService.create(
        touristRefugeData
      )

      return res.status(201).json(touristRefuge)
    } catch (error: any) {
      logger.error("Error creating tourist refuge:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristRefuge data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist refuge" })
    }
  }

  /**
   * Update a TouristRefuge
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges/{id}:
   *   put:
   *     summary: Update an existing tourist refuge
   *     tags: [TouristRefuges]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: TouristRefuge ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateTouristRefugeRequest'
   *     responses:
   *       200:
   *         description: TouristRefuge updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRefuge'
   *       400:
   *         description: Invalid tourist refuge data
   *       404:
   *         description: TouristRefuge not found
   *       500:
   *         description: Failed to update tourist refuge
   */
  async updateTouristRefuge(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        climbTime,
        difficulty,
        openFrom,
        openTo,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristRefuge = await this.touristRefugeService.update(
        id,
        workspaceId,
        {
          name,
          description,
          climbTime,
          difficulty,
          openFrom,
          openTo,
          location,
          phone,
          link,
          videoUrl,
          order,
          isActive,
        }
      )

      return res.json(touristRefuge)
    } catch (error: any) {
      logger.error(`Error updating tourist refuge ${req.params.id}:`, error)

      if (error.message === "TouristRefuge not found") {
        return res.status(404).json({ error: "TouristRefuge not found" })
      }

      if (error.message === "Invalid TouristRefuge data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist refuge" })
    }
  }

  /**
   * Delete a TouristRefuge
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges/{id}:
   *   delete:
   *     summary: Delete a tourist refuge
   *     tags: [TouristRefuges]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: TouristRefuge ID
   *     responses:
   *       204:
   *         description: TouristRefuge deleted
   *       404:
   *         description: TouristRefuge not found
   *       500:
   *         description: Failed to delete tourist refuge
   */
  async deleteTouristRefuge(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristRefugeService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristRefuge not found") {
          return res.status(404).json({ error: "TouristRefuge not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist refuge ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist refuge" })
    }
  }
}
