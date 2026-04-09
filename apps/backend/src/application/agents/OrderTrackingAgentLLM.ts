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
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/03-order-tracking.template.md)
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

import { AgentType, PrismaClient } from "@echatbot/database"
import axios from "axios"
import { config } from "../../config"
import { withOpenRouterRetry } from "../../utils/llm-retry"
import { OrderRepository } from "../../repositories/order.repository"
import { TemplateLoaderService } from "../services/template-loader.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import { CallingFunctionsService } from "../../services/calling-functions.service"
import { SystemContextService, getSystemContextService } from "../../services/system-context.service"
import logger from "../../utils/logger"
import { LinkGeneratorService } from "../services/link-generator.service"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"

import { CustomerData } from "../../types/agent.types"
import type { AgentOptionMapping } from "../../types/option-mapping.types"

export interface OrderTrackingLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  lastOrderCode?: string // ✅ Last order code (avoid extra query)
  /** Pre-loaded customer data from Router (avoids duplicate DB queries) */
  customerData?: CustomerData
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
  model?: string // 🆕 Model used for debugging timeline
  optionMapping?: AgentOptionMapping
}

export class OrderTrackingAgentLLM {
  private prisma: PrismaClient
  private orderRepo: OrderRepository
  private templateLoader: TemplateLoaderService
  private callingFunctionsService: CallingFunctionsService
  private systemContextService: SystemContextService
  private openRouterApiKey: string
  private openRouterBaseUrl: string
  private agentConfigRepo: AgentConfigRepository

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.orderRepo = new OrderRepository()
    this.templateLoader = TemplateLoaderService.getInstance(prisma)
    this.systemContextService = getSystemContextService(prisma)
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
    let directOptionMapping: AgentOptionMapping | undefined

    try {
      logger.info(`📦 OrderTrackingAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query.substring(0, 100),
      })

      // STEP 1: Load system prompt from template files
      let systemPromptRaw = await this.templateLoader.loadAndRenderTemplate(
        "ORDER_TRACKING",
        context.workspaceId
      )

      logger.info(`📋 Loaded ORDER_TRACKING template from files`, {
        promptLength: systemPromptRaw.length,
      })

      // 🆕 STEP 1.3: Load workspace config for dynamic fields (customAiRules, botIdentityResponse, etc.)
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        select: {
          name: true,
          address: true,
          customAiRules: true,
          botIdentityResponse: true,
        },
      })

      // Replace variables in system prompt
      if (context.lastOrderCode) {
        systemPromptRaw = systemPromptRaw.replace(
          /\{\{lastordercode\}\}/g,
          context.lastOrderCode
        )
        logger.info(
          `✅ Replaced {{lastordercode}} with: ${context.lastOrderCode}`
        )
      }

      // 🔧 STEP 1.5: Replace ALL variables ({{companyName}}, {{nameUser}}, etc.)
      // CRITICAL: Must call preProcessPrompt to render variables before passing to LLM
      const promptProcessor = new PromptProcessorService()
      
      // 🔧 OPTIMIZATION: Use pre-loaded customerData from Router if available (avoids duplicate DB queries)
      // 🔴 CRITICAL FIX: Merge Router data with workspace fallbacks to ensure no empty values
      const baseCustomerData = {
        nameUser: context.customerName || "",
        email: "",
        phone: "",
        discountUser: 0,
        companyName: workspace?.name || "",
        lastordercode: context.lastOrderCode || "",
        languageUser: context.customerLanguage || "en",
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
        lastordercode: context.lastOrderCode || context.customerData.lastordercode || "",
      } : baseCustomerData
      
      // 🔍 DEBUG: Log what we're passing to preProcessPrompt
      logger.info(`📋 OrderTrackingAgent customerDataForPrompt:`, {
        companyName: customerDataForPrompt.companyName,
        nameUser: customerDataForPrompt.nameUser,
        lastordercode: customerDataForPrompt.lastordercode,
        hasRouterData: !!context.customerData,
        workspaceName: workspace?.name,
      })
      
      const systemPrompt = await promptProcessor.preProcessPrompt(
        systemPromptRaw,
        context.workspaceId,
        customerDataForPrompt,
        {
          faqs: "",
          products: "",
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

      logger.info(`✅ Variables replaced in ORDER_TRACKING prompt`, {
        originalLength: systemPromptRaw.length,
        processedLength: systemPrompt.length,
      })

      // STEP 2: Build messages for LLM
      const messages: any[] = [
        {
          role: "system" as const,
          content: systemPrompt, // ✅ Use prompt with replaced variables
        },
        {
          role: "user" as const,
          content: PromptProcessorService.wrapUserInput(context.query),
        },
      ]

      // STEP 3: Define function calls for order tracking
      const functions = this.getOrderTrackingFunctions()

      // STEP 4: Resolve model/temperature from DB or fallback defaults
      const agentConfig =
        (await this.agentConfigRepo.findByType(
          context.workspaceId,
          "ORDER_TRACKING" as AgentType
        )) || undefined

      const model = agentConfig?.model || "gpt-4o-mini"
      const temperature =
        agentConfig?.temperature !== undefined
          ? Number(agentConfig.temperature)
          : 0.7
      const maxTokens = agentConfig?.maxTokens || 2000

      // STEP 4: Call LLM (OpenRouter)
      const llmResponse = await this.callLLM({
        model,
        messages,
        functions,
        temperature,
        maxTokens,
      })

      let totalTokens = llmResponse.tokensUsed
      let finalResponse = llmResponse.content || ""
      const functionCalls: any[] = []

      // 🔍 DEBUG: Log LLM response to understand empty responses
      logger.info(`🔍 OrderTrackingAgentLLM: LLM Response received`, {
        hasContent: !!llmResponse.content,
        contentLength: llmResponse.content?.length || 0,
        hasFunctionCall: !!llmResponse.function_call,
        functionCallName: llmResponse.function_call?.name || null,
        tokensUsed: llmResponse.tokensUsed,
      })

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

        // 🔧 DIRECT RETURN: For repeatOrder, confirmOrder, showCheckout - return message directly without LLM reformulation
        // This preserves formatting (newlines, markdown, etc.)
        const isRepeatOrder = functionName.toLowerCase() === "repeatorder"
        const isConfirmOrder = functionName.toLowerCase() === "confirmorder"
        const isShowCheckout = functionName.toLowerCase() === "showcheckout"
        const shouldReturnDirectly = isRepeatOrder || isConfirmOrder || isShowCheckout
        
        logger.info(`🔍 Function check: functionName="${functionName}", shouldReturnDirectly=${shouldReturnDirectly}, success=${functionResult?.success}, hasMessage=${!!functionResult?.message}`)
        
        if (shouldReturnDirectly && functionResult?.success && functionResult?.message) {
          logger.info(`🚀 ${functionName}: Returning message directly (no LLM reformulation)`)
          logger.info(`📝 Message preview: ${functionResult.message.substring(0, 200)}...`)
          finalResponse = functionResult.message
          
          if (functionResult.nextActions) {
            directOptionMapping = functionResult.nextActions as AgentOptionMapping
          }
          
          // 🔧 Replace customer variables in the response
          if (finalResponse.includes("{{nameUser}}") || finalResponse.includes("{{agentName}}")) {
            // Fetch agent name from customer's assigned sales rep
            let agentName = "our team"
            try {
              const customer = await this.prisma.customers.findUnique({
                where: { id: context.customerId },
                include: { sales: true }
              })
              if (customer?.sales) {
                agentName = `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
              }
            } catch (e) {
              logger.warn("Could not fetch customer sales rep, using default")
            }
            
