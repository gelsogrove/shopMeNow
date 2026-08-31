/**
 * TouristApartmentRepository
 *
 * Repository for managing vacation house/apartment recommendations.
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristApartment } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristApartmentRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find TouristApartment by ID
   * @param id - TouristApartment ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns TouristApartment or null
   */
  async findById(id: string, workspaceId: string): Promise<TouristApartment | null> {
    try {
      return await this.prisma.touristApartment.findFirst({
        where: {
          id,
          workspaceId,
        },
      })
    } catch (error) {
      logger.error(`Error finding TouristApartment by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Find all active TouristApartments for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Array of active TouristApartments sorted by order
   */
  async findAll(workspaceId: string): Promise<TouristApartment[]> {
    try {
      return await this.prisma.touristApartment.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error("Error finding all TouristApartments:", error)
      throw error
    }
  }

  /**
   * Create new TouristApartment
   * @param data - TouristApartment data
   * @returns Created TouristApartment
   */
  async create(data: {
    workspaceId: string
    name: string
    description?: string
    category?: string
    location?: string
    streetNumber?: string
    phone?: string
    mobile?: string
    email?: string
    rooms?: number
    beds?: number
    bathrooms?: number
    link?: string
    videoUrl?: string
    order?: number
    isActive?: boolean
  }): Promise<TouristApartment> {
    try {
      const touristApartment = await this.prisma.touristApartment.create({
        data: {
          workspaceId: data.workspaceId,
          name: data.name,
          description: data.description,
          category: data.category,
          location: data.location,
          streetNumber: data.streetNumber,
          phone: data.phone,
          mobile: data.mobile,
          email: data.email,
          rooms: data.rooms,
          beds: data.beds,
          bathrooms: data.bathrooms,
          link: data.link,
          videoUrl: data.videoUrl,
          order: data.order ?? 999,
          isActive: data.isActive ?? true,
        },
      })

      logger.info(
        `Created TouristApartment "${touristApartment.name}" for workspace ${data.workspaceId}`
      )
      return touristApartment
    } catch (error) {
      logger.error("Error creating TouristApartment:", error)
      throw error
    }
  }

  /**
   * Update TouristApartment
   * @param id - TouristApartment ID
   * @param workspaceId - Workspace ID (security filter)
   * @param data - Updated fields
   * @returns Updated TouristApartment
   */
  async update(
    id: string,
    workspaceId: string,
    data: Partial<{
      name: string
      description: string
      category: string
      location: string
      streetNumber: string
      phone: string
      mobile: string
      email: string
      rooms: number
      beds: number
      bathrooms: number
      link: string
      videoUrl: string
      order: number
      isActive: boolean
    }>
  ): Promise<TouristApartment> {
    try {
      const result = await this.prisma.touristApartment.updateMany({
        where: {
          id,
          workspaceId,
        },
        data,
      })

      if (result.count === 0) {
        throw new Error(
          `TouristApartment ${id} not found in workspace ${workspaceId}`
        )
      }

      logger.info(`Updated TouristApartment ${id} for workspace ${workspaceId}`)

      const updated = await this.findById(id, workspaceId)
      if (!updated) {
        throw new Error(`Failed to retrieve updated TouristApartment ${id}`)
      }

      return updated
    } catch (error) {
      logger.error(`Error updating TouristApartment ${id}:`, error)
      throw error
    }
  }

  /**
   * Soft delete TouristApartment (set isActive = false)
   * @param id - TouristApartment ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns Deleted TouristApartment
   */
  async softDelete(id: string, workspaceId: string): Promise<TouristApartment> {
    try {
      return await this.update(id, workspaceId, { isActive: false })
    } catch (error) {
      logger.error(`Error soft deleting TouristApartment ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete TouristApartment (alias for softDelete to match interface)
   * @param id - TouristApartment ID
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
   * Count active TouristApartments for a workspace
   * @param workspaceId - Workspace ID (security filter)
   * @returns Number of active TouristApartments
   */
  async countActive(workspaceId: string): Promise<number> {
    try {
      return await this.prisma.touristApartment.count({
        where: {
          workspaceId,
          isActive: true,
        },
      })
    } catch (error) {
      logger.error("Error counting active TouristApartments:", error)
      throw error
    }
  }
}
