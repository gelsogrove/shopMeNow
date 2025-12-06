/**
 * 🔐 USER ADMIN ROUTES
 * 
 * Admin endpoints for managing user permissions.
 * These routes are protected by platformAdminMiddleware.
 * 
 * Routes:
 * - GET /api/users/admin/list - Get all users with permissions
 * - PUT /api/users/admin/:userId/permissions - Update user permissions
 */

import { Router, Request, Response } from "express"
import { prisma, UserStatus } from "@echatbot/database"
import jwt, { SignOptions } from "jsonwebtoken"
import { authMiddleware } from "../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../middlewares/platform-admin.middleware"
import logger from "../../../utils/logger"
import { config } from "../../../config"
import { AdminSessionService } from "../../../application/services/admin-session.service"

const router = Router()
// prisma imported
const adminSessionService = new AdminSessionService()

/**
 * @swagger
 * /api/users/admin/list:
 *   get:
 *     summary: Get all users with permissions
 *     description: Returns all users with their isPlatformAdmin and isDeveloperUser flags
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 */
router.get(
  "/admin/list",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isPlatformAdmin: true,
          isDeveloperUser: true,
          twoFactorEnabled: true,
          status: true,
          createdAt: true,
          lastLogin: true,
          companyName: true,
          phoneNumber: true,
          billingPhone: true,
          profilePicture: true,
          authProvider: true,
          // Get owned workspaces with stats
          ownedWorkspaces: {
            select: {
              id: true,
              name: true,
              slug: true,
              creditBalance: true,
              planType: true,
              planStartedAt: true,
              language: true,
              isActive: true,
              whatsappPhoneNumber: true,
              channelStatus: true,
              // Count customers
              customers: {
                select: { id: true }
              },
              // Count products
              products: {
                select: { id: true }
              }
            }
          }
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      // Transform data to include stats and map INACTIVE to DISABLED for frontend
      const usersWithStats = users.map(user => {
        // Business rule: Admin and Developer users don't need 2FA
        // All other users MUST have 2FA enabled
        const shouldHave2FA = !user.isPlatformAdmin && !user.isDeveloperUser
        
        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isPlatformAdmin: user.isPlatformAdmin,
          isDeveloperUser: user.isDeveloperUser,
          // 2FA is required for normal users (not admin/dev)
          // Show as enabled if they should have it AND have completed setup
          twoFactorEnabled: shouldHave2FA && user.twoFactorEnabled,
          // For Reset 2FA button: show if user should have 2FA (regardless of current state)
          requires2FA: shouldHave2FA,
          status: user.status === UserStatus.INACTIVE ? "DISABLED" : "ACTIVE",
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          companyName: user.companyName,
          phoneNumber: user.phoneNumber || user.billingPhone,
          profilePicture: user.profilePicture,
          authProvider: user.authProvider,
          // Aggregate owned workspaces stats
          isOwner: user.ownedWorkspaces.length > 0,
          ownedWorkspaces: user.ownedWorkspaces.map(ws => ({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            creditBalance: Number(ws.creditBalance),
            planType: ws.planType,
            planStartedAt: ws.planStartedAt,
            language: ws.language,
            isActive: ws.isActive,
            whatsappPhoneNumber: ws.whatsappPhoneNumber,
            channelStatus: ws.channelStatus,
            numCustomers: ws.customers.length,
            numProducts: ws.products.length,
          })),
          // Totals across all owned workspaces
          totalCredit: user.ownedWorkspaces.reduce((sum, ws) => sum + Number(ws.creditBalance), 0),
          totalCustomers: user.ownedWorkspaces.reduce((sum, ws) => sum + ws.customers.length, 0),
          totalProducts: user.ownedWorkspaces.reduce((sum, ws) => sum + ws.products.length, 0),
        }
      })

      logger.info(`📋 Platform admin fetched ${users.length} users with stats`)

      res.json({
        success: true,
        data: usersWithStats,
      })
    } catch (error) {
      logger.error("Error fetching users:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch users",
      })
    }
  }
)

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

/**
 * @swagger
 * /api/users/admin/{workspaceId}/bonus:
 *   post:
 *     summary: Add bonus credits to a workspace
 *     description: Add free credits to a workspace (not invoiced). Creates a BONUS transaction.
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
 *               - amount
 *               - reason
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount of bonus credits (positive number)
 *               reason:
 *                 type: string
 *                 description: Reason for the bonus
 *     responses:
 *       200:
 *         description: Bonus added successfully
 *       400:
 *         description: Invalid amount or reason
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 *       404:
 *         description: Workspace not found
 */
