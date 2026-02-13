/**
 * 🧾 ADMIN INVOICE CREDIT NOTES ROUTES
 *
 * CRUD for invoice credit notes (GET, POST, PATCH, DELETE).
 * Adjustments moved to admin-invoice-adjustments.routes.ts.
 */

import { Router, Request, Response } from "express"
import { prisma } from "@echatbot/database"
import { authMiddleware } from "../../middlewares/auth.middleware"
import { platformAdminMiddleware } from "../../middlewares/platform-admin.middleware"
import logger from "../../../../utils/logger"
import { invoiceService } from "../../../../application/services/invoice.service"

const router = Router()

// ── Credit notes GET ────────────────────────────────────────────────────────

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

// ── Credit note create ──────────────────────────────────────────────────────

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

// ── Credit note update ──────────────────────────────────────────────────────

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

// ── Credit note delete ──────────────────────────────────────────────────────

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

export default router
