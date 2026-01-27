import { NextFunction, Request, Response } from "express"
import { whatsappIpRateLimiter } from "../../../middlewares/rateLimiter"
import { platformConfigService } from "../../../services/platform-config.service"
import logger from "../../../utils/logger"

/**
 * WhatsApp Rate Limiting Middleware
 *
 * Single Responsibility: Prevent spam and abuse
 *
 * Limits:
 * - IP-level token bucket (configurable via PlatformConfig LIMITS)
 *
 * SECURITY:
 * - Protegge da spam
 * - Protegge da attacchi DDoS
 * - Salva rate limit violations nel log
 */

/**
 * Rate limit middleware for WhatsApp endpoints
 */
export async function whatsappRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const isWebhook = req.path.includes("/webhook") && req.method === "POST"
    const forwarded = (req.headers["x-forwarded-for"] as string) || ""
    const ip =
      forwarded.split(",")[0]?.trim() ||
      req.ip ||
      (req.connection as any)?.remoteAddress ||
      "unknown"

    const [ipPerMin, ipBurst] = await Promise.all([
      platformConfigService.getLimit("WHATSAPP_RATE_LIMIT_IP_PER_MIN"),
      platformConfigService.getLimit("WHATSAPP_RATE_LIMIT_IP_BURST"),
    ])

    const ipLimiterConfig = {
      capacity: ipPerMin + ipBurst,
      refillPerMs: ipPerMin / 60000,
    }

    if (!whatsappIpRateLimiter.isAllowed(ip, ipLimiterConfig)) {
      const retryAfterMs = whatsappIpRateLimiter.getTimeToReset(ip, ipLimiterConfig)
      logger.warn("[RATE-LIMIT] ❌ IP limit exceeded", {
        ip,
        limitPerMin: ipPerMin,
        retryAfterMs,
      })

      if (isWebhook) {
        // ✅ Return 200 to avoid Meta retries
        res.status(200).json({
          status: "rate_limited",
          code: "IP_RATE_LIMIT_EXCEEDED",
          retryAfterMs,
        })
        return
      }

      res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many requests. Please wait before retrying.",
        retryAfterMs,
      })
      return
    }

    next()
  } catch (error: any) {
    logger.error("[RATE-LIMIT] Error checking rate limits:", {
      error: error.message,
      path: req.path,
    })

    // On error, allow request (fail open for availability)
    next()
  }
}
