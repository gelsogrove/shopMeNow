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
import {
  prisma,
  UserStatus,
  InvoiceStatus,
  TransactionType,
  PayPalTransactionStatus,
  PayPalStatus,
} from "@echatbot/database"
import jwt, { SignOptions } from "jsonwebtoken"
import { authMiddleware } from "../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../middlewares/platform-admin.middleware"
import logger from "../../../utils/logger"
import { config } from "../../../config"
import { AdminSessionService } from "../../../application/services/admin-session.service"
import { SubscriptionBillingService } from "../../../application/services/subscription-billing.service"
import { invoiceService } from "../../../application/services/invoice.service"
import { roundMoney } from "../../../utils/money"
import { TwoFactorResetService } from "../../../application/services/two-factor-reset.service"
import { loadPayPalConfigForEnv } from "../../../utils/paypal-config"

const captureSubscriptionPayment = async ({
  env,
  subscriptionId,
  amount,
  note,
}: {
  env: "sandbox" | "live"
  subscriptionId: string
  amount: number
  note?: string
}): Promise<{ success: boolean; transactionId?: string; status?: string }> => {
  const paypalConfig = loadPayPalConfigForEnv(env)
  if (!paypalConfig.configured) {
    logger.warn(`[PAYPAL] Missing credentials for env ${env}`)
    return { success: false }
  }
  const tokenResponse = await fetch(`${paypalConfig.apiBaseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${paypalConfig.clientId}:${paypalConfig.clientSecret}`
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  })

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text()
    logger.warn("[PAYPAL] Failed to get app token:", err)
    return { success: false }
  }

  const tokenData = await tokenResponse.json()
  const appToken = tokenData.access_token as string

  const captureResponse = await fetch(
    `${paypalConfig.apiBaseUrl}/v1/billing/subscriptions/${subscriptionId}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: note || "Monthly invoice charge",
        capture_type: "OUTSTANDING_BALANCE",
        amount: {
          currency_code: "USD",
          value: amount.toFixed(2),
        },
      }),
    }
  )

  if (!captureResponse.ok) {
    const err = await captureResponse.text()
    logger.warn("[PAYPAL] Capture failed:", err)
    return { success: false }
  }

  const capture = await captureResponse.json()
  const status = capture.status || capture.capture_status || "UNKNOWN"
  const transactionId = capture.id || capture.capture_id
  const success = status === "COMPLETED" || status === "COMPLETED_WITH_PAYMENT"
  return { success, transactionId, status }
}

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
// prisma imported
const adminSessionService = new AdminSessionService()
const subscriptionBillingService = new SubscriptionBillingService(prisma)

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
 * /api/users/admin/invoices/current:
 *   get:
 *     summary: Get current month invoices for all owners
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of owners with current invoice
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Platform admin access required
 */
router.get(
  "/admin/invoices/current",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const owners = await prisma.user.findMany({
        where: {
          status: UserStatus.ACTIVE,
          ownedWorkspaces: {
            some: {
              deletedAt: null,
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          companyName: true,
          planType: true,
          subscriptionStatus: true,
          creditBalance: true,
          paymentFailureCount: true,
          lastPaymentFailedAt: true,
          isPlatformAdmin: true,
          isDeveloperUser: true,
        },
        orderBy: { createdAt: "asc" },
      })

      const results = await Promise.all(
        owners.map(async (owner) => {
          const invoice = await invoiceService.getOrCreateCurrentInvoice(
            owner.id
          )

          return {
            owner: {
              id: owner.id,
              email: owner.email,
              firstName: owner.firstName,
              lastName: owner.lastName,
              companyName: owner.companyName,
              planType: owner.planType,
              subscriptionStatus: owner.subscriptionStatus,
              creditBalance: Number(owner.creditBalance),
              paymentFailureCount: owner.paymentFailureCount ?? 0,
              lastPaymentFailedAt: owner.lastPaymentFailedAt ?? null,
              isPlatformAdmin: owner.isPlatformAdmin ?? false,
              isDeveloperUser: owner.isDeveloperUser ?? false,
            },
            invoice: {
              id: invoice.id,
              invoiceNumber: (invoice as any).invoiceNumber ?? null,
              periodMonth: invoice.periodMonth,
              periodYear: invoice.periodYear,
              totalAmount: invoice.totalAmount,
              subtotalAmount: (invoice as any).subtotalAmount ?? 0,
              taxAmount: (invoice as any).taxAmount ?? 0,
              creditNotesTotal: (invoice as any).creditNotesTotal ?? 0,
              status: invoice.status,
              paidAt: invoice.paidAt,
              adminNotes: (invoice as any).adminNotes ?? null,
              adminMarkedById: (invoice as any).adminMarkedById ?? null,
              adminMarkedAt: (invoice as any).adminMarkedAt ?? null,
            },
          }
        })
      )

      return res.json({
        success: true,
        data: results,
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching current invoices:", error)
      return res.status(500).json({
        success: false,
        error: "Failed to fetch current invoices",
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

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/pdf:
 *   get:
 *     summary: Download invoice PDF (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 */
router.get(
  "/admin/invoices/:invoiceId/pdf",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        select: { id: true },
      })

      if (!invoice) {
        res.status(404).json({ success: false, error: "Invoice not found" })
        return
      }

      const pdfBuffer = await invoiceService.generateInvoicePdf(invoiceId)

      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=invoice-${invoiceId}.pdf`
      )
      res.status(200).send(pdfBuffer)
    } catch (error) {
      logger.error("[ADMIN] Error downloading invoice PDF:", error)
      res.status(500).json({
        success: false,
        error: "Failed to download invoice PDF",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/credit-notes/{noteId}/pdf:
 *   get:
 *     summary: Download credit note PDF (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: string
 */
router.get(
  "/admin/invoices/:invoiceId/credit-notes/:noteId/pdf",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId, noteId } = req.params
      const note = await prisma.invoiceCreditNote.findFirst({
        where: { id: noteId, invoiceId },
        select: { id: true },
      })

      if (!note) {
        res.status(404).json({ success: false, error: "Credit note not found" })
        return
      }

      const pdfBuffer = await invoiceService.generateCreditNotePdf(noteId)
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=credit-note-${noteId}.pdf`
      )
      res.send(pdfBuffer)
    } catch (error) {
      logger.error("[ADMIN] Error downloading credit note PDF:", error)
      res.status(500).json({
        success: false,
        error: "Failed to download credit note PDF",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}:
 *   patch:
 *     summary: Update invoice status/notes (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 */
router.patch(
  "/admin/invoices/:invoiceId",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const { status, adminNotes } = req.body as {
        status?: InvoiceStatus
        adminNotes?: string
      }

      if (!status) {
        res.status(400).json({
          success: false,
          error: "Status is required",
        })
        return
      }

      const allowedStatuses: InvoiceStatus[] = [
        "PENDING",
        "PAID",
        "FAILED",
        "CANCELLED",
        "DRAFT",
      ]

      if (!allowedStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: "Invalid status",
        })
        return
      }

      const adminUser = (req as any).user

      const updateData: any = {
        status,
        adminNotes: adminNotes ?? null,
        adminMarkedById: adminUser?.id ?? null,
        adminMarkedAt: new Date(),
      }

      if (status === "PAID") {
        updateData.paidAt = new Date()
      }

      const invoice = await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: updateData,
      })

      if (status === "PAID") {
        await invoiceService.ensureInvoiceNumber(invoice.id, invoice.paidAt ?? new Date())
      }

      res.json({
        success: true,
        data: {
          id: invoice.id,
          status: invoice.status,
          adminNotes: invoice.adminNotes,
          adminMarkedById: invoice.adminMarkedById,
          adminMarkedAt: invoice.adminMarkedAt,
          paidAt: invoice.paidAt,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error updating invoice:", error)
      res.status(500).json({
        success: false,
        error: "Failed to update invoice",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/credit-notes:
 *   get:
 *     summary: Get credit notes for an invoice (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 */
router.get(
  "/admin/invoices/:invoiceId/credit-notes",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const notes = await prisma.invoiceCreditNote.findMany({
        where: { invoiceId },
        orderBy: { createdAt: "desc" },
      })

      res.json({
        success: true,
        data: notes.map((note) => ({
          id: note.id,
          amount: Number(note.amount),
          reason: note.reason,
          createdAt: note.createdAt,
          createdById: note.createdById,
          createdByEmail: note.createdByEmail,
        })),
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching credit notes:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch credit notes",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/adjustments:
 *   get:
 *     summary: Get adjustments for an invoice (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 */
router.get(
  "/admin/invoices/:invoiceId/adjustments",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const invoiceAdjustment = (prisma as any).invoiceAdjustment
      if (!invoiceAdjustment) {
        res.status(500).json({
          success: false,
          error: "Invoice adjustments are not available",
        })
        return
      }

      let adjustments: any[] = []
      try {
        adjustments = await invoiceAdjustment.findMany({
          where: { invoiceId },
          orderBy: { createdAt: "desc" },
        })
      } catch (error: any) {
        if (error?.code === "P2021") {
          res.status(500).json({
            success: false,
            error: "Invoice adjustments are not available",
          })
          return
        }
        throw error
      }

      res.json({
        success: true,
        data: adjustments.map((adj) => ({
          id: adj.id,
          amount: Number(adj.amount),
          reason: adj.reason,
          createdAt: adj.createdAt,
          createdById: adj.createdById,
          createdByEmail: adj.createdByEmail,
        })),
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching invoice adjustments:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch invoice adjustments",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/adjustments:
 *   post:
 *     summary: Create adjustment for an invoice (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 */
router.post(
  "/admin/invoices/:invoiceId/adjustments",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const { amount, reason } = req.body as { amount?: number; reason?: string }
      const invoiceAdjustment = (prisma as any).invoiceAdjustment
      if (!invoiceAdjustment) {
        res.status(500).json({
          success: false,
          error: "Invoice adjustments are not available",
        })
        return
      }

      if (amount === undefined || Number.isNaN(Number(amount)) || Number(amount) === 0) {
        res.status(400).json({
          success: false,
          error: "Adjustment amount must be non-zero",
        })
        return
      }

      const invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        select: { userId: true, status: true },
      })

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: "Invoice not found",
        })
        return
      }

      if (invoice.status === "PAID") {
        res.status(400).json({
          success: false,
          error: "Adjustments are not allowed after payment",
        })
        return
      }

      const adminUser = (req as any).user
      let adjustment: any
      try {
        adjustment = await invoiceAdjustment.create({
          data: {
            invoiceId,
            userId: invoice.userId,
            amount: Number(amount),
            reason: reason || null,
            createdById: adminUser?.id || null,
            createdByEmail: adminUser?.email || null,
          },
        })
      } catch (error: any) {
        if (error?.code === "P2021") {
          res.status(500).json({
            success: false,
            error: "Invoice adjustments are not available",
          })
          return
        }
        throw error
      }

      await invoiceService.recalculateInvoiceTotals(invoiceId)

      res.json({
        success: true,
        data: {
          id: adjustment.id,
          amount: Number(adjustment.amount),
          reason: adjustment.reason,
          createdAt: adjustment.createdAt,
          createdById: adjustment.createdById,
          createdByEmail: adjustment.createdByEmail,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error creating invoice adjustment:", error)
      res.status(500).json({
        success: false,
        error: "Failed to create invoice adjustment",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/adjustments/{adjustmentId}:
 *   patch:
 *     summary: Update an invoice adjustment (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/admin/invoices/:invoiceId/adjustments/:adjustmentId",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId, adjustmentId } = req.params
      const { amount, reason } = req.body as { amount?: number; reason?: string }
      const invoiceAdjustment = (prisma as any).invoiceAdjustment
      if (!invoiceAdjustment) {
        res.status(500).json({
          success: false,
          error: "Invoice adjustments are not available",
        })
        return
      }

      let adjustment: any
      try {
        adjustment = await invoiceAdjustment.findFirst({
          where: { id: adjustmentId, invoiceId },
        })
      } catch (error: any) {
        if (error?.code === "P2021") {
          res.status(500).json({
            success: false,
            error: "Invoice adjustments are not available",
          })
          return
        }
        throw error
      }

      if (!adjustment) {
        res.status(404).json({
          success: false,
          error: "Adjustment not found",
        })
        return
      }

      const invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        select: { status: true },
      })

      if (invoice?.status === "PAID") {
        res.status(400).json({
          success: false,
          error: "Adjustments are not allowed after payment",
        })
        return
      }

      if (amount !== undefined && Number(amount) === 0) {
        res.status(400).json({
          success: false,
          error: "Adjustment amount must be non-zero",
        })
        return
      }

      let updated: any
      try {
        updated = await invoiceAdjustment.update({
          where: { id: adjustmentId },
          data: {
            amount: amount === undefined ? adjustment.amount : Number(amount),
            reason: reason ?? adjustment.reason,
          },
        })
      } catch (error: any) {
        if (error?.code === "P2021") {
          res.status(500).json({
            success: false,
            error: "Invoice adjustments are not available",
          })
          return
        }
        throw error
      }

      await invoiceService.recalculateInvoiceTotals(invoiceId)

      res.json({
        success: true,
        data: {
          id: updated.id,
          amount: Number(updated.amount),
          reason: updated.reason,
          createdAt: updated.createdAt,
          createdById: updated.createdById,
          createdByEmail: updated.createdByEmail,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error updating invoice adjustment:", error)
      res.status(500).json({
        success: false,
        error: "Failed to update invoice adjustment",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/adjustments/{adjustmentId}:
 *   delete:
 *     summary: Delete an invoice adjustment (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/admin/invoices/:invoiceId/adjustments/:adjustmentId",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId, adjustmentId } = req.params
      const invoiceAdjustment = (prisma as any).invoiceAdjustment
      if (!invoiceAdjustment) {
        res.status(500).json({
          success: false,
          error: "Invoice adjustments are not available",
        })
        return
      }

      let adjustment: any
      try {
        adjustment = await invoiceAdjustment.findFirst({
          where: { id: adjustmentId, invoiceId },
        })
      } catch (error: any) {
        if (error?.code === "P2021") {
          res.status(500).json({
            success: false,
            error: "Invoice adjustments are not available",
          })
          return
        }
        throw error
      }

      if (!adjustment) {
        res.status(404).json({
          success: false,
          error: "Adjustment not found",
        })
        return
      }

      const invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        select: { status: true },
      })

      if (invoice?.status === "PAID") {
        res.status(400).json({
          success: false,
          error: "Adjustments are not allowed after payment",
        })
        return
      }

      try {
        await invoiceAdjustment.delete({
          where: { id: adjustmentId },
        })
      } catch (error: any) {
        if (error?.code === "P2021") {
          res.status(500).json({
            success: false,
            error: "Invoice adjustments are not available",
          })
          return
        }
        throw error
      }

      await invoiceService.recalculateInvoiceTotals(invoiceId)

      res.json({ success: true })
    } catch (error) {
      logger.error("[ADMIN] Error deleting invoice adjustment:", error)
      res.status(500).json({
        success: false,
        error: "Failed to delete invoice adjustment",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/history:
 *   get:
 *     summary: Get invoice history for all owners (optional month/year filter)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/admin/invoices/history",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const periodMonth = req.query.periodMonth ? Number(req.query.periodMonth) : null
      const periodYear = req.query.periodYear ? Number(req.query.periodYear) : null
      const page = req.query.page ? Number(req.query.page) : 1
      const pageSize = req.query.pageSize ? Number(req.query.pageSize) : 25

      const where: any = {}
      if (periodMonth) where.periodMonth = periodMonth
      if (periodYear) where.periodYear = periodYear

      const [invoices, total] = await Promise.all([
        prisma.monthlyInvoice.findMany({
          where,
          orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                companyName: true,
                planType: true,
                subscriptionStatus: true,
                creditBalance: true,
                paymentFailureCount: true,
                lastPaymentFailedAt: true,
              },
            },
            creditNotes: {
              select: {
                id: true,
                amount: true,
                reason: true,
                createdAt: true,
              },
            },
          },
        }),
        prisma.monthlyInvoice.count({ where }),
      ])

      const data = invoices.map((invoice) => ({
        owner: {
          id: invoice.user?.id,
          email: invoice.user?.email,
          firstName: invoice.user?.firstName ?? null,
          lastName: invoice.user?.lastName ?? null,
          companyName: invoice.user?.companyName ?? null,
          planType: invoice.user?.planType,
          subscriptionStatus: invoice.user?.subscriptionStatus,
          creditBalance: Number(invoice.user?.creditBalance ?? 0),
          paymentFailureCount: invoice.user?.paymentFailureCount ?? 0,
          lastPaymentFailedAt: invoice.user?.lastPaymentFailedAt ?? null,
        },
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber ?? null,
          periodMonth: invoice.periodMonth,
          periodYear: invoice.periodYear,
          totalAmount: Number(invoice.totalAmount),
          subtotalAmount: Number(invoice.subtotalAmount ?? 0),
          taxAmount: Number(invoice.taxAmount ?? 0),
          creditNotesTotal: Number(invoice.creditNotesTotal ?? 0),
          status: invoice.status,
          paidAt: invoice.paidAt,
          adminNotes: invoice.adminNotes ?? null,
          adminMarkedById: invoice.adminMarkedById ?? null,
          adminMarkedAt: invoice.adminMarkedAt ?? null,
          creditNotes: (invoice.creditNotes || []).map((note) => ({
            id: note.id,
            amount: Number(note.amount),
            reason: note.reason ?? null,
            createdAt: note.createdAt,
          })),
        },
      }))

      res.json({
        success: true,
        data,
        meta: {
          page,
          pageSize,
          total,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching invoice history:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch invoice history",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/summary:
 *   get:
 *     summary: Get monthly invoice summary for analytics
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Monthly summary data
 */
router.get(
  "/admin/invoices/summary",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const monthsParam = Number(req.query.months ?? 12)
      const monthsToLoad = Number.isFinite(monthsParam) && monthsParam > 0 ? monthsParam : 12

      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsToLoad - 1), 1)

      const invoices = await prisma.monthlyInvoice.findMany({
        where: {
          status: "PAID",
          periodStart: { gte: startDate },
        },
        select: {
          periodYear: true,
          periodMonth: true,
          totalAmount: true,
          userId: true,
        },
      })

      const summaryMap = new Map<
        string,
        { periodYear: number; periodMonth: number; totalAmount: number; invoiceCount: number; userIds: Set<string> }
      >()

      invoices.forEach((invoice) => {
        const key = `${invoice.periodYear}-${invoice.periodMonth}`
        const entry =
          summaryMap.get(key) || {
            periodYear: invoice.periodYear,
            periodMonth: invoice.periodMonth,
            totalAmount: 0,
            invoiceCount: 0,
            userIds: new Set<string>(),
          }
        entry.totalAmount += Number(invoice.totalAmount || 0)
        entry.invoiceCount += 1
        entry.userIds.add(invoice.userId)
        summaryMap.set(key, entry)
      })

      const monthSeries: Array<{
        periodYear: number
        periodMonth: number
        totalAmount: number
        invoiceCount: number
        userCount: number
      }> = []

      for (let index = monthsToLoad - 1; index >= 0; index -= 1) {
        const cursor = new Date(now.getFullYear(), now.getMonth() - index, 1)
        const periodYear = cursor.getFullYear()
        const periodMonth = cursor.getMonth() + 1
        const key = `${periodYear}-${periodMonth}`
        const entry = summaryMap.get(key)

        monthSeries.push({
          periodYear,
          periodMonth,
          totalAmount: roundMoney(entry?.totalAmount ?? 0),
          invoiceCount: entry?.invoiceCount ?? 0,
          userCount: entry?.userIds.size ?? 0,
        })
      }

      res.json({
        success: true,
        data: monthSeries,
        meta: {
          months: monthsToLoad,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching invoice summary:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch invoice summary",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/analytics/revenue-stats:
 *   get:
 *     summary: Get complete revenue and usage statistics for analytics dashboard
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: months
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Monthly statistics including revenue, users, messages, and push campaigns
 */
router.get(
  "/admin/analytics/revenue-stats",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const monthsParam = Number(req.query.months ?? 12)
      const monthsToLoad = Number.isFinite(monthsParam) && monthsParam > 0 ? monthsParam : 12

      const now = new Date()
      const startDate = new Date(now.getFullYear(), now.getMonth() - (monthsToLoad - 1), 1)

      // Fetch invoices for revenue data
      const invoices = await prisma.monthlyInvoice.findMany({
        where: {
          status: "PAID",
          periodStart: { gte: startDate },
        },
        select: {
          periodYear: true,
          periodMonth: true,
          totalAmount: true,
          userId: true,
        },
      })

      // Fetch messages with channel info from ChatSession
      const messages = await prisma.message.findMany({
        where: {
          createdAt: { gte: startDate },
          chatSession: {
            channel: { in: ["whatsapp", "widget"] },
          },
        },
        select: {
          createdAt: true,
          chatSession: {
            select: {
              channel: true,
            },
          },
        },
      })

      // Fetch push campaigns
      const campaigns = await prisma.pushCampaign.findMany({
        where: {
          createdAt: { gte: startDate },
        },
        select: {
          createdAt: true,
          _count: {
            select: {
              recipients: true,
            },
          },
        },
      })

      // Build monthly statistics
      const statsMap = new Map<
        string,
        {
          periodYear: number
          periodMonth: number
          revenue: number
          userCount: Set<string>
          whatsappMessages: number
          widgetMessages: number
          pushCampaigns: number
          pushRecipients: number
        }
      >()

      // Process invoices for revenue
      invoices.forEach((invoice) => {
        const key = `${invoice.periodYear}-${invoice.periodMonth}`
        const entry = statsMap.get(key) || {
          periodYear: invoice.periodYear,
          periodMonth: invoice.periodMonth,
          revenue: 0,
          userCount: new Set<string>(),
          whatsappMessages: 0,
          widgetMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }
        entry.revenue += Number(invoice.totalAmount || 0)
        entry.userCount.add(invoice.userId)
        statsMap.set(key, entry)
      })

      // Process messages
      messages.forEach((message) => {
        const date = new Date(message.createdAt)
        const periodYear = date.getFullYear()
        const periodMonth = date.getMonth() + 1
        const key = `${periodYear}-${periodMonth}`
        
        const entry = statsMap.get(key) || {
          periodYear,
          periodMonth,
          revenue: 0,
          userCount: new Set<string>(),
          whatsappMessages: 0,
          widgetMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }

        if (message.chatSession.channel === "whatsapp") {
          entry.whatsappMessages += 1
        } else if (message.chatSession.channel === "widget") {
          entry.widgetMessages += 1
        }

        statsMap.set(key, entry)
      })

      // Process push campaigns
      campaigns.forEach((campaign) => {
        const date = new Date(campaign.createdAt)
        const periodYear = date.getFullYear()
        const periodMonth = date.getMonth() + 1
        const key = `${periodYear}-${periodMonth}`
        
        const entry = statsMap.get(key) || {
          periodYear,
          periodMonth,
          revenue: 0,
          userCount: new Set<string>(),
          whatsappMessages: 0,
          widgetMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }

        entry.pushCampaigns += 1
        entry.pushRecipients += campaign._count.recipients

        statsMap.set(key, entry)
      })

      // Build time series for all months
      const monthSeries: Array<{
        periodYear: number
        periodMonth: number
        revenue: number
        userCount: number
        whatsappMessages: number
        widgetMessages: number
        totalMessages: number
        pushCampaigns: number
        pushRecipients: number
      }> = []

      for (let index = monthsToLoad - 1; index >= 0; index -= 1) {
        const cursor = new Date(now.getFullYear(), now.getMonth() - index, 1)
        const periodYear = cursor.getFullYear()
        const periodMonth = cursor.getMonth() + 1
        const key = `${periodYear}-${periodMonth}`
        const entry = statsMap.get(key)

        monthSeries.push({
          periodYear,
          periodMonth,
          revenue: roundMoney(entry?.revenue ?? 0),
          userCount: entry?.userCount.size ?? 0,
          whatsappMessages: entry?.whatsappMessages ?? 0,
          widgetMessages: entry?.widgetMessages ?? 0,
          totalMessages: (entry?.whatsappMessages ?? 0) + (entry?.widgetMessages ?? 0),
          pushCampaigns: entry?.pushCampaigns ?? 0,
          pushRecipients: entry?.pushRecipients ?? 0,
        })
      }

      // Calculate totals
      const totals = monthSeries.reduce(
        (acc, month) => ({
          revenue: acc.revenue + month.revenue,
          whatsappMessages: acc.whatsappMessages + month.whatsappMessages,
          widgetMessages: acc.widgetMessages + month.widgetMessages,
          totalMessages: acc.totalMessages + month.totalMessages,
          pushCampaigns: acc.pushCampaigns + month.pushCampaigns,
          pushRecipients: acc.pushRecipients + month.pushRecipients,
        }),
        {
          revenue: 0,
          whatsappMessages: 0,
          widgetMessages: 0,
          totalMessages: 0,
          pushCampaigns: 0,
          pushRecipients: 0,
        }
      )

      res.json({
        success: true,
        data: {
          monthSeries,
          totals,
        },
        meta: {
          months: monthsToLoad,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching revenue stats:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch revenue statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/unpaid:
 *   get:
 *     summary: Get unpaid invoices (previous months only) for all owners
 *     tags: [Users Admin]
 *     security:
       - bearerAuth: []
 */
router.get(
  "/admin/invoices/unpaid",
  authMiddleware,
  platformAdminMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()

      const invoices = await prisma.monthlyInvoice.findMany({
        where: {
          status: { in: ["DRAFT", "PENDING"] },
          OR: [
            { periodYear: { lt: currentYear } },
            { periodYear: currentYear, periodMonth: { lt: currentMonth } },
          ],
        },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
              planType: true,
              subscriptionStatus: true,
              creditBalance: true,
              paymentFailureCount: true,
              lastPaymentFailedAt: true,
              isPlatformAdmin: true,
              isDeveloperUser: true,
            },
          },
        },
      })

      const recalculated = await Promise.all(
        invoices.map((invoice) => invoiceService.recalculateInvoiceTotals(invoice.id))
      )
      const recalculatedById = new Map(recalculated.map((invoice) => [invoice.id, invoice]))

      const data = invoices.map((invoice) => {
        const updatedInvoice = recalculatedById.get(invoice.id) || invoice
        return {
        owner: {
          id: invoice.user?.id,
          email: invoice.user?.email,
          firstName: invoice.user?.firstName ?? null,
          lastName: invoice.user?.lastName ?? null,
          companyName: invoice.user?.companyName ?? null,
          planType: invoice.user?.planType,
          subscriptionStatus: invoice.user?.subscriptionStatus,
          creditBalance: Number(invoice.user?.creditBalance ?? 0),
          paymentFailureCount: invoice.user?.paymentFailureCount ?? 0,
          lastPaymentFailedAt: invoice.user?.lastPaymentFailedAt ?? null,
          isPlatformAdmin: invoice.user?.isPlatformAdmin ?? false,
          isDeveloperUser: invoice.user?.isDeveloperUser ?? false,
        },
        invoice: {
          id: updatedInvoice.id,
          invoiceNumber: (updatedInvoice as any).invoiceNumber ?? null,
          periodMonth: updatedInvoice.periodMonth,
          periodYear: updatedInvoice.periodYear,
          totalAmount: Number(updatedInvoice.totalAmount),
          subtotalAmount: Number((updatedInvoice as any).subtotalAmount ?? 0),
          taxAmount: Number((updatedInvoice as any).taxAmount ?? 0),
          creditNotesTotal: Number((updatedInvoice as any).creditNotesTotal ?? 0),
          status: updatedInvoice.status,
          paidAt: updatedInvoice.paidAt,
          adminNotes: (updatedInvoice as any).adminNotes ?? null,
          adminMarkedById: (updatedInvoice as any).adminMarkedById ?? null,
          adminMarkedAt: (updatedInvoice as any).adminMarkedAt ?? null,
        },
      }
    })

      res.json({ success: true, data })
    } catch (error) {
      logger.error("[ADMIN] Error fetching unpaid invoices:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch unpaid invoices",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/failed:
 *   get:
 *     summary: Get failed invoices (previous months only) for all owners
 *     tags: [Users Admin]
 *     security:
       - bearerAuth: []
 */
router.get(
  "/admin/invoices/failed",
  authMiddleware,
  platformAdminMiddleware,
  async (_req: Request, res: Response) => {
    try {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()

      const invoices = await prisma.monthlyInvoice.findMany({
        where: {
          status: "FAILED",
          OR: [
            { periodYear: { lt: currentYear } },
            { periodYear: currentYear, periodMonth: { lt: currentMonth } },
          ],
        },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
              planType: true,
              subscriptionStatus: true,
              creditBalance: true,
              paymentFailureCount: true,
              lastPaymentFailedAt: true,
              isPlatformAdmin: true,
              isDeveloperUser: true,
            },
          },
        },
      })

      const recalculated = await Promise.all(
        invoices.map((invoice) => invoiceService.recalculateInvoiceTotals(invoice.id))
      )
      const recalculatedById = new Map(recalculated.map((invoice) => [invoice.id, invoice]))

      const data = invoices.map((invoice) => {
        const updatedInvoice = recalculatedById.get(invoice.id) || invoice
        return {
          owner: {
            id: invoice.user?.id,
            email: invoice.user?.email,
            firstName: invoice.user?.firstName ?? null,
            lastName: invoice.user?.lastName ?? null,
            companyName: invoice.user?.companyName ?? null,
            planType: invoice.user?.planType,
            subscriptionStatus: invoice.user?.subscriptionStatus,
            creditBalance: Number(invoice.user?.creditBalance ?? 0),
            paymentFailureCount: invoice.user?.paymentFailureCount ?? 0,
            lastPaymentFailedAt: invoice.user?.lastPaymentFailedAt ?? null,
            isPlatformAdmin: invoice.user?.isPlatformAdmin ?? false,
            isDeveloperUser: invoice.user?.isDeveloperUser ?? false,
          },
          invoice: {
            id: updatedInvoice.id,
            invoiceNumber: (updatedInvoice as any).invoiceNumber ?? null,
            periodMonth: updatedInvoice.periodMonth,
            periodYear: updatedInvoice.periodYear,
            totalAmount: Number(updatedInvoice.totalAmount),
            subtotalAmount: Number((updatedInvoice as any).subtotalAmount ?? 0),
            taxAmount: Number((updatedInvoice as any).taxAmount ?? 0),
            creditNotesTotal: Number((updatedInvoice as any).creditNotesTotal ?? 0),
            status: updatedInvoice.status,
            paidAt: updatedInvoice.paidAt,
            adminNotes: (updatedInvoice as any).adminNotes ?? null,
            adminMarkedById: (updatedInvoice as any).adminMarkedById ?? null,
            adminMarkedAt: (updatedInvoice as any).adminMarkedAt ?? null,
          },
        }
      })

      res.json({ success: true, data })
    } catch (error) {
      logger.error("[ADMIN] Error fetching failed invoices:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch failed invoices",
        message: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}:
 *   get:
 *     summary: Get invoice details (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice details
 */
router.get(
  "/admin/invoices/:invoiceId",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params

      let invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
      })

      if (!invoice) {
        res.status(404).json({ success: false, error: "Invoice not found" })
        return
      }

      await invoiceService.recalculateInvoiceTotals(invoiceId)

      invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              companyName: true,
            },
          },
        },
      })

      if (!invoice) {
        res.status(404).json({ success: false, error: "Invoice not found" })
        return
      }

      const invoiceAdjustment = (prisma as any).invoiceAdjustment
      const [creditNotesTotal, adjustmentsTotal, rechargesTotal] = await Promise.all([
        prisma.invoiceCreditNote
          .aggregate({
            where: { invoiceId },
            _sum: { amount: true },
          })
          .catch((error: any) => {
            if (error?.code === "P2021") {
              return { _sum: { amount: 0 } }
            }
            throw error
          }),
        invoiceAdjustment
          ? invoiceAdjustment
              .aggregate({
                where: { invoiceId },
                _sum: { amount: true },
              })
              .catch((error: any) => {
                if (error?.code === "P2021") {
                  return { _sum: { amount: 0 } }
                }
                throw error
              })
          : Promise.resolve({ _sum: { amount: 0 } }),
        prisma.billingTransaction.aggregate({
          where: {
            userId: invoice.userId,
            type: "RECHARGE",
            amount: { gt: 0 },
            createdAt: {
              gte: invoice.periodStart,
              lte: invoice.periodEnd,
            },
          },
          _sum: { amount: true },
        }),
      ])

      const creditNotesAmount =
        invoice.status === "PAID" ? Number(creditNotesTotal._sum.amount || 0) : 0

      res.json({
        success: true,
        data: {
          ...invoice,
          totalAmount: Number(invoice.totalAmount),
          subscriptionAmount: Number(invoice.subscriptionAmount),
          creditUsage: Number(invoice.creditUsage),
          creditDebt: Number(invoice.creditDebt),
          adjustmentsTotal: Number(adjustmentsTotal._sum.amount || 0),
          creditNotesTotal: creditNotesAmount,
          rechargesTotal: Number(rechargesTotal._sum.amount || 0),
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching invoice:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch invoice",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/credit-notes/{noteId}:
 *   patch:
 *     summary: Update a credit note (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  "/admin/invoices/:invoiceId/credit-notes/:noteId",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId, noteId } = req.params
      const { amount, reason } = req.body as { amount: number; reason?: string }

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: "Amount must be greater than 0",
        })
        return
      }

      const note = await prisma.invoiceCreditNote.findFirst({
        where: { id: noteId, invoiceId },
      })

      if (!note) {
        res.status(404).json({
          success: false,
          error: "Credit note not found",
        })
        return
      }

      const updated = await prisma.invoiceCreditNote.update({
        where: { id: noteId },
        data: {
          amount,
          reason: reason ?? null,
        },
      })

      await invoiceService.recalculateInvoiceTotals(invoiceId)

      res.json({
        success: true,
        data: {
          id: updated.id,
          amount: Number(updated.amount),
          reason: updated.reason,
          createdAt: updated.createdAt,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error updating credit note:", error)
      res.status(500).json({
        success: false,
        error: "Failed to update credit note",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/credit-notes/{noteId}:
 *   delete:
 *     summary: Delete a credit note (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  "/admin/invoices/:invoiceId/credit-notes/:noteId",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId, noteId } = req.params
      const note = await prisma.invoiceCreditNote.findFirst({
        where: { id: noteId, invoiceId },
      })

      if (!note) {
        res.status(404).json({
          success: false,
          error: "Credit note not found",
        })
        return
      }

      await prisma.invoiceCreditNote.delete({
        where: { id: noteId },
      })

      await invoiceService.recalculateInvoiceTotals(invoiceId)

      res.json({ success: true })
    } catch (error) {
      logger.error("[ADMIN] Error deleting credit note:", error)
      res.status(500).json({
        success: false,
        error: "Failed to delete credit note",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/{userId}/paypal:
 *   get:
 *     summary: Get PayPal settings and transactions for owner (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  "/admin/:userId/paypal",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params

      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          paypalStatus: true,
          isPaymentConnected: true,
          paypalClientId: true,
          paypalMerchantId: true,
          paypalEmail: true,
          paypalEnvironment: true,
          paypalConnectedAt: true,
        },
      })

      if (!owner) {
        res.status(404).json({ success: false, error: "User not found" })
        return
      }

      const transactions = await prisma.payPalTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          invoice: {
            select: {
              periodMonth: true,
              periodYear: true,
              status: true,
            },
          },
        },
      })

      res.json({
        success: true,
        data: {
          owner,
          transactions: transactions.map((tx) => ({
            id: tx.id,
            invoiceId: tx.invoiceId,
            invoicePeriod: tx.invoice
              ? `${String(tx.invoice.periodMonth).padStart(2, "0")}/${tx.invoice.periodYear}`
              : null,
            invoiceStatus: tx.invoice?.status || null,
            amount: Number(tx.amount),
            currency: tx.currency,
            status: tx.status,
            notes: tx.notes,
            createdAt: tx.createdAt,
          })),
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching PayPal info:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch PayPal info",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/paypal/transactions:
 *   get:
 *     summary: List all PayPal transactions (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [SUCCESS, FAILED]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 */
router.get(
  "/admin/paypal/transactions",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { status, limit = "100" } = req.query as { status?: string; limit?: string }

      const where: any = {}
      if (status && (status === "SUCCESS" || status === "FAILED")) {
        where.status = status
      }

      const transactions = await prisma.payPalTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: parseInt(limit, 10),
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          invoice: {
            select: {
              id: true,
              periodMonth: true,
              periodYear: true,
              totalAmount: true,
              status: true,
            },
          },
        },
      })

      res.json({
        success: true,
        data: transactions.map((tx) => ({
          id: tx.id,
          userId: tx.userId,
          userEmail: tx.user?.email,
          userName: tx.user ? `${tx.user.firstName || ""} ${tx.user.lastName || ""}`.trim() : null,
          invoiceId: tx.invoiceId,
          invoicePeriod: tx.invoice ? `${tx.invoice.periodMonth}/${tx.invoice.periodYear}` : null,
          invoiceStatus: tx.invoice?.status,
          amount: Number(tx.amount),
          currency: tx.currency,
          status: tx.status,
          notes: tx.notes,
          adminUserId: tx.adminUserId,
          createdAt: tx.createdAt,
        })),
      })
    } catch (error) {
      logger.error("[ADMIN] Error fetching PayPal transactions:", error)
      res.status(500).json({
        success: false,
        error: "Failed to fetch transactions",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/paypal/mock-payment:
 *   post:
 *     summary: Process PayPal monthly payment (admin, Subscriptions v2)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
// Backward-compat path kept for UI, and treated as real capture
router.post(
  "/admin/invoices/:invoiceId/paypal/process-payment",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const { notes } = req.body as { notes?: string }
      const adminUser = (req as any).user

      if (!adminUser?.id) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      // Import and use the PayPal billing service
      const { processPayment } = await import("../../../services/paypal-billing.service")
      
      const result = await processPayment(invoiceId, adminUser.id, notes)

      if (result.success) {
        res.json({
          success: true,
          data: {
            transactionId: result.transactionId,
            message: "Payment initiated. Invoice will be marked PAID when PayPal confirms.",
          },
        })
      } else {
        const statusCode = result.errorCode === "RATE_LIMITED" ? 429 : 400
        res.status(statusCode).json({
          success: false,
          error: result.error,
          code: result.errorCode,
          transactionId: result.transactionId,
        })
      }
    } catch (error) {
      logger.error("[ADMIN] Error processing PayPal payment:", error)
      res.status(500).json({
        success: false,
        error: "Failed to process payment",
      })
    }
  }
)

// Legacy mock endpoint - kept for backwards compatibility, redirects to new endpoint
router.post(
  "/admin/invoices/:invoiceId/paypal/mock-payment",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    // Redirect to the real payment processor
    const { invoiceId } = req.params
    const { notes } = req.body as { notes?: string }
    const adminUser = (req as any).user

    if (!adminUser?.id) {
      res.status(401).json({ success: false, error: "Unauthorized" })
      return
    }

    try {
      const { processPayment } = await import("../../../services/paypal-billing.service")
      const result = await processPayment(invoiceId, adminUser.id, notes)

      res.json({
        success: result.success,
        data: {
          success: result.success,
          transactionId: result.transactionId,
          status: result.success ? "SUCCESS" : "FAILED",
          error: result.error,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error processing mock PayPal payment:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to process payment"
      res.status(500).json({
        success: false,
        error: errorMessage,
      })
    }
  }
)

// Preferred explicit path
router.post(
  "/admin/invoices/:invoiceId/paypal/capture",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    // Note: This route is deprecated. Use /mock-payment instead
    return res.status(410).json({
      success: false,
      error: "This endpoint is deprecated. Use /admin/invoices/:invoiceId/paypal/mock-payment instead"
    })
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/cancel:
 *   post:
 *     summary: Cancel invoice and optionally block workspace (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               blockWorkspace:
 *                 type: boolean
 *                 description: If true, disables all workspaces for this user
 *     responses:
 *       200:
 *         description: Invoice cancelled successfully
 */
router.post(
  "/admin/invoices/:invoiceId/cancel",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const { reason, blockWorkspace } = req.body as {
        reason?: string
        blockWorkspace?: boolean
      }
      const adminUser = (req as any).user

      if (!adminUser?.id) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      // Get invoice to find user
      const invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        select: { 
          id: true, 
          userId: true, 
          status: true,
          periodMonth: true,
          periodYear: true,
        },
      })

      if (!invoice) {
        res.status(404).json({ success: false, error: "Invoice not found" })
        return
      }

      if (invoice.status === "PAID") {
        res.status(400).json({ 
          success: false, 
          error: "Cannot cancel paid invoice" 
        })
        return
      }

      // Cancel invoice
      await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "CANCELLED",
          adminNotes: reason || "Removed from fails list - user won't pay",
          adminMarkedById: adminUser.id,
          adminMarkedAt: new Date(),
        },
      })

      // Optionally block all workspaces for this user
      if (blockWorkspace) {
        await prisma.workspace.updateMany({
          where: { ownerId: invoice.userId },
          data: { 
            channelStatus: false,
          },
        })

        logger.info(`[ADMIN] Blocked all workspaces for user ${invoice.userId} due to invoice ${invoiceId} cancellation`)
      }

      logger.info(`[ADMIN] Invoice ${invoiceId} cancelled by ${adminUser.email}`, {
        reason,
        blockWorkspace,
        period: `${invoice.periodMonth}/${invoice.periodYear}`,
      })

      res.json({
        success: true,
        data: {
          invoiceId,
          status: "CANCELLED",
          workspacesBlocked: blockWorkspace || false,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error cancelling invoice:", error)
      res.status(500).json({
        success: false,
        error: "Failed to cancel invoice",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/credit-notes:
 *   post:
 *     summary: Create credit note for an invoice (admin)
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 */
router.post(
  "/admin/invoices/:invoiceId/credit-notes",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const { amount, reason } = req.body as { amount?: number; reason?: string }

      if (!amount || amount <= 0) {
        res.status(400).json({
          success: false,
          error: "Amount must be greater than 0",
        })
        return
      }

      const invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        select: { userId: true, status: true },
      })

      if (!invoice) {
        res.status(404).json({
          success: false,
          error: "Invoice not found",
        })
        return
      }

      if (invoice.status !== "PAID") {
        res.status(400).json({
          success: false,
          error: "Credit notes are only allowed for paid invoices",
        })
        return
      }

      const adminUser = (req as any).user
      const note = await prisma.invoiceCreditNote.create({
        data: {
          invoiceId,
          userId: invoice.userId,
          amount,
          reason: reason || null,
          createdById: adminUser?.id || null,
          createdByEmail: adminUser?.email || null,
        },
      })

      await invoiceService.recalculateInvoiceTotals(invoiceId)

      res.json({
        success: true,
        data: {
          id: note.id,
          amount: Number(note.amount),
          reason: note.reason,
          createdAt: note.createdAt,
          createdById: note.createdById,
          createdByEmail: note.createdByEmail,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error creating credit note:", error)
      res.status(500).json({
        success: false,
        error: "Failed to create credit note",
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

/**
 * @swagger
 * /api/users/admin/{userId}/payment-failure:
 *   post:
 *     summary: Record a payment failure for a user (admin)
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment failure recorded
 */
router.post(
  "/admin/:userId/payment-failure",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { adminNotes } = req.body as { adminNotes?: string }
      const adminUser = (req as any).user

      const result = await subscriptionBillingService.recordOwnerPaymentFailure(userId)

      if (adminNotes) {
        const invoice = await invoiceService.getOrCreateCurrentInvoice(userId)
        await prisma.monthlyInvoice.update({
          where: { id: invoice.id },
          data: {
            adminNotes,
            adminMarkedById: adminUser?.id ?? null,
            adminMarkedAt: new Date(),
          },
        })
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error("Error recording payment failure:", error)
      res.status(500).json({
        success: false,
        error: "Failed to record payment failure",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/{userId}/payment-reset:
 *   post:
 *     summary: Reset payment failure state for a user (admin)
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment failure reset
 */
router.post(
  "/admin/:userId/payment-reset",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { adminNotes } = req.body as { adminNotes?: string }
      const adminUser = (req as any).user

      const result = await subscriptionBillingService.resetOwnerPaymentFailures(userId)

      if (adminNotes) {
        const invoice = await invoiceService.getOrCreateCurrentInvoice(userId)
        await prisma.monthlyInvoice.update({
          where: { id: invoice.id },
          data: {
            adminNotes,
            adminMarkedById: adminUser?.id ?? null,
            adminMarkedAt: new Date(),
          },
        })
      }

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      logger.error("Error resetting payment failure:", error)
      res.status(500).json({
        success: false,
        error: "Failed to reset payment failure",
      })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/{userId}/subscription-status:
 *   patch:
 *     summary: Update subscription status for a user (admin)
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
 *               subscriptionStatus:
 *                 type: string
 *                 enum: [ACTIVE, PAUSED, PAYMENT_FAILED]
 *               adminNotes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Subscription status updated
 */
router.patch(
  "/admin/:userId/subscription-status",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params
      const { subscriptionStatus, adminNotes } = req.body as {
        subscriptionStatus?: "ACTIVE" | "PAUSED" | "PAYMENT_FAILED"
        adminNotes?: string
      }

      if (!subscriptionStatus) {
        res.status(400).json({
          success: false,
          error: "subscriptionStatus is required",
        })
        return
      }

      const allowedStatuses = ["ACTIVE", "PAUSED", "PAYMENT_FAILED"]
      if (!allowedStatuses.includes(subscriptionStatus)) {
        res.status(400).json({
          success: false,
          error: "Invalid subscriptionStatus",
        })
        return
      }

      const adminUser = (req as any).user
      const now = new Date()
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { paymentFailureCount: true },
      })

      if (!existingUser) {
        res.status(404).json({
          success: false,
          error: "User not found",
        })
        return
      }

      const updateData = buildSubscriptionStatusUpdateData(
        subscriptionStatus,
        existingUser.paymentFailureCount ?? 0,
        now
      )

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      })

      if (adminNotes) {
        const invoice = await invoiceService.getOrCreateCurrentInvoice(userId)
        await prisma.monthlyInvoice.update({
          where: { id: invoice.id },
          data: {
            adminNotes,
            adminMarkedById: adminUser?.id ?? null,
            adminMarkedAt: now,
          },
        })
      }

      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          subscriptionStatus: true,
          paymentFailureCount: true,
          lastPaymentFailedAt: true,
          pausedAt: true,
          pauseRequestedAt: true,
        },
      })

      res.json({
        success: true,
        data: {
          subscriptionStatus: updatedUser?.subscriptionStatus ?? subscriptionStatus,
          paymentFailureCount: updatedUser?.paymentFailureCount ?? 0,
          lastPaymentFailedAt: updatedUser?.lastPaymentFailedAt ?? null,
          pausedAt: updatedUser?.pausedAt ?? null,
          pauseRequestedAt: updatedUser?.pauseRequestedAt ?? null,
        },
      })
    } catch (error) {
      logger.error("Error updating subscription status:", error)
      res.status(500).json({
        success: false,
        error: "Failed to update subscription status",
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

      // Get workspace with owner info
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          ownerId: true, // Feature 198: Need ownerId for billing
          owner: {
            select: { email: true, isPlatformAdmin: true, creditBalance: true }
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

      // Ensure workspace has owner
      if (!workspace.ownerId) {
        return res.status(400).json({
          success: false,
          error: "Workspace has no owner",
        })
      }

      // Feature 198: Get owner's current credit balance from workspace.owner
      const currentBalance = Number(workspace.owner?.creditBalance || 0)
      const newBalance = currentBalance + amount

      // Update owner's balance and create transaction in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Feature 198: Update owner's balance (not workspace)
        await tx.user.update({
          where: { id: workspace.ownerId! },
          data: { creditBalance: newBalance },
        })

        // Create BONUS transaction
        // Feature 198: userId is required, workspaceId is optional
        const transaction = await tx.billingTransaction.create({
          data: {
            userId: workspace.ownerId!,
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

        return { transaction }
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
