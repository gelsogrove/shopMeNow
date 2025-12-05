/**
 * OAuth Authentication Service
 * Handles advanced auth features: OAuth, 2FA, profile pictures
 * 
 * SECURITY FEATURES:
 * - Multi-provider OAuth (Google, Facebook, Apple)
 * - Mandatory 2FA for all users
 * - Admin-initiated 2FA reset (Feature 189 - replaces recovery codes)
 * - Rate limiting integration
 * - Audit logging
 * - Session management
 */

import { PrismaClient, User } from '@echatbot/database'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { AppError } from '../../interfaces/http/middlewares/error.middleware'
import logger from '../../utils/logger'
import { validatePassword } from '../../config/security.config'
import { getDefaultAvatarUrl } from '../../config/oauth.config'
import { logAuthAttempt } from '../../middlewares/rateLimit.middleware'

export interface RegisterData {
  email: string
  password?: string  // Optional for OAuth users
  firstName: string
  lastName: string
  authProvider: 'email' | 'google' | 'facebook' | 'apple'
  profilePicture?: string
  gdprAccepted?: Date
}

export interface OAuthProfile {
  email: string
  firstName: string
  lastName: string
  profilePicture?: string
  provider: 'google' | 'facebook' | 'apple'
}

export class OAuthAuthService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Register user with email/password
   * @param data - Registration data
   * @param ipAddress - Client IP
   * @param userAgent - Client User-Agent
   * @returns Created user
   */
  async registerWithEmail(
    data: Omit<RegisterData, 'authProvider'>,
    ipAddress?: string,
    userAgent?: string
  ): Promise<User> {
    try {
      // Validate password
      if (!data.password) {
        throw new AppError(400, 'Password is required for email registration')
      }

      const validation = validatePassword(data.password)
      if (!validation.valid) {
        await logAuthAttempt({
          email: data.email,
          attemptType: 'registration',
          success: false,
          failureReason: validation.error,
          ipAddress,
          userAgent,
        })
        throw new AppError(400, validation.error!)
      }

      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      })

      if (existingUser) {
        await logAuthAttempt({
          email: data.email,
          attemptType: 'registration',
          success: false,
          failureReason: 'Utente già presente',
          ipAddress,
          userAgent,
        })
        throw new AppError(409, 'Utente già presente. Effettua il login.')
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10)

      // Create user
      const user = await this.prisma.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          authProvider: 'email',
          profilePicture: null, // Will use default avatar
          gdprAccepted: data.gdprAccepted || new Date(),
          twoFactorEnabled: false, // Will be enabled after 2FA setup
        },
      })

      // Log successful registration
      await logAuthAttempt({
        userId: user.id,
        email: user.email,
        attemptType: 'registration',
        success: true,
        ipAddress,
        userAgent,
      })

      logger.info('User registered with email', {
        userId: user.id,
        email: user.email,
      })

      return user
    } catch (error) {
      if (error instanceof AppError) throw error
      logger.error('Email registration failed', error)
      throw new AppError(500, 'Registration failed')
    }
  }

  /**
   * Register or login user with OAuth provider
   * @param profile - OAuth profile data
   * @param ipAddress - Client IP
   * @param userAgent - Client User-Agent
   * @returns User and isNew flag
   */
  async registerOrLoginWithOAuth(
    profile: OAuthProfile,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ user: User; isNew: boolean }> {
    try {
      // Check if user exists
      let user = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() },
      })

      if (user) {
        // Existing user - update profile picture if provided
        if (profile.profilePicture && !user.profilePicture) {
          user = await this.prisma.user.update({
            where: { id: user.id },
            data: { profilePicture: profile.profilePicture },
          })
        }

        // Update linked providers if not already linked
        const linkedProviders = (user.linkedProviders as any[]) || []
        const isProviderLinked = linkedProviders.some(
          (p: any) => p.provider === profile.provider
        )

        if (!isProviderLinked) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              linkedProviders: [
                ...linkedProviders,
                { provider: profile.provider, linkedAt: new Date().toISOString() },
              ],
            },
          })
        }

        // Log OAuth login
        await logAuthAttempt({
          userId: user.id,
          email: user.email,
          attemptType: `oauth-${profile.provider}`,
          success: true,
          ipAddress,
          userAgent,
        })

        logger.info('User logged in with OAuth', {
          userId: user.id,
          email: user.email,
          provider: profile.provider,
        })

        return { user, isNew: false }
      }

      // New user - create account
      user = await this.prisma.user.create({
        data: {
          email: profile.email.toLowerCase(),
          passwordHash: null, // OAuth users don't have password
          firstName: profile.firstName,
          lastName: profile.lastName,
          authProvider: profile.provider,
          profilePicture: profile.profilePicture || null,
          linkedProviders: [
            { provider: profile.provider, linkedAt: new Date().toISOString() },
          ],
          gdprAccepted: new Date(),
          twoFactorEnabled: false, // Will be enabled after 2FA setup
        },
      })

      // Log OAuth registration
      await logAuthAttempt({
        userId: user.id,
        email: user.email,
        attemptType: `oauth-${profile.provider}`,
        success: true,
        ipAddress,
        userAgent,
        metadata: { action: 'registration' },
      })

      logger.info('User registered with OAuth', {
        userId: user.id,
        email: user.email,
        provider: profile.provider,
      })

      return { user, isNew: true }
    } catch (error) {
      if (error instanceof AppError) throw error
      logger.error('OAuth registration/login failed', error)
      throw new AppError(500, 'OAuth authentication failed')
    }
  }

  /**
   * Enable 2FA for user
   * NOTE: Recovery codes have been REMOVED (Feature 189)
   * Users who lose access must contact admin for 2FA reset
   * @param userId - User ID
   */
  async enable2FA(userId: string): Promise<void> {
    try {
      // Update user - Enable 2FA
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date(),
          // NOTE: recoveryCodes field removed (Feature 189)
        },
      })

      logger.info('2FA enabled for user', { userId })
    } catch (error) {
      logger.error('Failed to enable 2FA', error)
      throw new AppError(500, 'Failed to enable 2FA')
    }
  }

  /**
   * Verify recovery code - DEPRECATED (Feature 189)
   * Recovery codes have been removed. Users must contact admin for 2FA reset.
   * @deprecated Use admin-initiated 2FA reset instead
   */
  async verifyRecoveryCode(_userId: string, _code: string): Promise<{ valid: boolean; newRecoveryCode?: string }> {
    // Feature 189: Recovery codes removed - return deprecated message
    logger.warn('verifyRecoveryCode called but recovery codes have been removed (Feature 189)')
    return { 
      valid: false, 
      // No newRecoveryCode - feature removed
    }
  }

  /**
   * Get user profile picture URL (or default)
   * @param user - User object
   * @returns Profile picture URL
   */
  getUserAvatar(user: User): string {
    if (user.profilePicture) {
      return user.profilePicture
    }
    return getDefaultAvatarUrl(user.firstName || undefined, user.lastName || undefined)
  }

  /**
   * Add password to OAuth user (optional feature)
   * @param userId - User ID
   * @param password - New password
   */
  async addPasswordToOAuthUser(userId: string, password: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      if (user.passwordHash) {
        throw new AppError(400, 'User already has a password')
      }

      // Validate password
      const validation = validatePassword(password)
      if (!validation.valid) {
        throw new AppError(400, validation.error!)
      }

      // Hash and save password
      const passwordHash = await bcrypt.hash(password, 10)

      await this.prisma.user.update({
        where: { id: userId },
        data: { 
          passwordHash,
          authProvider: 'multi', // User now has multiple auth methods
        },
      })

      logger.info('Password added to OAuth user', { userId })
    } catch (error) {
      if (error instanceof AppError) throw error
      logger.error('Failed to add password to OAuth user', error)
      throw new AppError(500, 'Failed to add password')
    }
  }
}
