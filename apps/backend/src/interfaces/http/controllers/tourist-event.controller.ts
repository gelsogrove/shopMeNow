import { Request, Response } from "express"
import { TouristEventService } from "../../../application/services/tourist-event.service"
import logger from "../../../utils/logger"

/**
 * TouristEventController class
 * Handles HTTP requests related to tourist event recommendations
 */
export class TouristEventController {
  private touristEventService: TouristEventService

  constructor() {
    this.touristEventService = new TouristEventService()
  }

  /**
   * Get all TouristEvents for a workspace
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events:
   *   get:
   *     summary: Get all tourist events for a workspace
   *     tags: [TouristEvents]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of tourist events
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristEvent'
   *       400:
   *         description: Workspace ID is required
   *       500:
   *         description: Failed to get tourist events
   */
  async getAllTouristEvents(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristEvents = await this.touristEventService.getAllForWorkspace(
        workspaceId
      )
      return res.json(touristEvents)
    } catch (error) {
      logger.error("Error getting tourist events:", error)
      return res.status(500).json({ error: "Failed to get tourist events" })
    }
  }

  /**
   * Get TouristEvent by ID
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events/{id}:
   *   get:
   *     summary: Get a tourist event by ID
   *     tags: [TouristEvents]
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
   *         description: TouristEvent ID
   *     responses:
   *       200:
   *         description: TouristEvent details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristEvent'
   *       404:
   *         description: TouristEvent not found
   *       500:
   *         description: Failed to get tourist event
   */
  async getTouristEventById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristEvent = await this.touristEventService.getById(id, workspaceId)

      if (!touristEvent) {
        return res.status(404).json({ error: "TouristEvent not found" })
      }

      return res.json(touristEvent)
    } catch (error) {
      logger.error(`Error getting tourist event ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist event" })
    }
  }

  /**
   * Create a new TouristEvent
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events:
   *   post:
   *     summary: Create a new tourist event
   *     tags: [TouristEvents]
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
   *             $ref: '#/components/schemas/CreateTouristEventRequest'
   *     responses:
   *       201:
   *         description: TouristEvent created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristEvent'
   *       400:
   *         description: Invalid tourist event data or missing required fields
   *       500:
   *         description: Failed to create tourist event
   */
  async createTouristEvent(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        title,
        description,
        location,
        startDate,
        endDate,
        price,
        ticketInfo,
        link,
        ticketLink,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristEventData = {
        title,
        description,
        location,
        startDate,
        endDate,
        price,
        ticketInfo,
        link,
        ticketLink,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristEvent = await this.touristEventService.create(touristEventData)

      return res.status(201).json(touristEvent)
    } catch (error: any) {
      logger.error("Error creating tourist event:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristEvent data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist event" })
    }
  }

  /**
   * Update a TouristEvent
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events/{id}:
   *   put:
   *     summary: Update an existing tourist event
   *     tags: [TouristEvents]
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
   *         description: TouristEvent ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateTouristEventRequest'
   *     responses:
   *       200:
   *         description: TouristEvent updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristEvent'
   *       400:
   *         description: Invalid tourist event data
   *       404:
   *         description: TouristEvent not found
   *       500:
   *         description: Failed to update tourist event
   */
  async updateTouristEvent(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        title,
        description,
        location,
        startDate,
        endDate,
        price,
        ticketInfo,
        link,
        ticketLink,
        videoUrl,
        order,
        isActive,
      } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristEvent = await this.touristEventService.update(id, workspaceId, {
        title,
        description,
        location,
        startDate,
        endDate,
        price,
        ticketInfo,
        link,
        ticketLink,
        videoUrl,
        order,
        isActive,
      })

      return res.json(touristEvent)
    } catch (error: any) {
      logger.error(`Error updating tourist event ${req.params.id}:`, error)

      if (error.message === "TouristEvent not found") {
        return res.status(404).json({ error: "TouristEvent not found" })
      }

      if (error.message === "Invalid TouristEvent data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist event" })
    }
  }

  /**
   * Delete a TouristEvent
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events/{id}:
   *   delete:
   *     summary: Delete a tourist event
   *     tags: [TouristEvents]
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
   *         description: TouristEvent ID
   *     responses:
   *       204:
   *         description: TouristEvent deleted
   *       404:
   *         description: TouristEvent not found
   *       500:
   *         description: Failed to delete tourist event
   */
  async deleteTouristEvent(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristEventService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristEvent not found") {
          return res.status(404).json({ error: "TouristEvent not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist event ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist event" })
    }
  }
}
