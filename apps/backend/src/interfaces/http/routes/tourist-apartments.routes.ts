import { Router } from "express"
import { TouristApartmentController } from "../controllers/tourist-apartment.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristApartment:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist apartment
 *         name:
 *           type: string
 *           description: Apartment/house name
 *         description:
 *           type: string
 *           nullable: true
 *           description: Apartment description
 *         category:
 *           type: string
 *           nullable: true
 *           description: Kind of structure (Appartamento, Affittacamere, Residence, Agenzia, Consorzio)
 *         location:
 *           type: string
 *           nullable: true
 *           description: Borgata / hamlet
 *         streetNumber:
 *           type: string
 *           nullable: true
 *           description: Street number (civico)
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Landline phone number
 *         mobile:
 *           type: string
 *           nullable: true
 *           description: Mobile phone number
 *         email:
 *           type: string
 *           nullable: true
 *           description: Contact email
 *         rooms:
 *           type: integer
 *           nullable: true
 *           description: Number of rooms
 *         beds:
 *           type: integer
 *           nullable: true
 *           description: Number of beds
 *         bathrooms:
 *           type: integer
 *           nullable: true
 *           description: Number of bathrooms
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
 *           description: Whether the tourist apartment is active
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist apartment belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update date
 */

export const touristApartmentsRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristApartmentController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments:
   *   get:
   *     summary: Get all tourist apartments for a workspace
   *     tags: [TouristApartments]
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
   *         description: List of tourist apartments
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristApartment'
   */
  router.get("/", controller.getAllTouristApartments.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments:
   *   post:
   *     summary: Create a new tourist apartment
   *     tags: [TouristApartments]
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
   *                 description: Apartment/house name
   *               description:
   *                 type: string
   *                 nullable: true
   *               category:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               streetNumber:
   *                 type: string
   *                 nullable: true
   *               phone:
   *                 type: string
   *                 nullable: true
   *               mobile:
   *                 type: string
   *                 nullable: true
   *               email:
   *                 type: string
   *                 nullable: true
   *               rooms:
   *                 type: integer
   *                 nullable: true
   *               beds:
   *                 type: integer
   *                 nullable: true
   *               bathrooms:
   *                 type: integer
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
   *         description: Tourist apartment created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristApartment'
   */
  router.post("/", controller.createTouristApartment.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments/{id}:
   *   get:
   *     summary: Get a specific tourist apartment
   *     tags: [TouristApartments]
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
   *         description: ID of the tourist apartment
   *     responses:
   *       200:
   *         description: Tourist apartment details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristApartment'
   *       404:
   *         description: Tourist apartment not found
   */
  router.get("/:id", controller.getTouristApartmentById.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments/{id}:
   *   put:
   *     summary: Update an existing tourist apartment
   *     tags: [TouristApartments]
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
   *         description: ID of the tourist apartment
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
   *               category:
   *                 type: string
   *                 nullable: true
   *               location:
   *                 type: string
   *                 nullable: true
   *               streetNumber:
   *                 type: string
   *                 nullable: true
   *               phone:
   *                 type: string
   *                 nullable: true
   *               mobile:
   *                 type: string
   *                 nullable: true
   *               email:
   *                 type: string
   *                 nullable: true
   *               rooms:
   *                 type: integer
   *                 nullable: true
   *               beds:
   *                 type: integer
   *                 nullable: true
   *               bathrooms:
   *                 type: integer
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
   *         description: Tourist apartment updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristApartment'
   *       404:
   *         description: Tourist apartment not found
   */
  router.put("/:id", controller.updateTouristApartment.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-apartments/{id}:
   *   delete:
   *     summary: Delete a tourist apartment
   *     tags: [TouristApartments]
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
   *         description: ID of the tourist apartment
   *     responses:
   *       204:
   *         description: Tourist apartment deleted successfully
   *       404:
   *         description: Tourist apartment not found
   */
  router.delete("/:id", controller.deleteTouristApartment.bind(controller))

  return router
}
