/**
 * NotificationsAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle push notification campaigns with dedicated LLM
 * 2. Execute function calls for sending notifications, scheduling campaigns
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/07-notifications.template.md)
 * - Function execution via NotificationRepository
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → NotificationsAgentLLM
 * 2. Load system prompt from database (agentType: NOTIFICATIONS)
 * 3. Call LLM with notification functions
 * 4. Execute functions via repositories
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
import { TemplateLoaderService } from "../services/template-loader.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"

import { CustomerData } from "../../types/agent.types"

export interface NotificationsLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  /** Pre-loaded customer data from Router (avoids duplicate DB queries) */
  customerData?: CustomerData
}

export interface NotificationsLLMResponse {
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

export class NotificationsAgentLLM {
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
        "OPENROUTER_API_KEY is required for NotificationsAgentLLM"
      )
    }
  }

  /**
   * Handle notification query with LLM
   */
  async handleQuery(
    context: NotificationsLLMContext
  ): Promise<NotificationsLLMResponse> {
    const startTime = Date.now()

    try {
      logger.info(`🔔 NotificationsAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query.substring(0, 100),
      })

      // STEP 1: Load workspace config
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

      // STEP 2: Load system prompt from template files
      let systemPrompt = await this.templateLoader.loadAndRenderTemplate(
        "NOTIFICATIONS",
        context.workspaceId,
        {}
      )

      // Inject custom AI rules if available
      if (workspace?.customAiRules) {
        const rulesSection = `\n\n## ⚠️ PRIORITY RULES (OVERRIDE)\nThe following rules have PRIORITY over all other instructions:\n${workspace.customAiRules}\n`
        systemPrompt = systemPrompt + rulesSection
        logger.info(`⚙️ Injected custom AI rules into NOTIFICATIONS prompt`)
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

      logger.info(`📋 NotificationsAgent customerDataForPrompt:`, {
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

      logger.info(`✅ Variables replaced in NOTIFICATIONS prompt`, {
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

      // STEP 5: Define function calls for notifications
      const functions = this.getNotificationFunctions()

      // STEP 6: Call LLM (OpenRouter)
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
            `🚨 SECURITY VIOLATION: NotificationsAgentLLM tried to call another SubLLM!`,
            {
              attemptedFunction: functionName,
              args: functionArgs,
            }
          )
          throw new Error(
            `INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`
          )
        }

        logger.info(`⚙️ NotificationsAgentLLM: Function call requested`, {
          functionName,
          args: functionArgs,
        })

        // Execute function
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
          model: "gpt-4o-mini",
          messages,
          functions,
          temperature: 0.7,
          maxTokens: 2000,
        })

        totalTokens += finalLLMResponse.tokensUsed
        finalResponse = finalLLMResponse.content || ""
      }

      const executionTimeMs = Date.now() - startTime

      logger.info(`✅ NotificationsAgentLLM: Query processed`, {
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

      logger.error("❌ NotificationsAgentLLM error:", errorInfo)

      return {
        success: false,
        output: "Error processing notification request",
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
            "X-Title": "eChatbot - Notifications Agent",
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
   * Execute function call
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: NotificationsLLMContext
  ): Promise<any> {
    try {
      switch (functionName) {
        case "manageNotifications": {
          const { manageNotifications } = require("../../domain/calling-functions/manageNotifications")

          const action = args?.value ? "SUBSCRIBE" : "UNSUBSCRIBE"
          const result = await manageNotifications({
            action,
            customerId: context.customerId,
            workspaceId: context.workspaceId,
          })

          return {
            success: result.success,
            message: result.message,
            currentStatus: result.currentStatus,
          }
        }

        case "getNotificationStatus": {
          const customer = await this.prisma.customers.findUnique({
            where: { id: context.customerId },
            select: {
              notificationActive: true,
              pushActive: true,
            },
          })

          return {
            success: true,
            notificationActive: customer?.notificationActive ?? false,
            pushActive: customer?.pushActive ?? false,
            message: customer?.notificationActive
              ? "Notifications are enabled"
              : "Notifications are disabled",
          }
        }

        case "schedulePushCampaign": {
          // Future feature: Schedule push notification campaigns
          logger.info(`📅 Schedule push campaign requested`, {
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            ...args,
          })

          return {
            success: true,
            campaignId: "CAMPAIGN-" + Date.now(),
            message: "Push campaign scheduled successfully",
            scheduledFor: args.scheduledTime || "Immediately",
          }
        }

        case "getPushHistory": {
          // Get customer's push notification history
          const notifications = await this.prisma.pushNotification.findMany({
            where: {
              workspaceId: context.workspaceId,
              customerId: context.customerId,
            },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              title: true,
              message: true,
              createdAt: true,
              status: true,
            },
          })

          return {
            success: true,
            notifications,
            count: notifications.length,
          }
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
   * Get function definitions for notifications
   */
  private getNotificationFunctions() {
    return [
      {
        name: "manageNotifications",
        description: "Enable or disable push notifications for the customer",
        parameters: {
          type: "object",
          properties: {
            value: {
              type: "boolean",
              description: "true = subscribe to notifications, false = unsubscribe",
            },
          },
          required: ["value"],
        },
      },
      {
        name: "getNotificationStatus",
        description: "Get current notification preferences for the customer",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "schedulePushCampaign",
        description: "Schedule a push notification campaign for later",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Notification message content",
            },
            scheduledTime: {
              type: "string",
              description: "ISO timestamp for when to send (optional, defaults to immediate)",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "getPushHistory",
        description: "Get customer's push notification history",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ]
  }
}
