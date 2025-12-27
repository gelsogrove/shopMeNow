"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrderRouter = createOrderRouter;
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
function createOrderRouter() {
    const router = (0, express_1.Router)({ mergeParams: true }); // Enable mergeParams to inherit workspaceId
    const orderController = new order_controller_1.OrderController();
    // Apply auth middleware to all routes
    router.use(auth_middleware_1.authMiddleware);
    // All routes require workspace validation
    router.use(workspace_validation_middleware_1.workspaceValidationMiddleware);
    // Log route registration
    logger_1.default.info('Setting up order routes');
    // GET /orders - Get all orders with filters and pagination
    router.get('/', orderController.getAllOrders);
    // GET /orders/analytics - Get order analytics
    router.get('/analytics', orderController.getOrderAnalytics);
    // GET /orders/date-range - Get orders by date range
    router.get('/date-range', orderController.getOrdersByDateRange);
    // GET /orders/:id - Get order by ID
    router.get('/:id', orderController.getOrderById);
    // GET /orders/code/:orderCode - Get order by order code
    router.get('/code/:orderCode', orderController.getOrderByCode);
    // GET /orders/customer/:customerId - Get orders by customer ID
    router.get('/customer/:customerId', orderController.getOrdersByCustomer);
    // POST /orders - Create new order
    router.post('/', orderController.createOrder);
    // PUT /orders/:id - Update order
    router.put('/:id', orderController.updateOrder);
    // DELETE /orders/:id - Delete order
    router.delete('/:id', orderController.deleteOrder);
    // PATCH /orders/:id/status - Update order status
    router.patch('/:id/status', orderController.updateOrderStatus);
    // Payment status is now handled by PaymentDetails table
    logger_1.default.info('Order routes configured');
    return router;
}
exports.default = createOrderRouter;
//# sourceMappingURL=order.routes.js.map