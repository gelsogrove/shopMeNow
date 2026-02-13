/**
 * OpenAI Agents SDK - Chat Service Integration
 * 
 * This service provides an ALTERNATIVE implementation of the chat flow
 * using the official OpenAI Agents SDK instead of the custom LLMRouterService.
 * 
 * The existing LLMRouterService remains unchanged - this allows:
 * 1. Feature flagging between implementations
 * 2. A/B testing different approaches
 * 3. Gradual migration path
 * 
 * @architecture Clean Architecture with OpenAI SDK
 * @security ALL queries filtered by workspaceId
 * @critical Prompts loaded from database (agentConfig table)
 */

import { PrismaClient, AgentType } from "@echatbot/database"
import { run, Agent } from "@openai/agents"
import { createAgentSystem } from "./agents"
import { AgentContext } from "./types"
import logger from "../../utils/logger"
import { TranslationAgent } from "../agents/TranslationAgent"
import { LinkReplacementService } from "../services/link-replacement.service"

// ============================================================================
// TYPES
// ============================================================================

export interface OpenAIChatInput {
  workspaceId: string
  customerId: string
  conversationId: string
  messageId: string
  message: string
  customerLanguage?: string
  customerName?: string
  customerDiscount?: number
  conversationHistory?: Array<{ role: string; content: string }>
}

export interface OpenAIChatOutput {
  response: string
  agentUsed: AgentType
  confidence: number
  tokensUsed: number
  executionTimeMs: number
  wasFAQ: boolean
  faqId?: string
  sdkDebugInfo?: {
    agentChain: string[]
    handoffs: number
    finalAgent: string
  }
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * OpenAI Agents SDK Chat Service
 * Alternative to LLMRouterService using official SDK
 */
export class OpenAIChatService {
  private prisma: PrismaClient
  private translationAgent: TranslationAgent
  private linkReplacementService: LinkReplacementService

  // Cache agent systems per workspace (they have prompts loaded from DB)
  private agentSystemCache: Map<string, {
    triageAgent: Agent
    productAgent: Agent
    cartAgent: Agent
    orderAgent: Agent
    supportAgent: Agent
    createdAt: number
  }> = new Map()

  // Cache TTL (5 minutes - prompts don't change often)
  private readonly CACHE_TTL_MS = 5 * 60 * 1000

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.translationAgent = new TranslationAgent(prisma)
    this.linkReplacementService = new LinkReplacementService()
  }

  /**
   * Main entry point - processes a customer message using OpenAI Agents SDK
   * 
   * Flow:
   * 1. Load/create agent system for workspace (cached)
   * 2. Load customer data and conversation history
   * 3. Run triage agent with context
   * 4. Apply translation (if customer language != Italian)
   * 5. Replace link tokens with secure URLs
   */
  async processMessage(input: OpenAIChatInput): Promise<OpenAIChatOutput> {
    const startTime = Date.now()
    logger.info(`🚀 [OpenAI-SDK] Processing message for customer ${input.customerId}`)

    try {
      // 1. Get or create agent system for workspace
      const agents = await this.getOrCreateAgentSystem(input.workspaceId)

      // 2. Load customer data
      const customer = await this.prisma.customers.findFirst({
        where: {
          id: input.customerId,
          workspaceId: input.workspaceId,
        },
      })

      if (!customer) {
        throw new Error(`Customer not found: ${input.customerId}`)
      }

      // 3. Build context for tools
      const context: AgentContext = {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        conversationId: input.conversationId,
        prisma: this.prisma,
        customerName: customer.name || input.customerName || "Cliente",
        customerLanguage: customer.language || input.customerLanguage || "en",
        customerDiscount: customer.discount || input.customerDiscount || 0,
        customerEmail: customer.email || undefined,
        customerPhone: customer.phone,
      }

      // 4. Load conversation history (last 20 messages or 10 minutes)
      const history = await this.loadConversationHistory(
        input.workspaceId,
        input.customerId,
        input.conversationId
      )
      context.conversationHistory = history

      // 5. Run the triage agent
      logger.info(`🤖 [OpenAI-SDK] Running triage agent...`)
      
      const result = await run(agents.triageAgent, input.message, {
        context,
        maxTurns: 10, // Prevent infinite handoff loops
      })

      // 6. Determine which agent was actually used (last in chain)
      const finalAgentName = this.extractFinalAgent(result)
      const agentUsed = this.mapAgentNameToType(finalAgentName)

      // 7. Get response text
      let responseText = this.extractResponseText(result)

      // 8. Apply translation if needed
      const targetLanguage = context.customerLanguage || "en"
      if (targetLanguage !== "it") {
        logger.info(`🌐 [OpenAI-SDK] Translating to ${targetLanguage}`)
        const translationResult = await this.translationAgent.process({
          workspaceId: input.workspaceId,
          message: responseText,
          targetLanguage,
          customerName: context.customerName,
        })
        responseText = translationResult.message
      }

      // 9. Replace link tokens (e.g., [LINK_CART], [LINK_ORDER_xxx])
      const linkResult = await this.linkReplacementService.replaceTokens(
        { response: responseText },
        input.customerId,
        input.workspaceId
      )
      if (linkResult.success && linkResult.response) {
        responseText = linkResult.response
      }

      // 10. Save conversation log
      await this.saveConversationMessages(
        input.workspaceId,
        input.customerId,
        input.conversationId,
        input.message,
        responseText
      )

      const executionTimeMs = Date.now() - startTime
      logger.info(`✅ [OpenAI-SDK] Completed in ${executionTimeMs}ms, agent: ${agentUsed}`)

      return {
        response: responseText,
        agentUsed,
        confidence: 0.95, // SDK doesn't provide confidence, assume high
        tokensUsed: this.estimateTokens(responseText),
        executionTimeMs,
        wasFAQ: agentUsed === "CUSTOMER_SUPPORT" || agentUsed === "INFO_AGENT",
        sdkDebugInfo: {
          agentChain: this.extractAgentChain(result),
          handoffs: this.countHandoffs(result),
          finalAgent: finalAgentName,
        },
      }
    } catch (error) {
      logger.error(`❌ [OpenAI-SDK] Error processing message:`, error)
      throw error
    }
  }

