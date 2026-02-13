/**
 * 💳 ADMIN USER SUBSCRIPTION & BILLING ROUTES
 *
 * Payment failure/reset, subscription status, bonus credits.
 * Extracted from admin-user-management.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { SubscriptionBillingService } from "../../../../application/services/subscription-billing.service"
import { invoiceService } from "../../../../application/services/invoice.service"
import { buildSubscriptionStatusUpdateData } from "../user-admin.routes"

const router = Router()

const subscriptionBillingService = new SubscriptionBillingService(prisma)

// =============================================================================
// 💳 PAYMENT MANAGEMENT
// =============================================================================

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

// =============================================================================
// 📊 SUBSCRIPTION STATUS
// =============================================================================

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

// =============================================================================
// 🎁 BONUS CREDITS
// =============================================================================

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
          ownerId: true,
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

export default router
