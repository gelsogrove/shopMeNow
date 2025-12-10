import { prisma } from "@echatbot/database"
import fs from "fs"
import path from "path"
import { TemplateEngineService } from "../application/services/prompt-builder/template-engine.service"
import { MessageRepository } from "../repositories/message.repository"
import logger from "../utils/logger"
import { PromptValidationError } from "../utils/PromptValidationError"

// prisma imported

export class PromptProcessorService {
  private messageRepository: MessageRepository
  private templateEngine: TemplateEngineService

  constructor() {
    this.messageRepository = new MessageRepository()
    this.templateEngine = new TemplateEngineService()
  }

  /**
   * Validate prompt variables to prevent duplicate large variables
   * Constitution v1.5.0 Principle III Compliance
   *
   * MUST throw error if {{products}}, {{offers}}, {{services}}, or {{categories}}
   * appear more than once in the same prompt (prevents 100k+ token prompts)
   *
   * STRATEGY: Only count variables that appear ALONE on a line (actual placeholders),
   * ignore those in instructional text, examples, or inline documentation.
   *
   * @param prompt Prompt content to validate
   * @throws PromptValidationError if duplicate large variables detected
   */
  private validatePromptVariables(prompt: string): void {
    const largeVariables = ["products", "offers", "services", "categories"]

    for (const variable of largeVariables) {
      // Match ONLY when variable appears alone or at start/end of line
      // This excludes instructional text like "scroll to {{products}}"
      const standaloneRegex = new RegExp(
        `^\\s*\\{\\{${variable}\\}\\}\\s*$`,
        "gm"
      )
      const matches = prompt.match(standaloneRegex)

      if (matches && matches.length > 1) {
        const errorMessage = `Variable {{${variable}}} can only appear once per prompt. Found ${matches.length} occurrences.`
        logger.error(`[PromptValidation] ${errorMessage}`)
        throw new PromptValidationError(errorMessage)
      }
    }
  }

