import { Router } from "express"
import { sessionController } from "../controllers/session.controller"
import { authMiddleware } from "../middlewares/auth.middleware"

const router = Router()

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
router.get("/validate", sessionController.validate.bind(sessionController))

// Statistiche sessioni attive (richiede auth)
router.get(
  "/stats",
  authMiddleware,
  sessionController.getStats.bind(sessionController)
)

export { router as sessionRoutes }
