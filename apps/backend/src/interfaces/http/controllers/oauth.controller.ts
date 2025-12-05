/**
 * OAuth Controller
 * Handles Google OAuth authentication
 * 
 * ROUTES:
 * - POST /api/auth/oauth/google - Verify Google token and login/register
 * 
 * FLOW:
 * 1. Frontend gets Google token via @react-oauth/google
 * 2. Frontend sends token to /auth/oauth/google
 * 3. Backend verifies token with Google
 * 4. If user exists: Login (check 2FA)
 * 5. If new user: Register + Setup 2FA
 * 
 * SECURITY:
 * - Google token verification
 * - Mandatory 2FA for all users
 * - Audit logging
 */

import { Request, Response } from 'express'
import { PrismaClient } from '@echatbot/database'
import { OAuth2Client } from 'google-auth-library'
import * as jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { config } from '../../../config'
import { OAuthAuthService } from '../../../application/services/oauth-auth.service'
import { AdminSessionService } from '../../../application/services/admin-session.service'
import { OtpService } from '../../../application/services/otp.service'
import { AppError } from '../middlewares/error.middleware'
import { logAuthAttempt } from '../../../middlewares/rateLimit.middleware'
import logger from '../../../utils/logger'
import { prisma } from "@echatbot/database"


export class OAuthController {
  private oauthAuthService: OAuthAuthService
  private adminSessionService: AdminSessionService
  private otpService: OtpService
  private googleClient: OAuth2Client

