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
exports.linkGeneratorService = exports.LinkGeneratorService = void 0;
const config_1 = require("../../config");
const logger_1 = __importDefault(require("../../utils/logger"));
const url_shortener_service_1 = require("./url-shortener.service");
/**
 * Centralized Link Generator Service
 * Ensures ALL links use URL shortener consistently
 */
class LinkGeneratorService {
    constructor() {
        this.urlShortenerService = new url_shortener_service_1.UrlShortenerService();
    }
    /**
     * Generate a short URL for any link type
     * This is the SINGLE source of truth for link generation
     */
    generateShortLink(originalUrl_1, workspaceId_1) {
        return __awaiter(this, arguments, void 0, function* (originalUrl, workspaceId, linkType = "generic") {
            try {
                // Create short URL - now returns full URL from workspace.url
                const shortResult = yield this.urlShortenerService.createShortUrl(originalUrl, workspaceId);
                // shortResult.shortUrl already contains the full URL (e.g., http://localhost:3000/s/abc123)
                const shortUrl = shortResult.shortUrl;
                logger_1.default.info(`📎 Created short ${linkType} link: ${shortUrl} → ${originalUrl}`);
                return shortUrl;
            }
            catch (error) {
                logger_1.default.warn(`⚠️ Failed to create short URL for ${linkType}, using long URL:`, error);
                return originalUrl; // Fallback to original URL
            }
        });
    }
    /**
     * Generate checkout/cart link with token
     * @param token JWT token for checkout
     * @param workspaceId Workspace ID
     * @param step Optional step parameter (1 or 2) - FR-13 Repeat Order
     */
    generateCheckoutLink(token, workspaceId, step) {
        return __awaiter(this, void 0, void 0, function* () {
            // Validate step parameter if provided
            if (step !== undefined && (step < 1 || step > 2)) {
                throw new Error("Invalid step parameter: must be 1 or 2");
            }
            let originalUrl = `${config_1.config.frontendUrl}/cart?token=${token}`;
            if (step) {
                originalUrl += `&step=${step}`;
            }
            return this.generateShortLink(originalUrl, workspaceId, "cart");
        });
    }
    /**
     * Generate orders link (general or specific)
     */
    generateOrdersLink(token, workspaceId, orderCode) {
        return __awaiter(this, void 0, void 0, function* () {
            let originalUrl;
            if (orderCode && orderCode.trim() !== "") {
                const safeCode = encodeURIComponent(orderCode.trim());
                originalUrl = `${config_1.config.frontendUrl}/orders-public/${safeCode}?token=${token}`;
            }
            else {
                originalUrl = `${config_1.config.frontendUrl}/orders-public?token=${token}`;
            }
            return this.generateShortLink(originalUrl, workspaceId, "orders");
        });
    }
    /**
     * Generate profile link with token
     */
    generateProfileLink(token, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const originalUrl = `${config_1.config.frontendUrl}/customer-profile?token=${token}`;
            return this.generateShortLink(originalUrl, workspaceId, "profile");
        });
    }
    /**
     * Generate tracking link with token
     * NOTE: Tracking uses orders-public page, not a separate tracking page
     */
    generateTrackingLink(token, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const originalUrl = `${config_1.config.frontendUrl}/orders-public?token=${token}`;
            return this.generateShortLink(originalUrl, workspaceId, "tracking");
        });
    }
    /**
     * Generate invoice link with token
     */
    generateInvoiceLink(token, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const originalUrl = `${config_1.config.frontendUrl}/invoice-public?token=${token}`;
            return this.generateShortLink(originalUrl, workspaceId, "invoice");
        });
    }
    /**
     * Generate registration link with token
     */
    generateRegistrationLink(token, workspaceUrl, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const originalUrl = `${workspaceUrl.replace(/\/$/, "")}/registration?token=${token}`;
            return this.generateShortLink(originalUrl, workspaceId, "registration");
        });
    }
    /**
     * Generate tracking link for specific order
     */
    generateShipmentTrackingLink(baseUrl, orderCode, token, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const originalUrl = `${baseUrl}/orders-public/${orderCode}?token=${token}`;
            return this.generateShortLink(originalUrl, workspaceId, "shipment-tracking");
        });
    }
}
exports.LinkGeneratorService = LinkGeneratorService;
// Export singleton instance
exports.linkGeneratorService = new LinkGeneratorService();
//# sourceMappingURL=link-generator.service.js.map