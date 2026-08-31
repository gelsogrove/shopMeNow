import { Request, Response } from "express"
import { TouristSportsFacilityService } from "../../../application/services/tourist-sports-facility.service"
import logger from "../../../utils/logger"

/**
 * TouristSportsFacilityController class
 * Handles HTTP requests related to tourist sports facilities (e.g. golf, tennis)
 */
export class TouristSportsFacilityController {
  private touristSportsFacilityService: TouristSportsFacilityService

  constructor() {
    this.touristSportsFacilityService = new TouristSportsFacilityService()
  }

  /**
   * Get all TouristSportsFacilities for a workspace
   */
  async getAllTouristSportsFacilities(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristSportsFacilities =
        await this.touristSportsFacilityService.getAllForWorkspace(workspaceId)
      return res.json(touristSportsFacilities)
    } catch (error) {
      logger.error("Error getting tourist sports facilities:", error)
      return res
        .status(500)
        .json({ error: "Failed to get tourist sports facilities" })
    }
  }

  /**
   * Get TouristSportsFacility by ID
   */
  async getTouristSportsFacilityById(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristSportsFacility =
        await this.touristSportsFacilityService.getById(id, workspaceId)

      if (!touristSportsFacility) {
        return res.status(404).json({ error: "TouristSportsFacility not found" })
      }

      return res.json(touristSportsFacility)
    } catch (error) {
      logger.error(
        `Error getting tourist sports facility ${req.params.id}:`,
        error
      )
      return res
        .status(500)
        .json({ error: "Failed to get tourist sports facility" })
    }
  }

  /**
   * Create a new TouristSportsFacility
   */
  async createTouristSportsFacility(
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
        sport,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristSportsFacilityData = {
        name,
        description,
        sport,
        location,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristSportsFacility =
        await this.touristSportsFacilityService.create(touristSportsFacilityData)

      return res.status(201).json(touristSportsFacility)
    } catch (error: any) {
      logger.error("Error creating tourist sports facility:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristSportsFacility data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res
        .status(500)
        .json({ error: "Failed to create tourist sports facility" })
    }
  }

  /**
   * Update a TouristSportsFacility
   */
  async updateTouristSportsFacility(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        sport,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristSportsFacility =
        await this.touristSportsFacilityService.update(id, workspaceId, {
          name,
          description,
          sport,
          location,
          link,
          videoUrl,
          order,
          isActive,
        })

      return res.json(touristSportsFacility)
    } catch (error: any) {
      logger.error(
        `Error updating tourist sports facility ${req.params.id}:`,
        error
      )

      if (error.message === "TouristSportsFacility not found") {
        return res.status(404).json({ error: "TouristSportsFacility not found" })
      }

      if (error.message === "Invalid TouristSportsFacility data") {
        return res.status(400).json({ error: error.message })
      }

      return res
        .status(500)
        .json({ error: "Failed to update tourist sports facility" })
    }
  }

  /**
   * Delete a TouristSportsFacility
   */
  async deleteTouristSportsFacility(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristSportsFacilityService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristSportsFacility not found") {
          return res
            .status(404)
            .json({ error: "TouristSportsFacility not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(
        `Error deleting tourist sports facility ${req.params.id}:`,
        error
      )
      return res
        .status(500)
        .json({ error: "Failed to delete tourist sports facility" })
    }
  }
}
