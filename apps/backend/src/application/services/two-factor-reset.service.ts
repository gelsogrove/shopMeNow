/**
 * TwoFactorResetService
 * 
 * Handles admin-initiated 2FA reset flow:
 * 1. Admin initiates reset for a user who lost their phone
 * 2. System sends email with secure reset link
 * 3. User clicks link, enters password to verify identity
 * 4. User completes new 2FA setup
 * 
 * Security features:
 * - UUID v4 tokens with 122 bits entropy
 * - 1 hour expiry
 * - Single use tokens
 * - Password verification required
 * - Account lockout after 5 failed attempts
 * - Audit logging
 */

import { PrismaClient, User, TwoFactorResetToken } from '@prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer'
import logger from '../../utils/logger'
import { AppError } from '../../interfaces/http/middlewares/error.middleware'

// Rate limiting for admin resets (in-memory, should use Redis in production)
const adminResetCounts = new Map<string, { count: number; resetAt: Date }>()
const MAX_ADMIN_RESETS_PER_HOUR = 10

// Rate limiting for token validation attempts by IP
const tokenValidationAttempts = new Map<string, { count: number; resetAt: Date }>()
const MAX_TOKEN_ATTEMPTS_PER_HOUR = 5

export interface CreateResetTokenResult {
  tokenId: string
  expiresAt: Date
}

export interface ValidateTokenResult {
  valid: boolean
  userId?: string
  email?: string
  error?: string
}

export interface VerifyPasswordResult {
  success: boolean
  tempToken?: string
  error?: string
}

export interface Complete2FAResult {
  success: boolean
  error?: string
}

