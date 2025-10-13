import * as fs from "fs"
import * as path from "path"
import { TokenService } from "../application/services/token.service"
import { urlShortenerService } from "../application/services/url-shortener.service"
import { LLMRequest } from "../types/whatsapp.types"
import {
  calculateLLMCost,
  calculateLLMTokenUsage,
} from "../utils/token-calculator"
import { CallingFunctionsService } from "./calling-functions.service"
import { PromptProcessorService } from "./prompt-processor.service"

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
    const { replaceAllVariables } = require("../services/formatter")
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
    promptWithVars = replaceAllVariables(promptWithVars, userInfo)

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

    // resoonse
    const llmResult = await this.generateLLMResponse(
      promptWithVars,
      llmRequest.chatInput,
      workspace,
      customer,
      customerData,
      userLanguage,
      debugInfo // Pass debug info to track function calls
    )

    // 7. Post-processing: Replace link tokens
    const finalResponse = await this.replaceLinkTokens(
      llmResult.response,
      customer,
      workspace
    )

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
    workspace: any
  ): Promise<string> {
    let finalResponse = response

    // Replace checkout link token
    if (finalResponse.includes("[LINK_CHECKOUT_WITH_TOKEN]")) {
      const checkoutLink = await this.callingFunctionsService.getCartLink({
        customerId: customer.id,
        workspaceId: workspace.id,
      })
      let linkUrl = checkoutLink?.linkUrl || ""

      // Create short URL if we have a valid long URL
      if (linkUrl) {
        try {
          const shortResult = await urlShortenerService.createShortUrl(
            linkUrl,
            workspace.id
          )
          linkUrl = `http://localhost:3001${shortResult.shortUrl}`
          console.log(`📎 LLMService: Created short checkout link: ${linkUrl}`)
        } catch (error) {
          console.warn(
            "⚠️ LLMService: Failed to create short URL, using long URL:",
            error
          )
        }
      }

      finalResponse = finalResponse.replace(
        "[LINK_CHECKOUT_WITH_TOKEN]",
        linkUrl
      )
    }

    // Replace profile link token
    if (finalResponse.includes("[LINK_PROFILE_WITH_TOKEN]")) {
      const profileResult =
        await this.callingFunctionsService.replaceLinkWithToken(
          finalResponse,
          "profile",
          customer.id,
          workspace.id
        )
      finalResponse = finalResponse.replace(
        "[LINK_PROFILE_WITH_TOKEN]",
        profileResult?.message?.match(/https?:\/\/[^\s)]+/)?.[0] || ""
      )
    }

    // Replace orders link token
    if (finalResponse.includes("[LINK_ORDERS_WITH_TOKEN]")) {
      const ordersLink = await this.callingFunctionsService.getOrdersListLink({
        customerId: customer.id,
        workspaceId: workspace.id,
      })
      let linkUrl = ordersLink?.linkUrl || ""

      // Create short URL if we have a valid long URL
      if (linkUrl) {
        try {
          const shortResult = await urlShortenerService.createShortUrl(
            linkUrl,
            workspace.id
          )
          linkUrl = `http://localhost:3001${shortResult.shortUrl}`
          console.log(`📎 LLMService: Created short orders link: ${linkUrl}`)
        } catch (error) {
          console.warn(
            "⚠️ LLMService: Failed to create short URL for orders, using long URL:",
            error
          )
        }
      }

      finalResponse = finalResponse.replace("[LINK_ORDERS_WITH_TOKEN]", linkUrl)
    }

    // Replace catalog link token
    if (finalResponse.includes("[LINK_CATALOG]")) {
      const catalogResult =
        await this.callingFunctionsService.replaceLinkWithToken(
          finalResponse,
          "catalog",
          customer.id,
          workspace.id
        )
      if (catalogResult?.success && catalogResult?.message) {
        finalResponse = catalogResult.message
      }
    }

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
    debugInfo?: any
  ): Promise<{
    response: string
    tokenUsage?: any
    costInfo?: any
    functionCalls?: any[]
  }> {
    try {
      const messages = [
        {
          role: "system",
          content: processedPrompt,
        },
        {
          role: "user",
          content: userQuery,
        },
      ]

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
          return {
            response: `${i18n.success.orderLink[language]} ${functionResult.linkUrl || functionResult.output || functionResult.message} - ${
              language === "it"
                ? "valido per 1 ora"
                : language === "es"
                  ? "válido por 1 hora"
                  : language === "pt"
                    ? "válido por 1 hora"
                    : "valid for 1 hour"
            }`,
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
