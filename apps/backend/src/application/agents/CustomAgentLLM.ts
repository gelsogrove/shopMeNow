/**
 * CustomAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle workspace-specific custom behaviors with dedicated LLM
 * 2. Load custom prompts and function definitions from workspace configuration
 * 3. Execute custom function calls defined per workspace
 * 4. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Custom system prompt from workspace database (agentType: CUSTOM)
 * - Custom function definitions per workspace
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → CustomAgentLLM
 * 2. Load custom prompt from workspace config (agentType: CUSTOM)
 * 3. Call LLM with custom functions
 * 4. Execute custom functions via workspace-specific logic
 * 5. Return English response with tokens → Router
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - NO translation (Router handles it)
 * - NO direct customer interaction
 * - Custom functions MUST be validated and sandboxed
 *
 * Use Cases:
 * - Industry-specific workflows (real estate, healthcare, legal)
 * - Custom integrations (CRM, ERP, third-party APIs)
 * - Specialized business logic unique to workspace
 *
 * @critical NEVER call LLMService - this is a SPECIALIST with OWN LLM
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { config } from "../../config"
import { TemplateLoaderService } from "../services/template-loader.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"

import { CustomerData } from "../../types/agent.types"

export interface CustomLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  /** Pre-loaded customer data from Router (avoids duplicate DB queries) */
  customerData?: CustomerData
  /** Custom parameters specific to workspace needs */
  customParams?: Record<string, any>
}

export interface CustomLLMResponse {
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

export class CustomAgentLLM {
  private prisma: PrismaClient
  private templateLoader: TemplateLoaderService
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.templateLoader = TemplateLoaderService.getInstance(prisma)

