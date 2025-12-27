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
exports.sessionValidationMiddleware = void 0;
const admin_session_service_1 = require("../../../application/services/admin-session.service");
const logger_1 = __importDefault(require("../../../utils/logger"));
const secure_error_responses_1 = require("../../../utils/secure-error-responses");
/**
 * Middleware di validazione SessionID
 *
 * POLICY:
 * - Estrae sessionId da header 'X-Session-Id'
 * - Verifica esistenza e validità (non scaduto, isActive)
 * - Aggiorna lastActivityAt automaticamente
 * - Allega session a req.session
 *
 * ECCEZIONI (non applicare middleware):
 * - /api/auth/login
 * - /api/auth/forgot-password
 * - /api/auth/reset-password
 * - /api/auth/register
 * - /api/health
 * - /api/session/validate (loop infinito!)
 * - /api/whatsapp/webhook (pubblico)
 * - /api/internal/* (JWT token-based)
 */
const sessionValidationMiddleware = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        logger_1.default.info(`🔍 [SESSION MIDDLEWARE] Checking ${req.method} ${req.url}`);
        // Estrai sessionId da header
        const sessionId = req.headers["x-session-id"];
        logger_1.default.info(`🔍 [SESSION MIDDLEWARE] SessionID from header: ${sessionId ? sessionId.substring(0, 8) + "..." : "MISSING"}`);
        if (!sessionId || sessionId.trim() === "") {
            secure_error_responses_1.SecureErrorResponses.unauthorized(res, `SessionID missing for ${req.method} ${req.url}`);
            return;
        }
        logger_1.default.info(`🔍 [SESSION MIDDLEWARE] Calling adminSessionService.validateSession...`);
        // Valida sessione
        const validation = yield admin_session_service_1.adminSessionService.validateSession(sessionId);
        logger_1.default.info(`🔍 [SESSION MIDDLEWARE] Validation result: ${JSON.stringify(validation)}`);
        if (!validation.valid) {
            secure_error_responses_1.SecureErrorResponses.unauthorized(res, `Invalid session for ${req.method} ${req.url}: ${validation.error}`);
            return;
        }
        // Allega session a request
        const validatedSession = validation.session;
        const validatedUser = validatedSession === null || validatedSession === void 0 ? void 0 : validatedSession.user;
        if (!validatedSession || !validatedUser) {
            logger_1.default.error("❌ Session data is malformed:", {
                validatedSession,
                validatedUser,
            });
            secure_error_responses_1.SecureErrorResponses.unauthorized(res, "Session data is malformed");
            return;
        }
        // 🛡️ CRITICAL SECURITY CHECK: Verify session user matches token user
        const tokenUser = req.user;
        logger_1.default.info("🔍 [SECURITY CHECK] Comparing session vs token user", {
            sessionUserId: validatedUser.id,
            sessionUserEmail: validatedUser.email,
            tokenUserId: (tokenUser === null || tokenUser === void 0 ? void 0 : tokenUser.id) || "NOT_SET",
            tokenUserEmail: (tokenUser === null || tokenUser === void 0 ? void 0 : tokenUser.email) || "NOT_SET",
        });
        if (tokenUser && tokenUser.id !== validatedUser.id) {
            logger_1.default.error("❌ SECURITY BREACH ATTEMPT: Session user !== Token user", {
                sessionUserId: validatedUser.id,
                sessionUserEmail: validatedUser.email,
                tokenUserId: tokenUser.id,
                tokenUserEmail: tokenUser.email,
                url: req.url,
                method: req.method,
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            });
            secure_error_responses_1.SecureErrorResponses.unauthorized(res, "Session and token user mismatch - please log in again");
            return;
        }
        logger_1.default.info("✅ [SECURITY CHECK] Session and token user match");
        req.session = validatedSession;
        req.sessionUser = validatedUser;
        logger_1.default.info(`✅ Session valid for user ${validatedUser.email} on ${req.method} ${req.url}`);
        next();
    }
    catch (error) {
        logger_1.default.error("❌ [SESSION MIDDLEWARE] Error validating session:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            url: req.url,
            method: req.method,
        });
        secure_error_responses_1.SecureErrorResponses.internalError(res, error);
    }
});
exports.sessionValidationMiddleware = sessionValidationMiddleware;
//# sourceMappingURL=session-validation.middleware.js.map