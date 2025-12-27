"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentController = void 0;
const agent_service_1 = require("../../../application/services/agent.service");
const workspace_service_1 = require("../../../application/services/workspace.service");
const prisma_1 = require("../../../lib/prisma");
const logger_1 = __importDefault(require("../../../utils/logger"));
class AgentController {
    constructor(agentService) {
        /**
         * Get all agents for a workspace
         */
        this.getAllForWorkspace = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                const paramId = req.params.workspaceId;
                const customId = req.workspaceId;
                const headerId = req.headers["x-workspace-id"];
                const userId = req.user ? req.user.id : null;
                // Try to get workspaceId from multiple sources
                let workspaceId = paramId || customId || headerId;
                logger_1.default.info("Agent controller - workspaceId:", workspaceId);
                logger_1.default.info("Agent controller - sources:", {
                    paramId,
                    customId,
                    headerId,
                    userId,
                });
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "Workspace ID is required",
                        debug: { paramId, customId, headerId, userId, final: workspaceId },
                    });
                }
                // Check if workspace exists using WorkspaceService (secure Prisma query)
                const workspaceService = new workspace_service_1.WorkspaceService(prisma_1.prisma);
                const workspace = yield workspaceService.getById(workspaceId);
                if (!workspace) {
                    return res.status(404).json({
                        message: "Workspace not found",
                        workspaceId,
                    });
                }
                logger_1.default.info(`Getting all agents for workspace ${workspaceId}`);
                const agents = yield this.agentService.getAllForWorkspace(workspaceId);
                logger_1.default.info("=== AGENT CONTROLLER SUCCESS ===");
                logger_1.default.info(`Found ${Array.isArray(agents) ? agents.length : 0} agents for workspace ${workspaceId}`);
                return res.json(agents);
            }
            catch (error) {
                logger_1.default.info("=== AGENT CONTROLLER ERROR ===", error);
                logger_1.default.error("Error fetching agents:", error);
                return next(error);
            }
        });
        /**
         * Get a specific agent by ID
         */
        /**
         * Update an existing agent
         */
        this.update = (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const { id } = req.params;
                // Extract workspaceId the same way as getAllForWorkspace
                const paramId = req.params.workspaceId;
                const customId = req.workspaceId;
                const headerId = req.headers["x-workspace-id"];
                // Try to get workspaceId from multiple sources
                let workspaceId = paramId || customId || headerId;
                logger_1.default.info("Agent update - workspaceId:", workspaceId);
                logger_1.default.info("Agent update - sources:", { paramId, customId, headerId });
                if (!workspaceId) {
                    return res.status(400).json({
                        message: "Workspace ID is required for update",
                        debug: { paramId, customId, headerId },
                    });
                }
                logger_1.default.info(`Updating agentConfig ${id} for workspace ${workspaceId}`);
                // Extract userId from authenticated request for security check
                const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
                // Use updateAgentConfig method for AgentConfig table
                const updatedAgent = yield this.agentService.updateAgentConfig(id, req.body, workspaceId, userId // Pass userId for admin verification
                );
                if (!updatedAgent) {
                    return res.status(404).json({ message: "Agent not found" });
                }
                return res.json(updatedAgent);
            }
            catch (error) {
                logger_1.default.error("Error updating agent:", error);
                // Check if this is a conflict error (duplicate router agent)
                if (error.message &&
                    error.message.includes("router agent already exists")) {
                    return res.status(409).json({
                        message: "A router agent already exists for this workspace",
                    });
                }
                return next(error);
            }
        });
        this.agentService = agentService || agent_service_1.agentService;
    }
    /**
     * Handle API errors with consistent response format
     */
    handleError(res, err, message) {
        const statusCode = err.statusCode || 500;
        const errorMessage = err.message || message;
        logger_1.default.error(`${message}:`, err);
        res.status(statusCode).json({
            status: "error",
            message: errorMessage,
        });
    }
}
exports.AgentController = AgentController;
//# sourceMappingURL=agent.controller.js.map