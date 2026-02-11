/**
 * Welcome Message Handler
 * 
 * Extracts welcome message logic from ChatEngine.
 * Handles first message detection and welcome message delivery.
 * 
 * Responsibilities:
 * - Check if customer's first message
 * - Load configured welcome message from workspace
 * - Handle multi-language welcome messages
 * - Save welcome exchange to conversation history
 * 
 * @architecture Clean Architecture - Single Responsibility Principle
 * @critical ALWAYS filter by workspaceId (multi-tenant security)
 */

import { PrismaClient, AgentType } from "@echatbot/database"
import logger from "../utils/logger"
import { TranslationAgent } from "../application/agents/TranslationAgent"
import { PromptProcessorService } from "../services/prompt-processor.service"
import { PromptVariableBuilder } from "../application/services/prompt-variable-builder.service"

export interface WelcomeMessageInput {
  customerId: string
  workspaceId: string
  customerLanguage?: string
  customerMessage: string
  conversationId?: string
  channel?: string
}

export interface WelcomeMessageResult {
  isWelcomeMessage: boolean
  welcomeText?: string
  assistantMessageId?: string
}

export class WelcomeMessageHandler {
  private translationAgent: TranslationAgent
  private promptProcessor: PromptProcessorService
  constructor(private prisma: PrismaClient) {
    this.translationAgent = new TranslationAgent(prisma)
    this.promptProcessor = new PromptProcessorService()
  }

  /**
   * Check if this is the first message and return welcome message if configured
   */
  async handleWelcomeMessage(input: WelcomeMessageInput): Promise<WelcomeMessageResult> {
    try {
      const inputChannel = input.channel || (await this.getConversationChannel(input.conversationId))

      // 🚫 Widget channel: welcome not applicable
      if (inputChannel === "widget") {
        logger.info("👋 [WelcomeMessageHandler] Skipping welcome for widget channel")
        return { isWelcomeMessage: false }
      }

      let conversationFilter: { conversationId?: { in: string[] } } = {}
      if (inputChannel) {
        const sessions = await this.prisma.chatSession.findMany({
          where: {
            customerId: input.customerId,
            workspaceId: input.workspaceId,
            channel: inputChannel,
          },
          select: { id: true },
        })
        const ids = sessions.map((s) => s.id)
        if (ids.length > 0) {
          conversationFilter = { conversationId: { in: ids } }
        } else if (input.conversationId) {
          // Fallback to current conversation to avoid repeat welcomes in the same thread
          conversationFilter = { conversationId: { in: [input.conversationId] } }
        }
      }

      // Count previous USER messages from this customer in this workspace (scoped by channel when provided)
      // 🚨 CRITICAL FIX: Exclude REGISTRATION_FLOW messages from count
      // Registration flow messages are system messages sent before user is fully registered
      // We want to send welcome message on first REAL conversational message after registration
      const previousMessageCount = await this.prisma.conversationMessage.count({
        where: {
          customerId: input.customerId,
          workspaceId: input.workspaceId,
          role: "user", // Only count user messages
          agentType: {
            not: "REGISTRATION_FLOW", // 🚫 Exclude registration flow messages
          },
          ...conversationFilter,
        },
      })

      const isFirstMessage = previousMessageCount === 0

      logger.info("👋 [WelcomeMessageHandler] First message check", {
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        previousMessageCount,
        isFirstMessage,
        inputChannel,
        conversationFilter,
      })

      if (!isFirstMessage) {
        logger.info("🚫 [WelcomeMessageHandler] NOT first message - skipping welcome", {
          previousMessageCount,
        })
        return { isWelcomeMessage: false }
      }

      logger.info("✅ [WelcomeMessageHandler] IS first message - proceeding with welcome")

      // Load workspace configuration
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { 
          welcomeMessage: true,
          chatbotName: true,
          botIdentityResponse: true,
          customAiRules: true,
          address: true,
          name: true,
          toneOfVoice: true,
        },
      })

      logger.info("🔍 [WelcomeMessageHandler] Workspace loaded", {
        workspaceId: input.workspaceId,
        hasWorkspace: !!workspace,
        hasWelcomeMessage: !!workspace?.welcomeMessage,
        welcomeMessageType: typeof workspace?.welcomeMessage,
        welcomeMessageLength: workspace?.welcomeMessage ? String(workspace.welcomeMessage).length : 0,
      })

      if (!workspace || !workspace.welcomeMessage) {
        logger.info("🚫 [WelcomeMessageHandler] No welcome message configured")
        return { isWelcomeMessage: false }
      }

