import rateLimit from "express-rate-limit"
import logger from "../../../utils/logger"

/**
 * Rate limiter per endpoint di login
 *
 * OWASP A07:2021 - Identification and Authentication Failures
 * Protezione contro attacchi brute force
 *
 * POLICY:
 * - Max 5 tentativi per IP ogni 15 minuti
 * - Dopo 5 tentativi: blocco temporaneo di 15 minuti
 * - Header X-RateLimit-* per informare il client
 * - Log di eventi rate limit exceeded
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 5, // Max 5 richieste per IP
  message: {
    error: "Too many login attempts",
    message:
      "Too many login attempts from this IP, please try again after 15 minutes",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers

  // Handler custom per logging
  handler: (req, res) => {
    logger.warn(`🚨 Rate limit exceeded for IP ${req.ip} on ${req.path}`)
    res.status(429).json({
      error: "Too many login attempts",
      message:
        "Too many login attempts from this IP, please try again after 15 minutes",
      retryAfter: "15 minutes",
    })
  },

  // Skip successful requests (only count failed attempts would be better, but requires custom logic)
  skip: (req) => {
    // Non contare richieste da IP localhost in development
    if (process.env.NODE_ENV === "development" && req.ip === "::1") {
      return false // Count anche in dev per testare
    }
    return false
  },
})

/**
 * Rate limiter generico per API pubbliche
 * Più permissivo del login limiter
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // Max 100 richieste per IP
  message: {
    error: "Too many requests",
    message: "Too many requests from this IP, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    logger.warn(`🚨 API rate limit exceeded for IP ${req.ip} on ${req.path}`)
    res.status(429).json({
      error: "Too many requests",
      message: "Too many requests from this IP, please try again later",
    })
  },
})
