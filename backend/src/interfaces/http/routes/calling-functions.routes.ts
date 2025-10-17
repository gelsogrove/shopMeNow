/**
 * Calling Functions Routes
 *
 * Endpoints for LLM-callable functions:
 * - POST /api/workspaces/{workspaceId}/calling-functions/addProduct
 * - POST /api/workspaces/{workspaceId}/calling-functions/repeatOrder
 * - POST /api/workspaces/{workspaceId}/calling-functions/searchProduct
 */

import { PrismaClient } from "@prisma/client"
import { Request, Response, Router } from "express"
import { FunctionHandlerService } from "../../../application/services/function-handler.service"
import logger from "../../../utils/logger"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

const router = Router()
const prisma = new PrismaClient()
const functionHandlerService = new FunctionHandlerService()

/**
 * @swagger
 * /api/workspaces/{workspaceId}/calling-functions/addProduct:
 *   post:
 *     summary: Add product to cart (LLM-callable)
 *     tags: [Calling Functions]
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
 *               productCode:
 *                 type: string
 *               quantity:
 *                 type: number
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product added to cart
 */
router.post(
  "/:workspaceId/calling-functions/addProduct",
  authMiddleware,
  workspaceValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = (req as any).workspaceId
      const userId = (req as any).user?.id
      const { productCode, quantity, notes } = req.body

      logger.info("🛒 POST /calling-functions/addProduct called", {
        workspaceId,
        userId,
        productCode,
        quantity,
      })

      // Validazione parametri
      if (!productCode || !quantity) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters",
          message: "productCode and quantity are required",
        })
      }

      // Recupera customer associato all'utente o al workspace
      const customer = await prisma.customers.findFirst({
        where: {
          // Per ora usiamo il primo customer dell'utente
          // In futuro potremmo avere una relazione diretta user -> customer
          workspaceId,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (!customer) {
        logger.warn("⚠️ No customer found for user", { userId, workspaceId })
        return res.status(404).json({
          success: false,
          error: "Customer not found",
          message: "No customer associated with this account",
        })
      }

      // Chiama il domain function
      const result = await functionHandlerService.handleAddProduct(
        {
          productCode,
          quantity: parseInt(quantity),
          notes,
        },
        customer,
        workspaceId
      )

      res.json(result)
    } catch (error) {
      logger.error("❌ Error in addProduct endpoint:", error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        message: "Failed to add product to cart",
      })
    }
  }
)

/**
 * @swagger
 * /api/workspaces/{workspaceId}/calling-functions/repeatOrder:
 *   post:
 *     summary: Repeat previous order (LLM-callable)
 *     tags: [Calling Functions]
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
 *               orderCode:
 *                 type: string
 *                 description: Optional - if omitted, uses last order
 *     responses:
 *       200:
 *         description: Order repeated and added to cart
 */
router.post(
  "/:workspaceId/calling-functions/repeatOrder",
  authMiddleware,
  workspaceValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = (req as any).workspaceId
      const userId = (req as any).user?.id
      const { orderCode } = req.body

      logger.info("🔄 POST /calling-functions/repeatOrder called", {
        workspaceId,
        userId,
        orderCode,
      })

      // Recupera customer
      const customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (!customer) {
        logger.warn("⚠️ No customer found for user", { userId, workspaceId })
        return res.status(404).json({
          success: false,
          error: "Customer not found",
          message: "No customer associated with this account",
        })
      }

      // Chiama il domain function
      const result = await functionHandlerService.handleRepeatOrder(
        {
          orderCode,
        },
        customer,
        workspaceId
      )

      res.json(result)
    } catch (error) {
      logger.error("❌ Error in repeatOrder endpoint:", error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        message: "Failed to repeat order",
      })
    }
  }
)

/**
 * @swagger
 * /api/workspaces/{workspaceId}/calling-functions/searchProduct:
 *   post:
 *     summary: Register product search for analytics (LLM-callable, background function)
 *     tags: [Calling Functions]
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
 *               productName:
 *                 type: string
 *                 description: Name of the product searched
 *     responses:
 *       200:
 *         description: Search registered for analytics
 */
router.post(
  "/:workspaceId/calling-functions/searchProduct",
  authMiddleware,
  workspaceValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      const workspaceId = (req as any).workspaceId
      const userId = (req as any).user?.id
      const { productName } = req.body

      logger.info("🔍 POST /calling-functions/searchProduct called", {
        workspaceId,
        userId,
        productName,
      })

      // Validazione parametri
      if (!productName) {
        return res.status(400).json({
          success: false,
          error: "Missing required parameters",
          message: "productName is required",
        })
      }

      // Recupera customer
      const customer = await prisma.customers.findFirst({
        where: {
          workspaceId,
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      if (!customer) {
        logger.warn("⚠️ No customer found for user", { userId, workspaceId })
        return res.status(404).json({
          success: false,
          error: "Customer not found",
          message: "No customer associated with this account",
        })
      }

      // Chiama il domain function
      const result = await functionHandlerService.handleSearchProduct(
        {
          productName,
        },
        customer,
        workspaceId
      )

      res.json(result)
    } catch (error) {
      logger.error("❌ Error in searchProduct endpoint:", error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        message: "Failed to register search",
      })
    }
  }
)

export default router
