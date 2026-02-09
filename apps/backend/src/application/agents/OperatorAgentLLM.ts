/**
 * OperatorAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Handle manual operator responses with dedicated LLM
 * 2. Manage escalation to human operators
 * 3. Format and send operator messages to customers
 * 4. Track operator availability and status
 * 5. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from files (TemplateLoaderService loads from /templates/ecommerce/08-operator.template.md)
 * - Function execution via OperatorRepository
 * - Returns English ONLY (Router handles translation)
 *
 * Flow:
 * 1. Router delegates query → OperatorAgentLLM
 * 2. Load system prompt from database (agentType: OPERATOR)
 * 3. Call LLM with operator functions
 * 4. Execute functions via repositories
 * 5. Return English response with tokens → Router
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - NO translation (Router handles it)
 * - NO direct customer interaction
 * - Operator messages MUST be validated
 *
 * Use Cases:
 * - Customer requests human support
 * - Complex queries requiring manual intervention
 * - Escalation when chatbot cannot help
 * - Operator sends manual message to customer
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

export interface OperatorLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  /** Pre-loaded customer data from Router (avoids duplicate DB queries) */
  customerData?: CustomerData
  /** Operator information if sending manual response */
  operatorInfo?: {
    operatorId: string
    operatorName: string
    operatorEmail: string
  }
}

export interface OperatorLLMResponse {
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
  escalated?: boolean // Whether conversation was escalated to human
}

