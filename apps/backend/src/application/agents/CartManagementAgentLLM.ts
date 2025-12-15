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
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/03-cart-management.template.md)
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

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { config } from "../../config"
import { CartRepository } from "../../repositories/cart.repository"
import { OrderRepository } from "../../repositories/order.repository"
import { ProductRepository } from "../../repositories/product.repository"
import { ServiceRepository } from "../../repositories/service.repository"
import { TemplateLoaderService } from "../services/template-loader.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import { getSystemContextService, SystemContextService } from "../../services/system-context.service"
import logger from "../../utils/logger"
import { CartManagementAgent } from "./CartManagementAgent"

import { CustomerData } from "../../types/agent.types"

export interface CartLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number // Customer's discount percentage (e.g., 10 for 10%)
  query: string
  conversationHistory?: Array<{ role: string; content: string }> // Last 2-3 messages for context
  selectedSku?: string // Feature 123: Product code from search memory
  selectedItemType?: "PRODUCT" | "SERVICE" // 🆕 Distinguish products from services
  /** Pre-loaded customer data from Router (avoids duplicate DB queries) */
  customerData?: CustomerData
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
  model?: string // 🆕 Model used for debugging timeline
}

export class CartManagementAgentLLM {
  private prisma: PrismaClient
  private cartManagementAgent: CartManagementAgent
  private templateLoader: TemplateLoaderService
  private systemContextService: SystemContextService
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma

    // Initialize CartManagementAgent with repositories
    const cartRepo = new CartRepository()
    const productRepo = new ProductRepository()
    const serviceRepo = new ServiceRepository()
    const orderRepo = new OrderRepository()
    this.cartManagementAgent = new CartManagementAgent(
      cartRepo,
      productRepo,
      serviceRepo,
      orderRepo
    )

    this.templateLoader = TemplateLoaderService.getInstance(prisma)
    this.systemContextService = getSystemContextService(prisma)

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

      // STEP 1: Load system prompt from template files
      let systemPromptRaw = await this.templateLoader.loadAndRenderTemplate(
        "CART_MANAGEMENT",
        context.workspaceId
      )

      logger.info(`📋 Loaded CART_MANAGEMENT template from files`, {
        promptLength: systemPromptRaw.length,
      })

