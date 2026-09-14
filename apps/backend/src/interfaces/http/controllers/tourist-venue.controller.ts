import { Request, Response } from "express"
import { TouristVenueService } from "../../../application/services/tourist-venue.service"
import logger from "../../../utils/logger"

/**
 * TouristVenueController class
 * Handles HTTP requests related to tourist venues
 */
export class TouristVenueController {
  private touristVenueService: TouristVenueService

  constructor() {
    this.touristVenueService = new TouristVenueService()
  }

  /**
   * Get all TouristVenues for a workspace
   */
  async getAllTouristVenues(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const items = await this.touristVenueService.getAllForWorkspace(workspaceId)
      return res.json(items)
    } catch (error) {
      logger.error("Error getting tourist venues:", error)
      return res.status(500).json({ error: "Failed to get tourist venues" })
    }
  }

  /**
   * Get TouristVenue by ID
   */
  async getTouristVenueById(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const item = await this.touristVenueService.getById(id, workspaceId)

      if (!item) {
        return res.status(404).json({ error: "TouristVenue not found" })
      }

      return res.json(item)
    } catch (error) {
      logger.error(`Error getting tourist venue ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get tourist venue" })
    }
  }

  /**
   * Create a new TouristVenue
   */
  async createTouristVenue(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const {
        name,
        description,
        venueType,
        openingHours,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const item = await this.touristVenueService.create({
        name,
        description,
        venueType,
        openingHours,
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
      logger.error("Error creating tourist venue:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristVenue data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist venue" })
    }
  }

  /**
   * Update a TouristVenue
   */
  async updateTouristVenue(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        venueType,
        openingHours,
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

      const item = await this.touristVenueService.update(id, workspaceId, {
        name,
        description,
        venueType,
        openingHours,
        location,
        phone,
        link,
        videoUrl,
        order,
        isActive,
      })

      return res.json(item)
    } catch (error: any) {
      logger.error(`Error updating tourist venue ${req.params.id}:`, error)

      if (error.message === "TouristVenue not found") {
        return res.status(404).json({ error: "TouristVenue not found" })
      }

      if (error.message === "Invalid TouristVenue data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update tourist venue" })
    }
  }

  /**
   * Delete a TouristVenue
   */
  async deleteTouristVenue(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristVenueService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristVenue not found") {
          return res.status(404).json({ error: "TouristVenue not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist venue ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist venue" })
    }
  }
}
