/**
 * 🧾 ADMIN INVOICE ROUTES
 *
 * Admin endpoints for managing invoices, PayPal payments, analytics, and credit notes.
 * These routes are protected by platformAdminMiddleware.
 *
 * Extracted from user-admin.routes.ts for cleaner separation.
 */

import { Router, Request, Response } from "express"
import {
  prisma,
  InvoiceStatus,
} from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { SubscriptionBillingService } from "../../../../application/services/subscription-billing.service"
import { invoiceService } from "../../../../application/services/invoice.service"
import { roundMoney } from "../../../../utils/money"
import { loadPayPalConfigForEnv } from "../../../../utils/paypal-config"

const router = Router()

const subscriptionBillingService = new SubscriptionBillingService(prisma)

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

// ── Current invoices ────────────────────────────────────────────────────────

router.get(
  "/admin/invoices/current",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const owners = await prisma.user.findMany({
        where: {
          status: "ACTIVE",
          ownedWorkspaces: { some: { deletedAt: null } },
        },
        select: {
          id: true, email: true, firstName: true, lastName: true, companyName: true,
          planType: true, subscriptionStatus: true, creditBalance: true,
          paymentFailureCount: true, lastPaymentFailedAt: true,
          isPlatformAdmin: true, isDeveloperUser: true,
        },
        orderBy: { createdAt: "asc" },
      })

      const results = await Promise.all(
        owners.map(async (owner) => {
          const invoice = await invoiceService.getOrCreateCurrentInvoice(owner.id)
          return {
            owner: {
              id: owner.id, email: owner.email, firstName: owner.firstName,
              lastName: owner.lastName, companyName: owner.companyName,
              planType: owner.planType, subscriptionStatus: owner.subscriptionStatus,
              creditBalance: Number(owner.creditBalance),
              paymentFailureCount: owner.paymentFailureCount ?? 0,
              lastPaymentFailedAt: owner.lastPaymentFailedAt ?? null,
              isPlatformAdmin: owner.isPlatformAdmin ?? false,
              isDeveloperUser: owner.isDeveloperUser ?? false,
            },
            invoice: {
              id: invoice.id,
              invoiceNumber: (invoice as any).invoiceNumber ?? null,
              periodMonth: invoice.periodMonth, periodYear: invoice.periodYear,
              totalAmount: invoice.totalAmount,
              subtotalAmount: (invoice as any).subtotalAmount ?? 0,
              taxAmount: (invoice as any).taxAmount ?? 0,
              creditNotesTotal: (invoice as any).creditNotesTotal ?? 0,
              status: invoice.status, paidAt: invoice.paidAt,
              adminNotes: (invoice as any).adminNotes ?? null,
              adminMarkedById: (invoice as any).adminMarkedById ?? null,
              adminMarkedAt: (invoice as any).adminMarkedAt ?? null,
            },
          }
        })
      )

      return res.json({ success: true, data: results })
    } catch (error) {
      logger.error("[ADMIN] Error fetching current invoices:", error)
      return res.status(500).json({ success: false, error: "Failed to fetch current invoices" })
    }
  }
)

// ── Invoice PDF ─────────────────────────────────────────────────────────────

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

// ── Credit-note PDF ─────────────────────────────────────────────────────────

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

// ── Update invoice status ───────────────────────────────────────────────────

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

// ── Credit notes CRUD ───────────────────────────────────────────────────────

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

// ── Adjustments CRUD ────────────────────────────────────────────────────────

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

// ── Invoice history ─────────────────────────────────────────────────────────

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

// ── Invoice summary (analytics) ─────────────────────────────────────────────

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

// ── Revenue stats (analytics) ───────────────────────────────────────────────

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

// ── Unpaid invoices ─────────────────────────────────────────────────────────

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

// ── Failed invoices ─────────────────────────────────────────────────────────

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

// ── Invoice detail ──────────────────────────────────────────────────────────

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

// ── Credit note update/delete ───────────────────────────────────────────────

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

// ── PayPal routes ───────────────────────────────────────────────────────────

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

// ── Create credit note ──────────────────────────────────────────────────────

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

export default router
