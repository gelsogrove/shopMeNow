/**
 * 🔐 USER ADMIN ROUTES (Main Router)
 *
 * Core admin endpoints: workspace list, user list, whatsapp-queue.
 * Sub-routers handle invoice/PayPal and user management.
 *
 * Routes in this file:
 * - GET /api/users/admin/workspaces - All workspaces (backoffice)
 * - GET /api/users/admin/list - All users with permissions
 * - GET /api/users/admin/whatsapp-queue - WhatsApp queue messages
 *
 * Sub-routers:
 * - admin-invoice.routes.ts → /admin/invoices/*, /admin/analytics/*, /admin/paypal/*
 * - admin-user-management.routes.ts → /admin/:userId/*, /admin/:workspaceId/bonus, 2FA, impersonate
 */

import { Router, Request, Response } from "express"
import { prisma, UserStatus } from "@echatbot/database"
import { authMiddleware } from "../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../middlewares/platform-admin.middleware"
import logger from "../../../utils/logger"
import { spawn } from "child_process"

// Sub-routers (extracted for file size reduction)
import adminInvoiceRoutes from "./admin/admin-invoice.routes"
import adminUserManagementRoutes from "./admin/admin-user-management.routes"

/**
 * Build the subscription status update data object.
 * Exported for use by admin-user-management sub-router and tests.
 */
export const buildSubscriptionStatusUpdateData = (
  subscriptionStatus: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED",
  existingFailureCount: number,
  now: Date
) => {
  const updateData: any = { subscriptionStatus }

  if (subscriptionStatus === "PAUSED") {
    updateData.pausedAt = now
    updateData.pauseRequestedAt = now
  } else {
    updateData.pausedAt = null
    updateData.pauseRequestedAt = null
  }

  if (subscriptionStatus === "PAYMENT_FAILED") {
    updateData.paymentFailureCount = Math.max(3, existingFailureCount)
    updateData.lastPaymentFailedAt = now
  } else {
    updateData.paymentFailureCount = 0
    updateData.lastPaymentFailedAt = null
  }

  return updateData
}

const router = Router()

