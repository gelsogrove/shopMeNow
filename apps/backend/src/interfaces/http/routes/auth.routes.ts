import { Router, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import logger from "../../../utils/logger"
import { AuthController } from "../controllers/auth.controller"
import { EnhancedAuthController } from "../controllers/enhanced-auth.controller"
import { OAuthController } from "../controllers/oauth.controller"
import { AuthService } from "../../../application/services/auth.service"
import { asyncHandler } from "../middlewares/async.middleware"
import { authMiddleware } from "../middlewares/auth.middleware"
import {
  validateForgotPassword,
  validateResetPassword,
} from "../middlewares/validation.middleware"
import {
  loginLimiter,
  forgotPasswordLimiter,
  twoFactorLimiter,
  registrationLimiter,
} from "../../../config/rate-limiters"

// Prisma client and services
const authService = new AuthService(prisma)

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

  router.post(
    "/refresh",
    authMiddleware,
    asyncHandler(authController.refresh.bind(authController))
  )

  // OLD register route (kept for backwards compatibility)
  router.post(
    "/register-old",
    registrationLimiter,
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
    forgotPasswordLimiter,
    validateForgotPassword,
    asyncHandler(authController.forgotPassword.bind(authController))
  )

  router.post(
    "/reset-password",
    forgotPasswordLimiter,
    validateResetPassword,
    asyncHandler(authController.resetPassword.bind(authController))
  )

  // ============================================
  // NEW ENHANCED ROUTES (Multi-provider 2FA)
  // ============================================

  // Email/Password Registration (NEW - with mandatory 2FA)
  router.post(
    "/register",
    registrationLimiter,
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

  // Recovery Code Verification - DEPRECATED (Feature 189)
  // Recovery codes have been removed. Users who lose access must contact admin for reset.
  router.post(
    "/verify-recovery-code",
    (_req: Request, res: Response) => {
      res.status(410).json({
        error: 'Recovery codes have been removed',
        message: 'Please contact your administrator to reset your 2FA.',
      })
    }
  )

  // Get User Avatar (NEW)
  router.get(
    "/avatar/:userId",
    asyncHandler(enhancedAuthController.getUserAvatar.bind(enhancedAuthController))
  )

  // ============================================
  // SET PASSWORD FOR OAUTH USERS (Feature 189)
  // ============================================
  
  /**
   * @swagger
   * /api/auth/set-password:
   *   post:
   *     summary: Set password for OAuth user
   *     description: |
   *       Allows OAuth users (Google, etc.) to set a password.
   *       After setting password, user becomes "multi" provider
   *       and can login with either OAuth or email/password.
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - password
   *             properties:
   *               password:
   *                 type: string
   *                 minLength: 8
   *                 description: New password (min 8 chars, must include uppercase, lowercase, number, special char)
   *     responses:
   *       200:
   *         description: Password set successfully
   *       400:
   *         description: Already has password or invalid password
   *       401:
   *         description: Not authenticated
   */
  router.post(
    "/set-password",
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const userId = (req as any).user.id
      const { password } = req.body

      if (!password) {
        return res.status(400).json({ error: 'Password is required' })
      }

      await authService.setPasswordForOAuthUser(userId, password)

      res.json({
        success: true,
        message: 'Password set successfully. You can now login with email/password too.',
      })
    })
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
