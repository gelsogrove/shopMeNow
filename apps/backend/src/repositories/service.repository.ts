import { Service } from "../domain/entities/service.entity"
import { IServiceRepository } from "../domain/repositories/service.repository.interface"
import { prisma } from "../lib/prisma"
import logger from "../utils/logger"

/**
 * Implementation of Service Repository using Prisma
 */
export class ServiceRepository implements IServiceRepository {
  /**
   * Find all services in a workspace
   */
  async findAll(workspaceId: string): Promise<Service[]> {
    try {
      const services = await prisma.services.findMany({
        where: { workspaceId },
        orderBy: {
          name: "asc",
        },
      })

      return services ? services.map((service) => new Service(service)) : []
    } catch (error) {
      logger.error("Error finding services:", error)
      return []
    }
  }

  /**
   * Find a single service by ID and workspace
   */
  async findById(id: string, workspaceId: string): Promise<Service | null> {
    try {
      const service = await prisma.services.findFirst({
        where: {
          id,
          workspaceId,
        },
      })

      return service ? new Service(service) : null
    } catch (error) {
      logger.error(`Error finding service ${id}:`, error)
      return null
    }
  }

  /**
   * Find services by IDs and workspace
   */
  async findByIds(ids: string[], workspaceId: string): Promise<Service[]> {
    try {
      const services = await prisma.services.findMany({
        where: {
          id: {
            in: ids,
          },
          workspaceId,
        },
      })

      return services ? services.map((service) => new Service(service)) : []
    } catch (error) {
      logger.error(`Error finding services by ids:`, error)
      return []
    }
  }

  /**
   * Find service by service code (e.g., "SRV-001", "GFT001")
   */
  async findByServiceCode(
    code: string,
    workspaceId: string
  ): Promise<Service | null> {
    try {
      logger.info("🔍 findByServiceCode called:", { code, workspaceId })
      
      const service = await prisma.services.findFirst({
        where: {
          code,
          workspaceId,
        },
      })

      logger.info("🔍 findByServiceCode result:", { 
        found: !!service, 
        serviceName: service?.name,
        serviceCode: service?.code 
      })

      return service ? new Service(service) : null
    } catch (error) {
      logger.error(`Error finding service by code ${code}:`, error)
      return null
    }
  }

  /**
   * Create a new service
   */
  async create(data: Partial<Service>): Promise<Service> {
    try {
      const service = await prisma.services.create({
        data: data as any,
      })

      return new Service(service)
    } catch (error) {
      logger.error("Error creating service:", error)
      throw error
    }
  }

  /**
   * Update an existing service
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<Service>
  ): Promise<Service | null> {
    try {
      await prisma.services.updateMany({
        where: {
          id,
          workspaceId,
        },
        data: data as any,
      })

      // Get updated service
      return this.findById(id, workspaceId)
    } catch (error) {
      logger.error(`Error updating service ${id}:`, error)
      return null
    }
  }

  /**
   * Hard delete a service
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await prisma.services.deleteMany({
        where: {
          id,
          workspaceId,
        },
      })

      return result.count > 0
    } catch (error) {
      logger.error(`Error deleting service ${id}:`, error)
      return false
    }
  }
}
