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
exports.getOrder = getOrder;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Get specific order details by order ID or order code
 */
function getOrder(request) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        try {
            logger_1.default.info("[GET_ORDER] Fetching order:", request);
            const { customerId, workspaceId, orderId } = request;
            // Find order by ID or orderCode
            const order = yield database_1.prisma.orders.findFirst({
                where: {
                    OR: [{ id: orderId }, { orderCode: orderId }],
                    customerId: customerId,
                    workspaceId: workspaceId,
                },
                include: {
                    items: {
                        include: {
                            product: true,
                            service: true,
                        },
                    },
                    customer: true,
                    creditNotes: {
                        orderBy: { createdAt: 'desc' },
                    },
                },
            });
            if (!order) {
                logger_1.default.warn(`[GET_ORDER] Order not found: ${orderId}`);
                return {
                    success: false,
                    error: "Order not found",
                    message: `Ordine ${orderId} non trovato. Verifica il codice ordine e riprova.`,
                };
            }
            // Format order items
            const formattedItems = order.items.map((item) => {
                var _a, _b;
                return ({
                    id: item.id,
                    productId: item.productId || undefined,
                    serviceId: item.serviceId || undefined,
                    name: ((_a = item.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.name) || "Unknown",
                    quantity: item.quantity,
                    price: item.unitPrice,
                    total: item.totalPrice,
                });
            });
            // Format response
            const orderData = {
                id: order.id,
                orderCode: order.orderCode,
                status: order.status || "PENDING",
                totalAmount: order.totalAmount,
                currency: ((_a = order.customer) === null || _a === void 0 ? void 0 : _a.currency) || "EUR",
                createdAt: order.createdAt.toISOString(),
                deliveryDate: undefined, // Not in schema yet
                shippingAddress: order.shippingAddress || undefined,
                billingAddress: order.billingAddress || undefined,
                items: formattedItems,
                tracking: order.trackingNumber
                    ? {
                        trackingNumber: order.trackingNumber,
                        carrier: undefined, // Not in schema yet
                        status: undefined, // Not in schema yet
                    }
                    : undefined,
                creditNotes: order.creditNotes.length > 0
                    ? order.creditNotes.map((cn) => ({
                        creditNoteCode: cn.creditNoteCode,
                        amount: cn.amount,
                        reason: cn.reason,
                        createdAt: cn.createdAt.toISOString(),
                    }))
                    : undefined,
            };
            logger_1.default.info(`[GET_ORDER] Order found: ${order.orderCode}, creditNotes: ${order.creditNotes.length}`);
            return {
                success: true,
                order: orderData,
                message: `Ordine ${order.orderCode} trovato con successo.`,
            };
        }
        catch (error) {
            logger_1.default.error("[GET_ORDER] Error:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
                message: "Errore nel recupero dell'ordine. Riprova più tardi o contatta l'assistenza.",
            };
        }
        finally {
            yield database_1.prisma.$disconnect();
        }
    });
}
//# sourceMappingURL=getOrder.js.map