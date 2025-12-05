import { PrismaClient } from "@echatbot/database"
import { Router } from "express"
import { AgentConfigController } from "../controllers/agent-config.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"
import { requireOwner } from "../../../middlewares/workspace-role.middleware"

const router = Router()
const prisma = new PrismaClient()
const agentConfigController = new AgentConfigController(prisma)

/**
 * @route GET /api/workspaces/:workspaceId/agent-config
 * @description Get all agent configurations for workspace
 * @access Protected - Requires auth + workspace validation + OWNER ONLY
 * 
 * SECURITY: Only workspace owner (ownerId) can view agent configuration.
 * Team members with ADMIN or MEMBER role cannot access AI prompts.
 */
router.get(
  "/workspaces/:workspaceId/agent-config",
  authMiddleware,
  workspaceValidationMiddleware,
  requireOwner,
  agentConfigController.getAgentConfigs.bind(agentConfigController)
)

/**
 * @route POST /api/workspaces/:workspaceId/agent-config/reset-to-defaults
 * @description Reset all agent prompts to default values
 * @access Protected - Requires auth + workspace validation + OWNER ONLY
 * 
 * SECURITY: Only workspace owner can reset prompts.
 * WARNING: This will overwrite all custom prompts!
 */
router.post(
  "/workspaces/:workspaceId/agent-config/reset-to-defaults",
  authMiddleware,
  workspaceValidationMiddleware,
  requireOwner,
  agentConfigController.resetToDefaults.bind(agentConfigController)
)

/**
 * @route GET /api/workspaces/:workspaceId/agent-config/export
 * @description Export all agent prompts as a ZIP file
 * @access Protected - Requires auth + workspace validation + OWNER ONLY
 * 
 * SECURITY: Only workspace owner can export prompts.
 */
router.get(
  "/workspaces/:workspaceId/agent-config/export",
  authMiddleware,
  workspaceValidationMiddleware,
  requireOwner,
  agentConfigController.exportPrompts.bind(agentConfigController)
)

export default router

