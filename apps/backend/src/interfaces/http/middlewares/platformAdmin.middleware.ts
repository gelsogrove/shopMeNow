import { Request, Response, NextFunction } from "express"
import logger from "../../../utils/logger"

/**
 * Middleware to verify user is a PLATFORM ADMIN
 * Used for PLATFORM-LEVEL operations (not workspace-specific)
 * 
 * Examples:
 * - Editing legal documents (GDPR, Privacy Policy for eCHATBOT site)
 * - Managing global platform configuration
 * - Viewing all users across platform
 * 
 * CRITICAL: This is NOT for workspace admins. This is for eCHATBOT platform admins only.
 */
export const platformAdminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user

    if (!user) {
      logger.error("❌ [PlatformAdmin] No user found in request")
      res.status(401).json({ error: "Authentication required" })
      return
    }

    logger.info(`🔍 [PlatformAdmin] Checking platform admin status for user: ${user.email}`)

    // Check if user is platform admin
    if (!user.isPlatformAdmin) {
      logger.warn(
        `⚠️ [PlatformAdmin] Access DENIED for user ${user.email} - isPlatformAdmin=${user.isPlatformAdmin}`
      )
      res.status(403).json({
        error: "Platform admin access required",
        message: "This operation requires platform administrator privileges",
      })
      return
    }

    logger.info(`✅ [PlatformAdmin] Access GRANTED for platform admin: ${user.email}`)
    next()
  } catch (error) {
    logger.error("❌ [PlatformAdmin] Error checking platform admin status:", error)
    res.status(500).json({ error: "Internal server error" })
  }
}
