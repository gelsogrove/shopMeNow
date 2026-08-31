import { Request, Response } from "express"
import { TouristApartmentService } from "../../../application/services/tourist-apartment.service"
import logger from "../../../utils/logger"

/**
 * TouristApartmentController class
 * Handles HTTP requests related to vacation house/apartment recommendations
 */
export class TouristApartmentController {
  private touristApartmentService: TouristApartmentService

  constructor() {
    this.touristApartmentService = new TouristApartmentService()
  }

  /**
   * Get all TouristApartments for a workspace
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments:
   *   get:
   *     summary: Get all tourist apartments for a workspace
   *     tags: [TouristApartments]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of tourist apartments
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristApartment'
   *       400:
   *         description: Workspace ID is required
   *       500:
   *         description: Failed to get tourist apartments
   */
  async getAllTouristApartments(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristApartments = await this.touristApartmentService.getAllForWorkspace(
        workspaceId
      )
      return res.json(touristApartments)
    } catch (error) {
      logger.error("Error getting tourist apartments:", error)
      return res.status(500).json({ error: "Failed to get tourist apartments" })
    }
  }

  /**
   * Get TouristApartment by ID
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments/{id}:
   *   get:
   *     summary: Get a tourist apartment by ID
   *     tags: [TouristApartments]
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
   *         description: TouristApartment ID
   *     responses:
   *       200:
   *         description: TouristApartment details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristApartment'
   *       404:
   *         description: TouristApartment not found
   *       500:
   *         description: Failed to get tourist apartment
   */
  async getTouristApartmentById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristApartment = await this.touristApartmentService.getById(
        id,
        workspaceId
      )

      if (!touristApartment) {
        return res.status(404).json({ error: "TouristApartment not found" })
      }

      return res.json(touristApartment)
    } catch (error) {
      logger.error(`Error getting tourist apartment ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist apartment" })
    }
  }

  /**
   * Create a new TouristApartment
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments:
   *   post:
   *     summary: Create a new tourist apartment
   *     tags: [TouristApartments]
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
   *             $ref: '#/components/schemas/CreateTouristApartmentRequest'
   *     responses:
   *       201:
   *         description: TouristApartment created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristApartment'
   *       400:
   *         description: Invalid tourist apartment data or missing required fields
   *       500:
   *         description: Failed to create tourist apartment
   */
  async createTouristApartment(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        category,
        location,
        streetNumber,
        phone,
        mobile,
        email,
        rooms,
        beds,
        bathrooms,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristApartmentData = {
        name,
        description,
        category,
        location,
        streetNumber,
        phone,
        mobile,
        email,
        rooms,
        beds,
        bathrooms,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristApartment = await this.touristApartmentService.create(
        touristApartmentData
      )

      return res.status(201).json(touristApartment)
    } catch (error: any) {
      logger.error("Error creating tourist apartment:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristApartment data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist apartment" })
    }
  }

  /**
   * Update a TouristApartment
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments/{id}:
   *   put:
   *     summary: Update an existing tourist apartment
   *     tags: [TouristApartments]
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
   *         description: TouristApartment ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateTouristApartmentRequest'
   *     responses:
   *       200:
   *         description: TouristApartment updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristApartment'
   *       400:
   *         description: Invalid tourist apartment data
   *       404:
   *         description: TouristApartment not found
   *       500:
   *         description: Failed to update tourist apartment
   */
  async updateTouristApartment(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        category,
        location,
        streetNumber,
        phone,
        mobile,
        email,
        rooms,
        beds,
        bathrooms,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristApartment = await this.touristApartmentService.update(
        id,
        workspaceId,
        {
          name,
          description,
          category,
          location,
          streetNumber,
          phone,
          mobile,
          email,
          rooms,
          beds,
          bathrooms,
          link,
          videoUrl,
          order,
          isActive,
        }
      )

      return res.json(touristApartment)
    } catch (error: any) {
      logger.error(`Error updating tourist apartment ${req.params.id}:`, error)

      if (error.message === "TouristApartment not found") {
        return res.status(404).json({ error: "TouristApartment not found" })
      }

      if (error.message === "Invalid TouristApartment data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist apartment" })
    }
  }

  /**
   * Delete a TouristApartment
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments/{id}:
   *   delete:
   *     summary: Delete a tourist apartment
   *     tags: [TouristApartments]
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
   *         description: TouristApartment ID
   *     responses:
   *       204:
   *         description: TouristApartment deleted
   *       404:
   *         description: TouristApartment not found
   *       500:
   *         description: Failed to delete tourist apartment
   */
  async deleteTouristApartment(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristApartmentService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristApartment not found") {
          return res.status(404).json({ error: "TouristApartment not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist apartment ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist apartment" })
    }
  }
}
