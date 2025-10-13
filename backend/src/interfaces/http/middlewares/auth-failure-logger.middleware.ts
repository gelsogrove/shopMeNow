import { NextFunction, Request, Response } from "express"
import logger from "../../../utils/logger"

/**
 * Auth Failure Logger Middleware
 *
 * Logs all authentication failures for security monitoring
 * Use this AFTER authMiddleware to catch 401 responses
 *
 * Security Benefits:
 * - Detect brute force attacks
 * - Identify stolen/expired tokens
 * - Monitor suspicious access patterns
 * - Alert on repeated failures from same IP
 */

interface AuthFailureLog {
  timestamp: string
  ip: string
  method: string
  path: string
  userAgent?: string
  token?: string // First 10 chars only
  error?: string
}

// In-memory store for rate limiting auth failures (should use Redis in production)
const failureCountByIP: Map<string, { count: number; firstFailure: number }> =
  new Map()
const FAILURE_THRESHOLD = 5 // Alert after 5 failures
const FAILURE_WINDOW = 300000 // 5 minutes in ms

export const authFailureLoggerMiddleware = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only log auth failures (401)
  if (
    err &&
    (err.status === 401 || err.statusCode === 401 || res.statusCode === 401)
  ) {
    const ip = req.ip || req.socket.remoteAddress || "unknown"
    const authHeader = req.headers.authorization
    const token = authHeader?.replace("Bearer ", "").substring(0, 10) || "none"

    const failureLog: AuthFailureLog = {
      timestamp: new Date().toISOString(),
      ip,
      method: req.method,
      path: req.path,
      userAgent: req.headers["user-agent"],
      token,
      error: err.message || "Unauthorized",
    }

    logger.warn("🔒 [AUTH-FAILURE] Unauthorized access attempt", failureLog)

    // Track failures by IP for brute force detection
    const now = Date.now()
    const ipFailures = failureCountByIP.get(ip)

    if (!ipFailures) {
      failureCountByIP.set(ip, { count: 1, firstFailure: now })
    } else {
      // Reset counter if outside time window
      if (now - ipFailures.firstFailure > FAILURE_WINDOW) {
        failureCountByIP.set(ip, { count: 1, firstFailure: now })
      } else {
        ipFailures.count++

        // Alert on threshold breach
        if (ipFailures.count >= FAILURE_THRESHOLD) {
          logger.error(
            "🚨 [SECURITY-ALERT] Potential brute force attack detected!",
            {
              ip,
              failures: ipFailures.count,
              windowMinutes: FAILURE_WINDOW / 60000,
              path: req.path,
              recommendation: "Consider IP blocking or CAPTCHA",
            }
          )
        }
      }
    }
  }

  next(err)
}

/**
 * Successful Auth Logger (Optional)
 * Logs successful authentications for audit trail
 */
export const authSuccessLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user
  const workspaceId = (req as any).workspaceId

  if (user) {
    logger.info("✅ [AUTH-SUCCESS] User authenticated", {
      userId: user.id,
      workspaceId,
      path: req.path,
      method: req.method,
      ip: req.ip,
    })
  }

  next()
}
