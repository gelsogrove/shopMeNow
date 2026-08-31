import { Router } from "express"
import { prisma } from "@echatbot/database"
import logger from "../../../utils/logger"

/**
 * Public, unauthenticated image endpoint for the PRO_LOCO photo gallery.
 *
 * Why it exists: gallery photos are stored as base64 in the DB (TouristPhoto),
 * which works for the backoffice UI but gives the chatbot nothing to send — the
 * media pipeline (custom-demosappada faq-media.ts) attaches URLs to detail
 * answers, and WhatsApp previews need a real URL. This route turns each photo
 * row into one.
 *
 * The path ends in `.jpg` on purpose: the module's PHOTO_LINK_RE recognises a
 * photo by its extension, and an extension-less URL would rank as a generic
 * page instead of an image.
 *
 * Unauthenticated like product images and logos: this is the tenant's public
 * promotional content, reachable only by unguessable cuid. Read-only, no
 * workspace data beyond the image bytes is exposed.
 */
export const publicTouristPhotosRouter = (): Router => {
  const router = Router()

  /**
   * @swagger
   * /api/public/tourist-photos/{id}/image.jpg:
   *   get:
   *     summary: Serve a tourist gallery photo as an image (public)
   *     tags: [TouristPhotos]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: TouristPhoto ID
   *     responses:
   *       200:
   *         description: The image bytes
   *         content:
   *           image/jpeg: {}
   *       404:
   *         description: Photo not found
   */
  router.get("/:id/image.jpg", async (req, res) => {
    try {
      const photo = await prisma.touristPhoto.findUnique({
        where: { id: req.params.id },
        select: { imageBase64: true },
      })
      if (!photo?.imageBase64) {
        return res.status(404).json({ error: "Photo not found" })
      }

      // Stored as either a full data URI (data:image/png;base64,...) or raw
      // base64. The data URI carries its own mime type; raw defaults to jpeg.
      const dataUriMatch = photo.imageBase64.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i)
      const mimeType = dataUriMatch ? dataUriMatch[1] : "image/jpeg"
      const base64 = dataUriMatch ? dataUriMatch[2] : photo.imageBase64

      const bytes = Buffer.from(base64, "base64")
      res.setHeader("Content-Type", mimeType)
      res.setHeader("Cache-Control", "public, max-age=86400")
      return res.send(bytes)
    } catch (error) {
      logger.error(`Error serving tourist photo ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to serve photo" })
    }
  })

  return router
}
