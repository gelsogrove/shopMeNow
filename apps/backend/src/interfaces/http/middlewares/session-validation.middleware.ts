import { NextFunction, Request, Response } from "express"
import { adminSessionService } from "../../../application/services/admin-session.service"
import logger from "../../../utils/logger"
import { SecureErrorResponses } from "../../../utils/secure-error-responses"

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
export const sessionValidationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    logger.info(`🔍 [SESSION MIDDLEWARE] Checking ${req.method} ${req.url}`)

    // Estrai sessionId da header
    const sessionId = req.headers["x-session-id"] as string
    logger.info(
      `🔍 [SESSION MIDDLEWARE] SessionID from header: ${sessionId ? sessionId.substring(0, 8) + "..." : "MISSING"}`
    )

    if (!sessionId || sessionId.trim() === "") {
      SecureErrorResponses.unauthorized(
        res,
        `SessionID missing for ${req.method} ${req.url}`
      )
      return
    }

    logger.info(
      `🔍 [SESSION MIDDLEWARE] Calling adminSessionService.validateSession...`
    )

    // Valida sessione
    const validation = await adminSessionService.validateSession(sessionId)

    logger.info(
      `🔍 [SESSION MIDDLEWARE] Validation result: ${JSON.stringify(validation)}`
    )

    if (!validation.valid) {
      SecureErrorResponses.unauthorized(
        res,
        `Invalid session for ${req.method} ${req.url}: ${validation.error}`
      )
      return
    }

    // Allega session a request
    const validatedSession = validation.session
    const validatedUser = validatedSession?.user

    if (!validatedSession || !validatedUser) {
      logger.error("❌ Session data is malformed:", {
        validatedSession,
        validatedUser,
      })
      SecureErrorResponses.unauthorized(res, "Session data is malformed")
      return
    }

    // 🛡️ CRITICAL SECURITY CHECK: Verify session user matches token user
    const tokenUser = (req as any).user
    
    logger.info("🔍 [SECURITY CHECK] Comparing session vs token user", {
      sessionUserId: validatedUser.id,
      sessionUserEmail: validatedUser.email,
      tokenUserId: tokenUser?.id || "NOT_SET",
      tokenUserEmail: tokenUser?.email || "NOT_SET",
    })
    
    if (tokenUser && tokenUser.id !== validatedUser.id) {
      logger.error("❌ SECURITY BREACH ATTEMPT: Session user !== Token user", {
        sessionUserId: validatedUser.id,
        sessionUserEmail: validatedUser.email,
        tokenUserId: tokenUser.id,
        tokenUserEmail: tokenUser.email,
        url: req.url,
        method: req.method,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      })
      SecureErrorResponses.unauthorized(
        res,
        "Session and token user mismatch - please log in again"
      )
      return
    }
    
    logger.info("✅ [SECURITY CHECK] Session and token user match")

    // Attach session data to request
    ;(req as any).session = validatedSession
    ;(req as any).sessionUser = validatedUser

    logger.info(
      `✅ Session valid for user ${validatedUser.email} on ${req.method} ${req.url}`
    )

    next()
  } catch (error) {
    logger.error("❌ [SESSION MIDDLEWARE] Error validating session:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      url: req.url,
      method: req.method,
    })
    SecureErrorResponses.internalError(res, error)
  }
}