            finalResponse = finalResponse
              .replace(/\{\{nameUser\}\}/gi, context.customerName || "Customer")
              .replace(/\{\{agentName\}\}/gi, agentName)
            logger.info(`🔄 Replaced customer variables in direct response: nameUser=${context.customerName}, agentName=${agentName}`)
          }
          
          // Generate proper PROFILE link (not cart link!) - for repeatOrder and showCheckout
          if ((isRepeatOrder || isShowCheckout || isConfirmOrder) && finalResponse && finalResponse.includes("[LINK_PROFILE_WITH_TOKEN]")) {
            try {
              const CallingFunctionsService = require("../../services/calling-functions.service").CallingFunctionsService
              const callingFunctionsService = new CallingFunctionsService()
              const profileLinkResult = await callingFunctionsService.getProfileLink({
                customerId: context.customerId,
                workspaceId: context.workspaceId,
              })
              
              if (profileLinkResult?.success && profileLinkResult?.linkUrl) {
                finalResponse = finalResponse.replace(
                  /\[LINK_PROFILE_WITH_TOKEN\]/gi,
                  profileLinkResult.linkUrl
                )
                logger.info(`🔗 Replaced [LINK_PROFILE_WITH_TOKEN] → ${profileLinkResult.linkUrl}`)
              } else {
                logger.warn(`⚠️ Failed to generate profile link, keeping token`)
              }
            } catch (error) {
              logger.error(`❌ Error generating profile link:`, error)
            }
          }
        } else {
          // STEP 6: Return function result to LLM for final response (default behavior)
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
            model,
            messages,
            functions,
            temperature,
            maxTokens,
          })

          totalTokens += finalLLMResponse.tokensUsed
          finalResponse = finalLLMResponse.content || ""

          // 🔗 Replace [LINK_ORDER_WITH_TOKEN] with secure short link
          logger.info(`🔍 Checking for LINK_ORDER_WITH_TOKEN replacement:`, {
            hasSecureLink: !!functionResult?.secureLink,
            secureLink: functionResult?.secureLink,
            hasPlaceholder: finalResponse?.includes('[LINK_ORDER_WITH_TOKEN]'),
          })
          
          if (finalResponse?.includes('[LINK_ORDER_WITH_TOKEN]')) {
            if (functionResult?.secureLink) {
              finalResponse = finalResponse.replace(
                /\[LINK_ORDER_WITH_TOKEN\]/gi,
                functionResult.secureLink
              )
              logger.info(`🔗 Replaced [LINK_ORDER_WITH_TOKEN] → ${functionResult.secureLink}`)
            } else {
              // 🔧 Fallback: Generate the link now if not available
              logger.warn(`⚠️ secureLink not found in functionResult, generating now...`)
              try {
                // Try to extract orderCode from functionResult
                const orderCode = functionResult?.orderCode || functionResult?.order?.orderCode
                if (orderCode) {
                  const linkResult = await this.callingFunctionsService.getOrdersListLink({
                    customerId: context.customerId,
                    workspaceId: context.workspaceId,
                    orderCode: orderCode,
                  })
                  if (linkResult?.linkUrl) {
                    finalResponse = finalResponse.replace(
                      /\[LINK_ORDER_WITH_TOKEN\]/gi,
                      linkResult.linkUrl
                    )
                    logger.info(`🔗 Generated and replaced [LINK_ORDER_WITH_TOKEN] → ${linkResult.linkUrl}`)
                  } else {
                    // Remove placeholder if we can't generate link
                    finalResponse = finalResponse.replace(
                      /\[LINK_ORDER_WITH_TOKEN\]/gi,
                      '(link non disponibile)'
                    )
                    logger.warn(`⚠️ Could not generate order link, placeholder removed`)
                  }
                } else {
                  // Remove placeholder if no orderCode
                  finalResponse = finalResponse.replace(
                    /\[LINK_ORDER_WITH_TOKEN\]/gi,
                    '(link non disponibile)'
                  )
                  logger.warn(`⚠️ No orderCode found, placeholder removed`)
                }
              } catch (linkError) {
                logger.error(`❌ Error generating fallback order link:`, linkError)
                finalResponse = finalResponse.replace(
                  /\[LINK_ORDER_WITH_TOKEN\]/gi,
                  '(link non disponibile)'
                )
              }
            }
          }
        }
      }

      const executionTimeMs = Date.now() - startTime

      // 🔧 FALLBACK: If response is empty, provide a helpful message
      if (!finalResponse || finalResponse.trim() === "") {
        logger.warn(`⚠️ OrderTrackingAgentLLM: Empty response detected, using fallback`)
        finalResponse = "I'm sorry, I couldn't process your request. Please try again or ask in a different way."
      }

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
        model: "gpt-4o-mini", // 🆕 Include model for debugging timeline
        optionMapping: directOptionMapping,
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

      const response = await withOpenRouterRetry(() => axios.post(
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
            "X-Title": "eChatbot - Order Tracking Agent",
          },
        }
      ))

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
          const limit = args.limit || 20
          const allOrders = await this.orderRepo.findByCustomerId(
            context.customerId, // ✅ customerId first
            context.workspaceId // ✅ workspaceId second
          )

          // Return only the first N orders (already sorted by date DESC)
          const limitedOrders = allOrders.slice(0, Math.min(limit, 50))

          return limitedOrders.map((order: any) => ({
            orderCode: order.orderCode,
            createdAt: order.createdAt,
            totalAmount: order.totalAmount || 0, // ✅ Fixed: use totalAmount, not totalPrice
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
          // Call repeatOrder domain function directly
          const {
            repeatOrder,
          } = require("../../domain/calling-functions/repeatOrder")
          return await repeatOrder({
            customerId: context.customerId,
            workspaceId: context.workspaceId,
            orderCode: args.orderCode, // Optional - uses last order if not provided
          })

        case "confirmOrder":
          // Call confirmOrder domain function to create order from cart
          const {
            confirmOrder,
          } = require("../../domain/calling-functions/confirmOrder")
          return await confirmOrder({
            customerId: context.customerId,
            workspaceId: context.workspaceId,
          })

        case "showCheckout":
          // Call showCheckout domain function to display cart summary
          const {
            showCheckout,
          } = require("../../domain/calling-functions/showCheckout")
          return await showCheckout({
            customerId: context.customerId,
            workspaceId: context.workspaceId,
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
          "Get last N orders with summary details (orderCode, date, total, status). Use this when customer asks for 'orders', 'my orders', 'recent orders' or 'order history'.",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of orders to return (default: 20, max: 50). Use default to show all recent orders.",
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
      {
        name: "confirmOrder",
        description:
          "Confirm the current cart and create a new order. Use when customer says 'confermo', 'ok', 'procedi', 'conferma ordine' after seeing the cart summary. Creates the order, clears the cart, and returns success message.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "showCheckout",
        description:
          "Show cart summary and ask for order confirmation. Use when customer wants to proceed with checkout: 'checkout', 'procedi all'ordine', 'voglio comprare', 'finalizza acquisto'. Shows cart contents, total with discounts, and link to verify shipping data.",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ]
  }
}
