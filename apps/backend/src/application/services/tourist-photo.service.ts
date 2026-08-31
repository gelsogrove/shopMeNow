import { prisma, TouristPhoto, TouristContentType } from "@echatbot/database"
import { TouristPhotoRepository } from "../../repositories/tourist-photo.repository"
import logger from "../../utils/logger"

const VALID_CONTENT_TYPES: TouristContentType[] = [
  "RESTAURANT",
  "HOTEL",
  "EXCURSION",
  "REFUGE",
  "EVENT",
  "APARTMENT",
  "SPORTS_FACILITY",
  "SKI_FACILITY",
] as TouristContentType[]

/**
 * Service layer for TouristPhoto
 * Thin wrapper (like FaqService) around TouristPhotoRepository. Shared by all
 * 6 PRO_LOCO tourist content types (Restaurant, Hotel, Excursion, Refuge,
 * Event, Apartment) — one gallery implementation instead of 6 near-identical
 * ones.
 */
export class TouristPhotoService {
  private touristPhotoRepository: TouristPhotoRepository

  constructor() {
    this.touristPhotoRepository = new TouristPhotoRepository(prisma)
  }

  /**
   * Validate that contentType is one of the known enum values
   */
  private validateContentType(contentType: string): void {
    if (!VALID_CONTENT_TYPES.includes(contentType as TouristContentType)) {
      throw new Error(
        `Invalid contentType "${contentType}". Must be one of: ${VALID_CONTENT_TYPES.join(", ")}`
      )
    }
  }

  /**
   * Basic sanity check that imageBase64 looks like a data URI or a non-empty
   * base64 string. Intentionally not a full base64 validator — just enough
   * to reject empty/garbage input before it hits the DB.
   */
  private validateImageBase64(imageBase64: string): void {
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.trim() === "") {
      throw new Error("imageBase64 is required and must be a non-empty string")
    }
  }

  /**
   * Get the photo gallery for one content item, ordered by `order` asc
   */
  async getByContent(
    workspaceId: string,
    contentType: string,
    contentId: string
  ): Promise<TouristPhoto[]> {
    try {
      this.validateContentType(contentType)

      if (!contentId) {
        throw new Error("contentId is required")
      }

      return await this.touristPhotoRepository.findByContent(
        workspaceId,
        contentType as TouristContentType,
        contentId
      )
    } catch (error) {
      logger.error(
        `Error getting TouristPhoto gallery for ${contentType}/${contentId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Add a photo to a content item's gallery
   */
  async create(data: {
    workspaceId: string
    contentType: string
    contentId: string
    imageBase64: string
    caption?: string
    order?: number
  }): Promise<TouristPhoto> {
    try {
      if (!data.workspaceId || !data.contentId) {
        throw new Error("Missing required fields")
      }

      this.validateContentType(data.contentType)
      this.validateImageBase64(data.imageBase64)

      return await this.touristPhotoRepository.create({
        workspaceId: data.workspaceId,
        contentType: data.contentType as TouristContentType,
        contentId: data.contentId,
        imageBase64: data.imageBase64,
        caption: data.caption,
        order: data.order,
      })
    } catch (error) {
      logger.error("Error creating TouristPhoto:", error)
      throw error
    }
  }

  /**
   * Delete a photo from the gallery (hard delete)
   */
  async delete(id: string, workspaceId: string): Promise<boolean> {
    try {
      return await this.touristPhotoRepository.delete(id, workspaceId)
    } catch (error) {
      logger.error(`Error deleting TouristPhoto with id ${id}:`, error)
      throw error
    }
  }

  /**
   * Reorder the photos of a content item's gallery
   */
  async reorder(
    workspaceId: string,
    contentType: string,
    contentId: string,
    orderedIds: string[]
  ): Promise<void> {
    try {
      this.validateContentType(contentType)

      if (!contentId) {
        throw new Error("contentId is required")
      }

      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        throw new Error("orderedIds must be a non-empty array")
      }

      return await this.touristPhotoRepository.reorder(
        workspaceId,
        contentType as TouristContentType,
        contentId,
        orderedIds
      )
    } catch (error) {
      logger.error(
        `Error reordering TouristPhoto gallery for ${contentType}/${contentId}:`,
        error
      )
      throw error
    }
  }
}

export default new TouristPhotoService()
