/**
 * Authentication Service
 * 
 * Centralizes all authentication logic:
 * - User registration
 * - Login/logout
 * - Password management (change, reset)
 * - 2FA verification
 * 
 * ARCHITECTURE:
 * - Controllers handle HTTP (req/res)
 * - This service handles business logic
 * - Repositories handle database access
 */

import { PrismaClient, User, UserStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AppError } from '../../interfaces/http/middlewares/error.middleware'
import logger from '../../utils/logger'
import { config } from '../../config'
import { validatePassword } from '../../config/security.config'

export interface RegisterData {
  email: string
  password: string
  firstName: string
  lastName: string
  gdprAccepted?: Date
}

export interface LoginResult {
  user: User
  token: string
  requires2FA: boolean
}

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Register new user with email/password
   */
  async register(data: RegisterData): Promise<User> {
    const { email, password, firstName, lastName, gdprAccepted } = data

    // Validate password strength
    const validation = validatePassword(password)
    if (!validation.valid) {
      throw new AppError(400, validation.error!)
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      throw new AppError(409, 'User with this email already exists')
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        role: 'MEMBER',
        status: 'ACTIVE',
        authProvider: 'email',
        twoFactorEnabled: false,
        recoveryCodes: [],
        gdprAccepted: gdprAccepted || new Date(),
      },
    })

    logger.info(`✅ User registered: ${user.email}`)
    return user
  }

  /**
   * Login with email/password
   * Returns user, token, and 2FA requirement
   */
  async login(email: string, password: string): Promise<LoginResult> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      throw new AppError(401, 'Invalid credentials')
    }

    // Check account status
    if (user.status !== UserStatus.ACTIVE) {
      logger.warn(`🚫 Login attempt for disabled user: ${user.email}`)
      throw new AppError(403, 'Your account has been disabled. Please contact support.')
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash!)
    if (!isPasswordValid) {
      throw new AppError(401, 'Invalid credentials')
    }

    // Check if 2FA is enabled
    // 🔐 SKIP 2FA for Platform Admins and Developer Users
    const skip2FA = user.isPlatformAdmin || user.isDeveloperUser
    
    if (user.twoFactorEnabled && !skip2FA) {
      logger.info(`🔐 User ${user.email} requires 2FA verification`)
      return {
        user,
        token: '', // No token until 2FA verified
        requires2FA: true,
      }
    }
    
    if (skip2FA && user.twoFactorEnabled) {
      logger.info(`🔧 User ${user.email} has 2FA enabled but SKIPPED (isPlatformAdmin=${user.isPlatformAdmin}, isDeveloperUser=${user.isDeveloperUser})`)
    }

    // Generate JWT token
    const token = this.generateToken(user)

    logger.info(`✅ User ${user.email} logged in successfully`)
    return {
      user,
      token,
      requires2FA: false,
    }
  }

  /**
   * Change user password (requires current password)
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    // Get user
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user) {
      throw new AppError(404, 'User not found')
    }

    // Verify current password
    if (!user.passwordHash) {
      throw new AppError(400, 'User has no password set (OAuth user)')
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isPasswordValid) {
      throw new AppError(400, 'Current password is incorrect')
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters')
    }

    if (newPassword === currentPassword) {
      throw new AppError(400, 'New password must be different from current password')
    }

    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      throw new AppError(400, validation.error!)
    }

    // Hash and update password
    const passwordHash = await bcrypt.hash(newPassword, 10)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    })

    logger.info(`✅ Password changed for user: ${userId}`)
  }

  /**
   * Request password reset (generates token, sends email)
   * Returns token for email sending
   */
  async requestPasswordReset(email: string): Promise<string> {
    // Generate reset token
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour

    // Check if user exists (but don't reveal in response for security)
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (user) {
      // Create reset token
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      })

      logger.info(`🔑 Password reset token generated for: ${email}`)
    } else {
      logger.warn(`⚠️ Password reset requested for non-existent email: ${email}`)
    }

    return token
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Find valid token
    const resetToken = await this.prisma.passwordReset.findFirst({
      where: {
        token,
        usedAt: null,
      },
    })

    if (!resetToken) {
      throw new AppError(400, 'Invalid or expired reset token')
    }

    // Check expiration
    if (resetToken.expiresAt < new Date()) {
      throw new AppError(400, 'Reset token has expired')
    }

    // Validate new password
    if (newPassword.length < 8) {
      throw new AppError(400, 'Password must be at least 8 characters')
    }

    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      throw new AppError(400, validation.error!)
    }

    // Hash and update password + mark token as used in a transaction
    const passwordHash = await bcrypt.hash(newPassword, 10)
    
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordReset.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    logger.info(`✅ Password reset successful for user: ${resetToken.userId}`)
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin || false,
        isDeveloperUser: user.isDeveloperUser || false,
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
      } as jwt.SignOptions
    )
  }
}
