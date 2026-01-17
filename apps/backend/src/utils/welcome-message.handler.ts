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

export interface WelcomeMessageInput {
  customerId: string
  workspaceId: string
  customerLanguage?: string
  customerMessage: string
  conversationId?: string
}

export interface WelcomeMessageResult {
  isWelcomeMessage: boolean
  welcomeText?: string
  assistantMessageId?: string
}

export class WelcomeMessageHandler {
  private translationAgent: TranslationAgent

  constructor(private prisma: PrismaClient) {
    this.translationAgent = new TranslationAgent(prisma)
  }

  /**
   * Check if this is the first message and return welcome message if configured
   */
  async handleWelcomeMessage(input: WelcomeMessageInput): Promise<WelcomeMessageResult> {
    try {
      // Count previous USER messages from this customer in this workspace
      const previousMessageCount = await this.prisma.conversationMessage.count({
        where: {
          customerId: input.customerId,
          workspaceId: input.workspaceId,
          role: "user", // Only count user messages
        },
      })

      const isFirstMessage = previousMessageCount === 0

      logger.info("👋 [WelcomeMessageHandler] First message check", {
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        previousMessageCount,
        isFirstMessage,
      })

      if (!isFirstMessage) {
        return { isWelcomeMessage: false }
      }

      // Load workspace configuration
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { 
          welcomeMessage: true,
          chatbotName: true, // 🤖 Load assistant name for replacement
        },
      })

      if (!workspace || !workspace.welcomeMessage) {
        logger.info("👋 [WelcomeMessageHandler] No welcome message configured")
        return { isWelcomeMessage: false }
      }

      // Extract welcome message in customer's language
      let welcomeText = this.extractWelcomeText(
        workspace.welcomeMessage,
        input.customerLanguage || "it"
      )

      // 🤖 CRITICAL: Replace {{chatbotName}} with actual assistant name
      const chatbotName = workspace.chatbotName || "Assistente"
      welcomeText = welcomeText.replace(/\{\{chatbotName\}\}/g, chatbotName)
      
      logger.info("🤖 [WelcomeMessageHandler] Replaced chatbot name", {
        chatbotName,
        hasPlaceholder: workspace.welcomeMessage.toString().includes("{{chatbotName}}"),
      })

      // 🔧 FIX: Replace [LINK_REGISTRATION] token with actual registration link
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
            logger.info("🔗 [WelcomeMessageHandler] Replaced [LINK_REGISTRATION] with actual link")
          } else {
            logger.warn("⚠️ [WelcomeMessageHandler] Customer phone not found, cannot replace [LINK_REGISTRATION]")
          }
        } catch (error) {
          logger.error("❌ [WelcomeMessageHandler] Error replacing registration link:", error)
          // Keep [LINK_REGISTRATION] token if generation fails
        }
      }

      logger.info("👋 [WelcomeMessageHandler] Returning welcome message", {
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        welcomeMessageLength: welcomeText.length,
        customerLanguage: input.customerLanguage || "it",
        hasRegistrationLink: welcomeText.includes("http"),
      })

      // 🌍 CRITICAL: Translate welcome message to customer's language
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
   */
  private async generateRegistrationLink(
    phone: string,
    workspaceId: string
  ): Promise<string> {
    try {
      // Import services
      const { TokenService } = require("../application/services/token.service")
      const { UrlShortenerService } = require("../application/services/url-shortener.service")
      const { workspaceService } = require("../services/workspace.service")

      // Create registration token
      const tokenService = new TokenService()
      const token = await tokenService.createRegistrationToken(phone, workspaceId)

      // Get workspace base URL
      const workspaceUrl = await workspaceService.getWorkspaceURL(workspaceId)
      const registrationUrl = `${workspaceUrl.replace(/\/$/, "")}/registration?token=${token}`

      // Create short URL
      try {
        const urlShortenerService = new UrlShortenerService()
        const shortResult = await urlShortenerService.createShortUrl(
          registrationUrl,
          workspaceId
        )
        const finalLink = `${workspaceUrl.replace(/\/$/, "")}/s/${shortResult.shortCode}`
        logger.info(`📎 [WelcomeMessageHandler] Created short registration link: ${finalLink}`)
        return finalLink
      } catch (shortError) {
        logger.warn("⚠️ [WelcomeMessageHandler] Failed to create short URL, using long URL:", shortError)
        return registrationUrl
      }
    } catch (error) {
      logger.error("❌ [WelcomeMessageHandler] Error generating registration link:", error)
      throw error
    }
  }
}
