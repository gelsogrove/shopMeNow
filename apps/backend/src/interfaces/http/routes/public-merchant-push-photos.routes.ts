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
      const declaredMime = dataUriMatch ? dataUriMatch[1].toLowerCase() : "image/jpeg"
      const base64 = dataUriMatch ? dataUriMatch[2] : push.photoBase64

      // 🚨 Same hardening as public-tourist-photos (2026-09-14): this endpoint
      // echoed the STORED mime type straight back with no allow-list, no
      // nosniff and no CSP. A merchant who saved `data:image/svg+xml` with a
      // <script> inside got it rendered, unauthenticated, from the API's own
      // origin — stored XSS on api.echatbot.ai. Anything not on the list is
      // now served as an opaque download instead of being rendered.
      const RENDERABLE = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]
      const isRenderable = RENDERABLE.includes(declaredMime)

      const bytes = Buffer.from(base64, "base64")
      res.setHeader("Content-Type", isRenderable ? declaredMime : "application/octet-stream")
      if (!isRenderable) {
        res.setHeader("Content-Disposition", "attachment")
      }
      res.setHeader("X-Content-Type-Options", "nosniff")
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox")
      res.setHeader("Cache-Control", "public, max-age=86400")
      return res.send(bytes)
    } catch (error) {
      logger.error(`Error serving merchant push photo ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to serve photo" })
    }
  })

  return router
}