      // Load customer for variable replacement
      const customer = await this.prisma.customers.findFirst({
        where: {
          id: input.customerId,
          workspaceId: input.workspaceId,
        },
      })

      if (!customer) {
        logger.error("❌ [WelcomeMessageHandler] Customer not found")
        return { isWelcomeMessage: false }
      }

      // Extract welcome message in customer's language
      let welcomeText = this.extractWelcomeText(
        workspace.welcomeMessage,
        input.customerLanguage || "it"
      )

      // 🎯 CRITICAL: Build PromptVariables and replace ALL variables
      logger.info("🔧 [WelcomeMessageHandler] Building prompt variables for welcome message")
      
      // Load customer and workspace for PromptVariableBuilder
      const fullCustomer = await this.prisma.customers.findFirst({
        where: { id: customer.id, workspaceId: input.workspaceId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          discount: true,
          isActive: true,
          language: true,
          company: true,
          push_notifications_consent: true,
          sales: { select: { firstName: true, lastName: true, phone: true, email: true } },
        },
      })

      if (!fullCustomer) {
        throw new Error(`Customer ${customer.id} not found`)
      }

      const fullWorkspace = await this.prisma.workspace.findUnique({
        where: { id: input.workspaceId },
      })

      if (!fullWorkspace) {
        throw new Error(`Workspace ${input.workspaceId} not found`)
      }

      const variables = PromptVariableBuilder.build(
        fullCustomer,
        fullWorkspace,
        {
          products: "",
          categories: "",
          services: "",
          offers: "",
          faqs: "",
        }
      )

      // Replace all variables in welcome message
      welcomeText = this.promptProcessor.processWithVariables(welcomeText, variables)
      
      logger.info("✅ [WelcomeMessageHandler] Variables replaced in welcome message", {
        customerName: variables.customerName,
        chatbotNameFromVars: variables.chatbotName,
        companyName: variables.companyName,
        hasBotIdentity: !!variables.botIdentityResponse,
        hasCustomAiRules: !!variables.customAiRules,
      })

      // 🔍 DEBUG: Log ENTIRE welcome message after variable replacement
      logger.info("*******PROMPT WELCOME MESSAGE AFTER VARIABLE REPLACEMENT*******")
      logger.info(welcomeText)
      logger.info("*******END PROMPT*******")

      logger.info("👋 [WelcomeMessageHandler] Before translation", {
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        welcomeMessageLength: welcomeText.length,
        customerLanguage: input.customerLanguage || "it",
        hasRegistrationToken: welcomeText.includes("[LINK_REGISTRATION]"),
      })

      // 🌍 CRITICAL: Translate welcome message to customer's language FIRST
      // NOTE: Do NOT replace [LINK_REGISTRATION] before translation
      // The token will be preserved during translation and replaced after
      const customerLanguage = input.customerLanguage || "it"
      
      logger.info("🌍 [WelcomeMessageHandler] BEFORE Translation", {
        customerLanguage,
        originalText: welcomeText.substring(0, 100),
        textLength: welcomeText.length,
      })

      const translationResult = await this.translationAgent.process({
        workspaceId: input.workspaceId,
        message: welcomeText,
        targetLanguage: customerLanguage,
        customerName: input.customerId, // We don't have name yet for anonymous users
      })

      welcomeText = translationResult.message

      logger.info("🌍 [WelcomeMessageHandler] AFTER Translation", {
        originalLength: welcomeText.length,
        translatedLength: translationResult.message.length,
        targetLanguage: customerLanguage,
        wasTranslated: translationResult.translated,
        translatedText: translationResult.message.substring(0, 100),
      })

      // 🔧 CRITICAL: Replace [LINK_REGISTRATION] token with actual registration link
      // This MUST happen AFTER translation to prevent the link from being translated
      if (welcomeText.includes("[LINK_REGISTRATION]")) {
        try {
          // Load customer to get phone number
          const customer = await this.prisma.customers.findFirst({
            where: {
              id: input.customerId,
              workspaceId: input.workspaceId,
            },
            select: { phone: true },
          })

          if (customer?.phone) {
            const registrationLink = await this.generateRegistrationLink(
              customer.phone,
              input.workspaceId
            )
            welcomeText = welcomeText.replace(/\[LINK_REGISTRATION\]/g, registrationLink)
            logger.info("🔗 [WelcomeMessageHandler] Replaced [LINK_REGISTRATION] with actual link after translation")
          } else {
            logger.warn("⚠️ [WelcomeMessageHandler] Customer phone not found, cannot replace [LINK_REGISTRATION]")
          }
        } catch (error) {
          logger.error("❌ [WelcomeMessageHandler] Error replacing registration link:", error)
          // Keep [LINK_REGISTRATION] token if generation fails
        }
      }

