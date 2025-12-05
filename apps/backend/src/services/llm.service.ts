import { SafetyTranslationAgent } from "../application/agents/SafetyTranslationAgent"
import { LinkGeneratorService } from "../application/services/link-generator.service"
import { TokenService } from "../application/services/token.service"
import { getAllFunctions } from "../config/agent-functions.config"
import { getLLMConfig } from "../config/llm.config"
import { LLMRequest } from "../types/whatsapp.types"
import logger from "../utils/logger"
import { CallingFunctionsService } from "./calling-functions.service"
import { PromptProcessorService } from "./prompt-processor.service"
import translationSecurityService from "./translation-security.service"
import { prisma } from "@echatbot/database"

/**
 * Simple token usage calculator (approximation)
 * OpenAI uses ~4 chars per token on average
 */
function calculateLLMTokenUsage(
  prompt: string,
  userQuery: string,
  completion: string
): { promptTokens: number; completionTokens: number; totalTokens: number } {
  const promptTokens = Math.ceil((prompt.length + userQuery.length) / 4)
  const completionTokens = Math.ceil(completion.length / 4)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  }
}

/**
 * Calculate LLM cost based on tokens and model
 * Prices per 1M tokens for gpt-4o-mini:
 * - Input: $0.15
 * - Output: $0.60
 */
function calculateLLMCost(
  promptTokens: number,
  completionTokens: number,
  model: string
): { inputCost: number; outputCost: number; totalCost: number } {
  const inputCostPer1M = 0.15
  const outputCostPer1M = 0.6

  const inputCost = (promptTokens / 1000000) * inputCostPer1M
  const outputCost = (completionTokens / 1000000) * outputCostPer1M

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  }
}

export class LLMService {
  private callingFunctionsService: CallingFunctionsService
  private promptProcessorService: PromptProcessorService

  constructor() {
    const linkGeneratorService = new LinkGeneratorService()
    this.callingFunctionsService = new CallingFunctionsService(
      linkGeneratorService
    )
    this.promptProcessorService = new PromptProcessorService()
  }

