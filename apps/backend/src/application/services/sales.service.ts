import { Sales } from "../../domain/entities/sales.entity"
import { ISalesRepository } from "../../domain/repositories/sales.repository.interface"
import { SalesRepository } from "../../repositories/sales.repository"
import logger from "../../utils/logger"

/**
 * Service layer for Sales
 * Handles business logic for sales
 */
export class SalesService {
  private salesRepository: ISalesRepository

  constructor() {
    this.salesRepository = new SalesRepository()
  }

  /**
   * Get all sales for a workspace
   */
  async getAllForWorkspace(workspaceId: string): Promise<Sales[]> {
    try {
      return await this.salesRepository.findAll(workspaceId)
    } catch (error) {
      logger.error("Error getting all sales:", error)
      throw error
    }
  }

  /**
   * Get sales by ID
   */
  async getById(id: string, workspaceId: string): Promise<Sales | null> {
    try {
      return await this.salesRepository.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error getting sales ${id}:`, error)
      throw error
    }
  }

  /**
   * Create a new sales
   */
  async create(data: Partial<Sales>): Promise<Sales> {
    try {
      // Validate required fields
      if (
        !data.firstName ||
        !data.lastName ||
        !data.email ||
        !data.workspaceId
      ) {
        throw new Error("Missing required fields")
      }

      // Create a sales entity for validation
      const salesToCreate = new Sales(data)

      // Validate the sales
      if (!salesToCreate.validate()) {
        throw new Error("Invalid sales data")
      }

      // Check if a sales with the same email already exists
      const existingSales = await this.salesRepository.findByEmail(
        salesToCreate.email,
        salesToCreate.workspaceId
      )

      if (existingSales) {
        throw new Error("A salesperson with this email already exists")
      }

      // Create the sales
      return await this.salesRepository.create(salesToCreate)
    } catch (error) {
      logger.error("Error creating sales:", error)
      throw error
    }
  }

  /**
   * Update a sales
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<Sales>
  ): Promise<Sales | null> {
    try {
      // Check if sales exists
      const existingSales = await this.salesRepository.findById(id, workspaceId)
      if (!existingSales) {
        throw new Error("Salesperson not found")
      }

      // Create merged sales for validation
      const salesToUpdate = new Sales({
        ...existingSales,
        ...data,
      })

      // If email is changed, check if it's unique
      if (data.email && data.email !== existingSales.email) {
        const salesWithEmail = await this.salesRepository.findByEmail(
          data.email,
          workspaceId
        )
        if (salesWithEmail && salesWithEmail.id !== id) {
          throw new Error("A salesperson with this email already exists")
        }
      }

      // Update the sales
      return await this.salesRepository.update(id, workspaceId, salesToUpdate)
    } catch (error) {
      logger.error(`Error updating sales ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete a sales
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      // Check if sales exists
      const sales = await this.salesRepository.findById(id, workspaceId)
      if (!sales) {
        throw new Error("Salesperson not found")
      }

      // Check if sales has customers
      const hasCustomers = await this.salesRepository.hasCustomers(
        id,
        workspaceId
      )
      if (hasCustomers) {
        throw new Error(
          "Cannot delete salesperson that is assigned to customers"
        )
      }

      // Delete the sales
      return await this.salesRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting sales ${id}:`, error)
      throw error
    }
  }

  /**
   * Check if a sales has customers
   */
  async hasCustomers(id: string, workspaceId: string): Promise<boolean> {
    try {
      return await this.salesRepository.hasCustomers(id, workspaceId)
    } catch (error) {
      logger.error(`Error checking if sales ${id} has customers:`, error)
      throw error
    }
  }
}
