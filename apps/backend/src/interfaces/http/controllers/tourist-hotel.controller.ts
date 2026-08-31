import { Request, Response } from "express"
import { TouristHotelService } from "../../../application/services/tourist-hotel.service"
import logger from "../../../utils/logger"

/**
 * TouristHotelController class
 * Handles HTTP requests related to tourist hotel recommendations
 */
export class TouristHotelController {
  private touristHotelService: TouristHotelService

  constructor() {
    this.touristHotelService = new TouristHotelService()
  }

  /**
   * Get all TouristHotels for a workspace
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels:
   *   get:
   *     summary: Get all tourist hotels for a workspace
   *     tags: [TouristHotels]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of tourist hotels
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristHotel'
   *       400:
   *         description: Workspace ID is required
   *       500:
   *         description: Failed to get tourist hotels
   */
  async getAllTouristHotels(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristHotels = await this.touristHotelService.getAllForWorkspace(
        workspaceId
      )
      return res.json(touristHotels)
    } catch (error) {
      logger.error("Error getting tourist hotels:", error)
      return res.status(500).json({ error: "Failed to get tourist hotels" })
    }
  }

  /**
   * Get TouristHotel by ID
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels/{id}:
   *   get:
   *     summary: Get a tourist hotel by ID
   *     tags: [TouristHotels]
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
   *         description: TouristHotel ID
   *     responses:
   *       200:
   *         description: TouristHotel details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristHotel'
   *       404:
   *         description: TouristHotel not found
   *       500:
   *         description: Failed to get tourist hotel
   */
  async getTouristHotelById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristHotel = await this.touristHotelService.getById(
        id,
        workspaceId
      )

      if (!touristHotel) {
        return res.status(404).json({ error: "TouristHotel not found" })
      }

      return res.json(touristHotel)
    } catch (error) {
      logger.error(`Error getting tourist hotel ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist hotel" })
    }
  }

  /**
   * Create a new TouristHotel
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels:
   *   post:
   *     summary: Create a new tourist hotel
   *     tags: [TouristHotels]
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
   *             $ref: '#/components/schemas/CreateTouristHotelRequest'
   *     responses:
   *       201:
   *         description: TouristHotel created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristHotel'
   *       400:
   *         description: Invalid tourist hotel data or missing required fields
   *       500:
   *         description: Failed to create tourist hotel
   */
  async createTouristHotel(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        stars,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristHotelData = {
        name,
        description,
        stars,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristHotel = await this.touristHotelService.create(
        touristHotelData
      )

      return res.status(201).json(touristHotel)
    } catch (error: any) {
      logger.error("Error creating tourist hotel:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristHotel data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist hotel" })
    }
  }

  /**
   * Update a TouristHotel
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels/{id}:
   *   put:
   *     summary: Update an existing tourist hotel
   *     tags: [TouristHotels]
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
   *         description: TouristHotel ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateTouristHotelRequest'
   *     responses:
   *       200:
   *         description: TouristHotel updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristHotel'
   *       400:
   *         description: Invalid tourist hotel data
   *       404:
   *         description: TouristHotel not found
   *       500:
   *         description: Failed to update tourist hotel
   */
  async updateTouristHotel(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        stars,
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

      const touristHotel = await this.touristHotelService.update(
        id,
        workspaceId,
        {
          name,
          description,
          stars,
          location,
          phone,
          link,
          videoUrl,
          order,
          isActive,
        }
      )

      return res.json(touristHotel)
    } catch (error: any) {
      logger.error(`Error updating tourist hotel ${req.params.id}:`, error)

      if (error.message === "TouristHotel not found") {
        return res.status(404).json({ error: "TouristHotel not found" })
      }

      if (error.message === "Invalid TouristHotel data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist hotel" })
    }
  }

  /**
   * Delete a TouristHotel
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels/{id}:
   *   delete:
   *     summary: Delete a tourist hotel
   *     tags: [TouristHotels]
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
   *         description: TouristHotel ID
   *     responses:
   *       204:
   *         description: TouristHotel deleted
   *       404:
   *         description: TouristHotel not found
   *       500:
   *         description: Failed to delete tourist hotel
   */
  async deleteTouristHotel(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristHotelService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristHotel not found") {
          return res.status(404).json({ error: "TouristHotel not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist hotel ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist hotel" })
    }
  }
}
