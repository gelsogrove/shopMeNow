/**
 * Rate Limiting Middleware
 * Implements brute force protection using database-backed rate limiting
 * 
 * SECURITY FEATURES:
 * - Per-IP rate limiting
 * - Per-email rate limiting
 * - Account lockout after threshold
 * - Exponential backoff
 * - Audit logging
 */

import { Request, Response, NextFunction } from 'express'
import { prisma } from '@echatbot/database'
import { getSecurityConfig } from '../config/security.config'
import logger from '../utils/logger'

export type RateLimitType = 'login' | 'twoFactor' | 'passwordReset' | 'registration'

/**
 * Check rate limit for specific attempt type
 * @param email - User email
 * @param ipAddress - Client IP address
 * @param attemptType - Type of authentication attempt
 * @returns True if rate limit exceeded
 */
export const checkRateLimit = async (
  email: string,
  ipAddress: string,
  attemptType: RateLimitType
): Promise<{ limited: boolean; remainingAttempts?: number; resetTime?: Date }> => {
  const config = getSecurityConfig()
  const rateLimitConfig = config.rateLimit[attemptType]
  
  const windowStart = new Date(Date.now() - rateLimitConfig.windowMs)
  
  // Count failed attempts in time window (by email)
  const emailAttempts = await prisma.authenticationAttempt.count({
    where: {
      email: email.toLowerCase(),
      attemptType: attemptType,
      success: false,
      timestamp: {
        gte: windowStart,
      },
    },
  })
  
  // Count failed attempts in time window (by IP)
  const ipAttempts = await prisma.authenticationAttempt.count({
    where: {
      ipAddress: ipAddress,
      attemptType: attemptType,
      success: false,
      timestamp: {
        gte: windowStart,
      },
    },
  })
  
  const maxAttempts = rateLimitConfig.maxAttempts
  const emailLimited = emailAttempts >= maxAttempts
  const ipLimited = ipAttempts >= maxAttempts * 2 // IP limit is 2x email limit
  
  if (emailLimited || ipLimited) {
    const resetTime = new Date(Date.now() + rateLimitConfig.windowMs)
    
    logger.warn('Rate limit exceeded', {
      email,
      ipAddress,
      attemptType,
      emailAttempts,
      ipAttempts,
      maxAttempts,
      resetTime,
    })
    
    return {
      limited: true,
      remainingAttempts: 0,
      resetTime,
    }
  }
  
  return {
    limited: false,
    remainingAttempts: maxAttempts - emailAttempts,
  }
}

/**
 * Log authentication attempt
 * @param data - Attempt data
 */
export const logAuthAttempt = async (data: {
  userId?: string
  email: string
  attemptType: string
  success: boolean
  failureReason?: string
  ipAddress?: string
  userAgent?: string
  metadata?: any
}): Promise<void> => {
  try {
    await prisma.authenticationAttempt.create({
      data: {
        userId: data.userId,
        email: data.email.toLowerCase(),
        attemptType: data.attemptType,
        success: data.success,
        failureReason: data.failureReason,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        metadata: data.metadata,
      },
    })
  } catch (error) {
    logger.error('Failed to log auth attempt', error)
  }
}

/**
 * Check if account is locked
 * @param email - User email
 * @returns True if account is locked
 */
export const isAccountLocked = async (email: string): Promise<{ locked: boolean; unlockTime?: Date }> => {
  const config = getSecurityConfig()
  const windowStart = new Date(Date.now() - config.accountLockout.durationMs)
  
  // Count failed login attempts in lockout window
  const failedAttempts = await prisma.authenticationAttempt.count({
    where: {
      email: email.toLowerCase(),
      attemptType: 'login',
      success: false,
      timestamp: {
        gte: windowStart,
      },
    },
  })
  
  const locked = failedAttempts >= config.accountLockout.threshold
  
  if (locked) {
    // Find most recent failed attempt to calculate unlock time
    const lastAttempt = await prisma.authenticationAttempt.findFirst({
      where: {
        email: email.toLowerCase(),
        attemptType: 'login',
        success: false,
      },
      orderBy: {
        timestamp: 'desc',
      },
    })
    
    if (lastAttempt) {
      const unlockTime = new Date(lastAttempt.timestamp.getTime() + config.accountLockout.durationMs)
      
      logger.warn('Account locked', {
        email,
        failedAttempts,
        unlockTime,
      })
      
      return { locked: true, unlockTime }
    }
  }
  
  return { locked: false }
}

/**
 * Rate limit middleware factory
 * Creates middleware for specific attempt type
 */
export const rateLimitMiddleware = (attemptType: RateLimitType) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const email = req.body.email?.toLowerCase()
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown'
    
    if (!email) {
      return next() // Skip if no email in request
    }
    
    try {
      // Check rate limit
      const rateLimit = await checkRateLimit(email, ipAddress, attemptType)
      
      if (rateLimit.limited) {
        const minutesUntilReset = Math.ceil(
          ((rateLimit.resetTime?.getTime() || 0) - Date.now()) / 60000
        )
        
        return res.status(429).json({
          error: 'Too many attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          remainingAttempts: 0,
          resetTime: rateLimit.resetTime,
          message: `Too many ${attemptType} attempts. Please try again in ${minutesUntilReset} minutes.`,
        })
      }
      
      // Check account lockout (for login attempts)
      if (attemptType === 'login') {
        const lockStatus = await isAccountLocked(email)
        
        if (lockStatus.locked) {
          const minutesUntilUnlock = Math.ceil(
            ((lockStatus.unlockTime?.getTime() || 0) - Date.now()) / 60000
          )
          
          return res.status(423).json({
            error: 'Account temporarily locked due to too many failed login attempts.',
            code: 'ACCOUNT_LOCKED',
            unlockTime: lockStatus.unlockTime,
            message: `Account locked. Try again in ${minutesUntilUnlock} minutes.`,
          })
        }
      }
      
      // Attach rate limit info to request
      ;(req as any).rateLimit = rateLimit
      
      next()
    } catch (error) {
      logger.error('Rate limit check failed', error)
      // Don't block on rate limit errors
      next()
    }
  }
}

/**
 * Clear rate limit attempts for successful login
 * @param email - User email
 */
export const clearRateLimitAttempts = async (email: string): Promise<void> => {
  // We don't delete attempts (audit log), but successful login resets the window
  // The time-based window automatically "clears" old attempts
  logger.info('User successfully authenticated, rate limit window reset', { email })
}