export class OperatorAgentLLM {
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
        "OPENROUTER_API_KEY is required for OperatorAgentLLM"
      )
    }
  }

  /**
   * Handle operator query with LLM
   */
  async handleQuery(
    context: OperatorLLMContext
  ): Promise<OperatorLLMResponse> {
    const startTime = Date.now()

    try {
      logger.info(`👤 OperatorAgentLLM: Processing query`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        query: context.query.substring(0, 100),
        hasOperatorInfo: !!context.operatorInfo,
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
          hasHumanSupport: true,
          operatorContactMethod: true,
          operatorWhatsappNumber: true,
          humanSupportInstructions: true,
        },
      })

      // STEP 2: Check if human support is enabled
      if (!workspace?.hasHumanSupport) {
        logger.warn(`⚠️ Human support not enabled for workspace ${context.workspaceId}`)
        return {
          success: false,
          output: "Human support is not available for this workspace",
          tokensUsed: 0,
          executionTimeMs: Date.now() - startTime,
          functionCalls: [],
        }
      }

      // STEP 3: Load system prompt from template files
      let systemPrompt = await this.templateLoader.loadAndRenderTemplate(
        "OPERATOR",
        context.workspaceId,
        {}
      )

      // Inject human support instructions if available
      if (workspace?.humanSupportInstructions) {
        const instructionsSection = `\n\n## HUMAN SUPPORT INSTRUCTIONS\n${workspace.humanSupportInstructions}\n`
        systemPrompt = systemPrompt + instructionsSection
        logger.info(`📋 Injected human support instructions into OPERATOR prompt`)
      }

      // Inject custom AI rules if available
      if (workspace?.customAiRules) {
        const rulesSection = `\n\n## ⚠️ PRIORITY RULES (OVERRIDE)\nThe following rules have PRIORITY over all other instructions:\n${workspace.customAiRules}\n`
        systemPrompt = systemPrompt + rulesSection
        logger.info(`⚙️ Injected custom AI rules into OPERATOR prompt`)
      }

      // STEP 4: Replace ALL variables
      const promptProcessor = new PromptProcessorService()

      const baseCustomerData = {
        nameUser: context.customerName || "",
        email: "",
        phone: "",
        discountUser: 0,
        companyName: workspace?.name || "",
        lastordercode: "",
        languageUser: context.customerLanguage || "it",
        agentName: context.operatorInfo?.operatorName || "Non assegnato",
        agentPhone: "N/A",
        agentEmail: context.operatorInfo?.operatorEmail || "N/A",
        botIdentityResponse: workspace?.botIdentityResponse || "",
        adminEmail: workspace?.notificationEmail || "",
      }

      const customerDataForPrompt = context.customerData ? {
        ...baseCustomerData,
        ...context.customerData,
        companyName: context.customerData.companyName || workspace?.name || baseCustomerData.companyName,
        botIdentityResponse: context.customerData.botIdentityResponse || workspace?.botIdentityResponse || "",
        adminEmail: context.customerData.adminEmail || workspace?.notificationEmail || "",
        agentName: context.operatorInfo?.operatorName || context.customerData.agentName || "Non assegnato",
        agentEmail: context.operatorInfo?.operatorEmail || context.customerData.agentEmail || "N/A",
      } : baseCustomerData

      logger.info(`📋 OperatorAgent customerDataForPrompt:`, {
        companyName: customerDataForPrompt.companyName,
        nameUser: customerDataForPrompt.nameUser,
        agentName: customerDataForPrompt.agentName,
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
          hasHumanSupport: workspace?.hasHumanSupport ?? true,
          hasSalesAgents: true,
          address: "",
          customAiRules: workspace?.customAiRules || "",
          botIdentityResponse: context.customerData?.botIdentityResponse || workspace?.botIdentityResponse || "",
          humanSupportInstructions: workspace?.humanSupportInstructions || "",
          frustrationEscalationInstructions: "",
          adminEmail: context.customerData?.adminEmail || workspace?.notificationEmail || "",
          allowedExternalLinks: [],
          operatorContactMethod: workspace?.operatorContactMethod || "",
          operatorWhatsappNumber: workspace?.operatorWhatsappNumber || "",
          supportEmail: workspace?.notificationEmail || "",
          websiteUrl: workspace?.websiteUrl || workspace?.url || "",
        }
      )

      logger.info(`✅ Variables replaced in OPERATOR prompt`, {
        originalLength: systemPrompt.length,
        processedLength: processedPrompt.length,
      })

      // STEP 5: Build messages for LLM
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

      // STEP 6: Define function calls for operator
      const functions = this.getOperatorFunctions()

      // STEP 7: Call LLM (OpenRouter)
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
      let escalated = false

      // STEP 8: Handle function calling loop
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
            `🚨 SECURITY VIOLATION: OperatorAgentLLM tried to call another SubLLM!`,
            {
              attemptedFunction: functionName,
              args: functionArgs,
            }
          )
          throw new Error(
            `INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`
          )
        }

        logger.info(`⚙️ OperatorAgentLLM: Function call requested`, {
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

        // Check if conversation was escalated
        if (functionName === "escalateToOperator" || functionName === "contactOperator") {
          escalated = functionResult.success === true
        }

        // STEP 9: Return function result to LLM for final response
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

      logger.info(`✅ OperatorAgentLLM: Query processed`, {
        executionTimeMs,
        tokensUsed: totalTokens,
        responseLength: finalResponse.length,
        functionCallsCount: functionCalls.length,
        escalated,
      })

      return {
        success: true,
        output: finalResponse,
        tokensUsed: totalTokens,
        executionTimeMs,
        functionCalls,
        systemPrompt: processedPrompt,
        escalated,
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

      logger.error("❌ OperatorAgentLLM error:", errorInfo)

      return {
        success: false,
        output: "Error processing operator request",
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
            "X-Title": "eChatbot - Operator Agent",
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
    context: OperatorLLMContext
  ): Promise<any> {
    try {
      switch (functionName) {
        case "escalateToOperator": {
          // Disable chatbot and notify operator
          await this.prisma.customers.update({
            where: { id: context.customerId },
            data: { activeChatbot: false },
          })

          logger.info(`🚨 Chatbot disabled for customer ${context.customerId} - escalated to operator`)

          // Call ContactOperator to send email with summary
          const { contactOperator } = require("../../domain/calling-functions/contactOperator")

          const customer = await this.prisma.customers.findUnique({
            where: { id: context.customerId },
            select: { phone: true },
          })

          const contactResult = await contactOperator({
            phoneNumber: customer?.phone || "",
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            reason: args.reason || "Customer requested operator assistance",
          })

          return {
            success: contactResult.success,
            message: contactResult.message,
            escalated: true,
            chatbotDisabled: true,
            timestamp: contactResult.timestamp,
            ticketId: contactResult.ticketId,
          }
        }

        case "getOperatorStatus": {
          // Check if workspace has operators available
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: context.workspaceId },
            select: {
              hasHumanSupport: true,
              operatorContactMethod: true,
              operatorWhatsappNumber: true,
            },
          })

          const availableOperators = await this.prisma.user.count({
            where: {
              workspaceId: context.workspaceId,
              role: { in: ["ADMIN", "MEMBER"] },
            },
          })

          return {
            success: true,
            available: workspace?.hasHumanSupport ?? false,
            operatorsCount: availableOperators,
            contactMethod: workspace?.operatorContactMethod || "email",
            message: workspace?.hasHumanSupport
              ? "Operators are available"
              : "No operators available",
          }
        }

        case "sendOperatorMessage": {
          // Send manual message from operator to customer
          logger.info(`📤 Operator sending manual message`, {
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            operatorId: context.operatorInfo?.operatorId,
            messagePreview: args.message?.substring(0, 50),
          })

          // Save message to queue for WhatsApp delivery
          const message = await this.prisma.message.create({
            data: {
              workspaceId: context.workspaceId,
              customerId: context.customerId,
              body: args.message,
              from: "operator",
              to: context.customerId,
              status: "pending",
              direction: "outbound",
            },
          })

          return {
            success: true,
            messageId: message.id,
            message: "Operator message sent successfully",
            timestamp: message.createdAt,
          }
        }

        case "getConversationHistory": {
          // Get recent conversation history for operator context
          const messages = await this.prisma.message.findMany({
            where: {
              workspaceId: context.workspaceId,
              customerId: context.customerId,
            },
            orderBy: { createdAt: "desc" },
            take: args.limit || 20,
            select: {
              id: true,
              body: true,
              from: true,
              direction: true,
              createdAt: true,
            },
          })

          return {
            success: true,
            messages: messages.reverse(), // Oldest first
            count: messages.length,
          }
        }

        case "assignOperator": {
          // Assign a specific operator to customer
          const customer = await this.prisma.customers.update({
            where: { id: context.customerId },
            data: {
              salesPersonId: args.operatorId,
            },
            include: {
              sales: true,
            },
          })

          logger.info(`👤 Operator assigned to customer`, {
            customerId: context.customerId,
            operatorId: args.operatorId,
            operatorName: customer.sales ? `${customer.sales.firstName} ${customer.sales.lastName}` : "Unknown",
          })

          return {
            success: true,
            operatorAssigned: true,
            operator: customer.sales ? {
              id: customer.sales.id,
              name: `${customer.sales.firstName} ${customer.sales.lastName}`,
              email: customer.sales.email,
              phone: customer.sales.phone,
            } : null,
            message: "Operator assigned successfully",
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
   * Get function definitions for operator
   */
  private getOperatorFunctions() {
    return [
      {
        name: "escalateToOperator",
        description: "Escalate conversation to human operator and disable chatbot",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Reason for escalation",
            },
          },
          required: ["reason"],
        },
      },
      {
        name: "getOperatorStatus",
        description: "Check if operators are available for this workspace",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
      {
        name: "sendOperatorMessage",
        description: "Send a manual message from operator to customer",
        parameters: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Message content to send",
            },
          },
          required: ["message"],
        },
      },
      {
        name: "getConversationHistory",
        description: "Get recent conversation history for operator context",
        parameters: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of messages to retrieve (default 20)",
            },
          },
          required: [],
        },
      },
      {
        name: "assignOperator",
        description: "Assign a specific operator to this customer",
        parameters: {
          type: "object",
          properties: {
            operatorId: {
              type: "string",
              description: "ID of the operator to assign",
            },
          },
          required: ["operatorId"],
        },
      },
    ]
  }
}
