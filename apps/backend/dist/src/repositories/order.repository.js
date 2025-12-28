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
exports.OrderRepository = void 0;
const database_1 = require("@echatbot/database");
const order_entity_1 = require("../domain/entities/order.entity");
const logger_1 = __importDefault(require("../utils/logger"));
class OrderRepository {
    constructor() {
        this.prisma = database_1.prisma;
    }
    findAll(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("OrderRepository.findAll called with:", {
                    workspaceId,
                    filters,
                });
                const where = {
                    workspaceId,
                };
                // Search filter (order code or customer name)
                if (filters === null || filters === void 0 ? void 0 : filters.search) {
                    where.OR = [
                        { orderCode: { contains: filters.search, mode: "insensitive" } },
                        {
                            customer: {
                                name: { contains: filters.search, mode: "insensitive" },
                            },
                        },
                    ];
                }
                // Customer filter
                if (filters === null || filters === void 0 ? void 0 : filters.customerId) {
                    where.customerId = filters.customerId;
                }
                // Status filter
                if (filters === null || filters === void 0 ? void 0 : filters.status) {
                    where.status = filters.status;
                }
                // Payment status is now handled via PaymentDetails table
                // Date range filter
                if ((filters === null || filters === void 0 ? void 0 : filters.dateFrom) || (filters === null || filters === void 0 ? void 0 : filters.dateTo)) {
                    where.createdAt = {};
                    if (filters.dateFrom) {
                        where.createdAt.gte = filters.dateFrom;
                    }
                    if (filters.dateTo) {
                        where.createdAt.lte = filters.dateTo;
                    }
                }
                const page = (filters === null || filters === void 0 ? void 0 : filters.page) || 1;
                const limit = (filters === null || filters === void 0 ? void 0 : filters.limit) || 50;
                const skip = (page - 1) * limit;
                // Count total orders
                const total = yield this.prisma.orders.count({ where });
                const totalPages = Math.ceil(total / limit);
                if (total === 0) {
                    return {
                        orders: [],
                        total: 0,
                        page,
                        totalPages: 0,
                    };
                }
                // Get orders with related data
                const ordersData = yield this.prisma.orders.findMany({
                    where,
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                    skip,
                    take: limit,
                });
                const orders = ordersData.map((data) => this.mapToDomainEntity(data));
                return {
                    orders,
                    total,
                    page,
                    totalPages,
                };
            }
            catch (error) {
                logger_1.default.error("Error in findAll:", error);
                return {
                    orders: [],
                    total: 0,
                    page: (filters === null || filters === void 0 ? void 0 : filters.page) || 1,
                    totalPages: 0,
                };
            }
        });
    }
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const order = yield this.prisma.orders.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                });
                if (!order)
                    return null;
                return this.mapToDomainEntity(order);
            }
            catch (error) {
                logger_1.default.error(`Error in findById for order ${id}:`, error);
                return null;
            }
        });
    }
    findByOrderCode(orderCode, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const order = yield this.prisma.orders.findFirst({
                    where: {
                        orderCode,
                        workspaceId,
                    },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                });
                if (!order)
                    return null;
                return this.mapToDomainEntity(order);
            }
            catch (error) {
                logger_1.default.error(`Error in findByOrderCode for order ${orderCode}:`, error);
                return null;
            }
        });
    }
    findByCustomerId(customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orders = yield this.prisma.orders.findMany({
                    where: {
                        customerId,
                        workspaceId,
                    },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                return orders.map((order) => this.mapToDomainEntity(order));
            }
            catch (error) {
                logger_1.default.error(`Error in findByCustomerId for customer ${customerId}:`, error);
                return [];
            }
        });
    }
    findLatestProcessingByCustomer(customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.prisma.orders.findFirst({
                    where: {
                        customerId,
                        workspaceId,
                        status: database_1.OrderStatus.PROCESSING,
                    },
                    orderBy: { createdAt: "desc" },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true, // ✅ Include services
                            },
                        },
                    },
                });
                return data ? this.mapToDomainEntity(data) : null;
            }
            catch (error) {
                logger_1.default.error(`Error in findLatestProcessingByCustomer for customer ${customerId}:`, error);
                return null;
            }
        });
    }
    create(order) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const createdOrder = yield this.prisma.orders.create({
                    data: {
                        orderCode: order.orderCode,
                        customerId: order.customerId,
                        workspaceId: order.workspaceId,
                        status: order.status,
                        paymentMethod: order.paymentMethod,
                        totalAmount: order.totalAmount,
                        shippingAmount: order.shippingAmount,
                        taxAmount: order.taxAmount,
                        shippingAddress: order.shippingAddress,
                        billingAddress: order.billingAddress,
                        notes: order.notes,
                        discountCode: order.discountCode,
                        discountAmount: order.discountAmount,
                        trackingNumber: order.trackingNumber || null, // optional
                        items: {
                            create: ((_a = order.items) === null || _a === void 0 ? void 0 : _a.map((item) => ({
                                itemType: item.itemType || "PRODUCT",
                                productId: item.productId,
                                serviceId: item.serviceId || null,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                totalPrice: item.totalPrice,
                                productVariant: item.productVariant,
                            }))) || [],
                        },
                    },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true, // ✅ Include services
                            },
                        },
                    },
                });
                return this.mapToDomainEntity(createdOrder);
            }
            catch (error) {
                logger_1.default.error("Error creating order:", error);
                throw new Error(`Failed to create order: ${error.message}`);
            }
        });
    }
    update(id, order, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Prepare update data
                const updateData = {
                    status: order.status,
                    paymentMethod: order.paymentMethod,
                    totalAmount: order.totalAmount,
                    shippingAmount: order.shippingAmount,
                    taxAmount: order.taxAmount,
                    shippingAddress: order.shippingAddress,
                    billingAddress: order.billingAddress,
                    notes: order.notes,
                    discountCode: order.discountCode,
                    discountAmount: order.discountAmount,
                    trackingNumber: (_a = order.trackingNumber) !== null && _a !== void 0 ? _a : undefined,
                    updatedAt: new Date(),
                };
                // Handle items update efficiently
                if (order.items && Array.isArray(order.items)) {
                    logger_1.default.info(`Updating order ${id} with ${order.items.length} items`);
                    // Delete existing items and create new ones in a transaction
                    yield this.prisma.orderItems.deleteMany({
                        where: { orderId: id },
                    });
                    updateData.items = {
                        create: order.items.map((item) => ({
                            itemType: item.itemType || "PRODUCT",
                            productId: item.productId,
                            serviceId: item.serviceId || null,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.totalPrice,
                            productVariant: item.productVariant,
                        })),
                    };
                }
                const updatedOrder = yield this.prisma.orders.update({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: updateData,
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true, // ✅ Include services
                            },
                        },
                    },
                });
                logger_1.default.info(`Order ${id} updated successfully`);
                return this.mapToDomainEntity(updatedOrder);
            }
            catch (error) {
                logger_1.default.error(`Error updating order ${id}:`, error);
                return null;
            }
        });
    }
    delete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // First delete all order items associated with this order
                yield this.prisma.orderItems.deleteMany({
                    where: {
                        orderId: id,
                    },
                });
                // Then delete the order itself
                yield this.prisma.orders.delete({
                    where: {
                        id,
                        workspaceId,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`Error deleting order ${id}:`, error);
                throw new Error(`Failed to delete order: ${error.message}`);
            }
        });
    }
    updateStatus(id, status, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const updatedOrder = yield this.prisma.orders.update({
                    where: {
                        id,
                        workspaceId,
                    },
                    data: {
                        status,
                        updatedAt: new Date(),
                    },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true, // ✅ Include services
                            },
                        },
                    },
                });
                return this.mapToDomainEntity(updatedOrder);
            }
            catch (error) {
                logger_1.default.error(`Error updating status for order ${id}:`, error);
                return null;
            }
        });
    }
    getOrdersByDateRange(workspaceId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const orders = yield this.prisma.orders.findMany({
                    where: {
                        workspaceId,
                        createdAt: {
                            gte: startDate,
                            lte: endDate,
                        },
                    },
                    include: {
                        customer: true,
                        items: {
                            include: {
                                product: true,
                                service: true, // ✅ Include services
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                return orders.map((order) => this.mapToDomainEntity(order));
            }
            catch (error) {
                logger_1.default.error("Error getting orders by date range:", error);
                return [];
            }
        });
    }
    getOrdersCount(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = {
                    workspaceId,
                };
                if (filters === null || filters === void 0 ? void 0 : filters.status) {
                    where.status = filters.status;
                }
                // Payment status filtering removed
                if ((filters === null || filters === void 0 ? void 0 : filters.dateFrom) || (filters === null || filters === void 0 ? void 0 : filters.dateTo)) {
                    where.createdAt = {};
                    if (filters.dateFrom) {
                        where.createdAt.gte = filters.dateFrom;
                    }
                    if (filters.dateTo) {
                        where.createdAt.lte = filters.dateTo;
                    }
                }
                return yield this.prisma.orders.count({ where });
            }
            catch (error) {
                logger_1.default.error("Error counting orders:", error);
                return 0;
            }
        });
    }
    getTotalRevenue(workspaceId, filters) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const where = {
                    workspaceId,
                    // Payment status removed
                };
                if ((filters === null || filters === void 0 ? void 0 : filters.dateFrom) || (filters === null || filters === void 0 ? void 0 : filters.dateTo)) {
                    where.createdAt = {};
                    if (filters.dateFrom) {
                        where.createdAt.gte = filters.dateFrom;
                    }
                    if (filters.dateTo) {
                        where.createdAt.lte = filters.dateTo;
                    }
                }
                const result = yield this.prisma.orders.aggregate({
                    where,
                    _sum: {
                        totalAmount: true,
                    },
                });
                return result._sum.totalAmount || 0;
            }
            catch (error) {
                logger_1.default.error("Error calculating total revenue:", error);
                return 0;
            }
        });
    }
    mapToDomainEntity(data) {
        var _a;
        return new order_entity_1.Order({
            id: data.id,
            orderCode: data.orderCode,
            customerId: data.customerId,
            workspaceId: data.workspaceId,
            status: data.status,
            // Payment status removed
            paymentMethod: data.paymentMethod,
            totalAmount: data.totalAmount,
            shippingAmount: data.shippingAmount,
            taxAmount: data.taxAmount,
            shippingAddress: data.shippingAddress,
            billingAddress: data.billingAddress,
            notes: data.notes,
            discountCode: data.discountCode,
            discountAmount: data.discountAmount,
            trackingNumber: data.trackingNumber,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            customer: data.customer,
            items: ((_a = data.items) === null || _a === void 0 ? void 0 : _a.map((item) => ({
                id: item.id,
                orderId: item.orderId,
                itemType: item.itemType, // ✅ AGGIUNTO
                productId: item.productId,
                serviceId: item.serviceId, // ✅ AGGIUNTO
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                productVariant: item.productVariant,
                product: item.product,
                service: item.service, // ✅ AGGIUNTO
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
            }))) || [],
        });
    }
}
exports.OrderRepository = OrderRepository;
//# sourceMappingURL=order.repository.js.map