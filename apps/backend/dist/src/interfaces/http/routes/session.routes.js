"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionRoutes = void 0;
const express_1 = require("express");
const session_controller_1 = require("../controllers/session.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
exports.sessionRoutes = router;
/**
 * Session Routes
 * Gestione validazione sessioni admin
 *
 * 🔓 /validate - Public (validates incoming session without requiring valid session)
 * 🔒 /stats - Protected (requires authentication)
 */
// Valida sessione corrente (usato da ProtectedRoute frontend)
// IMPORTANTE: Questo endpoint NON usa authMiddleware
// (altrimenti loop infinito: validate richiede sessionId valido per validare sessionId)
router.get("/validate", session_controller_1.sessionController.validate.bind(session_controller_1.sessionController));
// Statistiche sessioni attive (richiede auth)
router.get("/stats", auth_middleware_1.authMiddleware, session_controller_1.sessionController.getStats.bind(session_controller_1.sessionController));
//# sourceMappingURL=session.routes.js.map