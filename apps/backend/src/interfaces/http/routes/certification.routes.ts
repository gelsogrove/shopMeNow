import { Router } from "express"
import { prisma } from "@echatbot/database"
import { CertificationController } from "../controllers/certification.controller"
import { authMiddleware } from "../../../middlewares/auth.middleware"
import { validateWorkspaceOperation } from "../../../middlewares/workspace-validation.middleware"

const router = Router()
// prisma imported
const certificationController = new CertificationController(prisma)

/**
 * All certification routes require 2-layer security:
 * 1. authMiddleware - JWT validation
 * 2. validateWorkspaceOperation - workspace ownership validation
 */

// GET /api/workspaces/:workspaceId/certifications
router.get(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  certificationController.getAll.bind(certificationController)
)

// GET /api/workspaces/:workspaceId/certifications/:id
router.get(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  certificationController.getById.bind(certificationController)
)

// POST /api/workspaces/:workspaceId/certifications
router.post(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  certificationController.create.bind(certificationController)
)

// PUT /api/workspaces/:workspaceId/certifications/:id
router.put(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  certificationController.update.bind(certificationController)
)

// DELETE /api/workspaces/:workspaceId/certifications/:id
router.delete(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  certificationController.delete.bind(certificationController)
)

export default router
