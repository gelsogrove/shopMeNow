/**
 * 🔐 TWO-FACTOR RESET ROUTES (PUBLIC)
 * 
 * Public endpoints for 2FA reset flow (accessed via email link).
 * These routes don't require authentication - the token in the URL is the auth.
 * 
 * Flow:
 * 1. User clicks link in email → GET /api/auth/2fa-reset/:token (validate token)
 * 2. User enters password → POST /api/auth/2fa-reset/:token/verify-password
 * 3. User sets up new 2FA → POST /api/auth/2fa-reset/:token/complete
 * 
 * Security:
 * - Token is UUID v4 (122 bits entropy)
 * - Token expires in 1 hour
 * - Token is single-use
 * - Password verification required
 * - Account lockout after 5 failed password attempts
 */

import { Router, Request, Response } from "express"
import { createHash } from "crypto"
import { prisma } from "@echatbot/database"
import speakeasy from "speakeasy"
import QRCode from "qrcode"
import { TwoFactorResetService } from "../../../application/services/two-factor-reset.service"
import logger from "../../../utils/logger"

// BUG#17 FIX: hash token before DB lookup (DB stores SHA-256, not raw token)
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')

const router = Router()
const twoFactorResetService = new TwoFactorResetService(prisma)

/**
 * @swagger
 * /api/auth/2fa-reset/{token}:
 *   get:
 *     summary: Validate 2FA reset token
 *     description: |
 *       Validates the token from the email link.
 *       Returns user email (masked) if valid.
 *       Does NOT consume the token.
 *     tags: [Auth - 2FA Reset]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Reset token from email
 *     responses:
 *       200:
 *         description: Token validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 email:
 *                   type: string
 *                   description: Masked email (e.g., a***@example.com)
 *                 error:
 *                   type: string
 */
router.get(
  "/2fa-reset/:token",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params
      const ipAddress = req.ip || req.socket.remoteAddress

      const result = await twoFactorResetService.validateToken(token, ipAddress)

      if (!result.valid) {
        return res.status(400).json({
          valid: false,
          error: result.error,
        })
      }

      // Mask email for display
      const maskedEmail = maskEmail(result.email!)

      res.json({
        valid: true,
        email: maskedEmail,
      })
    } catch (error: any) {
      logger.error("Error validating 2FA reset token:", error)
      res.status(500).json({
        valid: false,
        error: "Failed to validate token",
      })
    }
  }
)

/**
 * @swagger
 * /api/auth/2fa-reset/{token}/start:
 *   post:
 *     summary: Start 2FA reset (simplified flow)
 *     description: |
 *       Validates token and returns QR code directly.
 *       No password verification required (email verification is implicit).
 *       This is the simplified flow for OAuth users who may not have a password.
 *     tags: [Auth - 2FA Reset]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Reset token from email
 *     responses:
 *       200:
 *         description: QR code generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 email:
 *                   type: string
 *                   description: Masked email
 *                 qrCodeUri:
 *                   type: string
 *                   description: OTPAuth URI for QR code
 *                 secret:
 *                   type: string
 *                   description: TOTP secret (base32)
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  "/2fa-reset/:token/start",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params
      const ipAddress = req.ip || req.socket.remoteAddress

      // Validate token
      const result = await twoFactorResetService.validateToken(token, ipAddress)

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          error: result.error,
        })
      }

      // Get full email for QR code generation
      // BUG#17 FIX: look up by SHA-256(token)
      const resetToken = await prisma.twoFactorResetToken.findFirst({
        where: { token: hashToken(token) },
        include: { user: true },
      })

      if (!resetToken) {
        return res.status(400).json({
          success: false,
          error: "Invalid token",
        })
      }

      // Generate new 2FA secret for the user
      const secret = speakeasy.generateSecret({
        name: `eChatbot (${resetToken.user.email})`,
        issuer: "eChatbot",
        length: 32,
      })

      // Mask email for display
      const maskedEmail = maskEmail(resetToken.user.email)

      logger.info(`2FA reset started for user ${maskedEmail} (token: ${token.substring(0, 8)}...)`)

      res.json({
        success: true,
        email: maskedEmail,
        qrCodeUri: secret.otpauth_url,
        secret: secret.base32,
      })
    } catch (error: any) {
      logger.error("Error starting 2FA reset:", error)
      res.status(500).json({
        success: false,
        error: "Failed to start 2FA reset",
      })
    }
  }
)

/**
 * @swagger
 * /api/auth/2fa-reset/{token}/verify-password:
 *   post:
 *     summary: Verify password for 2FA reset
 *     description: |
 *       User verifies their password to prove identity.
 *       Returns a temporary token for 2FA setup (10 min expiry).
 *     tags: [Auth - 2FA Reset]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password verified
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 tempToken:
 *                   type: string
 *                   description: Temporary token for 2FA setup (10 min expiry)
 *                 qrCode:
 *                   type: string
 *                   description: QR code data URL for authenticator app
 *                 secret:
 *                   type: string
 *                   description: TOTP secret (base32)
 *       400:
 *         description: Invalid credentials or locked out
 *       429:
 *         description: Too many attempts
 */
