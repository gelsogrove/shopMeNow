import { Router } from "express"
import { asyncMiddleware } from "../../../middlewares/async.middleware"
import { CheckoutController } from "../controllers/checkout.controller"
import { checkoutLimiter } from "../../../config/rate-limiters"

const router = Router()
const checkoutController = new CheckoutController()

/**
 * @swagger
 * /api/checkout/token:
 *   get:
 *     summary: Validate checkout token and get order data (TOKEN-ONLY)
 *     tags: [Checkout]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The checkout token
 *     responses:
 *       200:
 *         description: Token validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 customer:
 *                   type: object
 *                 prodotti:
 *                   type: array
 *                 workspaceId:
 *                   type: string
 *       400:
 *         description: Invalid or expired token
 *       500:
 *         description: Server error
 */
router.get(
  "/token",
  asyncMiddleware(checkoutController.validateToken.bind(checkoutController))
)

/**
 * @swagger
 * /api/checkout/submit:
 *   post:
 *     summary: Submit order and send notifications
 *     tags: [Checkout]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - prodotti
 *               - shippingAddress
 *               - billingAddress
 *             properties:
 *               token:
 *                 type: string
 *               prodotti:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     codice:
 *                       type: string
 *                     descrizione:
 *                       type: string
 *                     qty:
 *                       type: number
 *                     prezzo:
 *                       type: number
 *               shippingAddress:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   postalCode:
 *                     type: string
 *               billingAddress:
 *                 type: object
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 orderId:
 *                   type: string
 *                 orderCode:
 *                   type: string
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Server error
 */
// 🔒 SECURITY: Rate limited to 20 orders per hour per IP
router.post(
  "/submit",
  checkoutLimiter,
  asyncMiddleware(checkoutController.submitOrder.bind(checkoutController))
)

export { router as checkoutRouter }
