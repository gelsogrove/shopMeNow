/**
 * Unified Routing Service
 * Single source of truth for all routing decisions
 * Consolidates logic from ChatEngine, RouterOrchestrationService, and LLMRouter
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import {
  Intent,
  IntentType,
  RoutingPath,
  RoutingContext,
  RoutingDecision,
  LoadedData,
  RoutingWorkspaceConfig,
} from "../../domain/entities/routing.entity"

export class UnifiedRoutingService {
  constructor(
    private prisma: PrismaClient,
    private intentParser?: any, // IntentParserService - inject if available
    private cacheService?: any // CacheService - inject if available
  ) {}

  /**
   * Detect intent from message using pattern -> keyword -> LLM pipeline
   */
  async detectIntent(context: RoutingContext): Promise<Intent> {
    logger.info("[UnifiedRouting] Detecting intent", {
      customerId: context.customerId,
      message: context.message.substring(0, 50),
    })

    try {
      // Try pattern matching first (if intentParser available)
      if (this.intentParser) {
        const patternResult = await this.intentParser.parse({
          message: context.message,
          context: context,
        })

        if (patternResult && patternResult.type) {
          logger.info("[UnifiedRouting] Intent detected via pattern", {
            type: patternResult.type,
            confidence: patternResult.confidence,
          })
          return {
            type: patternResult.type,
            confidence: patternResult.confidence || 0.9,
            source: "PATTERN",
          }
        }
      }

      // Fallback: unknown intent
      logger.info("[UnifiedRouting] Intent not matched, defaulting to INCOMPREHENSIBLE", {
        customerId: context.customerId,
      })
      return {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }
    } catch (error) {
      logger.error("[UnifiedRouting] Error detecting intent", error)
      return {
        type: "INCOMPREHENSIBLE",
        confidence: 0,
        source: "LLM",
      }
    }
  }

  /**
   * Select routing path based on workspace config and intent
   */
  selectRoutingPath(workspace: RoutingWorkspaceConfig, intent: Intent): RoutingPath {
    logger.info("[UnifiedRouting] Selecting routing path", {
      intentType: intent.type,
      workspaceId: workspace.workspaceId,
    })

    // INCOMPREHENSIBLE always goes to LLM
    if (intent.type === "INCOMPREHENSIBLE") {
      logger.info("[UnifiedRouting] Path: LLM (incomprehensible intent)")
      return "LLM"
    }

    // Pattern/keyword matches go to SIMPLE
    const simpleIntents: IntentType[] = [
      "SHOW_PRODUCTS",
      "ADD_TO_CART",
      "REPEAT_ORDER",
      "VIEW_CART",
      "CONTINUE_CHECKOUT",
    ]

    if (simpleIntents.includes(intent.type)) {
      logger.info("[UnifiedRouting] Path: SIMPLE (pattern match)")
      return "SIMPLE"
    }

    // FAQ path if enabled
    if (workspace.enableFAQ && intent.confidence < 0.7) {
      logger.info("[UnifiedRouting] Path: FAQ (low confidence + FAQ enabled)")
      return "FAQ"
    }

    // Default to LLM
    logger.info("[UnifiedRouting] Path: LLM (default)")
    return "LLM"
  }

  /**
   * Load data for intent (products, FAQs, services, offers)
   */
  async loadDataForIntent(
    workspace: RoutingWorkspaceConfig,
    intent: Intent
  ): Promise<LoadedData> {
    logger.info("[UnifiedRouting] Loading data for intent", {
      intentType: intent.type,
      workspaceId: workspace.workspaceId,
    })

    const data: LoadedData = {} as any

    try {
      // Load products if needed
      if (
        workspace.enableProducts &&
        (intent.type === "SHOW_PRODUCTS" || intent.type === "ADD_TO_CART")
      ) {
        logger.info("[UnifiedRouting] Loading products", {
          workspaceId: workspace.workspaceId,
        })
        data.products = await this.prisma.products.findMany({
          where: {
            workspaceId: workspace.workspaceId,
            isActive: true,
          },
          take: 100,
        })
        logger.info("[UnifiedRouting] Loaded products", {
          count: data.products?.length || 0,
        })
      }

      // Load FAQs if needed
      if (workspace.enableFAQ && intent.confidence < 0.7) {
        logger.info("[UnifiedRouting] Loading FAQs", {
          workspaceId: workspace.workspaceId,
        })
        data.faqs = await this.prisma.fAQ.findMany({
          where: {
            workspaceId: workspace.workspaceId,
            isActive: true,
          },
          take: 100,
        })
        logger.info("[UnifiedRouting] Loaded FAQs", {
          count: data.faqs?.length || 0,
        })
      }

      // Load services if needed
      if (workspace.enableServices) {
        logger.info("[UnifiedRouting] Loading services", {
          workspaceId: workspace.workspaceId,
        })
        data.services = await this.prisma.services.findMany({
          where: {
            workspaceId: workspace.workspaceId,
            isActive: true,
          },
          take: 50,
        })
        logger.info("[UnifiedRouting] Loaded services", {
          count: data.services?.length || 0,
        })
      }

      // Load offers if needed
      if (workspace.enableOffers) {
        logger.info("[UnifiedRouting] Loading offers", {
          workspaceId: workspace.workspaceId,
        })
        data.offers = await this.prisma.offers.findMany({
          where: {
            workspaceId: workspace.workspaceId,
            isActive: true,
          },
          take: 20,
        })
        logger.info("[UnifiedRouting] Loaded offers", {
          count: data.offers?.length || 0,
        })
      }
    } catch (error) {
      logger.error("[UnifiedRouting] Error loading data", error)
      // Continue with whatever data was loaded
    }

    return data
  }

  /**
   * Get workspace config with caching
   */
  async getWorkspace(workspaceId: string): Promise<RoutingWorkspaceConfig> {
    // Check cache first if available
    if (this.cacheService) {
      const cached = this.cacheService.get(`workspace:${workspaceId}`)
      if (cached) {
        logger.info("[UnifiedRouting] Workspace from cache", { workspaceId })
        return cached
      }
    }

    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
      })

      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`)
      }

      const config: RoutingWorkspaceConfig = {
        workspaceId: workspace.id,
        enableProducts: true,
        enableFAQ: true,
        enableServices: true,
        enableOffers: true,
        defaultPath: "LLM",
        preferredLanguage: (workspace as any).language || "it",
      }

      // Cache for 5 minutes
      if (this.cacheService) {
        this.cacheService.set(`workspace:${workspaceId}`, config, 5 * 60 * 1000)
      }

      logger.info("[UnifiedRouting] Workspace config loaded and cached", {
        workspaceId,
      })
      return config
    } catch (error) {
      logger.error("[UnifiedRouting] Error loading workspace", error)
      throw error
    }
  }

  /**
   * Log complete routing decision
   */
  logRoutingDecision(decision: RoutingDecision): void {
    logger.info("[UnifiedRouting] Complete routing decision", {
      intentType: decision.intent.type,
      routingPath: decision.path,
      confidence: decision.intent.confidence,
      source: decision.intent.source,
      workspaceId: decision.workspace.workspaceId,
      dataLoaded: decision.dataLoaded,
      timestamp: decision.timestamp.toISOString(),
    })
  }
}
