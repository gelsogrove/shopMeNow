import { Request, Response } from "express"
import { TouristExcursionService } from "../../../application/services/tourist-excursion.service"
import logger from "../../../utils/logger"

/**
 * TouristExcursionController class
 * Handles HTTP requests related to tourist excursion recommendations
 */
export class TouristExcursionController {
  private touristExcursionService: TouristExcursionService

  constructor() {
    this.touristExcursionService = new TouristExcursionService()
  }

  /**
   * Get all TouristExcursions for a workspace
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions:
   *   get:
   *     summary: Get all tourist excursions for a workspace
   *     tags: [TouristExcursions]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of tourist excursions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristExcursion'
   *       400:
   *         description: Workspace ID is required
   *       500:
   *         description: Failed to get tourist excursions
   */
  async getAllTouristExcursions(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristExcursions =
        await this.touristExcursionService.getAllForWorkspace(workspaceId)
      return res.json(touristExcursions)
    } catch (error) {
      logger.error("Error getting tourist excursions:", error)
      return res.status(500).json({ error: "Failed to get tourist excursions" })
    }
  }

  /**
   * Get TouristExcursion by ID
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions/{id}:
   *   get:
   *     summary: Get a tourist excursion by ID
   *     tags: [TouristExcursions]
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
   *         description: TouristExcursion ID
   *     responses:
   *       200:
   *         description: TouristExcursion details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristExcursion'
   *       404:
   *         description: TouristExcursion not found
   *       500:
   *         description: Failed to get tourist excursion
   */
  async getTouristExcursionById(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristExcursion = await this.touristExcursionService.getById(
        id,
        workspaceId
      )

      if (!touristExcursion) {
        return res.status(404).json({ error: "TouristExcursion not found" })
      }

      return res.json(touristExcursion)
    } catch (error) {
      logger.error(`Error getting tourist excursion ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist excursion" })
    }
  }

  /**
   * Create a new TouristExcursion
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions:
   *   post:
   *     summary: Create a new tourist excursion
   *     tags: [TouristExcursions]
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
   *             $ref: '#/components/schemas/CreateTouristExcursionRequest'
   *     responses:
   *       201:
   *         description: TouristExcursion created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristExcursion'
   *       400:
   *         description: Invalid tourist excursion data or missing required fields
   *       500:
   *         description: Failed to create tourist excursion
   */
  async createTouristExcursion(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        difficulty,
        duration,
        season,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristExcursionData = {
        name,
        description,
        difficulty,
        duration,
        season,
        location,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristExcursion = await this.touristExcursionService.create(
        touristExcursionData
      )

      return res.status(201).json(touristExcursion)
    } catch (error: any) {
      logger.error("Error creating tourist excursion:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristExcursion data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist excursion" })
    }
  }

  /**
   * Update a TouristExcursion
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions/{id}:
   *   put:
   *     summary: Update an existing tourist excursion
   *     tags: [TouristExcursions]
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
   *         description: TouristExcursion ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateTouristExcursionRequest'
   *     responses:
   *       200:
   *         description: TouristExcursion updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristExcursion'
   *       400:
   *         description: Invalid tourist excursion data
   *       404:
   *         description: TouristExcursion not found
   *       500:
   *         description: Failed to update tourist excursion
   */
  async updateTouristExcursion(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        difficulty,
        duration,
        season,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristExcursion = await this.touristExcursionService.update(
        id,
        workspaceId,
        {
          name,
          description,
          difficulty,
          duration,
          season,
          location,
          link,
          videoUrl,
          order,
          isActive,
        }
      )

      return res.json(touristExcursion)
    } catch (error: any) {
      logger.error(`Error updating tourist excursion ${req.params.id}:`, error)

      if (error.message === "TouristExcursion not found") {
        return res.status(404).json({ error: "TouristExcursion not found" })
      }

      if (error.message === "Invalid TouristExcursion data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist excursion" })
    }
  }

  /**
   * Delete a TouristExcursion
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions/{id}:
   *   delete:
   *     summary: Delete a tourist excursion
   *     tags: [TouristExcursions]
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
   *         description: TouristExcursion ID
   *     responses:
   *       204:
   *         description: TouristExcursion deleted
   *       404:
   *         description: TouristExcursion not found
   *       500:
   *         description: Failed to delete tourist excursion
   */
  async deleteTouristExcursion(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristExcursionService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristExcursion not found") {
          return res.status(404).json({ error: "TouristExcursion not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist excursion ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist excursion" })
    }
  }
}
