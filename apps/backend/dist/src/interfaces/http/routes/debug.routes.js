"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const product_repository_1 = require("../../../repositories/product.repository");
const debug_controller_1 = require("../controllers/debug.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
const router = (0, express_1.Router)();
const productRepository = new product_repository_1.ProductRepository();
const debugController = new debug_controller_1.DebugController(productRepository);
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
router.post("/search-products", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, (req, res) => debugController.searchProducts(req, res));
exports.default = router;
//# sourceMappingURL=debug.routes.js.map