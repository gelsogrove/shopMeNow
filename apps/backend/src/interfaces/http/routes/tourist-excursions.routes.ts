import { Router } from "express"
import { TouristExcursionController } from "../controllers/tourist-excursion.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristExcursion:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist excursion
 *         name:
 *           type: string
 *           description: Excursion name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Excursion description
 *         difficulty:
 *           type: string
 *           nullable: true
 *           description: Difficulty level
 *         duration:
 *           type: string
 *           nullable: true
 *           description: Excursion duration
 *         location:
 *           type: string
 *           nullable: true
 *           description: Excursion location
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
 *           description: Whether the tourist excursion is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist excursion belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristExcursionsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristExcursionController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions:
   *   get:
   *     summary: Get all tourist excursions for a workspace
   *     tags: [TouristExcursions]
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
   *         description: List of tourist excursions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristExcursion'
   */
  router.get("/", controller.getAllTouristExcursions.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions:
   *   post:
   *     summary: Create a new tourist excursion
   *     tags: [TouristExcursions]
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
   *                 description: Excursion name
   *               description:
   *                 type: string
   *                 nullable: true
   *               difficulty:
   *                 type: string
   *                 nullable: true
   *               duration:
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
   *         description: Tourist excursion created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristExcursion'
   */
  router.post("/", controller.createTouristExcursion.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions/{id}:
   *   get:
   *     summary: Get a specific tourist excursion
   *     tags: [TouristExcursions]
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
   *         description: ID of the tourist excursion
   *     responses:
   *       200:
   *         description: Tourist excursion details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristExcursion'
   *       404:
   *         description: Tourist excursion not found
   */
  router.get("/:id", controller.getTouristExcursionById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions/{id}:
   *   put:
   *     summary: Update an existing tourist excursion
   *     tags: [TouristExcursions]
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
   *         description: ID of the tourist excursion
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
   *               difficulty:
   *                 type: string
   *                 nullable: true
   *               duration:
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
   *         description: Tourist excursion updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristExcursion'
   *       404:
   *         description: Tourist excursion not found
   */
  router.put("/:id", controller.updateTouristExcursion.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-excursions/{id}:
   *   delete:
   *     summary: Delete a tourist excursion
   *     tags: [TouristExcursions]
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
   *         description: ID of the tourist excursion
   *     responses:
   *       204:
   *         description: Tourist excursion deleted successfully
   *       404:
   *         description: Tourist excursion not found
   */
  router.delete("/:id", controller.deleteTouristExcursion.bind(controller))

  return router
}
