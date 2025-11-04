/**
 * CustomerSupportAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle customer support queries with dedicated LLM
 * 2. Execute function calls for FAQ, support tickets, complaints
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from database (agentConfig.CUSTOMER_SUPPORT)
 * - Function execution via FAQRepository
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → CustomerSupportAgentLLM
 * 2. Load system prompt from database (agentType: CUSTOMER_SUPPORT)
 * 3. Call LLM with support functions
 * 4. Execute functions via FAQRepository
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
import { FAQRepository } from "../../repositories/faq.repository"
import logger from "../../utils/logger"

export interface CustomerSupportLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
}

export interface CustomerSupportLLMResponse {
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

export class CustomerSupportAgentLLM {
  private prisma: PrismaClient
  private faqRepo: FAQRepository
  private agentConfigRepo: AgentConfigRepository
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.faqRepo = new FAQRepository(prisma)
    this.agentConfigRepo = new AgentConfigRepository(prisma)

    // OpenRouter API configuration
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required for CustomerSupportAgentLLM"
      )
    }
  }

  /**
   * Handle customer support query with LLM
   */
  async handleQuery(
    context: CustomerSupportLLMContext
  ): Promise<CustomerSupportLLMResponse> {
    const startTime = Date.now()

    try {
      logger.info(`💬 CustomerSupportAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query.substring(0, 100),
      })

      // STEP 1: Load system prompt from database
      const agentConfig = await this.agentConfigRepo.findByType(
        context.workspaceId,
        "CUSTOMER_SUPPORT"
      )

      if (!agentConfig || !agentConfig.isActive) {
        throw new Error(
          "CustomerSupportAgent configuration not found or inactive"
        )
      }

      logger.info(`📋 Loaded CUSTOMER_SUPPORT prompt from database`, {
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

      // STEP 3: Define function calls for customer support
      const functions = this.getCustomerSupportFunctions()

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

        logger.info(`⚙️ CustomerSupportAgentLLM: Function call requested`, {
          functionName,
          args: functionArgs,
        })

        // Execute function via FAQRepository
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

      logger.info(`✅ CustomerSupportAgentLLM: Query processed`, {
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

      logger.error("❌ CustomerSupportAgentLLM error:", errorInfo)

      return {
        success: false,
        output: "Error processing customer support request",
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
            "X-Title": "ShopME - Customer Support Agent",
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
   * Execute function call via FAQRepository
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: CustomerSupportLLMContext
  ): Promise<any> {
    try {
      switch (functionName) {
        case "searchFAQ":
          return await this.faqRepo.searchByKeywords(
            context.workspaceId,
            args.query,
            5 // Limit to top 5 results
          )

        case "getFAQByCategory":
          return await this.faqRepo.findByCategory(
            context.workspaceId,
            args.category
          )

        case "createSupportTicket":
          // TODO: Implement support ticket creation
          return {
            success: true,
            ticketId: "TICKET-" + Date.now(),
            message:
              "Support ticket created successfully. Our team will contact you soon.",
          }

        case "contactSales":
          // Get sales agent info from customer
          const customer = await this.prisma.customers.findUnique({
            where: { id: context.customerId },
            include: { sales: true },
          })

          if (!customer || !customer.sales) {
            return {
              success: false,
              error: "No sales agent assigned to this customer",
            }
          }

          return {
            success: true,
            salesAgent: {
              name: `${customer.sales.firstName} ${customer.sales.lastName}`,
              email: customer.sales.email,
              phone: customer.sales.phone,
            },
            message: `Your sales agent is ${customer.sales.firstName} ${customer.sales.lastName}. You can contact them at ${customer.sales.email} or ${customer.sales.phone}.`,
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
   * Get function definitions for customer support
   */
  private getCustomerSupportFunctions() {
    return [
      {
        name: "searchFAQ",
        description: "Search FAQ database for answers to customer questions",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query for FAQ",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "getFAQByCategory",
        description:
          "Get FAQ entries by category (e.g., 'shipping', 'returns', 'payment')",
        parameters: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "FAQ category name",
            },
          },
          required: ["category"],
        },
      },
      {
        name: "createSupportTicket",
        description:
          "Create a support ticket for issues that require manual attention",
        parameters: {
          type: "object",
          properties: {
            subject: {
              type: "string",
              description: "Ticket subject/title",
            },
            description: {
              type: "string",
              description: "Detailed description of the issue",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              description: "Ticket priority level",
            },
          },
          required: ["subject", "description"],
        },
      },
      {
        name: "contactSales",
        description: "Get sales agent contact information for this customer",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ]
  }
}
