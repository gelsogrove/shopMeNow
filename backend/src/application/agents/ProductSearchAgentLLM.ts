/**
 * ProductSearchAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle product search queries with dedicated LLM
 * 2. Execute function calls for product search/filtering
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from database (agentConfig.PRODUCT_SEARCH)
 * - Function execution via ProductSearchAgent
 * - Returns English ONLY (Router handles translation via SafetyTranslationAgent)
 *
 * Flow:
 * 1. Router delegates query → ProductSearchAgentLLM
 * 2. Load system prompt from database (agentType: PRODUCT_SEARCH)
 * 3. Call LLM with product search functions
 * 4. Execute functions via ProductSearchAgent
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
import { AgentConfigRepository } from "../../repositories/agent-config.repository"
import logger from "../../utils/logger"
import { ProductSearchAgent } from "./ProductSearchAgent"

export interface ProductSearchLLMContext {
  workspaceId: string
  customerId: string
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
}

export class ProductSearchAgentLLM {
  private prisma: PrismaClient
  private productSearchAgent: ProductSearchAgent
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.productSearchAgent = new ProductSearchAgent(prisma)
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
        query: context.query.substring(0, 100),
      })

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

        logger.info(`⚙️ ProductSearchAgentLLM: Function call requested`, {
          functionName,
          args: functionArgs,
        })

        // Execute function via ProductSearchAgent
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
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime

      logger.error("❌ ProductSearchAgentLLM error:", error)

      return {
        success: false,
        output:
          "I encountered an error while searching for products. Please try again.",
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
            "X-Title": "ShopME - Product Search Agent",
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
   * Execute function call via ProductSearchAgent
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: ProductSearchLLMContext
  ): Promise<any> {
    try {
      switch (functionName) {
        case "searchProducts":
          return await this.productSearchAgent.search(context.workspaceId, {
            detectedLanguage: context.customerLanguage || "en",
            keywords: args.keywords || [],
            filters: args.filters,
          })

        case "getProductDetails":
          // TODO: Implement if needed
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
   * Get function definitions for product search
   */
  private getProductSearchFunctions() {
    return [
      {
        name: "searchProducts",
        description:
          "Search for products by keywords, category, price range, allergens, or certifications",
        parameters: {
          type: "object",
          properties: {
            keywords: {
              type: "array",
              items: { type: "string" },
              description:
                "Keywords to search for in product names/descriptions",
            },
            filters: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  description: "Product category ID",
                },
                minPrice: {
                  type: "number",
                  description: "Minimum price filter",
                },
                maxPrice: {
                  type: "number",
                  description: "Maximum price filter",
                },
                allergens: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Filter by allergens (e.g., 'lactose-free', 'gluten-free')",
                },
                certifications: {
                  type: "array",
                  items: { type: "string" },
                  description:
                    "Filter by certifications (e.g., 'organic', 'dop', 'igp')",
                },
              },
            },
          },
          required: [],
        },
      },
    ]
  }
}
