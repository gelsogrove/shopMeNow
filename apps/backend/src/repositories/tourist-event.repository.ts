/**
 * TouristEventRepository
 *
 * Repository for managing tourist event recommendations.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristEvent } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristEventRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristEvent by ID
   * @param id - TouristEvent ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristEvent or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristEvent | null> {
    try {
      return await this.prisma.touristEvent.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristEvent by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristEvents for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristEvents sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristEvent[]> {
    try {
      return await this.prisma.touristEvent.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristEvents:", error)
      throw error
    }
  }

  /**
   * Create new TouristEvent
   * @param data - TouristEvent data
   * @returns Created TouristEvent
   */
  async create(data: {
    workspaceId: string
    title: string
    description?: string
    location?: string
    startDate?: Date | string
    endDate?: Date | string
    price?: string
    ticketInfo?: string
    link?: string
    ticketLink?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristEvent> {
    try {
      const touristEvent = await this.prisma.touristEvent.create({
        data: {
          workspaceId: data.workspaceId,
          title: data.title,
          description: data.description,
          location: data.location,
          startDate: data.startDate,
          endDate: data.endDate,
          price: data.price,
          ticketInfo: data.ticketInfo,
          link: data.link,
          ticketLink: data.ticketLink,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristEvent "${touristEvent.title}" for workspace ${data.workspaceId}`
      )
      return touristEvent
    } catch (error) {
      logger.error("Error creating TouristEvent:", error)
      throw error
    }
  }

  /**
   * Update TouristEvent
   * @param id - TouristEvent ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristEvent
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      title: string
      description: string
      location: string
      startDate: Date | string
      endDate: Date | string
      price: string
      ticketInfo: string
      link: string
      ticketLink: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristEvent> {
    try {
      const result = await this.prisma.touristEvent.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(`TouristEvent ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Updated TouristEvent ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristEvent ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristEvent ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristEvent (set isActive = false)
   * @param id - TouristEvent ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristEvent
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristEvent> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristEvent ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristEvent (alias for softDelete to match interface)
   * @param id - TouristEvent ID
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
   * Count active TouristEvents for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristEvents
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristEvent.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristEvents:", error)
      throw error
    }
  }
}
