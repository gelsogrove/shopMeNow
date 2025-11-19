import { Router } from "express"
import { PrismaClient } from "@prisma/client"
import { TransportTypeController } from "../controllers/transport-type.controller"
import { authMiddleware } from "../../../middlewares/auth.middleware"
import { validateWorkspaceOperation } from "../../../middlewares/workspace-validation.middleware"

const router = Router()
const prisma = new PrismaClient()
const transportTypeController = new TransportTypeController(prisma)

/**
 * All transport type routes require 2-layer security:
 * 1. authMiddleware - JWT validation
 * 2. validateWorkspaceOperation - workspace ownership validation
 */

// GET /api/workspaces/:workspaceId/transport-types
router.get(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  transportTypeController.getAll.bind(transportTypeController)
)

// GET /api/workspaces/:workspaceId/transport-types/:id
router.get(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  transportTypeController.getById.bind(transportTypeController)
)

// POST /api/workspaces/:workspaceId/transport-types
router.post(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  transportTypeController.create.bind(transportTypeController)
)

// PUT /api/workspaces/:workspaceId/transport-types/:id
router.put(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  transportTypeController.update.bind(transportTypeController)
)

// DELETE /api/workspaces/:workspaceId/transport-types/:id
router.delete(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  transportTypeController.delete.bind(transportTypeController)
)

export default router
