import { Router } from "express"
import { OrdersController } from "../controllers/orders.controller"
import { jwtAuthMiddleware } from "../middlewares/jwt-auth.middleware"

const router = Router()
const ordersController = new OrdersController()

/**
 * @swagger
 * /api/orders:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get customer orders list
 *     description: Returns list of orders for the authenticated customer
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: JWT token for authentication
 *     responses:
 *       200:
 *         description: Orders list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     customer:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         email:
 *                           type: string
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           orderCode:
 *                             type: string
 *                           date:
 *                             type: string
 *                             format: date-time
 *                           status:
 *                             type: string
 *                           totalAmount:
 *                             type: number
 *                           itemsCount:
 *                             type: number
 *                           invoiceUrl:
 *                             type: string
 *                           ddtUrl:
 *                             type: string
 *       401:
 *         description: Invalid or expired token
 *       403:
 *         description: Token not authorized for orders access
 *       500:
 *         description: Internal server error
 */
router.get("/", jwtAuthMiddleware, ordersController.getCustomerOrders.bind(ordersController))

/**
 * @swagger
 * /api/orders/{orderCode}:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Get order detail
 *     description: Returns detailed information for a specific order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Order code (e.g., ORD-2025-001)
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: JWT token for authentication
 *     responses:
 *       200:
 *         description: Order detail retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     order:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         orderCode:
 *                           type: string
 *                         date:
 *                           type: string
 *                           format: date-time
 *                         status:
 *                           type: string
 *                         totalAmount:
 *                           type: number
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               itemType:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               quantity:
 *                                 type: number
 *                               unitPrice:
 *                                 type: number
 *                               totalPrice:
 *                                 type: number
 *                         invoiceUrl:
 *                           type: string
 *                         ddtUrl:
 *                           type: string
 *                     customer:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *       401:
 *         description: Invalid or expired token
 *       403:
 *         description: Token not authorized for this order
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get("/:orderCode", jwtAuthMiddleware, ordersController.getOrderDetail.bind(ordersController))

/**
 * @swagger
 * /api/orders/{orderCode}/invoice:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Download order invoice
 *     description: Downloads the invoice PDF for a specific order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Order code (e.g., ORD-2025-001)
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: JWT token for authentication
 *     responses:
 *       200:
 *         description: Invoice PDF downloaded successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Invalid or expired token
 *       403:
 *         description: Token not authorized for this order
 *       404:
 *         description: Order or invoice not found
 *       500:
 *         description: Internal server error
 */
router.get("/:orderCode/invoice", jwtAuthMiddleware, ordersController.downloadInvoice.bind(ordersController))

/**
 * @swagger
 * /api/orders/{orderCode}/ddt:
 *   get:
 *     tags:
 *       - Orders
 *     summary: Download order DDT
 *     description: Downloads the DDT PDF for a specific order
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Order code (e.g., ORD-2025-001)
 *       - in: query
 *         name: token
 *         schema:
 *           type: string
 *         description: JWT token for authentication
 *     responses:
 *       200:
 *         description: DDT PDF downloaded successfully
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Invalid or expired token
 *       403:
 *         description: Token not authorized for this order
 *       404:
 *         description: Order or DDT not found
 *       500:
 *         description: Internal server error
 */
router.get("/:orderCode/ddt", jwtAuthMiddleware, ordersController.downloadDdt.bind(ordersController))

export default router