      // Save welcome exchange to conversation history
      const conversationId = input.conversationId || `temp-${input.customerId}`
      const assistantMessageId = await this.saveWelcomeMessages(
        input.workspaceId,
        input.customerId,
        conversationId,
        input.customerMessage,
        welcomeText
      )

      return {
        isWelcomeMessage: true,
        welcomeText,
        assistantMessageId,
      }

    } catch (error) {
      logger.error("❌ [WelcomeMessageHandler] Error handling welcome message", {
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Extract welcome text in customer's language from welcomeMessage config
   */
  private extractWelcomeText(welcomeMessage: any, customerLanguage: string): string {
    if (typeof welcomeMessage === "string") {
      return welcomeMessage
    }

    if (typeof welcomeMessage === "object") {
      // JSON format: { "it": "...", "en": "...", "es": "...", "pt": "..." }
      const customerLang = this.normalizeLanguageCode(customerLanguage)
      return (
        welcomeMessage[customerLang] ||
        welcomeMessage["it"] ||
        welcomeMessage["en"] ||
        JSON.stringify(welcomeMessage) // Last resort fallback
      )
    }

    return "Welcome!" // Ultimate fallback
  }

  /**
   * Normalize language code to 2-letter ISO 639-1 format
   */
  private normalizeLanguageCode(lang: string): string {
    const normalized = lang.toLowerCase().substring(0, 2)
    return ["it", "en", "es", "pt", "fr", "de"].includes(normalized) ? normalized : "it"
  }

  private async getConversationChannel(conversationId?: string): Promise<string | null> {
    if (!conversationId) return null
    try {
      const session = await this.prisma.chatSession.findFirst({
        where: { id: conversationId },
        select: { channel: true },
      })
      return session?.channel || null
    } catch (error) {
      logger.warn("⚠️ [WelcomeMessageHandler] Failed to load conversation channel", {
        conversationId,
        error: (error as Error).message,
      })
      return null
    }
  }

  /**
   * Save welcome message exchange to conversation history
   */
  private async saveWelcomeMessages(
    workspaceId: string,
    customerId: string,
    conversationId: string,
    userMessage: string,
    welcomeText: string
  ): Promise<string> {
    try {
      // Save user message
      await this.prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId,
          conversationId,
          role: "user",
          content: userMessage,
          agentType: AgentType.ROUTER,
          tokensUsed: 0,
        },
      })

      // Save assistant (welcome) message
      const assistantMessage = await this.prisma.conversationMessage.create({
        data: {
          workspaceId,
          customerId,
          conversationId,
          role: "assistant",
          content: welcomeText,
          agentType: AgentType.ROUTER,
          tokensUsed: 0,
        },
      })

      logger.info("✅ [WelcomeMessageHandler] Welcome messages saved", {
        workspaceId,
        customerId,
        conversationId,
        assistantMessageId: assistantMessage.id,
      })

      return assistantMessage.id

    } catch (error) {
      logger.error("❌ [WelcomeMessageHandler] Error saving welcome messages", {
        workspaceId,
        customerId,
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Generate registration link for customer
   * Uses centralized LinkGeneratorService with support for custom registrationPage
   */
  private async generateRegistrationLink(
    phone: string,
    workspaceId: string
  ): Promise<string> {
    try {
      // Import services
      const { TokenService } = require("../application/services/token.service")
      const { LinkGeneratorService } = require("../application/services/link-generator.service")
      const { workspaceService } = require("../services/workspace.service")

      // Create registration token
      const tokenService = new TokenService()
      const token = await tokenService.createRegistrationToken(phone, workspaceId)

      // Get workspace URL and custom registration page (if configured)
      const { url: workspaceUrl, registrationPage } =
        await workspaceService.getWorkspaceURLWithRegistration(workspaceId)

      // Use centralized link generator service
      const linkGeneratorService = new LinkGeneratorService()
      const registrationLink = await linkGeneratorService.generateRegistrationLink(
        token,
        workspaceUrl,
        workspaceId,
        registrationPage // Pass custom registration page if configured
      )

      logger.info(`📎 [WelcomeMessageHandler] Created registration link: ${registrationLink}`)
      return registrationLink
    } catch (error) {
      logger.error("❌ [WelcomeMessageHandler] Error generating registration link:", error)
      throw error
    }
  }
}