  /**
   * Pre-processa il prompt sostituendo i placeholder dinamici.
   * @param promptContent Il contenuto del prompt da processare.
   * @param workspaceId L'ID del workspace.
   * @param customerData I dati del cliente per la sostituzione delle variabili.
   * @returns Il prompt processato.
   */
  /**
   * Pre-processa il prompt sostituendo i placeholder dinamici.
   * @param promptContent Il contenuto del prompt da processare
   * @param workspaceId L'ID del workspace
   * @param customerData I dati del cliente
   * @param dynamicContent Contenuti dinamici pre-recuperati (FAQ, prodotti, etc)
   * @returns Il prompt processato
   */
  public async preProcessPrompt(
    promptContent: string,
    workspaceId: string,
    customerData: any,
    dynamicContent: {
      faqs: string
      products: string
      categories: string
      services: string
      offers: string
    },
    workspaceUrl?: string,
    workspaceConfig?: {
      sellsProductsAndServices?: boolean // 🆕 E-commerce toggle for {{#if}} conditionals
      toneOfVoice?: string
      botIdentityResponse?: string
      hasHumanSupport?: boolean
      humanSupportInstructions?: string
      operatorContactMethod?: string
      operatorWhatsappNumber?: string
      hasSalesAgents?: boolean
      hasSuppliers?: boolean // 🆕 Suppliers menu visibility
      adminEmail?: string
      allowedExternalLinks?: string[] // 🆕 Feature 199: Allowed domains for external links
      address?: string // 🆕 Physical address for "where are you?" questions
      customAiRules?: string // 🆕 Custom AI rules that override defaults
    }
  ): Promise<string> {
    // 🔒 STEP 1: Validate prompt BEFORE replacement (Constitution v1.5.0 Principle III)
    // Fail-fast pattern: prevents 100k+ token prompts from duplicate variables
    this.validatePromptVariables(promptContent)

    let processedPrompt = promptContent

    // 🆕 STEP 1.5: Process {{#if}} conditionals FIRST (Handlebars syntax)
    // This handles workspace config conditionals like {{#if sellsProductsAndServices}}
    if (processedPrompt.includes("{{#if") || processedPrompt.includes("{{#unless")) {
      // NOTE: Only pass variables needed for CONDITIONALS, not for text replacement
      // Text replacement happens in STEP 2 via replaceVariables()
      const conditionalVariables = {
        // Workspace config booleans (for {{#if}} conditions)
        sellsProductsAndServices: workspaceConfig?.sellsProductsAndServices ?? true,
        hasHumanSupport: workspaceConfig?.hasHumanSupport ?? true,
        hasSalesAgents: workspaceConfig?.hasSalesAgents ?? false,
        hasSuppliers: workspaceConfig?.hasSuppliers ?? false, // 🆕 Suppliers menu visibility
        // String variables - ONLY truthiness matters for {{#if}}, actual value substituted later
        address: workspaceConfig?.address || "",
        customAiRules: workspaceConfig?.customAiRules || "",
        botIdentityResponse: workspaceConfig?.botIdentityResponse || "",
        humanSupportInstructions: workspaceConfig?.humanSupportInstructions || "",
        allowedExternalLinks: workspaceConfig?.allowedExternalLinks?.join("\n") || "",
        // Customer booleans (for conditionals)
        hasAgentAssigned: !!(customerData?.agentName),
      }

      processedPrompt = this.templateEngine.process(processedPrompt, conditionalVariables)
      logger.debug("✅ Processed {{#if}} conditionals in prompt")
    }

    // 🔧 STEP 1.6: Replace workspace config string variables
    // These are replaced AFTER conditionals are processed
    if (workspaceConfig?.address) {
      processedPrompt = processedPrompt.replace(/\{\{address\}\}/g, workspaceConfig.address)
    }
    if (workspaceConfig?.customAiRules) {
      processedPrompt = processedPrompt.replace(/\{\{customAiRules\}\}/g, workspaceConfig.customAiRules)
    }
    if (workspaceConfig?.botIdentityResponse) {
      processedPrompt = processedPrompt.replace(/\{\{botIdentityResponse\}\}/g, workspaceConfig.botIdentityResponse)
    }
    if (workspaceConfig?.humanSupportInstructions) {
      processedPrompt = processedPrompt.replace(/\{\{humanSupportInstructions\}\}/g, workspaceConfig.humanSupportInstructions)
    }
    if (workspaceConfig?.allowedExternalLinks?.length) {
      processedPrompt = processedPrompt.replace(/\{\{allowedExternalLinks\}\}/g, workspaceConfig.allowedExternalLinks.join("\n"))
    }

    // Sostituzione URL workspace (PRIMA di altre sostituzioni)
    if (workspaceUrl && processedPrompt.includes("{{url}}")) {
      processedPrompt = processedPrompt.replace(/\{\{url\}\}/g, workspaceUrl)
    }

    // Sostituzione delle informazioni utente
    processedPrompt = this.replaceVariables(processedPrompt, customerData)

    // Sostituzione {{SUBSCRIBE_MESSAGE}} basato su push_notifications_consent
    if (processedPrompt.includes("{{SUBSCRIBE_MESSAGE}}")) {
      const subscribeMessage = this.getSubscribeMessage(customerData)
      processedPrompt = processedPrompt.replace(
        /\{\{SUBSCRIBE_MESSAGE\}\}/g,
        subscribeMessage
      )
    }

    // Sostituzione contenuti dinamici
    if (processedPrompt.includes("{{faq}}")) {
      // 🚨 CRITICAL: If no FAQ, tell LLM explicitly
      const faqContent = dynamicContent.faqs?.trim()
        ? dynamicContent.faqs
        : "⚠️ Non abbiamo FAQ in questo workspace."

      processedPrompt = processedPrompt.replace("{{faq}}", faqContent)
    }

    if (processedPrompt.includes("{{products}}")) {
      // Feature 123: Log token count for {{products}} variable
      const productsTokenCount = this.estimateTokenCount(
        dynamicContent.products || ""
      )
      logger.info(
        `[ProductSearch] {{products}} token count: ${productsTokenCount}`
      )

      if (productsTokenCount > 50000) {
        logger.warn(
          `[ProductSearch] ⚠️ {{products}} exceeds 50k tokens (${productsTokenCount}). Consider filtering.`
        )
      }

      // 🚨 CRITICAL: If no products, tell LLM explicitly - DON'T let it invent from examples!
      const productsContent = dynamicContent.products?.trim()
        ? dynamicContent.products
        : "⚠️ CATALOGO VUOTO - Non ci sono prodotti in questo workspace. Rispondi: 'Mi dispiace, al momento non abbiamo prodotti nel catalogo.'"

      processedPrompt = processedPrompt.replace(
        "{{products}}",
        productsContent
      )
    }

    if (processedPrompt.includes("{{categories}}")) {
      // 🚨 CRITICAL: If no categories, tell LLM explicitly
      const categoriesContent = dynamicContent.categories?.trim()
        ? dynamicContent.categories
        : "⚠️ Non abbiamo categorie in questo workspace."

      processedPrompt = processedPrompt.replace(
        "{{categories}}",
        categoriesContent
      )
    }

    if (processedPrompt.includes("{{services}}")) {
      // 🚨 CRITICAL: If no services, tell LLM explicitly
      const servicesContent = dynamicContent.services?.trim()
        ? dynamicContent.services
        : "⚠️ Non abbiamo servizi in questo workspace."

      processedPrompt = processedPrompt.replace(
        "{{services}}",
        servicesContent
      )
    }

    if (processedPrompt.includes("{{offers}}")) {
      // 🚨 CRITICAL: If no offers, tell LLM explicitly
      const offersContent = dynamicContent.offers?.trim()
        ? dynamicContent.offers
        : "⚠️ Non abbiamo offerte attive in questo momento."

      processedPrompt = processedPrompt.replace(
        "{{offers}}",
        offersContent
      )
    }

    // Sostituzione {{lastOrder}} - FR-13 Repeat Order
    if (processedPrompt.includes("{{lastOrder}}")) {
      const lastOrderSummary = await this.getLastOrderVariable(
        customerData.id,
        workspaceId
      )
      processedPrompt = processedPrompt.replace(
        /\{\{lastOrder\}\}/g,
        lastOrderSummary
      )
    }

    // 🆕 Feature 199: Channel Configuration Variables
    // {{BOT_PERSONALITY}} - Tone of voice (friendly, professional, formal, casual)
    if (processedPrompt.includes("{{BOT_PERSONALITY}}")) {
      const toneOfVoice = workspaceConfig?.toneOfVoice || "friendly"
      const personalityMap: Record<string, string> = {
        friendly: "Sei amichevole, caloroso e usi emoji per rendere la conversazione piacevole 😊. Parli in modo informale ma rispettoso.",
        professional: "Sei professionale e cortese. Rispondi in modo chiaro e diretto, mantenendo un tono business appropriato.",
        formal: "Sei formale ed educato. Usi il 'Lei' e mantieni un tono tradizionale e rispettoso.",
        casual: "Sei rilassato e informale ✌️. Parli come un amico, in modo naturale e divertente.",
      }
      processedPrompt = processedPrompt.replace(
        /\{\{BOT_PERSONALITY\}\}/g,
        personalityMap[toneOfVoice] || personalityMap.friendly
      )
    }

    // {{BOT_IDENTITY}} - How the bot introduces itself
    if (processedPrompt.includes("{{BOT_IDENTITY}}")) {
      const botIdentity = workspaceConfig?.botIdentityResponse || 
        "Sono l'assistente virtuale di questo negozio. Posso aiutarti a trovare prodotti, rispondere alle domande e gestire i tuoi ordini."
      processedPrompt = processedPrompt.replace(
        /\{\{BOT_IDENTITY\}\}/g,
        botIdentity
      )
    }

    // {{HUMAN_SUPPORT_INFO}} - How to contact human support
    if (processedPrompt.includes("{{HUMAN_SUPPORT_INFO}}")) {
      let humanSupportInfo: string
      
      if (workspaceConfig?.hasHumanSupport) {
        // Human support is enabled
        if (workspaceConfig.hasSalesAgents) {
          // Has sales agents - customer gets their assigned agent
          humanSupportInfo = `Il tuo agente di riferimento è:
• {{agentName}}
• 📞 {{agentPhone}}
• ✉️ {{agentEmail}}

⏸️ Da questo momento la chat è in pausa.
Il nostro agente ti contatterà il prima possibile direttamente in questa chat per risolvere la situazione.`
        } else {
          // No sales agents - use Admin Email
          const email = workspaceConfig.adminEmail || "support@echatbot.ai"
          humanSupportInfo = `⏸️ Da questo momento la chat è in pausa.

Il nostro team ti contatterà via email (${email}) il prima possibile per risolvere la situazione.`
        }
        
        // Add custom instructions if provided
        if (workspaceConfig.humanSupportInstructions?.trim()) {
          humanSupportInfo += `\n\n${workspaceConfig.humanSupportInstructions}`
        }
      } else {
        // Human support disabled - generic response
        humanSupportInfo = "Al momento non è disponibile supporto umano. Prova a riformulare la tua richiesta o consulta le nostre FAQ."
      }
      
      processedPrompt = processedPrompt.replace(
        /\{\{HUMAN_SUPPORT_INFO\}\}/g,
        humanSupportInfo
      )
    }

    // {{SALES_AGENT_CONTACT}} - Sales agent contact block (only if hasSalesAgents=true)
    if (processedPrompt.includes("{{SALES_AGENT_CONTACT}}")) {
      const salesAgentContact = workspaceConfig?.hasSalesAgents
        ? `L'agente {{agentName}} ti contatterà per assisterti.\n📧 Email: {{agentEmail}}\n📞 Telefono: {{agentPhone}}`
        : "" // Empty if no sales agents
      processedPrompt = processedPrompt.replace(
        /\{\{SALES_AGENT_CONTACT\}\}/g,
        salesAgentContact
      )
    }

    // {{ALLOWED_EXTERNAL_LINKS}} - List of allowed domains for external links
    if (processedPrompt.includes("{{ALLOWED_EXTERNAL_LINKS}}")) {
      const allowedLinks = workspaceConfig?.allowedExternalLinks || []
      let linksContent: string
      
      if (allowedLinks.length > 0) {
        linksContent = `**Domini autorizzati per link esterni:**\n${allowedLinks.map(link => `- ${link}`).join('\n')}\n\n⚠️ **REGOLA CRITICA**: NON includere MAI link a domini diversi da quelli elencati sopra. Se devi suggerire un link esterno, verifica che il dominio sia nella lista autorizzata.`
      } else {
        linksContent = `⚠️ **REGOLA CRITICA**: NON includere MAI link esterni nelle risposte. Puoi usare solo link interni al sistema (ordini, profilo, carrello).`
      }
      
      processedPrompt = processedPrompt.replace(
        /\{\{ALLOWED_EXTERNAL_LINKS\}\}/g,
        linksContent
      )
    }

    // {{ADDRESS}} - Physical location/address of the business
    if (processedPrompt.includes("{{ADDRESS}}")) {
      const address = workspaceConfig?.address?.trim() || ""
      if (address) {
        processedPrompt = processedPrompt.replace(
          /\{\{ADDRESS\}\}/g,
          address
        )
      } else {
        // If no address configured, replace with instruction to not answer location questions
        processedPrompt = processedPrompt.replace(
          /\{\{ADDRESS\}\}/g,
          "⚠️ Indirizzo non configurato - Se il cliente chiede dove siete, rispondi che l'indirizzo non è disponibile."
        )
      }
    }

    // {{CUSTOM_AI_RULES}} - Custom rules that OVERRIDE default behavior
    if (processedPrompt.includes("{{CUSTOM_AI_RULES}}")) {
      const customRules = workspaceConfig?.customAiRules?.trim() || ""
      if (customRules) {
        processedPrompt = processedPrompt.replace(
          /\{\{CUSTOM_AI_RULES\}\}/g,
          `⚠️ REGOLE PRIORITARIE (hanno la precedenza su tutto):\n${customRules}`
        )
      } else {
        // Remove placeholder if no custom rules
        processedPrompt = processedPrompt.replace(
          /\{\{CUSTOM_AI_RULES\}\}/g,
          ""
        )
      }
    }

    // Remove duplicate CATEGORIES check since it's already handled above

    // DEBUG: Salva il prompt finale per debugging
    await this.saveDebugPrompt(processedPrompt, workspaceId)

    return processedPrompt
  }

