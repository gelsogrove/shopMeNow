/**
 * Enhanced Authentication Controller
 * Handles advanced auth features: Registration, OAuth, 2FA Setup, Recovery Codes
 * 
 * ROUTES:
 * - POST /api/auth/register - Email/password registration
 * - POST /api/auth/setup-2fa - Setup 2FA after registration
 * - POST /api/auth/verify-2fa-setup - Verify 2FA setup code
 * - POST /api/auth/verify-recovery-code - Verify recovery code (2FA bypass)
 * - GET /api/auth/oauth/:provider - Initiate OAuth flow
 * - GET /api/auth/callback/:provider - OAuth callback
 * 
 * SECURITY:
 * - Rate limiting on all routes
 * - Mandatory 2FA for all users
 * - Audit logging
 * - Input validation
 */

import { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import * as jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { config } from '../../../config'
import { OAuthAuthService } from '../../../application/services/oauth-auth.service'
import { OtpService } from '../../../application/services/otp.service'
import { EmailService } from '../../../application/services/email.service'
import { AdminSessionService } from '../../../application/services/admin-session.service'
import { AppError } from '../middlewares/error.middleware'
import { logAuthAttempt } from '../../../middlewares/rateLimit.middleware'
import logger from '../../../utils/logger'

const prisma = new PrismaClient()

export class EnhancedAuthController {
  private oauthAuthService: OAuthAuthService
  private otpService: OtpService
  private emailService: EmailService
  private adminSessionService: AdminSessionService

  constructor() {
    this.oauthAuthService = new OAuthAuthService(prisma)
    this.otpService = new OtpService(prisma)
    this.emailService = new EmailService()
    this.adminSessionService = new AdminSessionService()
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: any): string {
    const signOptions: SignOptions = {
      // @ts-ignore
      expiresIn: config.jwt.expiresIn,
    }

    return jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        isPlatformAdmin: user.isPlatformAdmin || false,
        isDeveloperUser: user.isDeveloperUser || false,
        twoFactorEnabled: user.twoFactorEnabled 
      },
      config.jwt.secret,
      signOptions
    )
  }

  /**
   * Register new user with email/password
   * POST /api/auth/register
   * 
   * Body: { email, password, firstName, lastName, gdprAccepted }
   * Response: { user, qrCode } - User created, must setup 2FA next
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName, gdprAccepted } = req.body
      const ipAddress = req.ip || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      // Validate input
      if (!email || !password || !firstName || !lastName) {
        throw new AppError(400, 'Missing required fields')
      }

      if (!gdprAccepted) {
        throw new AppError(400, 'GDPR acceptance is required')
      }

      // Register user
      const user = await this.oauthAuthService.registerWithEmail(
        {
          email,
          password,
          firstName,
          lastName,
          gdprAccepted: new Date(),
        },
        ipAddress,
        userAgent
      )

      // Generate 2FA QR code
      const qrCode = await this.otpService.setupTwoFactor(user.id)

      // 🔒 SECURITY: NO session/token until 2FA is verified!
      // User must complete 2FA setup before getting authenticated

      // Send welcome email
      try {
        await this.emailService.sendWelcomeEmail({
          to: user.email,
          firstName: user.firstName,
        })
        logger.info(`✅ Welcome email sent to: ${user.email}`)
      } catch (emailError) {
        logger.error('Failed to send welcome email', emailError)
        // Don't fail registration if email fails
      }

      res.status(201).json({
        message: 'Registration successful. Please setup 2FA.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        qrCode, // QR code for 2FA setup
        // NO sessionId or token - user must verify 2FA first!
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Registration error:', error)
      throw new AppError(500, 'Registration failed')
    }
  }

  /**
   * Verify 2FA setup and enable 2FA
   * POST /api/auth/verify-2fa-setup
   * 
   * Body: { userId, code }
   * Response: { recoveryCodes } - 2FA enabled, return recovery codes
   */
  async verify2FASetup(req: Request, res: Response): Promise<void> {
    logger.info('🔍 [verify2FASetup] ENTRY POINT - Method called', {
      url: req.url,
      method: req.method,
      body: req.body,
    })
    
    try {
      logger.info('🔍 [verify2FASetup] Inside try block')

      const { userId, code } = req.body
      const ipAddress = req.ip || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      if (!userId || !code) {
        logger.error('❌ [verify2FASetup] Missing userId or code')
        throw new AppError(400, 'User ID and verification code are required')
      }

      logger.info(`🔍 [verify2FASetup] Verifying TOTP for user: ${userId}`)

      // Verify TOTP code
      const isValid = await this.otpService.verifyTwoFactor(userId, code)

      if (!isValid) {
        await logAuthAttempt({
          userId,
          email: 'unknown',
          attemptType: '2fa',
          success: false,
          failureReason: 'Invalid 2FA code during setup',
          ipAddress,
          userAgent,
        })
        throw new AppError(400, 'Invalid verification code')
      }

      // Enable 2FA (Feature 189: Recovery codes removed)
      await this.oauthAuthService.enable2FA(userId)

      // Get user info
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { 
          id: true, 
          email: true, 
          role: true, 
          firstName: true, 
          lastName: true,
          profilePicture: true,
        },
      })

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      logger.info('🔍 [verify2FASetup] User fetched from DB:', { 
        userId: user.id, 
        email: user.email 
      })

      // ❌ REMOVED: Automatic workspace creation
      // User MUST create workspace manually after registration
      // This allows users to customize workspace name, phone number, etc.

      // 🔐 CREATE ADMIN SESSION (user is now fully authenticated after 2FA setup)
      const sessionId = await this.adminSessionService.createSession(
        user.id,
        null, // workspaceId: null (will be set after workspace selection)
        ipAddress,
        userAgent
      )

      logger.info(
        `✅ User ${user.email} completed 2FA setup with sessionId: ${sessionId.substring(0, 8)}...`
      )

      // Generate JWT token (user is now fully authenticated)
      const token = this.generateToken(user)
      
      // 🔍 DEBUG: Decode token to verify content
      const decodedToken = jwt.decode(token) as any
      logger.info('🔍 [verify2FASetup] Token generated for user:', {
        userId: user.id,
        email: user.email,
        tokenPreview: token.substring(0, 20) + '...',
        decodedToken: {
          id: decodedToken?.id,
          email: decodedToken?.email,
          role: decodedToken?.role,
        }
      })

      await logAuthAttempt({
        userId,
        email: user.email,
        attemptType: '2fa',
        success: true,
        ipAddress,
        userAgent,
        metadata: { action: 'setup_complete' },
      })

      res.status(200).json({
        message: '2FA enabled successfully',
        // NOTE: Recovery codes removed (Feature 189) - users contact admin for reset
        token, // JWT token for API calls
        sessionId, // 🆕 Include sessionId for frontend
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profilePicture: user.profilePicture,
        },
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('2FA setup verification error:', error)
      throw new AppError(500, '2FA setup verification failed')
    }
  }

  /**
   * Verify 2FA code (TOTP) during LOGIN
   * POST /api/auth/verify-2fa
   * 
   * Called after user enters email/password and system detects 2FA is enabled.
   * Verifies TOTP code and creates session + token for authenticated user.
   */
  async verify2FA(req: Request, res: Response): Promise<void> {
    try {
      const { userId, code } = req.body
      const ipAddress = req.ip || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      if (!userId || !code) {
        throw new AppError(400, 'ID utente e codice di verifica sono richiesti')
      }

      // Verify TOTP code
      const isValid = await this.otpService.verifyTwoFactor(userId, code)

      if (!isValid) {
        await logAuthAttempt({
          userId,
          email: '', // Will be filled after user fetch
          attemptType: '2fa',
          success: false,
          failureReason: 'Codice TOTP non valido',
          ipAddress,
          userAgent,
        })
        throw new AppError(401, 'Invalid verification code')
      }

      // TOTP valid - fetch user and create session
      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new AppError(404, 'User not found')
      }

      // Log successful 2FA
      await logAuthAttempt({
        userId,
        email: user.email,
        attemptType: '2fa',
        success: true,
        ipAddress,
        userAgent,
        metadata: { method: 'totp' },
      })

      // 🔐 CREATE ADMIN SESSION (CRITICAL - only after 2FA verified)
      const sessionId = await this.adminSessionService.createSession(
        user.id,
        null, // workspaceId: null (will be set after workspace selection)
        ipAddress,
        userAgent
      )

      logger.info(
        `✅ User ${user.email} verified 2FA with sessionId: ${sessionId.substring(0, 8)}...`
      )

      // Generate JWT token
      const token = this.generateToken(user)

      res.status(200).json({
        valid: true,
        message: 'Verifica 2FA completata con successo',
        token,
        sessionId, // 🆕 CRITICAL: Include sessionId for frontend to save
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profilePicture: this.oauthAuthService.getUserAvatar(user),
        },
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Errore verifica 2FA:', error)
      throw new AppError(500, 'Verifica 2FA fallita')
    }
  }

  /**
   * Verify recovery code (2FA bypass)
   * POST /api/auth/verify-recovery-code
   * 
   * Body: { userId, code }
   * Response: { valid, sessionId, token } - If valid, logs user in
   */
  async verifyRecoveryCode(req: Request, res: Response): Promise<void> {
    try {
      const { userId, code } = req.body
      const ipAddress = req.ip || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      if (!userId || !code) {
        throw new AppError(400, 'ID utente e codice di recupero sono richiesti')
      }

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user) {
        throw new AppError(404, 'Utente non trovato')
      }

      // Verify recovery code
      const result = await this.oauthAuthService.verifyRecoveryCode(userId, code)

      if (!result.valid) {
        await logAuthAttempt({
          userId,
          email: user.email,
          attemptType: '2fa',
          success: false,
          failureReason: 'Codice di recupero non valido',
          ipAddress,
          userAgent,
        })
        throw new AppError(401, 'Codice di recupero non valido') // 401 for authentication failure
      }

      // Recovery code valid - log user in
      await logAuthAttempt({
        userId,
        email: user.email,
        attemptType: '2fa',
        success: true,
        ipAddress,
        userAgent,
        metadata: { method: 'recovery_code' },
      })

      // 🔐 CREATE ADMIN SESSION
      const sessionId = await this.adminSessionService.createSession(
        user.id,
        null, // workspaceId: null (will be set after workspace selection)
        ipAddress,
        userAgent
      )

      logger.info(
        `✅ User ${user.email} logged in via recovery code with sessionId: ${sessionId.substring(0, 8)}...`
      )

      // Generate JWT token
      const token = this.generateToken(user)

      res.status(200).json({
        valid: true, // For compatibility with frontend
        message: 'Codice di recupero accettato',
        token,
        sessionId, // 🆕 Include sessionId for frontend
        newRecoveryCode: result.newRecoveryCode, // ✅ Return new recovery code to user
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profilePicture: this.oauthAuthService.getUserAvatar(user),
        },
      })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Errore verifica codice di recupero:', error)
      throw new AppError(500, 'Verifica codice di recupero fallita')
    }
  }

  /**
   * OAuth login/registration callback
   * This is called by OAuth strategies after successful authentication
   * 
   * @param profile - OAuth profile from provider
   * @param req - Express request
   * @param res - Express response
   */
  async handleOAuthCallback(
    profile: any,
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const ipAddress = req.ip || req.socket.remoteAddress
      const userAgent = req.headers['user-agent']

      // Register or login user
      const { user, isNew } = await this.oauthAuthService.registerOrLoginWithOAuth(
        {
          email: profile.email,
          firstName: profile.firstName || profile.name?.givenName || '',
          lastName: profile.lastName || profile.name?.familyName || '',
          profilePicture: profile.picture || profile.photos?.[0]?.value,
          provider: profile.provider,
        },
        ipAddress,
        userAgent
      )

      // If new user or 2FA not enabled, must setup 2FA
      // Check if user has twoFactorSecret (indicates 2FA setup completed)
      const needs2FASetup = isNew || !user.twoFactorSecret
      
      if (needs2FASetup) {
        // Generate QR code
        const qrCode = await this.otpService.setupTwoFactor(user.id)

        // Redirect to 2FA setup page
        const setupUrl = `${process.env.FRONTEND_URL}/auth/setup-2fa?userId=${user.id}&qrCode=${encodeURIComponent(qrCode)}&provider=${profile.provider}`
        
        return res.redirect(setupUrl)
      }

      // Existing user with 2FA - redirect to 2FA verification
      const verifyUrl = `${process.env.FRONTEND_URL}/auth/verify-2fa?userId=${user.id}&provider=${profile.provider}`
      
      res.redirect(verifyUrl)
    } catch (error) {
      logger.error('OAuth callback error:', error)
      const errorUrl = `${process.env.FRONTEND_URL}/auth/login?error=oauth_failed`
      res.redirect(errorUrl)
    }
  }

  /**
   * Get user avatar (profile picture or default)
   * GET /api/auth/avatar/:userId
   */
  async getUserAvatar(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!user) {
        throw new AppError(404, 'User not found')
      }

      const avatarUrl = this.oauthAuthService.getUserAvatar(user)

      res.status(200).json({ avatarUrl })
    } catch (error) {
      if (error instanceof AppError) {
        throw error
      }
      logger.error('Get avatar error:', error)
      throw new AppError(500, 'Failed to get avatar')
    }
  }
}
