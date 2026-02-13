/**
 * 💳 ADMIN INVOICE PAYPAL ROUTES
 *
 * PayPal payment processing, transactions, cancel invoice.
 * Revenue stats moved to admin-invoice-revenue.routes.ts.
 */

import { Router, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"

const router = Router()

// ── PayPal user info ────────────────────────────────────────────────────────

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

// ── PayPal transactions list ────────────────────────────────────────────────

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

// ── PayPal process payment ──────────────────────────────────────────────────

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
      const { processPayment } = await import("../../../../services/paypal-billing.service")
      
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

// Legacy mock endpoint - kept for backwards compatibility
router.post(
  "/admin/invoices/:invoiceId/paypal/mock-payment",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    const { invoiceId } = req.params
    const { notes } = req.body as { notes?: string }
    const adminUser = (req as any).user

    if (!adminUser?.id) {
      res.status(401).json({ success: false, error: "Unauthorized" })
      return
    }

    try {
      const { processPayment } = await import("../../../../services/paypal-billing.service")
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

// Deprecated capture endpoint
router.post(
  "/admin/invoices/:invoiceId/paypal/capture",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    return res.status(410).json({
      success: false,
      error: "This endpoint is deprecated. Use /admin/invoices/:invoiceId/paypal/mock-payment instead"
    })
  }
)

// ── Cancel invoice ──────────────────────────────────────────────────────────

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

      await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "CANCELLED",
          adminNotes: reason || "Removed from fails list - user won't pay",
          adminMarkedById: adminUser.id,
          adminMarkedAt: new Date(),
        },
      })

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

export default router
