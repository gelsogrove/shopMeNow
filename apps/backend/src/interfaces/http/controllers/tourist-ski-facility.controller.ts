import { Request, Response } from "express"
import { TouristSkiFacilityService } from "../../../application/services/tourist-ski-facility.service"
import logger from "../../../utils/logger"

/**
 * TouristSkiFacilityController class
 * Handles HTTP requests related to tourist ski facilities / slopes
 */
export class TouristSkiFacilityController {
  private touristSkiFacilityService: TouristSkiFacilityService

  constructor() {
    this.touristSkiFacilityService = new TouristSkiFacilityService()
  }

  /**
   * Get all TouristSkiFacilities for a workspace
   */
  async getAllTouristSkiFacilities(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristSkiFacilities =
        await this.touristSkiFacilityService.getAllForWorkspace(workspaceId)
      return res.json(touristSkiFacilities)
    } catch (error) {
      logger.error("Error getting tourist ski facilities:", error)
      return res
        .status(500)
        .json({ error: "Failed to get tourist ski facilities" })
    }
  }

  /**
   * Get TouristSkiFacility by ID
   */
  async getTouristSkiFacilityById(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristSkiFacility = await this.touristSkiFacilityService.getById(
        id,
        workspaceId
      )

      if (!touristSkiFacility) {
        return res.status(404).json({ error: "TouristSkiFacility not found" })
      }

      return res.json(touristSkiFacility)
    } catch (error) {
      logger.error(
        `Error getting tourist ski facility ${req.params.id}:`,
        error
      )
      return res
        .status(500)
        .json({ error: "Failed to get tourist ski facility" })
    }
  }

  /**
   * Create a new TouristSkiFacility
   */
  async createTouristSkiFacility(
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
        slopeType,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      const touristSkiFacilityData = {
        name,
        description,
        slopeType,
        location,
        link,
        videoUrl,
        order,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const touristSkiFacility = await this.touristSkiFacilityService.create(
        touristSkiFacilityData
      )

      return res.status(201).json(touristSkiFacility)
    } catch (error: any) {
      logger.error("Error creating tourist ski facility:", error)

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid TouristSkiFacility data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res
        .status(500)
        .json({ error: "Failed to create tourist ski facility" })
    }
  }

  /**
   * Update a TouristSkiFacility
   */
  async updateTouristSkiFacility(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params
      const {
        name,
        description,
        slopeType,
        location,
        link,
        videoUrl,
        order,
        isActive,
      } = req.body

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const touristSkiFacility = await this.touristSkiFacilityService.update(
        id,
        workspaceId,
        {
          name,
          description,
          slopeType,
          location,
          link,
          videoUrl,
          order,
          isActive,
        }
      )

      return res.json(touristSkiFacility)
    } catch (error: any) {
      logger.error(
        `Error updating tourist ski facility ${req.params.id}:`,
        error
      )

      if (error.message === "TouristSkiFacility not found") {
        return res.status(404).json({ error: "TouristSkiFacility not found" })
      }

      if (error.message === "Invalid TouristSkiFacility data") {
        return res.status(400).json({ error: error.message })
      }

      return res
        .status(500)
        .json({ error: "Failed to update tourist ski facility" })
    }
  }

  /**
   * Delete a TouristSkiFacility
   */
  async deleteTouristSkiFacility(
    req: Request,
    res: Response
  ): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristSkiFacilityService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message === "TouristSkiFacility not found") {
          return res.status(404).json({ error: "TouristSkiFacility not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(
        `Error deleting tourist ski facility ${req.params.id}:`,
        error
      )
      return res
        .status(500)
        .json({ error: "Failed to delete tourist ski facility" })
    }
  }
}
