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
  "CHURCH",
  "CASTLE",
  "VIEWPOINT",
  "VENUE",
] as TouristContentType[]

/**
 * Image formats a gallery photo may be stored in.
 *
 * The gallery is served back by an UNAUTHENTICATED endpoint
 * (public-tourist-photos.routes.ts) which echoes the stored mime type into a
 * Content-Type header. Accepting "any non-empty string" therefore meant a
 * backoffice user could store `data:text/html;base64,...` and get the backend
 * to serve attacker-controlled HTML from its own origin — stored XSS. The
 * allow-list closes that at the point of entry: the public route can only
 * ever echo a type that passed through here.
 *
 * SVG is deliberately absent: it is an image that can carry <script>.
 */
const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const

/**
 * Largest decoded image accepted, in bytes.
 *
 * Matches the 4MB cap the express body limit was sized around (app.ts uses a
 * 6mb JSON limit because base64 inflates by ~4/3). Enforced here as well so
 * the failure is a 400 naming the real problem instead of a bare 413, and so
 * the limit survives any future change to the body parser.
 */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

/**
 * Service layer for TouristPhoto
 * Thin wrapper (like FaqService) around TouristPhotoRepository. Shared by all
 * 12 PRO_LOCO tourist content types (Restaurant, Hotel, Excursion, Refuge,
 * Event, Apartment, SportsFacility, SkiFacility, Church, Castle, Viewpoint,
 * Venue) — one gallery implementation instead of 12 near-identical ones.
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
   * Validate the uploaded image: real base64, an allow-listed image mime
   * type, and within the size cap.
   *
   * Photos are stored as base64 and served back by an unauthenticated route
   * that echoes the stored mime type, so what is accepted here is what the
   * backend will later serve from its own origin. Three things are checked:
   *
   * 1. MIME — only ALLOWED_IMAGE_MIME_TYPES. A data URI declaring anything
   *    else (text/html, image/svg+xml) is rejected rather than stored and
   *    later served as that type.
   * 2. DECODABILITY — the payload must round-trip as base64. Garbage that
   *    Buffer.from() silently truncates would otherwise be stored as a photo
   *    that renders as a broken image forever.
   * 3. SIZE — decoded bytes against MAX_IMAGE_BYTES, so an oversized upload
   *    fails with a message that says so.
   *
   * Raw base64 with no data-URI prefix stays accepted (the frontend sends a
   * data URI, older rows are raw) and is treated as JPEG, exactly as the
   * public route already assumes.
   */
  private validateImageBase64(imageBase64: string): void {
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.trim() === "") {
      throw new Error("imageBase64 is required and must be a non-empty string")
    }

    const trimmed = imageBase64.trim()
    let payload = trimmed

    if (trimmed.startsWith("data:")) {
      // [\s\S] instead of the `s` flag: the build target predates ES2018.
      const match = trimmed.match(
        /^data:([a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+);base64,([\s\S]*)$/i
      )
      if (!match) {
        throw new Error(
          "imageBase64 must be a base64 data URI (data:<mime>;base64,...) or raw base64"
        )
      }

      const mimeType = match[1].toLowerCase()
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
        throw new Error(
          `Unsupported image type "${mimeType}". Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`
        )
      }

      payload = match[2]
    }

    // Strict base64: Buffer.from() ignores invalid characters instead of
    // failing, so compare against a re-encode to catch a corrupt payload.
    const normalized = payload.replace(/\s/g, "")
    if (normalized === "" || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
      throw new Error("imageBase64 is not valid base64 image data")
    }

    const bytes = Buffer.from(normalized, "base64")
    if (bytes.length === 0) {
      throw new Error("imageBase64 is not valid base64 image data")
    }

    if (bytes.length > MAX_IMAGE_BYTES) {
      const mb = (MAX_IMAGE_BYTES / (1024 * 1024)).toFixed(0)
      throw new Error(`Image is too large. Maximum size is ${mb}MB`)
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