  async handleMessage(
    llmRequest: LLMRequest,
    customerData?: any,
    skipTranslation?: boolean // NEW: Skip translation when called from delegation
  ): Promise<any> {
    logger.info(
      "🚀 LLM: handleMessage chiamato per telefono:",
      llmRequest.phone
    )

    const messageRepo =
      new (require("../repositories/message.repository").MessageRepository)()
    const { workspaceService } = require("../services/workspace.service")

    const debugInfo: any = {
      stage: "initializing",
      timestamp: new Date().toISOString(),
      requestPhone: llmRequest.phone,
      requestWorkspaceId: llmRequest.workspaceId,
    }

    // 1. Get Data
    // 🔒 SECURITY: Find customer by phone AND workspace (prevents cross-workspace mix)
    let customer = await messageRepo.findCustomerByPhone(
      llmRequest.phone,
      llmRequest.workspaceId
    )
    const workspaceId = customer ? customer.workspaceId : llmRequest.workspaceId
    const workspace = await workspaceService.getById(workspaceId)

    debugInfo.workspaceId = workspaceId
    debugInfo.customerId = customer?.id || null
    debugInfo.customer = customer
      ? {
          name: customer.name,
          language: customer.language,
          discount: customer.discount,
          company: customer.company,
          lastOrderCode: customer.lastOrderCode || customerData?.lastordercode,
        }
      : null

    // 2. New User Check
    if (!customer) {
      debugInfo.stage = "new_user"
      return await this.NewUser(llmRequest, workspace, messageRepo, debugInfo)
    }

    // 3. Blocca se blacklisted - NON processare ma SALVARE messaggio in history
    const isBlocked = await messageRepo.isCustomerBlacklisted(
      customer.phone,
      workspace.id
    )

    // Block if user is blacklisted
    if (isBlocked || customer.isBlacklisted) {
      debugInfo.stage = "blocked_user"
      return {
        success: false,
        output: "❌ User blocked",
        debugInfo: JSON.stringify(debugInfo),
      }
    }

    // 3b. Se chatbot disabilitato, SALVA messaggio ma NON processare con LLM
    if (!customer.activeChatbot) {
      debugInfo.stage = "chatbot_disabled_save_only"

      // Salva messaggio cliente in history
      await messageRepo.saveMessage({
        customerId: customer.id,
        workspaceId: workspace.id,
        direction: "INBOUND",
        content: llmRequest.chatInput,
        type: "TEXT",
        aiGenerated: false,
        metadata: {
          chatbotDisabled: true,
          savedAt: new Date().toISOString(),
        },
      })

      logger.info("✅ Message saved to history (chatbot disabled)", {
        customerId: customer.id,
        messageLength: llmRequest.chatInput.length,
      })

      return {
        success: true,
        output:
          "Message saved to history (chatbot disabled - no LLM processing)",
        debugInfo: JSON.stringify(debugInfo),
        chatbotDisabled: true, // Flag per sapere che non deve inviare risposta
      }
    }

    // 4. Get prompt - SPECIFIC AGENT if agentType provided, otherwise Router
    const agentType = (llmRequest as any).agentType || "ROUTER"
    let prompt: string | null = null

    if (agentType && agentType !== "ROUTER") {
      // Get specific agent prompt from database
      const prisma = new (require("@prisma/client").PrismaClient)()
      const agentConfig = await prisma.agentConfig.findFirst({
        where: {
          workspaceId: workspace.id,
          type: agentType,
          isActive: true,
        },
      })
      prompt = agentConfig?.systemPrompt || null
      await prisma.$disconnect()

      logger.info(`🤖 Loading prompt for specific agent: ${agentType}`, {
        found: !!prompt,
        promptLength: prompt?.length || 0,
      })
    } else {
      // Default: get Router agent prompt
      prompt = await workspaceService.getActivePromptByWorkspaceId(workspace.id)
    }

    if (!prompt) {
      debugInfo.stage = "no_prompt"
      return {
        success: false,
        output: "❌ Servizio temporaneamente non disponibile.",
        debugInfo: JSON.stringify(debugInfo),
      }
    }

    const linkCounts = await messageRepo.getLinkCounts(workspaceId)
    debugInfo.linkCounts = linkCounts

    // 5. Pre-processing:
    const userLanguage = customer.language || workspace.language || "it"
    const faqs = await messageRepo.getActiveFaqs(workspace.id)
    const services = await messageRepo.getActiveServices(workspace.id)

    // Use customerData if provided (from delegation), otherwise fetch from DB
    const categories =
      customerData?.CATEGORIES ||
      (await messageRepo.getActiveCategories(workspace.id))
    const offers =
      customerData?.OFFERS || (await messageRepo.getActiveOffers(workspace.id))
    const customerDiscount = customer.discount || 0
    const products =
      customerData?.PRODUCTS ||
      (await messageRepo.getActiveProducts(workspace.id, customerDiscount)) ||
      ""

    // 🔍 DEBUG: Log catalog data
    logger.info("📦 Catalog data for LLM", {
      hasProducts: !!products,
      productsLength: products?.length || 0,
      productsPreview: products?.substring(0, 200),
      hasCategories: !!categories,
      hasOffers: !!offers,
      usingCustomerData: !!customerData?.PRODUCTS,
    })

    const userInfo = {
      nameUser: customerData?.nameUser || customer.name || "",
      discountUser: customerData?.discountUser || customer.discount || 0,
      companyName: customerData?.companyName || customer.company || "",
      lastordercode:
        customerData?.lastordercode || customer.lastOrderCode || "",
      languageUser:
        customerData?.languageUser || this.getLanguageDisplayName(userLanguage),
      agentName:
        customerData?.agentName ||
        (customer.sales
          ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
          : "Non assegnato"),
      agentPhone: customerData?.agentPhone || customer.sales?.phone || "N/A",
      agentEmail: customerData?.agentEmail || customer.sales?.email || "N/A",
      push_notifications_consent: customer.push_notifications_consent || false,
    }

    debugInfo.userInfo = {
      language: userLanguage,
      discount: customerDiscount,
      lastOrder: userInfo.lastordercode,
      displayLanguage: userInfo.languageUser,
    }

    if (!faqs && !products && !services && !categories) {
      debugInfo.stage = "no_content"
      return {
        success: false,
        output:
          "❌ Non ci sono FAQ, Prodotti, Servizi o Categorie disponibili.",
        debugInfo: JSON.stringify(debugInfo),
      }
    }

    // Get token duration from env and format it for display
    const tokenDuration = this.formatTokenDuration(
      process.env.TOKEN_EXPIRATION || "1h"
    )

    // Get workspace URL for {{URL}} replacement
    const workspaceUrl = workspace.url || "http://localhost:3000"

    // 🔍 DEBUG: Check prompt BEFORE replacement (for PRODUCT_SEARCH only)
    if ((llmRequest as any).agentType === "PRODUCT_SEARCH") {
      logger.info("🔍 BEFORE replacement", {
        promptLength: prompt.length,
        hasPlaceholder: prompt.includes("{{PRODUCTS}}"),
        placeholderCount: (prompt.match(/\{\{PRODUCTS\}\}/g) || []).length,
      })
    }

    let promptWithVars = prompt
      .replace("{{FAQ}}", faqs)
      .replace("{{SERVICES}}", services)
      .replace("{{PRODUCTS}}", products)
      .replace("{{CATEGORIES}}", categories)
      .replace("{{OFFERS}}", offers)
      .replace(/\{\{URL\}\}/g, workspaceUrl) // Replace ALL occurrences of {{URL}}
      .replace(/\{\{nameUser\}\}/g, userInfo.nameUser) // Replace ALL occurrences
      .replace(/\{\{discountUser\}\}/g, String(userInfo.discountUser)) // Replace ALL occurrences
      .replace(/\{\{companyName\}\}/g, userInfo.companyName) // Replace ALL occurrences
      .replace(/\{\{lastordercode\}\}/g, userInfo.lastordercode) // Replace ALL occurrences
      .replace(/\{\{languageUser\}\}/g, userInfo.languageUser) // Replace ALL occurrences - FIX BUG LINGUA
      .replace(/\{\{agentName\}\}/g, userInfo.agentName) // Replace ALL occurrences
      .replace(/\{\{agentPhone\}\}/g, userInfo.agentPhone) // Replace ALL occurrences
      .replace(/\{\{agentEmail\}\}/g, userInfo.agentEmail) // Replace ALL occurrences
      .replace(/\{\{TOKEN_DURATION\}\}/g, tokenDuration) // Replace ALL occurrences

    // ❌ REMOVED: prompt.txt generation (obsolete - use AgentConversationLog for debugging)
    // Old code wrote to prompt.txt file for debugging
    // New multi-agent system logs everything to database via AgentLoggerService

    debugInfo.promptInfo = {
      originalLength: prompt.length,
      processedLength: promptWithVars.length,
      userMessageLength: llmRequest.chatInput.length,
    }

    // 🔍 DEBUG: Check if {{PRODUCTS}} was replaced
    if ((llmRequest as any).agentType === "PRODUCT_SEARCH") {
      const hasProductsPlaceholder = promptWithVars.includes("{{PRODUCTS}}")
      const hasProductsContent = promptWithVars.includes("Panettone Classico")
      const hasDolciCategory = promptWithVars.includes("**DESSERTS**")
      const productsHasPanettone =
        products?.includes("Panettone Classico") || false
      const productsHasDesserts = products?.includes("**DESSERTS**") || false

      logger.info("🔍 PRODUCT_SEARCH prompt check", {
        hasPlaceholder: hasProductsPlaceholder,
        hasProductContentInPrompt: hasProductsContent,
        hasDolciCategoryInPrompt: hasDolciCategory,
        hasProductContentInSource: productsHasPanettone,
        hasDolciCategoryInSource: productsHasDesserts,
        promptLength: promptWithVars.length,
        productsSourceLength: products?.length || 0,
      })
    }

    // 6.5 Get conversation history (last 5 minutes for context)
    const recentMessages = await messageRepo.getRecentMessagesByTime(
      customer.phone,
      5, // Last 5 minutes of conversation for full context
      workspace.id
    )

    logger.info(
      `📚 [HISTORY] Retrieved ${recentMessages.length} messages from last 5 minutes for context`
    )
    debugInfo.historyMessagesCount = recentMessages.length

    // resoonse
    const llmResult = await this.generateLLMResponse(
      promptWithVars,
      llmRequest.chatInput,
      workspace,
      customer,
      customerData,
      userLanguage,
      debugInfo, // Pass debug info to track function calls
      recentMessages // Pass conversation history
    )

    // Check if LLM response is valid before post-processing
    if (!llmResult || !llmResult.response) {
      logger.error("❌ LLM returned empty or invalid response", {
        llmResult,
        customerId: customer.id,
      })
      return {
        success: false,
        output: "Mi dispiace, il servizio LLM non è al momento disponibile.",
        debugInfo: JSON.stringify({
          ...debugInfo,
          error: "LLM returned empty response",
        }),
      }
    }

    // 7. Post-processing: Replace link tokens
    const linkReplacements: any[] = []
    let finalResponse = await this.replaceLinkTokens(
      llmResult.response,
      customer,
      workspace,
      linkReplacements // Pass array to collect replacement info
    )
    debugInfo.linkReplacements = linkReplacements

    // 8. 🔒 TRANSLATION & SECURITY LAYER - Final filter before sending to customer
    // 🚨 SKIP if called from delegation (Router will handle translation)
    if (skipTranslation) {
      logger.info("⏭️ Skipping Translation & Security Layer (delegation mode)")
      debugInfo.translationSkipped = true
    } else {
      try {
        // 🔧 Get LLM config to use same model/provider as agent
        const agentConfig = (workspace as any).agentConfigs?.[0]
        const agentModel = agentConfig?.model
        const llmConfig = getLLMConfig(agentModel)

        logger.info("🔒 Applying Translation & Security Layer", {
          customerId: customer.id,
          language: userLanguage,
          usingAgentModel: agentModel, // 📊 Same model as agent
          usingProvider: llmConfig.useLocal
            ? "Ollama (local)"
            : "OpenRouter (cloud)",
        })

        // Build list of allowed system links (all other links will be blocked)
        const workspaceUrl = workspace.url || "http://localhost:3000"
        const allowedLinks = [
          workspaceUrl, // Base workspace URL
          `${workspaceUrl}/s/`, // Short URLs (secure with token)
          `${workspaceUrl}/orders-public`, // Public orders (secure with token)
          `${workspaceUrl}/register`, // Registration page
          `${workspaceUrl}/api/`, // API endpoints
          "https://wa.me/", // WhatsApp official links
        ]

        // 🚨 SECURITY: /orders and /checkout are NOT allowed!
        // They must use short URLs with tokens generated by auto-fix

        const translationResult =
          await translationSecurityService.processResponse(
            finalResponse,
            userLanguage,
            allowedLinks,
            llmConfig.model, // Use same model as agent
            llmConfig.baseURL, // Use same baseURL as agent (Ollama or OpenRouter)
            llmConfig.apiKey // Use same API key as agent
          )

        if (translationResult.blocked) {
          logger.warn("⚠️ SECURITY: Blocked inappropriate content", {
            customerId: customer.id,
            reason: translationResult.reason,
            originalLength: finalResponse.length,
          })
        }

        finalResponse = translationResult.translatedText
        debugInfo.translationBlocked = translationResult.blocked
        debugInfo.translationReason = translationResult.reason
      } catch (error) {
        logger.error("❌ Translation & Security Layer failed", error)
        // Continue with original response if translation fails
      }
    }

    // 🔧 DEBUG: Complete debug information
    debugInfo.stage = "completed"
    debugInfo.finalResponseLength = finalResponse.length
    debugInfo.tokenUsage = llmResult.tokenUsage
    debugInfo.costInfo = llmResult.costInfo
    debugInfo.functionCalls = llmResult.functionCalls || []

    return {
      success: true,
      output: finalResponse,
      debugInfo: JSON.stringify(debugInfo),
    }
  }

