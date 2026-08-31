/**
 * TouristSkiFacilityRepository
 *
 * Repository for managing tourist ski facilities / slopes.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristSkiFacility } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristSkiFacilityRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristSkiFacility by ID
   * @param id - TouristSkiFacility ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristSkiFacility or null
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<TouristSkiFacility | null> {
    try {
      return await this.prisma.touristSkiFacility.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristSkiFacility by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristSkiFacilities for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristSkiFacilities sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristSkiFacility[]> {
    try {
      return await this.prisma.touristSkiFacility.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristSkiFacilities:", error)
      throw error
    }
  }

  /**
   * Create new TouristSkiFacility
   * @param data - TouristSkiFacility data
   * @returns Created TouristSkiFacility
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    slopeType?: string
    location?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristSkiFacility> {
    try {
      const touristSkiFacility = await this.prisma.touristSkiFacility.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          slopeType: data.slopeType,
          location: data.location,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristSkiFacility "${touristSkiFacility.name}" for workspace ${data.workspaceId}`
      )
      return touristSkiFacility
    } catch (error) {
      logger.error("Error creating TouristSkiFacility:", error)
      throw error
    }
  }

  /**
   * Update TouristSkiFacility
   * @param id - TouristSkiFacility ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristSkiFacility
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      slopeType: string
      location: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristSkiFacility> {
    try {
      const result = await this.prisma.touristSkiFacility.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(
          `TouristSkiFacility ${id} not found in workspace ${workspaceId}`
        )
      }

      logger.info(`Updated TouristSkiFacility ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristSkiFacility ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristSkiFacility ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristSkiFacility (set isActive = false)
   * @param id - TouristSkiFacility ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristSkiFacility
   */
  async softDelete(
    id: string,
    workspaceId: string
  ): Promise<TouristSkiFacility> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristSkiFacility ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristSkiFacility (alias for softDelete to match interface)
   * @param id - TouristSkiFacility ID
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
   * Count active TouristSkiFacilities for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristSkiFacilities
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristSkiFacility.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristSkiFacilities:", error)
      throw error
    }
  }
}
