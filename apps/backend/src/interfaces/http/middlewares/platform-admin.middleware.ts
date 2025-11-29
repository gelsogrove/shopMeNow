/**
 * Platform Admin Middleware
 * 
 * Verifies that the authenticated user has isPlatformAdmin = true
 * This middleware MUST be used AFTER authMiddleware
 * 
 * Usage:
 *   router.get('/admin-route', authMiddleware, platformAdminMiddleware, controller.method)
 */

import { NextFunction, Request, Response } from "express"
import logger from "../../../utils/logger"

/**
 * Middleware to verify platform admin access
 * Returns 403 Forbidden if user is not a platform admin
 */
export const platformAdminMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Ensure user is authenticated (authMiddleware should have run first)
    // Using type assertion since authMiddleware adds user to request
    const user = (req as any).user
    
    if (!user) {
      logger.warn("platformAdminMiddleware: No user in request - authMiddleware may not have run")
      res.status(401).json({
        success: false,
        error: "Authentication required",
      })
      return
    }

    // Check if user is platform admin
    if (!user.isPlatformAdmin) {
      logger.warn(`Platform admin access denied for user: ${user.email}`)
      res.status(403).json({
        success: false,
        error: "Platform admin access required",
        message: "You do not have permission to access this resource",
      })
      return
    }

    logger.info(`Platform admin access granted for user: ${user.email}`)
    next()
  } catch (error) {
    logger.error("platformAdminMiddleware error:", error)
    res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
}