  /**
   * Converte il codice lingua nel nome visualizzato corretto per il prompt
   * @param languageCode Codice lingua (it, en, es, pt)
   * @returns Nome lingua per il prompt
   */
  /**
   * Converte il codice lingua in nome visualizzabile
   * IMPORTANTE: Se language è null/undefined/empty, defaulta a ITALIANO (lingua base del sistema)
   * @param languageCode - Codice lingua (IT, ENG, ESP, PRT) - può essere null
   * @returns Nome visualizzabile della lingua (ITALIANO, ENGLISH, ESPAÑOL, PORTUGUÊS)
   */
  private getLanguageDisplayName(
    languageCode: string | null | undefined
  ): string {
    // ⚠️ FALLBACK: Se language è null/undefined/empty, defaulta a ITALIANO
    if (!languageCode || languageCode.trim() === "") {
      logger.warn(
        "⚠️ [LANGUAGE] Customer language is null/undefined/empty, defaulting to ITALIANO"
      )
      return "ITALIANO" // Default per L'Altra Italia
    }

    const languageMap: Record<string, string> = {
      // Lowercase format (old)
      it: "ITALIANO",
      en: "ENGLISH",
      es: "ESPAÑOL",
      pt: "PORTUGUÊS",
      // Uppercase format (database)
      IT: "ITALIANO",
      ENG: "ENGLISH",
      ESP: "ESPAÑOL",
      PRT: "PORTUGUÊS",
    }

    const displayName = languageMap[languageCode]

    // Se il codice non è riconosciuto, default a ITALIANO (non uppercase del codice sconosciuto)
    if (!displayName) {
      logger.warn(
        `⚠️ [LANGUAGE] Unknown language code: ${languageCode}, defaulting to ITALIANO`
      )
      return "ITALIANO"
    }

    return displayName
  }

  /**
   * Converte il formato durata token (es. "1h", "30m", "2h") in formato leggibile
   * @param duration Durata in formato "1h", "30m", etc.
   * @returns Durata formattata per il prompt (es. "1 ora", "30 minuti", "2 ore")
   */
  private formatTokenDuration(duration: string): string {
    // Estrai numero e unità (es. "1h" -> numero=1, unità=h)
    const match = duration.match(/^(\d+)([hm])$/)
    if (!match) return "1 ora" // Fallback

    const value = parseInt(match[1], 10)
    const unit = match[2]

    if (unit === "h") {
      return value === 1 ? "1 ora" : `${value} ore`
    } else if (unit === "m") {
      return value === 1 ? "1 minuto" : `${value} minuti`
    }

    return "1 ora" // Fallback
  }

