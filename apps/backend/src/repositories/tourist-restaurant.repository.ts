/**
 * TouristRestaurantRepository
 *
 * Repository for managing tourist restaurant recommendations.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristRestaurant } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristRestaurantRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristRestaurant by ID
   * @param id - TouristRestaurant ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristRestaurant or null
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<TouristRestaurant | null> {
    try {
      return await this.prisma.touristRestaurant.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristRestaurant by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristRestaurants for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristRestaurants sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristRestaurant[]> {
    try {
      return await this.prisma.touristRestaurant.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristRestaurants:", error)
      throw error
    }
  }

  /**
   * Create new TouristRestaurant
   * @param data - TouristRestaurant data
   * @returns Created TouristRestaurant
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    cuisineType?: string
    celiacFriendly?: boolean
    needsReservation?: boolean
    location?: string
    phone?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristRestaurant> {
    try {
      const touristRestaurant = await this.prisma.touristRestaurant.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          cuisineType: data.cuisineType,
          celiacFriendly: data.celiacFriendly ?? false,
          needsReservation: data.needsReservation ?? false,
          location: data.location,
          phone: data.phone,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristRestaurant "${touristRestaurant.name}" for workspace ${data.workspaceId}`
      )
      return touristRestaurant
    } catch (error) {
      logger.error("Error creating TouristRestaurant:", error)
      throw error
    }
  }

  /**
   * Update TouristRestaurant
   * @param id - TouristRestaurant ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristRestaurant
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      cuisineType: string
      celiacFriendly: boolean
      needsReservation: boolean
      location: string
      phone: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristRestaurant> {
    try {
      const result = await this.prisma.touristRestaurant.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(
          `TouristRestaurant ${id} not found in workspace ${workspaceId}`
        )
      }

      logger.info(`Updated TouristRestaurant ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristRestaurant ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristRestaurant ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristRestaurant (set isActive = false)
   * @param id - TouristRestaurant ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristRestaurant
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristRestaurant> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristRestaurant ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristRestaurant (alias for softDelete to match interface)
   * @param id - TouristRestaurant ID
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
   * Count active TouristRestaurants for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristRestaurants
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristRestaurant.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristRestaurants:", error)
      throw error
    }
  }
}
