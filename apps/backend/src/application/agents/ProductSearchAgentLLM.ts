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

      // STEP 0.2: Check conversational memory FIRST
      const conversation = await this.searchConversationRepo.findBySessionId(
        context.sessionId,
        context.workspaceId
      )

      // 🧠 CONVERSATIONAL MEMORY: Pre-filter products if group selection
      let preFilteredProducts: any[] | null = null
      let forceNoGrouping = false
      let selectedProductFromList: any = null

      if (conversation?.metadata?.shouldGroup && conversation.metadata.groups) {
        const numberSelectionMatch = context.query.match(/^(\d+)$/)

        if (numberSelectionMatch) {
          const selectedNumber = parseInt(numberSelectionMatch[1])
          const allProducts = conversation.metadata.groups
          const lastResponse = conversation.lastResponse || ""

          logger.info(`🎯 Number selection detected`, {
            sessionId: context.sessionId,
            selectedNumber,
            productsTotal: allProducts.length,
          })

          // Check if last response shows GROUPS or PRODUCT LIST
          const isProductList = lastResponse.match(/\d+\.\s.*-\s*€\d/)

          if (isProductList) {
            // 📦 USER SELECTED PRODUCT NUMBER FROM LIST
            // Extract products from last response and map to number
            const productLines = lastResponse.match(/^\d+\.\s.+$/gm) || []

            if (selectedNumber > 0 && selectedNumber <= productLines.length) {
              // Find matching product by name from line
              const selectedLine = productLines[selectedNumber - 1]
              const productNameMatch = selectedLine.match(
                /^\d+\.\s(.+?)\s*-\s*€/
              )

              logger.info(`🔍 Parsing product selection`, {
                selectedNumber,
                selectedLine,
                productLines: productLines.length,
              })

              if (productNameMatch) {
                const productName = productNameMatch[1].trim()

                logger.info(`🔍 Extracted product name from selection`, {
                  extractedName: productName,
                  selectedLine,
                })

                // 🔧 Feature 123: Search product DIRECTLY in database by FULL name
                // ⚠️ CRITICAL: Match by full name to avoid wrong product selection
                // Example: "Provolone Valpadana DOP 400g" → Don't match "Provolone Piccante"
                const fullProduct = await this.prisma.products.findFirst({
                  where: {
                    workspaceId: context.workspaceId,
                    isActive: true,
                    OR: [
                      {
                        // Try exact match first (name + formato)
                        name: {
                          equals: productName,
                          mode: "insensitive",
                        },
                      },
                      {
                        // Fallback: Match first 2-3 significant words (not just first word)
                        // Extract first 3 words for better precision
                        name: {
                          contains: productName
                            .split(" ")
                            .slice(0, 3)
                            .join(" "),
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                })

                if (fullProduct) {
                  logger.info(`✅ Found product in database`, {
                    productCode: fullProduct.productCode,
                    productName: fullProduct.name,
                  })

                  // Get supplier and category names
                  const supplier = fullProduct.supplierId
                    ? await this.prisma.suppliers.findUnique({
                        where: { id: fullProduct.supplierId },
                      })
                    : null

                  const category = fullProduct.categoryId
                    ? await this.prisma.categories.findUnique({
                        where: { id: fullProduct.categoryId },
                      })
                    : null

                  selectedProductFromList = {
                    code: fullProduct.productCode,
                    name: fullProduct.name,
                    price: fullProduct.price,
                    description: fullProduct.description,
                    stock: fullProduct.stock,
                    supplierName: supplier?.companyName || "N/A",
                    region: fullProduct.region || "N/A",
                    formato: fullProduct.formato || "",
                    allergens: fullProduct.allergens || [],
                    categoryName: category?.name || "N/A",
                    certifications: fullProduct.certifications || [],
                  }

                  logger.info(`📦 Enriched product with full details`, {
                    productCode: fullProduct.productCode,
                    stock: fullProduct.stock,
                    supplier: supplier?.companyName,
                  })
                } else {
                  logger.warn(`⚠️ Product not found in memory`, {
                    searchedName: productName,
                    availableCount: allProducts.length,
                  })
                }
              }
            }
          } else {
            // 🎯 USER SELECTED GROUP NUMBER
            // Extract group text from LLM response
            const groupText = this.extractGroupText(
              lastResponse,
              selectedNumber
            )

            if (groupText) {
              // 🎯 Filter products by group keywords
              preFilteredProducts = this.filterByGroupKeywords(
                allProducts,
                groupText
              )
              forceNoGrouping = true

              logger.info(`📦 Filtered products for group ${selectedNumber}`, {
                groupText: groupText.substring(0, 50),
                originalCount: allProducts.length,
                filteredCount: preFilteredProducts.length,
              })
            } else {
              // Fallback if parsing fails
              preFilteredProducts = allProducts
              forceNoGrouping = true
              logger.warn(`⚠️ Could not parse group, using all products`)
            }
          }
        }
      }

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

      logger.info(`📦 Loaded dynamic content`, {
        productsLength: productsText.length,
        categoriesLength: categoriesText.length,
        offersLength: offersText.length,
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
          services: "", // Not used in product search
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

      // Feature 123: If user selected product from list, inject product details
      if (selectedProductFromList) {
        const productDetails = `
✅ USER SELECTED PRODUCT #${context.query} from previous list.

📦 FULL PRODUCT DETAILS:
   Code: ${selectedProductFromList.code}
   Name: ${selectedProductFromList.name}
   Formato: ${selectedProductFromList.formato || "N/A"}
   Price: €${selectedProductFromList.price}
   Description: ${selectedProductFromList.description || "N/A"}
   Stock: ${selectedProductFromList.stock || 0} units
   Supplier: ${selectedProductFromList.supplierName || "N/A"}
   Region: ${selectedProductFromList.region || "N/A"}
   Category: ${selectedProductFromList.categoryName || selectedProductFromList.category || "N/A"}
   Certifications: ${selectedProductFromList.certifications?.join(", ") || "None"}
   Allergens: ${selectedProductFromList.allergens?.join(", ") || "None"}

⚠️ CRITICAL: Show ALL details using Format C template (8-field mandatory):

**[CATEGORY]**
• ${selectedProductFromList.code} ${selectedProductFromList.name} ${selectedProductFromList.formato || ""}
  📝 ${selectedProductFromList.description || "N/A"}
  � Prezzo: ~€[ORIGINAL]~ → €${selectedProductFromList.price} (con sconto {{discountUser}}%)
  📦 Stock: ${selectedProductFromList.stock > 10 ? "✅" : selectedProductFromList.stock > 0 ? "⚠️" : "❌"} ${selectedProductFromList.stock} disponibili
  🏷️ Fornitore: ${selectedProductFromList.supplierName || "N/A"}
  🌍 Regione: ${selectedProductFromList.region || "N/A"}
  🔖 Certificazioni: ${selectedProductFromList.certifications?.join(", ") || "None"}

Then ask: "Vuoi aggiungerlo al carrello? 🛒"
`
        messages.push({
          role: "system" as const,
          content: productDetails,
        })

        logger.info(`📦 Injected full product details into conversation`, {
          productCode: selectedProductFromList.code,
          productName: selectedProductFromList.name,
          stock: selectedProductFromList.stock,
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

        // Execute function via ProductSearchAgent
        const functionResult = await this.executeFunction(
          functionName,
          functionArgs,
          context,
          preFilteredProducts, // Pass pre-filtered products if group selection
          forceNoGrouping // Force shouldGroup=false for drill-down
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

      // STEP 7: Save conversation to memory (10-minute TTL)
      try {
        // Check if we showed groups to the user (from shouldGroup flag)
        const searchFunctionCall = functionCalls.find(
          (fc) => fc.name === "searchProducts"
        )
        const shouldGroup = searchFunctionCall?.result?.shouldGroup
        const products = searchFunctionCall?.result?.products || []

        // Feature 123: Log grouping decision analytics
        if (searchFunctionCall) {
          const groupingDecision = this.analyzeGroupingStrategy(
            finalResponse,
            products
          )
          logger.info(`[ProductSearch] Grouping Decision Analytics`, {
            sessionId: context.sessionId,
            productsCount: products.length,
            shouldGroup,
            strategy: groupingDecision.strategy,
            groupsDetected: groupingDecision.groupCount,
            responsePreview: finalResponse.substring(0, 150),
          })
        }

        let groupsMetadata = null

        // Feature 123: If user selected product from list, save for cart
        if (selectedProductFromList) {
          groupsMetadata = {
            selectedProductCode: selectedProductFromList.code,
            productName: selectedProductFromList.name,
            timestamp: new Date().toISOString(),
          }

          logger.info(`📦 Storing user-selected product from list`, {
            selectedProductCode: selectedProductFromList.code,
            productName: selectedProductFromList.name,
          })
        }
        // 🔧 FIX: If showing SINGLE product, save selectedProductCode for cart handoff
        else if (products.length === 1) {
          const singleProduct = products[0]
          groupsMetadata = {
            selectedProductCode: singleProduct.code, // ✅ CRITICAL: Save for cart delegation
            productName: singleProduct.name,
            timestamp: new Date().toISOString(),
          }

          logger.info(`📦 Storing single product selection`, {
            selectedProductCode: singleProduct.code,
            productName: singleProduct.name,
          })
        } else if (shouldGroup && products.length >= 5) {
          // We showed groups - save products for later drill-down
          // The LLM created groups, but we need to store ALL products
          // so when user selects "1", we can filter by group

          logger.info(`📦 Storing grouped products in memory`, {
            productsTotal: products.length,
            shouldGroup,
          })

          // Store products with their attributes for group filtering
          groupsMetadata = products.map((p: any) => ({
            code: p.code,
            name: p.name,
            category: p.category,
            certifications: p.certifications || [],
            allergens: p.allergens || [],
            price: p.price,
          }))
        }

        await this.searchConversationRepo.upsert({
          sessionId: context.sessionId,
          workspaceId: context.workspaceId,
          customerId: context.customerId,
          lastQuery: context.query,
          lastResponse: finalResponse.substring(0, 500), // Truncate long responses
          metadata: groupsMetadata
            ? Array.isArray(groupsMetadata)
              ? {
                  groups: groupsMetadata,
                  shouldGroup,
                  timestamp: new Date().toISOString(),
                }
              : groupsMetadata // Single product metadata
            : null,
        })

        logger.info(`💾 Saved conversation to memory`, {
          sessionId: context.sessionId,
          hasGroups: Array.isArray(groupsMetadata),
          hasSingleProduct: groupsMetadata && !Array.isArray(groupsMetadata),
          selectedProductCode:
            groupsMetadata && !Array.isArray(groupsMetadata)
              ? groupsMetadata.selectedProductCode
              : undefined,
          productsCount: Array.isArray(groupsMetadata)
            ? groupsMetadata.length
            : 0,
          shouldGroup,
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
   * Execute function call via ProductSearchAgent
   * NOTE: All functions removed - LLM uses {{PRODUCTS}} from prompt only
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: ProductSearchLLMContext,
    preFilteredProducts: any[] | null = null,
    forceNoGrouping: boolean = false
  ): Promise<any> {
    try {
      logger.warn(
        `❌ Function calls disabled - using {{PRODUCTS}} from prompt`,
        {
          attemptedFunction: functionName,
        }
      )

      return {
        success: false,
        error: "Function calls disabled - LLM uses {{PRODUCTS}} from prompt",
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
   * NOTE: searchProducts REMOVED - LLM uses {{PRODUCTS}} from prompt only
   */
  private getProductSearchFunctions() {
    return []
  }

  /**
   * Extract group text from LLM response by group number
   * Parses format: "1. 🏆 Formaggi DOP (5 prodotti)"
   */
  private extractGroupText(
    llmResponse: string,
    groupNumber: number
  ): string | null {
    try {
      // Match: "N. emoji text (X prodotti/products)"
      const regex = new RegExp(
        `${groupNumber}\\.\\s+[^\\n]+\\(\\d+\\s+(prodott|product)`,
        "i"
      )
      const match = llmResponse.match(regex)

      if (match) {
        logger.info(`📋 Extracted group ${groupNumber} text`, {
          groupText: match[0].substring(0, 60),
        })
        return match[0]
      }

      logger.warn(`⚠️ Could not extract group ${groupNumber} from response`, {
        responseLength: llmResponse.length,
      })
      return null
    } catch (error) {
      logger.error(`❌ Error extracting group text:`, error)
      return null
    }
  }

  /**
   * Filter products by keywords extracted from group text
   * Uses certifications and category/name matching
   */
  private filterByGroupKeywords(products: any[], groupText: string): any[] {
    try {
      const lowerGroupText = groupText.toLowerCase()

      logger.info(`🔍 Filtering products by group keywords`, {
        groupText: groupText.substring(0, 60),
        totalProducts: products.length,
      })

      // Strategy 1: Filter by CERTIFICATION
      if (lowerGroupText.includes("halal")) {
        const filtered = products.filter((p: any) =>
          p.certifications?.some((c: any) => c.toLowerCase().includes("halal"))
        )
        logger.info(`✅ Filtered by Halal certification`, {
          filtered: filtered.length,
        })
        return filtered
      }

      if (lowerGroupText.includes("dop")) {
        const filtered = products.filter((p: any) =>
          p.certifications?.some((c: any) => c.toLowerCase().includes("dop"))
        )
        logger.info(`✅ Filtered by DOP certification`, {
          filtered: filtered.length,
        })
        return filtered
      }

      if (
        lowerGroupText.includes("bio") ||
        lowerGroupText.includes("organic")
      ) {
        const filtered = products.filter((p: any) =>
          p.certifications?.some(
            (c: any) =>
              c.toLowerCase().includes("bio") ||
              c.toLowerCase().includes("organic")
          )
        )
        logger.info(`✅ Filtered by BIO/Organic certification`, {
          filtered: filtered.length,
        })
        return filtered
      }

      // Strategy 2: Filter by CATEGORY/TYPE keywords
      if (
        lowerGroupText.includes("fresc") ||
        lowerGroupText.includes("fresh")
      ) {
        const filtered = products.filter(
          (p: any) =>
            p.category?.toLowerCase().includes("fresc") ||
            p.name?.toLowerCase().includes("fresc") ||
            !p.certifications?.some((c: any) => c.toLowerCase().includes("dop")) // Exclude DOP if looking for fresh
        )
        logger.info(`✅ Filtered by Fresh category`, {
          filtered: filtered.length,
        })
        return filtered
      }

      if (
        lowerGroupText.includes("stagionat") ||
        lowerGroupText.includes("aged")
      ) {
        const filtered = products.filter(
          (p: any) =>
            p.category?.toLowerCase().includes("stagionat") ||
            p.name?.toLowerCase().includes("stagionat")
        )
        logger.info(`✅ Filtered by Aged category`, {
          filtered: filtered.length,
        })
        return filtered
      }

      if (
        lowerGroupText.includes("tradizional") ||
        lowerGroupText.includes("traditional")
      ) {
        const filtered = products.filter(
          (p: any) =>
            !p.certifications?.some((c: any) =>
              c.toLowerCase().includes("halal")
            ) // Exclude Halal for traditional
        )
        logger.info(`✅ Filtered by Traditional (non-Halal)`, {
          filtered: filtered.length,
        })
        return filtered
      }

      // Strategy 3: Extract keywords and match in name/category
      const keywords = this.extractKeywords(lowerGroupText)
      const filtered = products.filter((p: any) => {
        const productText = `${p.name} ${p.category}`.toLowerCase()
        return keywords.some((keyword) => productText.includes(keyword))
      })

      if (filtered.length > 0) {
        logger.info(`✅ Filtered by keywords`, {
          keywords,
          filtered: filtered.length,
        })
        return filtered
      }

      // Fallback: return all if no match (better than empty)
      logger.warn(`⚠️ No specific filter matched, returning all products`, {
        groupText: groupText.substring(0, 40),
      })
      return products
    } catch (error) {
      logger.error(`❌ Error filtering products:`, error)
      return products // Return all on error
    }
  }

  /**
   * Extract meaningful keywords from group text
   * Removes emojis, numbers, common words
   */
  private extractKeywords(text: string): string[] {
    // Remove emojis, numbers, parentheses
    const cleaned = text.replace(/[0-9\(\)🏆🥛🧀🥓🍖]/g, " ").toLowerCase()

    // Split and filter common words
    const stopWords = [
      "prodotti",
      "products",
      "categoria",
      "category",
      "il",
      "la",
      "i",
      "le",
      "di",
      "con",
      "per",
    ]

    const keywords = cleaned
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.includes(word))

    return keywords
  }

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
}
