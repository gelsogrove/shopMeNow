/**
 * Login Blocking Middleware - Prevents deleted accounts from accessing the system
 * Checks user.deletedAt in database (NOT from JWT - deletedAt is not in token)
 */

import { Request, Response, NextFunction } from "express"
import { prisma } from "@echatbot/database"
import logger from "../../../utils/logger"

/**
 * Middleware to check if user account is deleted
 * Must run AFTER authMiddleware (which sets req.user)
 * IMPORTANT: Queries database because deletedAt is NOT in JWT token
 * Call: router.use(loginBlockingMiddleware)
 */
export const loginBlockingMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Skip if no user (unauthenticated routes)
    if (!req.user) {
      return next()
    }

    // Get user ID from JWT (cast to any to access id)
    const jwtUser = req.user as any
    if (!jwtUser.id) {
      return next()
    }

    // Query database to check deletedAt (not stored in JWT)
    // Cast to any because Prisma types may be cached without deletedAt field
    const dbUser = await (prisma.user as any).findUnique({
      where: { id: jwtUser.id },
      select: { deletedAt: true, email: true },
    }) as { deletedAt: Date | null, email: string } | null

    // If user not found in DB, allow request (will fail elsewhere)
    if (!dbUser) {
      return next()
    }

    // Check if user is soft-deleted
    if (dbUser.deletedAt !== null) {
      const daysRemaining = calculateDaysRemaining(dbUser.deletedAt)

      logger.warn(`Deleted user attempted login: ${dbUser.email}`, {
        deletedAt: dbUser.deletedAt,
        daysRemaining,
      })

      return res.status(403).json({
        error: "Account deleted",
        message: "Your account has been deleted and cannot be accessed",
        daysUntilPermanentDelete: daysRemaining,
        deletedAt: dbUser.deletedAt,
      })
    }

    next()
  } catch (error) {
    logger.error("Login blocking middleware error", error)
    next() // Allow request to continue on error (fail-open for safety)
  }
}

/**
 * Calculate days remaining until permanent hard-delete
 */
function calculateDaysRemaining(deletedAt: Date, retentionDays: number = 90): number {
  const deleted = new Date(deletedAt)
  const expiryDate = new Date(deleted)
  expiryDate.setDate(expiryDate.getDate() + retentionDays)

  const now = new Date()
  const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return Math.max(0, daysRemaining)
}

/**
 * Middleware to require platform admin role
 * Must run AFTER authMiddleware
 * Only allows users with isPlatformAdmin = true
 * NO workspace admin access
 */
export const requirePlatformAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
      })
    }

    // Check isPlatformAdmin flag (cast to any to access soft-delete properties)
    const user = req.user as any
    if (!user.isPlatformAdmin) {
      logger.warn(`Non-admin user attempted restricted access: ${user.email}`, {
        isPlatformAdmin: user.isPlatformAdmin,
        path: req.path,
      })

      return res.status(403).json({
        error: "Forbidden",
        message: "Platform admin access required",
      })
    }

    next()
  } catch (error) {
    logger.error("Platform admin middleware error", error)
    res.status(500).json({
      error: "Internal server error",
      message: "Authentication check failed",
    })
  }
}
