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
exports.sessionController = exports.SessionController = void 0;
const admin_session_service_1 = require("../../../application/services/admin-session.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
/**
 * Session Controller
 * Gestione validazione e operazioni sessioni admin
 */
class SessionController {
    /**
     * Valida sessionId corrente
     * GET /api/session/validate
     *
     * Headers:
     * - X-Session-Id: {sessionId}
     *
     * Response:
     * - 200: { valid: true, session: {...} }
     * - 401: { valid: false, error: "Session expired" }
     */
    validate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const sessionId = req.headers["x-session-id"];
                if (!sessionId) {
                    logger_1.default.warn("⚠️ SessionID missing in validate request");
                    res.status(401).json({
                        valid: false,
                        error: "SessionID missing",
                    });
                    return;
                }
                const validation = yield admin_session_service_1.adminSessionService.validateSession(sessionId);
                if (!validation.valid) {
                    res.status(401).json({
                        valid: false,
                        error: validation.error,
                    });
                    return;
                }
                // Ritorna session data (senza dati sensibili)
                res.status(200).json({
                    valid: true,
                    session: {
                        userId: validation.session.userId,
                        email: validation.session.user.email,
                        role: validation.session.user.role,
                        expiresAt: validation.session.expiresAt,
                        lastActivityAt: validation.session.lastActivityAt,
                        workspace: validation.session.workspace
                            ? {
                                id: validation.session.workspace.id,
                                name: validation.session.workspace.name,
                                slug: validation.session.workspace.slug,
                            }
                            : null,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("❌ Session validation endpoint error:", error);
                res.status(500).json({
                    valid: false,
                    error: "Validation failed",
                });
            }
        });
    }
    /**
     * Ottiene statistiche sessioni attive
     * GET /api/session/stats
     *
     * Richiede autenticazione (solo per admin)
     */
    getStats(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const count = yield admin_session_service_1.adminSessionService.getActiveSessionsCount();
                res.status(200).json({
                    activeSessions: count,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Error getting session stats:", error);
                res.status(500).json({
                    error: "Failed to get stats",
                });
            }
        });
    }
}
exports.SessionController = SessionController;
exports.sessionController = new SessionController();
//# sourceMappingURL=session.controller.js.map