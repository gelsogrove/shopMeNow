/**
 * LLMFormatter Service - Code-First LLM Architecture
 *
 * RESPONSIBILITY: Format pre-computed data into natural language
 *
 * PRINCIPLES:
 * - ONLY service that calls LLM
 * - LLM receives: structured data + formatting instructions
 * - LLM CANNOT: make decisions, change data, add/remove items
 * - LLM ONLY: formats text naturally in target language
 * - Token usage: ~200-500 tokens (vs 5000+ in old system)
 *
 * @see specs/201-code-first-llm-refactoring/README.md
 */

import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import logger from "../../utils/logger"
import {
  StructuredResponse,
  ResponseType,
  ListItem,
  GroupedItems,
} from "../response-builder/response-builder.service"
import { ProductData, OrderData, CartData, WorkspaceIdentityData, WorkspaceLocationData } from "../data-loader/data-loader.service"

// ================================================================================
// FORMATTER RESULT
// ================================================================================

export interface FormatterResult {
  text: string
  tokensUsed: number
  model: string
  cached: boolean // If we used a cached template
  // For smart grouping: mapping of group number -> SKUs
  groupMapping?: Record<string, { nome: string; skus: string[] }>
}

// ================================================================================
// FORMATTER OPTIONS
// ================================================================================

export interface FormatterOptions {
  customAiRules?: string | null  // Custom AI rules from workspace that override defaults
}

// ================================================================================
// PROMPT TEMPLATES (in Italian - base language)
// ================================================================================

const BASE_SYSTEM_PROMPT = `Sei un assistente e-commerce. Il tuo UNICO compito è formattare i dati forniti in linguaggio naturale.

REGOLE CRITICHE:
1. NON inventare dati - usa SOLO i dati forniti
2. NON aggiungere o rimuovere elementi dalla lista
3. NON cambiare prezzi, quantità o nomi
4. Formatta in modo naturale e amichevole
5. Usa la lingua richiesta per la risposta
6. MANTIENI la numerazione esattamente come fornita
7. I numeri servono al cliente per selezionare - NON cambiarli

FORMATO OUTPUT:
- Liste: mantieni numerazione (1, 2, 3...)
- Prezzi: €XX.XX
- Mostra totale "(N elementi)" se richiesto
- Emoji: 🛒 🍷 📦 ✅ ❌ etc.`

/**
 * Build system prompt with optional custom AI rules
 * Custom rules override default behavior when set by workspace admin
 */
function buildSystemPrompt(customAiRules?: string | null): string {
  if (!customAiRules || customAiRules.trim() === "") {
    return BASE_SYSTEM_PROMPT
  }
  
  return `${BASE_SYSTEM_PROMPT}

## 🤖 REGOLE PERSONALIZZATE (PRIORITÀ ALTA)
Le seguenti regole sono state definite dal proprietario del negozio e hanno la priorità sulle regole generali:

${customAiRules}`
}

// ================================================================================
// LLM FORMATTER SERVICE
// ================================================================================

export class LLMFormatterService {
  private openRouterApiKey: string
  private openRouterBaseUrl = "https://openrouter.ai/api/v1"
  private model = "openai/gpt-4o-mini" // Fast, cheap, good for formatting

  constructor(private prisma: PrismaClient) {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    if (!this.openRouterApiKey) {
      logger.warn("⚠️ OPENROUTER_API_KEY not set - LLM formatting will fail")
    }
  }

  /**
   * Main entry point - format structured response into natural language
   * 
   * @param response - Structured response data
   * @param targetLanguage - Target language code
   * @param conversationHistory - Optional history for context (group selections, etc.)
   * @param options - Optional formatting options (customAiRules, etc.)
   */
  async format(
    response: StructuredResponse,
    targetLanguage: string = "it",
    conversationHistory?: Array<{ role: string; content: string }>,
    options?: FormatterOptions
  ): Promise<FormatterResult> {
    const startTime = Date.now()

    logger.info("📝 [LLMFormatter] Formatting response", {
      type: response.type,
      targetLanguage,
      itemCount: response.data.count,
    })

    // For simple responses, use templates (no LLM call)
    const cached = this.tryTemplateResponse(response, targetLanguage)
    if (cached) {
      logger.info("📝 [LLMFormatter] Used cached template", {
        type: response.type,
        ms: Date.now() - startTime,
      })
      return {
        text: cached,
        tokensUsed: 0,
        model: "template",
        cached: true,
      }
    }

    // Build the formatting prompt
    const userPrompt = this.buildFormattingPrompt(response, targetLanguage)

    // Build system prompt with optional custom AI rules
    const systemPrompt = buildSystemPrompt(options?.customAiRules)
    
    if (options?.customAiRules) {
      logger.info("📝 [LLMFormatter] Using custom AI rules", {
        rulesLength: options.customAiRules.length,
      })
    }

    // Build messages array - include history if provided (for context like group selections)
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ]
    
