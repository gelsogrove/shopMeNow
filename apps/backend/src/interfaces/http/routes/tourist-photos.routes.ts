import { Router } from "express"
import { TouristPhotoController } from "../controllers/tourist-photo.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

/**
 * @swagger
 * components:
 *   schemas:
 *     TouristPhoto:
 *       type: object
 *       required:
 *         - id
 *         - workspaceId
 *         - contentType
 *         - contentId
 *         - imageBase64
 *       properties:
 *         id:
 *           type: string
 *           description: ID of the tourist photo
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace this tourist photo belongs to
 *         contentType:
 *           type: string
 *           enum: [RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT, APARTMENT, SPORTS_FACILITY, SKI_FACILITY]
 *           description: Type of tourist content this photo belongs to
 *         contentId:
 *           type: string
 *           description: ID of the tourist content item this photo belongs to
 *         imageBase64:
 *           type: string
 *           description: Base64-encoded image (or data URI)
 *         caption:
 *           type: string
 *           nullable: true
 *           description: Optional caption for the photo
 *         order:
 *           type: integer
 *           description: Manual sort order within the gallery
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation date
 */

export const touristPhotosRouter = (): Router => {
  const router = Router({ mergeParams: true })
  const controller = new TouristPhotoController()

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos:
   *   get:
   *     summary: Get the photo gallery for a tourist content item
   *     tags: [TouristPhotos]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: ID of the workspace
   *       - in: query
   *         name: contentType
   *         required: true
   *         schema:
   *           type: string
   *           enum: [RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT, APARTMENT, SPORTS_FACILITY, SKI_FACILITY]
   *       - in: query
   *         name: contentId
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of photos in the gallery
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/TouristPhoto'
   */
  router.get("/", controller.getGallery.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos:
   *   post:
   *     summary: Add a photo to a tourist content item's gallery
   *     tags: [TouristPhotos]
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
   *               - contentType
   *               - contentId
   *               - imageBase64
   *             properties:
   *               contentType:
   *                 type: string
   *                 enum: [RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT, APARTMENT, SPORTS_FACILITY, SKI_FACILITY]
   *               contentId:
   *                 type: string
   *               imageBase64:
   *                 type: string
   *               caption:
   *                 type: string
   *                 nullable: true
   *               order:
   *                 type: integer
   *     responses:
   *       201:
   *         description: TouristPhoto created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/TouristPhoto'
   */
  router.post("/", controller.createPhoto.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos/reorder:
   *   put:
   *     summary: Reorder the photos of a tourist content item's gallery
   *     tags: [TouristPhotos]
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
   *               - contentType
   *               - contentId
   *               - orderedIds
   *             properties:
   *               contentType:
   *                 type: string
   *                 enum: [RESTAURANT, HOTEL, EXCURSION, REFUGE, EVENT, APARTMENT, SPORTS_FACILITY, SKI_FACILITY]
   *               contentId:
   *                 type: string
   *               orderedIds:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Gallery reordered successfully
   */
  router.put("/reorder", controller.reorderGallery.bind(controller))

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/tourist-photos/{id}:
   *   delete:
   *     summary: Delete a tourist photo
   *     tags: [TouristPhotos]
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
   *         description: ID of the tourist photo
   *     responses:
   *       204:
   *         description: TouristPhoto deleted successfully
   *       404:
   *         description: TouristPhoto not found
   */
  router.delete("/:id", controller.deletePhoto.bind(controller))

  return router
}