    // OpenRouter API configuration
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is required for CustomAgentLLM"
      )
    }
  }

  /**
   * Handle custom query with LLM
   */
  async handleQuery(
    context: CustomLLMContext
  ): Promise<CustomLLMResponse> {
    const startTime = Date.now()

    try {
      logger.info(`🎨 CustomAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query.substring(0, 100),
      })

      // STEP 1: Load workspace config and custom agent configuration
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        select: {
          name: true,
          botIdentityResponse: true,
          notificationEmail: true,
          customAiRules: true,
          websiteUrl: true,
          url: true,
        },
      })

      // STEP 1.5: Load custom agent config from agentConfig table
      const customAgentConfig = await this.prisma.agentConfig.findFirst({
        where: {
          workspaceId: context.workspaceId,
          agentType: "CUSTOM",
          isActive: true,
        },
        select: {
          systemPrompt: true,
          functionDefinitions: true, // JSON field with custom functions
          model: true,
          temperature: true,
          maxTokens: true,
        },
      })

      if (!customAgentConfig) {
        logger.warn(`⚠️ No CUSTOM agent config found for workspace ${context.workspaceId}`)
        return {
          success: false,
          output: "Custom agent is not configured for this workspace",
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
          functionCalls: [],
        }
      }

      // STEP 2: Load system prompt from template files or use custom from DB
      let systemPrompt = customAgentConfig.systemPrompt ||
        await this.templateLoader.loadAndRenderTemplate(
          "CUSTOM",
          context.workspaceId,
          {}
        )

      // Inject custom AI rules if available
      if (workspace?.customAiRules) {
        const rulesSection = `\n\n## ⚠️ PRIORITY RULES (OVERRIDE)\nThe following rules have PRIORITY over all other instructions:\n${workspace.customAiRules}\n`
        systemPrompt = systemPrompt + rulesSection
        logger.info(`⚙️ Injected custom AI rules into CUSTOM prompt`)
      }

      // STEP 3: Replace ALL variables
      const promptProcessor = new PromptProcessorService()

      const baseCustomerData = {
        nameUser: context.customerName || "",
        email: "",
        phone: "",
        discountUser: 0,
        companyName: workspace?.name || "",
        lastordercode: "",
        languageUser: context.customerLanguage || "it",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        botIdentityResponse: workspace?.botIdentityResponse || "",
        adminEmail: workspace?.notificationEmail || "",
      }

      const customerDataForPrompt = context.customerData ? {
        ...baseCustomerData,
        ...context.customerData,
        companyName: context.customerData.companyName || workspace?.name || baseCustomerData.companyName,
        botIdentityResponse: context.customerData.botIdentityResponse || workspace?.botIdentityResponse || "",
        adminEmail: context.customerData.adminEmail || workspace?.notificationEmail || "",
      } : baseCustomerData

      logger.info(`📋 CustomAgent customerDataForPrompt:`, {
        companyName: customerDataForPrompt.companyName,
        nameUser: customerDataForPrompt.nameUser,
        hasRouterData: !!context.customerData,
        workspaceName: workspace?.name,
      })

      const processedPrompt = await promptProcessor.preProcessPrompt(
        systemPrompt,
        context.workspaceId,
        customerDataForPrompt,
        {
          faqs: "",
          products: "",
          categories: "",
          services: "",
          offers: "",
        },
        workspace?.websiteUrl || workspace?.url,
        {
          sellsProductsAndServices: true,
          hasHumanSupport: true,
          hasSalesAgents: true,
          address: "",
          customAiRules: workspace?.customAiRules || "",
          botIdentityResponse: context.customerData?.botIdentityResponse || workspace?.botIdentityResponse || "",
          humanSupportInstructions: "",
          frustrationEscalationInstructions: "",
          adminEmail: context.customerData?.adminEmail || workspace?.notificationEmail || "",
          allowedExternalLinks: [],
          operatorContactMethod: "",
          operatorWhatsappNumber: "",
          supportEmail: workspace?.notificationEmail || "",
          websiteUrl: workspace?.websiteUrl || workspace?.url || "",
        }
      )

      logger.info(`✅ Variables replaced in CUSTOM prompt`, {
        originalLength: systemPrompt.length,
        processedLength: processedPrompt.length,
      })

      // STEP 4: Build messages for LLM
      const messages: any[] = [
        {
          role: "system" as const,
          content: processedPrompt,
        },
        {
          role: "user" as const,
          content: PromptProcessorService.wrapUserInput(context.query),
        },
      ]

      // STEP 5: Load custom functions from workspace config
      const functions = this.loadCustomFunctions(customAgentConfig.functionDefinitions)

      // STEP 6: Call LLM (OpenRouter)
      const llmResponse = await this.callLLM({
        model: customAgentConfig.model || "gpt-4o-mini",
        messages,
        functions,
        temperature: customAgentConfig.temperature || 0.7,
        maxTokens: customAgentConfig.maxTokens || 2000,
      })

      let totalTokens = llmResponse.tokensUsed
      let finalResponse = llmResponse.content || ""
      const functionCalls: any[] = []

      // STEP 7: Handle function calling loop
      if (llmResponse.function_call) {
        const functionName = llmResponse.function_call.name
        const functionArgs = JSON.parse(
          llmResponse.function_call.arguments || "{}"
        )

        // 🚨 CRITICAL SECURITY CHECK: SubLLM CANNOT call other SubLLMs!
        const forbiddenFunctions = [
          "cartManagementAgent",
          "productSearchAgent",
          "orderTrackingAgent",
          "customerSupportAgent",
          "safetyTranslationAgent",
        ]

        if (forbiddenFunctions.includes(functionName)) {
          logger.error(
            `🚨 SECURITY VIOLATION: CustomAgentLLM tried to call another SubLLM!`,
            {
              attemptedFunction: functionName,
              args: functionArgs,
            }
          )
          throw new Error(
            `INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`
          )
        }

        logger.info(`⚙️ CustomAgentLLM: Function call requested`, {
          functionName,
          args: functionArgs,
        })

        // Execute custom function
        const functionResult = await this.executeCustomFunction(
          functionName,
          functionArgs,
          context
        )

        functionCalls.push({
          name: functionName,
          arguments: functionArgs,
          result: functionResult,
        })

        // STEP 8: Return function result to LLM for final response
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
          model: customAgentConfig.model || "gpt-4o-mini",
          messages,
          functions,
          temperature: customAgentConfig.temperature || 0.7,
          maxTokens: customAgentConfig.maxTokens || 2000,
        })

        totalTokens += finalLLMResponse.tokensUsed
        finalResponse = finalLLMResponse.content || ""
      }

      const executionTimeMs = Date.now() - startTime

      logger.info(`✅ CustomAgentLLM: Query processed`, {
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
        systemPrompt: processedPrompt,
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime

      const errorInfo = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        ...(error && typeof error === "object" && "response" in error
          ? {
            status: (error as any).response?.status,
            statusText: (error as any).response?.statusText,
            data: (error as any).response?.data,
          }
          : {}),
      }

      logger.error("❌ CustomAgentLLM error:", errorInfo)

      return {
        success: false,
        output: "Error processing custom agent request",
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
      const tools = options.functions.map((fn) => ({
        type: "function",
        function: fn,
      }))

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: options.model,
          messages: options.messages,
          tools,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": config.appUrl,
            "X-Title": "eChatbot - Custom Agent",
          },
        }
      )

      const choice = response.data.choices?.[0]
      const message = choice?.message

      return {
        content: message?.content || null,
        function_call: message?.tool_calls?.[0]?.function,
        tokensUsed: response.data.usage?.total_tokens || 0,
      }
    } catch (error) {
      const errorInfo = {
        message: error instanceof Error ? error.message : String(error),
        status: (error as any)?.response?.status,
        statusText: (error as any)?.response?.statusText,
        data: (error as any)?.response?.data,
      }
      logger.error("❌ OpenRouter API call failed:", errorInfo)
      throw error
    }
  }

  /**
   * Load custom functions from workspace configuration
   */
  private loadCustomFunctions(functionDefinitions: any): any[] {
    try {
      // functionDefinitions is a JSON field in agentConfig table
      // Example format:
      // [
      //   {
      //     "name": "getCustomData",
      //     "description": "Get custom data from external API",
      //     "parameters": {
      //       "type": "object",
      //       "properties": { "id": { "type": "string" } },
      //       "required": ["id"]
      //     }
      //   }
      // ]

      if (!functionDefinitions) {
        logger.info(`No custom functions defined, returning default functions`)
        return this.getDefaultCustomFunctions()
      }

      if (typeof functionDefinitions === "string") {
        functionDefinitions = JSON.parse(functionDefinitions)
      }

      if (Array.isArray(functionDefinitions) && functionDefinitions.length > 0) {
        logger.info(`Loaded ${functionDefinitions.length} custom functions`)
        return functionDefinitions
      }

      return this.getDefaultCustomFunctions()
    } catch (error) {
      logger.error(`Error loading custom functions:`, error)
      return this.getDefaultCustomFunctions()
    }
  }

  /**
   * Default custom functions if none configured
   */
  private getDefaultCustomFunctions() {
    return [
      {
        name: "getCustomWorkspaceData",
        description: "Get workspace-specific custom data",
        parameters: {
          type: "object",
          properties: {
            dataType: {
              type: "string",
              description: "Type of data to retrieve",
            },
          },
          required: ["dataType"],
        },
      },
      {
        name: "executeCustomAction",
        description: "Execute a custom workspace-specific action",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "Action identifier",
            },
            parameters: {
              type: "object",
              description: "Action parameters",
            },
          },
          required: ["action"],
        },
      },
    ]
  }

  /**
   * Execute custom function call
   *
   * ⚠️ SECURITY: Custom functions MUST be validated and sandboxed
   * - No direct database access without workspace filtering
   * - No system commands execution
   * - All external API calls must be validated
   */
  private async executeCustomFunction(
    functionName: string,
    args: any,
    context: CustomLLMContext
  ): Promise<any> {
    try {
      // 🔒 SECURITY: Whitelist of allowed custom functions
      const allowedFunctions = [
        "getCustomWorkspaceData",
        "executeCustomAction",
        "callExternalAPI",
        "queryCustomDatabase",
      ]

      if (!allowedFunctions.includes(functionName)) {
        logger.warn(`🚨 Attempted to call non-whitelisted function: ${functionName}`)
        return {
          success: false,
          error: `Function ${functionName} is not allowed`,
        }
      }

      switch (functionName) {
        case "getCustomWorkspaceData": {
          // Example: Get custom data from workspace configuration
          const customData = await this.prisma.workspace.findUnique({
            where: { id: context.workspaceId },
            select: {
              customAiRules: true,
              botIdentityResponse: true,
            },
          })

          return {
            success: true,
            data: customData,
            dataType: args.dataType,
          }
        }

        case "executeCustomAction": {
          // Example: Execute a custom action
          logger.info(`🎯 Executing custom action: ${args.action}`, {
            workspaceId: context.workspaceId,
            parameters: args.parameters,
          })

          return {
            success: true,
            action: args.action,
            result: "Action executed successfully",
            timestamp: new Date().toISOString(),
          }
        }

        case "callExternalAPI": {
          // Example: Call external API (implement with caution)
          logger.info(`🌐 Calling external API`, {
            workspaceId: context.workspaceId,
            endpoint: args.endpoint,
          })

          return {
            success: true,
            message: "External API call functionality coming soon",
          }
        }

        case "queryCustomDatabase": {
          // Example: Query custom database table
          logger.info(`📊 Querying custom database`, {
            workspaceId: context.workspaceId,
            query: args.query,
          })

          return {
            success: true,
            message: "Custom database query functionality coming soon",
          }
        }

        default:
          logger.warn(`Unknown custom function: ${functionName}`)
          return {
            success: false,
            error: `Unknown custom function: ${functionName}`,
          }
      }
    } catch (error) {
      logger.error(`Error executing custom function ${functionName}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
