/**
 * OpenAI Agents SDK - Runner Service
 * 
 * Main service for running the multi-agent system.
 * Handles conversation flow, context management, and response generation.
 * 
 * @architecture Clean Architecture - Service layer
 * @security ALL operations filtered by workspaceId
 * @critical NO hardcoded data - context from database
 */

import { run, RunResult } from "@openai/agents"
import { PrismaClient } from "@echatbot/database"
import { AgentContext, AgentMetrics } from "./types"
import type { Agent } from "@openai/agents"
import logger from "../../utils/logger"

// Dynamically import createAgentSystem to avoid potential circular dependencies
// eslint-disable-next-line @typescript-eslint/no-require-imports
const agentsModule = require("./agents") as { createAgentSystem: (prisma: any, workspaceId: string) => Promise<{
  triageAgent: Agent
  productAgent: Agent
  cartAgent: Agent
  orderAgent: Agent
  supportAgent: Agent
}> }
const createAgentSystem = agentsModule.createAgentSystem

export interface RunAgentParams {
  workspaceId: string
  customerId: string
  conversationId: string
  message: string
  customerName?: string
  customerLanguage?: string
  customerEmail?: string
  customerPhone?: string
  customerDiscount?: number
  conversationHistory?: Array<{ role: "user" | "assistant" | "system"; content: string }>
  debugMode?: boolean
}

export interface RunAgentResult {
  success: boolean
  response: string
  agentUsed: string
  metrics: AgentMetrics
  handoffs: string[]
  toolCalls: Array<{
    tool: string
    args: any
    result: any
  }>
  error?: string
}

/**
 * Agent Runner Service
 * Manages the lifecycle of agent conversations
 */
export class AgentRunnerService {
  private prisma: PrismaClient
  private agentSystems: Map<string, {
    triageAgent: Agent
    productAgent: Agent
    cartAgent: Agent
    orderAgent: Agent
    supportAgent: Agent
  }> = new Map()

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Get or create agent system for a workspace
   * Caches agent systems per workspace for performance
   */
  private async getAgentSystem(workspaceId: string) {
    if (!this.agentSystems.has(workspaceId)) {
      const system = await createAgentSystem(this.prisma, workspaceId)
      this.agentSystems.set(workspaceId, system)
    }
    return this.agentSystems.get(workspaceId)!
  }

  /**
   * Invalidate agent system cache for a workspace
   * Call this when agent configs are updated
   */
  public invalidateCache(workspaceId: string) {
    this.agentSystems.delete(workspaceId)
    logger.info(`🔄 Agent cache invalidated for workspace: ${workspaceId}`)
  }

