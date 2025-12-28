"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderController = void 0;
const database_1 = require("@echatbot/database");
const billing_service_1 = require("../../../application/services/billing.service");
const order_service_1 = require("../../../application/services/order.service");
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
class OrderController {
    constructor(orderService) {
        this.getAllOrders = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const effectiveWorkspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                if (!effectiveWorkspaceId) {
                    logger_1.default.error("WorkspaceId missing in request");
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const { search, customerId, status, paymentStatus, dateFrom, dateTo, page, limit, } = req.query;
                const pageNumber = page ? parseInt(page) : undefined;
                const limitNumber = limit ? parseInt(limit) : undefined;
                const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
                const dateToParsed = dateTo ? new Date(dateTo) : undefined;
                const result = yield this.orderService.getAllOrders(effectiveWorkspaceId, {
                    search: search,
                    customerId: customerId,
                    status: status,
                    // paymentStatus removed
                    dateFrom: dateFromParsed,
                    dateTo: dateToParsed,
                    page: pageNumber,
                    limit: limitNumber,
                });
                return res.json({
                    orders: result.orders,
                    pagination: {
                        total: result.total,
                        page: result.page,
                        totalPages: result.totalPages,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error fetching orders:", error);
                return res.status(500).json({
                    message: "An error occurred while fetching orders",
                    error: error.message,
                });
            }
        });
        this.getOrderById = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const order = yield this.orderService.getOrderById(id, workspaceId);
                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                return res.json(order);
            }
            catch (error) {
                logger_1.default.error(`Error getting order by ID:`, error);
                return res.status(500).json({
                    message: "An error occurred while fetching the order",
                    error: error.message,
                });
            }
        });
        this.getOrderByCode = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { orderCode } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const order = yield this.orderService.getOrderByCode(orderCode, workspaceId);
                if (!order) {
                    return res.status(404).json({ message: "Order not found" });
                }
                return res.json(order);
            }
            catch (error) {
                logger_1.default.error(`Error getting order by code:`, error);
                return res.status(500).json({
                    message: "An error occurred while fetching the order",
                    error: error.message,
                });
            }
        });
        this.getOrdersByCustomer = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { customerId } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const orders = yield this.orderService.getOrdersByCustomerId(customerId, workspaceId);
                return res.json(orders);
            }
            catch (error) {
                logger_1.default.error(`Error getting orders by customer:`, error);
                return res.status(500).json({
                    message: "An error occurred while fetching orders by customer",
                    error: error.message,
                });
            }
        });
        this.createOrder = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                const orderData = req.body;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                // Validate required fields
                if (!orderData.customerId) {
                    return res.status(400).json({
                        message: "Customer ID is required",
                        error: "Missing required field: customerId",
                    });
                }
                if (!orderData.items ||
                    !Array.isArray(orderData.items) ||
                    orderData.items.length === 0) {
                    return res.status(400).json({
                        message: "Order items are required",
                        error: "Missing or invalid field: items",
                    });
                }
                if (!orderData.totalAmount || orderData.totalAmount <= 0) {
                    return res.status(400).json({
                        message: "Valid total amount is required",
                        error: "Missing or invalid field: totalAmount",
                    });
                }
                if (!orderData.workspaceId) {
                    orderData.workspaceId = workspaceId;
                }
                const order = yield this.orderService.createOrder(orderData);
                // 💰 BILLING: Order cost (€1.50) will be tracked when status becomes CONFIRMED
                // This happens in order.service.ts -> updateOrderStatus()
                return res.status(201).json(order);
            }
            catch (error) {
                logger_1.default.error("Error creating order:", error);
                return res.status(((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("required")) ? 400 : 500).json({
                    message: "An error occurred while creating the order",
                    error: error.message,
                });
            }
        });
        this.updateOrder = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const orderData = req.body;
                // Validate totalAmount if provided
                if (orderData.totalAmount !== undefined && orderData.totalAmount <= 0) {
                    return res.status(400).json({
                        message: "Total amount must be greater than 0",
                        error: "Invalid field: totalAmount",
                    });
                }
                const updatedOrder = yield this.orderService.updateOrder(id, orderData, workspaceId);
                if (!updatedOrder) {
                    return res.status(404).json({ message: "Order not found" });
                }
                return res.json(updatedOrder);
            }
            catch (error) {
                logger_1.default.error("Error updating order:", error);
                return res
                    .status(((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes("greater than 0")) ? 400 : 500)
                    .json({
                    message: "An error occurred while updating the order",
                    error: error.message,
                });
            }
        });
        this.deleteOrder = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                const workspaceId = req.params.workspaceId;
                // Use workspaceId from path params (required for this endpoint)
                if (!workspaceId) {
                    return res.status(400).json({
                        success: false,
                        error: "Workspace ID is required in path",
                    });
                }
                // Verify user has access to this workspace
                const user = req.user;
                if (!user) {
                    return res.status(401).json({
                        success: false,
                        error: "Authentication required",
                    });
                }
                const hasAccess = (_a = user.workspaces) === null || _a === void 0 ? void 0 : _a.some((w) => w.id === workspaceId);
                if (!hasAccess) {
                    return res.status(403).json({
                        success: false,
                        error: "Access denied to this workspace",
                    });
                }
                yield this.orderService.deleteOrder(id, workspaceId);
                return res.status(200).json({
                    success: true,
                    message: "Order deleted successfully",
                });
            }
            catch (error) {
                logger_1.default.error(`Error deleting order ${req.params.id}:`, error);
                return res.status(500).json({
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to delete order",
                });
            }
        });
        this.updateOrderStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                const { status } = req.body;
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                if (!status ||
                    !Object.values(database_1.OrderStatus).includes(status)) {
                    return res.status(400).json({
                        message: "Valid status is required",
                        error: "Missing or invalid status parameter",
                        validStatuses: Object.values(database_1.OrderStatus),
                    });
                }
                const updatedOrder = yield this.orderService.updateOrderStatus(id, status, workspaceId);
                if (!updatedOrder) {
                    return res.status(404).json({ message: "Order not found" });
                }
                return res.json(updatedOrder);
            }
            catch (error) {
                logger_1.default.error("Error updating order status:", error);
                return res.status(500).json({
                    message: "An error occurred while updating order status",
                    error: error.message,
                });
            }
        });
        // Payment status is now handled by PaymentDetails table
        this.getOrderAnalytics = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                const { status, 
                // paymentStatus removed
                dateFrom, dateTo, } = req.query;
                const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
                const dateToParsed = dateTo ? new Date(dateTo) : undefined;
                const analytics = yield this.orderService.getOrderAnalytics(workspaceId, {
                    status: status,
                    // Payment status removed
                    dateFrom: dateFromParsed,
                    dateTo: dateToParsed,
                });
                return res.json(analytics);
            }
            catch (error) {
                logger_1.default.error("Error fetching order analytics:", error);
                return res.status(500).json({
                    message: "An error occurred while fetching order analytics",
                    error: error.message,
                });
            }
        });
        this.getOrdersByDateRange = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceIdParam = req.params.workspaceId;
                const workspaceIdQuery = req.query.workspaceId;
                const workspaceIdHeader = req.headers["x-workspace-id"];
                const workspaceId = workspaceIdParam || workspaceIdQuery || workspaceIdHeader;
                const { startDate, endDate } = req.query;
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "WorkspaceId is required",
                        error: "Missing workspaceId parameter",
                    });
                }
                if (!startDate || !endDate) {
                    return res.status(400).json({
                        message: "Start date and end date are required",
                        error: "Missing startDate or endDate parameter",
                    });
                }
                const startDateParsed = new Date(startDate);
                const endDateParsed = new Date(endDate);
                if (isNaN(startDateParsed.getTime()) || isNaN(endDateParsed.getTime())) {
                    return res.status(400).json({
                        message: "Invalid date format",
                        error: "Dates must be in valid ISO format",
                    });
                }
                const orders = yield this.orderService.getOrdersByDateRange(workspaceId, startDateParsed, endDateParsed);
                return res.json(orders);
            }
            catch (error) {
                logger_1.default.error("Error fetching orders by date range:", error);
                return res.status(500).json({
                    message: "An error occurred while fetching orders by date range",
                    error: error.message,
                });
            }
        });
        this.orderService = orderService || new order_service_1.OrderService();
        this.billingService = new billing_service_1.BillingService(prisma_1.prisma);
    }
}
exports.OrderController = OrderController;
//# sourceMappingURL=order.controller.js.map