router.post(
  "/admin/:workspaceId/bonus",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params
      const { amount, reason } = req.body
      const adminUser = (req as any).user

      // Validate input
      if (!amount || typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Amount must be a positive number",
        })
      }

      if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
        return res.status(400).json({
          success: false,
          error: "Reason is required (minimum 3 characters)",
        })
      }

      // Get workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          creditBalance: true,
          owner: {
            select: { email: true, isPlatformAdmin: true }
          }
        },
      })

      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: "Workspace not found",
        })
      }

      // Block bonus credits for admin users
      if (workspace.owner?.isPlatformAdmin) {
        return res.status(403).json({
          success: false,
          error: "Cannot add bonus credits to admin user workspaces",
        })
      }

      // Calculate new balance
      const currentBalance = Number(workspace.creditBalance)
      const newBalance = currentBalance + amount

      // Update workspace and create transaction in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update workspace balance
        const updatedWorkspace = await tx.workspace.update({
          where: { id: workspaceId },
          data: { creditBalance: newBalance },
          select: { creditBalance: true },
        })

        // Create BONUS transaction
        const transaction = await tx.billingTransaction.create({
          data: {
            workspaceId,
            type: "BONUS",
            amount: amount, // Positive for credit
            balanceAfter: newBalance,
            description: `Bonus credit: ${reason}`,
            referenceType: "admin_bonus",
            metadata: {
              adminId: adminUser.id,
              adminEmail: adminUser.email,
              reason: reason.trim(),
            },
          },
        })

        return { updatedWorkspace, transaction }
      })

      logger.info(
        `🎁 BONUS: Admin ${adminUser.email} added €${amount.toFixed(2)} bonus to workspace "${workspace.name}" (${workspaceId}). Reason: ${reason}. New balance: €${newBalance.toFixed(2)}`
      )

      res.json({
        success: true,
        data: {
          workspaceId,
          workspaceName: workspace.name,
          ownerEmail: workspace.owner?.email,
          bonusAmount: amount,
          previousBalance: currentBalance,
          newBalance: newBalance,
          reason: reason.trim(),
          transactionId: result.transaction.id,
        },
      })
    } catch (error) {
      logger.error("Error adding bonus credits:", error)
      res.status(500).json({
        success: false,
        error: "Failed to add bonus credits",
      })
    }
  }
)

// =============================================================================
// 🔐 TWO-FACTOR AUTHENTICATION RESET (ADMIN-INITIATED)
// =============================================================================

import { TwoFactorResetService } from "../../../application/services/two-factor-reset.service"

const twoFactorResetService = new TwoFactorResetService(prisma)

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                   description: JWT token with impersonation flag
 *                 redirectUrl:
 *                   type: string
 *                   description: URL to open in new window
 *       400:
 *         description: Cannot impersonate Platform Admins
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

      // Cannot impersonate other Platform Admins
      if (targetUser.isPlatformAdmin) {
        return res.status(400).json({
          success: false,
          error: "Cannot impersonate Platform Admins",
        })
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

      // Get workspace
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          planType: true,
          planStartedAt: true,
          owner: {
            select: { email: true }
          }
        },
      })

      if (!workspace) {
        return res.status(404).json({
          success: false,
          error: "Workspace not found",
        })
      }

      // Check if workspace is on FREE_TRIAL
      if (workspace.planType !== "FREE_TRIAL") {
        return res.status(400).json({
          success: false,
          error: `Cannot extend trial for workspace on ${workspace.planType} plan. Only FREE_TRIAL workspaces can be extended.`,
        })
      }

      // Calculate new planStartedAt by subtracting days (moving start date back extends the trial)
      const currentStartDate = new Date(workspace.planStartedAt)
      const newStartDate = new Date(currentStartDate.getTime() - (days * 24 * 60 * 60 * 1000))

      // Update workspace
      const updatedWorkspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { planStartedAt: newStartDate },
        select: {
          id: true,
          name: true,
          planStartedAt: true,
          planType: true,
        },
      })

      // Calculate new trial end date (14 days from new start)
      const trialEndDate = new Date(newStartDate.getTime() + (14 * 24 * 60 * 60 * 1000))
      const now = new Date()
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))

      logger.info(
        `📅 Admin ${adminUser.email} extended trial for workspace ${workspace.name} by ${days} days. ` +
        `New start: ${newStartDate.toISOString()}, Days remaining: ${daysRemaining}. Reason: ${reason || 'Not specified'}`
      )

      res.json({
        success: true,
        data: {
          workspaceId: updatedWorkspace.id,
          workspaceName: updatedWorkspace.name,
          ownerEmail: workspace.owner?.email,
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