  /**
   * Run the agent system with a user message
   */
  async runAgent(params: RunAgentParams): Promise<RunAgentResult> {
    const startTime = Date.now()
    const handoffs: string[] = []
    const toolCalls: Array<{ tool: string; args: any; result: any }> = []
    
    try {
      logger.info(`🚀 [AgentRunner] Starting for message: "${params.message.substring(0, 50)}..."`)

      // Get agent system
      const { triageAgent } = await this.getAgentSystem(params.workspaceId)

      // Build context
      const context: AgentContext = {
        workspaceId: params.workspaceId,
        customerId: params.customerId,
        conversationId: params.conversationId,
        customerName: params.customerName,
        customerLanguage: params.customerLanguage,
        customerEmail: params.customerEmail,
        customerPhone: params.customerPhone,
        customerDiscount: params.customerDiscount,
        prisma: this.prisma,
        conversationHistory: params.conversationHistory,
        debugMode: params.debugMode,
      }

      // Build input with conversation context
      let input = params.message
      if (params.conversationHistory && params.conversationHistory.length > 0) {
        // Include last few messages for context
        const recentHistory = params.conversationHistory.slice(-6)
        const historyText = recentHistory
          .map((m) => `${m.role === "user" ? "Customer" : "Assistant"}: ${m.content}`)
          .join("\n")
        input = `[Conversation history]\n${historyText}\n\n[Current message]\n${params.message}`
      }

      // Add customer context
      const customerContext = [
        params.customerName && `Customer name: ${params.customerName}`,
        params.customerLanguage && `Language: ${params.customerLanguage}`,
        params.customerDiscount && `Customer discount: ${params.customerDiscount}%`,
      ]
        .filter(Boolean)
        .join(", ")

      if (customerContext) {
        input = `[Customer info: ${customerContext}]\n\n${input}`
      }

      // Run the agent
      const result = await run(triageAgent, input, {
        context,
        maxTurns: 10, // Limit to prevent infinite loops
      })

      // Extract metrics and trace
      const executionTimeMs = Date.now() - startTime
      
      // Process run result to extract info
      let lastAgentName = "TriageAgent"
      let totalTokens = 0

      // The result contains the final output
      const response = result.finalOutput || "Mi dispiace, non sono riuscito a elaborare la tua richiesta."

      logger.info(`✅ [AgentRunner] Completed in ${executionTimeMs}ms`, {
        agentUsed: lastAgentName,
        responseLength: response.length,
      })

      return {
        success: true,
        response: typeof response === "string" ? response : JSON.stringify(response),
        agentUsed: lastAgentName,
        metrics: {
          tokensUsed: totalTokens,
          executionTimeMs,
          toolCallsCount: toolCalls.length,
          handoffsCount: handoffs.length,
        },
        handoffs,
        toolCalls,
      }

    } catch (error) {
      const executionTimeMs = Date.now() - startTime
      logger.error(`❌ [AgentRunner] Error:`, error)

      return {
        success: false,
        response: "Mi dispiace, si è verificato un errore. Riprova più tardi.",
        agentUsed: "TriageAgent",
        metrics: {
          tokensUsed: 0,
          executionTimeMs,
          toolCallsCount: 0,
          handoffsCount: 0,
        },
        handoffs: [],
        toolCalls: [],
        error: (error as Error).message,
      }
    }
  }

  /**
   * Save conversation log to database
   */
  async saveConversationLog(
    params: RunAgentParams,
    result: RunAgentResult
  ): Promise<void> {
    try {
      // Save to AgentConversationLog
      await this.prisma.agentConversationLog.create({
        data: {
          workspaceId: params.workspaceId,
          customerId: params.customerId,
          conversationId: params.conversationId,
          messageId: `msg_${Date.now()}`,
          step: 1,
          agentType: result.agentUsed,
          agentAction: "process_message",
          inputMessage: params.message,
          llmResponse: result.response,
          tokensUsed: result.metrics.tokensUsed,
          executionTimeMs: result.metrics.executionTimeMs,
          functionsCalled: result.toolCalls.length > 0 ? result.toolCalls : undefined,
          hasError: !result.success,
          errorMessage: result.error,
        },
      })

      // Save to ConversationMessage for context
      await this.prisma.conversationMessage.createMany({
        data: [
          {
            workspaceId: params.workspaceId,
            customerId: params.customerId,
            conversationId: params.conversationId,
            role: "user",
            content: params.message,
          },
          {
            workspaceId: params.workspaceId,
            customerId: params.customerId,
            conversationId: params.conversationId,
            role: "assistant",
            content: result.response,
            agentType: result.agentUsed,
            tokensUsed: result.metrics.tokensUsed,
          },
        ],
      })

      logger.debug(`📝 Conversation log saved`)
    } catch (error) {
      logger.error(`❌ Failed to save conversation log:`, error)
      // Don't throw - logging failure shouldn't break the flow
    }
  }

  /**
   * Load recent conversation history
   */
  async loadConversationHistory(
    workspaceId: string,
    customerId: string,
    limit: number = 10
  ): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    try {
      const messages = await this.prisma.conversationMessage.findMany({
        where: {
          workspaceId,
          customerId,
          role: { in: ["user", "assistant"] },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          role: true,
          content: true,
        },
      })

      // Reverse to get chronological order
      return messages.reverse().map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
    } catch (error) {
      logger.error(`❌ Failed to load conversation history:`, error)
      return []
    }
  }
}

// Singleton instance
let agentRunnerInstance: AgentRunnerService | null = null

/**
 * Get the singleton AgentRunnerService instance
 */
export function getAgentRunner(prisma: PrismaClient): AgentRunnerService {
  if (!agentRunnerInstance) {
    agentRunnerInstance = new AgentRunnerService(prisma)
  }
  return agentRunnerInstance
}