  /**
   * 🆕 Handle new user welcome message flow
   *
   * This is the ONLY entry point for new user messages.
   * Ensures ALL messages go through Safety & Translation layer.
   *
   * @param phone - Customer phone number
   * @param workspaceId - Workspace ID
   * @param messageContent - Original message from customer
   * @returns Object with welcome message, registration link, and debug info
   */
  async handleNewUserWelcome(
    phone: string,
    workspaceId: string,
    messageContent: string
  ): Promise<{
    success: boolean
    message: string
    debugInfo: any
  }> {
    const startTime = Date.now()

    logger.info(`🆕 handleNewUserWelcome called for new user`, {
      phone,
      workspaceId,
    })

    try {
      const messageRepo =
        new (require("../repositories/message.repository").MessageRepository)()
      const { workspaceService } = require("../services/workspace.service")

      // 1. Get workspace
      const workspace = await workspaceService.getById(workspaceId)
      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`)
      }

      // 2. Get welcome message from database (English)
      const welcomeMessageEnglish =
        await messageRepo.getWelcomeMessage(workspaceId)
      if (!welcomeMessageEnglish) {
        throw new Error("Welcome message not configured in database")
      }

      // 3. Detect customer language
      const {
        detectLanguageFromPhonePrefix,
      } = require("../utils/language-detector")
      const detectedLanguage = detectLanguageFromPhonePrefix(phone)

      // 4. Translate through Safety & Translation layer (MANDATORY)
      const welcomeMessageTranslated = await this.translateSystemMessage(
        welcomeMessageEnglish,
        workspaceId,
        detectedLanguage,
        undefined,
        "new_user_welcome"
      )

      // 5. Generate registration link
      const registrationLink = await this.generateRegistrationLink(
        phone,
        workspaceId
      )

      // 6. Build complete message with link
      const { getRegistrationText } = require("../utils/language-detector")
      const registrationText = getRegistrationText(detectedLanguage)
      const completeMessage = `${welcomeMessageTranslated}\n\n🔗 **${registrationText.link}:**\n${registrationLink}\n\n⏰ ${registrationText.validity}`

      const executionTimeMs = Date.now() - startTime

      const debugInfo = {
        stage: "new_user_welcome",
        translationLayerPassed: true,
        detectedLanguage,
        executionTimeMs,
        timestamp: new Date().toISOString(),
      }

      logger.info(`✅ handleNewUserWelcome completed`, {
        phone,
        workspaceId,
        detectedLanguage,
        executionTimeMs,
      })

      return {
        success: true,
        message: completeMessage,
        debugInfo,
      }
    } catch (error) {
      logger.error(`❌ handleNewUserWelcome failed`, {
        phone,
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error // Don't send message if translation/safety failed
    }
  }

  /**
   * Replace all link tokens in the response with actual URLs
   */
  private async replaceLinkTokens(
    response: string,
    customer: any,
    workspace: any,
    linkReplacements: any[] = []
  ): Promise<string> {
    let finalResponse = response

    // 🚨 NORMALIZE WRONG TOKENS - LLM sometimes writes wrong patterns
    // Convert all wrong variations to correct token format BEFORE checking
    const wrongProfilePatterns = [
      /\[link profilo\]/gi,
      /\[link profile\]/gi,
      /\[profilo link\]/gi,
      /link profilo(?!\w)/gi,
    ]
    wrongProfilePatterns.forEach(pattern => {
      if (pattern.test(finalResponse)) {
        logger.warn(`⚠️ LLM wrote wrong token, normalizing to [LINK_PROFILE_WITH_TOKEN]`)
        finalResponse = finalResponse.replace(pattern, "[LINK_PROFILE_WITH_TOKEN]")
      }
    })

    const wrongCartPatterns = [
      /\[link carrello\]/gi,
      /\[link cart\]/gi,
      /link carrello(?!\w)/gi,
    ]
    wrongCartPatterns.forEach(pattern => {
      if (pattern.test(finalResponse)) {
        logger.warn(`⚠️ LLM wrote wrong cart token, normalizing to [LINK_CHECKOUT_WITH_TOKEN]`)
        finalResponse = finalResponse.replace(pattern, "[LINK_CHECKOUT_WITH_TOKEN]")
      }
    })

    // 🔗 Lista completa dei token supportati
    const SUPPORTED_TOKENS = [
      "[LINK_CHECKOUT_WITH_TOKEN]",
      "[LINK_PROFILE_WITH_TOKEN]",
      "[LINK_CATALOG]",
      "[LINK_REGISTRATION_WITH_TOKEN]",
    ] as const

    // 🔍 Check e replace di tutti i token in sequenza
    for (const token of SUPPORTED_TOKENS) {
      if (!finalResponse.includes(token)) continue

      try {
        switch (token) {
          case "[LINK_CHECKOUT_WITH_TOKEN]": {
            const checkoutLink = await this.callingFunctionsService.getCartLink(
              {
                customerId: customer.id,
                workspaceId: workspace.id,
              }
            )
            const linkUrl = checkoutLink?.linkUrl || ""

            linkReplacements.push({
              token,
              replacedWith: linkUrl,
              tokenGenerated: checkoutLink?.token || "N/A",
              shortUrlCreated: linkUrl.includes("/s/"),
              timestamp: new Date().toISOString(),
            })

            finalResponse = finalResponse.replace(token, linkUrl)
            break
          }

          case "[LINK_PROFILE_WITH_TOKEN]": {
            const profileResult =
              await this.callingFunctionsService.replaceLinkWithToken(
                finalResponse,
                "profile",
                customer.id,
                workspace.id
              )
            const profileUrl =
              profileResult?.message?.match(/https?:\/\/[^\s)]+/)?.[0] || ""

            linkReplacements.push({
              token,
              replacedWith: profileUrl,
              tokenGenerated: (profileResult as any)?.token || "N/A",
              shortUrlCreated: profileUrl.includes("/s/"),
              timestamp: new Date().toISOString(),
            })

            finalResponse = finalResponse.replace(token, profileUrl)
            break
          }

          case "[LINK_CATALOG]": {
            const catalogResult =
              await this.callingFunctionsService.replaceLinkWithToken(
                finalResponse,
                "catalog",
                customer.id,
                workspace.id
              )
            if (catalogResult?.success && catalogResult?.message) {
              const catalogUrl =
                catalogResult.message.match(/https?:\/\/[^\s)]+/)?.[0] || ""

              linkReplacements.push({
                token,
                replacedWith: catalogUrl,
                tokenGenerated: (catalogResult as any)?.token || "N/A",
                shortUrlCreated: catalogUrl.includes("/s/"),
                timestamp: new Date().toISOString(),
              })

              finalResponse = catalogResult.message
            }
            break
          }

          case "[LINK_REGISTRATION_WITH_TOKEN]": {
            // TODO: Implementare la logica per il token di registrazione
            logger.warn(
              `⚠️ [TOKEN-REPLACE] Token ${token} found but not implemented yet`
            )
            break
          }

          default:
            logger.warn(`⚠️ [TOKEN-REPLACE] Unknown token: ${token}`)
        }
      } catch (error) {
        logger.error(`❌ [TOKEN-REPLACE] Error replacing ${token}:`, error)
      }
    }

    // 🚨 AUTO-FIX: Replace hardcoded links with proper tokens (LAST STEP)
    const workspaceUrl = workspace.url || "http://localhost:3000"

    // Pattern 1: /orders (without token) -> generate proper link with token
    const ordersPattern = new RegExp(
      `${workspaceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/orders(?![\\-/])`,
      "g"
    )

    if (ordersPattern.test(finalResponse)) {
      logger.warn(
        `⚠️ AUTO-FIX: LLM generated hardcoded /orders link, replacing with token-based link`
      )

      // Generate proper orders link with token
      const ordersLink = await this.callingFunctionsService.getOrdersListLink({
        customerId: customer.id,
        workspaceId: workspace.id,
      })

      const properOrdersLink = ordersLink?.linkUrl || ""

      // Replace the hardcoded link
      finalResponse = finalResponse.replace(ordersPattern, properOrdersLink)

      linkReplacements.push({
        token: "[AUTO-FIX: hardcoded /orders]",
        replacedWith: properOrdersLink,
        tokenGenerated: ordersLink?.token || "N/A",
        shortUrlCreated: properOrdersLink.includes("/s/"),
        timestamp: new Date().toISOString(),
        autoFixed: true,
      })

      logger.info(
        `✅ AUTO-FIX: Replaced hardcoded /orders link with: ${properOrdersLink}`
      )
    }

    // Pattern 2: /checkout (without token) -> generate proper link with token
    const checkoutPattern = new RegExp(
      `${workspaceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/checkout(?![\\-/])`,
      "g"
    )
    if (checkoutPattern.test(finalResponse)) {
      logger.warn(
        `⚠️ AUTO-FIX: LLM generated hardcoded /checkout link, replacing with token-based link`
      )

      const checkoutLink = await this.callingFunctionsService.getCartLink({
        customerId: customer.id,
        workspaceId: workspace.id,
      })

      const properCheckoutLink = checkoutLink?.linkUrl || ""
      finalResponse = finalResponse.replace(checkoutPattern, properCheckoutLink)

      linkReplacements.push({
        token: "[AUTO-FIX: hardcoded /checkout]",
        replacedWith: properCheckoutLink,
        tokenGenerated: checkoutLink?.token || "N/A",
        shortUrlCreated: properCheckoutLink.includes("/s/"),
        timestamp: new Date().toISOString(),
        autoFixed: true,
      })

      logger.info(
        `✅ AUTO-FIX: Replaced hardcoded /checkout link with: ${properCheckoutLink}`
      )
    }

    return finalResponse
  }

  private getAvailableFunctions() {
    // ✅ SINGLE SOURCE OF TRUTH: Functions loaded from agent-functions.config.ts
    // This ensures consistency between LLM, database seed, and frontend UI
    return getAllFunctions()
  }

  private async generateLLMResponse(
    processedPrompt: string,
    userQuery: string,
    workspace: any,
    customer: any,
    customerData?: any,
    language: "it" | "es" | "pt" | "en" = "it", // default italiano
    debugInfo?: any,
    recentMessages: any[] = [] // 🆕 Conversation history
  ): Promise<{
    response: string
    tokenUsage?: any
    costInfo?: any
    functionCalls?: any[]
  }> {
    try {
      // Build conversation history from recent messages (last 5 minutes)
      const conversationHistory: any[] = []

      // Messages come in desc order, reverse for chronological (oldest to newest)
      const messagesToInclude = recentMessages.reverse()

      for (const msg of messagesToInclude) {
        // Skip current message to avoid duplication
        if (msg.content === userQuery && msg.direction === "INBOUND") {
          continue
        }

        if (msg.direction === "INBOUND") {
          conversationHistory.push({
            role: "user",
            content: msg.content,
          })
        } else if (msg.direction === "OUTBOUND" && msg.aiGenerated) {
          conversationHistory.push({
            role: "assistant",
            content: msg.content,
          })
        }
      }

      logger.info(
        `💬 [HISTORY] Including ${conversationHistory.length} messages in context`
      )
      if (conversationHistory.length > 0) {
        logger.info(
          `📝 [HISTORY] Last message in history:`,
          conversationHistory[conversationHistory.length - 1]
        )
      }

      const messages = [
        {
          role: "system",
          content: processedPrompt,
        },
        ...conversationHistory, // 🆕 Add conversation history
        {
          role: "user",
          content: userQuery,
        },
      ]

      logger.info(
        `🔢 [MESSAGES] Total messages sent to LLM: ${messages.length}`
      )

      // 🤖 Get LLM configuration (supports local Ollama or cloud OpenRouter)
      // If model starts with "LOCAL:" → automatically uses Ollama
      // FIX: workspace has agentConfigs (array), not agentConfig (singular)
      const agentConfig = (workspace as any).agentConfigs?.[0]
      const agentModel = agentConfig?.model
      logger.info(`📊 Agent model from DB: "${agentModel}"`)
      const llmConfig = getLLMConfig(agentModel)
      logger.info(
        `🤖 Using ${llmConfig.useLocal ? "LOCAL" : "CLOUD"} LLM: ${llmConfig.model} at ${llmConfig.baseURL}`
      )

      // Debug API key
      if (!llmConfig.apiKey) {
        logger.error("❌ API KEY MANCANTE! llmConfig.apiKey è vuoto/undefined")
      }

      const response = await fetch(`${llmConfig.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llmConfig.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "eChatbot LLM Response",
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: messages,
          tools: this.getAvailableFunctions(),
          temperature: 0,
          max_tokens: workspace.maxTokens || 5000,
        }),
      })
      logger.info("***language", language)
      logger.info(
        `🌐 ${llmConfig.useLocal ? "Ollama" : "OpenRouter"} status:`,
        response.status
      )

      // Check if response is OK
      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`❌ LLM API Error (${response.status}):`, errorText)
        throw new Error(`LLM API returned ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      logger.info(
        `🌐 ${llmConfig.useLocal ? "Ollama" : "OpenRouter"} response:`,
        JSON.stringify(data, null, 2)
      )

      // Verify response structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        logger.error("❌ Invalid LLM response structure:", data)
        throw new Error("LLM response missing choices/message")
      }
      // 🔧 DEBUG: Calculate token usage and cost
      let tokenUsage: any = null
      let costInfo: any = null

      if (data.usage) {
        tokenUsage = {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }

        costInfo = calculateLLMCost(
          data.usage.prompt_tokens,
          data.usage.completion_tokens,
          "openai/gpt-4o-mini"
        )
      } else {
        // Fallback calculation if API doesn't return usage
        const estimatedUsage = calculateLLMTokenUsage(
          processedPrompt,
          userQuery,
          data.choices?.[0]?.message?.content || ""
        )
        tokenUsage = estimatedUsage
        costInfo = calculateLLMCost(
          estimatedUsage.promptTokens,
          estimatedUsage.completionTokens,
          "openai/gpt-4o-mini"
        )
      }

      // 🌍 Base messages in English - Translation & Security Layer will translate to customer's language
      const i18n = {
        errors: {
          orderNotFound:
            "Sorry, we couldn't find your order. Please provide the order code and I'll help you find it.",
          trackingNotFound:
            "Sorry, I can't find tracking information for your order right now. Please contact our customer service for assistance.",
          generic: "An error has occurred.",
        },
        success: {
          orderLink:
            "Hello! To protect your privacy I cannot send you the details here via WhatsApp but here is a secure link where you can download documents and see all the details realted, Do you need help with anything else? 😊",
          trackingLink:
            "Hello! Your order is on the way 📦 Track your package in real time:",
          default:
            "Hello! 😊 Here you can see your order: for security reasons it will be valid for 1 hour -",
        },
        fallback: "Hello! How can I help you today? ",
      }

      // 🔧 DEBUG: Track function calls
      let functionCalls: any[] = []

      // 🧪 TEST MODE: If in test environment, only track function calls without executing them
      const isTestMode =
        process.env.NODE_ENV === "test" ||
        process.env.INTEGRATION_TEST === "true"

      // Gestione tool calls (chiamate funzioni)
      // 🔧 SUPPORT MULTIPLE TOOL CALLS - Process all tool_calls returned by LLM
      if (data.choices?.[0]?.message?.tool_calls) {
        const toolCalls = data.choices[0].message.tool_calls

        // 🚨 Log multiple function calls
        if (toolCalls.length > 1) {
          logger.info(
            `🔄 Multiple function calls detected: ${toolCalls.length} calls`
          )
          toolCalls.forEach((tc, idx) => {
            logger.info(`  ${idx + 1}. ${tc.function.name}`)
          })
        }

        // Process FIRST tool call (for now, maintain backward compatibility)
        const toolCall = toolCalls[0]
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments || "{}")

        // 🔧 DEBUG: Record function call details
        functionCalls.push({
          name: functionName,
          arguments: functionArgs,
          timestamp: new Date().toISOString(),
        })

        // 🧪 TEST MODE: Skip function execution, just return detection info
        if (isTestMode) {
          logger.info(
            `🧪 [TEST MODE] Function detected but NOT executed: ${functionName}`
          )
          const testResponse =
            data.choices[0].message.content ||
            `Function ${functionName} would be called with args: ${JSON.stringify(functionArgs)}`

          return {
            response: testResponse,
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        // 📊 BACKGROUND FUNCTIONS (PRIORITY 5) - Non bloccare il flusso conversazionale
        // Queste funzioni vengono eseguite in parallelo senza aspettare il risultato
        // L'utente NON è consapevole dell'esecuzione, il LLM risponde normalmente
        const BACKGROUND_FUNCTIONS = ["searchProduct"]

        if (BACKGROUND_FUNCTIONS.includes(functionName)) {
          // Esegui la funzione in background (non aspettare il risultato)
          logger.info(
            `🔍 [BACKGROUND] Executing ${functionName} in background...`
          )
          this.executeFunctionCall(
            functionName,
            functionArgs,
            customer,
            workspace,
            customerData
          ).catch((error) => {
            logger.error(`❌ [BACKGROUND] Error in ${functionName}:`, error)
          })

          // Chiedi all'LLM di generare una risposta naturale come se la funzione non fosse stata chiamata
          logger.info(
            "💬 [BACKGROUND] Asking LLM for natural response (ignoring function call)..."
          )

          // Fai una seconda chiamata all'LLM dicendogli che la funzione è stata eseguita con successo
          // ma chiedi una risposta naturale come se non ci fosse stata chiamata
          const followUpMessages = [
            {
              role: "system",
              content: processedPrompt,
            },
            ...conversationHistory,
            {
              role: "user",
              content: userQuery,
            },
            {
              role: "assistant",
              content: null,
              tool_calls: [toolCall],
            },
            {
              role: "tool",
              tool_call_id: toolCall.id,
              name: functionName,
              content: JSON.stringify({
                success: true,
                message: "Ricerca registrata con successo (background)",
              }),
            },
          ]

          // 🤖 Get LLM configuration for follow-up request
          // FIX: workspace has agentConfigs (array), not agentConfig (singular)
          const agentConfigFollowUp = (workspace as any).agentConfigs?.[0]
          const llmConfigFollowUp = getLLMConfig(agentConfigFollowUp?.model)

          const followUpResponse = await fetch(
            `${llmConfigFollowUp.baseURL}/chat/completions`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${llmConfigFollowUp.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3001",
                "X-Title": "eChatbot LLM Response",
              },
              body: JSON.stringify({
                model: llmConfigFollowUp.model,
                messages: followUpMessages,
                temperature: 0,
                max_tokens: workspace.maxTokens || 5000,
              }),
            }
          )

          const followUpData = await followUpResponse.json()
          logger.info(
            "🌐 [BACKGROUND] Follow-up response:",
            JSON.stringify(followUpData, null, 2)
          )

          const naturalResponse =
            followUpData.choices?.[0]?.message?.content ||
            i18n.fallback[language]

          logger.info(
            `✅ [BACKGROUND] Natural response generated:`,
            naturalResponse
          )

          return {
            response: naturalResponse,
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        // Funzioni NORMALI (bloccanti) - comportamento originale
        const functionResult = await this.executeFunctionCall(
          functionName,
          functionArgs,
          customer,
          workspace,
          customerData
        )

        // Add function result to debug info
        functionCalls[0].result = {
          success: functionResult.success,
          message: functionResult.message || functionResult.output,
        }

        if (functionResult.success === false) {
          if (functionName === "GetLinkOrderByCode") {
            return {
              response: i18n.errors.orderNotFound,
              tokenUsage,
              costInfo,
              functionCalls,
            }
          }
          if (functionName === "GetShipmentTrackingLink") {
            return {
              response: i18n.errors.trackingNotFound,
              tokenUsage,
              costInfo,
              functionCalls,
            }
          }
          return {
            response:
              functionResult.message ||
              functionResult.error ||
              i18n.errors.generic,
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        if (functionName === "ContactOperator") {
          // 🚨 CRITICAL: Return EXACT message from function - NO LLM reformulation
          // Operator escalation must use precise, contractual language
          const processedMessage = this.replaceVariablesInResponse(
            functionResult.message || "",
            {
              nameUser: customerData?.nameUser || customer.name || "Cliente",
              discountUser: String(
                customerData?.discountUser || customer.discount || 0
              ),
              companyName:
                customerData?.companyName || workspace.name || "Shop",
              lastordercode:
                customerData?.lastordercode || customer.lastOrderCode || "",
              languageUser:
                customerData?.languageUser || customer.language || language,
              agentName: customer.sales
                ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
                : "Alessandro Romano",
              agentPhone: customer.sales?.phone || "+39 333 890 1234",
              agentEmail:
                customer.sales?.email || "andrea_gelsomino@hotmail.com",
              tokenDuration: this.getTokenDurationText(
                process.env.TOKEN_EXPIRATION || "1h"
              ),
            }
          )

          return {
            response: processedMessage,
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        if (functionName === "GetLinkOrderByCode") {
          // Always return in English - Translation & Security Layer will translate to customer's language
          const tokenDuration = this.getTokenDurationText(
            process.env.TOKEN_EXPIRATION || "15m"
          )
          return {
            response: `${i18n.success.orderLink} ${functionResult.linkUrl || functionResult.output || functionResult.message}\n\n⏰ Link valid for ${tokenDuration}`,
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        // Replace variables in function result message before returning
        const rawResponse =
          functionResult.message ||
          functionResult.output ||
          functionResult.linkUrl ||
          `${i18n.success.default[language]} ${functionResult.linkUrl}`

        const processedFunctionResponse = this.replaceVariablesInResponse(
          rawResponse,
          {
            nameUser: customerData?.nameUser || customer.name || "Cliente",
            discountUser: String(
              customerData?.discountUser || customer.discount || 0
            ),
            companyName: customerData?.companyName || workspace.name || "Shop",
            lastordercode:
              customerData?.lastordercode || customer.lastOrderCode || "",
            languageUser:
              customerData?.languageUser || customer.language || language,
            agentName: customer.sales
              ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
              : "Agente",
            agentPhone: customer.sales?.phone || "N/A",
            agentEmail: customer.sales?.email || "info@laltrait.com",
            tokenDuration: this.getTokenDurationText(
              process.env.TOKEN_EXPIRATION || "1h"
            ),
          }
        )

        // 🔗 Replace link tokens in CF response (e.g., [LINK_CHECKOUT_WITH_TOKEN])
        const linkReplacements: any[] = []
        const finalFunctionResponse = await this.replaceLinkTokens(
          processedFunctionResponse,
          customer,
          workspace,
          linkReplacements
        )

        return {
          response: finalFunctionResponse,
          tokenUsage,
          costInfo,
          functionCalls,
        }
      }

      const llmResponse = data.choices?.[0]?.message?.content || i18n.fallback

      logger.info(
        `📝 LLM Response content length: ${llmResponse?.length || 0} chars`
      )

      // 🔧 POST-PROCESS: Replace variables in LLM response
      // LLM might generate text with {{variables}} that need to be replaced
      const processedResponse = this.replaceVariablesInResponse(llmResponse, {
        nameUser: customerData?.nameUser || customer.name || "Cliente",
        discountUser: String(
          customerData?.discountUser || customer.discount || 0
        ),
        companyName: customerData?.companyName || workspace.name || "Shop",
        lastordercode:
          customerData?.lastordercode || customer.lastOrderCode || "",
        languageUser:
          customerData?.languageUser || customer.language || language,
        agentName: customer.sales
          ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
          : "Agente",
        agentPhone: customer.sales?.phone || "N/A",
        agentEmail: customer.sales?.email || "info@laltrait.com",
        tokenDuration: this.getTokenDurationText(
          process.env.TOKEN_EXPIRATION || "1h"
        ),
      })

      logger.info("🎯 LLM Final Response:", processedResponse)
      return {
        response: processedResponse,
        tokenUsage,
        costInfo,
        functionCalls,
      }
    } catch (error) {
      logger.error("❌ Error generating LLM response:", error)
      return {
        response:
          "❌ Sorry, an error occurred. Please try again later. Translation & Security Layer will translate this.",
        tokenUsage: null,
        costInfo: null,
        functionCalls: [],
      }
    }
  }

  private async executeFunctionCall(
    functionName: string,
    args: any,
    customer: any,
    workspace: any,
    customerData?: any
  ): Promise<any> {
    try {
      // 🎯 PRIORITY ORDER (reflected in switch statement order):
      // 1. ContactOperator (🚨 PRIORITY 1 - Frustration, explicit operator request)
      // 2. GetLinkOrderByCode (🚨 PRIORITY 2 - View specific order)
      // 3. repeatOrder (⚙️ PRIORITY 3 - Repeat previous order)
      // 4. addProduct (⚙️ PRIORITY 4 - Add single product)
      // 5. searchProduct (📊 PRIORITY 5 - BACKGROUND ONLY)

      switch (functionName) {
        case "ContactOperator":
          // 🚨 PRIORITY 1 - HIGHEST
          logger.info("📞 ContactOperator called (PRIORITY 1)")
          const contactResult = await this.callingFunctionsService.contactOperator({
            customerId: customer.id,
            workspaceId: workspace.id,
            phoneNumber: customer.phone,
          })
          
          // 📧 Se il Summary Agent è stato eseguito, logga per debug
          if (contactResult.summaryAgentExecuted) {
            logger.info("🤖 Summary Agent executed within ContactOperator", {
              agentType: "summary_agent",
              ticketId: contactResult.ticketId,
              emailSent: contactResult.summaryEmailSent,
              timestamp: new Date().toISOString(),
              function: "ContactOperator"
            })
          }
          
          return contactResult

        case "GetLinkOrderByCode":
          // 🚨 PRIORITY 2 - HIGH
          logger.info("📦 GetLinkOrderByCode called (PRIORITY 2):", args)
          return await this.callingFunctionsService.getOrdersListLink({
            customerId: customer.id,
            workspaceId: workspace.id,
            orderCode:
              args.orderCode ||
              customerData?.lastordercode ||
              customer.lastOrderCode,
          })

        case "repeatOrder":
          // ⚙️ PRIORITY 3 - MEDIUM (requires confirmation)
          logger.info("� repeatOrder called (PRIORITY 3):", args)
          const {
            RepeatOrder,
          } = require("../domain/calling-functions/RepeatOrder")
          return await RepeatOrder({
            customerId: customer.id,
            workspaceId: workspace.id,
            orderCode: args.orderCode,
          })

        case "resetCart":
          // 🗑️ PRIORITY 3.5 - MEDIUM (requires confirmation)
          logger.info("🗑️ resetCart called (PRIORITY 3.5):", args)
          const { ResetCart } = require("../domain/calling-functions/ResetCart")
          return await ResetCart({
            customerId: customer.id,
            workspaceId: workspace.id,
          })
        case "addProduct":
          // 🛒 PRIORITY 4 - MEDIUM (requires confirmation, add one or more products)
          logger.info("🛒 addProduct called (PRIORITY 4):", args)
          const {
            AddProduct,
          } = require("../domain/calling-functions/AddProduct")
          return await AddProduct({
            customerId: customer.id,
            workspaceId: workspace.id,
            products: args.products, // Array of {productCode, quantity, notes}
          })

        case "manageNotifications":
          // 🔔 PRIORITY 4.5 - MEDIUM (SUBSCRIBE/UNSUBSCRIBE push notifications)
          logger.info("🔔 manageNotifications called (PRIORITY 4.5):", args)
          return await this.callingFunctionsService.manageNotifications({
            action: args.action,
            customerId: customer.id,
            workspaceId: workspace.id,
          })

        case "searchProduct":
          // 📊 PRIORITY 5 - BACKGROUND ONLY (non-blocking, analytics)
          logger.info(
            "🔍 searchProduct called (PRIORITY 5 - BACKGROUND):",
            args
          )
          return await this.callingFunctionsService.searchProduct({
            customerId: customer.id,
            workspaceId: workspace.id,
            productName: args.productName,
          })

        default:
          logger.error(`❌ Unknown function: ${functionName}`)
          return { error: "Funzione non riconosciuta" }
      }
    } catch (error) {
      logger.error(`❌ Error executing function ${functionName}:`, error)
      return { error: `Errore nell'esecuzione della funzione ${functionName}` }
    }
  }

  // Funzione helper per generare il messaggio di benvenuto con link di registrazione
  private async newUserLink(
    phone: string,
    workspaceId: string,
    welcomeMessage: string
  ): Promise<string> {
    const registrationLink = await this.generateRegistrationLink(
      phone,
      workspaceId
    )
    if (welcomeMessage.includes("[LINK_REGISTRATION_WITH_TOKEN]")) {
      return welcomeMessage.replace(
        "[LINK_REGISTRATION_WITH_TOKEN]",
        registrationLink
      )
    } else {
      return (
        welcomeMessage + `\nPer registrarti clicca qui: ${registrationLink}`
      )
    }
  }
  private async generateRegistrationLink(
    phone: string,
    workspaceId: string
  ): Promise<string> {
    // Crea un token di registrazione e restituisci il link completo
    const tokenService = new TokenService()
    const messageRepo =
      new (require("../repositories/message.repository").MessageRepository)()
    const token = await tokenService.createRegistrationToken(phone, workspaceId)
    const workspaceUrl = await messageRepo.getWorkspaceUrl(workspaceId)
    const registrationLink = `${workspaceUrl.replace(/\/$/, "")}/registration?token=${token}`

    // Create short URL for registration link
    try {
      const {
        URLShortenerService,
      } = require("../application/services/url-shortener.service")
      const urlShortenerService = new URLShortenerService()

      const shortResult = await urlShortenerService.createShortUrl(
        registrationLink,
        workspaceId
      )
      const finalRegistrationLink = `${workspaceUrl.replace(/\/$/, "")}${shortResult.shortUrl}`

      logger.info(
        `📎 Created short registration link: ${finalRegistrationLink} → ${registrationLink}`
      )
      return finalRegistrationLink
    } catch (shortError) {
      logger.warn(
        "⚠️ Failed to create short URL for registration, using long URL:",
        shortError
      )
      return registrationLink
    }
  }

  /**
   * Translate system message (welcome/WIP) through Safety & Translation layer
   * @param message - System message in English
   * @param workspaceId - Workspace ID
   * @param targetLanguage - Customer's language (it/es/en/pt)
   * @param customerName - Optional customer name for context
   * @param messageType - Type of message for debug logging
   * @returns Translated and safety-checked message
   */
  private async translateSystemMessage(
    message: string,
    workspaceId: string,
    targetLanguage: string,
    customerName?: string,
    messageType: string = "system_message"
  ): Promise<string> {
    const startTime = Date.now()

    try {
      logger.info(
        `🌐 Translating ${messageType} through Safety & Translation layer`,
        {
          workspaceId,
          targetLanguage,
          messageType,
          originalLength: message.length,
        }
      )

      const safetyAgent = new SafetyTranslationAgent(prisma)
      const result = await safetyAgent.process({
        workspaceId,
        response: message,
        targetLanguage,
        customerName,
        allowedLinks: [], // System messages don't have dynamic links
      })

      const executionTimeMs = Date.now() - startTime

      if (!result.safe) {
        logger.error(`❌ ${messageType} BLOCKED by Safety & Translation`, {
          workspaceId,
          blockedReason: result.blockedReason,
          messageType,
        })
        // BLOCK: Don't send if safety check fails
        throw new Error(`System message blocked: ${result.blockedReason}`)
      }

      logger.info(`✅ ${messageType} translated successfully`, {
        workspaceId,
        targetLanguage,
        tokensUsed: result.tokensUsed,
        executionTimeMs,
        messageType,
      })

      return result.translatedText
    } catch (error) {
      logger.error(`❌ Failed to translate ${messageType}`, {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
        messageType,
      })
      throw error // BLOCK: Don't fall back to untranslated message
    }
  }

  // Funzione che gestisce il flusso per un nuovo utente e ritorna direttamente l'oggetto di risposta
  private async NewUser(
    llmRequest: LLMRequest,
    workspace: any,
    messageRepo: any,
    debugInfo?: any
  ): Promise<any> {
    const startTime = Date.now()

    // 1. Get welcome message from database (English only)
    const welcomeMessageEnglish = await messageRepo.getWelcomeMessage(
      workspace.id
    )

    if (!welcomeMessageEnglish) {
      throw new Error(
        "Welcome message not configured in database - this should not happen"
      )
    }

    // 2. Detect customer language
    const {
      detectLanguageFromPhonePrefix,
    } = require("../utils/language-detector")
    const detectedLanguage = detectLanguageFromPhonePrefix(llmRequest.phone)

    logger.info(
      `🌐 NewUser: Detected language ${detectedLanguage} for phone ${llmRequest.phone}`
    )

    // 3. Translate welcome message through Safety & Translation layer
    let welcomeMessage: string
    try {
      welcomeMessage = await this.translateSystemMessage(
        welcomeMessageEnglish,
        workspace.id,
        detectedLanguage,
        undefined, // No customer name yet (new user)
        "welcome_message"
      )

      debugInfo = {
        ...debugInfo,
        stage: "new_user_welcome",
        translationLayerPassed: true,
        detectedLanguage,
        translationTimeMs: Date.now() - startTime,
      }
    } catch (translationError) {
      // BLOCK: If translation fails, don't send message
      logger.error("❌ NewUser: Translation layer BLOCKED welcome message", {
        error:
          translationError instanceof Error
            ? translationError.message
            : String(translationError),
        workspaceId: workspace.id,
        phone: llmRequest.phone,
      })

      throw new Error(
        `Welcome message translation failed: ${translationError instanceof Error ? translationError.message : "Unknown error"}`
      )
    }

    // 4. Generate registration link and build final message
    const output = await this.newUserLink(
      llmRequest.phone,
      workspace.id,
      welcomeMessage
    )

    return {
      success: false,
      output,
      debugInfo: JSON.stringify(debugInfo),
    }
  }

  /**
   * Replace variables in LLM response
   * LLM might generate text with {{variables}} that need to be replaced with actual values
   */
  private replaceVariablesInResponse(
    text: string,
    variables: {
      nameUser: string
      discountUser: string
      companyName: string
      lastordercode: string
      languageUser: string
      agentName: string
      agentPhone: string
      agentEmail: string
      tokenDuration: string
    }
  ): string {
    let result = text

    // Replace all known variables
    result = result.replace(/\{\{nameUser\}\}/g, variables.nameUser)
    result = result.replace(/\{\{discountUser\}\}/g, variables.discountUser)
    result = result.replace(/\{\{companyName\}\}/g, variables.companyName)
    result = result.replace(/\{\{lastordercode\}\}/g, variables.lastordercode)
    result = result.replace(/\{\{languageUser\}\}/g, variables.languageUser)
    result = result.replace(/\{\{agentName\}\}/g, variables.agentName)
    result = result.replace(/\{\{agentPhone\}\}/g, variables.agentPhone)
    result = result.replace(/\{\{agentEmail\}\}/g, variables.agentEmail)
    result = result.replace(/\{\{TOKEN_DURATION\}\}/g, variables.tokenDuration)

    return result
  }

  /**
   * Convert token expiration time to human-readable text
   */
  private getTokenDurationText(expiration: string): string {
    const hours = parseInt(expiration.replace(/[^0-9]/g, ""))

    if (expiration.includes("h")) {
      return hours === 1 ? "1 ora" : `${hours} ore`
    } else if (expiration.includes("m")) {
      const minutes = hours
      return `${minutes} minuti`
    } else if (expiration.includes("d")) {
      const days = hours
      return days === 1 ? "1 giorno" : `${days} giorni`
    }

    // Default fallback
    return "1 ora"
  }
}
