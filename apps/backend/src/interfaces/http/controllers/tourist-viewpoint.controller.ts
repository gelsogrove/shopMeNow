import { Request, Response } from "express"
import { TouristViewpointService } from "../../../application/services/tourist-viewpoint.service"
import logger from "../../../utils/logger"

/**
 * TouristViewpointController class
 * Handles HTTP requests related to tourist viewpoints
 */
export class TouristViewpointController {
  private touristViewpointService: TouristViewpointService

  constructor() {
    this.touristViewpointService = new TouristViewpointService()
  }

  /**
   * Get all TouristViewpoints for a workspace
   */
  async getAllTouristViewpoints(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const items = await this.touristViewpointService.getAllForWorkspace(workspaceId)
      return res.json(items)
    } catch (error) {
      logger.error("Error getting tourist viewpoints:", error)
      return res.status(500).json({ error: "Failed to get tourist viewpoints" })
    }
  }

  /**
   * Get TouristViewpoint by ID
   */
  async getTouristViewpointById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const item = await this.touristViewpointService.getById(id, workspaceId)

      if (!item) {
        return res.status(404).json({ error: "TouristViewpoint not found" })
      }

      return res.json(item)
    } catch (error) {
      logger.error(`Error getting tourist viewpoint ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist viewpoint" })
    }
  }

  /**
   * Create a new TouristViewpoint
   */
  async createTouristViewpoint(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        altitude,
        access,
        difficulty,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const item = await this.touristViewpointService.create({
        name,
        description,
        altitude,
        access,
        difficulty,
        location,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      })

      return res.status(201).json(item)
    } catch (error: any) {
      logger.error("Error creating tourist viewpoint:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristViewpoint data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist viewpoint" })
    }
  }

  /**
   * Update a TouristViewpoint
   */
  async updateTouristViewpoint(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        altitude,
        access,
        difficulty,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const item = await this.touristViewpointService.update(id, workspaceId, {
        name,
        description,
        altitude,
        access,
        difficulty,
        location,
        link,
        videoUrl,
        order,
        isActive,
      })

      return res.json(item)
    } catch (error: any) {
      logger.error(`Error updating tourist viewpoint ${req.params.id}:`, error)

      if (error.message === "TouristViewpoint not found") {
        return res.status(404).json({ error: "TouristViewpoint not found" })
      }

      if (error.message === "Invalid TouristViewpoint data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist viewpoint" })
    }
  }

  /**
   * Delete a TouristViewpoint
   */
  async deleteTouristViewpoint(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristViewpointService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristViewpoint not found") {
          return res.status(404).json({ error: "TouristViewpoint not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist viewpoint ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist viewpoint" })
    }
  }
}
