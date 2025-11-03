/**
 * CartManagementAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle cart operations with dedicated LLM
 * 2. Execute function calls for cart management
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from database (agentConfig.CART_MANAGEMENT)
 * - Function execution via CartManagementAgent
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → CartManagementAgentLLM
 * 2. Load system prompt from database (agentType: CART_MANAGEMENT)
 * 3. Call LLM with cart management functions
 * 4. Execute functions via CartManagementAgent
 * 5. Return English response with tokens → Router
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - NO translation (Router handles it)
 * - NO direct customer interaction
 *
 * @critical NEVER call LLMService - this is a SPECIALIST with OWN LLM
 */

import { PrismaClient } from "@prisma/client"
import axios from "axios"
import { config } from "../../config"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"
import { CartRepository } from "../../repositories/cart.repository"
import { OrderRepository } from "../../repositories/order.repository"
import { ProductRepository } from "../../repositories/product.repository"
import logger from "../../utils/logger"
import { CartManagementAgent } from "./CartManagementAgent"

export interface CartLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
}

export interface CartLLMResponse {
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

export class CartManagementAgentLLM {
  private prisma: PrismaClient
  private cartManagementAgent: CartManagementAgent
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma

    // Initialize CartManagementAgent with repositories
    const cartRepo = new CartRepository()
    const productRepo = new ProductRepository()
    const orderRepo = new OrderRepository()
    this.cartManagementAgent = new CartManagementAgent(
      cartRepo,
      productRepo,
      orderRepo
    )

    this.agentConfigRepo = new AgentConfigRepository(prisma)

    // OpenRouter API configuration
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required for CartManagementAgentLLM"
      )
    }
  }

  /**
   * Handle cart management query with LLM
   */
  async handleQuery(context: CartLLMContext): Promise<CartLLMResponse> {
    const startTime = Date.now()

    try {
      logger.info(`🛒 CartManagementAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query.substring(0, 100),
      })

      // STEP 1: Load system prompt from database
      const agentConfig = await this.agentConfigRepo.findByType(
        context.workspaceId,
        "CART_MANAGEMENT"
      )

      if (!agentConfig || !agentConfig.isActive) {
        throw new Error(
          "CartManagementAgent configuration not found or inactive"
        )
      }

      logger.info(`📋 Loaded CART_MANAGEMENT prompt from database`, {
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

      // STEP 3: Define function calls for cart management
      const functions = this.getCartManagementFunctions()

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

        logger.info(`⚙️ CartManagementAgentLLM: Function call requested`, {
          functionName,
          args: functionArgs,
        })

        // Execute function via CartManagementAgent
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

      logger.info(`✅ CartManagementAgentLLM: Query processed`, {
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

      logger.error("❌ CartManagementAgentLLM error:", error)

      return {
        success: false,
        output:
          "I encountered an error while managing your cart. Please try again.",
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
            "X-Title": "ShopME - Cart Management Agent",
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
   * Execute function call via CartManagementAgent
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: CartLLMContext
  ): Promise<any> {
    try {
      const agentContext = {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        customerName: context.customerName,
        language: context.customerLanguage,
      }

      switch (functionName) {
        case "viewCart":
          return await this.cartManagementAgent.getCart(agentContext)

        case "addToCart":
          return await this.cartManagementAgent.addToCart(agentContext, {
            productId: args.productId,
            quantity: args.quantity,
            notes: args.notes,
          })

        case "removeFromCart":
          // TODO: Implement removeFromCart in CartManagementAgent
          return {
            success: false,
            error: "Function not implemented yet",
          }

        case "updateCartQuantity":
          // TODO: Implement updateQuantity in CartManagementAgent
          return {
            success: false,
            error: "Function not implemented yet",
          }

        case "clearCart":
          // TODO: Implement clearCart in CartManagementAgent
          return {
            success: false,
            error: "Function not implemented yet",
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
   * Get function definitions for cart management
   */
  private getCartManagementFunctions() {
    return [
      {
        name: "viewCart",
        description:
          "View current cart contents with all items, quantities, and total price",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "addToCart",
        description: "Add a product to the cart with specified quantity",
        parameters: {
          type: "object",
          properties: {
            productId: {
              type: "string",
              description: "Product ID to add to cart",
            },
            quantity: {
              type: "number",
              description: "Quantity to add",
            },
            notes: {
              type: "string",
              description: "Optional notes for this item",
            },
          },
          required: ["productId", "quantity"],
        },
      },
      {
        name: "removeFromCart",
        description: "Remove an item from the cart",
        parameters: {
          type: "object",
          properties: {
            cartItemId: {
              type: "string",
              description: "Cart item ID to remove",
            },
          },
          required: ["cartItemId"],
        },
      },
      {
        name: "updateCartQuantity",
        description: "Update the quantity of an item in the cart",
        parameters: {
          type: "object",
          properties: {
            cartItemId: {
              type: "string",
              description: "Cart item ID to update",
            },
            newQuantity: {
              type: "number",
              description: "New quantity (must be > 0)",
            },
          },
          required: ["cartItemId", "newQuantity"],
        },
      },
      {
        name: "clearCart",
        description: "Remove all items from the cart",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ]
  }
}
