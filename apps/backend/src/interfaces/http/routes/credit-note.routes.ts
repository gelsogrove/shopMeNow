import { Router } from "express"
import { CreditNoteController } from "../controllers/credit-note.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

const router = Router()
const creditNoteController = new CreditNoteController()

// All credit note routes require authentication and workspace validation

// Create credit note for an order
// POST /api/workspaces/:workspaceId/orders/:orderId/credit-notes
router.post(
  "/workspaces/:workspaceId/orders/:orderId/credit-notes",
  authMiddleware,
  workspaceValidationMiddleware,
  creditNoteController.createCreditNote
)

// Get credit notes for an order
// GET /api/workspaces/:workspaceId/orders/:orderId/credit-notes
router.get(
  "/workspaces/:workspaceId/orders/:orderId/credit-notes",
  authMiddleware,
  workspaceValidationMiddleware,
  creditNoteController.getCreditNotesByOrder
)

// Get single credit note by ID
// GET /api/workspaces/:workspaceId/credit-notes/:creditNoteId
router.get(
  "/workspaces/:workspaceId/credit-notes/:creditNoteId",
  authMiddleware,
  workspaceValidationMiddleware,
  creditNoteController.getCreditNoteById
)

// Get all credit notes for workspace (for reporting)
// GET /api/workspaces/:workspaceId/credit-notes
router.get(
  "/workspaces/:workspaceId/credit-notes",
  authMiddleware,
  workspaceValidationMiddleware,
  creditNoteController.getAllCreditNotes
)

// Delete a credit note
// DELETE /api/workspaces/:workspaceId/credit-notes/:creditNoteId
router.delete(
  "/workspaces/:workspaceId/credit-notes/:creditNoteId",
  authMiddleware,
  workspaceValidationMiddleware,
  creditNoteController.deleteCreditNote
)

export default router
