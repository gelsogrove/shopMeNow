import { Router } from "express"
import { GeocodingController } from "../controllers/geocoding.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

export const geocodingRouter = (): Router => {
  const router = Router()
  const controller = new GeocodingController()

  router.use(authMiddleware)

  /**
   * @swagger
   * /api/geocoding/search:
   *   get:
   *     summary: Search for a place name/address (Nominatim/OpenStreetMap proxy)
   *     description: >
   *       Used by the tourist content forms' location picker. Free, no API
   *       key — no Google Places dependency. Returns display_name strings the
   *       form saves as plain text into the `location` field.
   *     tags: [Geocoding]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *         description: Free-text place name or address to search
   *     responses:
   *       200:
   *         description: Matching places
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   display_name:
   *                     type: string
   *                   lat:
   *                     type: string
   *                   lon:
   *                     type: string
   *       400:
   *         description: Missing query parameter
   *       502:
   *         description: Upstream search service unavailable
   */
  router.get("/search", controller.search.bind(controller))

  return router
}
