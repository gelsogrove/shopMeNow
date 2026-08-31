import { Router } from "express"
import { TouristSkiFacilityController } from "../controllers/tourist-ski-facility.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristSkiFacility:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist ski facility
 *         name:
 *           type: string
 *           description: Ski facility name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Ski facility description
 *         slopeType:
 *           type: string
 *           nullable: true
 *           description: Slope type (e.g. blu, rossa, nera)
 *         location:
 *           type: string
 *           nullable: true
 *           description: Ski facility location
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
 *           description: Whether the tourist ski facility is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist ski facility belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristSkiFacilitiesRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristSkiFacilityController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-ski-facilities:
   *   get:
   *     summary: Get all tourist ski facilities for a workspace
   *     tags: [TouristSkiFacilities]
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
   *         description: List of tourist ski facilities
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristSkiFacility'
   */
  router.get("/", controller.getAllTouristSkiFacilities.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-ski-facilities:
   *   post:
   *     summary: Create a new tourist ski facility
   *     tags: [TouristSkiFacilities]
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
   *                 description: Ski facility name
   *               description:
   *                 type: string
   *                 nullable: true
   *               slopeType:
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
   *         description: Tourist ski facility created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristSkiFacility'
   */
  router.post("/", controller.createTouristSkiFacility.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-ski-facilities/{id}:
   *   get:
   *     summary: Get a specific tourist ski facility
   *     tags: [TouristSkiFacilities]
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
   *         description: ID of the tourist ski facility
   *     responses:
   *       200:
   *         description: Tourist ski facility details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristSkiFacility'
   *       404:
   *         description: Tourist ski facility not found
   */
  router.get("/:id", controller.getTouristSkiFacilityById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-ski-facilities/{id}:
   *   put:
   *     summary: Update an existing tourist ski facility
   *     tags: [TouristSkiFacilities]
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
   *         description: ID of the tourist ski facility
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
   *               slopeType:
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
   *         description: Tourist ski facility updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristSkiFacility'
   *       404:
   *         description: Tourist ski facility not found
   */
  router.put("/:id", controller.updateTouristSkiFacility.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-ski-facilities/{id}:
   *   delete:
   *     summary: Delete a tourist ski facility
   *     tags: [TouristSkiFacilities]
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
   *         description: ID of the tourist ski facility
   *     responses:
   *       204:
   *         description: Tourist ski facility deleted successfully
   *       404:
   *         description: Tourist ski facility not found
   */
  router.delete("/:id", controller.deleteTouristSkiFacility.bind(controller))

  return router
}
