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
exports.adminSessionService = exports.AdminSessionService = void 0;
const database_1 = require("@echatbot/database");
const crypto_1 = require("crypto");
const logger_1 = __importDefault(require("../../utils/logger"));
class AdminSessionService {
    /**
     * Crea una nuova sessione admin al login
     * POLICY: Una sola sessione attiva per user, la vecchia viene revocata
     *
     * @param userId - ID utente
     * @param workspaceId - ID workspace selezionato (opzionale)
     * @param ipAddress - IP address del client
     * @param userAgent - User agent del browser
     * @returns sessionId generato
     */
    createSession(userId, workspaceId, ipAddress, userAgent) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Revoca tutte le sessioni esistenti per questo user
                yield database_1.prisma.adminSession.updateMany({
                    where: { userId, isActive: true },
                    data: { isActive: false },
                });
                logger_1.default.info(`🔒 Revoked existing sessions for user ${userId}`);
                // 2. Genera nuovo sessionId univoco
                const sessionId = (0, crypto_1.randomUUID)();
                // 3. Calcola scadenza: durata configurabile da TOKEN_EXPIRATION env
                const now = new Date();
                // Use env variable directly to allow runtime changes (important for testing)
                const tokenExpiration = process.env.TOKEN_EXPIRATION || "1h";
                const hours = parseInt(tokenExpiration.replace("h", "")) || 1;
                const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
                // 4. Crea nuova sessione
                yield database_1.prisma.adminSession.create({
                    data: {
                        sessionId,
                        userId,
                        workspaceId,
                        expiresAt,
                        lastActivityAt: now,
                        ipAddress: ipAddress === null || ipAddress === void 0 ? void 0 : ipAddress.substring(0, 45), // Limita lunghezza IP
                        userAgent: userAgent === null || userAgent === void 0 ? void 0 : userAgent.substring(0, 1000), // Limita user agent
                        isActive: true,
                    },
                });
                logger_1.default.info(`🔐 Admin session created for user ${userId}: ${sessionId.substring(0, 8)}... (expires: ${expiresAt.toISOString()})`);
                return sessionId;
            }
            catch (error) {
                logger_1.default.error("❌ Error creating admin session:", error);
                throw new Error("Failed to create session");
            }
        });
    }
    /**
     * Valida una sessione esistente
     * Verifica: esistenza, isActive, non scaduta
     * Aggiorna lastActivityAt se valida
     *
     * @param sessionId - ID sessione da validare
     * @returns { valid: boolean, session?: AdminSession, error?: string }
     */
    validateSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const session = yield database_1.prisma.adminSession.findUnique({
                    where: { sessionId },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                role: true,
                                firstName: true,
                                lastName: true,
                            },
                        },
                        workspace: { select: { id: true, name: true, slug: true } },
                    },
                });
                // 1. Sessione non trovata
                if (!session) {
                    logger_1.default.warn(`⚠️ Session not found: ${sessionId.substring(0, 8)}...`);
                    return { valid: false, error: "Session not found" };
                }
                // 2. Sessione disattivata
                if (!session.isActive) {
                    logger_1.default.warn(`⚠️ Session revoked: ${sessionId.substring(0, 8)}...`);
                    return { valid: false, error: "Session revoked" };
                }
                // 3. Sessione scaduta (>1h dalla creazione)
                if (session.expiresAt < new Date()) {
                    logger_1.default.warn(`⚠️ Session expired: ${sessionId.substring(0, 8)}... (expired: ${session.expiresAt.toISOString()})`);
                    // Auto-revoca sessione scaduta
                    yield database_1.prisma.adminSession.update({
                        where: { id: session.id },
                        data: { isActive: false },
                    });
                    return { valid: false, error: "Session expired" };
                }
                // 4. Sessione valida → Aggiorna lastActivityAt
                yield database_1.prisma.adminSession.update({
                    where: { id: session.id },
                    data: { lastActivityAt: new Date() },
                });
                logger_1.default.debug(`✅ Session valid for user ${session.user.email} (${sessionId.substring(0, 8)}...)`);
                return { valid: true, session };
            }
            catch (error) {
                logger_1.default.error("❌ Error validating session:", error);
                return { valid: false, error: "Validation error" };
            }
        });
    }
    /**
     * Revoca una sessione (logout)
     *
     * @param sessionId - ID sessione da revocare
     */
    revokeSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield database_1.prisma.adminSession.updateMany({
                    where: { sessionId },
                    data: { isActive: false },
                });
                logger_1.default.info(`🔒 Session revoked: ${sessionId.substring(0, 8)}...`);
            }
            catch (error) {
                logger_1.default.error("❌ Error revoking session:", error);
                throw new Error("Failed to revoke session");
            }
        });
    }
    /**
     * Cleanup automatico sessioni scadute
     * Chiamato da scheduler (ogni 1h) o manualmente
     *
     * @returns Numero di sessioni eliminate
     */
    cleanupExpiredSessions() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield database_1.prisma.adminSession.deleteMany({
                    where: {
                        OR: [
                            { expiresAt: { lt: new Date() } }, // Scadute
                            { isActive: false }, // Revocate
                        ],
                    },
                });
                if (result.count > 0) {
                    logger_1.default.info(`🧹 Cleaned up ${result.count} expired/revoked admin sessions`);
                }
                return result.count;
            }
            catch (error) {
                logger_1.default.error("❌ Error cleaning up sessions:", error);
                return 0;
            }
        });
    }
    /**
     * Ottiene statistiche sessioni attive
     * Utile per monitoring
     *
     * @returns Numero di sessioni attive totali
     */
    getActiveSessionsCount() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield database_1.prisma.adminSession.count({
                    where: {
                        isActive: true,
                        expiresAt: { gt: new Date() },
                    },
                });
                return count;
            }
            catch (error) {
                logger_1.default.error("❌ Error counting active sessions:", error);
                return 0;
            }
        });
    }
}
exports.AdminSessionService = AdminSessionService;
exports.adminSessionService = new AdminSessionService();
//# sourceMappingURL=admin-session.service.js.map