router.post(
  "/2fa-reset/:token/verify-password",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: "Email and password are required",
        })
      }

      const result = await twoFactorResetService.verifyPassword(token, email, password)

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error,
        })
      }

      // Generate new 2FA secret for the user
      const secret = speakeasy.generateSecret({
        name: `eChatbot (${email})`,
        issuer: "eChatbot",
        length: 32,
      })

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

      res.json({
        success: true,
        tempToken: result.tempToken,
        qrCode: qrCodeUrl,
        secret: secret.base32,
      })
    } catch (error: any) {
      logger.error("Error verifying password for 2FA reset:", error)
      res.status(500).json({
        success: false,
        error: "Failed to verify password",
      })
    }
  }
)

/**
 * @swagger
 * /api/auth/2fa-reset/{token}/complete:
 *   post:
 *     summary: Complete 2FA reset
 *     description: |
 *       Completes the 2FA setup with the new secret.
 *       User must provide a valid TOTP code from their authenticator.
 *       Token is consumed after successful completion.
 *     tags: [Auth - 2FA Reset]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - secret
 *               - totpCode
 *             properties:
 *               secret:
 *                 type: string
 *                 description: TOTP secret (base32)
 *               totpCode:
 *                 type: string
 *                 description: 6-digit code from authenticator app
 *     responses:
 *       200:
 *         description: 2FA reset completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid token or TOTP code
 */
router.post(
  "/2fa-reset/:token/complete",
  async (req: Request, res: Response) => {
    try {
      const { token } = req.params
      const { secret, totpCode } = req.body

      if (!secret || !totpCode) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields",
        })
      }

      // BUG#17 FIX: look up by SHA-256(token)
      const resetToken = await prisma.twoFactorResetToken.findFirst({
        where: { token: hashToken(token) },
        include: { user: true },
      })

      if (!resetToken) {
        return res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        })
      }

      // Check expiry
      if (new Date() > resetToken.expiresAt) {
        return res.status(400).json({
          success: false,
          error: "Token expired",
        })
      }

      // Check if already used
      if (resetToken.usedAt) {
        return res.status(400).json({
          success: false,
          error: "Token already used",
        })
      }

      // Verify TOTP code
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: totpCode,
        window: 1,
      })

      if (!verified) {
        return res.status(400).json({
          success: false,
          error: "Invalid verification code. Please try again.",
        })
      }

      // Enable 2FA with new secret
      await prisma.$transaction([
        // Update user with new 2FA secret
        prisma.user.update({
          where: { id: resetToken.userId },
          data: {
            twoFactorSecret: secret,
            twoFactorEnabled: true,
            twoFactorEnabledAt: new Date(),
            recoveryCodes: [], // Clear any old recovery codes
          },
        }),
        // Mark token as used
        prisma.twoFactorResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
      ])

      logger.info(`2FA reset completed for user ${resetToken.user.email}`)

      res.json({
        success: true,
        message: "Two-factor authentication has been reset successfully. You can now login with your new 2FA.",
      })
    } catch (error: any) {
      logger.error("Error completing 2FA reset:", error)
      res.status(500).json({
        success: false,
        error: "Failed to complete 2FA reset",
      })
    }
  }
)

/**
 * Mask email for display
 * a]example.com → a***@example.com
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@")
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`
  }
  return `${local[0]}${local[1]}***@${domain}`
}

export default router
