import { Router } from "express"
import { TouristViewpointController } from "../controllers/tourist-viewpoint.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristViewpoint:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist viewpoint
 *         name:
 *           type: string
 *           description: TouristViewpoint name
 *         description:
 *           type: string
 *           nullable: true
 *           description: TouristViewpoint description
 *         altitude:
 *           type: integer
 *           nullable: true
 *           description: Altitude in metres above sea level
 *         access:
 *           type: string
 *           nullable: true
 *           description: How to reach it (free text, e.g. "a piedi")
 *         difficulty:
 *           type: string
 *           nullable: true
 *           description: Access difficulty (free text)
 *         location:
 *           type: string
 *           nullable: true
 *           description: Borgata / frazione
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
 *           description: Whether the tourist viewpoint is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist viewpoint belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristViewpointsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristViewpointController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-viewpoints:
   *   get:
   *     summary: Get all tourist viewpoints for a workspace
   *     tags: [TouristViewpoints]
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
   *         description: List of tourist viewpoints
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristViewpoint'
   */
  router.get("/", controller.getAllTouristViewpoints.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-viewpoints:
   *   post:
   *     summary: Create a new tourist viewpoint
   *     tags: [TouristViewpoints]
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
   *               altitude:
   *                 type: integer
   *                 nullable: true
   *               access:
   *                 type: string
   *                 nullable: true
   *               difficulty:
   *                 type: string
   *                 nullable: true
   *               location:
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
   *         description: TouristViewpoint created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristViewpoint'
   */
  router.post("/", controller.createTouristViewpoint.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-viewpoints/{id}:
   *   get:
   *     summary: Get a specific tourist viewpoint
   *     tags: [TouristViewpoints]
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
   *         description: ID of the tourist viewpoint
   *     responses:
   *       200:
   *         description: TouristViewpoint details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristViewpoint'
   *       404:
   *         description: TouristViewpoint not found
   */
  router.get("/:id", controller.getTouristViewpointById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-viewpoints/{id}:
   *   put:
   *     summary: Update an existing tourist viewpoint
   *     tags: [TouristViewpoints]
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
   *         description: ID of the tourist viewpoint
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
   *               altitude:
   *                 type: integer
   *                 nullable: true
   *               access:
   *                 type: string
   *                 nullable: true
   *               difficulty:
   *                 type: string
   *                 nullable: true
   *               location:
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
   *         description: TouristViewpoint updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristViewpoint'
   *       404:
   *         description: TouristViewpoint not found
   */
  router.put("/:id", controller.updateTouristViewpoint.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-viewpoints/{id}:
   *   delete:
   *     summary: Delete a tourist viewpoint
   *     tags: [TouristViewpoints]
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
   *         description: ID of the tourist viewpoint
   *     responses:
   *       204:
   *         description: TouristViewpoint deleted successfully
   *       404:
   *         description: TouristViewpoint not found
   */
  router.delete("/:id", controller.deleteTouristViewpoint.bind(controller))

  return router
}
