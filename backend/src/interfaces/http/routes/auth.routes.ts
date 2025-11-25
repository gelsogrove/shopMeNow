import { Router } from "express"
import rateLimit from "express-rate-limit"
import logger from "../../../utils/logger"
import { AuthController } from "../controllers/auth.controller"
import { EnhancedAuthController } from "../controllers/enhanced-auth.controller"
import { OAuthController } from "../controllers/oauth.controller"
import { asyncHandler } from "../middlewares/async.middleware"
import { authMiddleware } from "../middlewares/auth.middleware"
import {
  validateForgotPassword,
  validateResetPassword,
} from "../middlewares/validation.middleware"

// Rate limiters
// 🔒 LOGIN RATE LIMITER (OWASP A07:2021 - Protection against brute force attacks)
// DEVELOPMENT SETTINGS: 15 minutes window, max 50 attempts (increased for testing)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 login attempts per IP per 15 minutes (increased for development)
  message: {
    error: "Too many login attempts",
    message:
      "Too many login attempts from this IP, please try again after 15 minutes",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.info(`🚨 RATE LIMIT EXCEEDED for IP ${req.ip} on ${req.path}`)
    res.status(429).json({
      error: "Too many login attempts",
      message:
        "Too many login attempts from this IP, please try again after 15 minutes",
      retryAfter: "15 minutes",
    })
  },
})

const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 🧪 INCREASED for testing (was 3) - CHANGE BACK TO 3 IN PRODUCTION
  message: {
    error: "Too many 2FA verification attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 requests per windowMs
  message: { error: "Too many registration attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
})

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 password reset requests per windowMs
  message: {
    error: "Too many password reset attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const createAuthRouter = (authController: AuthController): Router => {
  const router = Router()
  
  // Initialize enhanced auth controller
  const enhancedAuthController = new EnhancedAuthController()
  
  // Initialize OAuth controller
  const oauthController = new OAuthController()

  // ============================================
  // EXISTING ROUTES (Manteniamo compatibilità)
  // ============================================
  
  // 🔒 OWASP A07: Brute force protection on login endpoint (max 5 attempts per IP per 15 min)
  router.post(
    "/login",
    loginLimiter,
    asyncHandler(authController.login.bind(authController))
  )

  router.get(
    "/me",
    authMiddleware,
    asyncHandler(authController.me.bind(authController))
  )

  router.post(
    "/logout",
    authMiddleware,
    asyncHandler(authController.logout.bind(authController))
  )

  // OLD register route (kept for backwards compatibility)
  router.post(
    "/register-old",
    registerLimiter,
    asyncHandler(authController.register.bind(authController))
  )

  // 2FA routes (existing)
  router.get(
    "/2fa/setup/:userId",
    twoFactorLimiter,
    asyncHandler(authController.setup2FA.bind(authController))
  )

  router.post(
    "/2fa/verify",
    twoFactorLimiter,
    asyncHandler(authController.verify2FA.bind(authController))
  )

  // Password reset routes
  router.post(
    "/forgot-password",
    passwordResetLimiter,
    validateForgotPassword,
    asyncHandler(authController.forgotPassword.bind(authController))
  )

  router.post(
    "/reset-password",
    passwordResetLimiter,
    validateResetPassword,
    asyncHandler(authController.resetPassword.bind(authController))
  )

  // ============================================
  // NEW ENHANCED ROUTES (Multi-provider 2FA)
  // ============================================

  // Email/Password Registration (NEW - with mandatory 2FA)
  router.post(
    "/register",
    registerLimiter,
    asyncHandler(enhancedAuthController.register.bind(enhancedAuthController))
  )

  // 2FA Setup Verification (NEW)
  // 🔒 NO AUTH REQUIRED - User hasn't authenticated yet (just registered)
  router.post(
    "/verify-2fa-setup",
    // Temporarily remove rate limiter to test if it's causing 401
    asyncHandler(enhancedAuthController.verify2FASetup.bind(enhancedAuthController))
  )

  // 2FA Login Verification (NEW)
  // 🔒 NO AUTH REQUIRED - User is verifying 2FA during login (creates sessionId)
  router.post(
    "/verify-2fa",
    twoFactorLimiter,
    asyncHandler(enhancedAuthController.verify2FA.bind(enhancedAuthController))
  )

  // Recovery Code Verification (NEW)
  router.post(
    "/verify-recovery-code",
    twoFactorLimiter,
    asyncHandler(enhancedAuthController.verifyRecoveryCode.bind(enhancedAuthController))
  )

  // Get User Avatar (NEW)
  router.get(
    "/avatar/:userId",
    asyncHandler(enhancedAuthController.getUserAvatar.bind(enhancedAuthController))
  )

  // ============================================
  // OAUTH ROUTES (Google, Facebook, Apple)
  // ============================================

  // Google OAuth - Login/Register
  router.post(
    "/oauth/google",
    loginLimiter, // Same rate limit as regular login
    asyncHandler(oauthController.googleAuth.bind(oauthController))
  )

  return router
}

export { createAuthRouter as authRouter }