      // 🆕 STEP 1.5: Load workspace config for dynamic fields (customAiRules, botIdentityResponse, etc.)
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        select: {
          name: true,
          address: true,
          customAiRules: true,
          botIdentityResponse: true,
        },
      })

      // 🔧 STEP 1.6: Replace ALL variables ({{companyName}}, {{nameUser}}, etc.)
      // CRITICAL: Must call preProcessPrompt to render variables before passing to LLM
      const promptProcessor = new PromptProcessorService()
      
      // 🔧 OPTIMIZATION: Use pre-loaded customerData from Router if available (avoids duplicate DB queries)
      // 🔴 CRITICAL FIX: Merge Router data with workspace fallbacks to ensure no empty values
      const baseCustomerData = {
        nameUser: context.customerName || "",
        email: "",
        phone: "",
        discountUser: context.customerDiscount || 0,
        companyName: workspace?.name || "",
        lastordercode: "",
        languageUser: context.customerLanguage || "it",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        botIdentityResponse: workspace?.botIdentityResponse || "",
      }
      
      // Merge: Router data takes priority, but fallback to local workspace data if empty
      const customerDataForPrompt = context.customerData ? {
        ...baseCustomerData,
        ...context.customerData,
        // 🔴 CRITICAL: Ensure companyName is NEVER empty
        companyName: context.customerData.companyName || workspace?.name || baseCustomerData.companyName,
      } : baseCustomerData
      
      // 🔍 DEBUG: Log what we're passing to preProcessPrompt
      logger.info(`📋 CartManagementAgent customerDataForPrompt:`, {
        companyName: customerDataForPrompt.companyName,
        nameUser: customerDataForPrompt.nameUser,
        hasRouterData: !!context.customerData,
        workspaceName: workspace?.name,
      })
      
      // 🆕 Load products with SKU for cart operations
      const productRepo = new ProductRepository()
      const productsResult = await productRepo.findAll(context.workspaceId)
      const productsRaw = productsResult.products || []
      
      // Format products with SKU for LLM to use in addItemToCart
      const productsFormatted = productsRaw
        .filter((p: any) => p.isActive)
        .map((p: any) => `- ${p.name} | SKU: ${p.sku} | €${p.price?.toFixed(2)}`)
        .join("\n")
      
      logger.info(`📦 Loaded ${productsRaw.length} products for CartManagement`, {
        activeProducts: productsRaw.filter((p: any) => p.isActive).length,
      })
      
      const systemPrompt = await promptProcessor.preProcessPrompt(
        systemPromptRaw,
        context.workspaceId,
        customerDataForPrompt,
        {
          faqs: "",
          products: productsFormatted, // 🆕 Include products with SKU
          categories: "",
          services: "",
          offers: "",
        },
        undefined, // workspaceUrl
        {
          address: workspace?.address || "",
          customAiRules: workspace?.customAiRules || "",
          botIdentityResponse: context.customerData?.botIdentityResponse || workspace?.botIdentityResponse || "",
        }
      )

      logger.info(`✅ Variables replaced in CART_MANAGEMENT prompt`, {
        originalLength: systemPromptRaw.length,
        processedLength: systemPrompt.length,
      })

      // STEP 2: Build messages for LLM (with conversation history for context)
      const messages: any[] = [
        {
          role: "system" as const,
          content: systemPrompt,
        },
      ]

      // 🔧 Feature 123: If we have selectedSku from search, inject it
      if (context.selectedSku) {
        const isService = context.selectedItemType === "SERVICE"
        const itemLabel = isService ? "Servizio" : "Prodotto"
        const itemTypeParam = isService ? ', type: "SERVICE"' : ', type: "PRODUCT"'
        
        messages.push({
          role: "system" as const,
          content: `🚨 AZIONE IMMEDIATA RICHIESTA 🚨

Il cliente ha GIÀ CONFERMATO di voler aggiungere questo ${itemLabel.toLowerCase()} al carrello.
NON chiedere ulteriori conferme. DEVI procedere IMMEDIATAMENTE.

Codice ${itemLabel}: ${context.selectedSku}
Tipo: ${isService ? "SERVICE" : "PRODUCT"}

ISTRUZIONI:
1. Chiama SUBITO la funzione addToCart() con code: "${context.selectedSku}"${itemTypeParam}
2. NON chiedere "Sei sicuro?" - il cliente ha già detto SÌ
3. NON chiedere la quantità - usa quella specificata nel messaggio
4. Dopo l'aggiunta, mostra il messaggio di conferma

ESEMPIO DI CHIAMATA:
addToCart({ items: [{ code: "${context.selectedSku}", quantity: <numero dal messaggio>${itemTypeParam} }] })`,
        })

        logger.info(
          `📦 Injected selectedSku into CartManagementAgent`,
          {
            selectedSku: context.selectedSku,
            selectedItemType: context.selectedItemType || "PRODUCT",
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
        model: "gpt-4o-mini",
        messages,
        functions,
        temperature: 0.7,
        maxTokens: 2000,
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
          model: "gpt-4o-mini",
          messages,
          functions,
          temperature: 0.7,
          maxTokens: 2000,
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
        model: "gpt-4o-mini", // 🆕 Include model for debugging timeline
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
            "X-Title": "eChatbot - Cart Management Agent",
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
        customerDiscount: context.customerDiscount, // 🔧 Pass discount for price calculations
      }

      switch (functionName) {
        case "viewCart": {
          const cartResult = await this.cartManagementAgent.getCart(agentContext)
          return this.formatCartResponse(cartResult)
        }

        case "addItemToCart":
        case "addToCart": {
          // Support new format (items array) and legacy format (productId)
          const items = args.items || [
            {
              code: args.productId,
              quantity: args.quantity || 1,
              type: "PRODUCT", // Legacy format assumes PRODUCT
              notes: args.notes,
            },
          ]

          // Process each item
          const results = []
          for (const item of items) {
            const result = await this.cartManagementAgent.addToCart(
              agentContext,
              {
                productId: item.code, // Backend expects productId field (but it's actually a code)
                quantity: item.quantity || 1,
                notes: item.notes,
                type: item.type || "PRODUCT", // Pass type: PRODUCT or SERVICE
              }
            )
            results.push({
              code: item.code,
              type: item.type,
              ...result,
            })
          }

          // Get updated cart and format response
          const cartAfterAdd = await this.cartManagementAgent.getCart(agentContext)
          const allSucceeded = results.every((r) => r.success)
          
          // Update system context with new cart state
          await this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId)
          
          return {
            success: allSucceeded,
            message: allSucceeded ? "Items added to cart" : "Some items could not be added",
            ...this.formatCartResponse(cartAfterAdd),
          }
        }

        case "removeFromCart": {
          // Find item in cart by sku or productName
          const cart = await this.cartManagementAgent.getCart(agentContext)
          if (cart.isEmpty) {
            return { success: false, error: "Cart is empty", formattedCart: "🛒 Il tuo carrello è vuoto." }
          }

          // Find the item to remove
          const itemToRemove = cart.cart.items.find((item: any) => {
            const product = item.product || item.service
            if (!product) return false
            
            // Match by code
            if (args.sku && (product.sku === args.sku || product.serviceCode === args.sku)) {
              return true
            }
            // Match by name (case-insensitive partial match)
            if (args.productName && product.name.toLowerCase().includes(args.productName.toLowerCase())) {
              return true
            }
            return false
          })

          if (!itemToRemove) {
            return { 
              success: false, 
              error: `Product "${args.productName || args.sku}" not found in cart`,
              ...this.formatCartResponse(cart)
            }
          }

          // Remove the item
          const removeResult = await this.cartManagementAgent.removeFromCart(agentContext, itemToRemove.id)
          
          // Get updated cart
          const cartAfterRemove = await this.cartManagementAgent.getCart(agentContext)
          
          // Update system context with new cart state
          await this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId)
          
          return {
            success: removeResult.success,
            message: removeResult.success ? `Removed "${itemToRemove.name}" from cart` : removeResult.error,
            ...this.formatCartResponse(cartAfterRemove),
          }
        }

        case "updateCartItem":
        case "updateCartQuantity": {
          // Find item in cart by sku or productName
          const cart = await this.cartManagementAgent.getCart(agentContext)
          if (cart.isEmpty) {
            return { success: false, error: "Cart is empty", formattedCart: "🛒 Il tuo carrello è vuoto." }
          }

          // Find the item to update
          const itemToUpdate = cart.cart.items.find((item: any) => {
            const product = item.product || item.service
            if (!product) return false
            
            // Match by code
            if (args.sku && (product.sku === args.sku || product.serviceCode === args.sku)) {
              return true
            }
            // Match by name (case-insensitive partial match)
            if (args.productName && product.name.toLowerCase().includes(args.productName.toLowerCase())) {
              return true
            }
            return false
          })

          if (!itemToUpdate) {
            return { 
              success: false, 
              error: `Product "${args.productName || args.sku}" not found in cart`,
              ...this.formatCartResponse(cart)
            }
          }

          // If newQuantity is 0, remove the item
          if (args.newQuantity === 0) {
            const removeResult = await this.cartManagementAgent.removeFromCart(agentContext, itemToUpdate.id)
            const cartAfterRemove = await this.cartManagementAgent.getCart(agentContext)
            
            // Update system context with new cart state
            await this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId)
            
            return {
              success: removeResult.success,
              message: `Removed "${itemToUpdate.name}" from cart`,
              ...this.formatCartResponse(cartAfterRemove),
            }
          }

          // Update the quantity
          const updateResult = await this.cartManagementAgent.updateQuantity(agentContext, {
            cartItemId: itemToUpdate.id,
            newQuantity: args.newQuantity,
          })
          
          // Get updated cart
          const cartAfterUpdate = await this.cartManagementAgent.getCart(agentContext)
          
          // Update system context with new cart state
          await this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId)
          
          return {
            success: updateResult.success,
            message: updateResult.success 
              ? `Updated "${itemToUpdate.name}" quantity to ${args.newQuantity}` 
              : updateResult.error,
            ...this.formatCartResponse(cartAfterUpdate),
          }
        }

        case "clearCart": {
          const clearResult = await this.cartManagementAgent.resetCart(agentContext)
          
          // Update system context with empty cart
          await this.systemContextService.refreshCartSummary(context.workspaceId, context.customerId)
          
          return {
            success: clearResult.success,
            message: "Cart cleared",
            formattedCart: "🛒 Il tuo carrello è ora vuoto.",
          }
        }

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
        name: "addItemToCart",
        description:
          "Add products or services to cart. Supports both PRODUCT and SERVICE types. Use AFTER customer confirmation.",
        parameters: {
          type: "object",
          properties: {
            items: {
              type: "array",
              description:
                "Array of items to add. For single item, use array with 1 element.",
              items: {
                type: "object",
                properties: {
                  code: {
                    type: "string",
                    description:
                      "Product or service code (e.g., 'BUR-001', 'SRV-001')",
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity (default: 1, must be >= 1)",
                  },
                  type: {
                    type: "string",
                    enum: ["PRODUCT", "SERVICE"],
                    description: "PRODUCT for products, SERVICE for services",
                  },
                  notes: {
                    type: "string",
                    description: "Optional notes for this item",
                  },
                },
                required: ["code", "type"],
              },
            },
          },
          required: ["items"],
        },
      },
      {
        name: "removeFromCart",
        description: "Remove an item from the cart by product/service code or name. Use when customer says 'remove the mozzarella' or 'togli il panettone'",
        parameters: {
          type: "object",
          properties: {
            sku: {
              type: "string",
              description: "Product or service code to remove (e.g., 'BUR-001')",
            },
            productName: {
              type: "string",
              description: "Product or service name to remove (e.g., 'Mozzarella di Bufala'). Use if code is unknown.",
            },
          },
          required: [],
        },
      },
      {
        name: "updateCartItem",
        description: "Update the quantity of an item in the cart. Use when customer says 'I want 5 panettoni instead of 3', 'change mozzarella to 2', 'voglio solo una mozzarella' (reduce quantity to 1), 'metti 3 burrate'. ⚠️ 'voglio solo X' means 'reduce X to 1', NOT 'clear cart'!",
        parameters: {
          type: "object",
          properties: {
            sku: {
              type: "string",
              description: "Product or service code to update (e.g., 'BUR-001')",
            },
            productName: {
              type: "string",
              description: "Product or service name to update (e.g., 'Panettone'). Use if code is unknown.",
            },
            newQuantity: {
              type: "number",
              description: "New quantity (must be >= 0). Use 0 to remove the item.",
            },
          },
          required: ["newQuantity"],
        },
      },
      {
        name: "clearCart",
        description: "Remove ALL items from the cart. ⚠️ Use ONLY when customer explicitly says 'svuota carrello', 'cancella tutto', 'elimina carrello'. NEVER use for 'voglio solo X' (that's updateCartItem!)",
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

  /**
   * Format cart response as a readable text for WhatsApp
   * Returns formatted string with emoji and prices
   */
  private formatCartResponse(cartResult: any): { formattedCart: string; cartData: any } {
    if (!cartResult.success) {
      return {
        formattedCart: "❌ Error loading cart",
        cartData: cartResult,
      }
    }

    if (cartResult.isEmpty || !cartResult.cart?.items?.length) {
      return {
        formattedCart: "🛒 Il tuo carrello è vuoto.",
        cartData: cartResult,
      }
    }

    const cart = cartResult.cart
    const lines: string[] = ["🛒 Il tuo carrello:"]

    for (const item of cart.items) {
      const name = item.name || item.product?.name || item.service?.name || "Unknown"
      const quantity = item.quantity || 1
      const unitPrice = item.unitPrice || item.product?.price || item.service?.price || 0
      const itemTotal = unitPrice * quantity
      
      // Format price with comma for Italian locale
      const formattedPrice = itemTotal.toFixed(2).replace(".", ",")
      lines.push(`- ${quantity}x ${name} - ${formattedPrice}€`)
    }

    // Add total
    const total = cart.total || cart.items.reduce((sum: number, item: any) => {
      const price = item.unitPrice || item.product?.price || item.service?.price || 0
      return sum + (price * (item.quantity || 1))
    }, 0)
    
    const formattedTotal = total.toFixed(2).replace(".", ",")
    lines.push("")
    lines.push(`💰 Totale: ${formattedTotal}€`)

    return {
      formattedCart: lines.join("\n"),
      cartData: cartResult,
    }
  }
}
