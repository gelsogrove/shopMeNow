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
import { ProductData, OrderData, CartData, WorkspaceIdentityData, WorkspaceLocationData, FAQData, CustomerProfileData, OfferData, AgentInfoData } from "../data-loader/data-loader.service"

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

const BASE_SYSTEM_PROMPT = `You are an e-commerce assistant. Your ONLY task is to format the provided data into natural language.

CRITICAL RULES:
1. DO NOT invent data - use ONLY the provided data
2. DO NOT add or remove items from the list
3. DO NOT change prices, quantities or names
4. Format naturally and friendly
5. Use the requested language for the response
6. KEEP the numbering exactly as provided
7. Numbers are for customer selection - DO NOT change them

OUTPUT FORMAT:
- Lists: keep numbering (1, 2, 3...)
- Prices: €XX.XX
- Show total "(N items)" if requested
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

## 🤖 CUSTOM RULES (HIGH PRIORITY)
The following rules have been defined by the shop owner and take priority over general rules:

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

      case "SERVICE_LIST":
        parts.push(this.formatServiceListPrompt(response))
        break

      case "SERVICE_DETAIL":
        parts.push(this.formatServiceDetailPrompt(response))
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

      case "FAQ":
        parts.push(this.formatFAQPrompt(response))
        break

      case "PROFILE":
        parts.push(this.formatProfilePrompt(response))
        break

      case "OFFERS":
        parts.push(this.formatOffersPrompt(response))
        break

      case "AGENT_INFO":
        parts.push(this.formatAgentInfoPrompt(response))
        break

      default:
        parts.push(`Dati: ${JSON.stringify(response.data)}`)
    }

    // Add formatting instructions
    parts.push("")
    parts.push("FORMATTING INSTRUCTIONS:")
    if (response.formatting.showNumbers) {
      parts.push("- Use numbered list (1, 2, 3...) to allow selection")
    }
    if (response.formatting.showPrices) {
      parts.push("- Show prices in €XX.XX format")
    }
    if (response.formatting.showTotal && response.data.count !== undefined) {
      parts.push(`- Show total: "(${response.data.count} items)"`)
    }
    if (response.context.hasDiscount) {
      parts.push(`- Customer has a ${response.context.discountPercent}% discount, show both prices`)
    }

    return parts.join("\n")
  }

  private formatCategoryListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["AVAILABLE CATEGORIES:"]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name}${item.extra ? ` (${item.extra})` : ""}`)
    }
    return lines.join("\n")
  }

  private formatProductListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["PRODUCTS:"]
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
    lines.push("IMPORTANT: After the list, ask 'Which product are you interested in? 🛒' or similar. DO NOT show SKU codes or categories to the user.")
    return lines.join("\n")
  }

  private formatProductGroupedPrompt(response: StructuredResponse): string {
    const groups = response.data.groups || []
    const lines = ["GROUPED PRODUCTS:"]
    for (const group of groups) {
      lines.push("")
      lines.push(`📁 **${group.groupName}** (${group.variantCount} variants):`)
      for (const item of group.items) {
        // Clean format for user: "**1.** Pecorino Romano DOP - €6.20" (NO SKU visible)
        let line = `   **${item.number}.** ${item.name} - €${item.price?.toFixed(2)}`
        if (item.priceWithDiscount) {
          line += ` (discounted: €${item.priceWithDiscount.toFixed(2)})`
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
    const categoryName = response.data.categoryName || "Products"
    
    // Build product list with SKUs for LLM to use in grouping
    const productList = items.map((item: any) => {
      const sku = item.sku || item.code || 'N/A'
      let line = `- ${item.name} (SKU: ${sku}, price: €${item.price?.toFixed(2) || 'N/A'})`
      if (item.description) line += ` - ${item.description.substring(0, 80)}`
      return line
    }).join("\n")

    return `PRODUCT GROUPING:

Category: ${categoryName}
Products (${items.length} total):
${productList}

TASK: Create 2-4 logical groups based on product characteristics.

RULES:
- Each product in ONE group only
- Sum of products in groups = ${items.length}
- Use real characteristics (fresh/aged, soft/hard, spicy/mild)
- DO NOT use DOP/IGP as grouping criteria

RESPONSE FORMAT (EXACT - KEEP THIS FORMAT):

Here are the ${categoryName} groups:

1. GroupName1 (N products)
2. GroupName2 (N products)

Which group are you interested in?

---JSON_MAPPING---
{"1":{"nome":"GroupName1","skus":["SKU1","SKU2"]},"2":{"nome":"GroupName2","skus":["SKU3","SKU4"]}}
---END_JSON---

CRITICAL: 
- Show ONLY numbered groups, NO individual products, NO prices
- After "Which group are you interested in?" you MUST add the JSON_MAPPING
- In JSON use group numbers (1, 2, 3...) as keys
- Include ALL SKUs, each product must appear in only one group`
  }

  private formatServiceListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const itemsText = items
      .map((item) => `${item.number}. ${item.name}${item.price ? ` - €${item.price.toFixed(2)}` : ""}${item.extra ? ` (${item.extra})` : ""}`)
      .join("\n")

    return `Servizi disponibili:\n${itemsText}`
  }

  private formatServiceDetailPrompt(response: StructuredResponse): string {
    const s = response.data.service
    if (!s) return "Service not found"

    const lines = [
      "SERVICE DETAIL:",
      `Name: ${s.name}`,
      `Code: ${s.code}`,
      `Price: €${s.price.toFixed(2)}`,
    ]

    if (s.priceWithDiscount) {
      lines.push(`Discounted price: €${s.priceWithDiscount.toFixed(2)}`)
    }
    if (s.description) {
      lines.push(`Description: ${s.description}`)
    }
    if (s.duration) {
      lines.push(`Duration: ${s.duration} minutes`)
    }
    lines.push(`Availability: ${s.isAvailable ? "✅ Available" : "❌ Not available"}`)
    // Add cart prompt
    lines.push("")
    lines.push(`IMPORTANT: After the details, ask 'Would you like to add this service to your order?' or 'Shall I add it to your cart?'. DO NOT show service codes to the user.`)

    return lines.join("\n")
  }

  private formatProductDetailPrompt(response: StructuredResponse): string {
    const p = response.data.product
    if (!p) return "Product not found"

    const lines = [
      "PRODUCT DETAIL:",
      `Name: ${p.name}`,
      `Code: ${p.sku || "N/A"}`, // 🆕 SKU for cart operations
      `Price: €${p.price.toFixed(2)}`,
    ]

    if (p.priceWithDiscount) {
      lines.push(`Discounted price: €${p.priceWithDiscount.toFixed(2)}`)
    }
    if (p.description) {
      lines.push(`Description: ${p.description}`)
    }
    if (p.region) {
      lines.push(`Region: ${p.region}`)
    }
    if (p.formato) {
      lines.push(`Format: ${p.formato}`)
    }
    if (p.certifications.length > 0) {
      lines.push(`Certifications: ${p.certifications.join(", ")}`)
    }
    lines.push(`Availability: ${p.isAvailable ? "✅ Available" : "❌ Not available"}`)
    // Add cart prompt with quantity question
    lines.push("")
    lines.push(`IMPORTANT: After the details, ask 'Would you like to add it to cart? If yes, how many? 🛒' or 'Shall I add it to cart? Tell me how many you want! 🛍️'. DO NOT show SKU codes to the user.`)

    return lines.join("\n")
  }

  private formatCartPrompt(response: StructuredResponse): string {
    const cart = response.data.cart
    if (!cart) return "Cart not found"

    const lines = ["CART:"]
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
    lines.push(`TOTAL: €${cart.totalAmount.toFixed(2)} (${totalQuantity} item${totalQuantity === 1 ? "" : "s"})`)

    return lines.join("\n")
  }

  private formatOrderListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["YOUR ORDERS:"]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name} - €${item.price?.toFixed(2)} [${item.extra}]`)
    }
    // Add selection prompt so user knows to type a number
    lines.push("")
    lines.push("IMPORTANT: After the list, ask 'Which order would you like to view? Type the number.' or similar.")
    return lines.join("\n")
  }

  private formatOrderDetailPrompt(response: StructuredResponse): string {
    const order = response.data.order
    if (!order) return "Order not found"

    const lines = [
      "ORDER DETAIL:",
      `Code: #${order.code}`,
      `Status: ${order.status}`,
      `Total: €${order.totalAmount.toFixed(2)}`,
      `Date: ${order.createdAt.toLocaleDateString()}`,
    ]

    if (order.items && order.items.length > 0) {
      lines.push("")
      lines.push("Items:")
      for (const item of order.items) {
        lines.push(`• ${item.quantity}× ${item.productName} - €${item.totalPrice.toFixed(2)}`)
      }
    }

    // Add action options (MUST be numbered for fast-path selection)
    lines.push("")
    lines.push("What would you like to do?")
    lines.push("1. 📄 Download invoice")
    lines.push("2. 🔄 Repeat order")
    
    // Only show credit note option if order has credit notes
    if (order.hasCreditNotes) {
      lines.push("3. 📋 Download credit note")
    }

    return lines.join("\n")
  }

  private formatIdentityPrompt(response: StructuredResponse): string {
    const identity = response.data.identity
    if (!identity) return "Information not available"

    const lines = ["WHO WE ARE:"]
    lines.push(`Name: ${identity.name}`)
    if (identity.description) {
      lines.push(`Description: ${identity.description}`)
    }
    if (identity.botName) {
      lines.push(`Bot: ${identity.botName}`)
    }

    return lines.join("\n")
  }

  private formatLocationPrompt(response: StructuredResponse): string {
    const location = response.data.location
    if (!location) return "Information not available"

    const lines = ["WHERE WE ARE:"]
    if (location.address) {
      lines.push(`Address: ${location.address}`)
    }
    if (location.phone) {
      lines.push(`Phone: ${location.phone}`)
    }
    if (location.email) {
      lines.push(`Email: ${location.email}`)
    }

    return lines.join("\n")
  }

  /**
   * Format FAQ response - LLM will find the best matching answer
   */
  private formatFAQPrompt(response: StructuredResponse): string {
    const data = response.data as any
    const faqs: FAQData[] = data?.faqs || []
    const query: string = data?.query || ""

    if (faqs.length === 0) {
      return `User question: "${query}"\n\nNo FAQs available. Respond in a helpful and general way.`
    }

    const lines = [
      `USER QUESTION: "${query}"`,
      "",
      "AVAILABLE FAQs:",
      ""
    ]

    for (let i = 0; i < faqs.length; i++) {
      const faq = faqs[i]
      lines.push(`[${i + 1}] Question: ${faq.question}`)
      lines.push(`    Answer: ${faq.answer}`)
      if (faq.keywords && faq.keywords.length > 0) {
        lines.push(`    Keywords: ${faq.keywords.join(", ")}`)
      }
      lines.push("")
    }

    lines.push("INSTRUCTIONS:")
    lines.push("1. Analyze the user's question")
    lines.push("2. Find the most relevant FAQ (use semantics, not just keyword match)")
    lines.push("3. Respond using the found FAQ answer, adapting the tone")
    lines.push("4. If no FAQ is relevant, respond that you don't have specific information")
    lines.push("5. Be concise and direct")

    return lines.join("\n")
  }

  /**
   * Format profile response - shows customer discount info
   */
  private formatProfilePrompt(response: StructuredResponse): string {
    const profile = response.data.profile
    if (!profile) return "Profile information not available"

    const lines = ["YOUR PROFILE:"]
    lines.push(`Name: ${profile.name}`)
    
    if (profile.discount > 0) {
      lines.push(`Personal discount: ${profile.discount}%`)
      lines.push("")
      lines.push("INSTRUCTIONS:")
      lines.push("- Confirm the customer's personal discount")
      lines.push("- Explain that the discount is automatically applied to prices")
      lines.push("- Be friendly and positive")
    } else {
      lines.push("Personal discount: No active discount")
      lines.push("")
      lines.push("INSTRUCTIONS:")
      lines.push("- Inform the customer they have no active discounts at the moment")
      lines.push("- Suggest contacting support for information on promotions")
    }

    return lines.join("\n")
  }

  /**
   * Format offers response - shows active promotions
   * 🆕 Now includes numbered options to view discounted products
   */
  private formatOffersPrompt(response: StructuredResponse): string {
    const offers = response.data.offers || []
    if (offers.length === 0) {
      return "There are no active offers at the moment."
    }

    const lines = ["ACTIVE OFFERS:"]
    
    for (const offer of offers) {
      lines.push("")
      lines.push(`🎉 **${offer.name}**`)
      if (offer.description) {
        lines.push(`   ${offer.description}`)
      }
      if (offer.discountPercent && offer.discountPercent > 0) {
        lines.push(`   Discount: ${offer.discountPercent}%`)
      }
      if (offer.categoryName) {
        lines.push(`   Category: ${offer.categoryName}`)
      }
      if (offer.endDate) {
        const endDate = new Date(offer.endDate)
        lines.push(`   Valid until: ${endDate.toLocaleDateString()}`)
      }
    }

    // 🆕 Add numbered options for offers with categories
    const items = response.data.items || []
    if (items.length > 0) {
      lines.push("")
      lines.push("ACTIONS:")
      for (const item of items) {
        lines.push(`${item.number}. ${item.name}`)
      }
    }

    lines.push("")
    lines.push("INSTRUCTIONS:")
    lines.push("- Present the offers in an appealing way")
    lines.push("- Emphasize the benefits for the customer")
    if (items.length > 0) {
      lines.push("- Show the numbered options so the customer can easily select to view products")
      lines.push("- If customer replies with a number, they want to see the discounted products")
    } else {
      lines.push("- Suggest exploring the products on offer")
    }

    return lines.join("\n")
  }

  /**
   * Format agent info response - shows sales agent information
   * @see Feature 202 - Agent Variables
   */
  private formatAgentInfoPrompt(response: StructuredResponse): string {
    const agentInfo = response.data.agentInfo
    if (!agentInfo) return "Agent information not available"

    const lines: string[] = []

    if (agentInfo.hasAgent) {
      lines.push("YOUR SALES AGENT:")
      lines.push(`Name: ${agentInfo.name}`)
      
      if (agentInfo.email) {
        lines.push(`Email: ${agentInfo.email}`)
      }
      if (agentInfo.phone) {
        lines.push(`Phone: ${agentInfo.phone}`)
      }
      
      lines.push("")
      lines.push("INSTRUCTIONS:")
      lines.push("- Present the agent's contact information clearly")
      lines.push("- Encourage the customer to reach out for personalized assistance")
      lines.push("- Be friendly and helpful")
    } else {
      // No agent assigned or workspace doesn't use agents
      if (agentInfo.reason === "workspace_no_agents") {
        lines.push("NO DEDICATED AGENTS:")
        lines.push("This business doesn't use dedicated sales agents.")
        lines.push("")
        lines.push("INSTRUCTIONS:")
        lines.push("- Explain that the business doesn't use dedicated sales agents")
        lines.push("- Offer to help with any questions via the chatbot")
        lines.push("- Suggest contacting general support if needed")
      } else {
        // no_agent_assigned
        lines.push("NO AGENT ASSIGNED:")
        lines.push("You don't have a dedicated agent assigned yet.")
        lines.push("")
        lines.push("INSTRUCTIONS:")
        lines.push("- Explain that no agent has been assigned yet")
        lines.push("- Reassure the customer that they can still get help")
        lines.push("- Offer to assist with any questions via the chatbot")
      }
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

      case "SERVICE_LIST":  // 🆕
        return this.fallbackServiceList(response)

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
    const lines = [`📋 Categories (${items.length}):`]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name}`)
    }
    return lines.join("\n")
  }

  private fallbackServiceList(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = [`📦 Servizi (${items.length}):`]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name}${item.price ? ` - €${item.price.toFixed(2)}` : ""}${item.extra ? ` (${item.extra})` : ""}`)
    }
    return lines.join("\n")
  }

  private fallbackProductList(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = [`🍷 Products (${items.length}):`]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name} - €${item.price?.toFixed(2)}`)
    }
    return lines.join("\n")
  }

  private fallbackCart(response: StructuredResponse): string {
    const cart = response.data.cart
    if (!cart || cart.isEmpty) {
      return "🛒 Empty cart"
    }
    const lines = ["🛒 Cart:"]
    for (const item of cart.items) {
      lines.push(`• ${item.quantity}× ${item.productName} - €${item.totalPrice.toFixed(2)}`)
    }
    lines.push(`\nTotal: €${cart.totalAmount.toFixed(2)}`)
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