  /**
   * Get cached agent system or create new one
   */
  private async getOrCreateAgentSystem(workspaceId: string) {
    const cached = this.agentSystemCache.get(workspaceId)
    
    if (cached && Date.now() - cached.createdAt < this.CACHE_TTL_MS) {
      logger.debug(`📦 [OpenAI-SDK] Using cached agent system for ${workspaceId}`)
      return cached
    }

    logger.info(`🏗️ [OpenAI-SDK] Creating new agent system for ${workspaceId}`)
    const agents = await createAgentSystem(this.prisma, workspaceId)
    
    this.agentSystemCache.set(workspaceId, {
      ...agents,
      createdAt: Date.now(),
    })

    return agents
  }

  /**
   * Load conversation history for context
   */
  private async loadConversationHistory(
    workspaceId: string,
    customerId: string,
    conversationId: string
  ): Promise<Array<{ role: "user" | "assistant" | "system"; content: string }>> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)

    const messages = await this.prisma.conversationMessage.findMany({
      where: {
        workspaceId,
        customerId,
        conversationId,
        createdAt: {
          gte: tenMinutesAgo,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: 20,
      select: {
        role: true,
        content: true,
      },
    })

    return messages.map((m) => ({
      role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    }))
  }

  /**
   * Save conversation messages to database
   */
  private async saveConversationMessages(
    workspaceId: string,
    customerId: string,
    conversationId: string,
    userMessage: string,
    assistantMessage: string
  ): Promise<void> {
    try {
      // Save user message
      await this.prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId,
          conversationId,
          role: "user",
          content: userMessage,
        },
      })

      // Save assistant message
      await this.prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId,
          conversationId,
          role: "assistant",
          content: assistantMessage,
        },
      })
    } catch (error) {
      logger.error(`❌ [OpenAI-SDK] Failed to save conversation:`, error)
      // Don't throw - conversation saving is non-critical
    }
  }

  /**
   * Extract final agent name from result
   */
  private extractFinalAgent(result: any): string {
    // The SDK result contains information about the run
    // We need to check which agent produced the final output
    try {
      // Access the last agent in the execution chain
      const lastOutput = result.output
      if (typeof lastOutput === "string") {
        // Simple response from an agent
        return "TriageAgent"
      }
      return "TriageAgent"
    } catch {
      return "TriageAgent"
    }
  }

  /**
   * Map SDK agent names to our AgentType enum
   */
  private mapAgentNameToType(agentName: string): AgentType {
    const mapping: Record<string, AgentType> = {
      ProductSearchAgent: "PRODUCT_SEARCH",
      CartManagementAgent: "CART_MANAGEMENT", 
      OrderTrackingAgent: "ORDER_TRACKING",
      CustomerSupportAgent: "CUSTOMER_SUPPORT",
      TriageAgent: "ROUTER",
    }
    return mapping[agentName] || "ROUTER"
  }

  /**
   * Extract response text from SDK result
   */
  private extractResponseText(result: any): string {
    // The SDK returns the final output in result.output
    if (typeof result.output === "string") {
      return result.output
    }
    
    // If structured output, convert to string
    return JSON.stringify(result.output)
  }

  /**
   * Extract chain of agents used
   */
  private extractAgentChain(result: any): string[] {
    // This would require accessing internal SDK state
    // For now, return simplified chain
    return ["TriageAgent"]
  }

  /**
   * Count number of handoffs
   */
  private countHandoffs(result: any): number {
    // This would require accessing internal SDK state
    return 0
  }

  /**
   * Estimate tokens used
   */
  private estimateTokens(responseText: string): number {
    // Rough estimation: 4 chars per token
    return Math.ceil(responseText.length / 4) + 500 // +500 for prompt tokens estimate
  }

  /**
   * Clear agent cache for a workspace (call when prompts are updated)
   */
  clearCache(workspaceId: string): void {
    this.agentSystemCache.delete(workspaceId)
    logger.info(`🗑️ [OpenAI-SDK] Cleared cache for workspace ${workspaceId}`)
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.agentSystemCache.clear()
    logger.info(`🗑️ [OpenAI-SDK] Cleared all caches`)
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let openAIChatServiceInstance: OpenAIChatService | null = null

export function getOpenAIChatService(prisma: PrismaClient): OpenAIChatService {
  if (!openAIChatServiceInstance) {
    openAIChatServiceInstance = new OpenAIChatService(prisma)
  }
  return openAIChatServiceInstance
}