  /**
   * Post-processa la risposta dell'LLM.
   * @param response La risposta dell'LLM.
   * @param customerId I dati del cliente per la sostituzione delle variabili.
   * @param workspaceId L'ID del workspace.
   * @returns La risposta processata.
   */
  public async postProcessResponse(
    response: string,
    customerId: string,
    workspaceId: string
  ): Promise<string> {
    let processedResponse = response

    // Sostituzione link con token
    if (customerId && workspaceId) {
      const { ReplaceLinkWithToken } = await import(
        "../application/services/link-replacement.service"
      )
      const linkResult = await ReplaceLinkWithToken(
        { response: processedResponse },
        customerId,
        workspaceId
      )
      if (linkResult.success && linkResult.response) {
        processedResponse = linkResult.response
      }
    }

    return processedResponse
  }

  /**
   * 🆕 PUBLIC METHOD: Replace customer-specific variables in ANY text (prompts or LLM responses)
   *
   * CRITICAL FIX (Feature 124): Variables from calling functions (RepeatOrder.ts, ResetCart.ts)
   * were not being replaced in LLM responses, showing {{discountUser}} to customers.
   *
   * This is now the SINGLE SOURCE OF TRUTH for all variable replacements.
   * Use this method for BOTH prompts AND responses to avoid duplication.
   *
   * Handles:
   * - Customer data: {{nameUser}}, {{email}}, {{phone}}, {{discountUser}}
   * - Sales agent data: {{agentName}}, {{agentPhone}}, {{agentEmail}}
   * - Company data: {{companyName}}, {{channelName}}, {{languageUser}}
   * - Order data: {{lastordercode}}
   * - System data: {{TOKEN_DURATION}}
   *
   * @param text - Text with potential {{variables}} (from LLM response or prompt)
   * @param customerData - Customer data from database
   * @returns Text with all variables replaced
   *
   * @see Constitution Principle I - Database-First Architecture (no hardcoded values)
   * @see specs/124-customer-variables-replacement/spec.md FR-1, FR-2
   * @see MULTI_AGENT_FLOW.md Step 4.6 - Variable Replacement
   *
   * @example
   * const input = "Hello {{nameUser}}, you have {{discountUser}}% discount! Contact {{agentName}}"
   * const output = replaceCustomerVariables(input, { nome: "Mario", discountUser: 15, agentName: "Giovanni", ... })
   * // → "Hello Mario, you have 15% discount! Contact Giovanni"
   */
  public replaceCustomerVariables(
    text: string,
    customerData: {
      nome: string
      email: string
      phone: string
      discountUser: number
      agentName?: string
      agentPhone?: string
      agentEmail?: string
      companyName?: string
      languageUser?: string
      lastordercode?: string
      pushNotificationsConsent?: boolean
      pushNotificationsConsentAt?: Date | null
      channelName?: string
    }
  ): string {
    if (!text) return text

    return text
      .replace(/\{\{nameUser\}\}/g, customerData.nome || "Cliente")
      .replace(/\{\{email\}\}/g, customerData.email || "")
      .replace(/\{\{phone\}\}/g, customerData.phone || "")
      .replace(/\{\{discountUser\}\}/g, String(customerData.discountUser || 0))
      .replace(/\{\{agentName\}\}/g, customerData.agentName || "Non assegnato")
      .replace(/\{\{agentPhone\}\}/g, customerData.agentPhone || "N/A")
      .replace(/\{\{agentEmail\}\}/g, customerData.agentEmail || "N/A")
      .replace(
        /\{\{companyName\}\}/g,
        customerData.companyName || "L'Altra Italia"
      )
      .replace(/\{\{languageUser\}\}/g, customerData.languageUser || "ITALIANO")
      .replace(/\{\{lastordercode\}\}/g, customerData.lastordercode || "N/A")
      .replace(
        /\{\{TOKEN_DURATION\}\}/g,
        this.formatTokenDuration(process.env.TOKEN_EXPIRATION || "1h")
      )
      .replace(
        /\{\{pushNotificationsConsent\}\}/g,
        customerData.pushNotificationsConsent === true ? "true" : "false"
      )
      .replace(
        /\{\{pushNotificationsConsentAt\}\}/g,
        customerData.pushNotificationsConsentAt
          ? new Date(customerData.pushNotificationsConsentAt).toISOString()
          : "Mai modificato"
      )
      .replace(
        /\{\{channelName\}\}/g,
        customerData.channelName || "Shop"
      )
  }

