import { Router } from "express"
import { ProductRepository } from "../../../repositories/product.repository"
import { DebugController } from "../controllers/debug.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

const router = Router()
const productRepository = new ProductRepository()
const debugController = new DebugController(productRepository)

/**
 * @swagger
 * /api/workspaces/{workspaceId}/debug/search-products:
 *   post:
 *     summary: Debug product search
 *     tags: [Debug]
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
 *             properties:
 *               query:
 *                 type: string
 *     responses:
 *       200:
 *         description: Search analysis and results
 */
router.post(
  "/search-products",
  authMiddleware,
  workspaceValidationMiddleware,
  (req, res) => debugController.searchProducts(req, res)
)

router.post(
  "/fix-playground-flags",
  (req, res) => debugController.fixPlaygroundFlags(req, res)
)

export default router
