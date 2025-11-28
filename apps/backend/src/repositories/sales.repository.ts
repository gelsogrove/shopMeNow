import { Sales } from "../domain/entities/sales.entity"
import { ISalesRepository } from "../domain/repositories/sales.repository.interface"
import { prisma } from "../lib/prisma"
import logger from "../utils/logger"

/**
 * Implementation of Sales Repository using Prisma
 */
export class SalesRepository implements ISalesRepository {
  /**
   * Find all sales in a workspace
   */
  async findAll(workspaceId: string): Promise<Sales[]> {
    try {
      const sales = await prisma.sales.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          firstName: "asc",
        },
      })

      return sales ? sales.map((sale) => new Sales(sale)) : []
    } catch (error) {
      logger.error("Error finding sales:", error)
      return []
    }
  }

  /**
   * Find a single sales by ID and workspace
   */
  async findById(id: string, workspaceId: string): Promise<Sales | null> {
    try {
      const sales = await prisma.sales.findFirst({
        where: {
          id,
          workspaceId,
        },
      })

      return sales ? new Sales(sales) : null
    } catch (error) {
      logger.error(`Error finding sales ${id}:`, error)
      return null
    }
  }

  /**
   * Find a sales by email within a workspace
   */
  async findByEmail(email: string, workspaceId: string): Promise<Sales | null> {
    try {
      const sales = await prisma.sales.findFirst({
        where: {
          email,
          workspaceId,
        },
      })

      return sales ? new Sales(sales) : null
    } catch (error) {
      logger.error(`Error finding sales by email ${email}:`, error)
      return null
    }
  }

  /**
   * Create a new sales
   */
  async create(data: Partial<Sales>): Promise<Sales> {
    try {
      const sales = await prisma.sales.create({
        data: data as any,
      })

      return new Sales(sales)
    } catch (error) {
      logger.error("Error creating sales:", error)
      throw error
    }
  }

  /**
   * Update an existing sales
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<Sales>
  ): Promise<Sales | null> {
    try {
      await prisma.sales.updateMany({
        where: {
          id,
          workspaceId,
        },
        data: data as any,
      })

      // Get updated sales
      return this.findById(id, workspaceId)
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
      const result = await prisma.sales.deleteMany({
        where: {
          id,
          workspaceId,
        },
      })

      return result && result.count > 0
    } catch (error) {
      logger.error(`Error deleting sales ${id}:`, error)
      return false
    }
  }

  /**
   * Check if a sales has associated customers
   */
  async hasCustomers(id: string, workspaceId: string): Promise<boolean> {
    try {
      const customers = await prisma.customers.findMany({
        where: {
          salesId: id,
          workspaceId,
        },
        take: 1,
      })

      return customers.length > 0
    } catch (error) {
      logger.error(`Error checking customers for sales ${id}:`, error)
      return false
    }
  }
}
