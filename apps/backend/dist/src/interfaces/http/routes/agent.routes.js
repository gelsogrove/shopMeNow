"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentRouter = void 0;
const workspace_role_middleware_1 = require("../../../middlewares/workspace-role.middleware");
const express_1 = require("express");
const logger_1 = __importDefault(require("../../../utils/logger"));
const agent_controller_1 = require("../controllers/agent.controller");
const async_middleware_1 = require("../middlewares/async.middleware");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const workspace_validation_middleware_1 = require("../middlewares/workspace-validation.middleware");
/**
 * @swagger
 * components:
 *   schemas:
 *     Agent:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - workspaceId
 *       properties:
 *         id:
 *           type: string
 *           description: Unique ID of the agent
 *         name:
 *           type: string
 *           description: Name of the agent
 *         content:
 *           type: string
 *           description: Content/description of the agent
 *         isActive:
 *           type: boolean
 *           description: Whether the agent is active
 *         isRouter:
 *           type: boolean
 *           description: Whether the agent is a router
 *         department:
 *           type: string
 *           description: Department of the agent
 *         workspaceId:
 *           type: string
 *           description: ID of the workspace the agent belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when the agent was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when the agent was last updated
 */
const createAgentRouter = () => {
    const router = (0, express_1.Router)({ mergeParams: true }); // Enable mergeParams to inherit workspaceId
    const agentController = new agent_controller_1.AgentController();
    logger_1.default.info("Setting up agent routes");
    // Apply auth middleware first
    router.use(auth_middleware_1.authMiddleware); // ENABLED FOR PROPER AUTHENTICATION
    // Enable workspace validation middleware (this will extract workspaceId from params)
    router.use(workspace_validation_middleware_1.workspaceValidationMiddleware);
    /**
     * @swagger
     * /api/agent:
     *   get:
     *     summary: Get all agents for a workspace
     *     tags: [Agent]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: header
     *         name: x-workspace-id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *     responses:
     *       200:
     *         description: List of agents
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Agent'
     */
    router.get("/", (0, async_middleware_1.asyncHandler)(agentController.getAllForWorkspace));
    /**
     * @swagger
     * /api/agent/{id}:
     *   put:
     *     summary: Update an existing agent
     *     tags: [Agent]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the agent
     *       - in: header
     *         name: x-workspace-id
     *         schema:
     *           type: string
     *         required: true
     *         description: ID of the workspace
     *     responses:
     *       200:
     *         description: Agent updated successfully
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Agent'
     *       404:
     *         description: Agent not found
     */
    // Update agent - ONLY SUPER_ADMIN (Owner) can modify agent configuration
    router.put("/:id", workspace_role_middleware_1.requireSuperAdmin, (0, async_middleware_1.asyncHandler)(agentController.update));
    logger_1.default.info("Agent routes setup complete");
    return router;
};
exports.createAgentRouter = createAgentRouter;
//# sourceMappingURL=agent.routes.js.map