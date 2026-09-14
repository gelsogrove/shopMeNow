import { Request, Response } from "express"
import { TouristChurchService } from "../../../application/services/tourist-church.service"
import logger from "../../../utils/logger"

/**
 * TouristChurchController class
 * Handles HTTP requests related to tourist churches
 */
export class TouristChurchController {
  private touristChurchService: TouristChurchService

  constructor() {
    this.touristChurchService = new TouristChurchService()
  }

  /**
   * Get all TouristChurchs for a workspace
   */
  async getAllTouristChurchs(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const items = await this.touristChurchService.getAllForWorkspace(workspaceId)
      return res.json(items)
    } catch (error) {
      logger.error("Error getting tourist churches:", error)
      return res.status(500).json({ error: "Failed to get tourist churches" })
    }
  }

  /**
   * Get TouristChurch by ID
   */
  async getTouristChurchById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const item = await this.touristChurchService.getById(id, workspaceId)

      if (!item) {
        return res.status(404).json({ error: "TouristChurch not found" })
      }

      return res.json(item)
    } catch (error) {
      logger.error(`Error getting tourist church ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist church" })
    }
  }

  /**
   * Create a new TouristChurch
   */
  async createTouristChurch(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        century,
        style,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const item = await this.touristChurchService.create({
        name,
        description,
        century,
        style,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      })

      return res.status(201).json(item)
    } catch (error: any) {
      logger.error("Error creating tourist church:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristChurch data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist church" })
    }
  }

  /**
   * Update a TouristChurch
   */
  async updateTouristChurch(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        century,
        style,
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

      const item = await this.touristChurchService.update(id, workspaceId, {
        name,
        description,
        century,
        style,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      })

      return res.json(item)
    } catch (error: any) {
      logger.error(`Error updating tourist church ${req.params.id}:`, error)

      if (error.message === "TouristChurch not found") {
        return res.status(404).json({ error: "TouristChurch not found" })
      }

      if (error.message === "Invalid TouristChurch data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist church" })
    }
  }

  /**
   * Delete a TouristChurch
   */
  async deleteTouristChurch(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristChurchService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristChurch not found") {
          return res.status(404).json({ error: "TouristChurch not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist church ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist church" })
    }
  }
}
