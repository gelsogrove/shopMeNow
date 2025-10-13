import * as fs from "fs"
import * as path from "path"
import { TokenService } from "../application/services/token.service"
import { LLMRequest } from "../types/whatsapp.types"
import logger from "../utils/logger"
import {
  calculateLLMCost,
  calculateLLMTokenUsage,
} from "../utils/token-calculator"
import { CallingFunctionsService } from "./calling-functions.service"
import { PromptProcessorService } from "./prompt-processor.service"
import translationSecurityService from "./translation-security.service"

//todo non va il singoloo ordine
export class LLMService {
  private callingFunctionsService: CallingFunctionsService
  private promptProcessorService: PromptProcessorService

  constructor() {
    this.callingFunctionsService = new CallingFunctionsService()
    this.promptProcessorService = new PromptProcessorService()
  }

  async handleMessage(
    llmRequest: LLMRequest,
    customerData?: any
  ): Promise<any> {
    console.log(
      "🚀 LLM: handleMessage chiamato per telefono:",
      llmRequest.phone
    )

    const messageRepo =
      new (require("../repositories/message.repository").MessageRepository)()
    const { workspaceService } = require("../services/workspace.service")

    // 🔧 DEBUG: Start collecting debug information
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

    // 🔧 DEBUG: Add customer and workspace info
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

    // 3. Blocca se blacklisted - non salvare nulla nello storico
    const isBlocked = await messageRepo.isCustomerBlacklisted(
      customer.phone,
      workspace.id
    )
    if (isBlocked || customer.isBlacklisted) {
      debugInfo.stage = "blocked_user"
      // Restituisci null per ignorare completamente questa interazione
      return {
        success: false,
        output: "❌ User blocked",
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

    // 🔧 DEBUG: Get link counts before processing
    const linkCounts = await messageRepo.getLinkCounts(workspaceId)
    debugInfo.linkCounts = linkCounts

    // 5. Pre-processing:
    const userLanguage = customer.language || workspace.language || "it"
    const faqs = await messageRepo.getActiveFaqs(workspace.id)
    const services = await messageRepo.getActiveServices(workspace.id)
    const categories = await messageRepo.getActiveCategories(workspace.id)
    const offers = await messageRepo.getActiveOffers(workspace.id, userLanguage)
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
    }

    // 🔧 DEBUG: Add user info to debug
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

    let promptWithVars = prompt
      .replace("{{FAQ}}", faqs)
      .replace("{{SERVICES}}", services)
      .replace("{{PRODUCTS}}", products)
      .replace("{{CATEGORIES}}", categories)
      .replace("{{OFFERS}}", offers)
      .replace("{{nameUser}}", userInfo.nameUser)
      .replace("{{discountUser}}", String(userInfo.discountUser))
      .replace("{{companyName}}", userInfo.companyName)
      .replace("{{lastordercode}}", userInfo.lastordercode)
      .replace("{{languageUser}}", userInfo.languageUser)

    // 🔧 SALVA IL PROMPT FINALE PER DEBUG
    try {
      const promptPath = path.join(process.cwd(), "prompt.txt")
      fs.writeFileSync(
        promptPath,
        `=== PROMPT GENERATO ${new Date().toISOString()} ===\n\n${promptWithVars}\n\n=== FINE PROMPT ===\n`
      )
    } catch (error) {
      console.log("❌ Errore salvando prompt:", error.message)
    }

    // 🔧 DEBUG: Add processed prompt info
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

    console.log(
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
      recentMessages // 🆕 Pass conversation history
    )

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
      logger.info("🔒 Applying Translation & Security Layer", {
        customerId: customer.id,
        language: userLanguage,
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
          allowedLinks
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
  private getLanguageDisplayName(languageCode: string): string {
    const languageMap: Record<string, string> = {
      it: "ITALIANO",
      en: "ENGLISH",
      es: "ESPAÑOL",
      pt: "Português",
    }
    return languageMap[languageCode] || languageCode.toUpperCase()
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

    console.log(`\n🔗 ====== REPLACE LINK TOKENS START ======`)
    console.log(`📝 Original response length: ${response.length}`)
    console.log(`🔎 Response preview: ${response.substring(0, 200)}...`)

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

      console.log(`🔍 [TOKEN-CHECK] Found token: ${token}`)

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

            console.log(
              `📎 [TOKEN-REPLACE] Replacing ${token} with: ${linkUrl}`
            )

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

            console.log(
              `📎 [TOKEN-REPLACE] Replacing ${token} with: ${profileUrl}`
            )

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

            console.log(
              `📎 [TOKEN-REPLACE] Replacing ${token} with: ${linkUrl}`
            )

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

              console.log(
                `📎 [TOKEN-REPLACE] Replacing ${token} with: ${catalogUrl}`
              )

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

    console.log(`\n🚨 ====== AUTO-FIX CHECK START ======`)
    console.log(`🌐 Workspace URL: ${workspaceUrl}`)
    console.log(`📝 Response to check: ${finalResponse}`)

    // Pattern 1: /orders (without token) -> generate proper link with token
    const ordersPattern = new RegExp(
      `${workspaceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/orders(?![\\-/])`,
      "g"
    )
    console.log(`🔍 Orders pattern: ${ordersPattern}`)
    console.log(
      `🔍 Orders pattern test result: ${ordersPattern.test(finalResponse)}`
    )

    // Reset lastIndex because test() moves it
    ordersPattern.lastIndex = 0

    if (ordersPattern.test(finalResponse)) {
      console.log(`⚠️ AUTO-FIX: Found hardcoded /orders link!`)
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

    console.log(`\n✅ ====== REPLACE LINK TOKENS END ======`)
    console.log(`📊 Total replacements: ${linkReplacements.length}`)
    console.log(`📝 Final response length: ${finalResponse.length}`)
    console.log(`📋 Replacements:`, JSON.stringify(linkReplacements, null, 2))

    return finalResponse
  }

  private getAvailableFunctions() {
    return [
      {
        type: "function",
        function: {
          name: "ContactOperator",
          description:
            "Connette l'utente con un operatore umano per assistenza specializzata. Usare quando l'utente richiede esplicitamente di parlare con un operatore o assistenza umana.",
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
          name: "GetShipmentTrackingLink",
          description:
            "Fornisce il link per tracciare la spedizione dell'ordine dell'utente. Usare quando l'utente vuole sapere dove si trova fisicamente il pacco o lo stato di spedizione. Se specificato un numero d'ordine, usa quello; altrimenti usa l'ultimo ordine.",
          parameters: {
            type: "object",
            properties: {
              orderCode: {
                type: "string",
                description:
                  "Il codice dell'ordine da tracciare. Se l'utente specifica un numero d'ordine (es. 'dove ordine ORD-123'), usa quello. Se dice 'ultimo ordine' usa lastordercode. Opzionale.",
              },
            },
            required: [],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "GetLinkOrderByCode",
          description:
            "Fornisce il link per visualizzare un ordine specifico tramite codice ordine. Usare quando l'utente vuole vedere un ordine specifico, la fattura, o dice 'ultimo ordine'.",
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
        if (msg.content === userQuery && msg.direction === "INCOMING") {
          continue
        }

        if (msg.direction === "INCOMING") {
          conversationHistory.push({
            role: "user",
            content: msg.content,
          })
        } else if (msg.direction === "OUTGOING" && msg.aiGenerated) {
          conversationHistory.push({
            role: "assistant",
            content: msg.content,
          })
        }
      }

      console.log(
        `💬 [HISTORY] Including ${conversationHistory.length} messages in context`
      )
      if (conversationHistory.length > 0) {
        console.log(
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

      console.log(
        `🔢 [MESSAGES] Total messages sent to LLM: ${messages.length}`
      )

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "ShopMe LLM Response",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini",
            messages: messages,
            tools: this.getAvailableFunctions(),
            temperature: 0,
            max_tokens: workspace.maxTokens || 5000,
          }),
        }
      )
      console.log("***language", language)
      console.log("🌐 OpenRouter status:", response.status)
      const data = await response.json()
      console.log("🌐 OpenRouter response:", JSON.stringify(data, null, 2))

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

      // Dizionario messaggi multilingua
      const i18n = {
        errors: {
          orderNotFound: {
            it: "Mi spiace non abbiamo trovato il tuo ordine. Di seguito la lista dei tuoi ordini: [LINK_ORDERS_WITH_TOKEN]",
            es: "Lo siento, no hemos encontrado tu pedido. Aquí tienes la lista de tus pedidos: [LINK_ORDERS_WITH_TOKEN]",
            pt: "Desculpe, não encontramos o seu pedido. Aqui está a lista dos seus pedidos: [LINK_ORDERS_WITH_TOKEN]",
            en: "Sorry, we couldn't find your order. Here is the list of your orders: [LINK_ORDERS_WITH_TOKEN]",
          },
          trackingNotFound: {
            it: "Mi spiace, al momento non riesco a trovare informazioni di tracking per il tuo ordine. Per assistenza contatta il nostro servizio clienti.",
            es: "Lo siento, en este momento no puedo encontrar información de seguimiento de tu pedido. Para asistencia contacta nuestro servicio de atención al cliente.",
            pt: "Desculpe, no momento não consigo encontrar informações de rastreamento do seu pedido. Para assistência, entre em contato com nosso atendimento ao cliente.",
            en: "Sorry, I can't find tracking information for your order right now. Please contact our customer service for assistance.",
          },
          generic: {
            it: "Si è verificato un errore.",
            es: "Se ha producido un error.",
            pt: "Ocorreu um erro.",
            en: "An error has occurred.",
          },
        },
        success: {
          orderLink: {
            it: "Ciao! Di seguito puoi trovare il link dell'ordine che stai cercando dove puoi scaricare la fattura e la bolla di trasporto:",
            es: "¡Hola! Aquí tienes el enlace de tu pedido donde puedes descargar la factura y la nota de envío:",
            pt: "Olá! Aqui está o link do seu pedido onde você pode baixar a fatura e a guia de transporte:",
            en: "Hello! Here is the link to your order where you can download the invoice and delivery note:",
          },
          trackingLink: {
            it: "Ciao! Il tuo ordine è in viaggio 📦 Segui il pacco in tempo reale:",
            es: "¡Hola! Tu pedido está en camino 📦 Sigue tu paquete en tiempo real:",
            pt: "Olá! Seu pedido está a caminho 📦 Acompanhe seu pacote em tempo real:",
            en: "Hello! Your order is on the way 📦 Track your package in real time:",
          },
          default: {
            it: "Ciao! 😊 Di seguito puoi vedere il tuo ordine: per motivi di sicurezza sarà valido per 1 ora -",
            es: "¡Hola! 😊 Aquí puedes ver tu pedido: por motivos de seguridad será válido durante 1 hora -",
            pt: "Olá! 😊 Aqui você pode ver seu pedido: por motivos de segurança será válido por 1 hora -",
            en: "Hello! 😊 Here you can see your order: for security reasons it will be valid for 1 hour -",
          },
        },
        fallback: {
          it: "Ciao! Come posso aiutarti oggi?",
          es: "¡Hola! ¿Cómo puedo ayudarte hoy?",
          pt: "Olá! Como posso te ajudar hoje?",
          en: "Hello! How can I help you today?",
        },
      }

      // 🔧 DEBUG: Track function calls
      let functionCalls: any[] = []

      // Gestione tool calls (chiamate funzioni)
      if (data.choices?.[0]?.message?.tool_calls) {
        const toolCall = data.choices[0].message.tool_calls[0]
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments || "{}")

        // 🔧 DEBUG: Record function call details
        functionCalls.push({
          functionName,
          functionArgs,
          timestamp: new Date().toISOString(),
        })

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
              response: i18n.errors.orderNotFound[language],
              tokenUsage,
              costInfo,
              functionCalls,
            }
          }
          if (functionName === "GetShipmentTrackingLink") {
            return {
              response: i18n.errors.trackingNotFound[language],
              tokenUsage,
              costInfo,
              functionCalls,
            }
          }
          return {
            response:
              functionResult.message ||
              functionResult.error ||
              i18n.errors.generic[language],
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        if (functionName === "GetLinkOrderByCode") {
          // Always return in Italian - Translation Layer will translate
          return {
            response: `${i18n.success.orderLink.it} ${functionResult.linkUrl || functionResult.output || functionResult.message} - valido per 1 ora`,
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        if (functionName === "GetShipmentTrackingLink") {
          return {
            response: `${i18n.success.trackingLink[language]} ${functionResult.linkUrl}`,
            tokenUsage,
            costInfo,
            functionCalls,
          }
        }

        return {
          response:
            functionResult.message ||
            functionResult.output ||
            functionResult.linkUrl ||
            `${i18n.success.default[language]} ${functionResult.linkUrl}`,
          tokenUsage,
          costInfo,
          functionCalls,
        }
      }

      const llmResponse =
        data.choices?.[0]?.message?.content || i18n.fallback[language]

      console.log("🎯 LLM Final Response:", llmResponse)
      return {
        response: llmResponse,
        tokenUsage,
        costInfo,
        functionCalls,
      }
    } catch (error) {
      console.error("❌ Error generating LLM response:", error)
      const errorMessages = {
        it: "❌ Mi dispiace, si è verificato un errore. Riprova più tardi.",
        es: "❌ Lo siento, se ha producido un error. Inténtalo más tarde.",
        pt: "❌ Desculpe, ocorreu um erro. Tente novamente mais tarde.",
        en: "❌ Sorry, an error occurred. Please try again later.",
      }
      return {
        response: errorMessages[language],
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
      switch (functionName) {
        case "ContactOperator":
          return await this.callingFunctionsService.contactOperator({
            customerId: customer.id,
            workspaceId: workspace.id,
            phoneNumber: customer.phone,
          })

        case "GetShipmentTrackingLink":
          return await this.callingFunctionsService.getShipmentTrackingLink({
            customerId: customer.id,
            workspaceId: workspace.id,
            orderCode:
              args.orderCode ||
              customerData?.lastordercode ||
              customer.lastOrderCode,
          })

        case "GetLinkOrderByCode":
          return await this.callingFunctionsService.getOrdersListLink({
            customerId: customer.id,
            workspaceId: workspace.id,
            orderCode:
              args.orderCode ||
              customerData?.lastordercode ||
              customer.lastOrderCode,
          })

        default:
          return { error: "Funzione non riconosciuta" }
      }
    } catch (error) {
      console.error(`❌ Error executing function ${functionName}:`, error)
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

      console.log(
        `📎 Created short registration link: ${finalRegistrationLink} → ${registrationLink}`
      )
      return finalRegistrationLink
    } catch (shortError) {
      console.warn(
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
}
