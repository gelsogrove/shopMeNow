import { Request, Response } from "express"
import { TouristPhotoService } from "../../../application/services/tourist-photo.service"
import logger from "../../../utils/logger"

/**
 * TouristPhotoController class
 * Handles HTTP requests for the shared photo gallery used by all 5 PRO_LOCO
 * tourist content types (Restaurant, Hotel, Excursion, Refuge, Event).
 */
export class TouristPhotoController {
  private touristPhotoService: TouristPhotoService

  constructor() {
    this.touristPhotoService = new TouristPhotoService()
  }

  /**
   * Get the photo gallery for one content item
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos:
   *   get:
   *     summary: Get the photo gallery for a tourist content item
   *     tags: [TouristPhotos]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: query
   *         name: contentType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT, APARTMENT]
   *         description: Type of tourist content the gallery belongs to
   *       - in: query
   *         name: contentId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the tourist content item
   *     responses:
   *       200:
   *         description: List of photos in the gallery, ordered by `order`
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristPhoto'
   *       400:
   *         description: Missing workspaceId, contentType or contentId
   *       500:
   *         description: Failed to get tourist photo gallery
   */
  async getGallery(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params
      const { contentType, contentId } = req.query

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      if (!contentType || !contentId) {
        return res
          .status(400)
          .json({ error: "contentType and contentId query params are required" })
      }

      const photos = await this.touristPhotoService.getByContent(
        workspaceId,
        contentType as string,
        contentId as string
      )

      return res.json(photos)
    } catch (error: any) {
      logger.error("Error getting tourist photo gallery:", error)

      if (error.message?.startsWith("Invalid contentType")) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to get tourist photo gallery" })
    }
  }

  /**
   * Add a photo to a content item's gallery
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos:
   *   post:
   *     summary: Add a photo to a tourist content item's gallery
   *     tags: [TouristPhotos]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - contentType
   *               - contentId
   *               - imageBase64
   *             properties:
   *               contentType:
   *                 type: string
   *                 enum: [RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT, APARTMENT]
   *               contentId:
   *                 type: string
   *               imageBase64:
   *                 type: string
   *                 description: Base64-encoded image (or data URI)
   *               caption:
   *                 type: string
   *                 nullable: true
   *               order:
   *                 type: integer
   *     responses:
   *       201:
   *         description: TouristPhoto created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristPhoto'
   *       400:
   *         description: Invalid tourist photo data or missing required fields
   *       500:
   *         description: Failed to create tourist photo
   */
  async createPhoto(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const { contentType, contentId, imageBase64, caption, order } = req.body

      const photo = await this.touristPhotoService.create({
        workspaceId,
        contentType,
        contentId,
        imageBase64,
        caption,
        order,
      })

      return res.status(201).json(photo)
    } catch (error: any) {
      logger.error("Error creating tourist photo:", error)

      if (
        error.message === "Missing required fields" ||
        error.message?.startsWith("Invalid contentType") ||
        error.message?.startsWith("imageBase64")
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to create tourist photo" })
    }
  }

  /**
   * Delete a photo from a gallery
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos/{id}:
   *   delete:
   *     summary: Delete a tourist photo
   *     tags: [TouristPhotos]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: TouristPhoto ID
   *     responses:
   *       204:
   *         description: TouristPhoto deleted
   *       404:
   *         description: TouristPhoto not found
   *       500:
   *         description: Failed to delete tourist photo
   */
  async deletePhoto(req: Request, res: Response): Promise<Response> {
    try {
      const { id, workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      try {
        await this.touristPhotoService.delete(id, workspaceId)
        return res.status(204).send()
      } catch (error: any) {
        if (error.message?.includes("not found")) {
          return res.status(404).json({ error: "TouristPhoto not found" })
        }

        throw error
      }
    } catch (error) {
      logger.error(`Error deleting tourist photo ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to delete tourist photo" })
    }
  }

  /**
   * Reorder the photos in a content item's gallery
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos/reorder:
   *   put:
   *     summary: Reorder the photos of a tourist content item's gallery
   *     tags: [TouristPhotos]
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID of the workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - contentType
   *               - contentId
   *               - orderedIds
   *             properties:
   *               contentType:
   *                 type: string
   *                 enum: [RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT, APARTMENT]
   *               contentId:
   *                 type: string
   *               orderedIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Photo IDs in their new display order
   *     responses:
   *       200:
   *         description: Gallery reordered
   *       400:
   *         description: Invalid reorder request
   *       500:
   *         description: Failed to reorder tourist photo gallery
   */
  async reorderGallery(req: Request, res: Response): Promise<Response> {
    try {
      const { workspaceId } = req.params

      if (!workspaceId) {
        return res.status(400).json({ error: "Workspace ID is required" })
      }

      const { contentType, contentId, orderedIds } = req.body

      await this.touristPhotoService.reorder(
        workspaceId,
        contentType,
        contentId,
        orderedIds
      )

      return res.json({ success: true })
    } catch (error: any) {
      logger.error("Error reordering tourist photo gallery:", error)

      if (
        error.message?.startsWith("Invalid contentType") ||
        error.message === "contentId is required" ||
        error.message === "orderedIds must be a non-empty array"
      ) {
        return res.status(400).json({ error: error.message })
      }

      return res.status(500).json({ error: "Failed to reorder tourist photo gallery" })
    }
  }
}
