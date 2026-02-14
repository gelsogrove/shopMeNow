/**
 * 🔑 ADMIN USER SECURITY ROUTES
 *
 * 2FA reset/enable, impersonation, trial extension.
 * Extracted from admin-user-management.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import {
  prisma,
  UserStatus,
} from "@echatbot/database"
import jwt, { SignOptions } from "jsonwebtoken"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { config } from "../../../../config"
import { AdminSessionService } from "../../../../application/services/admin-session.service"
import { TwoFactorResetService } from "../../../../application/services/two-factor-reset.service"

const router = Router()

const adminSessionService = new AdminSessionService()
const twoFactorResetService = new TwoFactorResetService(prisma)

// =============================================================================
// 🔐 TWO-FACTOR AUTHENTICATION RESET (ADMIN-INITIATED)
// =============================================================================

/**
 * @swagger
 * /api/users/admin/{userId}/reset-2fa:
 *   post:
 *     summary: Initiate 2FA reset for a user
 *     description: |
 *       Admin initiates 2FA reset for a user who lost their phone/authenticator.
 *       - Immediately disables user's current 2FA (old codes stop working)
 *       - Sends email with secure reset link (1 hour expiry)
 *       - User must verify password before setting up new 2FA
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to reset 2FA for
 *     responses:
 *       200:
 *         description: Reset initiated successfully
 *       400:
 *         description: User doesn't have 2FA enabled or trying to reset own 2FA
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many reset requests (max 10/hour)
 */
router.post(
  "/admin/:userId/reset-2fa",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const adminUser = (req as any).user

      const result = await twoFactorResetService.createResetToken(
        userId,
        adminUser.id,
        adminUser.email
      )

      res.json({
        success: true,
        message: "2FA reset email sent to user",
        expiresAt: result.expiresAt,
      })
    } catch (error: any) {
      logger.error("Error initiating 2FA reset:", error)

      const status = error.statusCode || 500
      res.status(status).json({
        success: false,
        error: error.message || "Failed to initiate 2FA reset",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/{userId}/enable-2fa:
 *   post:
 *     summary: Send 2FA setup email to a user
 *     description: |
 *       Admin sends 2FA setup email to a user who doesn't have 2FA enabled yet.
 *       - Only works for users WITHOUT 2FA enabled
 *       - Sends email with secure setup link (1 hour expiry)
 *       - User clicks link to set up 2FA with QR code
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to enable 2FA for
 *     responses:
 *       200:
 *         description: Setup email sent successfully
 *       400:
 *         description: User already has 2FA enabled
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many requests (max 10/hour)
 */
router.post(
  "/admin/:userId/enable-2fa",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const adminUser = (req as any).user

      const result = await twoFactorResetService.createEnableToken(
        userId,
        adminUser.id,
        adminUser.email
      )

      res.json({
        success: true,
        message: "2FA setup email sent to user",
        expiresAt: result.expiresAt,
      })
    } catch (error: any) {
      logger.error("Error sending 2FA setup email:", error)

      const status = error.statusCode || 500
      res.status(status).json({
        success: false,
        error: error.message || "Failed to send 2FA setup email",
      })
    }
  }
)

// =============================================================================
// 🔑 IMPERSONATION
// =============================================================================

/**
 * @swagger
 * /api/users/admin/{userId}/impersonate:
 *   post:
 *     summary: Impersonate a user (Platform Admin only)
 *     description: |
 *       Generate a special JWT token to login as the target user.
 *       Opens in a new window with full access + Agent Configuration menu.
 *       Token expires in 1 hour.
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user ID to impersonate
 *     responses:
 *       200:
 *         description: Impersonation token generated
 *       400:
 *         description: Cannot impersonate inactive users
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: User not found
 */
router.post(
  "/admin/:userId/impersonate",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const adminUser = (req as any).user

      // Find target user
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isPlatformAdmin: true,
          status: true,
        },
      })

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        })
      }

      // Track when one platform admin impersonates another for audit visibility
      if (targetUser.isPlatformAdmin) {
        logger.warn(
          `⚠️ Platform admin ${adminUser.email} is impersonating another platform admin ${targetUser.email}`
        )
      }

      // Check user is active
      if (targetUser.status !== UserStatus.ACTIVE) {
        return res.status(400).json({
          success: false,
          error: "Cannot impersonate inactive users",
        })
      }

      // Generate impersonation token (1 hour expiry)
      const tokenPayload = {
        userId: targetUser.id,
        email: targetUser.email,
        isImpersonating: true,
        impersonatorId: adminUser.id,
        impersonatorEmail: adminUser.email,
      }

      const tokenOptions: SignOptions = {
        expiresIn: "1h",
      }

      const token = jwt.sign(tokenPayload, config.jwtSecret, tokenOptions)

      // Create session for impersonation (allows API access)
      const sessionId = await adminSessionService.createSession(
        targetUser.id,
        null, // workspaceId will be selected later
        req.ip,
        req.headers["user-agent"]
      )

      // Build redirect URL with both token and sessionId
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000"
      const redirectUrl = `${frontendUrl}/impersonate?token=${token}&sessionId=${sessionId}`

      logger.info(
        `🔑 Admin ${adminUser.email} is impersonating user ${targetUser.email} (session: ${sessionId.substring(0, 8)}...)`
      )

      res.json({
        success: true,
        data: {
          token,
          sessionId,
          redirectUrl,
          targetUser: {
            id: targetUser.id,
            email: targetUser.email,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
          },
        },
      })
    } catch (error: any) {
      logger.error("Error creating impersonation token:", error)
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create impersonation token",
      })
    }
  }
)