  /**
   * @deprecated Use replaceCustomerVariables() instead - this is kept for backward compatibility
   *
   * Sostituisce le variabili nel testo.
   * Questo metodo ora chiama replaceCustomerVariables() per evitare duplicazione.
   *
   * @param text Il testo da processare.
   * @param customerData I dati del cliente.
   * @returns Il testo con le variabili sostituite.
   */
  private replaceVariables(text: string, customerData: any): string {
    if (!text || !customerData) return text

    // 🔄 REFACTORED: Now calls replaceCustomerVariables() for centralized replacement
    // This ensures consistency and avoids code duplication
    return this.replaceCustomerVariables(text, {
      nome: customerData.nameUser || "",
      email: customerData.email || "",
      phone: customerData.phone || "",
      discountUser: customerData.discountUser || 0,
      agentName: customerData.agentName,
      agentPhone: customerData.agentPhone,
      agentEmail: customerData.agentEmail,
      companyName: customerData.companyName,
      languageUser: customerData.languageUser,
      lastordercode: customerData.lastordercode,
      pushNotificationsConsent: customerData.push_notifications_consent,
      pushNotificationsConsentAt: customerData.push_notifications_consent_at,
      channelName: customerData.channelName,
    })
  } /**
   * Format token duration from environment variable
   * Examples: "15m" → "15 minutes", "1h" → "1 hour", "2h" → "2 hours"
   *
   * @param duration - Duration string from env (e.g., "15m", "1h")
   * @returns Human-readable duration string
   */
  private formatTokenDuration(duration: string): string {
    const match = duration.match(/^(\d+)([mh])$/)
    if (!match) return "15 minutes" // Fallback for invalid format

    const value = parseInt(match[1])
    const unit = match[2]

    if (unit === "m") return value === 1 ? "1 minute" : `${value} minutes`
    if (unit === "h") return value === 1 ? "1 hour" : `${value} hours`

    return "15 minutes"
  }

