import { Router } from "express"
import multer from "multer"
import logger from "../../../utils/logger"
import { ProductController } from "../controllers/product.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { handleUploadError, uploadImage } from "../middlewares/uploadMiddleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

// Multer config for CSV upload (memory storage)
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
      cb(null, true)
    } else {
      cb(new Error("Only CSV files are allowed"))
    }
  },
})

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The product's unique identifier
 *         name:
 *           type: string
 *           description: The product name
 *         description:
 *           type: string
 *           description: The product description
 *         price:
 *           type: number
 *           description: The product price
 *         stock:
 *           type: integer
 *           description: The available stock

 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, DRAFT]
 *           description: The product status
 *         isActive:
 *           type: boolean
 *           description: Whether the product is active
 *         slug:
 *           type: string
 *           description: URL-friendly version of the product name
 *         categoryId:
 *           type: string
 *           description: The ID of the product's category

 *         workspaceId:
 *           type: string
 *           description: The ID of the workspace this product belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when the product was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when the product was last updated
 *       required:
 *         - name
 *         - price
 *         - workspaceId
 *     ProductWithDiscounts:
 *       allOf:
 *         - $ref: '#/components/schemas/Product'
 *         - type: object
 *           properties:
 *             originalPrice:
 *               type: number
 *               description: Original price before discount
 *             hasDiscount:
 *               type: boolean
 *               description: Whether this product has a discount applied
 *             discountPercent:
 *               type: number
 *               description: The percentage of discount applied
 *             discountSource:
 *               type: string
 *               enum: [offer, customer]
 *               description: Source of the discount (offer or customer)
 */

export default function setupProductRoutes(): Router {
  const router = Router({ mergeParams: true }) // Enable mergeParams to inherit workspaceId
  const productController = new ProductController()

  logger.debug("Setting up product routes")

  // All routes require authentication
  router.use(authMiddleware)

  // All routes require workspace validation
  router.use(workspaceValidationMiddleware)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products:
   *   get:
   *     summary: Get all products for a workspace
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term to filter product names
   *       - in: query
   *         name: categoryId
   *         schema:
   *           type: string
   *         description: Filter by category ID
   
   *       - in: query
   *         name: status
   *         schema:
   *           type: string
   *           enum: [ACTIVE, INACTIVE, DRAFT, IN_STOCK, OUT_OF_STOCK]
   *         description: Filter by product status
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         description: Number of items per page
   *     responses:
   *       200:
   *         description: List of products with pagination info
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 products:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Product'
   *                 pagination:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.get("/", productController.getAllProducts)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products/export:
   *   get:
   *     summary: Export all products to CSV
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *     responses:
   *       200:
   *         description: CSV file with all products
   *         content:
   *           text/csv:
   *             schema:
   *               type: string
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.get("/export", productController.exportProductsCsv)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products/import:
   *   post:
   *     summary: Import products from CSV
   *     description: Upsert products - creates new or updates existing by SKU. Uses supplierName and categoryName with lookup.
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               file:
   *                 type: string
   *                 format: binary
   *                 description: CSV file to import
   *     responses:
   *       200:
   *         description: Import results
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                 results:
   *                   type: object
   *                   properties:
   *                     created:
   *                       type: integer
   *                     updated:
   *                       type: integer
   *                     errors:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           row:
   *                             type: integer
   *                           sku:
   *                             type: string
   *                           error:
   *                             type: string
   *       400:
   *         description: Invalid CSV or missing file
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.post(
    "/import",
    csvUpload.single("file"),
    productController.importProductsCsv
  )

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products/{id}:
   *   get:
   *     summary: Get a product by ID
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: The product ID
   *     responses:
   *       200:
   *         description: A product object
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Product'
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Product not found
   */
  // @ts-ignore
  router.get("/:id", productController.getProductById)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/categories/{categoryId}/products:
   *   get:
   *     summary: Get products by category
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: path
   *         name: categoryId
   *         schema:
   *           type: string
   *         required: true
   *         description: The category ID
   *     responses:
   *       200:
   *         description: List of products in the category
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Product'
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.get(
    "/categories/:categoryId/products",
    productController.getProductsByCategory
  )

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products:
   *   post:
   *     summary: Create a new product
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Product'
   *     responses:
   *       201:
   *         description: Created product
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Product'
   *       400:
   *         description: Invalid input or missing required parameters
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.post(
    "/",
    authMiddleware,
    workspaceValidationMiddleware,
    uploadImage.array("images", 10), // Supporto per massimo 10 immagini
    handleUploadError,
    productController.createProduct
  )

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products/{id}:
   *   put:
   *     summary: Update a product
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: The product ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Product'
   *     responses:
   *       200:
   *         description: Updated product
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Product'
   *       400:
   *         description: Invalid input or missing required parameters
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Product not found
   */
  // @ts-ignore
  router.put(
    "/:id",
    authMiddleware,
    workspaceValidationMiddleware,
    uploadImage.array("images", 10), // Supporto per massimo 10 immagini
    handleUploadError,
    productController.updateProduct
  )

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products/{id}:
   *   delete:
   *     summary: Delete a product
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: The product ID
   *     responses:
   *       200:
   *         description: Product deleted successfully
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.delete("/:id", productController.deleteProduct)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products/{id}/stock:
   *   patch:
   *     summary: Update a product's stock
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: The product ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               stock:
   *                 type: integer
   *                 minimum: 0
   *                 description: The new stock value
   *             required:
   *               - stock
   *     responses:
   *       200:
   *         description: Updated product with new stock
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Product'
   *       400:
   *         description: Invalid input or missing required parameters
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.patch("/:id/stock", productController.updateProductStock)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products/{id}/status:
   *   patch:
   *     summary: Update a product's status
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: path
   *         name: id
   *         schema:
   *           type: string
   *         required: true
   *         description: The product ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               status:
   *                 type: string
   *                 enum: [ACTIVE, INACTIVE, DRAFT]
   *                 description: The new status value
   *             required:
   *               - status
   *     responses:
   *       200:
   *         description: Updated product with new status
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Product'
   *       400:
   *         description: Invalid input or missing required parameters
   *       401:
   *         description: Unauthorized
   *       404:
   *         description: Product not found
   */
  // @ts-ignore
  router.patch("/:id/status", productController.updateProductStatus)

  /**
   * @swagger
   * /api/workspaces/{workspaceId}/products-with-discounts:
   *   get:
   *     summary: Get all products with applicable discounts
   *     tags: [Products]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: workspaceId
   *         schema:
   *           type: string
   *         required: true
   *         description: The workspace ID
   *       - in: query
   *         name: customerDiscount
   *         schema:
   *           type: number
   *         description: Customer discount percentage to apply
   *     responses:
   *       200:
   *         description: List of products with discounts applied
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ProductWithDiscounts'
   *       400:
   *         description: Missing required parameters
   *       401:
   *         description: Unauthorized
   */
  // @ts-ignore
  router.get(
    "/products-with-discounts",
    productController.getProductsWithDiscounts
  )

  return router
}
