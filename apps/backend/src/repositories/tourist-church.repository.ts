/**
 * TouristChurchRepository
 *
 * Repository for managing tourist churches.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristChurch } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristChurchRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristChurch by ID
   * @param id - TouristChurch ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristChurch or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristChurch | null> {
    try {
      return await this.prisma.touristChurch.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristChurch by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristChurchs for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristChurchs sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristChurch[]> {
    try {
      return await this.prisma.touristChurch.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristChurchs:", error)
      throw error
    }
  }

  /**
   * Create new TouristChurch
   * @param data - TouristChurch data
   * @returns Created TouristChurch
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    century?: string
    style?: string
    location?: string
    phone?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristChurch> {
    try {
      const touristChurch = await this.prisma.touristChurch.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          century: data.century,
          style: data.style,
          location: data.location,
          phone: data.phone,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristChurch "${touristChurch.name}" for workspace ${data.workspaceId}`
      )
      return touristChurch
    } catch (error) {
      logger.error("Error creating TouristChurch:", error)
      throw error
    }
  }

  /**
   * Update TouristChurch
   * @param id - TouristChurch ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristChurch
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      century: string
      style: string
      location: string
      phone: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristChurch> {
    try {
      const result = await this.prisma.touristChurch.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(`TouristChurch ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Updated TouristChurch ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristChurch ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristChurch ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristChurch (set isActive = false)
   * @param id - TouristChurch ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristChurch
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristChurch> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristChurch ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristChurch (alias for softDelete to match interface)
   * @param id - TouristChurch ID
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
   * Count active TouristChurchs for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristChurchs
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristChurch.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristChurchs:", error)
      throw error
    }
  }
}
