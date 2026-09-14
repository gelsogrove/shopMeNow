import { Router } from "express"
import { TouristCastleController } from "../controllers/tourist-castle.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristCastle:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist castle
 *         name:
 *           type: string
 *           description: TouristCastle name
 *         description:
 *           type: string
 *           nullable: true
 *           description: TouristCastle description
 *         century:
 *           type: string
 *           nullable: true
 *           description: Century built (free text, e.g. "XII secolo")
 *         visitInfo:
 *           type: string
 *           nullable: true
 *           description: Opening times / how to visit (free text)
 *         location:
 *           type: string
 *           nullable: true
 *           description: Comune / frazione
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
 *           description: Whether the tourist castle is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist castle belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristCastlesRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristCastleController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-castles:
   *   get:
   *     summary: Get all tourist castles for a workspace
   *     tags: [TouristCastles]
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
   *         description: List of tourist castles
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristCastle'
   */
  router.get("/", controller.getAllTouristCastles.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-castles:
   *   post:
   *     summary: Create a new tourist castle
   *     tags: [TouristCastles]
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
   *               visitInfo:
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
   *         description: TouristCastle created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristCastle'
   */
  router.post("/", controller.createTouristCastle.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-castles/{id}:
   *   get:
   *     summary: Get a specific tourist castle
   *     tags: [TouristCastles]
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
   *         description: ID of the tourist castle
   *     responses:
   *       200:
   *         description: TouristCastle details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristCastle'
   *       404:
   *         description: TouristCastle not found
   */
  router.get("/:id", controller.getTouristCastleById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-castles/{id}:
   *   put:
   *     summary: Update an existing tourist castle
   *     tags: [TouristCastles]
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
   *         description: ID of the tourist castle
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
   *               visitInfo:
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
   *         description: TouristCastle updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristCastle'
   *       404:
   *         description: TouristCastle not found
   */
  router.put("/:id", controller.updateTouristCastle.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-castles/{id}:
   *   delete:
   *     summary: Delete a tourist castle
   *     tags: [TouristCastles]
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
   *         description: ID of the tourist castle
   *     responses:
   *       204:
   *         description: TouristCastle deleted successfully
   *       404:
   *         description: TouristCastle not found
   */
  router.delete("/:id", controller.deleteTouristCastle.bind(controller))

  return router
}