    // Add conversation history if provided (includes system context with group mappings)
    if (conversationHistory && conversationHistory.length > 0) {
      // Filter to only include relevant context (system messages with JSON, recent assistant messages)
      const relevantHistory = conversationHistory.filter(msg => 
        msg.role === "system" || // System context (group mappings, cart state)
        (msg.role === "assistant" && conversationHistory.indexOf(msg) >= conversationHistory.length - 3) // Last 3 assistant messages
      )
      messages.push(...relevantHistory.map(h => ({ role: h.role, content: h.content })))
      
      logger.info("📝 [LLMFormatter] Including conversation history", {
        totalHistory: conversationHistory.length,
        relevantHistory: relevantHistory.length,
      })
    }
    
    // Add current formatting request
    messages.push({ role: "user", content: userPrompt })

    try {
      const llmResponse = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature: 0.3, // Low temperature for consistent formatting
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
          },
        }
      )

      let text = llmResponse.data.choices[0]?.message?.content || ""
      const tokensUsed = llmResponse.data.usage?.total_tokens || 0

      // 🔧 FIX: PREFER LLM-generated groupMapping (semantically meaningful like "Freschi/Stagionati")
      // over CODE-generated groupMapping (which may group by formato like "200g/250g")
      // The LLM groups are more user-friendly and match what the user sees in the text!
      let groupMapping: Record<string, { nome: string; skus: string[] }> | undefined
      
      // FIRST: Try to extract from LLM response (preferred - semantically meaningful)
      const jsonMatch = text.match(/---JSON_MAPPING---\s*([\s\S]*?)\s*---END_JSON---/)
      if (jsonMatch && jsonMatch[1]) {
        try {
          groupMapping = JSON.parse(jsonMatch[1].trim())
          logger.info("📝 [LLMFormatter] Using LLM-generated groupMapping (semantically meaningful)", {
            groups: Object.keys(groupMapping || {}),
            totalSkus: Object.values(groupMapping || {}).reduce((sum, g) => sum + (g.skus?.length || 0), 0),
          })
        } catch (parseError) {
          logger.warn("⚠️ [LLMFormatter] Failed to parse LLM group mapping JSON, falling back to code", { 
            jsonContent: jsonMatch[1].substring(0, 200),
            error: parseError 
          })
        }
      }
      
      // FALLBACK: Use CODE-computed groupMapping if LLM didn't generate one
      if (!groupMapping && (response.data as any)?.groupMapping) {
        groupMapping = (response.data as any).groupMapping
        logger.info("📝 [LLMFormatter] Using CODE-computed groupMapping (fallback)", {
          groups: Object.keys(groupMapping || {}),
          totalSkus: Object.values(groupMapping || {}).reduce((sum, g) => sum + (g.skus?.length || 0), 0),
        })
      }
      
      // Always remove JSON block from visible text (if LLM generated one)
      text = text.replace(/---JSON_MAPPING---[\s\S]*?---END_JSON---/g, "").trim()

      // Clean up any formatting artifacts
      text = text.replace(/---BEGIN OUTPUT---\n?/g, "").replace(/\n?---END OUTPUT---/g, "").trim()

      logger.info("📝 [LLMFormatter] Formatted response", {
        type: response.type,
        tokensUsed,
        hasGroupMapping: !!groupMapping,
        groupMappingSource: jsonMatch ? "LLM" : ((response.data as any)?.groupMapping ? "CODE" : "NONE"),
        ms: Date.now() - startTime,
      })

      return {
        text,
        tokensUsed,
        model: this.model,
        cached: false,
        groupMapping,
      }
    } catch (error) {
      logger.error("❌ [LLMFormatter] Error calling LLM", { error })

      // Fallback to basic formatting
      const fallbackText = this.fallbackFormat(response, targetLanguage)
      return {
        text: fallbackText,
        tokensUsed: 0,
        model: "fallback",
        cached: false,
      }
    }
  }

  // ================================================================================
  // TEMPLATE RESPONSES (no LLM needed)
  // ================================================================================

  private tryTemplateResponse(
    response: StructuredResponse,
    targetLanguage: string
  ): string | null {
    switch (response.type) {
      case "GREETING":
        return this.getGreeting(targetLanguage)

      case "GOODBYE":
        return this.getGoodbye(targetLanguage)

      case "THANKS":
        return this.getThanks(targetLanguage)

      case "HELP":
        return this.getHelp(targetLanguage)

      case "CART_EMPTY":
        return this.getCartEmpty(targetLanguage)

      case "NO_RESULTS":
        return this.getNoResults(targetLanguage, response.data.errorMessage)

      case "ERROR":
        return this.getError(targetLanguage, response.data.errorMessage)

      case "HUMAN_SUPPORT":
        return this.getHumanSupport(targetLanguage)

      default:
        return null // Need LLM for complex formatting
    }
  }

  private getGreeting(lang: string): string {
    const greetings: Record<string, string> = {
      it: "Ciao! 👋 Come posso aiutarti oggi?",
      en: "Hello! 👋 How can I help you today?",
      es: "¡Hola! 👋 ¿Cómo puedo ayudarte hoy?",
      pt: "Olá! 👋 Como posso ajudá-lo hoje?",
      de: "Hallo! 👋 Wie kann ich Ihnen heute helfen?",
      fr: "Bonjour! 👋 Comment puis-je vous aider aujourd'hui?",
    }
    return greetings[lang] || greetings["it"]
  }

  private getGoodbye(lang: string): string {
    const goodbyes: Record<string, string> = {
      it: "Arrivederci! 👋 A presto!",
      en: "Goodbye! 👋 See you soon!",
      es: "¡Adiós! 👋 ¡Hasta pronto!",
      pt: "Adeus! 👋 Até logo!",
      de: "Auf Wiedersehen! 👋 Bis bald!",
      fr: "Au revoir! 👋 À bientôt!",
    }
    return goodbyes[lang] || goodbyes["it"]
  }

  private getThanks(lang: string): string {
    const thanks: Record<string, string> = {
      it: "Prego! 😊 Se hai bisogno di altro, sono qui!",
      en: "You're welcome! 😊 If you need anything else, I'm here!",
      es: "¡De nada! 😊 ¡Si necesitas algo más, estoy aquí!",
      pt: "De nada! 😊 Se precisar de mais alguma coisa, estou aqui!",
      de: "Gern geschehen! 😊 Wenn Sie noch etwas brauchen, bin ich hier!",
      fr: "De rien! 😊 Si vous avez besoin d'autre chose, je suis là!",
    }
    return thanks[lang] || thanks["it"]
  }

  private getHelp(lang: string): string {
    const help: Record<string, string> = {
      it: `Ecco cosa posso fare per te:

📋 **Catalogo**
• "categorie" - mostra le categorie
• "prodotti" - mostra i prodotti
• "cerca [nome]" - cerca un prodotto

🛒 **Carrello**
• "vedi carrello" - mostra il carrello
• "aggiungi [prodotto]" - aggiungi al carrello
• "svuota carrello" - svuota tutto

📦 **Ordini**
• "i miei ordini" - lista ordini
• "stato ordine [codice]" - stato di un ordine

💬 **Altro**
• "chi siete" - informazioni su di noi
• "dove siete" - indirizzo e contatti`,
      en: `Here's what I can do for you:

📋 **Catalog**
• "categories" - show categories
• "products" - show products
• "search [name]" - search a product

🛒 **Cart**
• "view cart" - show cart
• "add [product]" - add to cart
• "clear cart" - empty cart

📦 **Orders**
• "my orders" - list orders
• "order status [code]" - order status

💬 **Other**
• "who are you" - about us
• "where are you" - address and contacts`,
    }
    return help[lang] || help["it"]
  }

  private getCartEmpty(lang: string): string {
    const empty: Record<string, string> = {
      it: "🛒 Il tuo carrello è vuoto.\n\nVuoi vedere i nostri prodotti?",
      en: "🛒 Your cart is empty.\n\nWould you like to see our products?",
      es: "🛒 Tu carrito está vacío.\n\n¿Quieres ver nuestros productos?",
      pt: "🛒 Seu carrinho está vazio.\n\nGostaria de ver nossos produtos?",
    }
    return empty[lang] || empty["it"]
  }

  private getNoResults(lang: string, detail?: string): string {
    const base: Record<string, string> = {
      it: "🔍 Nessun risultato trovato",
      en: "🔍 No results found",
      es: "🔍 No se encontraron resultados",
      pt: "🔍 Nenhum resultado encontrado",
    }
    const text = base[lang] || base["it"]
    return detail ? `${text}: ${detail}` : text
  }

  private getError(lang: string, detail?: string): string {
    const base: Record<string, string> = {
      it: "❌ Si è verificato un errore",
      en: "❌ An error occurred",
      es: "❌ Ha ocurrido un error",
      pt: "❌ Ocorreu um erro",
    }
    const text = base[lang] || base["it"]
    return detail ? `${text}: ${detail}` : text
  }

  private getHumanSupport(lang: string): string {
    const support: Record<string, string> = {
      it: "👤 Capisco che preferisci parlare con un operatore. Ti metto in contatto con il nostro team.",
      en: "👤 I understand you'd prefer to speak with a human. Let me connect you with our team.",
      es: "👤 Entiendo que prefieres hablar con un operador. Te pondré en contacto con nuestro equipo.",
      pt: "👤 Entendo que você prefere falar com um atendente. Vou conectá-lo com nossa equipe.",
    }
    return support[lang] || support["it"]
  }

  // ================================================================================
  // PROMPT BUILDING
  // ================================================================================

  private buildFormattingPrompt(
    response: StructuredResponse,
    targetLanguage: string
  ): string {
    const parts: string[] = []

    parts.push(`LINGUA OUTPUT: ${this.getLanguageName(targetLanguage)}`)
    parts.push(`TIPO RISPOSTA: ${response.type}`)
    parts.push("")

    // Add data based on type
    switch (response.type) {
      case "CATEGORY_LIST":
        parts.push(this.formatCategoryListPrompt(response))
        break

      case "PRODUCT_LIST":
        parts.push(this.formatProductListPrompt(response))
        break

      case "PRODUCT_GROUPED":
        parts.push(this.formatProductGroupedPrompt(response))
        break

      case "PRODUCT_NEEDS_SMART_GROUPING":
        parts.push(this.formatSmartGroupingPrompt(response))
        break

      case "PRODUCT_DETAIL":
        parts.push(this.formatProductDetailPrompt(response))
        break

      case "CART_VIEW":
        parts.push(this.formatCartPrompt(response))
        break

      case "ORDER_LIST":
        parts.push(this.formatOrderListPrompt(response))
        break

      case "ORDER_DETAIL":
        parts.push(this.formatOrderDetailPrompt(response))
        break

      case "IDENTITY":
        parts.push(this.formatIdentityPrompt(response))
        break

      case "LOCATION":
        parts.push(this.formatLocationPrompt(response))
        break

      default:
        parts.push(`Dati: ${JSON.stringify(response.data)}`)
    }

    // Add formatting instructions
    parts.push("")
    parts.push("ISTRUZIONI FORMATTAZIONE:")
    if (response.formatting.showNumbers) {
      parts.push("- Usa lista numerata (1, 2, 3...) per permettere selezione")
    }
    if (response.formatting.showPrices) {
      parts.push("- Mostra i prezzi in formato €XX.XX")
    }
    if (response.formatting.showTotal && response.data.count !== undefined) {
      parts.push(`- Mostra totale: "(${response.data.count} elementi)"`)
    }
    if (response.context.hasDiscount) {
      parts.push(`- Il cliente ha uno sconto del ${response.context.discountPercent}%, mostra entrambi i prezzi`)
    }

    return parts.join("\n")
  }

  private formatCategoryListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["CATEGORIE DISPONIBILI:"]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name}${item.extra ? ` (${item.extra})` : ""}`)
    }
    return lines.join("\n")
  }

  private formatProductListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["PRODOTTI:"]
    for (const item of items) {
      // Clean format for user: "**1.** Pecorino Romano DOP - €6.20" (NO SKU, NO category)
      let line = `**${item.number}.** ${item.name} - €${item.price?.toFixed(2)}`
      if (item.priceWithDiscount) {
        line += ` 🏷️ ~~€${item.price?.toFixed(2)}~~ **€${item.priceWithDiscount.toFixed(2)}**`
      }
      lines.push(line)
    }
    // Add selection prompt - user-friendly, no technical details
    lines.push("")
    lines.push("IMPORTANTE: Dopo la lista, chiedi 'A quale prodotto sei interessato? 🛒' o simile. NON mostrare codici SKU o categorie all'utente.")
    return lines.join("\n")
  }

  private formatProductGroupedPrompt(response: StructuredResponse): string {
    const groups = response.data.groups || []
    const lines = ["PRODOTTI RAGGRUPPATI:"]
    for (const group of groups) {
      lines.push("")
      lines.push(`📁 **${group.groupName}** (${group.variantCount} varianti):`)
      for (const item of group.items) {
        // Clean format for user: "**1.** Pecorino Romano DOP - €6.20" (NO SKU visible)
        let line = `   **${item.number}.** ${item.name} - €${item.price?.toFixed(2)}`
        if (item.priceWithDiscount) {
          line += ` (scontato: €${item.priceWithDiscount.toFixed(2)})`
        }
        lines.push(line)
      }
    }
    return lines.join("\n")
  }

  /**
   * Smart Grouping: LLM creates logical groups from products in the SAME category
   * Example: 7 "Formaggi" → "Formaggi Freschi (3)" + "Formaggi Stagionati (4)"
   * 
   * ARCHITECTURE: LLM returns BOTH user-facing message AND JSON mapping for system
   * The JSON contains which products (by SKU) belong to each numbered group
   */
  private formatSmartGroupingPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const categoryName = response.data.categoryName || "Prodotti"
    
    // Build product list with SKUs for LLM to use in grouping
    const productList = items.map((item: any) => {
      const sku = item.sku || item.code || 'N/A'
      let line = `- ${item.name} (SKU: ${sku}, prezzo: €${item.price?.toFixed(2) || 'N/A'})`
      if (item.description) line += ` - ${item.description.substring(0, 80)}`
      return line
    }).join("\n")

    return `RAGGRUPPAMENTO PRODOTTI:

