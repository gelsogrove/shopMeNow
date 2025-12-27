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
exports.SecureTokenService = void 0;
const database_1 = require("@echatbot/database");
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service for managing all types of secure tokens
 */
class SecureTokenService {
    constructor() {
        this.prisma = database_1.prisma;
    }
    /**
     * Generate a secure token
     */
    generateSecureToken() {
        return crypto_1.default.randomBytes(32).toString("hex");
    }
    /**
     * Encrypt sensitive payload data
     */
    encryptPayload(payload) {
        const key = process.env.TOKEN_ENCRYPTION_KEY || "default-key-change-in-production";
        const cipher = crypto_1.default.createCipher("aes-256-cbc", key);
        let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
        encrypted += cipher.final("hex");
        return encrypted;
    }
    /**
     * Decrypt payload data
     */
    decryptPayload(encryptedPayload) {
        try {
            const key = process.env.TOKEN_ENCRYPTION_KEY || "default-key-change-in-production";
            const decipher = crypto_1.default.createDecipher("aes-256-cbc", key);
            let decrypted = decipher.update(encryptedPayload, "hex", "utf8");
            decrypted += decipher.final("utf8");
            return JSON.parse(decrypted);
        }
        catch (error) {
            logger_1.default.error("Error decrypting payload:", error);
            return null;
        }
    }
    /**
     * 🚀 KISS SOLUTION - UN SOLO TOKEN PER CLIENTE (Andrea's Request)
     * Genera nuovo token SOLO se scaduto per cliente+workspace
     */
    createToken(type, workspaceId, payload, expiresIn, userId, phoneNumber, ipAddress, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Special case: registration tokens don't need customerId (customer doesn't exist yet)
                if (!customerId && type !== "registration") {
                    throw new Error("KISS TOKEN: customerId è obbligatorio");
                }
                logger_1.default.info(`[KISS-TOKEN] 🔍 Controllo token per customerId="${customerId}", phoneNumber="${phoneNumber}", workspaceId="${workspaceId}"`);
                // 1. Cerca token esistente NON SCADUTO per questo cliente+workspace
                let existingToken;
                if (type === "registration" && phoneNumber) {
                    // For registration tokens, search by phoneNumber
                    existingToken = yield this.prisma.secureToken.findFirst({
                        where: {
                            phoneNumber,
                            workspaceId,
                            type: "registration",
                            expiresAt: {
                                gt: new Date(), // NON scaduto
                            },
                        },
                    });
                }
                else if (customerId) {
                    // For other tokens, search by customerId AND type
                    existingToken = yield this.prisma.secureToken.findFirst({
                        where: {
                            customerId,
                            workspaceId,
                            type, // 🔧 FIX: Filtra anche per tipo di token!
                            expiresAt: {
                                gt: new Date(), // NON scaduto
                            },
                        },
                    });
                }
                // 2. Se esiste token valido → RIUTILIZZA
                if (existingToken) {
                    logger_1.default.info(`[KISS-TOKEN] ✅ RIUTILIZZO token esistente: ${existingToken.token.substring(0, 10)}... (scade: ${existingToken.expiresAt})`);
                    // Aggiorna payload se necessario
                    if (payload &&
                        JSON.stringify(payload) !== JSON.stringify(existingToken.payload)) {
                        yield this.prisma.secureToken.update({
                            where: { id: existingToken.id },
                            data: { payload: payload },
                        });
                        logger_1.default.info(`[KISS-TOKEN] 🔄 Payload aggiornato`);
                    }
                    return existingToken.token;
                }
                // 3. Nessun token valido → CREA NUOVO
                logger_1.default.info(`[KISS-TOKEN] 🆕 Creo nuovo token (nessun token valido trovato)`);
                // Pulisci token scaduti + elimina token esistenti dello stesso tipo per evitare conflitti
                if (type === "registration" && phoneNumber) {
                    // For registration tokens, clean by phoneNumber
                    yield this.prisma.secureToken.deleteMany({
                        where: {
                            phoneNumber,
                            workspaceId,
                            type: "registration",
                        },
                    });
                }
                else if (customerId) {
                    // For other tokens, clean by customerId AND type (inclusi quelli non scaduti)
                    yield this.prisma.secureToken.deleteMany({
                        where: {
                            customerId,
                            workspaceId,
                            type, // 🔧 FIX: Elimina tutti i token dello stesso tipo per evitare conflitti
                        },
                    });
                }
                // Genera nuovo token
                const token = this.generateSecureToken();
                const expiresAt = new Date();
                // Use env variable directly to allow runtime changes (important for testing)
                const effectiveExpiresIn = expiresIn || process.env.TOKEN_EXPIRATION || "1h";
                // Parse duration correctly for both hours (h) and minutes (m)
                const match = effectiveExpiresIn.match(/^(\d+)([hm])$/);
                if (!match) {
                    // Fallback to 1 hour if format is invalid
                    expiresAt.setHours(expiresAt.getHours() + 1);
                }
                else {
                    const value = parseInt(match[1], 10);
                    const unit = match[2];
                    if (unit === "m") {
                        // Minutes
                        expiresAt.setMinutes(expiresAt.getMinutes() + value);
                    }
                    else {
                        // Hours
                        expiresAt.setHours(expiresAt.getHours() + value);
                    }
                }
                // Crea token del tipo specificato
                yield this.prisma.secureToken.create({
                    data: {
                        token,
                        type, // 🔧 FIX: Usa il tipo passato come parametro invece di 'universal'
                        workspaceId,
                        customerId,
                        userId,
                        phoneNumber,
                        payload: payload,
                        expiresAt,
                        ipAddress,
                    },
                });
                logger_1.default.info(`[KISS-TOKEN] ✅ NUOVO token di tipo '${type}' creato - scade: ${expiresAt}`);
                return token;
            }
            catch (error) {
                logger_1.default.error(`[KISS-TOKEN] ❌ Errore creazione token:`, error);
                // Re-throw validation errors as-is to preserve the specific error message
                if (error instanceof Error && error.message.includes("KISS TOKEN:")) {
                    throw error;
                }
                // For other errors, wrap with generic message
                throw new Error(`Errore creazione token di tipo '${type}'`);
            }
        });
    }
    /**
     * Validate a token with workspace isolation
     * If type is not specified, accepts any valid token type
     */
    validateToken(token, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`[KISS-TOKEN] 🔍 Validazione token: ${token.substring(0, 10)}... per workspace: ${workspaceId}`);
                // KISS: Cerca token ESISTENTE + NON SCADUTO + WORKSPACE CORRETTO
                const secureToken = yield this.prisma.secureToken.findFirst({
                    where: Object.assign({ token, expiresAt: { gt: new Date() } }, (workspaceId && { workspaceId })),
                });
                if (!secureToken) {
                    logger_1.default.warn(`[KISS-TOKEN] ❌ Token non valido o scaduto: ${token.substring(0, 10)}...`);
                    return { valid: false };
                }
                logger_1.default.info(`[KISS-TOKEN] ✅ Token valido per customer: ${secureToken.customerId}, workspace: ${secureToken.workspaceId}`);
                return {
                    valid: true,
                    data: {
                        id: secureToken.id,
                        type: secureToken.type,
                        workspaceId: secureToken.workspaceId,
                        customerId: secureToken.customerId || secureToken.userId, // 🔧 Fallback per compatibilità
                        userId: secureToken.userId,
                        phoneNumber: secureToken.phoneNumber,
                        expiresAt: secureToken.expiresAt,
                        createdAt: secureToken.createdAt,
                    },
                    payload: secureToken.payload,
                };
            }
            catch (error) {
                logger_1.default.error("[KISS-TOKEN] ❌ Errore validazione token:", error);
                return { valid: false };
            }
        });
    }
    /**
     * DEPRECATED: Token marking removed - tokens remain valid until expiration
     * This function is kept for backward compatibility but does nothing
     */
    markTokenAsUsed(token) {
        return __awaiter(this, void 0, void 0, function* () {
            // Tokens should not be marked as used - they remain valid until expiration
            logger_1.default.info(`Token marking disabled - token ${token.substring(0, 10)}... remains valid until expiration`);
            return true;
        });
    }
    /**
     * Revoke a token
     */
    revokeToken(token) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.secureToken.update({
                    where: { token },
                    data: { expiresAt: new Date() },
                });
                logger_1.default.info(`Revoked token: ${token.substring(0, 10)}...`);
                return true;
            }
            catch (error) {
                logger_1.default.error("Error revoking token:", error);
                return false;
            }
        });
    }
    /**
     * Cleanup expired tokens (cron job)
     */
    cleanupExpiredTokens() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - 7); // Delete tokens expired more than 7 days ago
                const result = yield this.prisma.secureToken.deleteMany({
                    where: {
                        expiresAt: {
                            lt: cutoffDate,
                        },
                    },
                });
                logger_1.default.info(`Cleaned up ${result.count} expired secure tokens`);
                return result.count;
            }
            catch (error) {
                logger_1.default.error("Error cleaning up expired tokens:", error);
                throw new Error("Failed to clean up expired tokens");
            }
        });
    }
    /**
     * Get token statistics
     */
    getTokenStats(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield this.prisma.secureToken.groupBy({
                    by: ["type"],
                    where: {
                        workspaceId,
                        expiresAt: {
                            gt: new Date(),
                        },
                    },
                    _count: {
                        id: true,
                    },
                });
                return stats.reduce((acc, stat) => {
                    acc[stat.type] = stat._count.id;
                    return acc;
                }, {});
            }
            catch (error) {
                logger_1.default.error("Error getting token stats:", error);
                return {};
            }
        });
    }
}
exports.SecureTokenService = SecureTokenService;
//# sourceMappingURL=secure-token.service.js.map