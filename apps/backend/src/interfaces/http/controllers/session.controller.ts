import { Request, Response } from "express"
import { adminSessionService } from "../../../application/services/admin-session.service"
import logger from "../../../utils/logger"

/**
 * Session Controller
 * Gestione validazione e operazioni sessioni admin
 */
export class SessionController {
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
  async validate(req: Request, res: Response): Promise<void> {
    try {
      const sessionId = req.headers["x-session-id"] as string

      if (!sessionId) {
        logger.warn("⚠️ SessionID missing in validate request")
        res.status(401).json({
          valid: false,
          error: "SessionID missing",
        })
        return
      }

      const validation = await adminSessionService.validateSession(sessionId)

      if (!validation.valid) {
        res.status(401).json({
          valid: false,
          error: validation.error,
        })
        return
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
      })
    } catch (error) {
      logger.error("❌ Session validation endpoint error:", error)
      res.status(500).json({
        valid: false,
        error: "Validation failed",
      })
    }
  }

  /**
   * Ottiene statistiche sessioni attive
   * GET /api/session/stats
   *
   * Richiede autenticazione (solo per admin)
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const count = await adminSessionService.getActiveSessionsCount()

      res.status(200).json({
        activeSessions: count,
      })
    } catch (error) {
      logger.error("❌ Error getting session stats:", error)
      res.status(500).json({
        error: "Failed to get stats",
      })
    }
  }
}

export const sessionController = new SessionController()
