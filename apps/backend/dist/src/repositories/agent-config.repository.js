"use strict";
/**
 * AgentConfigRepository
 *
 * Repository for managing Agent Configurations in the multi-agent system.
 * Provides CRUD operations and specialized queries for agent orchestration.
 *
 * Key Methods:
 * - findByType: Get specific agent by type (ROUTER, PRODUCT_SEARCH, etc.)
 * - findActiveByOrder: Get all active agents sorted by execution order
 * - findActiveAgents: Get all active agents for a workspace
 *
 * Security: ALL queries filtered by workspaceId (multi-tenant isolation)
 */
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
exports.AgentConfigRepository = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
class AgentConfigRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Find agent configuration by type
     * @param workspaceId - Workspace ID (security filter)
     * @param type - Agent type (ROUTER, PRODUCT_SEARCH, etc.)
     * @returns Agent configuration or null
     */
    findByType(workspaceId, type) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agent = yield this.prisma.agentConfig.findFirst({
                    where: {
                        workspaceId,
                        type,
                        isActive: true,
                    },
                });
                if (!agent) {
                    logger_1.default.warn(`Agent type ${type} not found for workspace ${workspaceId}`);
                }
                return agent;
            }
            catch (error) {
                logger_1.default.error(`Error finding agent by type ${type}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find all active agents sorted by order (for agent execution pipeline)
     * @param workspaceId - Workspace ID (security filter)
     * @returns Array of agent configurations sorted by order field
     */
    findActiveByOrder(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agents = yield this.prisma.agentConfig.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    orderBy: {
                        order: "asc", // ROUTER first (0), then specialists (2-5), SAFETY last (99)
                    },
                });
                logger_1.default.info(`Found ${agents.length} active agents for workspace ${workspaceId}`);
                return agents;
            }
            catch (error) {
                logger_1.default.error("Error finding active agents by order:", error);
                throw error;
            }
        });
    }
    /**
     * Find all active agents (without order sorting)
     * @param workspaceId - Workspace ID (security filter)
     * @returns Array of active agent configurations
     */
    findActiveAgents(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.agentConfig.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error finding active agents:", error);
                throw error;
            }
        });
    }
    /**
     * Find agent by ID
     * @param id - Agent ID
     * @param workspaceId - Workspace ID (security filter)
     * @returns Agent configuration or null
     */
    findById(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.agentConfig.findFirst({
                    where: {
                        id,
                        workspaceId,
                    },
                });
            }
            catch (error) {
                logger_1.default.error(`Error finding agent by ID ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Find all agents for a workspace (including inactive)
     * @param workspaceId - Workspace ID (security filter)
     * @returns Array of all agent configurations
     */
    findAll(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.agentConfig.findMany({
                    where: {
                        workspaceId,
                    },
                    orderBy: {
                        order: "asc",
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error finding all agents:", error);
                throw error;
            }
        });
    }
    /**
     * Create new agent configuration
     * @param data - Agent configuration data
     * @returns Created agent configuration
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const agent = yield this.prisma.agentConfig.create({
                    data: {
                        workspaceId: data.workspaceId,
                        name: data.name,
                        type: data.type,
                        description: data.description,
                        systemPrompt: data.systemPrompt,
                        model: data.model,
                        temperature: data.temperature,
                        maxTokens: data.maxTokens,
                        order: data.order,
                        isActive: (_a = data.isActive) !== null && _a !== void 0 ? _a : true,
                        availableFunctions: data.availableFunctions,
                    },
                });
                logger_1.default.info(`Created agent ${agent.name} (${agent.type}) for workspace ${data.workspaceId}`);
                return agent;
            }
            catch (error) {
                logger_1.default.error("Error creating agent:", error);
                throw error;
            }
        });
    }
    /**
     * Update agent configuration
     * @param id - Agent ID
     * @param workspaceId - Workspace ID (security filter)
     * @param data - Updated fields
     * @returns Updated agent configuration
     */
    update(id, workspaceId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agent = yield this.prisma.agentConfig.updateMany({
                    where: {
                        id,
                        workspaceId,
                    },
                    data,
                });
                if (agent.count === 0) {
                    throw new Error(`Agent ${id} not found in workspace ${workspaceId}`);
                }
                logger_1.default.info(`Updated agent ${id} for workspace ${workspaceId}`);
                // Return updated agent
                const updatedAgent = yield this.findById(id, workspaceId);
                if (!updatedAgent) {
                    throw new Error(`Failed to retrieve updated agent ${id}`);
                }
                return updatedAgent;
            }
            catch (error) {
                logger_1.default.error(`Error updating agent ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Delete agent configuration (soft delete: set isActive = false)
     * @param id - Agent ID
     * @param workspaceId - Workspace ID (security filter)
     * @returns Deleted agent configuration
     */
    softDelete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.update(id, workspaceId, { isActive: false });
            }
            catch (error) {
                logger_1.default.error(`Error soft deleting agent ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Hard delete agent configuration (permanent removal)
     * @param id - Agent ID
     * @param workspaceId - Workspace ID (security filter)
     */
    hardDelete(id, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.prisma.agentConfig.deleteMany({
                    where: {
                        id,
                        workspaceId,
                    },
                });
                logger_1.default.info(`Hard deleted agent ${id} from workspace ${workspaceId}`);
            }
            catch (error) {
                logger_1.default.error(`Error hard deleting agent ${id}:`, error);
                throw error;
            }
        });
    }
    /**
     * Count active agents for a workspace
     * @param workspaceId - Workspace ID (security filter)
     * @returns Number of active agents
     */
    countActive(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield this.prisma.agentConfig.count({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                });
            }
            catch (error) {
                logger_1.default.error("Error counting active agents:", error);
                throw error;
            }
        });
    }
}
exports.AgentConfigRepository = AgentConfigRepository;
//# sourceMappingURL=agent-config.repository.js.map