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

import { AgentType, PrismaClient } from "@echatbot/database"
import axios from "axios"
import { withOpenRouterRetry } from "../../utils/llm-retry"
import { PROFILE_MANAGEMENT_FUNCTIONS } from "../../config/agent-functions.config"
import { PromptBuilderService } from "../../application/services/prompt-builder/prompt-builder.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"
import { AgentConfigRepository } from "../../repositories/agent-config.repository"

export interface ProfileManagementContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  channel?: string // "whatsapp" | "widget" | "telegram"
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
  // Widget-specific action: when channel is "widget", return modal action instead of link
  action?: {
    type: "open_profile_modal" | "open_link"
    customerId?: string
    link?: string
  }
}

export class ProfileManagementAgentLLM {
  private openRouterApiKey: string
  private openRouterBaseUrl = "https://openrouter.ai/api/v1"
  private agentConfigRepo: AgentConfigRepository

  constructor(private prisma: PrismaClient, private promptBuilder: PromptBuilderService) {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required")
    }
    this.agentConfigRepo = new AgentConfigRepository(prisma)
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

      // 🔨 Build prompt using PromptBuilderService (robust template + DB fallback)
      const processedPrompt = await this.promptBuilder.buildAgentPrompt(
        "PROFILE_MANAGEMENT",
        {
          workspaceId: context.workspaceId,
          customerId: context.customerId,
        }
      )

      logger.info(`📄 Profile Management Agent - Prompt built via PromptBuilderService`, {
        promptLength: processedPrompt.length
      })

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
      messages.push({
        role: "user" as const,
        content: PromptProcessorService.wrapUserInput(context.query),
      })

      const functionCalls: Array<{ function: string; arguments: any }> = []
      let iterations = 0
      const maxIterations = 3
      let finalResponse = ""
      let getProfileLinkCalled = false // Track if getProfileLink was executed
      let profileLinkData: any = null // Store profile link data for widget modal action

      // Resolve model/temperature from AgentConfig or fall back to previous defaults
      const agentConfig =
        (await this.agentConfigRepo.findByType(
          context.workspaceId,
          "PROFILE_MANAGEMENT" as AgentType
        )) || undefined
      const model = agentConfig?.model || "openai/gpt-4o-mini"
      const temperature =
        agentConfig?.temperature !== undefined
          ? Number(agentConfig.temperature)
          : 0.7
      const maxTokens = agentConfig?.maxTokens || 1000

      while (iterations < maxIterations) {
        iterations++

        logger.info(
          `🔄 Profile Management Agent - Iteration ${iterations}/${maxIterations}`
        )

        // Call LLM with function calling
        const llmResponse = await this.callLLM({
          model,
          messages,
          functions: profileFunctions,
          temperature,
          maxTokens,
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

          // Track if getProfileLink was called
          if (functionName === "getProfileLink") {
            getProfileLinkCalled = true
          }

          // Execute function
          const functionResult = await this.executeFunction(
            functionName,
            functionArgs,
            context
          )

          // Store profile link data for later use (widget modal action)
          if (functionName === "getProfileLink" && functionResult.profileLink) {
            profileLinkData = functionResult
          }

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

          // 🔧 FIX: Add explicit instruction based on channel
          if (functionName === "getProfileLink") {
            if (context.channel === "widget") {
              // Widget: Don't include link, just tell user to click the modal action button
              messages.push({
                role: "system" as const,
                content: "The user is on a widget. Do NOT include the [LINK_PROFILE_WITH_TOKEN] placeholder in your response. Instead, tell the user to click the profile button/link that will open their profile in a modal within the chat. Keep it brief and friendly.",
              } as any)
            } else {
              // WhatsApp/default: Include the link placeholder
              messages.push({
                role: "system" as const,
                content: "CRITICAL: You MUST include the [LINK_PROFILE_WITH_TOKEN] placeholder in your response to the user. This is required for the link replacement system to work correctly.",
              } as any)
            }
          }

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

      // 🔧 FIX: Validate and auto-inject placeholder if missing
      if (getProfileLinkCalled && !finalResponse.includes("[LINK_PROFILE_WITH_TOKEN]")) {
        logger.warn(
          "⚠️ ProfileManagementAgent: getProfileLink was called but [LINK_PROFILE_WITH_TOKEN] is missing from final response. Auto-injecting placeholder.",
          {
            originalResponse: finalResponse.substring(0, 200),
            functionCallsCount: functionCalls.length,
          }
        )

        // Auto-inject the placeholder at the end of the response
        finalResponse = `${finalResponse}\n\n[LINK_PROFILE_WITH_TOKEN]`

        logger.info(
          "✅ ProfileManagementAgent: Placeholder auto-injected successfully",
          {
            updatedResponse: finalResponse.substring(0, 200),
          }
        )
      }


      const executionTimeMs = Date.now() - startTime

      // 🎯 WIDGET SPECIAL HANDLING: Return modal action instead of link
      const widgetAction =
        context.channel === "widget" &&
        getProfileLinkCalled &&
        profileLinkData
          ? {
              type: "open_profile_modal" as const,
              customerId: context.customerId,
            }
          : undefined

      logger.info(`✅ Profile Management Agent completed`, {
        iterations,
        functionCallsCount: functionCalls.length,
        tokensUsed: totalTokens,
        executionTimeMs,
        responsePreview: finalResponse.substring(0, 100),
        widgetAction: widgetAction ? "open_profile_modal" : "none",
      })

      return {
        success: true,
        output: finalResponse,
        tokensUsed: totalTokens,
        executionTimeMs,
        functionCalls,
        systemPrompt: processedPrompt,
        action: widgetAction, // Include widget action if applicable
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
        // Call manageNotifications domain function
        const {
          manageNotifications,
        } = require("../../domain/calling-functions/manageNotifications")

        const action = args.value ? "SUBSCRIBE" : "UNSUBSCRIBE"

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
          hasProfileLink: !!result.data?.profileLink,
          hasShortLink: !!result.data?.shortLink,
          message: result.message,
        })

        // Return the result with correct field mapping
        // CallingFunctionsService returns: { success, message: "[LINK_PROFILE_WITH_TOKEN]", data: { profileLink, shortLink, expiresAt } }
        return {
          success: result.success,
          profileLink: result.data?.profileLink,
          shortLink: result.data?.shortLink,
          expiresAt: result.data?.expiresAt,
          message: result.message || "[LINK_PROFILE_WITH_TOKEN]", // CRITICAL: Pass the token placeholder so LLM includes it in response
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

      const response = await withOpenRouterRetry(() => axios.post(
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
      ))

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
