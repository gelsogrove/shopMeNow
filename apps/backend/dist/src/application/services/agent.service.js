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
exports.agentService = exports.AgentService = void 0;
const database_1 = require("@echatbot/database");
const agent_function_mapping_1 = require("../../config/agent-function-mapping");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * Service layer for Agents
 * Handles agent operations for AI assistants
 */
class AgentService {
    constructor() {
        this.prisma = database_1.prisma;
    }
    /**
     * Get all agents for a workspace
     * @param workspaceId Workspace ID
     * @returns List of agents
     */
    getAllForWorkspace(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info(`Getting all agents for workspace ${workspaceId}`);
                logger_1.default.info("DEBUG AGENT SERVICE: workspaceId:", workspaceId);
                // Ensure workspaceId is not undefined
                if (!workspaceId) {
                    logger_1.default.warn("getAllForWorkspace called without workspaceId");
                    return [];
                }
                let agents = [];
                try {
                    agents = yield this.prisma.agentConfig.findMany({
                        where: {
                            workspaceId,
                            isActive: true, // ← AGGIUNTO: solo quelli attivi!
                        },
                    });
                    logger_1.default.info("DEBUG AGENT SERVICE: Prisma result:", agents);
                }
                catch (prismaError) {
                    logger_1.default.info("DEBUG AGENT SERVICE: Prisma query error:", prismaError);
                }
                if (!agents || agents.length === 0) {
                    try {
                        const rawAgents = yield this.prisma.$queryRawUnsafe(`SELECT * FROM "Prompts" WHERE "workspaceId" = $1`, workspaceId);
                        logger_1.default.info("DEBUG AGENT SERVICE: RAW SQL result:", rawAgents);
                        return rawAgents;
                    }
                    catch (rawError) {
                        logger_1.default.info("DEBUG AGENT SERVICE: RAW SQL error:", rawError);
                    }
                }
                logger_1.default.info(`Found ${agents.length} agents for workspace ${workspaceId}`);
                // 🔄 MAPPING: Trasforma agentConfig per il frontend
                const mappedAgents = agents.map((agent) => ({
                    id: agent.id,
                    name: agent.name,
                    content: agent.systemPrompt, // Backward compatibility
                    systemPrompt: agent.systemPrompt, // Standard
                    workspaceId: agent.workspaceId,
                    temperature: agent.temperature,
                    model: agent.model,
                    maxTokens: agent.maxTokens, // ✅ STANDARD: camelCase
                    order: agent.order,
                    agentType: agent.type, // ✅ FIX: Database field is "type" not "agentType"
                    isActive: agent.isActive,
                    icon: agent.icon, // 🎨 Icon name from database
                    functions: (0, agent_function_mapping_1.getFunctionsForAgentType)(agent.type), // ✅ FIX: Use "type" field
                    createdAt: agent.createdAt,
                    updatedAt: agent.updatedAt,
                }));
                logger_1.default.info("🔄 MAPPED agents for frontend:", mappedAgents);
                return mappedAgents;
            }
            catch (error) {
                logger_1.default.error(`Error getting agents:`, error);
                return []; // Return empty array instead of throwing
            }
        });
    }
    /**
     * Get or determine a workspace ID from user context or default
     * @param workspaceId Optional workspace ID directly provided
     * @param userContext User context that may contain workspace ID
     * @returns Workspace ID
     */
    getWorkspaceId(workspaceId, userContext) {
        // If provided directly, use it
        if (workspaceId) {
            return workspaceId;
        }
        // Try to get from user context
        if (userContext === null || userContext === void 0 ? void 0 : userContext.workspaceId) {
            return userContext.workspaceId;
        }
        // Try to get from default workspace in database
        try {
            // This is synchronous so we can't use Prisma here directly
            // In a real app, this should be handled differently
            const defaultId = process.env.DEFAULT_WORKSPACE_ID || "default-workspace-id";
            logger_1.default.debug(`Using default workspace ID: ${defaultId}`);
            return defaultId;
        }
        catch (error) {
            logger_1.default.error("Error getting default workspace ID:", error);
            return "default-workspace-id";
        }
    }
    /**
     * Update agent configuration (AgentConfig table)
     * 🔒 SECURITY: Only admin users can update prompt/content
     */
    updateAgentConfig(id, data, workspaceId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                logger_1.default.info(`🔄 Updating agentConfig ${id} for workspace ${workspaceId}`);
                logger_1.default.info("📝 Update data received:", data);
                logger_1.default.info("🌡️  Temperature in request:", {
                    temperature: data.temperature,
                    type: typeof data.temperature,
                    isDefined: data.temperature !== undefined,
                    isNull: data.temperature === null,
                    isZero: data.temperature === 0,
                });
                // Ensure required data is present
                if (!id || !workspaceId) {
                    logger_1.default.warn("Missing required data for updating agentConfig");
                    throw new Error("ID and workspace ID are required");
                }
                // First check if the agentConfig exists and belongs to the workspace
                const existingAgent = yield this.prisma.agentConfig.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                if (!existingAgent) {
                    logger_1.default.warn(`❌ AgentConfig ${id} not found for workspace ${workspaceId}`);
                    return null;
                }
                // 🔒 SECURITY CHECK: Verify user is admin if trying to update prompt/content
                if (userId && (data.prompt !== undefined || data.content !== undefined)) {
                    const user = yield this.prisma.user.findUnique({
                        where: { id: userId },
                        select: { role: true },
                    });
                    if (!user || user.role !== "ADMIN") {
                        logger_1.default.warn(`🚨 SECURITY: Non-admin user ${userId} attempted to modify agent prompt`);
                        throw new Error("Only admin users can modify agent prompts");
                    }
                    logger_1.default.info(`✅ Admin ${userId} authorized to update prompt`);
                }
                // Map frontend fields to database fields (frontend → backend)
                const updateData = {};
                // 🔒 CRITICAL: Only allow prompt updates from verified admin users
                if (data.prompt !== undefined)
                    updateData.systemPrompt = data.prompt;
                if (data.content !== undefined)
                    updateData.systemPrompt = data.content;
                if (data.systemPrompt !== undefined)
                    updateData.systemPrompt = data.systemPrompt;
                // These fields can be updated by any authenticated user
                if (data.model !== undefined)
                    updateData.model = data.model;
                if (data.temperature !== undefined)
                    updateData.temperature = data.temperature;
                if (data.maxTokens !== undefined)
                    updateData.maxTokens = data.maxTokens;
                if (data.isActive !== undefined)
                    updateData.isActive = data.isActive;
                logger_1.default.info("🛠️ Prepared update data:", updateData);
                logger_1.default.info("🌡️  Temperature in updateData:", {
                    temperature: updateData.temperature,
                    type: typeof updateData.temperature,
                    willUpdate: updateData.temperature !== undefined,
                });
                // Update the agentConfig
                const updatedAgent = yield this.prisma.agentConfig.update({
                    where: { id },
                    data: updateData,
                });
                logger_1.default.info(`✅ AgentConfig ${id} updated successfully`);
                logger_1.default.info("🌡️  Temperature after update:", updatedAgent.temperature);
                // Map database fields back to frontend format (backend → frontend)
                const mappedAgent = Object.assign(Object.assign({}, updatedAgent), { content: updatedAgent.systemPrompt, systemPrompt: updatedAgent.systemPrompt, maxTokens: updatedAgent.maxTokens, name: updatedAgent.name || `Agent-${updatedAgent.workspaceId}`, createdAt: (_a = updatedAgent.createdAt) === null || _a === void 0 ? void 0 : _a.toISOString(), updatedAt: (_b = updatedAgent.updatedAt) === null || _b === void 0 ? void 0 : _b.toISOString() });
                return mappedAgent;
            }
            catch (error) {
                logger_1.default.error(`❌ Error updating agentConfig:`, error);
                throw error;
            }
        });
    }
}
exports.AgentService = AgentService;
// Export a singleton instance for backward compatibility
exports.agentService = new AgentService();
//# sourceMappingURL=agent.service.js.map