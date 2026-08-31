/**
 * TouristHotelRepository
 *
 * Repository for managing tourist hotel recommendations.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristHotel } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristHotelRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristHotel by ID
   * @param id - TouristHotel ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristHotel or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristHotel | null> {
    try {
      return await this.prisma.touristHotel.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristHotel by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristHotels for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristHotels sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristHotel[]> {
    try {
      return await this.prisma.touristHotel.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristHotels:", error)
      throw error
    }
  }

  /**
   * Create new TouristHotel
   * @param data - TouristHotel data
   * @returns Created TouristHotel
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    stars?: number
    location?: string
    phone?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristHotel> {
    try {
      const touristHotel = await this.prisma.touristHotel.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          stars: data.stars,
          location: data.location,
          phone: data.phone,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristHotel "${touristHotel.name}" for workspace ${data.workspaceId}`
      )
      return touristHotel
    } catch (error) {
      logger.error("Error creating TouristHotel:", error)
      throw error
    }
  }

  /**
   * Update TouristHotel
   * @param id - TouristHotel ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristHotel
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      stars: number
      location: string
      phone: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristHotel> {
    try {
      const result = await this.prisma.touristHotel.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(
          `TouristHotel ${id} not found in workspace ${workspaceId}`
        )
      }

      logger.info(`Updated TouristHotel ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristHotel ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristHotel ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristHotel (set isActive = false)
   * @param id - TouristHotel ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristHotel
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristHotel> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristHotel ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristHotel (alias for softDelete to match interface)
   * @param id - TouristHotel ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns true if deleted successfully
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      await this.softDelete(id, workspaceId)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Count active TouristHotels for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristHotels
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristHotel.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristHotels:", error)
      throw error
    }
  }
}
