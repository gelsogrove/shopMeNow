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
import { invoiceService } from "../../../../application/services/invoice.service"
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

// ── Mark invoice as paid manually (admin override) ──────────────────────────

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/mark-paid-manually:
 *   post:
 *     summary: Mark invoice as paid manually (admin override, no PayPal)
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Mandatory reason for manual override (e.g. "Bank transfer confirmed")
 *     responses:
 *       200:
 *         description: Invoice marked as paid successfully
 *       400:
 *         description: Invalid request (already paid, cancelled, or missing reason)
 *       404:
 *         description: Invoice not found
 */
router.post(
  "/admin/invoices/:invoiceId/mark-paid-manually",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const { reason } = req.body as { reason?: string }
      const adminUser = (req as any).user

      if (!adminUser?.id) {
        res.status(401).json({ success: false, error: "Unauthorized" })
        return
      }

      // Reason is mandatory — this is an irreversible financial override
      if (!reason || reason.trim().length < 5) {
        res.status(400).json({
          success: false,
          error: "A reason is required (minimum 5 characters) to mark an invoice as paid manually",
        })
        return
      }

      const invoice = await prisma.monthlyInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          user: {
            select: { id: true, email: true, creditBalance: true },
          },
        },
      })

      if (!invoice) {
        res.status(404).json({ success: false, error: "Invoice not found" })
        return
      }

      if (invoice.status === "PAID") {
        res.status(400).json({ success: false, error: "Invoice is already paid" })
        return
      }

      if (invoice.status === "CANCELLED") {
        res.status(400).json({ success: false, error: "Cannot mark a cancelled invoice as paid" })
        return
      }

      // Statuses allowed: DRAFT, PENDING, FAILED
      const allowedStatuses = ["DRAFT", "PENDING", "FAILED"]
      if (!allowedStatuses.includes(invoice.status)) {
        res.status(400).json({
          success: false,
          error: `Invoice status '${invoice.status}' cannot be manually marked as paid`,
        })
        return
      }

      const paidAt = new Date()
      const adminNote = `[MANUAL OVERRIDE by ${adminUser.email}] ${reason.trim()}`

      // 1. Update invoice status to PAID
      await prisma.monthlyInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "PAID",
          paidAt,
          adminNotes: adminNote,
          adminMarkedById: adminUser.id,
          adminMarkedAt: paidAt,
        },
      })

      // 2. Generate invoice number (same logic as PayPal webhook path)
      const invoiceNumber = await invoiceService.ensureInvoiceNumber(invoiceId, paidAt)

      // 3. Create PayPalTransaction record for audit trail (no PayPal, just a record)
      await prisma.payPalTransaction.create({
        data: {
          userId: invoice.user.id,
          invoiceId,
          amount: invoice.totalAmount,
          currency: "EUR",
          status: "SUCCESS",
          notes: adminNote,
          adminUserId: adminUser.id,
        },
      })

      // 4. Create BillingTransaction record (same as webhook path)
      await prisma.billingTransaction.create({
        data: {
          userId: invoice.user.id,
          workspaceId: null,
          type: "INVOICE_PAID",
          amount: invoice.totalAmount,
          balanceAfter: invoice.user.creditBalance,
          description: `Invoice ${invoice.periodMonth}/${invoice.periodYear} marked paid manually`,
          referenceId: invoiceId,
          referenceType: "invoice",
        },
      })

      logger.info("[ADMIN] Invoice manually marked as paid:", {
        invoiceId,
        invoiceNumber,
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        amount: Number(invoice.totalAmount),
        reason: reason.trim(),
      })

      res.json({
        success: true,
        data: {
          invoiceId,
          invoiceNumber,
          status: "PAID",
          paidAt: paidAt.toISOString(),
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error manually marking invoice as paid:", error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to mark invoice as paid",
      })
    }
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

