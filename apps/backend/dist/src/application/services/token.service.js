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
exports.TokenService = void 0;
const database_1 = require("@echatbot/database");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service for managing registration tokens
 */
class TokenService {
    constructor() {
        this.prisma = database_1.prisma;
    }
    /**
     * Generate a secure random token
     * @returns A secure random token
     */
    generateSecureToken() {
        // Generate 32 bytes of random data and convert to hex
        return crypto_1.default.randomBytes(32).toString("hex");
    }
    /**
     * Create a registration token for a phone number and workspace
     *
     * @param phoneNumber The phone number to create a token for
     * @param workspaceId The workspace ID
     * @returns The created registration token
     */
    createRegistrationToken(phoneNumber, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🧹 AUTO-CLEANUP: Remove expired registration tokens (older than 1 hour) for this workspace
                const oneHourAgo = new Date();
                oneHourAgo.setHours(oneHourAgo.getHours() - 1);
                const cleanupResult = yield this.prisma.registrationToken.deleteMany({
                    where: {
                        workspaceId,
                        expiresAt: {
                            lt: oneHourAgo
                        }
                    }
                });
                if (cleanupResult.count > 0) {
                    logger_1.default.info(`[REGISTRATION-TOKEN] 🧹 Auto-cleaned ${cleanupResult.count} expired registration tokens (older than 1 hour) for workspace ${workspaceId}`);
                }
                // First, invalidate any existing tokens for this phone number
                yield this.prisma.registrationToken.updateMany({
                    where: {
                        phoneNumber,
                        workspaceId,
                        usedAt: null,
                    },
                    data: {
                        expiresAt: new Date(),
                    },
                });
                // Generate a new secure token
                const token = this.generateSecureToken();
                // Set expiration to 1 ora da adesso
                const expiresAt = new Date();
                expiresAt.setHours(expiresAt.getHours() + 1);
                // Save the token to the database
                yield this.prisma.registrationToken.create({
                    data: {
                        token,
                        phoneNumber,
                        workspaceId,
                        expiresAt,
                    },
                });
                logger_1.default.info(`Created registration token for phone ${phoneNumber} in workspace ${workspaceId}`);
                return token;
            }
            catch (error) {
                logger_1.default.error("Error creating registration token:", error);
                throw new Error("Failed to create registration token");
            }
        });
    }
    /**
     * Validate a registration token
     *
     * @param token The token to validate
     * @returns The registration token data if valid, null otherwise
     */
    validateToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Find the token in the database
                const registrationToken = yield this.prisma.registrationToken.findFirst({
                    where: {
                        token,
                        expiresAt: {
                            gt: new Date(), // Token expiration time must be in the future
                        },
                        usedAt: null, // Token must not have been used yet
                    },
                });
                if (!registrationToken) {
                    logger_1.default.warn(`Invalid or expired token: ${token.substring(0, 10)}...`);
                    return null;
                }
                logger_1.default.info(`Validated token for phone ${registrationToken.phoneNumber}`);
                return registrationToken;
            }
            catch (error) {
                logger_1.default.error("Error validating registration token:", error);
                throw new Error("Failed to validate registration token");
            }
        });
    }
    /**
     * Mark a token as used
     *
     * @param token The token to mark as used
     */
    markTokenAsUsed(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.registrationToken.update({
                    where: {
                        token,
                    },
                    data: {
                        usedAt: new Date(),
                    },
                });
                logger_1.default.info(`Marked token as used: ${token.substring(0, 10)}...`);
            }
            catch (error) {
                logger_1.default.error("Error marking token as used:", error);
                throw new Error("Failed to mark token as used");
            }
        });
    }
    /**
     * Clean up expired tokens
     *
     * @returns The number of tokens deleted
     */
    cleanupExpiredTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Delete tokens that expired more than 7 days ago
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - 7);
                const result = yield this.prisma.registrationToken.deleteMany({
                    where: {
                        expiresAt: {
                            lt: cutoffDate,
                        },
                    },
                });
                logger_1.default.info(`Cleaned up ${result.count} expired registration tokens`);
                return result.count;
            }
            catch (error) {
                logger_1.default.error("Error cleaning up expired tokens:", error);
                throw new Error("Failed to clean up expired tokens");
            }
        });
    }
}
exports.TokenService = TokenService;
//# sourceMappingURL=token.service.js.map