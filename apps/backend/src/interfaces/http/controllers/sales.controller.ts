import { Request, Response } from "express"
import { SalesService } from "../../../application/services/sales.service"
import logger from "../../../utils/logger"

/**
 * Gets the workspace ID from request parameters or query
 */
const getWorkspaceId = (req: Request): string | undefined => {
  return req.params.workspaceId || (req.query.workspaceId as string)
}

/**
 * SalesController class
 * Handles HTTP requests related to sales
 */
export class SalesController {
  private salesService: SalesService

  constructor() {
    this.salesService = new SalesService()
  }

  /**
   * Get all sales for a workspace
   */
  async getAllSales(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const sales = await this.salesService.getAllForWorkspace(workspaceId)
      return res.json(sales)
    } catch (error) {
      logger.error("Error getting sales:", error)
      return res.status(500).json({ error: "Failed to get sales" })
    }
  }

  /**
   * Get sales by ID
   */
  async getSalesById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const sales = await this.salesService.getById(id, workspaceId)

      if (!sales) {
        return res.status(404).json({ error: "Salesperson not found" })
      }

      return res.json(sales)
    } catch (error) {
      logger.error(`Error getting sales ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to get salesperson" })
    }
  }

  /**
   * Create a new sales
   */
  async createSales(req: Request, res: Response): Promise<Response> {
    try {
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const { firstName, lastName, email, phone, isActive } = req.body
      const salesData = {
        firstName,
        lastName,
        email,
        phone,
        isActive: isActive !== undefined ? isActive : true,
        workspaceId,
      }

      const sales = await this.salesService.create(salesData)
      return res.status(201).json(sales)
    } catch (error) {
      logger.error("Error creating sales:", error)

      if (error.message === "A salesperson with this email already exists") {
        return res.status(409).json({ error: error.message })
      }

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid sales data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create salesperson" })
    }
  }

  /**
   * Update a sales
   */
  async updateSales(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const { firstName, lastName, email, phone, isActive } = req.body

      const sales = await this.salesService.update(id, workspaceId, {
        firstName,
        lastName,
        email,
        phone,
        isActive,
      })

      return res.json(sales)
    } catch (error) {
      logger.error(`Error updating sales ${req.params.id}:`, error)

      if (error.message === "Salesperson not found") {
        return res.status(404).json({ error: "Salesperson not found" })
      }

      if (error.message === "A salesperson with this email already exists") {
        return res.status(409).json({ error: error.message })
      }

      if (
        error.message === "Missing required fields" ||
        error.message === "Invalid sales data"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to update salesperson" })
    }
  }

  /**
   * Delete a sales
   */
  async deleteSales(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        const result = await this.salesService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error) {
        if (error.message === "Salesperson not found") {
          return res.status(404).json({ error: "Salesperson not found" })
        }

        if (
          error.message ===
          "Cannot delete salesperson that is assigned to customers"
        ) {
          return res.status(409).json({ error: error.message })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting sales ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete salesperson" })
    }
  }

  /**
   * Check if a sales has customers
   */
  async hasCustomers(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params
      const workspaceId = getWorkspaceId(req)

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const hasCustomers = await this.salesService.hasCustomers(id, workspaceId)
      return res.json({ hasCustomers })
    } catch (error) {
      logger.error(
        `Error checking customers for sales ${req.params.id}:`,
        error
      )
      return res.status(500).json({ error: "Failed to check sales customers" })
    }
  }
}
