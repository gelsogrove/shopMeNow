import { PrismaClient } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { TokenService } from "../application/services/token.service"
import { LLMRequest } from "../types/whatsapp.types"
import { CallingFunctionsService } from "./calling-functions.service"
import { PromptProcessorService } from "./prompt-processor.service"

export class LLMService {
  private callingFunctionsService: CallingFunctionsService
  private promptProcessorService: PromptProcessorService
  private prisma: PrismaClient

  constructor() {
    this.callingFunctionsService = new CallingFunctionsService()
    this.promptProcessorService = new PromptProcessorService()
    this.prisma = new PrismaClient()
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

    // 1. Get Data - TRACCIAMO TUTTO IL FLUSSO!
    let customer = await messageRepo.findCustomerByPhone(llmRequest.phone)
    console.log(
      "🔍 CUSTOMER TROVATO:",
      customer
        ? {
            id: customer.id,
            workspaceId: customer.workspaceId,
            phone: customer.phone,
          }
        : "NESSUNO"
    )

    const workspaceId = customer ? customer.workspaceId : llmRequest.workspaceId
    console.log(
      "🏢 WORKSPACE ID SCELTO:",
      workspaceId,
      "- Source:",
      customer ? "customer.workspaceId" : "llmRequest.workspaceId"
    )
    console.log("📋 LLMREQUEST.WORKSPACEID:", llmRequest.workspaceId)

    const workspace = await workspaceService.getById(workspaceId)
    console.log(
      "🏢 WORKSPACE TROVATO:",
      workspace
        ? {
            id: workspace.id,
            name: workspace.name,
            agentConfigsCount: workspace.agentConfigs?.length,
          }
        : "NESSUNO"
    )

    // Get agent config for LLM settings
    const agentConfig = workspace.agentConfigs?.[0]

    // 🚨 CRITICAL DEBUG: Flusso completo + agentConfigs
    console.log(
      "🤖 AGENTCONFIGS COUNT per workspace",
      workspaceId + ":",
      workspace.agentConfigs?.length
    )
    workspace.agentConfigs?.forEach((config, index) => {
      console.log(
        `🤖 [${index}] ID:${config.id?.substring(0, 8)}... MODEL:${config.model} TEMP:${config.temperature} CREATED:${config.createdAt}`
      )
    })
    console.log(
      "🎯 SCELTO AGENTCONFIG[0]:",
      agentConfig
        ? `${agentConfig.model} temp:${agentConfig.temperature}`
        : "NESSUNO"
    )

    console.log("🚨 RAW WORKSPACE:", JSON.stringify(workspace, null, 2))
    console.log("🚨 AGENTCONFIGS ARRAY:", workspace.agentConfigs)
    console.log("🚨 FIRST AGENTCONFIG:", agentConfig)
    console.log("🚨 TEMPERATURE VALUE:", agentConfig?.temperature)
    console.log("🚨 TEMPERATURE TYPE:", typeof agentConfig?.temperature)

    console.log(
      `🔧 LLM: Workspace config - llmModel: ${agentConfig?.model || "default"}, temperature: ${agentConfig?.temperature || "default"} (type: ${typeof agentConfig?.temperature})`
    )

    // 🔴 1. FIRST CHECK: Workspace disabled? Return WIP message
    if (!workspace.isActive) {
      console.log("🚫 LLM: Workspace is DISABLED - Sending WIP message")

      // Get customer language or default to Spanish
      const customerLanguage = customer?.language || "es"
      console.log(
        `🌍 Customer language: ${customerLanguage} (default: es if NULL)`
      )

      // Get WIP message in customer's language
      const wipMessages =
        (workspace.wipMessages as Record<string, string>) || {}
      const wipMessage =
        wipMessages[customerLanguage.toLowerCase()] ||
        wipMessages["es"] ||
        "Estamos en mantenimiento. Por favor, contacte más tarde."

      console.log(
        `📤 Sending WIP message in ${customerLanguage}: "${wipMessage}"`
      )

      // ✅ CRITICAL FIX: Return WIP message as normal response so webhook sends it
      // The webhook will handle sending via WhatsApp Business API
      return {
        success: true,
        output: wipMessage,
        debugInfo: {
          stage: "workspace_disabled",
          reason: "Workspace is not active",
          wipMessageSent: true,
          language: customerLanguage,
          workspaceId: workspace.id,
        },
      }
    }

    // 2. New User Check
    if (!customer) {
      console.log("🆕 LLM: New user detected, calling NewUser method")
      return await this.NewUser(llmRequest, workspace, messageRepo)
    }

    console.log(
      `🔍 LLM: Existing customer found - id: ${customer.id}, phone: ${customer.phone}, activeChatbot: ${customer.activeChatbot}, isBlacklisted: ${customer.isBlacklisted}`
    )

    // 3. Blocca se blacklisted o se activeChatbot è false - non salvare nulla nello storico
    const isBlocked = await messageRepo.isCustomerBlacklisted(
      customer.phone,
      workspace.id
    )

    // Check if chatbot is active for this customer
    const isChatbotInactive = customer.activeChatbot === false

    if (isBlocked || customer.isBlacklisted || isChatbotInactive) {
      console.log(
        `🚫 LLM: Customer blocked - isBlocked: ${isBlocked}, isBlacklisted: ${customer.isBlacklisted}, isChatbotInactive: ${isChatbotInactive}`
      )
      // Restituisci stringa speciale IGNORE per fermare il processo
      return "IGNORE"
    }

    // 4. Get prompt
    const prompt = await workspaceService.getActivePromptByWorkspaceId(
      workspace.id
    )

    if (!prompt) {
      return {
        success: false,
        output: "❌ Servizio temporaneamente non disponibile.",
        debugInfo: { stage: "no_prompt" },
      }
    }

    // 5. Pre-processing:
    const userLanguage = customer.language || workspace.language || "it"
    const faqs = await messageRepo.getActiveFaqs(workspace.id)
    const services = await messageRepo.getActiveServices(workspace.id)
    const categories = await messageRepo.getActiveCategories(
      workspace.id,
      userLanguage
    )
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

    // Process the prompt using promptProcessorService with pre-fetched content
    const promptWithVars = await this.promptProcessorService.preProcessPrompt(
      prompt,
      workspace.id,
      userInfo,
      {
        faqs,
        products,
        categories,
        services,
        offers,
      }
    )

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

    // 6. Generate LLM Response with debug info
    const rawLLMResult = await this.generateLLMResponse(
      promptWithVars,
      llmRequest.chatInput,
      workspace,
      customer,
      customerData,
      userLanguage,
      llmRequest
    )

    // 7. Post-processing: Replace link tokens
    const linkResult = await this.replaceLinkTokens(
      rawLLMResult.response,
      customer,
      workspace
    )

    return {
      success: true,
      output: linkResult.finalResponse,
      debugInfo: {
        stage: "completed",
        model: rawLLMResult.debugInfo.model,
        temperature: rawLLMResult.debugInfo.temperature,
        functionCall: rawLLMResult.debugInfo.functionCall,
        functionParams: rawLLMResult.debugInfo.functionParams,
        effectiveParams: rawLLMResult.debugInfo.effectiveParams,
        tokenReplacements: linkResult.tokenReplacements,
        error: rawLLMResult.debugInfo.error || false,
      },
      functionCalls: rawLLMResult.debugInfo.functionCall
        ? [
            {
              functionName: rawLLMResult.debugInfo.functionCall,
              source: "LLM",
              toolCall: {
                function: {
                  name: rawLLMResult.debugInfo.functionCall,
                  arguments: JSON.stringify(
                    rawLLMResult.debugInfo.functionParams || {}
                  ),
                },
              },
            },
          ]
        : [],
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
  ): Promise<{ finalResponse: string; tokenReplacements: string[] }> {
    let finalResponse = response
    const tokenReplacements: string[] = []

    // Replace checkout link token
    if (finalResponse.includes("[LINK_CHECKOUT_WITH_TOKEN]")) {
      const checkoutLink = await this.callingFunctionsService.getCartLink({
        customerId: customer.id,
        workspaceId: workspace.id,
      })
      const linkUrl = checkoutLink?.linkUrl || ""

      console.log(`📎 LLMService: Using checkout link: ${linkUrl}`)

      finalResponse = finalResponse.replace(
        "[LINK_CHECKOUT_WITH_TOKEN]",
        linkUrl
      )
      tokenReplacements.push(
        "REPLACE LINK_CHECKOUT_WITH_TOKEN with getCartLink"
      )
    }

    // Replace profile link token
    if (finalResponse.includes("[LINK_PROFILE_WITH_TOKEN]")) {
      const profileLink = await this.callingFunctionsService.getProfileLink({
        customerId: customer.id,
        workspaceId: workspace.id,
      })
      let linkUrl = profileLink?.linkUrl || ""

      console.log(`📎 LLMService: Created short profile link: ${linkUrl}`)

      finalResponse = finalResponse.replace(
        "[LINK_PROFILE_WITH_TOKEN]",
        linkUrl
      )
      tokenReplacements.push(
        "REPLACE LINK_PROFILE_WITH_TOKEN with getProfileLink"
      )
    }

    // Replace orders link token
    if (finalResponse.includes("[LINK_ORDERS_WITH_TOKEN]")) {
      const ordersLink = await this.callingFunctionsService.getOrdersListLink({
        customerId: customer.id,
        workspaceId: workspace.id,
      })
      const linkUrl = ordersLink?.linkUrl || ""

      console.log(`📎 LLMService: Using orders link: ${linkUrl}`)

      finalResponse = finalResponse.replace("[LINK_ORDERS_WITH_TOKEN]", linkUrl)
      tokenReplacements.push(
        "REPLACE LINK_ORDERS_WITH_TOKEN with getOrdersListLink"
      )
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
      tokenReplacements.push("REPLACE LINK_CATALOG with replaceLinkWithToken")
    }

    return { finalResponse, tokenReplacements }
  }

  private getAvailableFunctions() {
    return [
      {
        type: "function",
        function: {
          name: "ContactOperator",
          description:
            "Connette l'utente con un operatore umano quando: 1) L'utente richiede esplicitamente un operatore ('voglio parlare con operatore', 'contatta operatore'), 2) L'utente risponde 'si', 'yes', 'sì' dopo che è stato chiesto se vuole contattare un operatore. Controlla la cronologia conversazione per vedere se il messaggio precedente offriva contatto operatore.",
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
            "⚠️ USA QUESTA FUNZIONE quando l'utente chiede 'DOV'È' o 'DOVE' (= dove si trova FISICAMENTE il pacco). Esempi: 'dov'è il mio ordine?', 'dov'è il mio ultimo ordine?', 'dove l'ordine XXX?', 'quando arriva?', 'tracking'. Fornisce link per tracciare la SPEDIZIONE FISICA del pacco con corriere.",
          parameters: {
            type: "object",
            properties: {
              orderCode: {
                type: "string",
                description:
                  "Il codice dell'ordine da tracciare (es. 'ORD-2025-001'). LASCIA VUOTO se l'utente dice 'ultimo ordine' o 'mio ordine' senza specificare codice. OPZIONALE.",
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
            "⚠️ USA QUESTA FUNZIONE (NON il token LINK_ORDERS_WITH_TOKEN) quando l'utente chiede di vedere UN SINGOLO ORDINE SPECIFICO o l'ULTIMO ORDINE. Esempi: 'dov'è il mio ultimo ordine?', 'mostrami ultimo ordine', 'voglio vedere l'ordine ORD-123', 'dammi la fattura dell'ultimo ordine'. Fornisce il link per visualizzare i dettagli completi di un ordine.",
          parameters: {
            type: "object",
            properties: {
              orderCode: {
                type: "string",
                description:
                  "Il codice dell'ordine da visualizzare (es. 'ORD-2025-001'). Se l'utente dice 'ultimo ordine' o 'mio ultimo ordine' LASCIA VUOTO questo campo e il sistema userà automaticamente lastordercode. OPZIONALE.",
              },
            },
            required: [],
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
    llmRequest?: LLMRequest
  ): Promise<{ response: string; debugInfo: any }> {
    // Get agent config for LLM settings
    const agentConfig = workspace.agentConfigs?.[0]

    // Capture model and temperature for debug info outside try block
    const modelUsed = agentConfig?.model || "anthropic/claude-3.5-sonnet"
    const temperatureUsed =
      agentConfig?.temperature !== undefined &&
      agentConfig?.temperature !== null
        ? agentConfig.temperature
        : 0.3 // Changed from 0.1 to 0.3 to match seed default

    console.log(
      `🔧 LLM: Using model: ${modelUsed}, temperature: ${temperatureUsed} (agentConfig.temperature was: ${agentConfig?.temperature}, type: ${typeof agentConfig?.temperature})`
    )

    try {
      // Costruisci l'array di messaggi con lo storico se disponibile
      let messages = [
        {
          role: "system",
          content: processedPrompt,
        },
      ]

      // Aggiungi lo storico degli ultimi 5 messaggi se disponibile in llmRequest
      if (llmRequest?.messages && llmRequest.messages.length > 0) {
        // Prendi solo gli ultimi 5 messaggi per mantenere un contesto più ricco
        const recentHistory = llmRequest.messages.slice(-8)
        console.log(
          `📜 LLM: Adding ${recentHistory.length} messages from history to context`
        )
        console.log(
          `📜 LLM: History messages:`,
          recentHistory.map(
            (msg) => `[${msg.role}]: ${msg.content.substring(0, 50)}...`
          )
        )

        // Aggiungi i messaggi storici
        messages.push(...recentHistory)
      } else {
        console.log(
          `📜 LLM: No message history available - starting fresh conversation`
        )
      }

      // Aggiungi il messaggio utente corrente
      messages.push({
        role: "user",
        content: userQuery,
      })

      console.log(
        `📝 LLM: Sending ${messages.length} messages to OpenRouter (${Math.max(0, messages.length - 2)} from history + system + current)`
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
            model: modelUsed,
            messages: messages,
            tools: this.getAvailableFunctions(),
            temperature: temperatureUsed,
            max_tokens: agentConfig?.maxTokens || 5000,
          }),
        }
      )
      console.log("***language", language)
      console.log("🌐 OpenRouter status:", response.status)
      const data = await response.json()
      console.log("🌐 OpenRouter response:", JSON.stringify(data, null, 2))

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

      // Gestione tool calls (chiamate funzioni)
      if (data.choices?.[0]?.message?.tool_calls) {
        const toolCall = data.choices[0].message.tool_calls[0]
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments || "{}")

        const functionResult = await this.executeFunctionCall(
          functionName,
          functionArgs,
          customer,
          workspace,
          customerData
        )

        if (functionResult.success === false) {
          if (functionName === "GetLinkOrderByCode") {
            return {
              response: i18n.errors.orderNotFound[language],
              debugInfo: {
                model: modelUsed,
                temperature: temperatureUsed,
                functionCall: functionName,
                functionParams: functionArgs,
                effectiveParams: functionResult.effectiveParams,
              },
            }
          }
          if (functionName === "GetShipmentTrackingLink") {
            return {
              response: i18n.errors.trackingNotFound[language],
              debugInfo: {
                model: modelUsed,
                temperature: temperatureUsed,
                functionCall: functionName,
                functionParams: functionArgs,
                effectiveParams: functionResult.effectiveParams,
              },
            }
          }
          return {
            response:
              functionResult.message ||
              functionResult.error ||
              i18n.errors.generic[language],
            debugInfo: {
              model: modelUsed,
              temperature: temperatureUsed,
              functionCall: functionName,
              functionParams: functionArgs,
              effectiveParams: functionResult.effectiveParams,
            },
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
            debugInfo: {
              model: modelUsed,
              temperature: temperatureUsed,
              functionCall: functionName,
              functionParams: functionArgs,
              effectiveParams: functionResult.effectiveParams,
            },
          }
        }

        if (functionName === "GetShipmentTrackingLink") {
          return {
            response: `${i18n.success.trackingLink[language]} ${functionResult.linkUrl}`,
            debugInfo: {
              model: modelUsed,
              temperature: temperatureUsed,
              functionCall: functionName,
              functionParams: functionArgs,
              effectiveParams: functionResult.effectiveParams,
            },
          }
        }

        return {
          response:
            functionResult.message ||
            functionResult.output ||
            functionResult.linkUrl ||
            `${i18n.success.default[language]} ${functionResult.linkUrl}`,
          debugInfo: {
            model: modelUsed,
            temperature: temperatureUsed,
            functionCall: functionName,
            functionParams: functionArgs,
            effectiveParams: functionResult.effectiveParams,
          },
        }
      }

      const llmResponse =
        data.choices?.[0]?.message?.content || i18n.fallback[language]

      console.log("🎯 LLM Final Response:", llmResponse)
      return {
        response: llmResponse,
        debugInfo: {
          model: modelUsed,
          temperature: temperatureUsed,
          functionCall: null,
          functionParams: null,
        },
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
        debugInfo: {
          model: modelUsed,
          temperature: temperatureUsed,
          error: true,
          functionCall: null,
          functionParams: null,
        },
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
          const trackingOrderCode =
            args.orderCode ||
            customerData?.lastordercode ||
            customer.lastOrderCode
          console.log(
            "🔧 GetShipmentTrackingLink - Original args:",
            args,
            "Effective orderCode:",
            trackingOrderCode
          )
          const trackingResult =
            await this.callingFunctionsService.getShipmentTrackingLink({
              customerId: customer.id,
              workspaceId: workspace.id,
              orderCode: trackingOrderCode,
            })
          // Add effectiveParams for debug
          return {
            ...trackingResult,
            effectiveParams: { orderCode: trackingOrderCode },
          }

        case "GetLinkOrderByCode":
          const orderCodeForLink =
            args.orderCode ||
            customerData?.lastordercode ||
            customer.lastOrderCode
          console.log(
            "🔧 GetLinkOrderByCode - Original args:",
            args,
            "Effective orderCode:",
            orderCodeForLink
          )
          const orderResult =
            await this.callingFunctionsService.getOrdersListLink({
              customerId: customer.id,
              workspaceId: workspace.id,
              orderCode: orderCodeForLink,
            })
          // Add effectiveParams for debug
          return {
            ...orderResult,
            effectiveParams: { orderCode: orderCodeForLink },
          }

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

    // Use LinkGeneratorService for consistent short URL creation
    try {
      const {
        linkGeneratorService,
      } = require("../application/services/link-generator.service")
      const registrationLink = `${workspaceUrl.replace(/\/$/, "")}/register?token=${token}`
      const shortLink = await linkGeneratorService.generateShortLink(
        registrationLink,
        workspaceId,
        "registration"
      )

      console.log(
        `📎 Created short registration link: ${shortLink} → ${registrationLink}`
      )
      return shortLink
    } catch (shortError) {
      console.warn(
        "⚠️ Failed to create short URL for registration, using long URL:",
        shortError
      )
      const registrationLink = `${workspaceUrl.replace(/\/$/, "")}/register?token=${token}`
      return registrationLink
    }
  }

  // Funzione che gestisce il flusso per un nuovo utente e ritorna direttamente l'oggetto di risposta
  private async NewUser(
    llmRequest: LLMRequest,
    workspace: any,
    messageRepo: any
  ): Promise<any> {
    // Get workspace welcome messages
    const welcomeMessages = workspace.welcomeMessages || {
      en: "Welcome! You need to register first to use our services.",
      es: "¡Bienvenido! Debes registrarte primero para usar nuestros servicios.",
      it: "👋 Benvenuto! Devi prima registrarti per utilizzare i nostri servizi.",
      pt: "Bem-vindo! Você precisa se registrar primeiro para usar nossos serviços.",
    }

    // Get user language or workspace default language or fallback to it
    const language = workspace.language?.toLowerCase() || "it"

    // Get message in correct language or fallback
    let welcomeMessage =
      welcomeMessages[language] ||
      welcomeMessages["it"] ||
      welcomeMessages["en"] ||
      "👋 Welcome! You need to register first to use our services."

    const output = await this.newUserLink(
      llmRequest.phone,
      workspace.id,
      welcomeMessage
    )
    return {
      success: false,
      output,
      debugInfo: { stage: "new_user" },
    }
  }
}
