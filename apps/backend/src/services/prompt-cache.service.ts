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

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

export interface CachedPrompt {
  agentType: string
  content: string
  version: number
  lastUpdated: Date
  variables: string[] // {{variableName}} found in prompt
}

/**
 * PromptCacheService - manages caching of LLM prompts
 * Loads from database once at startup, serves from memory at runtime
 */
export class PromptCacheService {
  private promptCache: Map<string, CachedPrompt> = new Map()
  private workspacePromptCache: Map<string, Map<string, CachedPrompt>> = new Map() // workspace-specific overrides
  private isInitialized = false
  private refreshIntervalMs = 5 * 60 * 1000 // Refresh every 5 minutes in background

  private refreshInterval: NodeJS.Timeout | null = null

  constructor(private prisma: PrismaClient) {}

  /**
   * Load all prompts at module initialization
   */
  async onModuleInit() {
    try {
      logger.info("🚀 PromptCacheService initializing...")

      // Load global prompts from agentConfig
      await this.loadGlobalPrompts()

      this.isInitialized = true
      logger.info(`✅ PromptCacheService ready with ${this.promptCache.size} global prompts cached`)

      // Start background refresh
      this.startBackgroundRefresh()
    } catch (error) {
      logger.error("❌ Failed to initialize PromptCacheService", error)
      throw error
    }
  }

  /**
   * Cleanup on module destroy
   */
  onModuleDestroy() {
    if (this.refreshInterval) {
      clearTimeout(this.refreshInterval)
      this.refreshInterval = null
    }
    this.promptCache.clear()
    this.workspacePromptCache.clear()
    logger.info("🧹 PromptCacheService cleanup complete")
  }

  /**
   * Load all global prompts from database
   */
  private async loadGlobalPrompts(): Promise<void> {
    try {
      const configs = await this.prisma.agentConfig.findMany({
        where: {
          workspaceId: null, // Global configs (no workspace override)
        },
        select: {
          type: true, // Use 'type' field (AgentType) instead of 'agentType'
          systemPrompt: true, // Use 'systemPrompt' instead of 'promptContent'
          id: true,
          updatedAt: true,
        },
      })

      for (const config of configs) {
        const variables = this.extractVariables(config.systemPrompt)
        this.promptCache.set(config.type, {
          agentType: config.type,
          content: config.systemPrompt,
          version: 1,
          lastUpdated: config.updatedAt,
          variables,
        })
      }

      logger.info(`📦 Loaded ${configs.length} global prompts`, {
        agents: Array.from(this.promptCache.keys()),
      })
    } catch (error) {
      logger.error("Failed to load global prompts", error)
      throw error
    }
  }

  /**
   * Load workspace-specific prompt overrides
   */
  private async loadWorkspacePrompts(workspaceId: string): Promise<void> {
    try {
      if (this.workspacePromptCache.has(workspaceId)) {
        return // Already loaded
      }

      const configs = await this.prisma.agentConfig.findMany({
        where: {
          workspaceId,
        },
        select: {
          type: true,
          systemPrompt: true,
          id: true,
          updatedAt: true,
        },
      })

      const wsCache = new Map<string, CachedPrompt>()
      for (const config of configs) {
        const variables = this.extractVariables(config.systemPrompt)
        wsCache.set(config.type, {
          agentType: config.type,
          content: config.systemPrompt,
          version: 1,
          lastUpdated: config.updatedAt,
          variables,
        })
      }

      this.workspacePromptCache.set(workspaceId, wsCache)
      logger.info(`📦 Loaded ${configs.length} workspace-specific prompts`, {
        workspaceId,
        agents: Array.from(wsCache.keys()),
      })
    } catch (error) {
      logger.error("Failed to load workspace prompts", { workspaceId, error })
    }
  }

  /**
   * Get prompt for agent (checks workspace override first, then global)
   */
  async getPrompt(agentType: string, workspaceId?: string): Promise<string | null> {
    // Load workspace cache if needed
    if (workspaceId) {
      await this.loadWorkspacePrompts(workspaceId)

      // Check workspace override first
      const wsCache = this.workspacePromptCache.get(workspaceId)
      if (wsCache?.has(agentType)) {
        const cached = wsCache.get(agentType)!
        logger.debug(`💾 [CACHE-HIT] Workspace prompt for ${agentType}`, {
          workspaceId,
          version: cached.version,
        })
        return cached.content
      }
    }

    // Check global cache
    const cached = this.promptCache.get(agentType)
    if (cached) {
      logger.debug(`💾 [CACHE-HIT] Global prompt for ${agentType}`, {
        version: cached.version,
      })
      return cached.content
    }

    logger.warn(`⚠️ [CACHE-MISS] No prompt found for agent ${agentType}`)
    return null
  }

  /**
   * Get cached prompt metadata (version, lastUpdated, variables)
   */
  getPromptMetadata(agentType: string, workspaceId?: string): CachedPrompt | null {
    if (workspaceId) {
      const wsCache = this.workspacePromptCache.get(workspaceId)
      if (wsCache?.has(agentType)) {
        return wsCache.get(agentType) || null
      }
    }

    return this.promptCache.get(agentType) || null
  }

  /**
   * Invalidate cache for specific workspace (e.g., after config update)
   */
  async invalidateWorkspaceCache(workspaceId: string): Promise<void> {
    this.workspacePromptCache.delete(workspaceId)
    logger.info(`🔄 Invalidated prompt cache for workspace ${workspaceId}`)
  }

  /**
   * Invalidate all caches
   */
  async invalidateAllCaches(): Promise<void> {
    this.promptCache.clear()
    this.workspacePromptCache.clear()
    await this.loadGlobalPrompts()
    logger.info("🔄 Invalidated all prompt caches and reloaded global prompts")
  }

  /**
   * Background refresh: reload prompts periodically
   */
  private startBackgroundRefresh(): void {
    this.refreshInterval = setTimeout(async () => {
      try {
        logger.debug("🔄 Background prompt cache refresh...")
        await this.loadGlobalPrompts()
        // Note: workspace caches are loaded on-demand
      } catch (error) {
        logger.error("❌ Background refresh failed", error)
      }
      // Restart timer
      this.startBackgroundRefresh()
    }, this.refreshIntervalMs)
  }

  /**
   * Extract {{variable}} names from prompt content
   */
  private extractVariables(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g
    const variables: string[] = []
    let match

    while ((match = regex.exec(content)) !== null) {
      const varName = match[1].trim()
      if (!variables.includes(varName)) {
        variables.push(varName)
      }
    }

    return variables
  }

  /**
   * Get cache statistics (for monitoring)
   */
  getCacheStats(): {
    globalPromptsCount: number
    workspaceCachesCount: number
    isInitialized: boolean
  } {
    return {
      globalPromptsCount: this.promptCache.size,
      workspaceCachesCount: this.workspacePromptCache.size,
      isInitialized: this.isInitialized,
    }
  }
}

// Singleton export
export const promptCacheService = new PromptCacheService(new PrismaClient())
