import { Router } from "express"
import { TouristRefugeController } from "../controllers/tourist-refuge.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristRefuge:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist refuge
 *         name:
 *           type: string
 *           description: Refuge name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Refuge description
 *         climbTime:
 *           type: string
 *           nullable: true
 *           description: Estimated climb time to reach the refuge
 *         difficulty:
 *           type: string
 *           nullable: true
 *           description: Difficulty level
 *         openFrom:
 *           type: string
 *           nullable: true
 *           description: Season opening date/period
 *         openTo:
 *           type: string
 *           nullable: true
 *           description: Season closing date/period
 *         location:
 *           type: string
 *           nullable: true
 *           description: Refuge location
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Refuge phone number
 *         email:
 *           type: string
 *           nullable: true
 *           description: Refuge contact email
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
 *           description: Whether the tourist refuge is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist refuge belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristRefugesRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristRefugeController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges:
   *   get:
   *     summary: Get all tourist refuges for a workspace
   *     tags: [TouristRefuges]
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
   *         description: List of tourist refuges
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristRefuge'
   */
  router.get("/", controller.getAllTouristRefuges.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges:
   *   post:
   *     summary: Create a new tourist refuge
   *     tags: [TouristRefuges]
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
   *                 description: Refuge name
   *               description:
   *                 type: string
   *                 nullable: true
   *               climbTime:
   *                 type: string
   *                 nullable: true
   *               difficulty:
   *                 type: string
   *                 nullable: true
   *               openFrom:
   *                 type: string
   *                 nullable: true
   *               openTo:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               phone:
   *                 type: string
   *                 nullable: true
   *               email:
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
   *         description: Tourist refuge created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRefuge'
   */
  router.post("/", controller.createTouristRefuge.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges/{id}:
   *   get:
   *     summary: Get a specific tourist refuge
   *     tags: [TouristRefuges]
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
   *         description: ID of the tourist refuge
   *     responses:
   *       200:
   *         description: Tourist refuge details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRefuge'
   *       404:
   *         description: Tourist refuge not found
   */
  router.get("/:id", controller.getTouristRefugeById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges/{id}:
   *   put:
   *     summary: Update an existing tourist refuge
   *     tags: [TouristRefuges]
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
   *         description: ID of the tourist refuge
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
   *               climbTime:
   *                 type: string
   *                 nullable: true
   *               difficulty:
   *                 type: string
   *                 nullable: true
   *               openFrom:
   *                 type: string
   *                 nullable: true
   *               openTo:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               phone:
   *                 type: string
   *                 nullable: true
   *               email:
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
   *         description: Tourist refuge updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRefuge'
   *       404:
   *         description: Tourist refuge not found
   */
  router.put("/:id", controller.updateTouristRefuge.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-refuges/{id}:
   *   delete:
   *     summary: Delete a tourist refuge
   *     tags: [TouristRefuges]
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
   *         description: ID of the tourist refuge
   *     responses:
   *       204:
   *         description: Tourist refuge deleted successfully
   *       404:
   *         description: Tourist refuge not found
   */
  router.delete("/:id", controller.deleteTouristRefuge.bind(controller))

  return router
}
