import { Router } from "express"
import { prisma } from "@echatbot/database"
import { FlowNodeConfigController } from "../controllers/flow-node-config.controller"
import { authMiddleware } from "../../../middlewares/auth.middleware"
import { validateWorkspaceOperation } from "../../../middlewares/workspace-validation.middleware"

const router = Router()
const flowNodeConfigController = new FlowNodeConfigController(prisma)

/**
 * All flow-config routes require 2-layer security:
 * 1. authMiddleware - JWT validation
 * 2. validateWorkspaceOperation - workspace ownership validation
 */

// GET /api/workspaces/:workspaceId/flow-configs
router.get(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  flowNodeConfigController.getAll.bind(flowNodeConfigController)
)

// GET /api/workspaces/:workspaceId/flow-configs/schema-guide
router.get(
  "/schema-guide",
  authMiddleware,
  validateWorkspaceOperation,
  flowNodeConfigController.getSchemaGuide.bind(flowNodeConfigController)
)

// POST /api/workspaces/:workspaceId/flow-configs/validate
router.post(
  "/validate",
  authMiddleware,
  validateWorkspaceOperation,
  flowNodeConfigController.validateFlows.bind(flowNodeConfigController)
)

// GET /api/workspaces/:workspaceId/flow-configs/:id
router.get(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  flowNodeConfigController.getById.bind(flowNodeConfigController)
)

// POST /api/workspaces/:workspaceId/flow-configs
router.post(
  "/",
  authMiddleware,
  validateWorkspaceOperation,
  flowNodeConfigController.create.bind(flowNodeConfigController)
)

// PUT /api/workspaces/:workspaceId/flow-configs/:id
router.put(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  flowNodeConfigController.update.bind(flowNodeConfigController)
)

// DELETE /api/workspaces/:workspaceId/flow-configs/:id
router.delete(
  "/:id",
  authMiddleware,
  validateWorkspaceOperation,
  flowNodeConfigController.delete.bind(flowNodeConfigController)
)

export default router
