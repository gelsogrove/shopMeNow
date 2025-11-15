import { PrismaClient } from "@prisma/client"
import { Router } from "express"
import { AgentConfigController } from "../controllers/agent-config.controller"
import { authMiddleware } from "../middlewares/auth.middleware"
import { workspaceValidationMiddleware } from "../middlewares/workspace-validation.middleware"

const router = Router()
const prisma = new PrismaClient()
const agentConfigController = new AgentConfigController(prisma)

/**
 * @route GET /api/workspaces/:workspaceId/agent-config
 * @description Get all agent configurations for workspace
 * @access Protected - Requires auth + workspace validation
 */
router.get(
  "/workspaces/:workspaceId/agent-config",
  authMiddleware,
  workspaceValidationMiddleware,
  agentConfigController.getAgentConfigs.bind(agentConfigController)
)

export default router
