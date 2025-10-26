import { Router } from "express"
import { SupplierController } from "../controllers/supplier.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import { handleUploadError, uploadImage } from "../middlewares/uploadMiddleware"

const router = Router()
const controller = new SupplierController()

/**
 * @swagger
 * /api/workspaces/{workspaceId}/suppliers:
 *   get:
 *     summary: Get all suppliers
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of suppliers
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getSuppliers.bind(controller)
)

/**
 * @swagger
 * /api/workspaces/{workspaceId}/suppliers/{id}:
 *   get:
 *     summary: Get supplier by ID
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Supplier details
 *       404:
 *         description: Supplier not found
 */
router.get(
  "/:id",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.getSupplierById.bind(controller)
)

/**
 * @swagger
 * /api/workspaces/{workspaceId}/suppliers:
 *   post:
 *     summary: Create a new supplier
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyName
 *             properties:
 *               companyName:
 *                 type: string
 *               description:
 *                 type: string
 *               website:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               contactName:
 *                 type: string
 *               region:
 *                 type: string
 *               country:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Supplier created successfully
 *       400:
 *         description: Invalid input
 */
router.post(
  "/",
  authMiddleware,
  workspaceValidationMiddleware,
  uploadImage.single("logo"),
  handleUploadError,
  controller.createSupplier.bind(controller)
)

/**
 * @swagger
 * /api/workspaces/{workspaceId}/suppliers/{id}:
 *   put:
 *     summary: Update supplier
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *               description:
 *                 type: string
 *               website:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               contactName:
 *                 type: string
 *               region:
 *                 type: string
 *               country:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Supplier updated successfully
 *       404:
 *         description: Supplier not found
 */
router.put(
  "/:id",
  authMiddleware,
  workspaceValidationMiddleware,
  uploadImage.single("logo"),
  handleUploadError,
  controller.updateSupplier.bind(controller)
)

/**
 * @swagger
 * /api/workspaces/{workspaceId}/suppliers/{id}:
 *   delete:
 *     summary: Delete supplier (soft delete)
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Supplier deleted successfully
 *       404:
 *         description: Supplier not found
 */
router.delete(
  "/:id",
  authMiddleware,
  workspaceValidationMiddleware,
  controller.deleteSupplier.bind(controller)
)

export default router
