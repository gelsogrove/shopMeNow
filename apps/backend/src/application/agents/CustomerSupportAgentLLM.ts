/**
 * CustomerSupportAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Used by:
 * - Ecommerce workspaces: AgentType CUSTOMER_SUPPORT (via Router delegation)
 * - Informational workspaces: AgentType INFO_AGENT (main agent, processes all messages)
 *
 * Responsibilities:
 * 1. Handle customer support queries with dedicated LLM
 * 2. Execute function calls for FAQ, support tickets, complaints
 * 3. Return English response with [LINK_xxx] tokens
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4o-mini)
 * - Own system prompt from files (ecommerce: /templates/ecommerce/04-customer-support.template.md,
 *   informational: /templates/informational/01-info-agent.template.md)
 * - Function execution via FAQRepository
 * - Returns English ONLY (Router/Translation layer handles translation)
 *
 * Flow:
 * 1. Router/ChatEngine delegates query → CustomerSupportAgentLLM
 * 2. Load system prompt from database (agentType: CUSTOMER_SUPPORT or INFO_AGENT)
 * 3. Call LLM with support functions
 * 4. Execute functions via FAQRepository
 * 5. Return English response with tokens → Router/ChatEngine
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - NO translation (Router/Translation layer handles it)
 * - NO direct customer interaction
 *
 * @critical NEVER call LLMService - this is a SPECIALIST with OWN LLM
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { config } from "../../config"
import { FAQRepository } from "../../repositories/faq.repository"
import { TemplateLoaderService } from "../services/template-loader.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"

import { CustomerData } from "../../types/agent.types"

export interface CustomerSupportLLMContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  query: string
  /** Pre-loaded customer data from Router (avoids duplicate DB queries) */
  customerData?: CustomerData
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
  systemPrompt?: string // 🆕 Processed system prompt for debugging
}

export class CustomerSupportAgentLLM {
  private prisma: PrismaClient
  private faqRepo: FAQRepository
  private templateLoader: TemplateLoaderService
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.faqRepo = new FAQRepository(prisma)
    this.templateLoader = TemplateLoaderService.getInstance(prisma)

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

