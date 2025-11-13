import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"
import { MessageRepository } from "../repositories/message.repository"
import logger from "../utils/logger"
import { PromptValidationError } from "../utils/PromptValidationError"

const prisma = new PrismaClient()

export class PromptProcessorService {
  private messageRepository: MessageRepository

  constructor() {
    this.messageRepository = new MessageRepository()
  }

  /**
   * Validate prompt variables to prevent duplicate large variables
   * Constitution v1.5.0 Principle III Compliance
   *
   * MUST throw error if {{PRODUCTS}}, {{OFFERS}}, {{SERVICES}}, or {{CATEGORIES}}
   * appear more than once in the same prompt (prevents 100k+ token prompts)
   *
   * STRATEGY: Only count variables that appear ALONE on a line (actual placeholders),
   * ignore those in instructional text, examples, or inline documentation.
   *
   * @param prompt Prompt content to validate
   * @throws PromptValidationError if duplicate large variables detected
   */
  private validatePromptVariables(prompt: string): void {
    const largeVariables = ["PRODUCTS", "OFFERS", "SERVICES", "CATEGORIES"]

    for (const variable of largeVariables) {
      // Match ONLY when variable appears alone or at start/end of line
      // This excludes instructional text like "scroll to {{PRODUCTS}}"
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
    workspaceUrl?: string
  ): Promise<string> {
    // 🔒 STEP 1: Validate prompt BEFORE replacement (Constitution v1.5.0 Principle III)
    // Fail-fast pattern: prevents 100k+ token prompts from duplicate variables
    this.validatePromptVariables(promptContent)

    let processedPrompt = promptContent

    // Sostituzione URL workspace (PRIMA di altre sostituzioni)
    if (workspaceUrl && processedPrompt.includes("{{URL}}")) {
      processedPrompt = processedPrompt.replace(/\{\{URL\}\}/g, workspaceUrl)
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
    if (processedPrompt.includes("{{FAQ}}")) {
      processedPrompt = processedPrompt.replace("{{FAQ}}", dynamicContent.faqs)
    }

    if (processedPrompt.includes("{{PRODUCTS}}")) {
      // Feature 123: Log token count for {{PRODUCTS}} variable
      const productsTokenCount = this.estimateTokenCount(
        dynamicContent.products
      )
      logger.info(
        `[ProductSearch] {{PRODUCTS}} token count: ${productsTokenCount}`
      )

      if (productsTokenCount > 50000) {
        logger.warn(
          `[ProductSearch] ⚠️ {{PRODUCTS}} exceeds 50k tokens (${productsTokenCount}). Consider filtering.`
        )
      }

      processedPrompt = processedPrompt.replace(
        "{{PRODUCTS}}",
        dynamicContent.products
      )
    }

    if (processedPrompt.includes("{{CATEGORIES}}")) {
      processedPrompt = processedPrompt.replace(
        "{{CATEGORIES}}",
        dynamicContent.categories
      )
    }

    if (processedPrompt.includes("{{SERVICES}}")) {
      processedPrompt = processedPrompt.replace(
        "{{SERVICES}}",
        dynamicContent.services
      )
    }

    if (processedPrompt.includes("{{OFFERS}}")) {
      processedPrompt = processedPrompt.replace(
        "{{OFFERS}}",
        dynamicContent.offers
      )
    }

    // Sostituzione {{LAST_ORDER}} - FR-13 Repeat Order
    if (processedPrompt.includes("{{LAST_ORDER}}")) {
      const lastOrderSummary = await this.getLastOrderVariable(
        customerData.id,
        workspaceId
      )
      processedPrompt = processedPrompt.replace(
        /\{\{LAST_ORDER\}\}/g,
        lastOrderSummary
      )
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
   * Sostituisce le variabili nel testo.
   * @param text Il testo da processare.
   * @param customerData I dati del cliente.
   * @returns Il testo con le variabili sostituite.
   */
  private replaceVariables(text: string, customerData: any): string {
    if (!text || !customerData) return text

    return text
      .replace(/\{\{nameUser\}\}/g, customerData.nameUser || "Cliente")
      .replace(
        /\{\{discountUser\}\}/g,
        customerData.discountUser || "Nessuno sconto attivo"
      )
      .replace(
        /\{\{companyName\}\}/g,
        customerData.companyName || "L'Altra Italia"
      )
      .replace(/\{\{lastordercode\}\}/g, customerData.lastordercode || "N/A")
      .replace(/\{\{languageUser\}\}/g, customerData.languageUser || "it")
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
          const code = item.product?.productCode || item.service?.code || "N/A"
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
