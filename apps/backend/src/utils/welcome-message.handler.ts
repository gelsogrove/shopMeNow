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
import { TokenService } from "../application/services/token.service"
import { linkGeneratorService } from "../application/services/link-generator.service"
import { workspaceService } from "../services/workspace.service"

export interface WelcomeMessageInput {
  customerId: string
  workspaceId: string
  customerLanguage?: string
  customerMessage: string
  conversationId?: string
  channel?: string
  /** When true, skip saving welcome exchange to conversationMessage table.
   *  Used for FLOW workspaces: FlowWorkspaceStrategy saves the combined
   *  welcome+flow response as a single DB entry instead. */
  skipSave?: boolean
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

      // Welcome message is now supported on ALL channels (widget + whatsapp)

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
          enableWelcomeMessage: true,
          chatbotName: true,
          botIdentityResponse: true,
          customAiRules: true,
          address: true,
          name: true,
          toneOfVoice: true,
          channelMode: true,
          customChatbotId: true,
        },
      })

      // Workspaces running an internal custom chatbot (ecolaundry etc.) generate
      // their own greeting on the first turn. Skipping the standalone welcome
      // here avoids the duplicate "Ciao!" + duplicate-user-message issue.
      if (workspace?.customChatbotId || workspace?.channelMode === "FLOW") {
        logger.info("🚫 [WelcomeMessageHandler] Internal chatbot owns the greeting - skipping standalone welcome", {
          workspaceId: input.workspaceId,
          customChatbotId: workspace?.customChatbotId,
          channelMode: workspace?.channelMode,
        })
        return { isWelcomeMessage: false }
      }

      logger.info("🔍 [WelcomeMessageHandler] Workspace loaded", {
        workspaceId: input.workspaceId,
        hasWorkspace: !!workspace,
        hasWelcomeMessage: !!workspace?.welcomeMessage,
        welcomeMessageType: typeof workspace?.welcomeMessage,
        welcomeMessageLength: workspace?.welcomeMessage ? String(workspace.welcomeMessage).length : 0,
        enableWelcomeMessage: workspace?.enableWelcomeMessage,
      })

      // E0a: Check enable flag AND message content
      // enableWelcomeMessage defaults to true - only skip if explicitly set to false
      if (!workspace || workspace.enableWelcomeMessage === false || !workspace.welcomeMessage) {
        logger.info("🚫 [WelcomeMessageHandler] No welcome message (disabled or not configured)")
        return { isWelcomeMessage: false }
      }

      // ─── ATOMIC WELCOME CLAIM: prevent race condition ────────────────────
      // Problem: user sends 2 messages in quick succession (< LLM processing time).
      // Both requests read previousMessageCount=0 before the first save completes.
      // Both would fire welcome, causing duplicate "Ciao!" messages.
      // Fix: atomically set context.welcomeSent=true ONLY IF it's not already true.
      // PostgreSQL's conditional UPDATE ensures exactly ONE request wins the race.
      if (input.conversationId && !input.conversationId.startsWith("temp-")) {
        try {
          const rowsUpdated = (await this.prisma.$executeRaw`
            UPDATE "ChatSession"
            SET context = jsonb_set(COALESCE(context, '{}'), '{welcomeSent}', 'true')
            WHERE id = ${input.conversationId}
              AND COALESCE(context->>'welcomeSent', 'false') != 'true'
          `) as unknown as number

          if (rowsUpdated === 0) {
            // Another concurrent request already claimed the welcome slot
            logger.info("⚡ [WelcomeMessageHandler] Welcome already claimed by concurrent request — skipping duplicate", {
              customerId: input.customerId,
              conversationId: input.conversationId,
            })
            return { isWelcomeMessage: false }
          }

          logger.info("🔒 [WelcomeMessageHandler] Welcome slot claimed atomically", {
            customerId: input.customerId,
            conversationId: input.conversationId,
          })
        } catch (rawSqlError: any) {
          // Non-critical: if the atomic check fails, proceed anyway (count-based check already passed)
          logger.warn("⚠️ [WelcomeMessageHandler] Atomic welcome claim failed (non-critical):", rawSqlError?.message)
        }
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
        input.customerLanguage || "en"
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
        chatbotNameFromDB: fullWorkspace.chatbotName,
        companyName: variables.companyName,
        hasBotIdentity: !!variables.botIdentityResponse,
        hasCustomAiRules: !!variables.customAiRules,
      })

      if (!fullWorkspace.chatbotName) {
        logger.warn(`⚠️ [WelcomeMessageHandler] workspace.chatbotName is null in DB — using fallback "${variables.chatbotName}". Fix: set chatbotName in Settings > AI Personality.`)
      }

      // 🔍 DEBUG: Log ENTIRE welcome message after variable replacement
      logger.info("*******PROMPT WELCOME MESSAGE AFTER VARIABLE REPLACEMENT*******")
      logger.info(welcomeText)
      logger.info("*******END PROMPT*******")

      logger.info("👋 [WelcomeMessageHandler] Returning welcome message", {
        customerId: input.customerId,
        workspaceId: input.workspaceId,
        welcomeMessageLength: welcomeText.length,
        customerLanguage: input.customerLanguage || "en",
        hasRegistrationToken: welcomeText.includes("[LINK_REGISTRATION]"),
      })

      // 🌍 CRITICAL: Translate welcome message to customer's language FIRST
      const customerLanguage = input.customerLanguage || "en"
      
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

      // 🔧 FIX: Replace [LINK_REGISTRATION] token AFTER translation to prevent link being broken
      // 🚨 WORKAROUND: Generate direct link without URL shortener to avoid Prisma module error on Heroku
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
            // Create registration token
            const tokenService = new TokenService()
            const token = await tokenService.createRegistrationToken(customer.phone, input.workspaceId)

            // Get workspace URL and custom registration page
            const { url: workspaceUrl, registrationPage } = 
              await workspaceService.getWorkspaceURLWithRegistration(input.workspaceId)

            // Use LinkGeneratorService to create short link (with retry logic)
            const registrationLink = await linkGeneratorService.generateRegistrationLink(
              token,
              workspaceUrl,
              input.workspaceId,
              registrationPage,
              input.customerLanguage // 🌍 Pass customer language for registration page i18n
            )

            welcomeText = welcomeText.replace(/\[LINK_REGISTRATION\]/g, registrationLink)
            logger.info("🔗 [WelcomeMessageHandler] Replaced [LINK_REGISTRATION] with link", {
              linkGenerated: registrationLink.substring(0, 60) + "...",
              isShortLink: registrationLink.includes("/s/"),
            })
          } else {
            logger.warn("⚠️ [WelcomeMessageHandler] Customer phone not found, cannot replace [LINK_REGISTRATION]")
          }
        } catch (error) {
          logger.error("❌ [WelcomeMessageHandler] Error replacing registration link:", error)
          // Keep [LINK_REGISTRATION] token if generation fails
        }
      }

      // Save welcome exchange to conversation history
      // Skip when skipSave=true (FLOW workspaces): the combined welcome+flow
      // response is saved by FlowWorkspaceStrategy as a single DB entry.
      let assistantMessageId: string | undefined
      if (!input.skipSave) {
        const conversationId = input.conversationId || `temp-${input.customerId}`
        assistantMessageId = await this.saveWelcomeMessages(
          input.workspaceId,
          input.customerId,
          conversationId,
          input.customerMessage,
          welcomeText
        )
      }

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
    return ["it", "en", "es", "pt", "fr", "de"].includes(normalized) ? normalized : "en"
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
    workspaceId: string,
    customerLanguage?: string | null
  ): Promise<string> {
    try {
      // Create registration token
      const tokenService = new TokenService()
      const token = await tokenService.createRegistrationToken(phone, workspaceId)

      // Get workspace URL and custom registration page (if configured)
      const { url: workspaceUrl, registrationPage } =
        await workspaceService.getWorkspaceURLWithRegistration(workspaceId)

      // Use centralized link generator service (imported singleton)
      const registrationLink = await linkGeneratorService.generateRegistrationLink(
        token,
        workspaceUrl,
        workspaceId,
        registrationPage, // Pass custom registration page if configured
        customerLanguage // 🌍 Pass customer language for registration page i18n
      )

      logger.info(`📎 [WelcomeMessageHandler] Created registration link: ${registrationLink}`)
      return registrationLink
    } catch (error) {
      logger.error("❌ [WelcomeMessageHandler] Error generating registration link:", error)
      throw error
    }
  }
}