      // 🆕 STEP 1.5: Load workspace config for address and other dynamic fields
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
        select: {
          address: true,
          customAiRules: true,
          name: true,
          botIdentityResponse: true,
          notificationEmail: true,
          humanSupportInstructions: true,
          frustrationEscalationInstructions: true,
          allowedExternalLinks: true,
          sellsProductsAndServices: true,
          hasHumanSupport: true, // ✅ FIX: Include hasHumanSupport flag
          hasSalesAgents: true,
          operatorContactMethod: true,
          operatorWhatsappNumber: true,
          websiteUrl: true,
          url: true,
        },
      })

      // Build dynamic context to inject into prompt
      // 🔧 STEP 1.7: Load FAQs for customer support
      const MessageRepository = require("../../repositories/message.repository").MessageRepository
      const messageRepo = new MessageRepository()
      const faqsFormatted = await messageRepo.getActiveFaqs(context.workspaceId)

      logger.info(`📚 Loaded FAQs for CUSTOMER_SUPPORT`, {
        hasFaqs: faqsFormatted.length > 0,
        formattedLength: faqsFormatted.length,
        preview: faqsFormatted.substring(0, 300),
      })

      // STEP 1.8: Load system prompt from template files (include FAQ presence for conditionals)
      // 🔧 FIX: Use correct agent type based on workspace type
      // Informational workspaces use INFO_AGENT template, ecommerce uses CUSTOMER_SUPPORT
      const isEcommerce = workspace?.sellsProductsAndServices ?? true
      const templateAgentType = isEcommerce ? "CUSTOMER_SUPPORT" : "INFO_AGENT"

      let systemPrompt = await this.templateLoader.loadAndRenderTemplate(
        templateAgentType,
        context.workspaceId,
        { faq: faqsFormatted, faqs: faqsFormatted }
      )

      // Inject address if available
      if (workspace?.address) {
        const addressSection = `\n\n## OUR LOCATION\nWhen customer asks "where are you?", "your address?", "dove siete?", "indirizzo?":\nRespond with: "${workspace.address}"\n`
        // Insert after the first section or at the beginning
        systemPrompt = systemPrompt + addressSection
        logger.info(`📍 Injected address into CUSTOMER_SUPPORT prompt: ${workspace.address}`)
      }

      // Inject custom AI rules if available
      if (workspace?.customAiRules) {
        const rulesSection = `\n\n## ⚠️ PRIORITY RULES (OVERRIDE)\nThe following rules have PRIORITY over all other instructions:\n${workspace.customAiRules}\n`
        systemPrompt = systemPrompt + rulesSection
        logger.info(`⚙️ Injected custom AI rules into CUSTOMER_SUPPORT prompt`)
      }

      // 🔧 STEP 1.6: Replace ALL variables ({{companyName}}, {{nameUser}}, etc.)
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
        lastordercode: "",
        languageUser: context.customerLanguage || "en",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        botIdentityResponse: workspace?.botIdentityResponse || "",
        adminEmail: workspace?.notificationEmail || "", // 🆕 For support/escalation
      }

      // Merge: Router data takes priority, but fallback to local workspace data if empty
      const customerDataForPrompt = context.customerData ? {
        ...baseCustomerData,
        ...context.customerData,
        // 🔴 CRITICAL: Ensure companyName and botIdentityResponse are NEVER empty
        companyName: context.customerData.companyName || workspace?.name || baseCustomerData.companyName,
        botIdentityResponse: context.customerData.botIdentityResponse || workspace?.botIdentityResponse || "",
        adminEmail: context.customerData.adminEmail || workspace?.notificationEmail || "", // 🆕 For support/escalation
      } : baseCustomerData

      // 🔍 DEBUG: Log what we're passing to preProcessPrompt
      logger.info(`📋 CustomerSupportAgent customerDataForPrompt:`, {
        companyName: customerDataForPrompt.companyName,
        nameUser: customerDataForPrompt.nameUser,
        botIdentityResponse: customerDataForPrompt.botIdentityResponse?.substring(0, 50) + "...",
        hasRouterData: !!context.customerData,
        workspaceName: workspace?.name,
      })

      logger.info(`📚 Loaded FAQs for CUSTOMER_SUPPORT`, {
        hasFaqs: faqsFormatted.length > 0,
        formattedLength: faqsFormatted.length,
        preview: faqsFormatted.substring(0, 300),
      })

      logger.info(`📋 Loaded CUSTOMER_SUPPORT template from files`, {
        promptLength: systemPrompt.length,
      })

      const processedPrompt = await promptProcessor.preProcessPrompt(
        systemPrompt,
        context.workspaceId,
        customerDataForPrompt,
        {
          faqs: faqsFormatted, // 🔧 FIX: getActiveFaqs() already returns formatted string
          products: "",
          categories: "",
          services: "",
          offers: "",
        },
        workspace?.websiteUrl || workspace?.url, // workspaceUrl
        {
          sellsProductsAndServices: workspace?.sellsProductsAndServices ?? false, // 🔧 Informational workspace
          hasHumanSupport: workspace?.hasHumanSupport ?? false, // ✅ FIX: Use actual hasHumanSupport flag
          hasSalesAgents: workspace?.hasSalesAgents ?? false,
          address: workspace?.address || "",
          customAiRules: workspace?.customAiRules || "",
          botIdentityResponse: context.customerData?.botIdentityResponse || workspace?.botIdentityResponse || "",
          humanSupportInstructions: workspace?.humanSupportInstructions || "", // 🔧 Custom escalation instructions
          frustrationEscalationInstructions: workspace?.frustrationEscalationInstructions || "", // 🔧 Custom frustration triggers
          adminEmail: context.customerData?.adminEmail || workspace?.notificationEmail || "", // 🆕 For support/escalation
          allowedExternalLinks: workspace?.allowedExternalLinks || [], // 🔧 Allowed domains for links
          operatorContactMethod: workspace?.operatorContactMethod || "",
          operatorWhatsappNumber: workspace?.operatorWhatsappNumber || "",
          supportEmail: workspace?.notificationEmail || "",
          websiteUrl: workspace?.websiteUrl || workspace?.url || "",
        }
      )

      logger.info(`✅ Variables replaced in CUSTOMER_SUPPORT prompt`, {
        originalLength: systemPrompt.length,
        processedLength: processedPrompt.length,
        hasFaqPlaceholder: processedPrompt.includes("{{faq}}"),
        hasFaqSection: processedPrompt.includes("FREQUENTLY ASKED QUESTIONS"),
        faqSnippet: processedPrompt.includes("FREQUENTLY ASKED QUESTIONS")
          ? processedPrompt
            .slice(
              processedPrompt.indexOf("FREQUENTLY ASKED QUESTIONS"),
              processedPrompt.indexOf("FREQUENTLY ASKED QUESTIONS") + 400
            )
          : undefined,
      })

      // 🔍 DEBUG: Log if FAQs section is present in final prompt
      const hasFaqSection = processedPrompt.includes("FREQUENTLY ASKED QUESTIONS")
      const hasFaqContent = processedPrompt.includes("D:") && processedPrompt.includes("R:")

      logger.info(`🔍 [DEBUG] FAQ presence check:`, {
        hasFaqSection,
        hasFaqContent,
        faqsFormattedLength: faqsFormatted.length,
      })

      // STEP 2: Build messages for LLM
      const messages: any[] = [
        {
          role: "system" as const,
          content: processedPrompt,
        },
        {
          role: "user" as const,
          content: PromptProcessorService.wrapUserInput(context.query), // 🛡️ Input Wrapping Defense
        },
      ]

      // STEP 3: Define function calls for customer support
      const isInformational = workspace?.sellsProductsAndServices === false
      const functions = this.getCustomerSupportFunctions({
        includeProfileFunctions: isInformational,
        includeContactOperator: workspace?.hasHumanSupport !== false,
      })

      // STEP 4: Call LLM (OpenRouter)
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
            `🚨 SECURITY VIOLATION: CustomerSupportAgentLLM tried to call another SubLLM!`,
            {
              attemptedFunction: functionName,
              args: functionArgs,
            }
          )
          throw new Error(
            `INVALID OPERATION: SubLLM cannot call other SubLLMs. Only Router can delegate to SubAgents. Attempted: ${functionName}`
          )
        }

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

        // 🔧 DIRECT RETURN: For ContactOperator - return message directly without LLM reformulation
        // This preserves the empathetic message and formatting
        const isContactOperator = functionName.toLowerCase() === "contactoperator"

        if (isContactOperator && functionResult?.success && functionResult?.message) {
          logger.info(`🚀 ContactOperator: Returning message directly (no LLM reformulation)`)
          finalResponse = functionResult.message

          // Replace customer name variable if present
          if (finalResponse.includes("{{nameUser}}")) {
            finalResponse = finalResponse.replace(/\{\{nameUser\}\}/gi, context.customerName || "Cliente")
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
            model: "gpt-4o-mini",
            messages,
            functions,
            temperature: 0.7,
            maxTokens: 2000,
          })

          totalTokens += finalLLMResponse.tokensUsed
          finalResponse = finalLLMResponse.content || ""
        }
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
        systemPrompt: processedPrompt, // 🔧 FIX: Return PROCESSED prompt (with variables replaced), not raw template
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
            "X-Title": "eChatbot - Customer Support Agent",
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
          // Support ticket creation - Future feature
          // For now, escalate to contactSupport for human assistance
          return {
            success: true,
            ticketId: "TICKET-" + Date.now(),
            message:
              "Support ticket created successfully. Our team will contact you soon.",
          }

        case "contactOperator": {
          const customer = await this.prisma.customers.findUnique({
            where: { id: context.customerId },
            select: { phone: true },
          })

          const { contactOperator } = require("../../domain/calling-functions/contactOperator")

          const contactResult = await contactOperator({
            phoneNumber,
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            reason: args?.reason || "Customer requested operator assistance",
          })

          return {
            success: contactResult.success,
            message: contactResult.message,
            timestamp: contactResult.timestamp,
            ticketId: contactResult.ticketId,
            summaryAgentExecuted: contactResult.summaryAgentExecuted,
            summaryEmailSent: contactResult.summaryEmailSent,
            generatedSummary: contactResult.generatedSummary,
            conversationMessages: contactResult.conversationMessages,
          }
        }

        case "getProfileLink": {
          const { CallingFunctionsService } = require("../../services/calling-functions.service")
          const callingFunctions = new CallingFunctionsService()

          const result = await callingFunctions.getProfileLink({
            customerId: context.customerId,
            workspaceId: context.workspaceId,
          })

          return {
            success: result.success,
            linkUrl: result.linkUrl,
            link: result.linkUrl,
            token: result.token,
            expiresAt: result.expiresAt,
            message: result.success
              ? "Profile link generated"
              : "Failed to generate profile link",
          }
        }

        case "handlePushNotifications": {
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

        case "contactSupport":
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

          // 🔴 CRITICAL: Disable chatbot when customer requests human support
          await this.prisma.customers.update({
            where: { id: context.customerId },
            data: { activeChatbot: false },
          })

          logger.info(
            `🚨 Chatbot disabled for customer ${context.customerId} - human support requested`
          )

          // 📧 Call ContactOperator to send email with summary
          const {
            ContactOperator,
          } = require("../../domain/calling-functions/contactOperator")

          logger.info("📧 Calling ContactOperator to send email notification")

          const contactResult = await ContactOperator({
            phoneNumber: customer.phone,
            workspaceId: context.workspaceId,
            customerId: context.customerId,
            reason: args.reason || "Customer requested operator assistance",
          })

          logger.info("✅ ContactOperator completed", {
            success: contactResult.success,
            customerId: context.customerId,
          })

          // 🔧 Return ContactOperator's empathetic message instead of generic one
          return {
            success: true,
            salesAgent: {
              name: `${customer.sales.firstName} ${customer.sales.lastName}`,
              email: customer.sales.email,
              phone: customer.sales.phone,
            },
            message: contactResult.message, // Use ContactOperator's message
            chatbotDisabled: true,
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
  private getCustomerSupportFunctions(options?: {
    includeProfileFunctions?: boolean
    includeContactOperator?: boolean
  }) {
    const functions: Array<{
      name: string
      description: string
      parameters: {
        type: string
        properties: Record<string, { type: string; description?: string; enum?: string[] }>
        required: string[]
      }
    }> = [
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
      ]

    if (options?.includeContactOperator ?? true) {
      functions.push({
        name: "contactOperator",
        description:
          "Escalate to a human operator when the customer asks for human support or is frustrated.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Optional short reason for escalation.",
            },
          },
          required: [],
        },
      })
    }

    if (options?.includeProfileFunctions) {
      functions.push(
        {
          name: "getProfileLink",
          description:
            "Generate a secure profile link for customers who want to update personal data (email, phone, address, name).",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
        {
          name: "handlePushNotifications",
          description:
            "Enable/disable promotional push notifications. Use only after explicit customer confirmation.",
          parameters: {
            type: "object",
            properties: {
              value: {
                type: "boolean",
                description:
                  "true = subscribe, false = unsubscribe promotional notifications.",
              },
            },
            required: ["value"],
          },
        }
      )
    }

    return functions
  }
}