Categoria: ${categoryName}
Prodotti (${items.length} totali):
${productList}

COMPITO: Crea 2-4 gruppi logici basandoti sulle caratteristiche dei prodotti.

REGOLE:
- Ogni prodotto in UN SOLO gruppo
- Somma prodotti nei gruppi = ${items.length}
- Usa caratteristiche reali (freschi/stagionati, morbidi/duri, piccanti/delicati)
- NON usare DOP/IGP come criterio di raggruppamento

FORMATO RISPOSTA (ESATTO - MANTIENI QUESTO FORMATO):

Ecco i gruppi di ${categoryName}:

1. NomeGruppo1 (N prodotti)
2. NomeGruppo2 (N prodotti)

Quale gruppo ti interessa?

---JSON_MAPPING---
{"1":{"nome":"NomeGruppo1","skus":["SKU1","SKU2"]},"2":{"nome":"NomeGruppo2","skus":["SKU3","SKU4"]}}
---END_JSON---

CRITICO: 
- Mostra SOLO gruppi numerati, NO singoli prodotti, NO prezzi
- Dopo "Quale gruppo ti interessa?" DEVI aggiungere il JSON_MAPPING
- Nel JSON usa i numeri dei gruppi (1, 2, 3...) come chiavi
- Includi TUTTI gli SKU, ogni prodotto deve apparire in un solo gruppo`
  }

  private formatProductDetailPrompt(response: StructuredResponse): string {
    const p = response.data.product
    if (!p) return "Prodotto non trovato"

    const lines = [
      "DETTAGLIO PRODOTTO:",
      `Nome: ${p.name}`,
      `Codice: ${p.sku || "N/A"}`, // 🆕 SKU for cart operations
      `Prezzo: €${p.price.toFixed(2)}`,
    ]

    if (p.priceWithDiscount) {
      lines.push(`Prezzo scontato: €${p.priceWithDiscount.toFixed(2)}`)
    }
    if (p.description) {
      lines.push(`Descrizione: ${p.description}`)
    }
    if (p.region) {
      lines.push(`Regione: ${p.region}`)
    }
    if (p.formato) {
      lines.push(`Formato: ${p.formato}`)
    }
    if (p.certifications.length > 0) {
      lines.push(`Certificazioni: ${p.certifications.join(", ")}`)
    }
    lines.push(`Disponibilità: ${p.isAvailable ? "✅ Disponibile" : "❌ Non disponibile"}`)
    // Add cart prompt with quantity question
    lines.push("")
    lines.push(`IMPORTANTE: Dopo i dettagli, chiedi 'Vuoi aggiungerlo al carrello? Se sì, quanti? 🛒' oppure 'Lo aggiungo al carrello? Dimmi quanti ne vuoi! 🛍️'. NON mostrare codici SKU all'utente.`)

    return lines.join("\n")
  }

  private formatCartPrompt(response: StructuredResponse): string {
    const cart = response.data.cart
    if (!cart) return "Carrello non trovato"

    const lines = ["CARRELLO:"]
    let totalQuantity = 0
    for (const item of response.data.items || []) {
      // item.extra contains quantity in format "8×"
      const quantityMatch = item.extra?.match(/(\d+)/)
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1
      totalQuantity += quantity
      // Show: "1. 8× Pecorino Romano DOP - €49.60"
      lines.push(`${item.number}. ${item.extra || "1×"} ${item.name} - €${item.price?.toFixed(2)}`)
    }
    lines.push("")
    lines.push(`TOTALE: €${cart.totalAmount.toFixed(2)} (${totalQuantity} articol${totalQuantity === 1 ? "o" : "i"})`)

    return lines.join("\n")
  }

  private formatOrderListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["I TUOI ORDINI:"]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name} - €${item.price?.toFixed(2)} [${item.extra}]`)
    }
    return lines.join("\n")
  }

  private formatOrderDetailPrompt(response: StructuredResponse): string {
    const order = response.data.order
    if (!order) return "Ordine non trovato"

    const lines = [
      "DETTAGLIO ORDINE:",
      `Codice: #${order.code}`,
      `Stato: ${order.status}`,
      `Totale: €${order.totalAmount.toFixed(2)}`,
      `Data: ${order.createdAt.toLocaleDateString()}`,
    ]

    if (order.items && order.items.length > 0) {
      lines.push("")
      lines.push("Articoli:")
      for (const item of order.items) {
        lines.push(`• ${item.quantity}× ${item.productName} - €${item.totalPrice.toFixed(2)}`)
      }
    }

    return lines.join("\n")
  }

  private formatIdentityPrompt(response: StructuredResponse): string {
    const identity = response.data.identity
    if (!identity) return "Informazioni non disponibili"

    const lines = ["CHI SIAMO:"]
    lines.push(`Nome: ${identity.name}`)
    if (identity.description) {
      lines.push(`Descrizione: ${identity.description}`)
    }
    if (identity.botName) {
      lines.push(`Bot: ${identity.botName}`)
    }

    return lines.join("\n")
  }

  private formatLocationPrompt(response: StructuredResponse): string {
    const location = response.data.location
    if (!location) return "Informazioni non disponibili"

    const lines = ["DOVE SIAMO:"]
    if (location.address) {
      lines.push(`Indirizzo: ${location.address}`)
    }
    if (location.phone) {
      lines.push(`Telefono: ${location.phone}`)
    }
    if (location.email) {
      lines.push(`Email: ${location.email}`)
    }

    return lines.join("\n")
  }

  // ================================================================================
  // FALLBACK FORMATTING (when LLM fails)
  // ================================================================================

  private fallbackFormat(
    response: StructuredResponse,
    targetLanguage: string
  ): string {
    switch (response.type) {
      case "CATEGORY_LIST":
        return this.fallbackCategoryList(response)

      case "PRODUCT_LIST":
        return this.fallbackProductList(response)

      case "CART_VIEW":
        return this.fallbackCart(response)

      default:
        return JSON.stringify(response.data, null, 2)
    }
  }

  private fallbackCategoryList(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = [`📋 Categorie (${items.length}):`]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name}`)
    }
    return lines.join("\n")
  }

  private fallbackProductList(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = [`🍷 Prodotti (${items.length}):`]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name} - €${item.price?.toFixed(2)}`)
    }
    return lines.join("\n")
  }

  private fallbackCart(response: StructuredResponse): string {
    const cart = response.data.cart
    if (!cart || cart.isEmpty) {
      return "🛒 Carrello vuoto"
    }
    const lines = ["🛒 Carrello:"]
    for (const item of cart.items) {
      lines.push(`• ${item.quantity}× ${item.productName} - €${item.totalPrice.toFixed(2)}`)
    }
    lines.push(`\nTotale: €${cart.totalAmount.toFixed(2)}`)
    return lines.join("\n")
  }

  // ================================================================================
  // UTILITIES
  // ================================================================================

  private getLanguageName(code: string): string {
    const names: Record<string, string> = {
      it: "Italiano",
      en: "English",
      es: "Español",
      pt: "Português",
      de: "Deutsch",
      fr: "Français",
    }
    return names[code] || "Italiano"
  }
}

// ================================================================================
// SINGLETON INSTANCE
// ================================================================================

let formatterInstance: LLMFormatterService | null = null

export function getLLMFormatter(prisma: PrismaClient): LLMFormatterService {
  if (!formatterInstance) {
    formatterInstance = new LLMFormatterService(prisma)
  }
  return formatterInstance
}
