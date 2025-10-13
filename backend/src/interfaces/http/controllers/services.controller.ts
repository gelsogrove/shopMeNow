import { Response } from "express"
import ServiceService from "../../../application/services/service.service"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

import { WorkspaceRequest } from "../types/workspace-request"

/**
 * ServicesController class
 * Handles HTTP requests related to services
 */
export class ServicesController {
  private serviceService: typeof ServiceService

  constructor() {
    this.serviceService = ServiceService
  }

  /**
   * Get all services for a workspace
   */
  async getServicesForWorkspace(
    req: WorkspaceRequest,
    res: Response
  ): Promise<Response> {
    try {
      const { workspaceId } = req.workspaceContext

      logger.info(`Getting services for workspace: ${workspaceId}`)
      const services = await this.serviceService.getAllForWorkspace(workspaceId)
      return res.json(services)
    } catch (error) {
      logger.error("Error getting services:", error)
      return res.status(500).json({ error: "Failed to get services" })
    }
  }

  /**
   * Get service by ID
   */
  async getServiceById(
    req: WorkspaceRequest,
    res: Response
  ): Promise<Response> {
    try {
      const { id } = req.params
      const { workspaceId } = req.workspaceContext

      const service = await this.serviceService.getById(id, workspaceId)

      if (!service) {
        return res.status(404).json({ error: "Service not found" })
      }

      return res.json(service)
    } catch (error) {
      logger.error(`Error getting service ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get service" })
    }
  }

  /**
   * Create a new service
   */
  async createService(req: WorkspaceRequest, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.workspaceContext

      const {
        name,
        code,
        description = "",
        price,
        currency = "EUR",
        duration,
        isActive,
      } = req.body

      // Validate required fields
      if (!name) {
        return res.status(400).json({ error: "Name is required" })
      }

      if (!code) {
        return res.status(400).json({ error: "Code is required" })
      }

      // Check workspace exists
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      })

      if (!workspace) {
        return res.status(404).json({
          error: "Workspace not found",
        })
      }

      // Make sure price is a number
      let numericPrice: number
      if (price === undefined || price === null) {
        return res.status(400).json({ error: "Price is required" })
      } else if (typeof price === "string") {
        numericPrice = parseFloat(price)
        if (isNaN(numericPrice)) {
          return res.status(400).json({ error: "Price must be a valid number" })
        }
      } else if (typeof price === "number") {
        numericPrice = price
      } else {
        return res
          .status(400)
          .json({ error: "Price is required and must be a valid number" })
      }

      // Parse duration if provided, or use default
      let numericDuration: number = 60 // Default duration
      if (duration !== undefined && duration !== null) {
        if (typeof duration === "string") {
          numericDuration = parseInt(duration, 10)
          if (isNaN(numericDuration)) {
            return res
              .status(400)
              .json({ error: "Duration must be a valid number" })
          }
        } else if (typeof duration === "number") {
          numericDuration = duration
        } else {
          return res
            .status(400)
            .json({ error: "Duration must be a valid number" })
        }
      }

      const serviceData = {
        name,
        code,
        description,
        price: numericPrice,
        duration: numericDuration,
        currency,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      logger.info(`Creating service for workspace: ${workspaceId}`)
      const service = await this.serviceService.create(serviceData)

      return res.status(201).json(service)
    } catch (error: any) {
      logger.error("Error creating service:", error)

      if (error.message === "Invalid service data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create service" })
    }
  }

  /**
   * Update a service
   */
  async updateService(req: WorkspaceRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const { workspaceId } = req.workspaceContext

      // Verify service belongs to the workspace
      const existingService = await this.serviceService.getById(id, workspaceId)
      if (!existingService) {
        return res
          .status(404)
          .json({ error: "Service not found in specified workspace" })
      }

      const { name, code, description, price, currency, duration, isActive } =
        req.body

      // Process numeric fields and validate data
      const updateData: any = {}

      // Add fields only if they are provided to avoid null overwrites
      if (name !== undefined) updateData.name = name
      if (code !== undefined) updateData.code = code
      if (description !== undefined) updateData.description = description
      if (currency !== undefined) updateData.currency = currency
      if (isActive !== undefined) updateData.isActive = isActive

      // Handle price conversion properly
      if (price !== undefined) {
        if (typeof price === "string") {
          const numericPrice = parseFloat(price)
          if (isNaN(numericPrice)) {
            return res
              .status(400)
              .json({ error: "Price must be a valid number" })
          }
          updateData.price = numericPrice
        } else if (typeof price === "number") {
          updateData.price = price
        } else {
          return res.status(400).json({ error: "Price must be a valid number" })
        }
      }

      // Handle duration conversion properly
      if (duration !== undefined) {
        if (typeof duration === "string") {
          const numericDuration = parseInt(duration, 10)
          if (isNaN(numericDuration)) {
            return res
              .status(400)
              .json({ error: "Duration must be a valid integer" })
          }
          updateData.duration = numericDuration
        } else if (typeof duration === "number") {
          updateData.duration = Math.floor(duration) // Ensure it's an integer
        } else if (duration !== null) {
          return res
            .status(400)
            .json({ error: "Duration must be a valid integer" })
        }
      }

      // Basic validation checks
      if (Object.keys(updateData).length === 0) {
        return res
          .status(400)
          .json({ error: "No valid fields provided for update" })
      }

      const service = await this.serviceService.update(
        id,
        workspaceId,
        updateData
      )

      return res.json(service)
    } catch (error: any) {
      logger.error(`Error updating service ${req.params.id}:`, error)

      if (error.message === "Service not found") {
        return res.status(404).json({ error: "Service not found" })
      }

      if (error.message === "Invalid service data") {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update service" })
    }
  }

  /**
   * Hard delete a service
   */
  async deleteService(req: WorkspaceRequest, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const { workspaceId } = req.workspaceContext

      // Verify service belongs to the workspace
      const existingService = await this.serviceService.getById(id, workspaceId)
      if (!existingService) {
        return res
          .status(404)
          .json({ error: "Service not found in specified workspace" })
      }

      await this.serviceService.delete(id, workspaceId)

      return res.status(204).send()
    } catch (error: any) {
      logger.error(`Error deleting service ${req.params.id}:`, error)

      if (error.message === "Service not found") {
        return res.status(404).json({ error: "Service not found" })
      }

      return res.status(500).json({ error: "Failed to delete service" })
    }
  }
}
