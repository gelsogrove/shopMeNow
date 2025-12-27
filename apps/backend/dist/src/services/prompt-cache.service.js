"use strict";
/**
 * PromptCacheService - FASE 3: Load and cache prompts at startup
 *
 * Problema: Prompt caricati ad ogni messaggio (file I/O + parsing)
 * Soluzione: Carica UNA VOLTA all'avvio, cache in memory
 *
 * FLUSSO:
 * 1. onModuleInit(): Carica TUTTI i prompt da database (agentConfig table)
 * 2. Cache in memory: Map<agentType, promptContent>
 * 3. Runtime: Accedi solo a cache (0 ms latency)
 * 4. onDestroy(): Pulizia (opzionale)
 *
 * BENEFICI:
 * - Zero DB queries per prompt durante runtime
 * - Zero file I/O durante runtime
 * - 100% determinitico (stesso prompt per tutta la session)
 * - Compatible con LangChain (static prompts)
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
exports.promptCacheService = exports.PromptCacheService = void 0;
const database_1 = require("@echatbot/database");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * PromptCacheService - manages caching of LLM prompts
 * Loads from database once at startup, serves from memory at runtime
 */
class PromptCacheService {
    constructor(prisma) {
        this.prisma = prisma;
        this.promptCache = new Map();
        this.workspacePromptCache = new Map(); // workspace-specific overrides
        this.isInitialized = false;
        this.refreshIntervalMs = 5 * 60 * 1000; // Refresh every 5 minutes in background
        this.refreshInterval = null;
    }
    /**
     * Load all prompts at module initialization
     */
    onModuleInit() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.info("🚀 PromptCacheService initializing...");
                // Load global prompts from agentConfig
                yield this.loadGlobalPrompts();
                this.isInitialized = true;
                logger_1.default.info(`✅ PromptCacheService ready with ${this.promptCache.size} global prompts cached`);
                // Start background refresh
                this.startBackgroundRefresh();
            }
            catch (error) {
                logger_1.default.error("❌ Failed to initialize PromptCacheService", error);
                throw error;
            }
        });
    }
    /**
     * Cleanup on module destroy
     */
    onModuleDestroy() {
        if (this.refreshInterval) {
            clearTimeout(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.promptCache.clear();
        this.workspacePromptCache.clear();
        logger_1.default.info("🧹 PromptCacheService cleanup complete");
    }
    /**
     * Load all global prompts from database
     */
    loadGlobalPrompts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const configs = yield this.prisma.agentConfig.findMany({
                    where: {
                        workspaceId: null, // Global configs (no workspace override)
                    },
                    select: {
                        type: true, // Use 'type' field (AgentType) instead of 'agentType'
                        systemPrompt: true, // Use 'systemPrompt' instead of 'promptContent'
                        id: true,
                        updatedAt: true,
                    },
                });
                for (const config of configs) {
                    const variables = this.extractVariables(config.systemPrompt);
                    this.promptCache.set(config.type, {
                        agentType: config.type,
                        content: config.systemPrompt,
                        version: 1,
                        lastUpdated: config.updatedAt,
                        variables,
                    });
                }
                logger_1.default.info(`📦 Loaded ${configs.length} global prompts`, {
                    agents: Array.from(this.promptCache.keys()),
                });
            }
            catch (error) {
                logger_1.default.error("Failed to load global prompts", error);
                throw error;
            }
        });
    }
    /**
     * Load workspace-specific prompt overrides
     */
    loadWorkspacePrompts(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.workspacePromptCache.has(workspaceId)) {
                    return; // Already loaded
                }
                const configs = yield this.prisma.agentConfig.findMany({
                    where: {
                        workspaceId,
                    },
                    select: {
                        type: true,
                        systemPrompt: true,
                        id: true,
                        updatedAt: true,
                    },
                });
                const wsCache = new Map();
                for (const config of configs) {
                    const variables = this.extractVariables(config.systemPrompt);
                    wsCache.set(config.type, {
                        agentType: config.type,
                        content: config.systemPrompt,
                        version: 1,
                        lastUpdated: config.updatedAt,
                        variables,
                    });
                }
                this.workspacePromptCache.set(workspaceId, wsCache);
                logger_1.default.info(`📦 Loaded ${configs.length} workspace-specific prompts`, {
                    workspaceId,
                    agents: Array.from(wsCache.keys()),
                });
            }
            catch (error) {
                logger_1.default.error("Failed to load workspace prompts", { workspaceId, error });
            }
        });
    }
    /**
     * Get prompt for agent (checks workspace override first, then global)
     */
    getPrompt(agentType, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Load workspace cache if needed
            if (workspaceId) {
                yield this.loadWorkspacePrompts(workspaceId);
                // Check workspace override first
                const wsCache = this.workspacePromptCache.get(workspaceId);
                if (wsCache === null || wsCache === void 0 ? void 0 : wsCache.has(agentType)) {
                    const cached = wsCache.get(agentType);
                    logger_1.default.debug(`💾 [CACHE-HIT] Workspace prompt for ${agentType}`, {
                        workspaceId,
                        version: cached.version,
                    });
                    return cached.content;
                }
            }
            // Check global cache
            const cached = this.promptCache.get(agentType);
            if (cached) {
                logger_1.default.debug(`💾 [CACHE-HIT] Global prompt for ${agentType}`, {
                    version: cached.version,
                });
                return cached.content;
            }
            logger_1.default.warn(`⚠️ [CACHE-MISS] No prompt found for agent ${agentType}`);
            return null;
        });
    }
    /**
     * Get cached prompt metadata (version, lastUpdated, variables)
     */
    getPromptMetadata(agentType, workspaceId) {
        if (workspaceId) {
            const wsCache = this.workspacePromptCache.get(workspaceId);
            if (wsCache === null || wsCache === void 0 ? void 0 : wsCache.has(agentType)) {
                return wsCache.get(agentType) || null;
            }
        }
        return this.promptCache.get(agentType) || null;
    }
    /**
     * Invalidate cache for specific workspace (e.g., after config update)
     */
    invalidateWorkspaceCache(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            this.workspacePromptCache.delete(workspaceId);
            logger_1.default.info(`🔄 Invalidated prompt cache for workspace ${workspaceId}`);
        });
    }
    /**
     * Invalidate all caches
     */
    invalidateAllCaches() {
        return __awaiter(this, void 0, void 0, function* () {
            this.promptCache.clear();
            this.workspacePromptCache.clear();
            yield this.loadGlobalPrompts();
            logger_1.default.info("🔄 Invalidated all prompt caches and reloaded global prompts");
        });
    }
    /**
     * Background refresh: reload prompts periodically
     */
    startBackgroundRefresh() {
        this.refreshInterval = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.default.debug("🔄 Background prompt cache refresh...");
                yield this.loadGlobalPrompts();
                // Note: workspace caches are loaded on-demand
            }
            catch (error) {
                logger_1.default.error("❌ Background refresh failed", error);
            }
            // Restart timer
            this.startBackgroundRefresh();
        }), this.refreshIntervalMs);
    }
    /**
     * Extract {{variable}} names from prompt content
     */
    extractVariables(content) {
        const regex = /\{\{([^}]+)\}\}/g;
        const variables = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const varName = match[1].trim();
            if (!variables.includes(varName)) {
                variables.push(varName);
            }
        }
        return variables;
    }
    /**
     * Get cache statistics (for monitoring)
     */
    getCacheStats() {
        return {
            globalPromptsCount: this.promptCache.size,
            workspaceCachesCount: this.workspacePromptCache.size,
            isInitialized: this.isInitialized,
        };
    }
}
exports.PromptCacheService = PromptCacheService;
// Singleton export
exports.promptCacheService = new PromptCacheService(new database_1.PrismaClient());
//# sourceMappingURL=prompt-cache.service.js.map