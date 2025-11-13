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
  conversationHistory?: Array<{ role: string; content: string }> // Last 2-3 messages for context
  selectedProductCode?: string // Feature 123: Product code from search memory
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
  systemPrompt?: string // 🆕 Processed system prompt for debugging
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

      // Store the processed system prompt for debugging
      const systemPrompt = agentConfig.systemPrompt

      // STEP 2: Build messages for LLM (with conversation history for context)
      const messages: any[] = [
        {
          role: "system" as const,
          content: systemPrompt,
        },
      ]

      // 🔧 Feature 123: If we have selectedProductCode from search, inject it
      if (context.selectedProductCode) {
        messages.push({
          role: "system" as const,
          content: `⚠️ IMPORTANT: The user just selected a product from the catalog.
Product Code: ${context.selectedProductCode}

When the user says "yes" or "sì" or confirms they want to add the product to cart, 
you MUST call addToCart() with this EXACT product code: "${context.selectedProductCode}"

DO NOT use product names - ALWAYS use the product code provided above.`,
        })

        logger.info(
          `📦 Injected selectedProductCode into CartManagementAgent`,
          {
            selectedProductCode: context.selectedProductCode,
          }
        )
      }

      // Add conversation history if provided (for context awareness)
      if (
        context.conversationHistory &&
        context.conversationHistory.length > 0
      ) {
        logger.info(`📜 Adding conversation history`, {
          historyLength: context.conversationHistory.length,
        })
        messages.push(...context.conversationHistory)
      }

      // Add current user query
      messages.push({
        role: "user" as const,
        content: context.query,
      })

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
      const maxIterations = 5 // Prevent infinite loops

      // STEP 5: Handle function calling loop (like Router)
      let currentResponse = llmResponse
      let iteration = 0

      while (currentResponse.function_call && iteration < maxIterations) {
        iteration++

        const functionName = currentResponse.function_call.name
        const functionArgs = JSON.parse(
          currentResponse.function_call.arguments || "{}"
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
            `🚨 SECURITY VIOLATION: CartManagementAgentLLM tried to call another SubLLM!`,
            {
              attemptedFunction: functionName,
              iteration,
              args: functionArgs,
            }
          )
          throw new Error(
            `INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`
          )
        }

        logger.info(
          `⚙️ CartManagementAgentLLM: Function call ${iteration}/${maxIterations}`,
          {
            functionName,
            args: functionArgs,
            currentMessagesCount: messages.length,
          }
        )

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

        // Add function call + result to conversation
        messages.push({
          role: "assistant" as const,
          content: null as any,
          function_call: currentResponse.function_call,
        })
        messages.push({
          role: "function" as const,
          name: functionName,
          content: JSON.stringify(functionResult),
        })

        // Call LLM again with function result
        const nextLLMResponse = await this.callLLM({
          model: agentConfig.model,
          messages,
          functions,
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.maxTokens || 2000,
        })

        totalTokens += nextLLMResponse.tokensUsed
        currentResponse = nextLLMResponse

        logger.info(
          `📥 CartManagementAgentLLM: LLM response after function ${iteration}`,
          {
            hasContent: !!currentResponse.content,
            contentPreview: currentResponse.content?.substring(0, 100),
            hasFunctionCall: !!currentResponse.function_call,
            nextFunctionName: currentResponse.function_call?.name,
            tokensUsed: nextLLMResponse.tokensUsed,
          }
        )

        // If LLM returns text response, we're done
        if (!currentResponse.function_call && currentResponse.content) {
          finalResponse = currentResponse.content
          logger.info(
            `✅ CartManagementAgentLLM: Loop completed with text response`
          )
          break
        }
      }

      // If we exited loop with function_call still present, something went wrong
      if (currentResponse.function_call) {
        logger.warn(
          `⚠️ CartManagementAgentLLM: Max iterations reached with pending function call`,
          {
            finalIteration: iteration,
            pendingFunction: currentResponse.function_call.name,
            totalFunctionCalls: functionCalls.length,
            hasContent: !!currentResponse.content,
          }
        )
        finalResponse =
          currentResponse.content ||
          "I need more information to complete this request."
      }

      logger.info(`🏁 CartManagementAgentLLM: Final response`, {
        success: !!finalResponse,
        responseLength: finalResponse?.length || 0,
        totalIterations: iteration,
        totalFunctionCalls: functionCalls.length,
        totalTokens,
      })

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

      logger.error("❌ CartManagementAgentLLM error:", errorInfo)

      return {
        success: false,
        output: "Error processing cart management request",
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
            "X-Title": "ShopME - Cart Management Agent",
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
          return await this.cartManagementAgent.resetCart(agentContext)

        case "getLastOrderDetails":
          // Get customer's last order with full details
          const orderDetails = await this.prisma.orders.findFirst({
            where: {
              customerId: context.customerId,
              workspaceId: context.workspaceId,
              status: "DELIVERED",
            },
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          })

          if (!orderDetails) {
            return {
              success: false,
              error: "NO_PREVIOUS_ORDER",
              message: "No previous orders found",
            }
          }

          // Format order summary for LLM response
          const itemsSummary = orderDetails.items
            .map((item) => {
              const product = item.product
              return `- ${product.name} x${item.quantity} (${item.unitPrice.toFixed(2)}€)`
            })
            .join("\n")

          const totalPrice = orderDetails.items.reduce(
            (sum, item) => sum + item.unitPrice * item.quantity,
            0
          )

          return {
            success: true,
            orderCode: orderDetails.orderCode,
            orderDate: orderDetails.createdAt.toISOString().split("T")[0],
            itemsCount: orderDetails.items.length,
            totalPrice: totalPrice.toFixed(2),
            itemsSummary, // Formatted string ready for LLM
            items: orderDetails.items.map((item) => ({
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: (item.unitPrice * item.quantity).toFixed(2),
            })),
          }

        case "repeatLastOrder":
          // Get customer's last completed order (DELIVERED = completed)
          const lastOrder = await this.prisma.orders.findFirst({
            where: {
              customerId: context.customerId,
              workspaceId: context.workspaceId,
              status: "DELIVERED",
            },
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          })

          if (!lastOrder) {
            logger.warn("repeatLastOrder: No previous DELIVERED orders found", {
              customerId: context.customerId,
              workspaceId: context.workspaceId,
            })
            return {
              success: false,
              error: "NO_PREVIOUS_ORDER",
              message: "You don't have any previous orders to repeat",
            }
          }

          logger.info("repeatLastOrder: Found last order", {
            orderId: lastOrder.id,
            orderCode: lastOrder.orderCode,
            itemsCount: lastOrder.items.length,
            items: lastOrder.items.map((i) => ({
              productId: i.productId,
              productName: i.product?.name,
              quantity: i.quantity,
            })),
          })

          // Call repeatOrder with lastOrder.id
          const repeatResult = await this.cartManagementAgent.repeatOrder(
            agentContext,
            {
              orderId: lastOrder.id,
            }
          )

          logger.info("repeatLastOrder: Result from CartManagementAgent", {
            success: repeatResult.success,
            message: repeatResult.message,
            error: repeatResult.error,
            cartItemCount: repeatResult.cart?.itemCount,
          })

          return repeatResult

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
      {
        name: "getLastOrderDetails",
        description:
          "Get details of customer's most recent DELIVERED order including product list. Use BEFORE repeatLastOrder to show products to customer.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "repeatLastOrder",
        description:
          "Copy all items from customer's most recent DELIVERED order to current cart. Use AFTER showing order details with getLastOrderDetails and receiving confirmation.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ]
  }
}
