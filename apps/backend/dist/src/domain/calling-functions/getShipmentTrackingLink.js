"use strict";
/**
 * GetShipmentTrackingLink - LLM-Callable Function
 *
 * Genera un link DHL per tracciare la spedizione di un ordine.
 * Utilizzata quando l'utente chiede: "dov'è il mio ordine?", "tracking spedizione", etc.
 *
 * @see docs/prompt_agent.md - Line 210: Definizione della calling function
 */
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
exports.getShipmentTrackingLink = getShipmentTrackingLink;
const logger_1 = __importDefault(require("../../utils/logger"));
const database_1 = require("@echatbot/database");
/**
 * Generates DHL tracking link for order shipment
 *
 * @param request - Request parameters
 * @returns Short URL redirecting to DHL tracking page
 */
function getShipmentTrackingLink(request) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            logger_1.default.info("📦 GetShipmentTrackingLink called with:", request);
            try {
                // Query the database for the order with trackingNumber
                // If no orderCode provided, get the last order for the customer
                const whereClause = request.orderCode
                    ? { orderCode: request.orderCode, workspaceId: request.workspaceId }
                    : { customerId: request.customerId, workspaceId: request.workspaceId };
                const order = yield database_1.prisma.orders.findFirst({
                    where: whereClause,
                    orderBy: { createdAt: "desc" }, // Get most recent if no specific orderCode
                    select: {
                        orderCode: true,
                        trackingNumber: true,
                    },
                });
                yield database_1.prisma.$disconnect();
                if (!order) {
                    logger_1.default.info("❌ Order not found:", request.orderCode || "ultimo ordine");
                    return {
                        success: false,
                        error: "Ordine non trovato",
                        message: "Ordine non trovato",
                        timestamp: new Date().toISOString(),
                    };
                }
                if (!order.trackingNumber) {
                    logger_1.default.info("❌ No tracking number for order:", order.orderCode);
                    return {
                        success: false,
                        error: "Non c'è il tracking-id nell'ordine",
                        message: "Il tracking della spedizione non è ancora disponibile per questo ordine.",
                        timestamp: new Date().toISOString(),
                    };
                }
                logger_1.default.info("✅ Order found with tracking:", order.trackingNumber);
                // Generate direct DHL tracking link
                const dhlTrackingUrl = `https://www.dhl.com/global-en/home/tracking/tracking-express.html?tracking-id=${encodeURIComponent(order.trackingNumber)}`;
                // Create short URL that redirects to DHL
                try {
                    const { urlShortenerService, } = require("../../application/services/url-shortener.service");
                    const shortResult = yield urlShortenerService.createShortUrl(dhlTrackingUrl, request.workspaceId);
                    const shortTrackingUrl = shortResult.shortUrl;
                    logger_1.default.info(`📎 Short tracking link created: ${shortTrackingUrl}`);
                    return {
                        success: true,
                        linkUrl: shortTrackingUrl,
                        trackingNumber: order.trackingNumber,
                        orderCode: order.orderCode,
                        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        action: "tracking",
                        timestamp: new Date().toISOString(),
                    };
                }
                catch (shortError) {
                    logger_1.default.warn("⚠️ Failed to create short URL, using direct DHL link");
                    // Fallback to direct DHL link
                    return {
                        success: true,
                        linkUrl: dhlTrackingUrl,
                        trackingNumber: order.trackingNumber,
                        orderCode: order.orderCode,
                        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        action: "tracking",
                        timestamp: new Date().toISOString(),
                    };
                }
            }
            catch (dbError) {
                logger_1.default.error("❌ Database error:", dbError);
                yield database_1.prisma.$disconnect();
                return {
                    success: false,
                    error: "Errore database",
                    message: "Impossibile recuperare informazioni sull'ordine.",
                    timestamp: new Date().toISOString(),
                };
            }
        }
        catch (error) {
            logger_1.default.error("❌ Error in GetShipmentTrackingLink:", error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Errore interno",
                message: "Impossibile generare il link di tracking. Riprova più tardi.",
                timestamp: new Date().toISOString(),
            };
        }
    });
}
//# sourceMappingURL=getShipmentTrackingLink.js.map