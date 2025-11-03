/**
 * OrderTrackingAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle order tracking queries with dedicated LLM
 * 2. Execute function calls for order status/history
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from database (agentConfig.ORDER_TRACKING)
 * - Function execution via OrderRepository
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → OrderTrackingAgentLLM
 * 2. Load system prompt from database (agentType: ORDER_TRACKING)
 * 3. Call LLM with order tracking functions
 * 4. Execute functions via OrderRepository
 * 5. Return English response with tokens → Router
 *
 * Security:
 * - ALL queries filtered by workspaceId + customerId
 * - NO translation (Router handles it)
 * - NO direct customer interaction
 *
 * @critical NEVER call LLMService - this is a SPECIALIST with OWN LLM
 */

import { PrismaClient } from "@prisma/client"
import axios from "axios"
import { config } from "../../config"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"
import { OrderRepository } from "../../repositories/order.repository"
import logger from "../../utils/logger"

export interface OrderTrackingLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
}

export interface OrderTrackingLLMResponse {
  success: boolean
  output: string // English response with [LINK_xxx] tokens
  tokensUsed: number
  executionTimeMs: number
  functionCalls: Array<{
    name: string
    arguments: any
    result: any
  }>
}

export class OrderTrackingAgentLLM {
  private prisma: PrismaClient
  private orderRepo: OrderRepository
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.orderRepo = new OrderRepository()
    this.agentConfigRepo = new AgentConfigRepository(prisma)

    // OpenRouter API configuration
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required for OrderTrackingAgentLLM"
      )
    }
  }

  /**
   * Handle order tracking query with LLM
   */
  async handleQuery(
    context: OrderTrackingLLMContext
  ): Promise<OrderTrackingLLMResponse> {
    const startTime = Date.now()

    try {
      logger.info(`📦 OrderTrackingAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query.substring(0, 100),
      })

      // STEP 1: Load system prompt from database
      const agentConfig = await this.agentConfigRepo.findByType(
        context.workspaceId,
        "ORDER_TRACKING"
      )

      if (!agentConfig || !agentConfig.isActive) {
        throw new Error(
          "OrderTrackingAgent configuration not found or inactive"
        )
      }

      logger.info(`📋 Loaded ORDER_TRACKING prompt from database`, {
        promptLength: agentConfig.systemPrompt.length,
        model: agentConfig.model,
      })

      // STEP 2: Build messages for LLM
      const messages: any[] = [
        {
          role: "system" as const,
          content: agentConfig.systemPrompt,
        },
        {
          role: "user" as const,
          content: context.query,
        },
      ]

      // STEP 3: Define function calls for order tracking
      const functions = this.getOrderTrackingFunctions()

      // STEP 4: Call LLM (OpenRouter)
      const llmResponse = await this.callLLM({
        model: agentConfig.model,
        messages,
        functions,
        temperature: agentConfig.temperature,
        maxTokens: agentConfig.maxTokens || 2000,
      })

      let totalTokens = llmResponse.tokensUsed
      let finalResponse = llmResponse.content || ""
      const functionCalls: any[] = []

      // STEP 5: Handle function calling loop
      if (llmResponse.function_call) {
        const functionName = llmResponse.function_call.name
        const functionArgs = JSON.parse(
          llmResponse.function_call.arguments || "{}"
        )

        logger.info(`⚙️ OrderTrackingAgentLLM: Function call requested`, {
          functionName,
          args: functionArgs,
        })

        // Execute function via OrderRepository
        const functionResult = await this.executeFunction(
          functionName,
          functionArgs,
          context
        )

        functionCalls.push({
          name: functionName,
          arguments: functionArgs,
          result: functionResult,
        })

        // STEP 6: Return function result to LLM for final response
        messages.push({
          role: "assistant" as const,
          content: null as any,
          function_call: llmResponse.function_call,
        })
        messages.push({
          role: "function" as const,
          name: functionName,
          content: JSON.stringify(functionResult),
        })

        const finalLLMResponse = await this.callLLM({
          model: agentConfig.model,
          messages,
          functions,
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.maxTokens || 2000,
        })

        totalTokens += finalLLMResponse.tokensUsed
        finalResponse = finalLLMResponse.content || ""
      }

      const executionTimeMs = Date.now() - startTime

      logger.info(`✅ OrderTrackingAgentLLM: Query processed`, {
        executionTimeMs,
        tokensUsed: totalTokens,
        responseLength: finalResponse.length,
        functionCallsCount: functionCalls.length,
      })

      return {
        success: true,
        output: finalResponse,
        tokensUsed: totalTokens,
        executionTimeMs,
        functionCalls,
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime

      logger.error("❌ OrderTrackingAgentLLM error:", error)

      return {
        success: false,
        output:
          "I encountered an error while checking your orders. Please try again.",
        tokensUsed: 0,
        executionTimeMs,
        functionCalls: [],
      }
    }
  }

  /**
   * Call OpenRouter API with function calling
   */
  private async callLLM(options: {
    model: string
    messages: any[]
    functions: any[]
    temperature: number
    maxTokens: number
  }): Promise<{
    content: string | null
    function_call?: any
    tokensUsed: number
  }> {
    try {
      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: options.model,
          messages: options.messages,
          functions: options.functions,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": config.appUrl,
            "X-Title": "ShopME - Order Tracking Agent",
          },
        }
      )

      const choice = response.data.choices?.[0]
      const message = choice?.message

      return {
        content: message?.content || null,
        function_call: message?.function_call,
        tokensUsed: response.data.usage?.total_tokens || 0,
      }
    } catch (error) {
      logger.error("❌ OpenRouter API call failed:", error)
      throw error
    }
  }

  /**
   * Execute function call via OrderRepository
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: OrderTrackingLLMContext
  ): Promise<any> {
    try {
      switch (functionName) {
        case "getOrderHistory":
          return await this.orderRepo.findByCustomerId(
            context.workspaceId,
            context.customerId
          )

        case "getOrderDetails":
          return await this.orderRepo.findByOrderCode(
            context.workspaceId,
            args.orderCode
          )

        case "trackOrderStatus":
          const order = await this.orderRepo.findByOrderCode(
            context.workspaceId,
            args.orderCode
          )
          return {
            success: !!order,
            order: order || null,
            status: order?.status || "NOT_FOUND",
          }

        default:
          logger.warn(`Unknown function: ${functionName}`)
          return {
            success: false,
            error: `Unknown function: ${functionName}`,
          }
      }
    } catch (error) {
      logger.error(`Error executing function ${functionName}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Get function definitions for order tracking
   */
  private getOrderTrackingFunctions() {
    return [
      {
        name: "getOrderHistory",
        description:
          "Get customer's order history with most recent orders first",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of orders to return (default: 10)",
            },
          },
          required: [],
        },
      },
      {
        name: "getOrderDetails",
        description:
          "Get detailed information about a specific order by order code",
        parameters: {
          type: "object",
          properties: {
            orderCode: {
              type: "string",
              description: "Order code (e.g., 'ORD-2024-001')",
            },
          },
          required: ["orderCode"],
        },
      },
      {
        name: "trackOrderStatus",
        description: "Track the current status of an order",
        parameters: {
          type: "object",
          properties: {
            orderCode: {
              type: "string",
              description: "Order code to track",
            },
          },
          required: ["orderCode"],
        },
      },
    ]
  }
}
