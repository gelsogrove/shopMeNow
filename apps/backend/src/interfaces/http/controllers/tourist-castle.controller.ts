import { Request, Response } from "express"
import { TouristCastleService } from "../../../application/services/tourist-castle.service"
import logger from "../../../utils/logger"

/**
 * TouristCastleController class
 * Handles HTTP requests related to tourist castles
 */
export class TouristCastleController {
  private touristCastleService: TouristCastleService

  constructor() {
    this.touristCastleService = new TouristCastleService()
  }

  /**
   * Get all TouristCastles for a workspace
   */
  async getAllTouristCastles(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const items = await this.touristCastleService.getAllForWorkspace(workspaceId)
      return res.json(items)
    } catch (error) {
      logger.error("Error getting tourist castles:", error)
      return res.status(500).json({ error: "Failed to get tourist castles" })
    }
  }

  /**
   * Get TouristCastle by ID
   */
  async getTouristCastleById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const item = await this.touristCastleService.getById(id, workspaceId)

      if (!item) {
        return res.status(404).json({ error: "TouristCastle not found" })
      }

      return res.json(item)
    } catch (error) {
      logger.error(`Error getting tourist castle ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist castle" })
    }
  }

  /**
   * Create a new TouristCastle
   */
  async createTouristCastle(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        century,
        visitInfo,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const item = await this.touristCastleService.create({
        name,
        description,
        century,
        visitInfo,
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
      logger.error("Error creating tourist castle:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristCastle data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist castle" })
    }
  }

  /**
   * Update a TouristCastle
   */
  async updateTouristCastle(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        century,
        visitInfo,
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

      const item = await this.touristCastleService.update(id, workspaceId, {
        name,
        description,
        century,
        visitInfo,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      })

      return res.json(item)
    } catch (error: any) {
      logger.error(`Error updating tourist castle ${req.params.id}:`, error)

      if (error.message === "TouristCastle not found") {
        return res.status(404).json({ error: "TouristCastle not found" })
      }

      if (error.message === "Invalid TouristCastle data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist castle" })
    }
  }

  /**
   * Delete a TouristCastle
   */
  async deleteTouristCastle(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristCastleService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristCastle not found") {
          return res.status(404).json({ error: "TouristCastle not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist castle ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist castle" })
    }
  }
}
