import { Router } from "express"
import { TouristRestaurantController } from "../controllers/tourist-restaurant.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristRestaurant:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist restaurant
 *         name:
 *           type: string
 *           description: Restaurant name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Restaurant description
 *         cuisineType:
 *           type: string
 *           nullable: true
 *           description: Type of cuisine served
 *         celiacFriendly:
 *           type: boolean
 *           description: Whether the restaurant offers celiac-friendly options
 *         needsReservation:
 *           type: boolean
 *           description: Whether a reservation is required
 *         location:
 *           type: string
 *           nullable: true
 *           description: Restaurant location
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Restaurant phone number
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
 *           description: Whether the tourist restaurant is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist restaurant belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristRestaurantsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristRestaurantController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants:
   *   get:
   *     summary: Get all tourist restaurants for a workspace
   *     tags: [TouristRestaurants]
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
   *         description: List of tourist restaurants
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristRestaurant'
   */
  router.get("/", controller.getAllTouristRestaurants.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants:
   *   post:
   *     summary: Create a new tourist restaurant
   *     tags: [TouristRestaurants]
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
   *                 description: Restaurant name
   *               description:
   *                 type: string
   *                 nullable: true
   *               cuisineType:
   *                 type: string
   *                 nullable: true
   *               celiacFriendly:
   *                 type: boolean
   *                 default: false
   *               needsReservation:
   *                 type: boolean
   *                 default: false
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
   *         description: Tourist restaurant created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRestaurant'
   */
  router.post("/", controller.createTouristRestaurant.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants/{id}:
   *   get:
   *     summary: Get a specific tourist restaurant
   *     tags: [TouristRestaurants]
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
   *         description: ID of the tourist restaurant
   *     responses:
   *       200:
   *         description: Tourist restaurant details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRestaurant'
   *       404:
   *         description: Tourist restaurant not found
   */
  router.get("/:id", controller.getTouristRestaurantById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants/{id}:
   *   put:
   *     summary: Update an existing tourist restaurant
   *     tags: [TouristRestaurants]
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
   *         description: ID of the tourist restaurant
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
   *               cuisineType:
   *                 type: string
   *                 nullable: true
   *               celiacFriendly:
   *                 type: boolean
   *               needsReservation:
   *                 type: boolean
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
   *         description: Tourist restaurant updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristRestaurant'
   *       404:
   *         description: Tourist restaurant not found
   */
  router.put("/:id", controller.updateTouristRestaurant.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-restaurants/{id}:
   *   delete:
   *     summary: Delete a tourist restaurant
   *     tags: [TouristRestaurants]
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
   *         description: ID of the tourist restaurant
   *     responses:
   *       204:
   *         description: Tourist restaurant deleted successfully
   *       404:
   *         description: Tourist restaurant not found
   */
  router.delete("/:id", controller.deleteTouristRestaurant.bind(controller))

  return router
}