// ── Charge retry + manual month-end run (Collections page actions) ─────────

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}/retry-charge:
 *   post:
 *     summary: Retry the PayPal charge for a FAILED/PENDING invoice (admin)
 *     description: >
 *       Soft-block collections flow: the scheduler makes 1 automatic attempt,
 *       the operator gets up to 3 manual retries (4 attempts total). After
 *       that the operator decides: block, cancel, or grant credit.
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/admin/invoices/:invoiceId/retry-charge",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      const adminUserId = (req as any).user?.id

      const { paypalInvoiceChargeService, MAX_PAYMENT_ATTEMPTS } = await import(
        "../../../../services/paypal-invoice-charge.service"
      )
      const result = await paypalInvoiceChargeService.chargeInvoice(
        invoiceId,
        "ADMIN_RETRY",
        adminUserId
      )

      logger.info(
        `[ADMIN] Invoice ${invoiceId} retry-charge by ${adminUserId}: ${result.status}${result.reason ? ` (${result.reason})` : ""}`
      )

      if (result.status === "SKIPPED") {
        return res.status(409).json({ success: false, error: result.reason })
      }

      res.json({
        success: result.success,
        data: {
          status: result.status,
          reason: result.reason,
          transactionId: result.transactionId,
          attempt: result.attempt,
          maxAttempts: MAX_PAYMENT_ATTEMPTS,
        },
      })
    } catch (error) {
      logger.error("[ADMIN] Error retrying invoice charge:", error)
      res.status(500).json({ success: false, error: "Failed to retry invoice charge" })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/billing/run-month-end:
 *   post:
 *     summary: Run the month-end billing manually (admin)
 *     description: >
 *       Same run the scheduler performs on the 1st at 23:30 (Europe/Rome).
 *       Idempotent — PAID invoices are skipped, attempts are claimed
 *       atomically, so a re-run never double-charges.
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/admin/billing/run-month-end",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as any).user?.id
      logger.info(`[ADMIN] Month-end billing run triggered manually by ${adminUserId}`)

      const { runMonthEndBilling } = await import(
        "../../../../services/month-end-billing.service"
      )
      const summary = await runMonthEndBilling()

      res.json({ success: true, data: summary })
    } catch (error) {
      logger.error("[ADMIN] Error running month-end billing:", error)
      res.status(500).json({ success: false, error: "Failed to run month-end billing" })
    }
  }
)

/**
 * @swagger
 * /api/users/admin/billing/zero-anchors:
 *   post:
 *     summary: Revise every approved mandate's €1 anchor price to €0 (admin)
 *     description: >
 *       One-off backfill for mandates approved BEFORE the automatic anchor
 *       revision existed (2026-08-12): the €1/month anchor price keeps
 *       recurring on those subscriptions even though real collections go
 *       through outstanding-balance captures. Idempotent — subscriptions
 *       already at €0 are reported as alreadyZero and not touched.
 *     tags: [Users Admin]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  "/admin/billing/zero-anchors",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as any).user?.id
      logger.info(`[ADMIN] Zero-anchors run triggered by ${adminUserId}`)

      const { paypalAnchorService } = await import(
        "../../../../services/paypal-anchor.service"
      )
      const { loadPayPalConfigForEnv, resolvePayPalEnvironment } = await import(
        "../../../../utils/paypal-config"
      )

      const owners = await prisma.user.findMany({
        where: { deletedAt: null, paypalSubscriptionId: { not: null } },
        select: {
          id: true,
          email: true,
          paypalSubscriptionId: true,
          paypalEnvironment: true,
          isPlatformAdmin: true,
          isDeveloperUser: true,
        },
      })

      const results = []
      for (const owner of owners) {
        const environment =
          (owner.paypalEnvironment as "sandbox" | "live" | null) ??
          resolvePayPalEnvironment(owner)
        const paypalConfig = loadPayPalConfigForEnv(environment)
        try {
          const revision = await paypalAnchorService.zeroAnchorPricing(
            paypalConfig,
            owner.paypalSubscriptionId!
          )
          results.push({
            email: owner.email,
            subscriptionId: owner.paypalSubscriptionId,
            environment,
            ...revision,
          })
        } catch (error) {
          results.push({
            email: owner.email,
            subscriptionId: owner.paypalSubscriptionId,
            environment,
            ok: false,
            alreadyZero: false,
            approvalRequired: false,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const summary = {
        processed: results.length,
        revised: results.filter((r) => r.ok && !r.alreadyZero).length,
        alreadyZero: results.filter((r) => r.alreadyZero).length,
        failed: results.filter((r) => !r.ok).length,
      }

      logger.info(
        `[ADMIN] Zero-anchors finished: ${summary.processed} mandates — ` +
          `${summary.revised} revised, ${summary.alreadyZero} already zero, ${summary.failed} failed`
      )

      res.json({ success: true, data: { summary, results } })
    } catch (error) {
      logger.error("[ADMIN] Error running zero-anchors:", error)
      res.status(500).json({ success: false, error: "Failed to run zero-anchors" })
    }
  }
)

export default router
