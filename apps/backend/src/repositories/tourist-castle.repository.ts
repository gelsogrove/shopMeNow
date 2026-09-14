/**
 * TouristCastleRepository
 *
 * Repository for managing tourist castles.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristCastle } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristCastleRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristCastle by ID
   * @param id - TouristCastle ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristCastle or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristCastle | null> {
    try {
      return await this.prisma.touristCastle.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristCastle by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristCastles for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristCastles sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristCastle[]> {
    try {
      return await this.prisma.touristCastle.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristCastles:", error)
      throw error
    }
  }

  /**
   * Create new TouristCastle
   * @param data - TouristCastle data
   * @returns Created TouristCastle
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    century?: string
    visitInfo?: string
    location?: string
    phone?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristCastle> {
    try {
      const touristCastle = await this.prisma.touristCastle.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          century: data.century,
          visitInfo: data.visitInfo,
          location: data.location,
          phone: data.phone,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristCastle "${touristCastle.name}" for workspace ${data.workspaceId}`
      )
      return touristCastle
    } catch (error) {
      logger.error("Error creating TouristCastle:", error)
      throw error
    }
  }

  /**
   * Update TouristCastle
   * @param id - TouristCastle ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristCastle
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      century: string
      visitInfo: string
      location: string
      phone: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristCastle> {
    try {
      const result = await this.prisma.touristCastle.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(`TouristCastle ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Updated TouristCastle ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristCastle ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristCastle ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristCastle (set isActive = false)
   * @param id - TouristCastle ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristCastle
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristCastle> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristCastle ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristCastle (alias for softDelete to match interface)
   * @param id - TouristCastle ID
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
   * Count active TouristCastles for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristCastles
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristCastle.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristCastles:", error)
      throw error
    }
  }
}
