"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const credit_note_controller_1 = require("../controllers/credit-note.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
const router = (0, express_1.Router)();
const creditNoteController = new credit_note_controller_1.CreditNoteController();
// All credit note routes require authentication and workspace validation
// Create credit note for an order
// POST /api/workspaces/:workspaceId/orders/:orderId/credit-notes
router.post("/workspaces/:workspaceId/orders/:orderId/credit-notes", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, creditNoteController.createCreditNote);
// Get credit notes for an order
// GET /api/workspaces/:workspaceId/orders/:orderId/credit-notes
router.get("/workspaces/:workspaceId/orders/:orderId/credit-notes", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, creditNoteController.getCreditNotesByOrder);
// Get single credit note by ID
// GET /api/workspaces/:workspaceId/credit-notes/:creditNoteId
router.get("/workspaces/:workspaceId/credit-notes/:creditNoteId", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, creditNoteController.getCreditNoteById);
// Get all credit notes for workspace (for reporting)
// GET /api/workspaces/:workspaceId/credit-notes
router.get("/workspaces/:workspaceId/credit-notes", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, creditNoteController.getAllCreditNotes);
// Delete a credit note
// DELETE /api/workspaces/:workspaceId/credit-notes/:creditNoteId
router.delete("/workspaces/:workspaceId/credit-notes/:creditNoteId", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, creditNoteController.deleteCreditNote);
exports.default = router;
//# sourceMappingURL=credit-note.routes.js.map