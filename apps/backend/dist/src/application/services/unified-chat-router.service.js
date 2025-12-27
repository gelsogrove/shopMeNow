"use strict";
/**
 * Unified Chat Router Service
 *
 * This service wraps the chat routing logic and decides which engine to use
 * based on workspace configuration from the database.
 *
 * Engine selection is based on:
 * 1. Workspace.debugMode = true AND env OPENAI_SDK_ENABLED = "true" → OpenAI SDK
 * 2. Otherwise → LLMRouterService (legacy)
 *
 * @architecture Clean Architecture - Application Service Layer
 * @security ALL queries filtered by workspaceId
 * @critical NO hardcoded values - everything from database/env
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
exports.UnifiedChatRouter = void 0;
exports.getUnifiedChatRouter = getUnifiedChatRouter;
const llm_router_service_1 = require("../../services/llm-router.service");
const openai_agents_1 = require("../openai-agents");
const logger_1 = __importDefault(require("../../utils/logger"));
// ============================================================================
// SERVICE
// ============================================================================
/**
 * Unified Chat Router
 * Routes messages to the appropriate chat engine based on workspace config
 */
class UnifiedChatRouter {
    constructor(prisma) {
        // Config cache per workspace
        this.configCache = new Map();
        this.CONFIG_CACHE_TTL_MS = 60 * 1000; // 1 minute
        this.prisma = prisma;
        this.llmRouterService = new llm_router_service_1.LLMRouterService(prisma);
    }
    /**
     * Route message to appropriate engine
     * Main entry point - replaces direct LLMRouterService.routeMessage() calls
     */
    routeMessage(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const engineConfig = yield this.getEngineConfig(params.workspaceId);
            logger_1.default.info(`🔀 [UnifiedRouter] Using engine: ${engineConfig.engine}`, {
                workspaceId: params.workspaceId,
                customerId: params.customerId,
            });
            if (engineConfig.engine === "OPENAI_SDK") {
                return this.routeWithOpenAISDK(params);
            }
            // Default: use legacy LLMRouterService
            return this.llmRouterService.routeMessage(params);
        });
    }
    /**
     * Route using OpenAI Agents SDK
     */
    routeWithOpenAISDK(params) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const openAIService = (0, openai_agents_1.getOpenAIChatService)(this.prisma);
            const sdkInput = {
                workspaceId: params.workspaceId,
                customerId: params.customerId,
                conversationId: params.conversationId,
                messageId: params.messageId,
                message: params.message,
                customerLanguage: params.customerLanguage,
                customerName: params.customerName,
                customerDiscount: params.customerDiscount,
                conversationHistory: params.conversationHistory,
            };
            const result = yield openAIService.processMessage(sdkInput);
            // Convert to RouteMessageResponse format
            return {
                response: result.response,
                agentUsed: result.agentUsed,
                confidence: result.confidence,
                tokensUsed: result.tokensUsed,
                executionTimeMs: result.executionTimeMs,
                wasFAQ: result.wasFAQ,
                faqId: result.faqId,
                debugInfo: {
                    steps: [{
                            type: "sub_agent",
                            agent: ((_a = result.sdkDebugInfo) === null || _a === void 0 ? void 0 : _a.finalAgent) || "OpenAI-SDK",
                            model: "gpt-4o-mini",
                            timestamp: new Date().toISOString(),
                            output: {
                                decision: `Engine: OPENAI_SDK, Handoffs: ${((_b = result.sdkDebugInfo) === null || _b === void 0 ? void 0 : _b.handoffs) || 0}`,
                                textResponse: result.response.substring(0, 200),
                            },
                        }],
                    totalTokens: result.tokensUsed,
                    totalCost: result.tokensUsed * 0.00001,
                    executionTimeMs: result.executionTimeMs,
                    timestamp: new Date().toISOString(),
                },
            };
        });
    }
    /**
     * Get engine configuration for workspace from database
     * Uses Workspace.debugMode + env OPENAI_SDK_ENABLED as feature flag
     * Cached for performance
     */
    getEngineConfig(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check cache
            const cached = this.configCache.get(workspaceId);
            if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL_MS) {
                return cached.config;
            }
            // Load from database
            try {
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: workspaceId },
                    select: {
                        debugMode: true,
                    },
                });
                // Feature flag: debugMode + env variable
                const envEnabled = process.env.OPENAI_SDK_ENABLED === "true";
                const useOpenAISDK = (workspace === null || workspace === void 0 ? void 0 : workspace.debugMode) === true && envEnabled;
                const engine = useOpenAISDK ? "OPENAI_SDK" : "LEGACY";
                const config = {
                    engine,
                    cacheEnabled: true,
                    cacheTTLMs: 300000, // 5 minutes
                };
                // Cache the config
                this.configCache.set(workspaceId, { config, loadedAt: Date.now() });
                logger_1.default.debug(`📦 [UnifiedRouter] Loaded config for ${workspaceId}: ${engine}`, {
                    debugMode: workspace === null || workspace === void 0 ? void 0 : workspace.debugMode,
                    envEnabled,
                });
                return config;
            }
            catch (error) {
                logger_1.default.warn(`⚠️ [UnifiedRouter] Failed to load config, using LEGACY`, { error });
                return { engine: "LEGACY", cacheEnabled: true, cacheTTLMs: 300000 };
            }
        });
    }
    /**
     * Clear config cache for a workspace
     * Call when workspace settings are updated
     */
    clearCache(workspaceId) {
        if (workspaceId) {
            this.configCache.delete(workspaceId);
            // Also clear OpenAI service cache
            (0, openai_agents_1.getOpenAIChatService)(this.prisma).clearCache(workspaceId);
        }
        else {
            this.configCache.clear();
            (0, openai_agents_1.getOpenAIChatService)(this.prisma).clearAllCaches();
        }
        logger_1.default.info(`🗑️ [UnifiedRouter] Cache cleared`);
    }
    /**
     * Force switch engine for a workspace (runtime override)
     * Useful for testing without database changes
     */
    setEngine(workspaceId, engine) {
        return __awaiter(this, void 0, void 0, function* () {
            const config = { engine, cacheEnabled: true, cacheTTLMs: 300000 };
            this.configCache.set(workspaceId, { config, loadedAt: Date.now() });
            logger_1.default.info(`🔧 [UnifiedRouter] Force set engine to ${engine} for ${workspaceId}`);
        });
    }
}
exports.UnifiedChatRouter = UnifiedChatRouter;
// ============================================================================
// SINGLETON
// ============================================================================
let unifiedChatRouterInstance = null;
function getUnifiedChatRouter(prisma) {
    if (!unifiedChatRouterInstance) {
        unifiedChatRouterInstance = new UnifiedChatRouter(prisma);
    }
    return unifiedChatRouterInstance;
}
//# sourceMappingURL=unified-chat-router.service.js.map