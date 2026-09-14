/**
 * TouristViewpointRepository
 *
 * Repository for managing tourist viewpoints.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristViewpoint } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristViewpointRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristViewpoint by ID
   * @param id - TouristViewpoint ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristViewpoint or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristViewpoint | null> {
    try {
      return await this.prisma.touristViewpoint.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristViewpoint by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristViewpoints for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristViewpoints sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristViewpoint[]> {
    try {
      return await this.prisma.touristViewpoint.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristViewpoints:", error)
      throw error
    }
  }

  /**
   * Create new TouristViewpoint
   * @param data - TouristViewpoint data
   * @returns Created TouristViewpoint
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    altitude?: number
    access?: string
    difficulty?: string
    location?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristViewpoint> {
    try {
      const touristViewpoint = await this.prisma.touristViewpoint.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          altitude: data.altitude,
          access: data.access,
          difficulty: data.difficulty,
          location: data.location,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristViewpoint "${touristViewpoint.name}" for workspace ${data.workspaceId}`
      )
      return touristViewpoint
    } catch (error) {
      logger.error("Error creating TouristViewpoint:", error)
      throw error
    }
  }

  /**
   * Update TouristViewpoint
   * @param id - TouristViewpoint ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristViewpoint
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      altitude: number
      access: string
      difficulty: string
      location: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristViewpoint> {
    try {
      const result = await this.prisma.touristViewpoint.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(`TouristViewpoint ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Updated TouristViewpoint ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristViewpoint ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristViewpoint ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristViewpoint (set isActive = false)
   * @param id - TouristViewpoint ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristViewpoint
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristViewpoint> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristViewpoint ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristViewpoint (alias for softDelete to match interface)
   * @param id - TouristViewpoint ID
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
   * Count active TouristViewpoints for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristViewpoints
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristViewpoint.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristViewpoints:", error)
      throw error
    }
  }
}
