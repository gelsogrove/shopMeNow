import { Router } from "express"
import { prisma } from "@echatbot/database"
import logger from "../../../utils/logger"

/**
 * Public, unauthenticated image endpoint for FREE-message campaign images
 * (Andrea, 2026-09-01: "se è FREE manca l'immagine"). Same pattern as
 * merchant push photos: stored as base64 on PushCampaign.mediaBase64, served
 * here so WhatsApp providers can fetch a real URL.
 *
 * Unauthenticated like the other promotional images, reachable only by
 * unguessable cuid. Read-only.
 */
export const publicCampaignMediaRouter = (): Router => {
  const router = Router()

  /**
   * @swagger
   * /api/public/push-campaigns/{id}/media.jpg:
   *   get:
   *     summary: Serve a campaign's uploaded image (public)
   *     tags: [PushCampaigns]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: PushCampaign ID
   *     responses:
   *       200:
   *         description: The image bytes
   *         content:
   *           image/jpeg: {}
   *       404:
   *         description: Image not found
   */
  router.get("/:id/media.jpg", async (req, res) => {
    try {
      const campaign = await prisma.pushCampaign.findUnique({
        where: { id: req.params.id },
        select: { mediaBase64: true },
      })
      if (!campaign?.mediaBase64) {
        return res.status(404).json({ error: "Image not found" })
      }

      const dataUriMatch = campaign.mediaBase64.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i)
      const declaredMime = dataUriMatch ? dataUriMatch[1].toLowerCase() : "image/jpeg"
      const base64 = dataUriMatch ? dataUriMatch[2] : campaign.mediaBase64

      // 🚨 Same hardening as public-tourist-photos (2026-09-14): the stored
      // mime type was echoed back unchecked, so a campaign image saved as
      // `data:image/svg+xml` with a <script> inside was rendered
      // unauthenticated from the API's own origin — stored XSS.
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
      logger.error(`Error serving campaign media ${req.params.id}:`, error)
      return res.status(500).json({ error: "Failed to serve image" })
    }
  })

  return router
}
