import * as fs from "fs"
import * as path from "path"
import { LinkGeneratorService } from "../application/services/link-generator.service"
import { TokenService } from "../application/services/token.service"
import { getLLMConfig } from "../config/llm.config"
import { LLMRequest } from "../types/whatsapp.types"
import logger from "../utils/logger"
import { CallingFunctionsService } from "./calling-functions.service"
import { PromptProcessorService } from "./prompt-processor.service"
import translationSecurityService from "./translation-security.service"

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
    customerData?: any
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
    let customer = await messageRepo.findCustomerByPhone(llmRequest.phone)
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

    // 3. Blocca se blacklisted O se chatbot disabilitato - non salvare nulla nello storico
    const isBlocked = await messageRepo.isCustomerBlacklisted(
      customer.phone,
      workspace.id
    )
    // Block if user is blacklisted OR if chatbot is disabled for this customer
    if (isBlocked || customer.isBlacklisted || !customer.activeChatbot) {
      debugInfo.stage = "blocked_user_or_chatbot_disabled"
      return {
        success: false,
        output:
          customer.activeChatbot === false
            ? "❌ Chatbot disabled for this customer"
            : "❌ User blocked",
        debugInfo: JSON.stringify(debugInfo),
      }
    }

    // 4. Get prompt
    const prompt = await workspaceService.getActivePromptByWorkspaceId(
      workspace.id
    )

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
    const categories = await messageRepo.getActiveCategories(workspace.id)
    const offers = await messageRepo.getActiveOffers(workspace.id)
    const customerDiscount = customer.discount || 0
    const products =
      (await messageRepo.getActiveProducts(workspace.id, customerDiscount)) ||
      ""

    const userInfo = {
      nameUser: customer.name || "",
      discountUser: customer.discount || 0,
      companyName: customer.company || "",
      lastordercode:
        customerData?.lastordercode || customer.lastOrderCode || "",
      languageUser: this.getLanguageDisplayName(userLanguage),
      agentName: customer.sales
        ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
        : "Non assegnato",
      agentPhone: customer.sales?.phone || "N/A",
      agentEmail: customer.sales?.email || "N/A",
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

    // Save processed prompt for debugging
    try {
      const promptPath = path.join(process.cwd(), "prompt.txt")
      fs.writeFileSync(
        promptPath,
        `=== PROMPT GENERATO ${new Date().toISOString()} ===\n\n${promptWithVars}\n\n=== FINE PROMPT ===\n`
      )
    } catch (error) {
      logger.info("❌ Errore salvando prompt:", error.message)
    }

    debugInfo.promptInfo = {
      originalLength: prompt.length,
      processedLength: promptWithVars.length,
      userMessageLength: llmRequest.chatInput.length,
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
   * Replace all link tokens in the response with actual URLs
   */
  private async replaceLinkTokens(
    response: string,
    customer: any,
    workspace: any,
    linkReplacements: any[] = []
  ): Promise<string> {
    let finalResponse = response

    // 🔗 Lista completa dei token supportati
    const SUPPORTED_TOKENS = [
      "[LINK_CHECKOUT_WITH_TOKEN]",
      "[LINK_PROFILE_WITH_TOKEN]",
      "[LINK_ORDERS_WITH_TOKEN]",
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

          case "[LINK_ORDERS_WITH_TOKEN]": {
            const ordersLink =
              await this.callingFunctionsService.getOrdersListLink({
                customerId: customer.id,
                workspaceId: workspace.id,
              })
            const linkUrl = ordersLink?.linkUrl || ""

            linkReplacements.push({
              token,
              replacedWith: linkUrl,
              tokenGenerated: ordersLink?.token || "N/A",
              shortUrlCreated: linkUrl.includes("/s/"),
              timestamp: new Date().toISOString(),
            })

            finalResponse = finalResponse.replace(token, linkUrl)
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
    // 🎯 PRIORITY ORDER (highest to lowest):
    // 1. ContactOperator (🚨 PRIORITY 1 - Frustration, explicit operator request)
    // 2. GetLinkOrderByCode (🚨 PRIORITY 2 - View specific order)
    // 3. repeatOrder (⚙️ PRIORITY 3 - Repeat previous order, requires confirmation)
    // 4. addProduct (⚙️ PRIORITY 4 - Add single product, requires confirmation)
    // 4.5. manageNotifications (🔔 PRIORITY 4.5 - SUBSCRIBE/UNSUBSCRIBE push notifications)
    // 5. searchProduct (📊 PRIORITY 5 - BACKGROUND ONLY, non-blocking)

    return [
      {
        type: "function",
        function: {
          name: "ContactOperator",
          description:
            "🚨 PRIORITY 1 - HIGHEST. CHIAMA IMMEDIATAMENTE quando utente: 1) RICHIEDE ESPLICITAMENTE operatore: 'operatore', 'parlare con operatore', 'assistenza umana', 'customer service', 'voglio parlare con', 'operator', 'human'. 2) ESPRIME FRUSTRAZIONE/PROBLEMA CRITICO (🔴 trigger automatico - NO conferma): 'merce scaduta', 'prodotto scaduto', 'scaduto', 'danneggiato', 'rotto', 'difettoso', 'marcio', 'andato a male', 'stufo/a', 'problema grave', 'sempre problemi', 'ogni volta', 'mai funziona', 'pessimo servizio', 'non funziona mai'. Se rilevi UNA di queste parole → ESEGUI SUBITO ContactOperator() senza chiedere conferma! NON rispondere con testo generico, CHIAMA la funzione!",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "GetLinkOrderByCode",
          description:
            "🚨 PRIORITY 2 - HIGH. Fornisce il link per visualizzare UN SINGOLO ordine specifico tramite codice ordine. Usare quando l'utente vuole: 'vedere ordine specifico', 'dettagli ordine', 'fattura ordine', 'ultimo ordine', 'ordine ORD-123'. Se orderCode non specificato → usa automaticamente lastordercode. IMPORTANTE: Ha PRIORITÀ sulle FAQ per 'ultimo ordine'. NON usare per 'lista tutti gli ordini' (usa [LINK_ORDERS_WITH_TOKEN] token). NON usare per tracking 'dov'è il mio ordine' (tracking fisico).",
          parameters: {
            type: "object",
            properties: {
              orderCode: {
                type: "string",
                description:
                  "Il codice dell'ordine da visualizzare. Se l'utente dice 'ultimo ordine' usa il lastordercode.",
              },
            },
            required: ["orderCode"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "repeatOrder",
          description:
            "⚙️ PRIORITY 3 - MEDIUM. Ripete esattamente lo stesso ordine di una volta precedente, aggiungendo TUTTI i prodotti al carrello. Usare quando l'utente dice: 'ripeti ordine', 'ordina di nuovo come prima', 'voglio lo stesso di prima', 'ripeti ultimo ordine', 'voglio rifare l'ultimo ordine', 'rifare ordine', 'come l'ultima volta', 'stesso ordine', 'stessi prodotti', 'ordina stessa cosa'. FLOW OBBLIGATORIO: 1) Mostra contenuto ordine, 2) Chiedi SEMPRE conferma 'Ricreo il tuo ultimo ordine?', 3) Se conferma → chiama repeatOrder(). Svuota carrello esistente e ricomincia pulito. Se orderCode non specificato → usa automaticamente ultimo ordine. Verifica disponibilità e avvisa se prodotti non disponibili. Dopo aggiunta → mostra link carrello. DISAMBIGUAZIONE: 'ripeti ordine'/'rifare ordine' = repeatOrder | 'aggiungi burrata' = addProduct.",
          parameters: {
            type: "object",
            properties: {
              orderCode: {
                type: "string",
                description:
                  "Codice ordine da ripetere (opzionale). Se non specificato, usa automaticamente l'ultimo ordine del cliente. Es: 'ORD-123'.",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "resetCart",
          description:
            "🗑️ PRIORITY 3.5 - MEDIUM (Richiede SEMPRE conferma). Svuota COMPLETAMENTE il carrello del cliente, eliminando TUTTI i prodotti/servizi. " +
            "QUANDO USARE: Cliente dice 'cancella carrello', 'svuota carrello', 'elimina tutto dal carrello', 'pulisci carrello', 'ricomincia da capo', 'reset carrello', 'rimuovi tutto'. " +
            "⚠️ DISAMBIGUAZIONE CRITICA: 'cancella CARRELLO' / 'svuota TUTTO' → resetCart() (elimina TUTTO il carrello) | 'cancella BURRATA' / 'rimuovi PARMIGIANO' → removeProduct() (elimina UN prodotto specifico). " +
            "🚨 FLOW OBBLIGATORIO: 1) Cliente chiede di svuotare carrello → 2) TU chiedi SEMPRE conferma: 'Vuoi davvero svuotare il carrello? Perderai tutti i prodotti! 🗑️' → 3) Aspetti risposta → 4a) Se conferma ('sì', 'ok', 'procedi', 'conferma') → chiami resetCart() → mostri messaggio successo | 4b) Se rifiuta ('no', 'aspetta', 'annulla') → NON chiami resetCart(), mantieni carrello. " +
            "❌ NON chiamare se: cliente vuole rimuovere UN prodotto specifico, cliente non ha confermato esplicitamente, carrello già vuoto. " +
            "DOPO svuotamento: mostra messaggio risultato CF + suggerisci offerte/prodotti per ricominciare.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "addProduct",
          description:
            "⚙️ PRIORITY 4 - MEDIUM. Aggiunge UN SINGOLO PRODOTTO al carrello del cliente. Usare SOLO DOPO che il cliente ha CONFERMATO di voler aggiungere il prodotto. FLOW OBBLIGATORIO: 1) Mostra prodotto con prezzo e stock, 2) Chiedi 'Vuoi aggiungerlo al carrello? 🛒', 3) Se conferma ('sì', 'ok', 'perfetto', 'aggiungi') → chiama addProduct(), 4) Dopo aggiunta → mostra link carrello. NON chiamare se: cliente non ha confermato, stock insufficiente, productCode mancante, prodotto non trovato, utente sta solo chiedendo info. DISAMBIGUAZIONE: 'hai la burrata?' = searchProduct (BACKGROUND) | 'aggiungi burrata' (DOPO conferma) = addProduct | 'ripeti ordine' = repeatOrder.",
          parameters: {
            type: "object",
            properties: {
              productCode: {
                type: "string",
                description:
                  "Codice esatto del prodotto da aggiungere (obbligatorio). Es: 'BUR-001', 'PAR-023', 'PRO-045'.",
              },
              quantity: {
                type: "number",
                description:
                  "Quantità da aggiungere (default: 1, deve essere intero positivo). Min: 1.",
              },
              notes: {
                type: "string",
                description:
                  "Note opzionali per il prodotto. Es: 'grande', 'bio', 'confezionato'.",
              },
            },
            required: ["productCode"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "manageNotifications",
          description:
            "🔔 PRIORITY 4.5 - MEDIUM. Gestisce sottoscrizione/cancellazione notifiche push WhatsApp. TRIGGER NATURALI (consigliati): Usare quando utente chiede in linguaggio naturale: 'voglio ricevere offerte', 'iscrivimi', 'subscribe me', 'quiero ofertas', 'quero receber', 'non voglio più offerte', 'disiscrivimi', 'unsubscribe', 'cancelar', etc. OPZIONE ALTERNATIVA (avanzata): riconosce keywords esatte 'SUBSCRIBE'/'UNSUBSCRIBE' (uppercase). FLOW OBBLIGATORIO: 1) Utente chiede iscrizione/disiscrizione (linguaggio naturale o keywords), 2) Chiedi conferma semplice: 'Vuoi iscriverti alle notifiche push? 📬' o 'Vuoi disiscriverti? 📭', 3) Se conferma ('sì','yes','si','sí','sim') → chiama manageNotifications(action), 4) Mostra messaggio risultato. {{SUBSCRIBE_MESSAGE}} token mostra invito SOLO se push_notifications_consent=false. NON suggerire mai disiscrizione nel chatbot normale (solo in campagne push). NON chiamare se: utente non ha confermato, contesto ambiguo.",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["SUBSCRIBE", "UNSUBSCRIBE"],
                description:
                  "Azione richiesta: SUBSCRIBE (iscriviti) o UNSUBSCRIBE (disiscriviti). SEMPRE maiuscolo nel parametro.",
              },
            },
            required: ["action"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "searchProduct",
          description:
            "📊 PRIORITY 5 - BACKGROUND ONLY (non-blocking). Registra la ricerca di un prodotto da parte del cliente per analytics e trend analysis. Usare quando l'utente cerca/chiede di un prodotto alimentare: 'hai la burrata?', 'avete prosciutto?', 'mi serve parmigiano', 'vendete champagne?', 'non trovate tartufo?'. Viene chiamata SIA per prodotti trovati CHE per prodotti NON trovati. ⚠️ BACKGROUND FUNCTION: Il LLM continua a rispondere NORMALMENTE dopo la chiamata, l'utente NON deve sapere della registrazione. NON bloccare il flusso conversazionale con messaggi tecnici tipo 'sto registrando'. La funzione viene eseguita in parallelo alla risposta. NON usare per prodotti non alimentari (software, auto, abbigliamento). NON chiamare due volte per stesso prodotto nella stessa conversazione. DISAMBIGUAZIONE: 'hai burrata?' = searchProduct (BACKGROUND) | 'aggiungi burrata' (DOPO conferma) = addProduct.",
          parameters: {
            type: "object",
            properties: {
              productName: {
                type: "string",
                description:
                  "Il nome del prodotto cercato dal cliente (obbligatorio, max 255 caratteri). Es: 'burrata', 'prosciutto di parma', 'vino rosso', 'champagne', 'tartufo', 'mozzarella'.",
              },
            },
            required: ["productName"],
          },
        },
      },
    ]
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
          "X-Title": "ShopMe LLM Response",
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
            "Sorry, we couldn't find your order. Here is the list of your orders: [LINK_ORDERS_WITH_TOKEN]",
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
      if (data.choices?.[0]?.message?.tool_calls) {
        const toolCall = data.choices[0].message.tool_calls[0]
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
                "X-Title": "ShopMe LLM Response",
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
          return await this.callingFunctionsService.contactOperator({
            customerId: customer.id,
            workspaceId: workspace.id,
            phoneNumber: customer.phone,
          })

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
          // ⚙️ PRIORITY 4 - MEDIUM (requires confirmation)
          logger.info("🛒 addProduct called (PRIORITY 4):", args)
          const {
            AddProduct,
          } = require("../domain/calling-functions/AddProduct")
          return await AddProduct({
            customerId: customer.id,
            workspaceId: workspace.id,
            productCode: args.productCode,
            quantity: args.quantity || 1,
            notes: args.notes,
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
    const registrationLink = `${workspaceUrl.replace(/\/$/, "")}/register?token=${token}`

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

  // Funzione che gestisce il flusso per un nuovo utente e ritorna direttamente l'oggetto di risposta
  private async NewUser(
    llmRequest: LLMRequest,
    workspace: any,
    messageRepo: any,
    debugInfo?: any
  ): Promise<any> {
    let welcomeMessage = await messageRepo.getWelcomeMessage(
      workspace.id,
      workspace.language || "it"
    )
    welcomeMessage =
      welcomeMessage ||
      "👋 Benvenuto! Devi prima registrarti per utilizzare i nostri servizi."

    const output = await this.newUserLink(
      llmRequest.phone,
      workspace.id,
      welcomeMessage
    )
    return {
      success: false,
      output,
      debugInfo: JSON.stringify(debugInfo || { stage: "new_user" }),
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
