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

import { AgentType, PrismaClient } from "@echatbot/database"
import { LLMRouterService, RouteMessageParams, RouteMessageResponse } from "../../services/llm-router.service"
import { getOpenAIChatService, OpenAIChatInput } from "../openai-agents"
import logger from "../../utils/logger"

// ============================================================================
// TYPES
// ============================================================================

export type ChatEngineType = "LEGACY" | "OPENAI_SDK"

interface ChatEngineConfig {
  engine: ChatEngineType
  cacheEnabled: boolean
  cacheTTLMs: number
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Unified Chat Router
 * Routes messages to the appropriate chat engine based on workspace config
 */
export class UnifiedChatRouter {
  private prisma: PrismaClient
  private llmRouterService: LLMRouterService
  
  // Config cache per workspace
  private configCache: Map<string, { config: ChatEngineConfig; loadedAt: number }> = new Map()
  private readonly CONFIG_CACHE_TTL_MS = 60 * 1000 // 1 minute

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.llmRouterService = new LLMRouterService(prisma)
  }

  /**
   * Route message to appropriate engine
   * Main entry point - replaces direct LLMRouterService.routeMessage() calls
   */
  async routeMessage(params: RouteMessageParams): Promise<RouteMessageResponse> {
    const engineConfig = await this.getEngineConfig(params.workspaceId)
    
    logger.info(`🔀 [UnifiedRouter] Using engine: ${engineConfig.engine}`, {
      workspaceId: params.workspaceId,
      customerId: params.customerId,
    })

    if (engineConfig.engine === "OPENAI_SDK") {
      return this.routeWithOpenAISDK(params)
    }
    
    // Default: use legacy LLMRouterService
    return this.llmRouterService.routeMessage(params)
  }

  /**
   * Route using OpenAI Agents SDK
   */
  private async routeWithOpenAISDK(params: RouteMessageParams): Promise<RouteMessageResponse> {
    const openAIService = getOpenAIChatService(this.prisma)
    
    const sdkInput: OpenAIChatInput = {
      workspaceId: params.workspaceId,
      customerId: params.customerId,
      conversationId: params.conversationId,
      messageId: params.messageId,
      message: params.message,
      customerLanguage: params.customerLanguage,
      customerName: params.customerName,
      customerDiscount: params.customerDiscount,
      conversationHistory: params.conversationHistory,
    }
    
    const result = await openAIService.processMessage(sdkInput)
    
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
          agent: result.sdkDebugInfo?.finalAgent || "OpenAI-SDK",
          model: "gpt-4o-mini",
          timestamp: new Date().toISOString(),
          output: {
            decision: `Engine: OPENAI_SDK, Handoffs: ${result.sdkDebugInfo?.handoffs || 0}`,
            textResponse: result.response.substring(0, 200),
          },
        }],
        totalTokens: result.tokensUsed,
        totalCost: result.tokensUsed * 0.00001,
        executionTimeMs: result.executionTimeMs,
        timestamp: new Date().toISOString(),
      },
    }
  }

  /**
   * Get engine configuration for workspace from database
   * Uses Workspace.debugMode + env OPENAI_SDK_ENABLED as feature flag
   * Cached for performance
   */
  private async getEngineConfig(workspaceId: string): Promise<ChatEngineConfig> {
    // Check cache
    const cached = this.configCache.get(workspaceId)
    if (cached && Date.now() - cached.loadedAt < this.CONFIG_CACHE_TTL_MS) {
      return cached.config
    }

    // Load from database
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          debugMode: true,
        },
      })

      // Feature flag: debugMode + env variable
      const envEnabled = process.env.OPENAI_SDK_ENABLED === "true"
      const useOpenAISDK = workspace?.debugMode === true && envEnabled

      const engine: ChatEngineType = useOpenAISDK ? "OPENAI_SDK" : "LEGACY"
      const config: ChatEngineConfig = {
        engine,
        cacheEnabled: true,
        cacheTTLMs: 300000, // 5 minutes
      }
      
      // Cache the config
      this.configCache.set(workspaceId, { config, loadedAt: Date.now() })
      
      logger.debug(`📦 [UnifiedRouter] Loaded config for ${workspaceId}: ${engine}`, {
        debugMode: workspace?.debugMode,
        envEnabled,
      })
      return config
    } catch (error) {
      logger.warn(`⚠️ [UnifiedRouter] Failed to load config, using LEGACY`, { error })
      return { engine: "LEGACY", cacheEnabled: true, cacheTTLMs: 300000 }
    }
  }

  /**
   * Clear config cache for a workspace
   * Call when workspace settings are updated
   */
  clearCache(workspaceId?: string): void {
    if (workspaceId) {
      this.configCache.delete(workspaceId)
      // Also clear OpenAI service cache
      getOpenAIChatService(this.prisma).clearCache(workspaceId)
    } else {
      this.configCache.clear()
      getOpenAIChatService(this.prisma).clearAllCaches()
    }
    logger.info(`🗑️ [UnifiedRouter] Cache cleared`)
  }

  /**
   * Force switch engine for a workspace (runtime override)
   * Useful for testing without database changes
   */
  async setEngine(workspaceId: string, engine: ChatEngineType): Promise<void> {
    const config: ChatEngineConfig = { engine, cacheEnabled: true, cacheTTLMs: 300000 }
    this.configCache.set(workspaceId, { config, loadedAt: Date.now() })
    logger.info(`🔧 [UnifiedRouter] Force set engine to ${engine} for ${workspaceId}`)
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let unifiedChatRouterInstance: UnifiedChatRouter | null = null

export function getUnifiedChatRouter(prisma: PrismaClient): UnifiedChatRouter {
  if (!unifiedChatRouterInstance) {
    unifiedChatRouterInstance = new UnifiedChatRouter(prisma)
  }
  return unifiedChatRouterInstance
}
