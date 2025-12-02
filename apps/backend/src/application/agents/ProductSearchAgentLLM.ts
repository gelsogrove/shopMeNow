/**
 * ProductSearchAgentLLM - Product and Services Agent
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle product/service search queries with dedicated LLM
 * 2. Respond with exact data from variables (NO function calls)
 * 3. Return direct response in customer's language
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from database (agentConfig.PRODUCT_SEARCH)
 * - Variables replaced: {{PRODUCTS}}, {{CATEGORIES}}, {{OFFERS}}, {{nameUser}}, etc.
 * - Returns direct Italian response (no translation needed)
 *
 * Flow:
 * 1. Router delegates query → Product and Services Agent
 * 2. Load system prompt from database (agentType: PRODUCT_SEARCH)
 * 3. Replace all variables with real data
 * 4. Call LLM with customer query
 * 5. Return direct response → Router
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
import { SearchConversationRepository } from "../../repositories/searchConversation.repository"
import logger from "../../utils/logger"
// NOTE: ProductSearchAgent removed - LLM uses {{PRODUCTS}} from prompt only

export interface ProductSearchLLMContext {
  workspaceId: string
  customerId: string
  sessionId: string // WhatsApp session ID for conversational memory
  customerName?: string
  customerLanguage?: string
  query: string // Customer's search query (from Router)
}

export interface ProductSearchLLMResponse {
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

export class ProductSearchAgentLLM {
  private prisma: PrismaClient
  // NOTE: productSearchAgent removed - LLM uses {{PRODUCTS}} from prompt only
  private searchConversationRepo: SearchConversationRepository
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    // NOTE: ProductSearchAgent instance removed - no database queries needed
    this.searchConversationRepo = new SearchConversationRepository()
    this.agentConfigRepo = new AgentConfigRepository(prisma)

    // OpenRouter API configuration
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required for ProductSearchAgentLLM"
      )
    }
  }

  /**
   * Handle product search query with LLM
   *
   * @param context - Search context from Router
   * @returns English response with tokens
   */
  async handleQuery(
    context: ProductSearchLLMContext
  ): Promise<ProductSearchLLMResponse> {
    const startTime = Date.now()

    try {
      logger.info(`🔍 ProductSearchAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        sessionId: context.sessionId,
        query: context.query.substring(0, 100),
      })

      // 📊 STEP 0.1: Save search query for analytics (statistics tracking)
      // This is NON-BLOCKING and happens BEFORE any product search logic
      // If it fails, it won't block the user's search experience
      try {
        const {
          CallingFunctionsService,
        } = require("../../services/calling-functions.service")
        const callingFunctions = new CallingFunctionsService()

        await callingFunctions.searchProductForStatistics({
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          query: context.query,
        })

        logger.debug("📊 Product search statistics saved", {
          query: context.query.substring(0, 30),
        })
      } catch (statError) {
        // Non-critical error - log but don't block search
        logger.warn(
          "⚠️ Failed to save search statistics (non-critical):",
          statError
        )
      }

      // STEP 0.2: Load conversational memory for context
      // Feature 191: Removed hardcoded product selection logic
      // Now the LLM uses getProductDetails() function call to lookup products
      const conversation = await this.searchConversationRepo.findBySessionId(
        context.sessionId,
        context.workspaceId
      )

      // STEP 1: Load system prompt from database
      const agentConfig = await this.agentConfigRepo.findByType(
        context.workspaceId,
        "PRODUCT_SEARCH"
      )

      if (!agentConfig || !agentConfig.isActive) {
        throw new Error(
          "ProductSearchAgent configuration not found or inactive"
        )
      }

      logger.info(`📋 Loaded PRODUCT_SEARCH prompt from database`, {
        promptLength: agentConfig.systemPrompt.length,
        model: agentConfig.model,
        temperature: agentConfig.temperature,
      })

      // 🔴 CRITICAL: Replace {{PRODUCTS}} with real data from database
      const { PromptProcessorService } = await import(
        "../../services/prompt-processor.service"
      )
      const { MessageRepository } = await import(
        "../../repositories/message.repository"
      )
      const promptProcessor = new PromptProcessorService()
      const messageRepo = new MessageRepository()

      logger.info(
        `🔄 Loading products and categories for variable replacement...`
      )

      // Get customer data
      const customer = await this.prisma.customers.findUnique({
        where: { id: context.customerId },
      })

      // Map customer DB fields to prompt processor expected format
      const customerData = customer
        ? {
            nameUser: customer.name || "Cliente",
            email: customer.email || "",
            phone: customer.phone || "",
            discountUser: customer.discount || 0,
            languageUser: customer.language || "ITALIANO",
          }
        : {}

      // Load dynamic content (products, categories, etc.) with customer discount applied
      const customerDiscount = customer?.discount || 0
      const productsText = await messageRepo.getActiveProducts(
        context.workspaceId,
        customerDiscount // 🔴 CRITICAL: Pass customer discount to calculate prices correctly
      )
      const categoriesText = await messageRepo.getActiveCategories(
        context.workspaceId
      )
      const offersText = await messageRepo.getActiveOffers(context.workspaceId)
      const servicesText = await messageRepo.getActiveServices(context.workspaceId)

      logger.info(`📦 Loaded dynamic content`, {
        productsLength: productsText.length,
        categoriesLength: categoriesText.length,
        offersLength: offersText.length,
        servicesLength: servicesText.length,
        offersContent: offersText, // 🔍 DEBUG: Log actual offers content
      })

      // Replace ALL variables ({{PRODUCTS}}, {{CATEGORIES}}, {{nameUser}}, etc.)
      const processedPrompt = await promptProcessor.preProcessPrompt(
        agentConfig.systemPrompt,
        context.workspaceId,
        customerData, // Mapped customer data for variable replacement
        {
          faqs: "", // Not used in product search
          products: productsText,
          categories: categoriesText,
          services: servicesText, // ✅ Feature 191: Include services for product/services search
          offers: offersText,
        }
      )

      logger.info(`✅ Prompt variables replaced`, {
        originalLength: agentConfig.systemPrompt.length,
        processedLength: processedPrompt.length,
        hasProducts:
          processedPrompt.includes("SALUMI-") ||
          processedPrompt.includes("FOR-"),
      })

      // 🔍 DEBUG: Log prompt info (without printing full prompt to console)
      logger.debug("Product Search Agent prompt processed", {
        promptLength: processedPrompt.length,
        firstChars: processedPrompt.substring(0, 200),
      })

      // STEP 2: Build messages for LLM (with conversation history if exists)
      const messages: any[] = [
        {
          role: "system" as const,
          content: processedPrompt, // ✅ Use processed prompt with ALL variables replaced
        },
      ]

      // Add conversation history for context (last query/response)
      // Feature 191: This provides context so LLM knows what list was shown before
      // When user says "1", LLM sees previous response and calls getProductDetails()
      if (conversation?.lastQuery && conversation?.lastResponse) {
        messages.push({
          role: "user" as const,
          content: conversation.lastQuery,
        })
        messages.push({
          role: "assistant" as const,
          content: conversation.lastResponse,
        })
        logger.info(`🧠 Added conversation history to context`, {
          lastQuery: conversation.lastQuery.substring(0, 50),
          lastResponse: conversation.lastResponse.substring(0, 50),
        })
      }

      messages.push({
        role: "user" as const,
        content: context.query,
      })

      // STEP 3: Define function calls for product search
      const functions = this.getProductSearchFunctions()

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
            `🚨 SECURITY VIOLATION: ProductSearchAgentLLM tried to call another SubLLM!`,
            {
              attemptedFunction: functionName,
              args: functionArgs,
            }
          )
          throw new Error(
            `INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`
          )
        }

        logger.info(`⚙️ ProductSearchAgentLLM: Function call requested`, {
          functionName,
          args: functionArgs,
        })

        // Execute function call
        // Feature 191: Simplified - no more pre-filtered products or group forcing
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

        // 🛡️ GUARDIA: Se l'LLM non ha generato testo, costruisci risposta dal function result
        if (!finalResponse.trim() && functionCalls.length > 0) {
          logger.warn(`⚠️ LLM returned empty response after function call, building fallback from function result`)
          finalResponse = this.buildFallbackResponseFromFunctionResult(functionCalls, context.customerLanguage || "it")
          logger.info(`✅ Built fallback response`, { responseLength: finalResponse.length })
        }
      }

      const executionTimeMs = Date.now() - startTime

      // STEP 7: Save conversation to memory (10-minute TTL)
      // Feature 191: Simplified - just save last query/response for context
      // The LLM uses getProductDetails() to look up products when needed
      try {
        // Check if we got product details from a function call
        const productDetailsFunctionCall = functionCalls.find(
          (fc) => fc.name === "getProductDetails" || fc.name === "getServiceDetails"
        )

        let groupsMetadata = null

        // If we got product details, save for potential cart handoff
        if (productDetailsFunctionCall?.result?.found && productDetailsFunctionCall?.result?.product) {
          const product = productDetailsFunctionCall.result.product
          groupsMetadata = {
            selectedProductCode: product.productCode,
            productName: product.name,
            timestamp: new Date().toISOString(),
          }

          logger.info(`📦 Storing product details from function call`, {
            selectedProductCode: product.productCode,
            productName: product.name,
          })
        }

        await this.searchConversationRepo.upsert({
          sessionId: context.sessionId,
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          lastQuery: context.query,
          lastResponse: finalResponse.substring(0, 500), // Truncate long responses
          metadata: groupsMetadata || null,
        })

        logger.info(`💾 Saved conversation to memory`, {
          sessionId: context.sessionId,
          hasProductDetails: !!groupsMetadata,
          selectedProductCode: groupsMetadata?.selectedProductCode,
        })
      } catch (memoryError) {
        logger.error(`⚠️ Failed to save conversation memory:`, memoryError)
        // Don't fail the whole request if memory save fails
      }

      logger.info(`✅ ProductSearchAgentLLM: Query processed`, {
        executionTimeMs,
        tokensUsed: totalTokens,
        responseLength: finalResponse.length,
        functionCallsCount: functionCalls.length,
      })

      return {
        success: true,
        output: finalResponse, // English response with [LINK_xxx] tokens
        tokensUsed: totalTokens,
        executionTimeMs,
        functionCalls,
        systemPrompt: processedPrompt, // 🆕 Include processed prompt for debugging
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

      logger.error("❌ ProductSearchAgentLLM error:", errorInfo)

      return {
        success: false,
        output: "Error processing product search request",
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
            "X-Title": "ShopME - Product and Services Agent",
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
   * Execute function call
   * Feature 191: Simplified - getProductDetails and getServiceDetails for product lookup
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: ProductSearchLLMContext
  ): Promise<any> {
    try {
      logger.info(`⚙️ ProductSearchAgentLLM executing function: ${functionName}`, {
        args,
        workspaceId: context.workspaceId,
      })

      // Handle getProductDetails - lookup product by code (priority) or name
      if (functionName === "getProductDetails") {
        const { CallingFunctionsService } = await import(
          "../../services/calling-functions.service"
        )
        const callingFunctionsService = new CallingFunctionsService()

        const result = await callingFunctionsService.getProductDetails({
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          productName: args.productName,
          formato: args.formato,
        })

        logger.info(`✅ getProductDetails result:`, {
          found: result.found,
          multiple: result.multiple,
          productName: result.product?.name,
        })

        return result
      }

      // Handle getServiceDetails - lookup service by code (priority) or name
      if (functionName === "getServiceDetails") {
        const { CallingFunctionsService } = await import(
          "../../services/calling-functions.service"
        )
        const callingFunctionsService = new CallingFunctionsService()

        const result = await callingFunctionsService.getServiceDetails({
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          serviceName: args.serviceName,
        })

        logger.info(`✅ getServiceDetails result:`, {
          found: result.found,
          multiple: result.multiple,
          serviceName: result.service?.name,
        })

        return result
      }

      // Handle searchProductByCertifications (existing function)
      if (functionName === "searchProductByCertifications") {
        // Existing implementation for certification search
        logger.info(`🔖 searchProductByCertifications called:`, args)
        return {
          success: true,
          message: "Use {{PRODUCTS}} variable for certification filtering",
        }
      }

      // Handle searchProductForStatistics (existing function)
      if (functionName === "searchProductForStatistics") {
        const { CallingFunctionsService } = await import(
          "../../services/calling-functions.service"
        )
        const callingFunctionsService = new CallingFunctionsService()

        const result = await callingFunctionsService.searchProductForStatistics({
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          query: args.query,
        })

        logger.info(`📊 searchProductForStatistics saved:`, result)
        return result
      }

      logger.warn(`❌ Unknown function: ${functionName}`)
      return {
        success: false,
        error: `Unknown function: ${functionName}`,
      }
    } catch (error) {
      logger.error(`Error in executeFunction:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Get function definitions for product search
   * ✅ Feature 191: getProductDetails and getServiceDetails for cart flow
   */
  private getProductSearchFunctions() {
    return [
      {
        name: "getProductDetails",
        description: "Get full product details by productCode (priority) or name. Use this when user selects a product to see details before adding to cart. Returns the INTERNAL product code needed for cart operations. NEVER show the productCode to the user.",
        parameters: {
          type: "object" as const,
          properties: {
            productName: {
              type: "string" as const,
              description: "The productCode [e.g. PARM-500G] or product name. Prefer code from product list.",
            },
            formato: {
              type: "string" as const,
              description: "Optional product format/size (e.g., '500g', '1kg')",
            },
          },
          required: ["productName"],
        },
      },
      {
        name: "getServiceDetails",
        description: "Get full service details by serviceCode (priority) or name. Use this when user selects a service to see details before adding to cart. Returns the INTERNAL service code needed for cart operations. NEVER show the serviceCode to the user.",
        parameters: {
          type: "object" as const,
          properties: {
            serviceName: {
              type: "string" as const,
              description: "The serviceCode [e.g. SHIPPING, GIFT-WRAP] or service name. Prefer code from service list.",
            },
          },
          required: ["serviceName"],
        },
      },
      {
        name: "searchProductForStatistics",
        description: "SOLO per analytics. Chiama questa funzione DOPO aver risposto al cliente con i dettagli prodotto. Non sostituisce la risposta - devi SEMPRE rispondere con i dati prodotto da {{PRODUCTS}} E ANCHE chiamare questa funzione per tracciare la ricerca.",
        parameters: {
          type: "object" as const,
          properties: {
            query: {
              type: "string" as const,
              description: "The search query to track",
            },
          },
          required: ["query"],
        },
      },
    ]
  }

  // Feature 191: Removed extractGroupText, filterByGroupKeywords, extractKeywords
  // These were part of the hardcoded product selection logic
  // Now the LLM uses getProductDetails() function call instead

  /**
   * Analyze LLM response to detect grouping strategy used
   * Feature 123: Analytics for dynamic grouping intelligence
   */
  private analyzeGroupingStrategy(
    response: string,
    products: any[]
  ): { strategy: string; groupCount: number } {
    const responseLower = response.toLowerCase()

    // Detect strategy based on keywords in response
    let strategy = "unknown"
    let groupCount = 0

    // Count numbered groups (1., 2., 3., etc.)
    const groupMatches = response.match(/^\d+\.\s/gm)
    groupCount = groupMatches ? groupMatches.length : 0

    // Detect strategy type
    if (
      responseLower.includes("dop") ||
      responseLower.includes("halal") ||
      responseLower.includes("bio") ||
      responseLower.includes("certificazioni")
    ) {
      strategy = "certification-based"
    } else if (
      responseLower.includes("prezzo") ||
      responseLower.includes("€") ||
      responseLower.includes("fascia")
    ) {
      strategy = "price-based"
    } else if (
      responseLower.includes("regione") ||
      responseLower.includes("sicilian") ||
      responseLower.includes("sardi")
    ) {
      strategy = "region-based"
    } else if (
      responseLower.includes("aperitivo") ||
      responseLower.includes("colazione") ||
      responseLower.includes("cena")
    ) {
      strategy = "use-case"
    } else if (
      responseLower.includes("stagionat") ||
      responseLower.includes("piccante") ||
      responseLower.includes("dolce")
    ) {
      strategy = "attribute-based"
    } else if (
      responseLower.includes("tipo") ||
      responseLower.includes("categor") ||
      groupCount > 0
    ) {
      strategy = "category-based"
    } else if (products.length <= 3) {
      strategy = "direct-list"
    } else if (products.length === 1) {
      strategy = "single-product"
    }

    return { strategy, groupCount }
  }

  /**
   * 🛡️ Build fallback response when LLM returns empty content
   * Uses function call results to construct a helpful response
   */
  private buildFallbackResponseFromFunctionResult(
    functionCalls: Array<{ name: string; arguments: any; result: any }>,
    language: string
  ): string {
    // Find product or service details from function calls
    const productDetails = functionCalls.find(
      (fc) => fc.name === "getProductDetails" && fc.result?.found
    )
    const serviceDetails = functionCalls.find(
      (fc) => fc.name === "getServiceDetails" && fc.result?.found
    )

    // Handle product found
    if (productDetails?.result?.product) {
      const p = productDetails.result.product
      const priceStr = p.discountedPrice
        ? `€${p.discountedPrice.toFixed(2).replace(".", ",")} (invece di €${p.price.toFixed(2).replace(".", ",")})`
        : `€${p.price.toFixed(2).replace(".", ",")}`

      return `Sì, abbiamo **${p.name}**! 🧀

📦 **Dettagli prodotto:**
- Prezzo: ${priceStr}
- Formato: ${p.formato || "Standard"}
${p.description ? `- Descrizione: ${p.description}` : ""}

Vuoi che lo aggiunga al carrello?`
    }

    // Handle service found
    if (serviceDetails?.result?.service) {
      const s = serviceDetails.result.service
      const priceStr = `€${s.price.toFixed(2).replace(".", ",")}`

      return `Sì, offriamo il servizio **${s.name}**! 🚚

📋 **Dettagli servizio:**
- Prezzo: ${priceStr}
${s.description ? `- Descrizione: ${s.description}` : ""}

Vuoi aggiungerlo al carrello?`
    }

    // Handle multiple products found
    const multipleProducts = functionCalls.find(
      (fc) => fc.name === "getProductDetails" && fc.result?.multiple
    )
    if (multipleProducts?.result?.options) {
      const options = multipleProducts.result.options
      let response = `Ho trovato ${options.length} varianti. Quale preferisci?\n\n`
      options.slice(0, 5).forEach((opt: any, idx: number) => {
        const priceStr = `€${opt.price.toFixed(2).replace(".", ",")}`
        response += `${idx + 1}. **${opt.name}** - ${priceStr}\n`
      })
      return response
    }

    // Handle not found
    const notFoundCall = functionCalls.find(
      (fc) =>
        (fc.name === "getProductDetails" || fc.name === "getServiceDetails") &&
        !fc.result?.found
    )
    if (notFoundCall) {
      const searchTerm =
        notFoundCall.arguments?.productName ||
        notFoundCall.arguments?.serviceName ||
        "prodotto"
      return `Mi dispiace, non ho trovato "${searchTerm}" nel nostro catalogo. Vuoi che cerchi qualcos'altro?`
    }

    // 🆕 Handle searchProductForStatistics - this is analytics-only, no product data
    // When this is the only function call, the LLM should have responded with product info
    // but didn't. Return a helpful message asking for clarification.
    const statsCall = functionCalls.find(
      (fc) => fc.name === "searchProductForStatistics"
    )
    if (statsCall) {
      const query = statsCall.arguments?.query || "prodotto"
      logger.warn(`⚠️ LLM only called searchProductForStatistics without responding. Query: "${query}"`)
      // Return a message that acknowledges the search but asks for more context
      // The LLM SHOULD have used {{PRODUCTS}} to find the product - this is a fallback
      return `Ho registrato la tua ricerca per "${query}". Per aiutarti meglio, potresti dirmi quale prodotto specifico cerchi dal nostro catalogo? 📋`
    }

    // Generic fallback
    return `Sto elaborando la tua richiesta. Come posso aiutarti?`
  }
}
