import { Router } from "express"
import { TouristSportsFacilityController } from "../controllers/tourist-sports-facility.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristSportsFacility:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist sports facility
 *         name:
 *           type: string
 *           description: Sports facility name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Sports facility description
 *         sport:
 *           type: string
 *           nullable: true
 *           description: Sport practised (e.g. golf, tennis)
 *         season:
 *           type: string
 *           nullable: true
 *           description: Season (e.g. estiva, invernale, tutto l'anno)
 *         location:
 *           type: string
 *           nullable: true
 *           description: Sports facility location
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
 *           description: Whether the tourist sports facility is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist sports facility belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristSportsFacilitiesRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristSportsFacilityController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-sports-facilities:
   *   get:
   *     summary: Get all tourist sports facilities for a workspace
   *     tags: [TouristSportsFacilities]
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
   *         description: List of tourist sports facilities
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristSportsFacility'
   */
  router.get("/", controller.getAllTouristSportsFacilities.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-sports-facilities:
   *   post:
   *     summary: Create a new tourist sports facility
   *     tags: [TouristSportsFacilities]
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
   *                 description: Sports facility name
   *               description:
   *                 type: string
   *                 nullable: true
   *               sport:
   *                 type: string
   *                 nullable: true
   *               season:
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
   *         description: Tourist sports facility created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristSportsFacility'
   */
  router.post("/", controller.createTouristSportsFacility.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-sports-facilities/{id}:
   *   get:
   *     summary: Get a specific tourist sports facility
   *     tags: [TouristSportsFacilities]
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
   *         description: ID of the tourist sports facility
   *     responses:
   *       200:
   *         description: Tourist sports facility details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristSportsFacility'
   *       404:
   *         description: Tourist sports facility not found
   */
  router.get("/:id", controller.getTouristSportsFacilityById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-sports-facilities/{id}:
   *   put:
   *     summary: Update an existing tourist sports facility
   *     tags: [TouristSportsFacilities]
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
   *         description: ID of the tourist sports facility
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
   *               sport:
   *                 type: string
   *                 nullable: true
   *               season:
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
   *         description: Tourist sports facility updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristSportsFacility'
   *       404:
   *         description: Tourist sports facility not found
   */
  router.put("/:id", controller.updateTouristSportsFacility.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-sports-facilities/{id}:
   *   delete:
   *     summary: Delete a tourist sports facility
   *     tags: [TouristSportsFacilities]
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
   *         description: ID of the tourist sports facility
   *     responses:
   *       204:
   *         description: Tourist sports facility deleted successfully
   *       404:
   *         description: Tourist sports facility not found
   */
  router.delete("/:id", controller.deleteTouristSportsFacility.bind(controller))

  return router
}
