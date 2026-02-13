/**
 * 📋 ADMIN INVOICE ADJUSTMENTS ROUTES
 *
 * CRUD for invoice adjustments (GET, POST, PATCH, DELETE).
 * Split from admin-invoice-credit-notes.routes.ts for file size compliance (<500 lines).
 */

import { Router, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { invoiceService } from "../../../../application/services/invoice.service"

const router = Router()

// ── Adjustments GET ─────────────────────────────────────────────────────────

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

// ── Adjustments POST ────────────────────────────────────────────────────────

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

// ── Adjustments PATCH ───────────────────────────────────────────────────────

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

// ── Adjustments DELETE ──────────────────────────────────────────────────────

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

export default router
