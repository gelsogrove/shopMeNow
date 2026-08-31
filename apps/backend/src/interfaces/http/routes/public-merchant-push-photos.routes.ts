import { Router } from "express"
import { prisma } from "@echatbot/database"
import logger from "../../../utils/logger"

/**
 * Public, unauthenticated photo endpoint for merchant push creatives.
 *
 * Why it exists: the admin uploads the creative's photo from their computer
 * (stored as base64 on MerchantPush.photoBase64, same pattern as the PRO_LOCO
 * tourist gallery), but WhatsApp providers need a real URL to attach media —
 * the campaign snapshot points here and the queue processor passes it to
 * provider.sendMediaMessage.
 *
 * Unauthenticated like tourist photos and logos: it is the merchant's own
 * promotional content, reachable only by unguessable cuid. Read-only.
 */
export const publicMerchantPushPhotosRouter = (): Router => {
  const router = Router()

  /**
   * @swagger
   * /api/public/merchant-pushes/{id}/photo.jpg:
   *   get:
   *     summary: Serve a merchant push creative photo (public)
   *     tags: [Merchants]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: MerchantPush ID
   *     responses:
   *       200:
   *         description: The image bytes
   *         content:
   *           image/jpeg: {}
   *       404:
   *         description: Photo not found
   */
  router.get("/:id/photo.jpg", async (req, res) => {
    try {
      const push = await prisma.merchantPush.findUnique({
        where: { id: req.params.id },
        select: { photoBase64: true, deletedAt: true },
      })
      if (!push?.photoBase64 || push.deletedAt) {
        return res.status(404).json({ error: "Photo not found" })
      }

      // Stored as either a full data URI (data:image/png;base64,...) or raw
      // base64. The data URI carries its own mime type; raw defaults to jpeg.
      const dataUriMatch = push.photoBase64.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i)
      const mimeType = dataUriMatch ? dataUriMatch[1] : "image/jpeg"
      const base64 = dataUriMatch ? dataUriMatch[2] : push.photoBase64

      const bytes = Buffer.from(base64, "base64")
      res.setHeader("Content-Type", mimeType)
      res.setHeader("Cache-Control", "public, max-age=86400")
      return res.send(bytes)
    } catch (error) {
      logger.error(`Error serving merchant push photo ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to serve photo" })
    }
  })

  return router
}
