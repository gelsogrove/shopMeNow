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
import { CallingFunctionsService } from "../../services/calling-functions.service"
import logger from "../../utils/logger"
import { LinkGeneratorService } from "../services/link-generator.service"

export interface OrderTrackingLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  lastOrderCode?: string // ✅ Last order code (avoid extra query)
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
  systemPrompt?: string // 🆕 Processed system prompt for debugging
}

export class OrderTrackingAgentLLM {
  private prisma: PrismaClient
  private orderRepo: OrderRepository
  private agentConfigRepo: AgentConfigRepository
  private callingFunctionsService: CallingFunctionsService
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.orderRepo = new OrderRepository()
    this.agentConfigRepo = new AgentConfigRepository(prisma)

    // Initialize CallingFunctionsService with LinkGeneratorService
    const linkGeneratorService = new LinkGeneratorService()
    this.callingFunctionsService = new CallingFunctionsService(
      linkGeneratorService
    )

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

      // Replace variables in system prompt
      let systemPrompt = agentConfig.systemPrompt
      if (context.lastOrderCode) {
        systemPrompt = systemPrompt.replace(
          /\{\{lastordercode\}\}/g,
          context.lastOrderCode
        )
        logger.info(
          `✅ Replaced {{lastordercode}} with: ${context.lastOrderCode}`
        )
      }

      // STEP 2: Build messages for LLM
      const messages: any[] = [
        {
          role: "system" as const,
          content: systemPrompt, // ✅ Use prompt with replaced variables
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

        // 🚨 CRITICAL SECURITY CHECK: SubLLM CANNOT call other SubLLMs!
        // Only Router can delegate to SubAgents
        const forbiddenFunctions = [
          "cartManagementAgent",
          "productSearchAgent",
          "orderTrackingAgent",
          "customerSupportAgent",
          "safetyTranslationAgent",
        ]

        if (forbiddenFunctions.includes(functionName)) {
          logger.error(
            `🚨 SECURITY VIOLATION: OrderTrackingAgentLLM tried to call another SubLLM!`,
            {
              attemptedFunction: functionName,
              args: functionArgs,
            }
          )
          throw new Error(
            `INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`
          )
        }

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
        systemPrompt, // 🆕 Include processed prompt for debugging
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime

      // Extract only relevant error info (avoid circular references)
      const errorInfo = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        // Axios specific error fields
        ...(error && typeof error === "object" && "response" in error
          ? {
              status: (error as any).response?.status,
              statusText: (error as any).response?.statusText,
              data: (error as any).response?.data,
            }
          : {}),
      }

      logger.error("❌ OrderTrackingAgentLLM error:", errorInfo)

      return {
        success: false,
        output: "Error processing order tracking request",
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
      // Convert functions to tools format (OpenRouter new API)
      const tools = options.functions.map((fn) => ({
        type: "function",
        function: fn,
      }))

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: options.model,
          messages: options.messages,
          tools, // ✅ Use tools instead of functions
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
        function_call: message?.tool_calls?.[0]?.function, // ✅ Parse from tool_calls
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

        case "getLastOrders":
          // Get last N orders with summary details
          const limit = args.limit || 3
          const allOrders = await this.orderRepo.findByCustomerId(
            context.customerId, // ✅ customerId first
            context.workspaceId // ✅ workspaceId second
          )

          // Return only the first N orders (already sorted by date DESC)
          const limitedOrders = allOrders.slice(0, Math.min(limit, 10))

          return limitedOrders.map((order: any) => ({
            orderCode: order.orderCode,
            createdAt: order.createdAt,
            totalPrice: order.totalPrice,
            status: order.status,
            itemCount: order.items?.length || 0,
          }))

        case "getOrderDetails":
          // If orderCode provided, get specific order
          let order = null
          if (args.orderCode) {
            order = await this.orderRepo.findByOrderCode(
              args.orderCode, // ✅ orderCode first
              context.workspaceId // ✅ workspaceId second
            )
          } else {
            // If no orderCode, get last order
            const orders = await this.orderRepo.findByCustomerId(
              context.customerId, // ✅ customerId first
              context.workspaceId // ✅ workspaceId second
            )
            order = orders && orders.length > 0 ? orders[0] : null
          }

          if (!order) {
            return null
          }

          // Generate secure link with token
          const linkResult =
            await this.callingFunctionsService.getOrdersListLink({
              customerId: context.customerId,
              workspaceId: context.workspaceId,
              orderCode: order.orderCode, // ✅ Pass orderCode to generate specific order link
            })

          // Return order data + link
          return {
            ...order,
            secureLink: linkResult.linkUrl || null,
            linkToken: linkResult.token || null,
            linkExpiresAt: linkResult.expiresAt || null,
          }

        case "trackOrderStatus":
          const trackedOrder = await this.orderRepo.findByOrderCode(
            args.orderCode, // ✅ orderCode first
            context.workspaceId // ✅ workspaceId second
          )
          return {
            success: !!trackedOrder,
            order: trackedOrder || null,
            status: trackedOrder?.status || "NOT_FOUND",
          }

        case "repeatOrder":
          // Call RepeatOrder domain function directly
          const {
            RepeatOrder,
          } = require("../../domain/calling-functions/RepeatOrder")
          return await RepeatOrder({
            customerId: context.customerId,
            workspaceId: context.workspaceId,
            orderCode: args.orderCode, // Optional - uses last order if not provided
          })

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
        name: "getLastOrders",
        description:
          "Get last N orders with summary details (orderCode, date, total, status). Use this when customer asks for 'recent orders' or 'last orders'.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of orders to return (default: 3, max: 10)",
            },
          },
          required: [],
        },
      },
      {
        name: "getOrderDetails",
        description:
          "Get detailed information about a specific order by order code, or get last order if no code provided",
        parameters: {
          type: "object",
          properties: {
            orderCode: {
              type: "string",
              description:
                "Order code (e.g., 'ORD-2024-001'). Optional: if empty, returns last order",
            },
          },
          required: [],
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
      {
        name: "repeatOrder",
        description:
          "Repeat the customer's last delivered order by adding all items to cart. Use after customer confirms they want to repeat their last order. Returns checkout link with step=2 parameter.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ]
  }
}
