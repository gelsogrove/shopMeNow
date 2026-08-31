import { Router } from "express"
import { TouristHotelController } from "../controllers/tourist-hotel.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristHotel:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist hotel
 *         name:
 *           type: string
 *           description: Hotel name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Hotel description
 *         stars:
 *           type: integer
 *           nullable: true
 *           description: Number of stars
 *         location:
 *           type: string
 *           nullable: true
 *           description: Hotel location
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Hotel phone number
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
 *           description: Whether the tourist hotel is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist hotel belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristHotelsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristHotelController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels:
   *   get:
   *     summary: Get all tourist hotels for a workspace
   *     tags: [TouristHotels]
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
   *         description: List of tourist hotels
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristHotel'
   */
  router.get("/", controller.getAllTouristHotels.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels:
   *   post:
   *     summary: Create a new tourist hotel
   *     tags: [TouristHotels]
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
   *                 description: Hotel name
   *               description:
   *                 type: string
   *                 nullable: true
   *               stars:
   *                 type: integer
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
   *         description: Tourist hotel created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristHotel'
   */
  router.post("/", controller.createTouristHotel.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels/{id}:
   *   get:
   *     summary: Get a specific tourist hotel
   *     tags: [TouristHotels]
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
   *         description: ID of the tourist hotel
   *     responses:
   *       200:
   *         description: Tourist hotel details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristHotel'
   *       404:
   *         description: Tourist hotel not found
   */
  router.get("/:id", controller.getTouristHotelById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels/{id}:
   *   put:
   *     summary: Update an existing tourist hotel
   *     tags: [TouristHotels]
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
   *         description: ID of the tourist hotel
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
   *               stars:
   *                 type: integer
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
   *         description: Tourist hotel updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristHotel'
   *       404:
   *         description: Tourist hotel not found
   */
  router.put("/:id", controller.updateTouristHotel.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-hotels/{id}:
   *   delete:
   *     summary: Delete a tourist hotel
   *     tags: [TouristHotels]
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
   *         description: ID of the tourist hotel
   *     responses:
   *       204:
   *         description: Tourist hotel deleted successfully
   *       404:
   *         description: Tourist hotel not found
   */
  router.delete("/:id", controller.deleteTouristHotel.bind(controller))

  return router
}
