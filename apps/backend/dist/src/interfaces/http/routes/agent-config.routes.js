"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("@echatbot/database");
const express_1 = require("express");
const agent_config_controller_1 = require("../controllers/agent-config.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
const workspace_role_middleware_1 = require("../../../middlewares/workspace-role.middleware");
const router = (0, express_1.Router)();
// prisma imported
const agentConfigController = new agent_config_controller_1.AgentConfigController(database_1.prisma);
/**
 * @route GET /api/workspaces/:workspaceId/agent-config
 * @description Get all agent configurations for workspace
 * @access Protected - Requires auth + workspace validation + OWNER ONLY
 *
 * SECURITY: Only workspace owner (ownerId) can view agent configuration.
 * Team members with ADMIN or MEMBER role cannot access AI prompts.
 */
router.get("/workspaces/:workspaceId/agent-config", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, workspace_role_middleware_1.requireOwner, agentConfigController.getAgentConfigs.bind(agentConfigController));
/**
 * @route POST /api/workspaces/:workspaceId/agent-config/reset-to-defaults
 * @description Reset all agent prompts to default values
 * @access Protected - Requires auth + workspace validation + OWNER ONLY
 *
 * SECURITY: Only workspace owner can reset prompts.
 * WARNING: This will overwrite all custom prompts!
 */
router.post("/workspaces/:workspaceId/agent-config/reset-to-defaults", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, workspace_role_middleware_1.requireOwner, agentConfigController.resetToDefaults.bind(agentConfigController));
/**
 * @route GET /api/workspaces/:workspaceId/agent-config/export
 * @description Export all agent prompts as a ZIP file
 * @access Protected - Requires auth + workspace validation + OWNER ONLY
 *
 * SECURITY: Only workspace owner can export prompts.
 */
router.get("/workspaces/:workspaceId/agent-config/export", auth_middleware_1.authMiddleware, workspace_validation_middleware_1.workspaceValidationMiddleware, workspace_role_middleware_1.requireOwner, agentConfigController.exportPrompts.bind(agentConfigController));
exports.default = router;
//# sourceMappingURL=agent-config.routes.js.map