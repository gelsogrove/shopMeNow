import { Router } from "express"
import { prisma } from "@echatbot/database"
import { TypeController } from "../controllers/type.controller"
import { authMiddleware } from "../../../middlewares/auth.middleware"
import { validateWorkspaceOperation } from "../../../middlewares/workspace-validation.middleware"

const router = Router()
// prisma imported
const typeController = new TypeController(prisma)

/**
 * All type routes require 2-layer security:
 * 1. authMiddleware - JWT validation
 * 2. validateWorkspaceOperation - workspace ownership validation
 */

// GET /api/workspaces/:workspaceId/types
router.get(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  typeController.getAll.bind(typeController)
)

// GET /api/workspaces/:workspaceId/types/:id
router.get(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  typeController.getById.bind(typeController)
)

// POST /api/workspaces/:workspaceId/types
router.post(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  typeController.create.bind(typeController)
)

// PUT /api/workspaces/:workspaceId/types/:id
router.put(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  typeController.update.bind(typeController)
)

// DELETE /api/workspaces/:workspaceId/types/:id
router.delete(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  typeController.delete.bind(typeController)
)

export default router
