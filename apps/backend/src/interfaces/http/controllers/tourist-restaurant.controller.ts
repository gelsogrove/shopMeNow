import { Request, Response } from "express"
import { TouristRestaurantService } from "../../../application/services/tourist-restaurant.service"
import logger from "../../../utils/logger"

/**
 * TouristRestaurantController class
 * Handles HTTP requests related to tourist restaurant recommendations
 */
export class TouristRestaurantController {
  private touristRestaurantService: TouristRestaurantService

  constructor() {
    this.touristRestaurantService = new TouristRestaurantService()
  }

  /**
   * Get all TouristRestaurants for a workspace
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants:
   *   get:
   *     summary: Get all tourist restaurants for a workspace
   *     tags: [TouristRestaurants]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of tourist restaurants
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristRestaurant'
   *       400:
   *         description: Workspace ID is required
   *       500:
   *         description: Failed to get tourist restaurants
   */
  async getAllTouristRestaurants(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristRestaurants =
        await this.touristRestaurantService.getAllForWorkspace(workspaceId)
      return res.json(touristRestaurants)
    } catch (error) {
      logger.error("Error getting tourist restaurants:", error)
      return res.status(500).json({ error: "Failed to get tourist restaurants" })
    }
  }

  /**
   * Get TouristRestaurant by ID
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants/{id}:
   *   get:
   *     summary: Get a tourist restaurant by ID
   *     tags: [TouristRestaurants]
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
   *         description: TouristRestaurant ID
   *     responses:
   *       200:
   *         description: TouristRestaurant details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRestaurant'
   *       404:
   *         description: TouristRestaurant not found
   *       500:
   *         description: Failed to get tourist restaurant
   */
  async getTouristRestaurantById(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristRestaurant = await this.touristRestaurantService.getById(
        id,
        workspaceId
      )

      if (!touristRestaurant) {
        return res.status(404).json({ error: "TouristRestaurant not found" })
      }

      return res.json(touristRestaurant)
    } catch (error) {
      logger.error(`Error getting tourist restaurant ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist restaurant" })
    }
  }

  /**
   * Create a new TouristRestaurant
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants:
   *   post:
   *     summary: Create a new tourist restaurant
   *     tags: [TouristRestaurants]
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
   *             $ref: '#/components/schemas/CreateTouristRestaurantRequest'
   *     responses:
   *       201:
   *         description: TouristRestaurant created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRestaurant'
   *       400:
   *         description: Invalid tourist restaurant data or missing required fields
   *       500:
   *         description: Failed to create tourist restaurant
   */
  async createTouristRestaurant(
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
        cuisineType,
        celiacFriendly,
        needsReservation,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristRestaurantData = {
        name,
        description,
        cuisineType,
        celiacFriendly,
        needsReservation,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristRestaurant = await this.touristRestaurantService.create(
        touristRestaurantData
      )

      return res.status(201).json(touristRestaurant)
    } catch (error: any) {
      logger.error("Error creating tourist restaurant:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristRestaurant data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist restaurant" })
    }
  }

  /**
   * Update a TouristRestaurant
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants/{id}:
   *   put:
   *     summary: Update an existing tourist restaurant
   *     tags: [TouristRestaurants]
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
   *         description: TouristRestaurant ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateTouristRestaurantRequest'
   *     responses:
   *       200:
   *         description: TouristRestaurant updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRestaurant'
   *       400:
   *         description: Invalid tourist restaurant data
   *       404:
   *         description: TouristRestaurant not found
   *       500:
   *         description: Failed to update tourist restaurant
   */
  async updateTouristRestaurant(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        cuisineType,
        celiacFriendly,
        needsReservation,
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

      const touristRestaurant = await this.touristRestaurantService.update(
        id,
        workspaceId,
        {
          name,
          description,
          cuisineType,
          celiacFriendly,
          needsReservation,
          location,
          phone,
          link,
          videoUrl,
          order,
          isActive,
        }
      )

      return res.json(touristRestaurant)
    } catch (error: any) {
      logger.error(`Error updating tourist restaurant ${req.params.id}:`, error)

      if (error.message === "TouristRestaurant not found") {
        return res.status(404).json({ error: "TouristRestaurant not found" })
      }

      if (error.message === "Invalid TouristRestaurant data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist restaurant" })
    }
  }

  /**
   * Delete a TouristRestaurant
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants/{id}:
   *   delete:
   *     summary: Delete a tourist restaurant
   *     tags: [TouristRestaurants]
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
   *         description: TouristRestaurant ID
   *     responses:
   *       204:
   *         description: TouristRestaurant deleted
   *       404:
   *         description: TouristRestaurant not found
   *       500:
   *         description: Failed to delete tourist restaurant
   */
  async deleteTouristRestaurant(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristRestaurantService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristRestaurant not found") {
          return res.status(404).json({ error: "TouristRestaurant not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist restaurant ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist restaurant" })
    }
  }
}
