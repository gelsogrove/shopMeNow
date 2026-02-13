/**
 * 🔐 ADMIN USER PERMISSIONS & STATUS ROUTES
 *
 * User permissions (isPlatformAdmin, isDeveloperUser) and status (ACTIVE/DISABLED).
 * Extracted from admin-user-management.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import {
  prisma,
  UserStatus,
} from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"

const router = Router()

// =============================================================================
// 🔐 USER PERMISSIONS
// =============================================================================

/**
 * @swagger
 * /api/users/admin/{userId}/permissions:
 *   put:
 *     summary: Update user permissions
 *     description: Update isPlatformAdmin and/or isDeveloperUser for a user
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isPlatformAdmin:
 *                 type: boolean
 *               isDeveloperUser:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Permissions updated
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: User not found
 */
router.put(
  "/admin/:userId/permissions",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { isPlatformAdmin, isDeveloperUser } = req.body

      // Validate at least one permission is being updated
      if (isPlatformAdmin === undefined && isDeveloperUser === undefined) {
        return res.status(400).json({
          success: false,
          error: "At least one permission must be provided",
        })
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // Build update data with mutual exclusion logic
      // If isPlatformAdmin becomes true -> isDeveloperUser becomes false
      // If isDeveloperUser becomes true -> isPlatformAdmin becomes false
      const updateData: { isPlatformAdmin?: boolean; isDeveloperUser?: boolean } = {}
      
      if (isPlatformAdmin === true) {
        updateData.isPlatformAdmin = true
        updateData.isDeveloperUser = false  // Mutual exclusion
      } else if (isDeveloperUser === true) {
        updateData.isDeveloperUser = true
        updateData.isPlatformAdmin = false  // Mutual exclusion
      } else {
        // Just setting one to false
        if (isPlatformAdmin !== undefined) {
          updateData.isPlatformAdmin = isPlatformAdmin
        }
        if (isDeveloperUser !== undefined) {
          updateData.isDeveloperUser = isDeveloperUser
        }
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          isPlatformAdmin: true,
          isDeveloperUser: true,
        },
      })

      logger.info(
        `🔐 Platform admin updated permissions for ${updatedUser.email}: isPlatformAdmin=${updatedUser.isPlatformAdmin}, isDeveloperUser=${updatedUser.isDeveloperUser}`
      )

      res.json({
        success: true,
        data: updatedUser,
      })
    } catch (error) {
      logger.error("Error updating user permissions:", error)
      res.status(500).json({
        success: false,
        error: "Failed to update permissions",
      })
    }
  }
)

// =============================================================================
// 🔄 USER STATUS
// =============================================================================

/**
 * @swagger
 * /api/users/admin/{userId}/status:
 *   put:
 *     summary: Enable or disable a user
 *     description: Set user status to ACTIVE or DISABLED. Disabled users cannot login.
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, DISABLED]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: User not found
 */
router.put(
  "/admin/:userId/status",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { status } = req.body

      // Validate status - convert DISABLED to INACTIVE for Prisma
      if (!status || !["ACTIVE", "DISABLED", "INACTIVE"].includes(status)) {
        return res.status(400).json({
          success: false,
          error: "Status must be 'ACTIVE' or 'DISABLED'",
        })
      }

      // Map DISABLED to INACTIVE (Prisma enum)
      const prismaStatus: UserStatus = status === "DISABLED" ? UserStatus.INACTIVE : UserStatus.ACTIVE

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      })

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // Prevent disabling yourself
      const currentUserId = (req as any).user?.id
      if (userId === currentUserId && prismaStatus === UserStatus.INACTIVE) {
        return res.status(400).json({
          success: false,
          error: "Cannot disable your own account",
        })
      }

      // Update user status
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { status: prismaStatus },
        select: {
          id: true,
          email: true,
          status: true,
        },
      })

      // ✅ NO CASCADE: Owner status check is now done in workspaceValidationMiddleware
      // Channels keep their original state (no accidental re-activation)
      logger.info(`✅ User status updated to ${prismaStatus} - operations blocked in middleware if INACTIVE`)

      // Return status as DISABLED for frontend compatibility
      const responseStatus = updatedUser.status === UserStatus.INACTIVE ? "DISABLED" : "ACTIVE"

      logger.info(
        `🔐 Platform admin ${responseStatus === "DISABLED" ? "disabled" : "enabled"} user ${updatedUser.email}`
      )

      res.json({
        success: true,
        data: {
          ...updatedUser,
          status: responseStatus,
        },
      })
    } catch (error) {
      logger.error("Error updating user status:", error)
      res.status(500).json({
        success: false,
        error: "Failed to update status",
      })
    }
  }
)

export default router
