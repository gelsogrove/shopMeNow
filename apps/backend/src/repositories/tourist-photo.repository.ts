/**
 * TouristPhotoRepository
 *
 * Repository for managing the polymorphic photo gallery shared by all 5
 * PRO_LOCO tourist content types (Restaurant, Hotel, Excursion, Refuge, Event).
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */

import { PrismaClient, TouristPhoto, TouristContentType } from "@echatbot/database"
import logger from "../utils/logger"

export class TouristPhotoRepository {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Find all photos for a given content item, ordered by `order` asc
   * @param workspaceId - Workspace ID (security filter)
   * @param contentType - Tourist content type (RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT)
   * @param contentId - ID of the owning content row
   * @returns Array of TouristPhoto sorted by order
   */
  async findByContent(
    workspaceId: string,
    contentType: TouristContentType,
    contentId: string
  ): Promise<TouristPhoto[]> {
    try {
      return await this.prisma.touristPhoto.findMany({
        where: {
          workspaceId,
          contentType,
          contentId,
        },
        orderBy: {
          order: "asc",
        },
      })
    } catch (error) {
      logger.error(
        `Error finding TouristPhotos for ${contentType}/${contentId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Create a new TouristPhoto
   * @param data - TouristPhoto data
   * @returns Created TouristPhoto
   */
  async create(data: {
    workspaceId: string
    contentType: TouristContentType
    contentId: string
    imageBase64: string
    caption?: string
    order?: number
  }): Promise<TouristPhoto> {
    try {
      const touristPhoto = await this.prisma.touristPhoto.create({
        data: {
          workspaceId: data.workspaceId,
          contentType: data.contentType,
          contentId: data.contentId,
          imageBase64: data.imageBase64,
          caption: data.caption,
          order: data.order ?? 999,
        },
      })

      logger.info(
        `Created TouristPhoto ${touristPhoto.id} for ${data.contentType}/${data.contentId} in workspace ${data.workspaceId}`
      )
      return touristPhoto
    } catch (error) {
      logger.error("Error creating TouristPhoto:", error)
      throw error
    }
  }

  /**
   * Hard delete a TouristPhoto (no isActive column on this table)
   * @param id - TouristPhoto ID
   * @param workspaceId - Workspace ID (security filter)
   * @returns true if deleted successfully
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      const result = await this.prisma.touristPhoto.deleteMany({
        where: {
          id,
          workspaceId,
        },
      })

      if (result.count === 0) {
        throw new Error(`TouristPhoto ${id} not found in workspace ${workspaceId}`)
      }

      logger.info(`Deleted TouristPhoto ${id} for workspace ${workspaceId}`)
      return true
    } catch (error) {
      logger.error(`Error deleting TouristPhoto ${id}:`, error)
      throw error
    }
  }

  /**
   * Reorder photos for a content item: updates the `order` field to match
   * the position of each id in `orderedIds`, in a single transaction.
   * @param workspaceId - Workspace ID (security filter)
   * @param contentType - Tourist content type
   * @param contentId - ID of the owning content row
   * @param orderedIds - Photo IDs in their new display order
   */
  async reorder(
    workspaceId: string,
    contentType: TouristContentType,
    contentId: string,
    orderedIds: string[]
  ): Promise<void> {
    try {
      await this.prisma.$transaction(
        orderedIds.map((id, index) =>
          this.prisma.touristPhoto.updateMany({
            where: {
              id,
              workspaceId,
              contentType,
              contentId,
            },
            data: {
              order: index,
            },
          })
        )
      )

      logger.info(
        `Reordered ${orderedIds.length} TouristPhotos for ${contentType}/${contentId} in workspace ${workspaceId}`
      )
    } catch (error) {
      logger.error(
        `Error reordering TouristPhotos for ${contentType}/${contentId}:`,
        error
      )
      throw error
    }
  }
}