  /**
   * Genera il messaggio di invito alla sottoscrizione push notifications.
   * Se l'utente è già iscritto (push_notifications_consent = true), ritorna stringa vuota.
   * Se non è iscritto, ritorna il messaggio di invito.
   * @param customerData I dati del cliente.
   * @returns Il messaggio di subscribe o stringa vuota.
   */
  private getSubscribeMessage(customerData: any): string {
    // Se l'utente è già iscritto, non mostrare nulla
    if (customerData?.push_notifications_consent === true) {
      return ""
    }

    // Se non è iscritto, mostra invito semplice (in inglese - translation layer traduce)
    return "💡 Want to receive exclusive offers and updates via WhatsApp? Let me know!"
  }

  /**
   * FR-13: Ottiene il sommario dell'ultimo ordine DELIVERED del cliente.
   * Formatta i dettagli dell'ordine in italiano per il prompt dell'agent.
   * @param customerId ID del cliente
   * @param workspaceId ID del workspace
   * @returns Sommario formattato dell'ultimo ordine o messaggio di nessun ordine disponibile
   */
  private async getLastOrderVariable(
    customerId: string,
    workspaceId: string
  ): Promise<string> {
    try {
      // Query ultimo ordine DELIVERED del cliente
      const lastOrder = await prisma.orders.findFirst({
        where: {
          customerId: customerId,
          workspaceId: workspaceId,
          status: "DELIVERED",
        },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      // Nessun ordine trovato
      if (!lastOrder) {
        return "Nessun ordine precedente disponibile."
      }

      // Formatta data in italiano (es: "15 ottobre 2025")
      const orderDate = new Date(lastOrder.createdAt)
      const formattedDate = orderDate.toLocaleDateString("it-IT", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })

      // Formatta lista prodotti
      const itemsText = lastOrder.items
        .map((item) => {
          const name = item.product?.name || item.service?.name || "Prodotto"
          const code = item.product?.sku || item.service?.code || "N/A"
          const qty = item.quantity
          const price = parseFloat(item.unitPrice.toString())
          const total = qty * price

          return `- ${code} ${name} x${qty} (${price.toFixed(2)}€ cad.) = ${total.toFixed(2)}€`
        })
        .join("\n")

      // Totale ordine
      const totalAmount = parseFloat(lastOrder.totalAmount.toString())

      // Formato finale per il prompt (in italiano)
      const summary = `Ultimo ordine: ${lastOrder.orderCode} del ${formattedDate}
Prodotti ordinati:
${itemsText}
Totale ordine: ${totalAmount.toFixed(2)}€
Stato: ${lastOrder.status}`

      logger.info(
        `[PromptProcessor] Last order variable generated for customer ${customerId}: ${lastOrder.orderCode}`
      )

      return summary
    } catch (error) {
      logger.error(
        `[PromptProcessor] Error getting last order for customer ${customerId}:`,
        error
      )
      return "Nessun ordine precedente disponibile."
    }
  }

  /**
   * Stima il numero di token in una stringa.
   * Usa una euristica semplice: ~1 token ogni 4 caratteri (media per italiano/inglese)
   * @param text Il testo da analizzare
   * @returns Numero stimato di token
   */
  private estimateTokenCount(text: string): number {
    // Null/undefined safety
    if (!text) return 0

    // Euristica: 1 token ≈ 4 caratteri (più accurato per GPT-4)
    // Include overhead per whitespace e punteggiatura
    return Math.ceil(text.length / 4)
  }

  /**
   * Salva il prompt finale per debugging.
   * @param prompt Il prompt processato.
   * @param workspaceId L'ID del workspace.
   */
  private async saveDebugPrompt(
    prompt: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const logsDir = path.join(process.cwd(), "logs")
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true })
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const filename = `prompt-debug-${workspaceId}-${timestamp}.txt`
      const filepath = path.join(logsDir, filename)

      const debugContent = `
================== PROMPT DEBUG ==================
Timestamp: ${new Date().toISOString()}
Workspace ID: ${workspaceId}
================== FINAL PROMPT ==================

${prompt}

================== END PROMPT ==================
`

      fs.writeFileSync(filepath, debugContent, "utf8")
      logger.info(`[DEBUG] Prompt salvato in: ${filepath}`)
    } catch (error) {
      logger.error("[DEBUG] Errore nel salvare il prompt:", error)
    }
  }
}
