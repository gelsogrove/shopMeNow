/**
 * ProfileManagementAgentLLM - Profile Management Agent
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle profile updates (email, notifications, preferences)
 * 2. Manage notification subscriptions via handlePushNotifications function
 * 3. Return direct response in customer's language
 *
 * @architecture Clean separation: Profile management ONLY
 * @functions handlePushNotifications(value: boolean) - Enable/disable push notifications
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { PROFILE_MANAGEMENT_FUNCTIONS } from "../../config/agent-functions.config"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"

export interface ProfileManagementContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  conversationHistory?: Array<{ role: string; content: string }> // ✅ Add conversation history for confirmation flows
}

export interface ProfileManagementResponse {
  success: boolean
  output: string
  tokensUsed: number
  executionTimeMs: number
  functionCalls?: Array<{
    function: string
    arguments: any
  }>
  systemPrompt?: string
  debugInfo?: any
}

export class ProfileManagementAgentLLM {
  private openRouterApiKey: string
  private openRouterBaseUrl = "https://openrouter.ai/api/v1"

  constructor(private prisma: PrismaClient) {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required")
    }
  }

  async handleQuery(
    context: ProfileManagementContext
  ): Promise<ProfileManagementResponse> {
    const startTime = Date.now()
    let totalTokens = 0

    try {
      logger.info(`👤 Profile Management Agent - Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query,
      })

      // Load agent config from database
      const agentConfig = await this.prisma.agentConfig.findFirst({
        where: {
          workspaceId: context.workspaceId,
          name: { contains: "Profile" },
        },
      })

      if (!agentConfig) {
        throw new Error("Profile Management Agent config not found")
      }

      // Get customer data
      const customer = await this.prisma.customers.findUnique({
        where: { id: context.customerId },
      })

      const promptProcessor = new PromptProcessorService()

      // Map customer data
      const customerData = customer
        ? {
            nameUser: customer.name || "Cliente",
            email: customer.email || "",
            phone: customer.phone || "",
            discountUser: customer.discount || 0,
            languageUser: customer.language || "ITALIANO",
            pushNotificationsConsent: customer.push_notifications_consent,
          }
        : {}

      // Process prompt (replace variables)
      const processedPrompt = await promptProcessor.preProcessPrompt(
        agentConfig.systemPrompt,
        context.workspaceId,
        customerData,
        {
          faqs: "",
          products: "",
          categories: "",
          services: "",
          offers: "",
        }
      )

      logger.info(`📄 Profile Management Agent - Prompt processed`)

      // Get available functions for Profile Management Agent
      // Use PROFILE_MANAGEMENT_FUNCTIONS which includes both handlePushNotifications and getProfileLink
      const profileFunctions = PROFILE_MANAGEMENT_FUNCTIONS

      // Build messages array with conversation history
      const messages: Array<{ role: string; content: string }> = [
        { role: "system" as const, content: processedPrompt },
      ]

      // Add conversation history if provided (for confirmation flows)
      if (
        context.conversationHistory &&
        context.conversationHistory.length > 0
      ) {
        logger.info(`📜 Adding conversation history to ProfileManagement`, {
          historyLength: context.conversationHistory.length,
        })
        messages.push(...context.conversationHistory)
      }

      // Add current user message
      messages.push({ role: "user" as const, content: context.query })

      const functionCalls: Array<{ function: string; arguments: any }> = []
      let iterations = 0
      const maxIterations = 3
      let finalResponse = ""

      while (iterations < maxIterations) {
        iterations++

        logger.info(
          `🔄 Profile Management Agent - Iteration ${iterations}/${maxIterations}`
        )

        // Call LLM with function calling
        const llmResponse = await this.callLLM({
          model: agentConfig.model,
          messages,
          functions: profileFunctions,
          temperature: agentConfig.temperature,
          maxTokens: agentConfig.maxTokens,
        })

        totalTokens += llmResponse.tokensUsed

        // Check if LLM wants to call a function
        if (llmResponse.function_call) {
          const functionName = llmResponse.function_call.name
          const functionArgs = JSON.parse(
            llmResponse.function_call.arguments || "{}"
          )

          logger.info(`⚙️ ProfileManagementAgent calling: ${functionName}`, {
            args: functionArgs,
          })

          // Track function call
          functionCalls.push({
            function: functionName,
            arguments: functionArgs,
          })

          // Execute function
          const functionResult = await this.executeFunction(
            functionName,
            functionArgs,
            context
          )

          logger.info(`✅ Function ${functionName} executed`, {
            result: functionResult,
          })

          // Add function result to messages
          messages.push({
            role: "assistant" as const,
            content: llmResponse.content || null,
            function_call: llmResponse.function_call,
          } as any)

          messages.push({
            role: "function" as const,
            name: functionName,
            content: JSON.stringify(functionResult),
          } as any)

          // Continue loop to get final response
          continue
        }

        // No function call - final response
        finalResponse = llmResponse.content || ""
        break
      }

      if (!finalResponse) {
        finalResponse =
          "Mi dispiace, non sono riuscito a completare la richiesta."
      }

      const executionTimeMs = Date.now() - startTime

      logger.info(`✅ Profile Management Agent completed`, {
        iterations,
        functionCallsCount: functionCalls.length,
        tokensUsed: totalTokens,
        executionTimeMs,
        responsePreview: finalResponse.substring(0, 100),
      })

      return {
        success: true,
        output: finalResponse,
        tokensUsed: totalTokens,
        executionTimeMs,
        functionCalls,
        systemPrompt: processedPrompt,
      }
    } catch (error: any) {
      logger.error("❌ Profile Management Agent error:", error)

      return {
        success: false,
        output:
          "Mi dispiace, c'è stato un problema. Contatta il supporto per assistenza.",
        tokensUsed: totalTokens,
        executionTimeMs: Date.now() - startTime,
        functionCalls: [],
      }
    }
  }

  /**
   * Execute function call
   */
  private async executeFunction(
    functionName: string,
    args: any,
    context: ProfileManagementContext
  ): Promise<any> {
    try {
      if (functionName === "handlePushNotifications") {
        // Call ManageNotifications domain function
        const {
          ManageNotifications,
        } = require("../../domain/calling-functions/ManageNotifications")

        const action = args.value ? "SUBSCRIBE" : "UNSUBSCRIBE"

        const result = await ManageNotifications({
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

      if (functionName === "getProfileLink") {
        // Generate secure profile link with token
        const {
          CallingFunctionsService,
        } = require("../../services/calling-functions.service")
        const callingFunctions = new CallingFunctionsService()

        const result = await callingFunctions.getProfileLink({
          customerId: context.customerId,
          workspaceId: context.workspaceId,
        })

        logger.info("✅ Profile link generated", {
          customerId: context.customerId,
          tokenGenerated: !!result.token,
        })

        return {
          success: true,
          token: result.token,
          link: result.link,
          expiresAt: result.expiresAt,
          message: "Profile link generated successfully",
        }
      }

      return {
        success: false,
        message: `Unknown function: ${functionName}`,
      }
    } catch (error) {
      logger.error(`❌ Error executing ${functionName}:`, error)
      return {
        success: false,
        message: "Function execution failed",
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
      // Functions already come in correct tools format from PROFILE_MANAGEMENT_FUNCTIONS
      // No need to wrap them again - they already have { type: "function", function: {...} }
      const tools = options.functions

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
            "X-Title": "eChatbot - Profile Management Agent",
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
      logger.error("❌ OpenRouter API call failed:", error)
      throw error
    }
  }
}
