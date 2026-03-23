/**
 * 🧾 ADMIN INVOICE CORE ROUTES
 *
 * Core invoice CRUD: list current, PDF download, status update, detail view.
 * Extracted from admin-invoice.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import {
  prisma,
  InvoiceStatus,
} from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { invoiceService } from "../../../../application/services/invoice.service"

const router = Router()

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
  "/admin/invoices/:invoiceId([a-z0-9]{10,})/pdf",
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
  "/admin/invoices/:invoiceId([a-z0-9]{10,})/credit-notes/:noteId/pdf",
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
  "/admin/invoices/:invoiceId([a-z0-9]{10,})",
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
  "/admin/invoices/:invoiceId([a-z0-9]{10,})",
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

// ── Delete invoice ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/users/admin/invoices/{invoiceId}:
 *   delete:
 *     summary: Delete invoice (admin only)
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
router.delete(
  "/admin/invoices/:invoiceId([a-z0-9]{10,})",
  authMiddleware,
  platformAdminMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { invoiceId } = req.params
      await invoiceService.deleteInvoice(invoiceId)
      res.json({ success: true, message: "Invoice deleted successfully" })
    } catch (error: any) {
      logger.error("[ADMIN] Error deleting invoice:", error)
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete invoice",
      })
    }
  }
)

export default router
