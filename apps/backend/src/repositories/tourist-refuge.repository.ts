/**
 * TouristRefugeRepository
 *
 * Repository for managing tourist mountain refuge recommendations.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristRefuge } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristRefugeRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristRefuge by ID
   * @param id - TouristRefuge ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristRefuge or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristRefuge | null> {
    try {
      return await this.prisma.touristRefuge.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristRefuge by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristRefuges for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristRefuges sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristRefuge[]> {
    try {
      return await this.prisma.touristRefuge.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristRefuges:", error)
      throw error
    }
  }

  /**
   * Create new TouristRefuge
   * @param data - TouristRefuge data
   * @returns Created TouristRefuge
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    climbTime?: string
    difficulty?: string
    openFrom?: string
    openTo?: string
    location?: string
    phone?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristRefuge> {
    try {
      const touristRefuge = await this.prisma.touristRefuge.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          climbTime: data.climbTime,
          difficulty: data.difficulty,
          openFrom: data.openFrom,
          openTo: data.openTo,
          location: data.location,
          phone: data.phone,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristRefuge "${touristRefuge.name}" for workspace ${data.workspaceId}`
      )
      return touristRefuge
    } catch (error) {
      logger.error("Error creating TouristRefuge:", error)
      throw error
    }
  }

  /**
   * Update TouristRefuge
   * @param id - TouristRefuge ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristRefuge
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      climbTime: string
      difficulty: string
      openFrom: string
      openTo: string
      location: string
      phone: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristRefuge> {
    try {
      const result = await this.prisma.touristRefuge.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(
          `TouristRefuge ${id} not found in workspace ${workspaceId}`
        )
      }

      logger.info(`Updated TouristRefuge ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristRefuge ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristRefuge ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristRefuge (set isActive = false)
   * @param id - TouristRefuge ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristRefuge
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristRefuge> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristRefuge ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristRefuge (alias for softDelete to match interface)
   * @param id - TouristRefuge ID
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
   * Count active TouristRefuges for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristRefuges
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristRefuge.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristRefuges:", error)
      throw error
    }
  }
}
