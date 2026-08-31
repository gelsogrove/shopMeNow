import { Router } from "express"
import { TouristEventController } from "../controllers/tourist-event.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristEvent:
 *       type: object
 *       required:
 *         - id
 *         - title
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist event
 *         title:
 *           type: string
 *           description: Event title
 *         description:
 *           type: string
 *           nullable: true
 *           description: Event description
 *         location:
 *           type: string
 *           nullable: true
 *           description: Event location / venue
 *         startDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Event start date/time
 *         endDate:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Event end date/time
 *         price:
 *           type: string
 *           nullable: true
 *           description: Free text price (e.g. "Gratuito", "10€")
 *         ticketInfo:
 *           type: string
 *           nullable: true
 *           description: Ticket information
 *         link:
 *           type: string
 *           nullable: true
 *           description: External link (e.g. website or map)
 *         ticketLink:
 *           type: string
 *           nullable: true
 *           description: Link to buy tickets
 *         videoUrl:
 *           type: string
 *           nullable: true
 *           description: Video URL
 *         order:
 *           type: integer
 *           description: Manual sort order
 *         isActive:
 *           type: boolean
 *           description: Whether the tourist event is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist event belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristEventsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristEventController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events:
   *   get:
   *     summary: Get all tourist events for a workspace
   *     tags: [TouristEvents]
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
   *         description: List of tourist events
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristEvent'
   */
  router.get("/", controller.getAllTouristEvents.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events:
   *   post:
   *     summary: Create a new tourist event
   *     tags: [TouristEvents]
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
   *               - title
   *             properties:
   *               title:
   *                 type: string
   *                 description: Event title
   *               description:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               startDate:
   *                 type: string
   *                 format: date-time
   *                 nullable: true
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 nullable: true
   *               price:
   *                 type: string
   *                 nullable: true
   *               ticketInfo:
   *                 type: string
   *                 nullable: true
   *               link:
   *                 type: string
   *                 nullable: true
   *               ticketLink:
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
   *         description: Tourist event created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristEvent'
   */
  router.post("/", controller.createTouristEvent.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events/{id}:
   *   get:
   *     summary: Get a specific tourist event
   *     tags: [TouristEvents]
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
   *         description: ID of the tourist event
   *     responses:
   *       200:
   *         description: Tourist event details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristEvent'
   *       404:
   *         description: Tourist event not found
   */
  router.get("/:id", controller.getTouristEventById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events/{id}:
   *   put:
   *     summary: Update an existing tourist event
   *     tags: [TouristEvents]
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
   *         description: ID of the tourist event
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               startDate:
   *                 type: string
   *                 format: date-time
   *                 nullable: true
   *               endDate:
   *                 type: string
   *                 format: date-time
   *                 nullable: true
   *               price:
   *                 type: string
   *                 nullable: true
   *               ticketInfo:
   *                 type: string
   *                 nullable: true
   *               link:
   *                 type: string
   *                 nullable: true
   *               ticketLink:
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
   *         description: Tourist event updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristEvent'
   *       404:
   *         description: Tourist event not found
   */
  router.put("/:id", controller.updateTouristEvent.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-events/{id}:
   *   delete:
   *     summary: Delete a tourist event
   *     tags: [TouristEvents]
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
   *         description: ID of the tourist event
   *     responses:
   *       204:
   *         description: Tourist event deleted successfully
   *       404:
   *         description: Tourist event not found
   */
  router.delete("/:id", controller.deleteTouristEvent.bind(controller))

  return router
}
