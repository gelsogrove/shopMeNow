/**
 * TouristSportsFacilityRepository
 *
 * Repository for managing tourist sports facilities (e.g. golf, tennis).
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristSportsFacility } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristSportsFacilityRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristSportsFacility by ID
   * @param id - TouristSportsFacility ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristSportsFacility or null
   */
  async findById(
    id: string,
    workspaceId: string
  ): Promise<TouristSportsFacility | null> {
    try {
      return await this.prisma.touristSportsFacility.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristSportsFacility by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristSportsFacilities for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristSportsFacilities sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristSportsFacility[]> {
    try {
      return await this.prisma.touristSportsFacility.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristSportsFacilities:", error)
      throw error
    }
  }

  /**
   * Create new TouristSportsFacility
   * @param data - TouristSportsFacility data
   * @returns Created TouristSportsFacility
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    sport?: string
    location?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristSportsFacility> {
    try {
      const touristSportsFacility = await this.prisma.touristSportsFacility.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          sport: data.sport,
          location: data.location,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristSportsFacility "${touristSportsFacility.name}" for workspace ${data.workspaceId}`
      )
      return touristSportsFacility
    } catch (error) {
      logger.error("Error creating TouristSportsFacility:", error)
      throw error
    }
  }

  /**
   * Update TouristSportsFacility
   * @param id - TouristSportsFacility ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristSportsFacility
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      sport: string
      location: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristSportsFacility> {
    try {
      const result = await this.prisma.touristSportsFacility.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(
          `TouristSportsFacility ${id} not found in workspace ${workspaceId}`
        )
      }

      logger.info(`Updated TouristSportsFacility ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristSportsFacility ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristSportsFacility ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristSportsFacility (set isActive = false)
   * @param id - TouristSportsFacility ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristSportsFacility
   */
  async softDelete(
    id: string,
    workspaceId: string
  ): Promise<TouristSportsFacility> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristSportsFacility ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristSportsFacility (alias for softDelete to match interface)
   * @param id - TouristSportsFacility ID
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
   * Count active TouristSportsFacilities for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristSportsFacilities
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristSportsFacility.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristSportsFacilities:", error)
      throw error
    }
  }
}
