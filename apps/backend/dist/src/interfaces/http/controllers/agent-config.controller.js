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
exports.AgentConfigController = void 0;
const archiver_1 = __importDefault(require("archiver"));
const logger_1 = __importDefault(require("../../../utils/logger"));
const defaultAgents_1 = require("../../../../prisma/data/defaultAgents");
const dynamicAgents_1 = require("../../../../prisma/data/dynamicAgents");
/**
 * Agent Configuration Controller
 * Handles API requests for agent configuration and available functions
 */
class AgentConfigController {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Get all agent configurations for a workspace
     * Returns agents with their available functions from database
     *
     * @swagger
     * /api/workspaces/{workspaceId}/agent-config:
     *   get:
     *     summary: Get all agent configurations
     *     description: Returns all agents with their available functions, prompts, and settings
     *     tags: [Agent Configuration]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: header
     *         name: x-workspace-id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID (must match path parameter)
     *     responses:
     *       200:
     *         description: Agent configurations retrieved successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 agents:
     *                   type: array
     *                   items:
     *                     type: object
     *                     properties:
     *                       id:
     *                         type: string
     *                       name:
     *                         type: string
     *                       type:
     *                         type: string
     *                       description:
     *                         type: string
     *                       icon:
     *                         type: string
     *                       systemPrompt:
     *                         type: string
     *                       model:
     *                         type: string
     *                       temperature:
     *                         type: number
     *                       maxTokens:
     *                         type: number
     *                       order:
     *                         type: number
     *                       isActive:
     *                         type: boolean
     *                       availableFunctions:
     *                         type: array
     *                         items:
     *                           type: string
     *                         description: Array of function names this agent can call
     *       401:
     *         description: Unauthorized - Invalid or missing token
     *       403:
     *         description: Forbidden - Workspace access denied
     *       500:
     *         description: Internal server error
     */
    getAgentConfigs(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Extract workspaceId from middleware
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    return res.status(400).json({
                        error: "Workspace ID required",
                        message: "workspaceId must be provided",
                    });
                }
                // Check if workspace is e-commerce or info-only
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { sellsProductsAndServices: true },
                });
                const hasEcommerce = (_a = workspace === null || workspace === void 0 ? void 0 : workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true;
                // E-commerce only agent types - hide these for info-only workspaces
                const ecommerceOnlyTypes = ["PRODUCT_SEARCH", "CART_MANAGEMENT", "ORDER_TRACKING"];
                // Fetch all agents for workspace, ordered by order field
                const agents = yield this.prisma.agentConfig.findMany({
                    where: Object.assign({ workspaceId }, (hasEcommerce ? {} : { type: { notIn: ecommerceOnlyTypes } })),
                    orderBy: {
                        order: "asc",
                    },
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        description: true,
                        icon: true,
                        systemPrompt: true,
                        model: true,
                        temperature: true,
                        maxTokens: true,
                        order: true,
                        isActive: true,
                        availableFunctions: true, // ✅ Now populated from agent-functions.config.ts
                    },
                });
                logger_1.default.info(`✅ Agent configs retrieved for workspace ${workspaceId}: ${agents.length} agents (hasEcommerce: ${hasEcommerce})`);
                return res.status(200).json({
                    agents,
                });
            }
            catch (error) {
                logger_1.default.error("❌ Failed to get agent configs:", error);
                return res.status(500).json({
                    error: "Failed to get agent configs",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Reset all agent prompts to default values
     * This will overwrite all current prompts with the default ones from docs/prompts/
     *
     * @swagger
     * /api/workspaces/{workspaceId}/agent-config/reset-to-defaults:
     *   post:
     *     summary: Reset all agent prompts to defaults
     *     description: Resets all agent configurations to their default values from the seed files. WARNING - This will overwrite all customizations!
     *     tags: [Agent Configuration]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: header
     *         name: x-workspace-id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID (must match path parameter)
     *     responses:
     *       200:
     *         description: Agent configurations reset successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                 resetCount:
     *                   type: number
     *       401:
     *         description: Unauthorized - Invalid or missing token
     *       403:
     *         description: Forbidden - Only workspace owner can reset prompts
     *       500:
     *         description: Internal server error
     */
    resetToDefaults(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const workspaceId = req.workspaceId;
                const { useDynamicTemplates } = req.body || {};
                if (!workspaceId) {
                    return res.status(400).json({
                        error: "Workspace ID required",
                        message: "workspaceId must be provided",
                    });
                }
                // Get workspace to determine if it's e-commerce or info-only
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { sellsProductsAndServices: true },
                });
                const hasEcommerce = (_a = workspace === null || workspace === void 0 ? void 0 : workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true;
                // Choose which templates to load:
                // - useDynamicTemplates=true: Load from src/templates/ with {{#if}} conditionals
                // - useDynamicTemplates=false (default): Load from docs/prompts/ (legacy)
                const templateSource = useDynamicTemplates ? "dynamic ({{#if}} templates)" : "legacy (docs/prompts)";
                const workspaceType = hasEcommerce ? "e-commerce" : "informational";
                logger_1.default.info(`🔄 Resetting agent configs to ${templateSource} for ${workspaceType} workspace ${workspaceId}`);
                // Get agent configurations from appropriate source
                const defaults = useDynamicTemplates
                    ? (0, dynamicAgents_1.dynamicAgents)(workspaceId, hasEcommerce)
                    : (0, defaultAgents_1.defaultAgents)(workspaceId);
                // Update each agent with default values
                let resetCount = 0;
                for (const defaultAgent of defaults) {
                    try {
                        yield this.prisma.agentConfig.updateMany({
                            where: {
                                workspaceId,
                                type: defaultAgent.type,
                            },
                            data: {
                                name: defaultAgent.name,
                                systemPrompt: defaultAgent.systemPrompt,
                                description: defaultAgent.description,
                                icon: defaultAgent.icon,
                                model: defaultAgent.model,
                                temperature: defaultAgent.temperature,
                                maxTokens: defaultAgent.maxTokens,
                                order: defaultAgent.order,
                                isActive: defaultAgent.isActive,
                                availableFunctions: defaultAgent.availableFunctions,
                            },
                        });
                        resetCount++;
                    }
                    catch (updateError) {
                        logger_1.default.warn(`⚠️ Could not update agent ${defaultAgent.type}:`, updateError);
                    }
                }
                logger_1.default.info(`✅ Reset ${resetCount} agent configs to ${templateSource} for workspace ${workspaceId}`);
                return res.status(200).json({
                    message: `Agent configurations reset to ${templateSource} successfully`,
                    resetCount,
                    templateSource: useDynamicTemplates ? "dynamic" : "legacy",
                });
            }
            catch (error) {
                logger_1.default.error("❌ Failed to reset agent configs:", error);
                return res.status(500).json({
                    error: "Failed to reset agent configs",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Export all agent prompts as a ZIP file with .md files
     *
     * @swagger
     * /api/workspaces/{workspaceId}/agent-config/export:
     *   get:
     *     summary: Export all agent prompts as ZIP
     *     description: Downloads a ZIP file containing all agent prompts as markdown files
     *     tags: [Agent Configuration]
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: workspaceId
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID
     *       - in: header
     *         name: x-workspace-id
     *         required: true
     *         schema:
     *           type: string
     *         description: Workspace ID (must match path parameter)
     *     responses:
     *       200:
     *         description: ZIP file with agent prompts
     *         content:
     *           application/zip:
     *             schema:
     *               type: string
     *               format: binary
     *       401:
     *         description: Unauthorized - Invalid or missing token
     *       403:
     *         description: Forbidden - Only workspace owner can export prompts
     *       500:
     *         description: Internal server error
     */
    exportPrompts(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const workspaceId = req.workspaceId;
                if (!workspaceId) {
                    return res.status(400).json({
                        error: "Workspace ID required",
                        message: "workspaceId must be provided",
                    });
                }
                logger_1.default.info(`📦 Exporting agent prompts for workspace ${workspaceId}`);
                // Fetch all agents for workspace
                const agents = yield this.prisma.agentConfig.findMany({
                    where: { workspaceId },
                    orderBy: { order: "asc" },
                    select: {
                        name: true,
                        type: true,
                        systemPrompt: true,
                    },
                });
                if (agents.length === 0) {
                    return res.status(404).json({
                        error: "No agents found",
                        message: "No agent configurations found for this workspace",
                    });
                }
                // Get workspace name for the filename
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: { name: true, slug: true },
                });
                const workspaceName = (workspace === null || workspace === void 0 ? void 0 : workspace.slug) || (workspace === null || workspace === void 0 ? void 0 : workspace.name) || workspaceId;
                const sanitizedName = workspaceName.toLowerCase().replace(/[^a-z0-9]/g, "-");
                const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
                // Set response headers for ZIP download
                res.setHeader("Content-Type", "application/zip");
                res.setHeader("Content-Disposition", `attachment; filename="agent-prompts-${sanitizedName}-${timestamp}.zip"`);
                // Create archive
                const archive = (0, archiver_1.default)("zip", { zlib: { level: 9 } });
                // Pipe archive to response
                archive.pipe(res);
                // Add each agent's prompt as a .md file
                for (const agent of agents) {
                    const filename = `${agent.type.toLowerCase()}-agent.md`;
                    const content = agent.systemPrompt || `# ${agent.name}\n\nNo prompt configured.`;
                    // Add file header with metadata
                    const fullContent = `# ${agent.name}\n\n<!-- Agent Type: ${agent.type} -->\n<!-- Exported: ${new Date().toISOString()} -->\n\n${content}`;
                    archive.append(fullContent, { name: filename });
                }
                // Finalize archive
                yield archive.finalize();
                logger_1.default.info(`✅ Exported ${agents.length} agent prompts for workspace ${workspaceId}`);
            }
            catch (error) {
                logger_1.default.error("❌ Failed to export agent prompts:", error);
                return res.status(500).json({
                    error: "Failed to export agent prompts",
                    message: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
}
exports.AgentConfigController = AgentConfigController;
//# sourceMappingURL=agent-config.controller.js.map