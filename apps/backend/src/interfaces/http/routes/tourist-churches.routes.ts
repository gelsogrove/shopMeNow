import { Router } from "express"
import { TouristChurchController } from "../controllers/tourist-church.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristChurch:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist church
 *         name:
 *           type: string
 *           description: TouristChurch name
 *         description:
 *           type: string
 *           nullable: true
 *           description: TouristChurch description
 *         century:
 *           type: string
 *           nullable: true
 *           description: Century / year built (free text, e.g. "XV secolo")
 *         style:
 *           type: string
 *           nullable: true
 *           description: Architectural style (free text, e.g. "gotico")
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
 *           description: Whether the tourist church is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist church belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristChurchesRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristChurchController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-churches:
   *   get:
   *     summary: Get all tourist churches for a workspace
   *     tags: [TouristChurchs]
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
   *         description: List of tourist churches
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristChurch'
   */
  router.get("/", controller.getAllTouristChurchs.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-churches:
   *   post:
   *     summary: Create a new tourist church
   *     tags: [TouristChurchs]
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
   *               century:
   *                 type: string
   *                 nullable: true
   *               style:
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
   *         description: TouristChurch created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristChurch'
   */
  router.post("/", controller.createTouristChurch.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-churches/{id}:
   *   get:
   *     summary: Get a specific tourist church
   *     tags: [TouristChurchs]
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
   *         description: ID of the tourist church
   *     responses:
   *       200:
   *         description: TouristChurch details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristChurch'
   *       404:
   *         description: TouristChurch not found
   */
  router.get("/:id", controller.getTouristChurchById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-churches/{id}:
   *   put:
   *     summary: Update an existing tourist church
   *     tags: [TouristChurchs]
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
   *         description: ID of the tourist church
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
   *               century:
   *                 type: string
   *                 nullable: true
   *               style:
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
   *         description: TouristChurch updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristChurch'
   *       404:
   *         description: TouristChurch not found
   */
  router.put("/:id", controller.updateTouristChurch.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-churches/{id}:
   *   delete:
   *     summary: Delete a tourist church
   *     tags: [TouristChurchs]
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
   *         description: ID of the tourist church
   *     responses:
   *       204:
   *         description: TouristChurch deleted successfully
   *       404:
   *         description: TouristChurch not found
   */
  router.delete("/:id", controller.deleteTouristChurch.bind(controller))

  return router
}
