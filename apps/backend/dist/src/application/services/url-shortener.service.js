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
exports.urlShortenerService = exports.UrlShortenerService = void 0;
const database_1 = require("@echatbot/database");
const workspace_service_1 = require("../../services/workspace.service");
const logger_1 = __importDefault(require("../../utils/logger"));
// prisma imported
/**
 * URL Shortener Service
 * Creates short URLs like /s/abc123 that redirect to long token-based URLs
 */
class UrlShortenerService {
    /**
     * Generate a short code (6 characters, URL-safe)
     */
    generateShortCode() {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    /**
     * Create a short URL for a long token-based URL
     * @param originalUrl The full URL with token (e.g., /checkout?token=...)
     * @param workspaceId Workspace ID for isolation
     * @param expiresAt When the short URL should expire (optional)
     */
    createShortUrl(originalUrl, workspaceId, expiresAt) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let shortCode;
                let attempts = 0;
                const maxAttempts = 10;
                // Generate unique short code
                do {
                    shortCode = this.generateShortCode();
                    attempts++;
                    if (attempts > maxAttempts) {
                        throw new Error("Could not generate unique short code");
                    }
                    // Check if code already exists
                    const existing = yield database_1.prisma.shortUrls.findFirst({
                        where: { shortCode },
                    });
                    if (!existing)
                        break;
                } while (true);
                // Default expiration: 1 hour from now
                const defaultExpiration = new Date();
                defaultExpiration.setHours(defaultExpiration.getHours() + 1);
                // Create short URL record
                yield database_1.prisma.shortUrls.create({
                    data: {
                        shortCode,
                        originalUrl,
                        workspaceId,
                        expiresAt: expiresAt || defaultExpiration,
                        clicks: 0,
                        isActive: true,
                    },
                });
                // Get workspace base URL
                const baseUrl = yield workspace_service_1.workspaceService.getWorkspaceURL(workspaceId);
                const shortUrl = `${baseUrl}/s/${shortCode}`;
                logger_1.default.info(`📎 Short URL created: ${shortUrl} → ${originalUrl.substring(0, 50)}...`);
                return { shortCode, shortUrl };
            }
            catch (error) {
                logger_1.default.error("❌ Error creating short URL:", error);
                throw new Error("Failed to create short URL");
            }
        });
    }
    /**
     * Resolve a short URL to its original URL
     * @param shortCode The short code (e.g., "abc123")
     */
    resolveShortUrl(shortCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const shortUrl = yield database_1.prisma.shortUrls.findFirst({
                    where: {
                        shortCode,
                        isActive: true,
                    },
                });
                if (!shortUrl) {
                    return { success: false, notFound: true };
                }
                // Check if expired
                if (shortUrl.expiresAt && shortUrl.expiresAt < new Date()) {
                    return { success: false, expired: true };
                }
                // Increment click counter
                yield database_1.prisma.shortUrls.update({
                    where: { id: shortUrl.id },
                    data: {
                        clicks: { increment: 1 },
                        lastAccessedAt: new Date(),
                    },
                });
                logger_1.default.info(`📎 Short URL resolved: /s/${shortCode} → ${shortUrl.originalUrl.substring(0, 50)}... (clicks: ${shortUrl.clicks + 1})`);
                return {
                    success: true,
                    originalUrl: shortUrl.originalUrl,
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error resolving short URL:", error);
                return { success: false };
            }
        });
    }
    /**
     * Get statistics for a short URL
     */
    getShortUrlStats(shortCode) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const shortUrl = yield database_1.prisma.shortUrls.findFirst({
                    where: { shortCode },
                    select: {
                        clicks: true,
                        createdAt: true,
                        expiresAt: true,
                        isActive: true,
                    },
                });
                return shortUrl;
            }
            catch (error) {
                logger_1.default.error("❌ Error getting short URL stats:", error);
                return null;
            }
        });
    }
    /**
     * Clean up expired short URLs
     */
    cleanupExpiredUrls() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield database_1.prisma.shortUrls.deleteMany({
                    where: {
                        expiresAt: {
                            lt: new Date(),
                        },
                    },
                });
                if (result.count > 0) {
                    logger_1.default.info(`🧹 Cleaned up ${result.count} expired short URLs`);
                }
                return result.count;
            }
            catch (error) {
                logger_1.default.error("❌ Error cleaning up expired URLs:", error);
                return 0;
            }
        });
    }
    /**
     * Clean up old short URLs that are older than 1 hour
     * This runs automatically on each URL access to keep the database clean
     */
    cleanupOldUrls() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
                const result = yield database_1.prisma.shortUrls.deleteMany({
                    where: {
                        OR: [
                            // Delete expired URLs
                            {
                                expiresAt: {
                                    lt: new Date(),
                                },
                            },
                            // Delete URLs older than 1 hour (regardless of expiry)
                            {
                                createdAt: {
                                    lt: oneHourAgo,
                                },
                            },
                        ],
                    },
                });
                if (result.count > 0) {
                    logger_1.default.info(`🧹 Auto-cleanup: removed ${result.count} old short URLs (>1h or expired)`);
                }
                return result.count;
            }
            catch (error) {
                logger_1.default.error("❌ Error in auto-cleanup of old URLs:", error);
                return 0;
            }
        });
    }
}
exports.UrlShortenerService = UrlShortenerService;
exports.urlShortenerService = new UrlShortenerService();
//# sourceMappingURL=url-shortener.service.js.map