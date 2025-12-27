"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cartRouter = void 0;
const express_1 = require("express");
const rate_limiters_1 = require("../../../config/rate-limiters");
const async_middleware_1 = require("../../../middlewares/async.middleware");
const auth_middleware_1 = require("../../../middlewares/auth.middleware");
const cart_controller_1 = require("../controllers/cart.controller");
const router = (0, express_1.Router)();
exports.cartRouter = router;
const cartController = new cart_controller_1.CartController();
// 🔒 SECURITY: Apply rate limiting to all cart operations (30 req/min per IP)
router.use(rate_limiters_1.cartLimiter);
/**
 * @swagger
 * /api/cart/{token}:
 *   get:
 *     summary: Get cart data by token
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart token
 *     responses:
 *       200:
 *         description: Cart data retrieved successfully
 *       404:
 *         description: Cart not found
 */
router.get("/:token", (0, async_middleware_1.asyncMiddleware)(cartController.getCartByToken.bind(cartController)));
/**
 * @swagger
 * /api/cart/{token}/items:
 *   post:
 *     summary: Add product to cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product added to cart successfully
 *       404:
 *         description: Cart or product not found
 */
router.post("/:token/items", (0, async_middleware_1.asyncMiddleware)(cartController.addItemToCart.bind(cartController)));
/**
 * @swagger
 * /api/cart/{token}/items/{productId}:
 *   delete:
 *     summary: Remove product from cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart token
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID to remove
 *     responses:
 *       200:
 *         description: Product removed from cart successfully
 *       404:
 *         description: Cart or product not found
 */
router.delete("/:token/items/:productId", (0, async_middleware_1.asyncMiddleware)(cartController.removeCartItem.bind(cartController)));
/**
 * @swagger
 * /api/cart/{token}/items/{productId}:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart token
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       404:
 *         description: Cart or product not found
 */
router.put("/:token/items/:productId", (0, async_middleware_1.asyncMiddleware)(cartController.updateCartItem.bind(cartController)));
/**
 * @swagger
 * /api/cart/{token}/remove:
 *   delete:
 *     summary: Remove product from cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart token
 *       - in: query
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: The product ID to remove
 *     responses:
 *       200:
 *         description: Product removed from cart successfully
 *       404:
 *         description: Cart or product not found
 */
router.delete("/:token/remove", (0, async_middleware_1.asyncMiddleware)(cartController.removeCartItem.bind(cartController)));
/**
 * @swagger
 * /api/cart/{token}/update:
 *   put:
 *     summary: Update cart item quantity
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Cart item updated successfully
 *       404:
 *         description: Cart or product not found
 */
router.put("/:token/update", (0, async_middleware_1.asyncMiddleware)(cartController.updateCartItem.bind(cartController)));
/**
 * @swagger
 * /api/cart/{token}/checkout:
 *   post:
 *     summary: Checkout cart and create order
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart token
 *     responses:
 *       200:
 *         description: Order created successfully
 *       404:
 *         description: Cart not found
 */
router.post("/:token/checkout", (0, async_middleware_1.asyncMiddleware)(cartController.checkoutByToken.bind(cartController)));
/**
 * @swagger
 * /api/workspaces/{workspaceId}/cart/calculate-price:
 *   post:
 *     summary: Calculate discounted price for a product (Admin)
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The workspace ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Price calculated successfully
 *       404:
 *         description: Product not found
 */
router.post("/calculate-price", auth_middleware_1.authMiddleware, (0, async_middleware_1.asyncMiddleware)(cartController.calculatePrice.bind(cartController)));
//# sourceMappingURL=cart.routes.js.map