export class TwoFactorResetService {
  private prisma: PrismaClient
  private transporter: nodemailer.Transporter

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    // Transporter will be created lazily on first use
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const config = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || '',
        },
      }
      logger.info(`📧 Setting up email transporter: ${config.host}:${config.port} (secure: ${config.secure})`)
      this.transporter = nodemailer.createTransport(config)
    }
    return this.transporter
  }

  /**
   * Admin initiates 2FA reset for a user
   * - Validates user has 2FA enabled
   * - Disables 2FA immediately (old codes stop working)
   * - Creates reset token
   * - Sends email
   */
  async createResetToken(
    userId: string, 
    adminId: string,
    adminEmail: string
  ): Promise<CreateResetTokenResult> {
    // SEC-10: Prevent admin from resetting own 2FA
    if (userId === adminId) {
      throw new AppError(400, 'Cannot reset your own 2FA. Use password reset if locked out.')
    }

    // SEC-11: Rate limit admin resets
    const adminRate = adminResetCounts.get(adminId)
    const now = new Date()
    if (adminRate) {
      const hourAgo = new Date(now.getTime() - 3600000)
      if (adminRate.resetAt > hourAgo && adminRate.count >= MAX_ADMIN_RESETS_PER_HOUR) {
        throw new AppError(429, 'Too many reset requests. Maximum 10 resets per hour.')
      }
      if (adminRate.resetAt <= hourAgo) {
        adminResetCounts.set(adminId, { count: 1, resetAt: now })
      } else {
        adminRate.count++
      }
    } else {
      adminResetCounts.set(adminId, { count: 1, resetAt: now })
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new AppError(404, 'User not found')
    }

    if (!user.twoFactorEnabled) {
      throw new AppError(400, 'User does not have 2FA enabled')
    }

    // SEC-14: Immediately disable 2FA (old codes stop working)
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    })

    // SEC-1: Generate cryptographically secure token (UUID v4)
    const token = crypto.randomUUID()
    
    // SEC-2: 1 hour expiry
    const expiresAt = new Date(Date.now() + 3600000)

    // Create token record
    const resetToken = await this.prisma.twoFactorResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
        createdByAdminId: adminId,
      },
    })

    // SEC-12: Audit log
    logger.info(`2FA reset initiated by admin ${adminEmail} for user ${user.email} (token: ${token.substring(0, 8)}...)`)

    // Send email with reset link
    await this.sendResetEmail(user.email, token, adminEmail, user.firstName)

    return {
      tokenId: resetToken.id,
      expiresAt,
    }
  }

  /**
   * Create enable token for users without 2FA (Feature 189)
   * Admin can force-enable 2FA for any user
   */
  async createEnableToken(
    userId: string, 
    adminId: string,
    adminEmail: string
  ): Promise<{ tokenId: string; expiresAt: Date }> {
    // Rate limit per admin
    const now = new Date()
    const adminRate = adminResetCounts.get(adminId)
    
    if (adminRate) {
      const hourAgo = new Date(now.getTime() - 3600000)
      if (adminRate.resetAt > hourAgo && adminRate.count >= MAX_ADMIN_RESETS_PER_HOUR) {
        throw new AppError(429, 'Too many requests. Maximum 10 per hour.')
      }
      if (adminRate.resetAt <= hourAgo) {
        adminResetCounts.set(adminId, { count: 1, resetAt: now })
      } else {
        adminRate.count++
      }
    } else {
      adminResetCounts.set(adminId, { count: 1, resetAt: now })
    }

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new AppError(404, 'User not found')
    }

    if (user.twoFactorEnabled) {
      throw new AppError(400, 'User already has 2FA enabled. Use Reset 2FA instead.')
    }

    // Generate token
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour

    // Create token record
    const enableToken = await this.prisma.twoFactorResetToken.create({
      data: {
        userId,
        token,
        expiresAt,
        createdByAdminId: adminId,
      },
    })

    // Audit log
    logger.info(`2FA enable initiated by admin ${adminEmail} for user ${user.email} (token: ${token.substring(0, 8)}...)`)

    // Send email with setup link
    await this.sendEnableEmail(user.email, token, adminEmail, user.firstName)

    return {
      tokenId: enableToken.id,
      expiresAt,
    }
  }

  /**
   * Validate reset token without consuming it
   * Used when user clicks the link
   */
  async validateToken(token: string, ipAddress?: string): Promise<ValidateTokenResult> {
    // SEC-4: Rate limit token validation by IP
    if (ipAddress) {
      const attempts = tokenValidationAttempts.get(ipAddress)
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 3600000)

      if (attempts && attempts.resetAt > hourAgo && attempts.count >= MAX_TOKEN_ATTEMPTS_PER_HOUR) {
        return { valid: false, error: 'Too many attempts. Please try again later.' }
      }

      if (attempts && attempts.resetAt <= hourAgo) {
        tokenValidationAttempts.set(ipAddress, { count: 1, resetAt: now })
      } else if (attempts) {
        attempts.count++
      } else {
        tokenValidationAttempts.set(ipAddress, { count: 1, resetAt: now })
      }
    }

    const resetToken = await this.prisma.twoFactorResetToken.findFirst({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      return { valid: false, error: 'Invalid or expired token' }
    }

    // SEC-2: Check expiry
    if (new Date() > resetToken.expiresAt) {
      return { valid: false, error: 'Token expired' }
    }

    // SEC-3: Check if already used
    if (resetToken.usedAt) {
      return { valid: false, error: 'Token already used' }
    }

    return {
      valid: true,
      userId: resetToken.userId,
      email: resetToken.user.email,
    }
  }

  /**
   * Verify user's password after clicking reset link
   * Returns temporary token for 2FA setup
   */
  async verifyPassword(
    token: string, 
    email: string, 
    password: string
  ): Promise<VerifyPasswordResult> {
    const resetToken = await this.prisma.twoFactorResetToken.findFirst({
      where: { token },
      include: { user: true },
    })

    if (!resetToken) {
      // SEC-7: Generic error
      return { success: false, error: 'Invalid credentials' }
    }

    // Check token validity
    if (new Date() > resetToken.expiresAt || resetToken.usedAt) {
      return { success: false, error: 'Invalid credentials' }
    }

    // SEC-6: Check account lockout
    if (resetToken.lockedUntil && new Date() < resetToken.lockedUntil) {
      const remainingMinutes = Math.ceil(
        (resetToken.lockedUntil.getTime() - Date.now()) / 60000
      )
      return { 
        success: false, 
        error: `Account temporarily locked. Try again in ${remainingMinutes} minutes.` 
      }
    }

    // SEC-7: Verify email matches (generic error if not)
    if (resetToken.user.email.toLowerCase() !== email.toLowerCase()) {
      await this.incrementPasswordAttempts(resetToken)
      return { success: false, error: 'Invalid credentials' }
    }

    // Check if user has a password
    if (!resetToken.user.passwordHash) {
      // OAuth user without password - need different flow
      return { success: false, error: 'Please login with your social account (Google, etc.)' }
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, resetToken.user.passwordHash)
    
    if (!passwordValid) {
      await this.incrementPasswordAttempts(resetToken)
      return { success: false, error: 'Invalid credentials' }
    }

    // Reset failed attempts on success
    await this.prisma.twoFactorResetToken.update({
      where: { id: resetToken.id },
      data: { passwordAttempts: 0, lockedUntil: null },
    })

    // SEC-8: Generate temp token (NOT full JWT - has pendingAction)
    const tempToken = jwt.sign(
      {
        userId: resetToken.userId,
        resetTokenId: resetToken.id,
        pendingAction: 'require-2fa-setup',
        exp: Math.floor(Date.now() / 1000) + 600, // 10 min expiry
      },
      process.env.JWT_SECRET!
    )

    logger.info(`Password verified for 2FA reset, user: ${email} (token: ${token.substring(0, 8)}...)`)

    return {
      success: true,
      tempToken,
    }
  }

  /**
   * Complete 2FA setup after password verification
   */
  async complete2FASetup(
    tempToken: string,
    newSecret: string,
    totpCode: string
  ): Promise<Complete2FAResult> {
    // Verify temp token
    let decoded: any
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET!)
    } catch {
      return { success: false, error: 'Invalid or expired session' }
    }

    if (decoded.pendingAction !== 'require-2fa-setup') {
      return { success: false, error: 'Invalid session' }
    }

    // Get the reset token
    const resetToken = await this.prisma.twoFactorResetToken.findUnique({
      where: { id: decoded.resetTokenId },
    })

    if (!resetToken) {
      return { success: false, error: 'Invalid session' }
    }

    // SEC-15: Check if already used
    if (resetToken.usedAt) {
      return { success: false, error: 'Setup already completed' }
    }

    // Verify TOTP code with new secret
    const speakeasy = await import('speakeasy')
    const isValidCode = speakeasy.default.totp.verify({
      secret: newSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    })

    if (!isValidCode) {
      return { success: false, error: 'Invalid verification code' }
    }

    // Enable 2FA with new secret
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: {
          twoFactorSecret: newSecret,
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date(),
        },
      }),
      // SEC-3: Mark token as used
      this.prisma.twoFactorResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    logger.info(`2FA reset completed for user ${resetToken.userId} (token: ${resetToken.token.substring(0, 8)}...)`)

    return { success: true }
  }

  /**
   * Increment failed password attempts, lock if too many
   */
  private async incrementPasswordAttempts(resetToken: TwoFactorResetToken): Promise<void> {
    const newAttempts = resetToken.passwordAttempts + 1
    const shouldLock = newAttempts >= 5 // SEC-6: 5 attempts max

    await this.prisma.twoFactorResetToken.update({
      where: { id: resetToken.id },
      data: {
        passwordAttempts: newAttempts,
        lockedUntil: shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null, // 15 min lockout
      },
    })

    if (shouldLock) {
      logger.warn(`2FA reset token locked due to failed password attempts (token: ${resetToken.token.substring(0, 8)}...)`)
    }
  }

  /**
   * Send 2FA reset email
   */
  private async sendResetEmail(
    userEmail: string,
    token: string,
    adminEmail: string,
    firstName?: string | null
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const resetLink = `${frontendUrl}/auth/2fa-reset/${token}`

    const subject = '🔐 Reset Your Two-Factor Authentication'
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>2FA Reset</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Two-Factor Authentication Reset</h1>
  
  <p>Hello${firstName ? ` ${firstName}` : ''},</p>
  
  <p>An administrator (<strong>${adminEmail}</strong>) has initiated a 2FA reset for your account.</p>
  
  <p>If you requested this reset because you lost access to your authenticator app, click the button below to set up 2FA again:</p>
  
  <p style="text-align: center; margin: 30px 0;">
    <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Reset 2FA
    </a>
  </p>
  
  <p><strong>⚠️ Important:</strong></p>
  <ul>
    <li>This link expires in <strong>1 hour</strong></li>
    <li>You will need to enter your password</li>
    <li>After verification, you'll set up a new 2FA</li>
  </ul>
  
  <p style="color: #dc2626; font-weight: bold;">
    🚨 If you did not request this reset, contact support immediately. Your 2FA has been disabled.
  </p>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  
  <p style="color: #666; font-size: 12px;">
    This is an automated message from ShopME. Do not reply to this email.
  </p>
</body>
</html>
`

    const text = `
Two-Factor Authentication Reset

Hello${firstName ? ` ${firstName}` : ''},

An administrator (${adminEmail}) has initiated a 2FA reset for your account.

If you requested this reset, click the link below to set up 2FA again:
${resetLink}

⚠️ Important:
- This link expires in 1 hour
- You will need to enter your password
- After verification, you'll set up a new 2FA

🚨 If you did not request this reset, contact support immediately. Your 2FA has been disabled.
`

    try {
      await this.getTransporter().sendMail({
        from: `"ShopME" <${process.env.SMTP_FROM || 'noreply@shopme.com'}>`,
        to: userEmail,
        subject,
        html,
        text,
      })
      logger.info(`2FA reset email sent to ${userEmail}`)
    } catch (error) {
      logger.error(`Failed to send 2FA reset email to ${userEmail}:`, error)
      throw new AppError(500, 'Failed to send reset email')
    }
  }

  /**
   * Send 2FA enable email (for users without 2FA)
   */
  private async sendEnableEmail(
    userEmail: string,
    token: string,
    adminEmail: string,
    firstName?: string | null
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const setupLink = `${frontendUrl}/auth/2fa-reset/${token}`

    const subject = '🔐 Set Up Two-Factor Authentication'
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>2FA Setup</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1 style="color: #333;">Set Up Two-Factor Authentication</h1>
  
  <p>Hello${firstName ? ` ${firstName}` : ''},</p>
  
  <p>An administrator (<strong>${adminEmail}</strong>) has requested that you enable Two-Factor Authentication (2FA) on your account for enhanced security.</p>
  
  <p>Click the button below to set up 2FA:</p>
  
  <p style="text-align: center; margin: 30px 0;">
    <a href="${setupLink}" style="background-color: #10B981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">
      Set Up 2FA
    </a>
  </p>
  
  <p><strong>What you'll need:</strong></p>
  <ul>
    <li>An authenticator app (Google Authenticator, Authy, etc.)</li>
    <li>Your smartphone to scan the QR code</li>
  </ul>
  
  <p><strong>⏰ Note:</strong> This link expires in <strong>1 hour</strong>.</p>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  
  <p style="color: #666; font-size: 12px;">
    This is an automated message from ShopME. Do not reply to this email.
  </p>
</body>
</html>
`

    const text = `
Set Up Two-Factor Authentication

Hello${firstName ? ` ${firstName}` : ''},

An administrator (${adminEmail}) has requested that you enable Two-Factor Authentication (2FA) on your account for enhanced security.

Click the link below to set up 2FA:
${setupLink}

What you'll need:
- An authenticator app (Google Authenticator, Authy, etc.)
- Your smartphone to scan the QR code

⏰ Note: This link expires in 1 hour.
`

    try {
      await this.getTransporter().sendMail({
        from: `"ShopME" <${process.env.SMTP_FROM || 'noreply@shopme.com'}>`,
        to: userEmail,
        subject,
        html,
        text,
      })
      logger.info(`2FA enable email sent to ${userEmail}`)
    } catch (error) {
      logger.error(`Failed to send 2FA enable email to ${userEmail}:`, error)
      throw new AppError(500, 'Failed to send setup email')
    }
  }

  /**
   * Cleanup expired tokens (run periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.twoFactorResetToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })
    
    if (result.count > 0) {
      logger.info(`Cleaned up ${result.count} expired 2FA reset tokens`)
    }
    
    return result.count
  }
}

export const twoFactorResetService = (prisma: PrismaClient) => new TwoFactorResetService(prisma)
