/**
 * TouristVenueRepository
 *
 * Repository for managing tourist venues.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristVenue } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristVenueRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristVenue by ID
   * @param id - TouristVenue ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristVenue or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristVenue | null> {
    try {
      return await this.prisma.touristVenue.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristVenue by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristVenues for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristVenues sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristVenue[]> {
    try {
      return await this.prisma.touristVenue.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristVenues:", error)
      throw error
    }
  }

  /**
   * Create new TouristVenue
   * @param data - TouristVenue data
   * @returns Created TouristVenue
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    venueType?: string
    openingHours?: string
    location?: string
    phone?: string
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristVenue> {
    try {
      const touristVenue = await this.prisma.touristVenue.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          venueType: data.venueType,
          openingHours: data.openingHours,
          location: data.location,
          phone: data.phone,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristVenue "${touristVenue.name}" for workspace ${data.workspaceId}`
      )
      return touristVenue
    } catch (error) {
      logger.error("Error creating TouristVenue:", error)
      throw error
    }
  }

  /**
   * Update TouristVenue
   * @param id - TouristVenue ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristVenue
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      venueType: string
      openingHours: string
      location: string
      phone: string
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristVenue> {
    try {
      const result = await this.prisma.touristVenue.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(`TouristVenue ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Updated TouristVenue ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristVenue ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristVenue ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristVenue (set isActive = false)
   * @param id - TouristVenue ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristVenue
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristVenue> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristVenue ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristVenue (alias for softDelete to match interface)
   * @param id - TouristVenue ID
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
   * Count active TouristVenues for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristVenues
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristVenue.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristVenues:", error)
      throw error
    }
  }
}