// Mount sub-routers for invoice/PayPal and user management
router.use(adminInvoiceRoutes)
router.use(adminUserManagementRoutes)

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
/**
 * @swagger
 * /api/users/admin/workspaces:
 *   get:
 *     summary: Get all workspaces (admin backoffice)
 *     description: Returns ALL workspaces in the system for backoffice dashboard
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all workspaces
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 */
router.get(
  "/admin/workspaces",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      logger.info("🔐 Admin backoffice: fetching ALL workspaces")
      
      const workspaces = await prisma.workspace.findMany({
        where: {
          deletedAt: null, // Exclude deleted workspaces
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          url: true,
          logoUrl: true,
          debugMode: true,
          channelStatus: true,
          deletedAt: true,
          planType: true,
          creditBalance: true,
          language: true,
          currency: true,
          ownerId: true,
          owner: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true, // USER_STATUS: ACTIVE, INACTIVE, etc.
            }
          },
          whatsappSettings: {
            select: {
              phoneNumber: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // Map workspaces to include whatsappPhoneNumber from whatsappSettings
      const workspacesWithPhone = workspaces.map(w => ({
        ...w,
        whatsappPhoneNumber: w.whatsappSettings?.phoneNumber || null,
        whatsappSettings: undefined, // Remove nested object from response
      }))

      // DEBUG: Verifica logoUrl
      logger.info(`📸 Logos debug: ${workspacesWithPhone.map(w => `${w.name}: ${w.logoUrl || 'NULL'}`).join(', ')}`)

      logger.info(`✅ Admin backoffice: returning ${workspacesWithPhone.length} workspaces`)
      res.json(workspacesWithPhone)
    } catch (error: any) {
      logger.error("❌ Error fetching admin workspaces:", error)
      res.status(500).json({ error: "Failed to fetch workspaces" })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/backup/download:
 *   post:
 *     summary: Stream a database backup for local download (no server-side file saved)
 *     description: Generates a pg_dump on the fly and streams it to the client as an attachment.
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SQL dump stream
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 *       500:
 *         description: Backup generation failed
 */
router.post(
  "/admin/backup/download",
  authMiddleware,
  platformAdminMiddleware,
  async (_req: Request, res: Response) => {
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      return res.status(500).json({ error: "DATABASE_URL not configured" })
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:T]/g, "-")
      .replace(/\..+/, "")
    const filename = `backup-${timestamp}.sql`

    res.setHeader("Content-Type", "application/octet-stream")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    )

    logger.info("💾 Admin backup download started", { filename })

    const dump = spawn("pg_dump", ["--no-owner", "--no-privileges", "--dbname", dbUrl], {
      env: process.env,
    })

    dump.stdout.pipe(res)

    let errorBuffered = ""

    dump.stderr.on("data", (data) => {
      errorBuffered += data.toString()
    })

    dump.on("error", (error) => {
      logger.error("❌ Failed to start pg_dump", error)
      if (!res.headersSent) {
        res
          .status(500)
          .json({ error: "Failed to start backup", detail: error.message })
      } else {
        res.end()
      }
    })

    dump.on("close", (code) => {
      if (code === 0) {
        logger.info("✅ Admin backup download completed", { filename })
      } else {
        logger.error("❌ pg_dump exited with error", { code, stderr: errorBuffered })
        if (!res.headersSent) {
          res.status(500).json({
            error: "Backup failed",
            detail: errorBuffered || `pg_dump exited with code ${code}`,
          })
        } else {
          res.end()
        }
      }
    })
  }
)

router.get(
  "/admin/list",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const users = await prisma.user.findMany({
        where: {
          deletedAt: null, // Exclude soft-deleted users
        },
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
          // Feature 198: Owner-level billing fields
          planType: true,
          subscriptionStatus: true,
          creditBalance: true,
          planStartedAt: true,
          pendingPlanType: true,
          pendingPlanEffectiveDate: true,
          pausedAt: true,
          pauseRequestedAt: true,
          // Get owned workspaces with stats
          ownedWorkspaces: {
            select: {
              id: true,
              name: true,
              slug: true,
              creditBalance: true,
              planType: true,
              subscriptionStatus: true, // Feature 197: Subscription status (legacy, deprecated)
              planStartedAt: true,
              language: true,
              deletedAt: true,
              whatsappPhoneNumber: true,
              channelStatus: true,
              debugMode: true,
              updatedAt: true,
              // Count customers
              customers: {
                select: { id: true }
              },
              // Count products
              products: {
                select: { id: true }
              }
            }
          },
          // Get member workspaces (where user is NOT owner)
          workspaces: {
            select: {
              role: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  language: true,
                  whatsappPhoneNumber: true,
                  channelStatus: true,
                  ownerId: true,
                  owner: {
                    select: {
                      id: true,
                      email: true,
                      firstName: true,
                      lastName: true,
                      companyName: true
                    }
                  }
                }
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
        const isOwner = user.ownedWorkspaces.length > 0
        
        // For non-owners, get owner info from member workspaces
        let ownerInfo = null
        if (!isOwner && user.workspaces.length > 0) {
          const firstWorkspace = user.workspaces[0].workspace
          if (firstWorkspace.owner) {
            ownerInfo = {
              id: firstWorkspace.owner.id,
              email: firstWorkspace.owner.email,
              name: [firstWorkspace.owner.firstName, firstWorkspace.owner.lastName]
                .filter(Boolean)
                .join(' ') || firstWorkspace.owner.email.split('@')[0],
              companyName: firstWorkspace.owner.companyName
            }
          }
        }
        
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
          // Feature 198: Owner-level billing (primary source of truth)
          planType: user.planType,
          subscriptionStatus: user.subscriptionStatus,
          creditBalance: Number(user.creditBalance),
          planStartedAt: user.planStartedAt,
          pendingPlanType: user.pendingPlanType,
          pendingPlanEffectiveDate: user.pendingPlanEffectiveDate,
          pausedAt: user.pausedAt,
          pauseRequestedAt: user.pauseRequestedAt,
          // Aggregate owned workspaces stats
          isOwner,
          ownerInfo, // NULL for owners, populated for members
          ownedWorkspaces: user.ownedWorkspaces.map(ws => ({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            creditBalance: Number(ws.creditBalance),
            planType: ws.planType,
            subscriptionStatus: ws.subscriptionStatus, // Feature 197 (deprecated)
            planStartedAt: ws.planStartedAt,
            language: ws.language,
            deletedAt: ws.deletedAt ?? null,
            whatsappPhoneNumber: ws.whatsappPhoneNumber,
            channelStatus: ws.channelStatus,
            debugMode: ws.debugMode,
            updatedAt: ws.updatedAt,
            numCustomers: ws.customers.length,
            numProducts: ws.products.length,
          })),
          // Member workspaces (for non-owners)
          memberWorkspaces: user.workspaces.map(uw => ({
            id: uw.workspace.id,
            name: uw.workspace.name,
            slug: uw.workspace.slug,
            role: uw.role,
            language: uw.workspace.language,
            whatsappPhoneNumber: uw.workspace.whatsappPhoneNumber,
            channelStatus: uw.workspace.channelStatus,
          })),
          // Totals across all owned workspaces (Feature 198: use owner's creditBalance)
          totalCredit: Number(user.creditBalance),
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
 * /api/users/admin/whatsapp-queue:
 *   get:
 *     summary: Get all WhatsApp/widget queue messages
 *     description: Platform admin view of all queue messages across workspaces
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue messages list
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 */
router.get(
  "/admin/whatsapp-queue",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const queueMessages = await prisma.whatsAppQueue.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          workspace: { select: { id: true, name: true, whatsappPhoneNumber: true } },
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
      })

      const messageIds = queueMessages.map((message) => message.id)
      const pushRecipients = await prisma.pushCampaignRecipient.findMany({
        where: { messageId: { in: messageIds } },
        select: { messageId: true },
      })
      const pushMessageIds = new Set(
        pushRecipients.map((recipient) => recipient.messageId)
      )

      const enriched = queueMessages.map((message) => ({
        ...message,
        messageType: pushMessageIds.has(message.id) ? "PUSH" : "MESSAGE",
      }))

      return res.json({
        success: true,
        data: enriched,
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching WhatsApp queue:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch WhatsApp queue",
      })
    }
  }
)

export default router