// =============================================================================
// 📅 TRIAL EXTENSION
// =============================================================================

/**
 * @swagger
 * /api/users/admin/{workspaceId}/extend-trial:
 *   post:
 *     summary: Extend trial period for a workspace
 *     description: Extend the trial period for a FREE_TRIAL workspace by a specified number of days
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: workspaceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - days
 *             properties:
 *               days:
 *                 type: number
 *                 description: Number of days to extend the trial (1-365)
 *               reason:
 *                 type: string
 *                 description: Optional reason for the extension
 *     responses:
 *       200:
 *         description: Trial extended successfully
 *       400:
 *         description: Invalid days or workspace not on FREE_TRIAL
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: Workspace not found
 */
router.post(
  "/admin/:workspaceId/extend-trial",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params
      const { days, reason } = req.body
      const adminUser = (req as any).user

      // Validate days
      if (!days || typeof days !== "number" || days < 1 || days > 365) {
        return res.status(400).json({
          success: false,
          error: "Days must be a number between 1 and 365",
        })
      }

      // Get workspace and owner billing info
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          owner: {
            select: {
              id: true,
              email: true,
              planType: true,
              planStartedAt: true,
            }
          }
        },
      })

      if (!workspace || !workspace.owner) {
        return res.status(404).json({
          success: false,
          error: "Workspace or owner not found",
        })
      }

      const owner = workspace.owner

      // Check if owner is on FREE_TRIAL
      if (owner.planType !== "FREE_TRIAL") {
        return res.status(400).json({
          success: false,
          error: `Cannot extend trial for user on ${owner.planType} plan. Only FREE_TRIAL users can be extended.`,
        })
      }

      // Calculate new planStartedAt by subtracting days (moving start date back extends the trial)
      const currentStartDate = new Date(owner.planStartedAt)
      const newStartDate = new Date(currentStartDate.getTime() - (days * 24 * 60 * 60 * 1000))

      // Update owner
      const updatedUser = await prisma.user.update({
        where: { id: owner.id },
        data: { planStartedAt: newStartDate },
        select: {
          id: true,
          planStartedAt: true,
          planType: true,
        },
      })

      // Calculate new trial end date (14 days from new start)
      const trialEndDate = new Date(newStartDate.getTime() + (14 * 24 * 60 * 60 * 1000))
      const now = new Date()
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

      logger.info(
        `📅 Admin ${adminUser.email} extended trial for user ${owner.email} (workspace: ${workspace.name}) by ${days} days. ` +
        `New start: ${newStartDate.toISOString()}, Days remaining: ${daysRemaining}. Reason: ${reason || 'Not specified'}`
      )

      res.json({
        success: true,
        data: {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          ownerEmail: owner.email,
          previousStartDate: currentStartDate.toISOString(),
          newStartDate: newStartDate.toISOString(),
          trialEndDate: trialEndDate.toISOString(),
          daysExtended: days,
          daysRemaining: Math.max(0, daysRemaining),
          reason: reason || null,
        },
      })
    } catch (error: any) {
      logger.error("Error extending trial:", error)
      res.status(500).json({
        success: false,
        error: error.message || "Failed to extend trial",
      })
    }
  }
)

export default router
