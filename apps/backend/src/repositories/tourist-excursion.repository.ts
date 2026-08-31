/**
 * TouristExcursionRepository
 *
 * Repository for managing tourist excursion recommendations.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristExcursion } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristExcursionRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristExcursion by ID
   * @param id - TouristExcursion ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristExcursion or null
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<TouristExcursion | null> {
    try {
      return await this.prisma.touristExcursion.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristExcursion by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristExcursions for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristExcursions sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristExcursion[]> {
    try {
      return await this.prisma.touristExcursion.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristExcursions:", error)
      throw error
    }
  }

  /**
   * Create new TouristExcursion
   * @param data - TouristExcursion data
   * @returns Created TouristExcursion
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    difficulty?: string
    duration?: string
    season?: string
    location?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristExcursion> {
    try {
      const touristExcursion = await this.prisma.touristExcursion.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          difficulty: data.difficulty,
          duration: data.duration,
          season: data.season,
          location: data.location,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristExcursion "${touristExcursion.name}" for workspace ${data.workspaceId}`
      )
      return touristExcursion
    } catch (error) {
      logger.error("Error creating TouristExcursion:", error)
      throw error
    }
  }

  /**
   * Update TouristExcursion
   * @param id - TouristExcursion ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristExcursion
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      difficulty: string
      duration: string
      season: string
      location: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristExcursion> {
    try {
      const result = await this.prisma.touristExcursion.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(
          `TouristExcursion ${id} not found in workspace ${workspaceId}`
        )
      }

      logger.info(`Updated TouristExcursion ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristExcursion ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristExcursion ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristExcursion (set isActive = false)
   * @param id - TouristExcursion ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristExcursion
   */
  async softDelete(
    id: string,
    workspaceId: string
  ): Promise<TouristExcursion> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristExcursion ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristExcursion (alias for softDelete to match interface)
   * @param id - TouristExcursion ID
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
   * Count active TouristExcursions for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristExcursions
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristExcursion.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristExcursions:", error)
      throw error
    }
  }
}