  constructor() {
    this.oauthAuthService = new OAuthAuthService(prisma)
    this.adminSessionService = new AdminSessionService()
    this.otpService = new OtpService(prisma)
    
    // Initialize Google OAuth client
    const googleClientId = process.env.GOOGLE_CLIENT_ID
    if (!googleClientId) {
      logger.error('❌ GOOGLE_CLIENT_ID not configured in .env')
      throw new Error('Google OAuth not configured')
    }
    this.googleClient = new OAuth2Client(googleClientId)
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
   * Google OAuth Login/Register
   * POST /api/auth/oauth/google
   * 
   * Body:
   * - credential: Google ID token (JWT from Google)
   * 
   * Response:
   * - NEW USER: { requiresSetup: true, userId, email, firstName, lastName, qrCode, provider: 'google' }
   * - EXISTING USER (2FA enabled): { requires2FA: true, userId, email, provider: 'google' }
   * - EXISTING USER (no 2FA): { sessionId, token, user } (should not happen - all users must have 2FA)
   */
  async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      const { credential } = req.body
      
      if (!credential) {
        throw new AppError(400, 'Google credential required')
      }

      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown'
      const userAgent = req.headers['user-agent'] || 'unknown'

      logger.info('🔐 [OAuth Google] Verifying Google token')

      // Verify Google token
      let ticket
      try {
        ticket = await this.googleClient.verifyIdToken({
          idToken: credential,
          audience: process.env.GOOGLE_CLIENT_ID,
        })
      } catch (error) {
        logger.error('❌ [OAuth Google] Token verification failed:', error)
        throw new AppError(401, 'Invalid Google token')
      }

      const payload = ticket.getPayload()
      if (!payload) {
        throw new AppError(401, 'Invalid Google token payload')
      }

      const { email, given_name, family_name, picture, sub: googleId } = payload

      if (!email) {
        throw new AppError(400, 'Email not provided by Google')
      }

      logger.info(`🔍 [OAuth Google] User from Google: ${email}`)

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          role: true,
          firstName: true,
          lastName: true,
          status: true,  // 🚫 User status check
          twoFactorEnabled: true,
          twoFactorSecret: true,
          authProvider: true,
          profilePicture: true,
          isPlatformAdmin: true,  // 🔐 Platform Admin check
          isDeveloperUser: true,  // 🔧 Developer User check
        },
      })

      // CASE 1: USER EXISTS
      if (existingUser) {
        logger.info(`✅ [OAuth Google] Existing user found: ${email}`)

        // 🚫 Check if user is disabled - block access before anything else
        if (existingUser.status !== 'ACTIVE') {
          logger.warn(`🚫 [OAuth Google] Login attempt for disabled user: ${email}`)
          throw new AppError(403, 'Your account has been disabled. Please contact support.')
        }

        // Update profile picture if changed
        if (picture && picture !== existingUser.profilePicture) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { profilePicture: picture },
          })
          logger.info(`🖼️ [OAuth Google] Updated profile picture for ${email}`)
        }

        // 🔐 SKIP 2FA for Platform Admins and Developer Users
        const skip2FA = existingUser.isPlatformAdmin || existingUser.isDeveloperUser
        
        if (skip2FA) {
          logger.info(`🔧 [OAuth Google] User ${email} SKIPPING 2FA (isPlatformAdmin=${existingUser.isPlatformAdmin}, isDeveloperUser=${existingUser.isDeveloperUser})`)
          
          // Create session immediately (no 2FA required)
          const sessionId = await this.adminSessionService.createSession(
            existingUser.id,
            null,
            ipAddress,
            userAgent
          )
          
          const token = this.generateToken(existingUser)
          
          await logAuthAttempt({
            userId: existingUser.id,
            email: existingUser.email,
            attemptType: 'oauth',
            success: true,
            ipAddress,
            userAgent,
            metadata: { provider: 'google', action: 'login_skip_2fa' },
          })
          
          // Return full login response (no 2FA needed)
          res.status(200).json({
            sessionId,
            token,
            user: {
              id: existingUser.id,
              email: existingUser.email,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              role: existingUser.role,
              isPlatformAdmin: existingUser.isPlatformAdmin,
              isDeveloperUser: existingUser.isDeveloperUser,
            },
            provider: 'google',
            message: 'Login successful',
          })
          return
        }

        // Check if 2FA is enabled
        if (!existingUser.twoFactorEnabled || !existingUser.twoFactorSecret) {
          logger.warn(`⚠️ [OAuth Google] User ${email} exists but 2FA not configured`)
          
          // USER ALREADY EXISTS BUT 2FA NOT COMPLETED
          // This can happen if:
          // 1. User registered with email/password but didn't complete 2FA setup
          // 2. User registered with Google but closed browser before completing setup
          
          // SOLUTION: Setup 2FA now and let them continue
          logger.info(`🔧 [OAuth Google] Setting up 2FA for existing user ${email}`)
          
          // Generate 2FA secret and otpauth URL (frontend will render QR code)
          const otpauthUrl = await this.otpService.setupTwoFactor(existingUser.id)
          
          await logAuthAttempt({
            userId: existingUser.id,
            email: existingUser.email,
            attemptType: 'oauth',
            success: true,
            ipAddress,
            userAgent,
            metadata: { provider: 'google', action: 'existing_user_setup_2fa' },
          })
          
          // Return setup required (same as new user registration)
          res.status(200).json({
            requiresSetup: true,
            user: {
              id: existingUser.id,
              email: existingUser.email,
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
            },
            qrCode: otpauthUrl, // Frontend will render this as QR code
            provider: 'google',
            message: 'Please complete 2FA setup to secure your account',
          })
          return
        }

        // USER EXISTS WITH 2FA ENABLED → Normal login flow
        await logAuthAttempt({
          userId: existingUser.id,
          email: existingUser.email,
          attemptType: 'oauth',
          success: true,
          ipAddress,
          userAgent,
          metadata: { provider: 'google', action: 'login_requires_2fa' },
        })

        // Return user info and require 2FA verification
        res.status(200).json({
          requires2FA: true,
          user: {
            id: existingUser.id,
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
          },
          provider: 'google',
          message: 'Please verify your identity with 2FA code',
        })
        return
      }

      // CASE 2: NEW USER - REGISTER
      logger.info(`🆕 [OAuth Google] New user registration: ${email}`)

      // Create user with Google provider (2FA will be enabled after setup)
      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash: '', // OAuth users don't have password
          firstName: given_name || '',
          lastName: family_name || '',
          role: 'MEMBER',
          authProvider: 'google',
          profilePicture: picture,
          twoFactorEnabled: false, // Will be enabled after 2FA verification
          gdprAccepted: new Date(), // Google login implies acceptance
          linkedProviders: [{ provider: 'google', linkedAt: new Date().toISOString(), providerId: googleId }],
        },
      })

      logger.info(`✅ [OAuth Google] User created: ${newUser.id}`)

      // Generate 2FA secret and otpauth URL using OtpService
      // This will create the secret and save it to the user automatically
      const otpauthUrl = await this.otpService.setupTwoFactor(newUser.id)
      
      // Verify that 2FA secret was saved
      const userWithSecret = await prisma.user.findUnique({
        where: { id: newUser.id },
        select: { twoFactorSecret: true },
      })
      
      if (!userWithSecret?.twoFactorSecret) {
        logger.error(`❌ [OAuth Google] Failed to save 2FA secret for user ${newUser.id}`)
        throw new AppError(500, 'Failed to setup 2FA')
      }
      
      logger.info(`✅ [OAuth Google] 2FA secret saved for user ${newUser.id}`)

      await logAuthAttempt({
        userId: newUser.id,
        email: newUser.email,
        attemptType: 'oauth',
        success: true,
        ipAddress,
        userAgent,
        metadata: { provider: 'google', action: 'register_requires_setup' },
      })

      // Return setup required response
      res.status(200).json({
        requiresSetup: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        },
        qrCode: otpauthUrl, // Frontend will render this as QR code
        provider: 'google',
        message: 'Please setup 2FA to complete registration',
      })
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          error: error.message,
        })
        return
      }
      logger.error('❌ [OAuth Google] Error:', error)
      res.status(500).json({
        error: 'OAuth authentication failed',
      })
    }
  }
}
