import { Router } from "express"
import { TouristVenueController } from "../controllers/tourist-venue.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristVenue:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist venue
 *         name:
 *           type: string
 *           description: TouristVenue name
 *         description:
 *           type: string
 *           nullable: true
 *           description: TouristVenue description
 *         venueType:
 *           type: string
 *           nullable: true
 *           description: Venue type (free text, e.g. "bar", "pub", "birreria")
 *         openingHours:
 *           type: string
 *           nullable: true
 *           description: Opening hours (free text)
 *         location:
 *           type: string
 *           nullable: true
 *           description: Borgata / frazione
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Phone number
 *         link:
 *           type: string
 *           nullable: true
 *           description: External link (e.g. website or map)
 *         videoUrl:
 *           type: string
 *           nullable: true
 *           description: Video URL
 *         order:
 *           type: integer
 *           description: Manual sort order
 *         isActive:
 *           type: boolean
 *           description: Whether the tourist venue is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist venue belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristVenuesRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristVenueController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-venues:
   *   get:
   *     summary: Get all tourist venues for a workspace
   *     tags: [TouristVenues]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     responses:
   *       200:
   *         description: List of tourist venues
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristVenue'
   */
  router.get("/", controller.getAllTouristVenues.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-venues:
   *   post:
   *     summary: Create a new tourist venue
   *     tags: [TouristVenues]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - name
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *                 nullable: true
   *               venueType:
   *                 type: string
   *                 nullable: true
   *               openingHours:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               phone:
   *                 type: string
   *                 nullable: true
   *               link:
   *                 type: string
   *                 nullable: true
   *               videoUrl:
   *                 type: string
   *                 nullable: true
   *               order:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       201:
   *         description: TouristVenue created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristVenue'
   */
  router.post("/", controller.createTouristVenue.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-venues/{id}:
   *   get:
   *     summary: Get a specific tourist venue
   *     tags: [TouristVenues]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the tourist venue
   *     responses:
   *       200:
   *         description: TouristVenue details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristVenue'
   *       404:
   *         description: TouristVenue not found
   */
  router.get("/:id", controller.getTouristVenueById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-venues/{id}:
   *   put:
   *     summary: Update an existing tourist venue
   *     tags: [TouristVenues]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the tourist venue
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               description:
   *                 type: string
   *                 nullable: true
   *               venueType:
   *                 type: string
   *                 nullable: true
   *               openingHours:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               phone:
   *                 type: string
   *                 nullable: true
   *               link:
   *                 type: string
   *                 nullable: true
   *               videoUrl:
   *                 type: string
   *                 nullable: true
   *               order:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: TouristVenue updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristVenue'
   *       404:
   *         description: TouristVenue not found
   */
  router.put("/:id", controller.updateTouristVenue.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-venues/{id}:
   *   delete:
   *     summary: Delete a tourist venue
   *     tags: [TouristVenues]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the tourist venue
   *     responses:
   *       204:
   *         description: TouristVenue deleted successfully
   *       404:
   *         description: TouristVenue not found
   */
  router.delete("/:id", controller.deleteTouristVenue.bind(controller))

  return router
}
