import { Response } from "express"
import ServiceService from "../../../application/services/service.service"
import { prisma } from "../../../lib/prisma"
import { cleanupRemovedImages } from "../../../utils/fileManager"
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

      // Price is optional during creation (defaults to 0 if not provided)
      let numericPrice: number = 0
      if (price !== undefined && price !== null) {
        if (typeof price === "string") {
          numericPrice = parseFloat(price)
          if (isNaN(numericPrice)) {
            return res
              .status(400)
              .json({ error: "Price must be a valid number" })
          }
        } else if (typeof price === "number") {
          numericPrice = price
        } else {
          return res.status(400).json({ error: "Price must be a valid number" })
        }
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

      // Convert isActive from string to boolean
      let booleanIsActive = false // Default to false like products
      if (isActive !== undefined) {
        if (typeof isActive === "string") {
          booleanIsActive = isActive === "on" || isActive === "true"
        } else if (typeof isActive === "boolean") {
          booleanIsActive = isActive
        }
      }

      const serviceData: any = {
        name,
        code: code || `SRV${Date.now().toString().slice(-6)}`, // Auto-generate if not provided
        description: description || "",
        price: numericPrice,
        duration: numericDuration,
        currency,
        isActive: booleanIsActive,
        workspaceId,
      }

      // Handle multiple image uploads and existing images
      let allImageUrls: string[] = []

      // Add existing images first (if reordered)
      if (req.body.existingImageUrls) {
        try {
          const existingUrls = JSON.parse(req.body.existingImageUrls)
          if (Array.isArray(existingUrls) && existingUrls.length > 0) {
            allImageUrls = [...existingUrls]
            logger.info(`Existing images:`, existingUrls)
          }
        } catch (error) {
          logger.error("Error parsing existingImageUrls JSON", error)
        }
      }

      // Add new uploaded images
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const newImagePaths = req.files.map(
          (file: any) => `/uploads/services/${file.filename}`
        )
        allImageUrls = [...allImageUrls, ...newImagePaths]
        logger.info(`New images uploaded:`, newImagePaths)
      }

      // Always set imageUrl (even if empty array)
      serviceData.imageUrl = allImageUrls
      logger.info(`Total images for service:`, allImageUrls)

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

      // Convert isActive from string "on"/"off" or boolean to proper boolean
      if (isActive !== undefined) {
        if (typeof isActive === "string") {
          updateData.isActive = isActive === "on" || isActive === "true"
        } else if (typeof isActive === "boolean") {
          updateData.isActive = isActive
        }
      }

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

      // Get old image URLs for cleanup
      const oldImageUrls = Array.isArray(existingService.imageUrl)
        ? existingService.imageUrl
        : []

      // Handle multiple image uploads and existing images for update
      let allImageUrls: string[] = []

      // Add existing images first (if provided)
      if (req.body.existingImageUrls) {
        try {
          const existingUrls = JSON.parse(req.body.existingImageUrls)
          if (Array.isArray(existingUrls) && existingUrls.length > 0) {
            allImageUrls = [...existingUrls]
            logger.info(`Existing images for update:`, existingUrls)
          }
        } catch (error) {
          logger.error("Error parsing existingImageUrls JSON", error)
        }
      }

      // Add new uploaded images
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const newImagePaths = req.files.map(
          (file: any) => `/uploads/services/${file.filename}`
        )
        allImageUrls = [...allImageUrls, ...newImagePaths]
        logger.info(`New images uploaded for update:`, newImagePaths)
      }

      // Always set imageUrl to reflect current state (even if empty)
      updateData.imageUrl = allImageUrls
      logger.info(`Total images for service update:`, allImageUrls)

      // Clean up removed images from filesystem
      const deletedCount = cleanupRemovedImages(oldImageUrls, allImageUrls)
      if (deletedCount > 0) {
        logger.info(
          `Cleaned up ${deletedCount} removed image(s) from filesystem`
        )
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

      // Clean up all service images from filesystem before deleting
      if (
        existingService.imageUrl &&
        Array.isArray(existingService.imageUrl) &&
        existingService.imageUrl.length > 0
      ) {
        const deletedCount = cleanupRemovedImages(existingService.imageUrl, [])
        logger.info(
          `Cleaned up ${deletedCount} image(s) from deleted service ${id}`
        )
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
