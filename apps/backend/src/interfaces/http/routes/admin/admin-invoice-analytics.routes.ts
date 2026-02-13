/**
 * 📊 ADMIN INVOICE ANALYTICS & LISTS ROUTES
 *
 * Invoice history, summary analytics, revenue stats, unpaid/failed lists.
 * Extracted from admin-invoice.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { invoiceService } from "../../../../application/services/invoice.service"
import { roundMoney } from "../../../../utils/money"

const router = Router()

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

export default router
