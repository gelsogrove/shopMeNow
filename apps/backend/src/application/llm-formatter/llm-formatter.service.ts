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
import { config } from "../../config"
import logger from "../../utils/logger"
import {
  StructuredResponse,
  ResponseType,
  ListItem,
  GroupedItems,
} from "../response-builder/response-builder.service"
import {
  ProductData,
  OrderData,
  CartData,
  WorkspaceIdentityData,
  WorkspaceLocationData,
  FAQData,
  CustomerProfileData,
  OfferData,
  AgentInfoData,
} from "../data-loader/data-loader.service"
import {
  DEFAULT_ROUNDING_STEP,
  formatRoundedCurrency,
} from "../../../../../shared/pricing"

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
6. For CART items: use dashes (-) NOT numbers. Cart products should NOT be numbered.
7. For MENU OPTIONS (Cosa vuoi fare?): KEEP numbered exactly as provided (1, 2, 3...)
8. PRICES: Use the provided numbers. If a discounted price is provided (priceWithDiscount) or a discount percent is available, show BOTH the list price and the discounted price like "€10.00 (€9.00 dopo il tuo sconto del 10%)". Never invent or recalculate discounts beyond the provided numbers.
9. IMAGES: When an item has an imageUrl, include a short markdown image or link next to the item.
10. PERSONAL TONE: When a customer name is provided, start with a warm greeting using their name and keep the tone natural (avoid robotic phrasing).

OUTPUT FORMAT:
- Cart items: use dash prefix (- Product - €XX.XX)
- Menu options: keep numbering (1. ✅ Action)
- Prices: show €XX.XX and, if a discount is provided, also show the discounted value as described above (do not invent discounts)
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

const formatDisplayPrice = (value?: number | null, fallback: string = "€0.00") => {
  if (typeof value !== "number" || !isFinite(value)) {
    return fallback
  }

  return formatRoundedCurrency(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useSmartRound: true,
    step: DEFAULT_ROUNDING_STEP,
  })
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
    
    // Add conversation history if provided (keeps recent 5-10 minutes for natural tone)
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory.map((h) => ({ role: h.role, content: h.content })))
      logger.info("📝 [LLMFormatter] Including conversation history", {
        totalHistory: conversationHistory.length,
      })
    }
    
    // Add current formatting request
    messages.push({ role: "user", content: userPrompt })

    const temperature = response.formatting.showNumbers ? 0.3 : 0.42

    try {
      const llmResponse = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature,
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

      if (response.type === "PRODUCT_GROUPED") {
        const mappingBlock = this.buildGroupMappingBlock(response)
        if (!text.includes("---JSON_MAPPING---")) {
          text = `${text.trim()}\n\n---JSON_MAPPING---\n${mappingBlock}\n---END_JSON---`
        }
      }

      // 🔧 FIX: PREFER CODE-generated groupMapping (deterministic, consistent)
      // Only use LLM-generated groupMapping as fallback (legacy behavior)
      // This ensures the same query always returns the same groups!
      let groupMapping: Record<string, { nome: string; skus: string[] }> | undefined
      
      // FIRST: Use CODE-computed groupMapping if available (preferred - deterministic)
      if ((response.data as any)?.groupMapping) {
        groupMapping = (response.data as any).groupMapping
        logger.info("📝 [LLMFormatter] Using CODE-computed groupMapping (deterministic)", {
          groups: Object.keys(groupMapping || {}),
          totalSkus: Object.values(groupMapping || {}).reduce((sum, g) => sum + (g.skus?.length || 0), 0),
        })
      }
      
      // FALLBACK: Try to extract from LLM response if code didn't provide one
      if (!groupMapping) {
        const jsonMatch = text.match(/---JSON_MAPPING---\s*([\s\S]*?)\s*---END_JSON---/)
        if (jsonMatch && jsonMatch[1]) {
          try {
            groupMapping = JSON.parse(jsonMatch[1].trim())
            logger.info("📝 [LLMFormatter] Using LLM-generated groupMapping (fallback)", {
              groups: Object.keys(groupMapping || {}),
              totalSkus: Object.values(groupMapping || {}).reduce((sum, g) => sum + (g.skus?.length || 0), 0),
            })
          } catch (parseError) {
            logger.warn("⚠️ [LLMFormatter] Failed to parse LLM group mapping JSON", { 
              jsonContent: jsonMatch[1].substring(0, 200),
              error: parseError 
            })
          }
        }
      }
      
      // Always remove JSON block from visible text (if LLM generated one)
      text = text.replace(/---JSON_MAPPING---[\s\S]*?---END_JSON---/g, "").trim()

      // ⚙️ Some models still append raw JSON after the question. Strip trailing JSON blobs.
      // Pattern 1: JSON blob after newline
      const trailingJsonMatch = text.match(/\n\{[\s\S]*\}\s*$/)
      if (trailingJsonMatch) {
        const cutIndex = text.lastIndexOf(trailingJsonMatch[0])
        if (cutIndex > -1) {
          text = text.substring(0, cutIndex).trim()
        }
      }
      
      // Pattern 2: JSON blob on its own line at end (groupMapping format)
      // Matches: {"1":{"nome":...}} at end of text
      const rawJsonAtEnd = text.match(/\{"\d+":\s*\{"nome":[\s\S]*\}\}\s*$/)
      if (rawJsonAtEnd) {
        text = text.substring(0, text.lastIndexOf(rawJsonAtEnd[0])).trim()
        logger.info("📝 [LLMFormatter] Stripped raw groupMapping JSON from response")
      }
      
      // Pattern 3: Any JSON object at end of response that looks like groupMapping
      const genericJsonEnd = text.match(/\n\s*\{["']\d["']\s*:\s*\{[\s\S]*?\}\s*\}\s*$/)
      if (genericJsonEnd) {
        text = text.substring(0, text.lastIndexOf(genericJsonEnd[0])).trim()
        logger.info("📝 [LLMFormatter] Stripped generic JSON mapping from end of response")
      }

      // Clean up any formatting artifacts
      text = text.replace(/---BEGIN OUTPUT---\n?/g, "").replace(/\n?---END OUTPUT---/g, "").trim()

      logger.info("📝 [LLMFormatter] Formatted response", {
        type: response.type,
        tokensUsed,
        hasGroupMapping: !!groupMapping,
        groupMappingSource: (response.data as any)?.groupMapping ? "CODE" : "LLM_OR_NONE",
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
      case "CART_VIEW":
        return this.getCartViewTemplate(response)

      case "NO_RESULTS":
        return this.getNoResults(targetLanguage, response.data.errorMessage)

      case "ERROR":
        return this.getError(targetLanguage, response.data.errorMessage)

      case "HUMAN_SUPPORT":
        return this.getHumanSupport(targetLanguage)

      case "PRODUCT_DETAIL": {
        const detailTemplate = this.getProductDetailTemplate(response, targetLanguage)
        if (detailTemplate) {
          return detailTemplate
        }
        return null
      }

      case "SIMPLE_TEXT":
        return response.text || ""

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
      it: "Il tuo carrello è vuoto.\n\nVuoi vedere i nostri prodotti?",
      en: "Your cart is empty.\n\nWould you like to see our products?",
      es: "Tu carrito está vacío.\n\n¿Quieres ver nuestros productos?",
      pt: "Seu carrinho está vazio.\n\nGostaria de ver nossos produtos?",
    }
    return empty[lang] || empty["it"]
  }

  private getProductDetailTemplate(
    response: StructuredResponse,
    targetLanguage: string
  ): string | null {
    const isItalian = (targetLanguage || "").toLowerCase().startsWith("it")
    if (!isItalian) {
      return null
    }

    const product = response.data.product
    if (!product) {
      return null
    }

    const basePrice = product.price
    const discountedPrice =
      typeof product.priceWithDiscount === "number" && product.priceWithDiscount > 0
        ? product.priceWithDiscount
        : undefined
    const detailLines: string[] = []

    if (response.context.customerName) {
      detailLines.push(`Ciao ${response.context.customerName}!`)
      detailLines.push("")
    }

    // Descrizione discorsiva del prodotto
    if (product.description) {
      detailLines.push(`${product.name}: ${product.description}`)
    } else {
      detailLines.push(`${product.name}`)
    }

    // Immagine con URL completo
    if (product.imageUrl) {
      const fullImageUrl = this.getFullImageUrl(product.imageUrl)
      detailLines.push(`<img src="${fullImageUrl}" alt="${product.name}" />`)
    }

    // Info compatte su righe con bullet
    const codeAndFormat = []
    if (product.sku) codeAndFormat.push(`Codice: ${product.sku}`)
    if (product.formato) codeAndFormat.push(`Formato: ${product.formato}`)
    if (codeAndFormat.length > 0) {
      detailLines.push(`- ${codeAndFormat.join(" - ")}`)
    }

    if (product.transportType) {
      detailLines.push(`- Trasporto: ${product.transportType}`)
    }

    if (product.region) {
      detailLines.push(`- Regione: ${product.region}`)
    }

    if (product.certifications && product.certifications.length > 0) {
      detailLines.push(`- Certificazioni: ${product.certifications.join(", ")}`)
    }

    // Stock instead of availability
    const stockValue = product.stock !== undefined ? product.stock : (product.isAvailable ? "disponibile" : "esaurito")
    detailLines.push(`- Stock: ${stockValue}`)
    detailLines.push("")
    if (discountedPrice !== undefined && basePrice && Math.abs(discountedPrice - basePrice) > 0.009) {
      detailLines.push(
        `💰 <b>Prezzo: ${formatDisplayPrice(basePrice)} (${formatDisplayPrice(discountedPrice)} con il tuo sconto del ${response.context.discountPercent}%)</b>`
      )
    } else {
      detailLines.push(`💰 <b>Prezzo: ${formatDisplayPrice(basePrice)} Euro</b>`)
    }
    detailLines.push("")
    detailLines.push(`Vuoi aggiungerlo al carrello? Se sì puoi indicare la quantità? (es. <b>Sì, 2</b>)`)
    detailLines.push("")
    detailLines.push(`oppure`)
    detailLines.push("")
    detailLines.push(`**1.** Esplora il catalogo`)
    detailLines.push(`**2.** Mostrami il carrello`)
    detailLines.push("")
    detailLines.push(`o scrivi quello che stai cercando!`)

    return detailLines.join("\n")
  }

  /**
   * Get relative image path (frontend will resolve with IMG_BASE_URL)
   * e.g., /uploads/products/img.jpg stays as /uploads/products/img.jpg
   */
  private getFullImageUrl(imageUrl: string): string {
    if (!imageUrl) return ""
    // If already absolute URL, extract just the path
    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      try {
        const url = new URL(imageUrl)
        return url.pathname // Extract /uploads/products/...
      } catch {
        return imageUrl
      }
    }
    // Ensure path starts with /
    return imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`
  }

  private getCartViewTemplate(response: StructuredResponse): string {
    const cart = response.data.cart
    const items = response.data.items || []
    if (!cart || items.length === 0) {
      return "Il tuo carrello è vuoto.\n\nVuoi vedere i nostri prodotti?"
    }

    const greeting = response.context.customerName
      ? `Ciao ${response.context.customerName}! Ecco il tuo carrello:`
      : "Ecco il tuo carrello:"
    const lines: string[] = [greeting, ""]
    const hasDiscount = response.context.hasDiscount && response.context.discountPercent > 0
    const discountPercent = response.context.discountPercent
    
    // Separate products from services
    const products = items.filter((item: any) => item.itemType === "PRODUCT" || item.type === "PRODUCT" || !item.itemType)
    const services = items.filter((item: any) => item.itemType === "SERVICE" || item.type === "SERVICE")

    // Display Products
    if (products.length > 0) {
      lines.push("🛒 Prodotti:")
      for (const item of products) {
        const qty = (item as any).quantity || 1
        const basePrice = typeof item.price === "number" ? item.price : 0
        const discounted =
          hasDiscount && basePrice > 0
            ? basePrice * (1 - discountPercent / 100)
            : null
        const priceText = discounted
          ? `${formatDisplayPrice(basePrice)} (${formatDisplayPrice(discounted)} con il tuo sconto del ${discountPercent}%)`
          : formatDisplayPrice(basePrice)
        lines.push(`- ${qty}x ${item.name} - ${priceText}`)
      }
    }

    // Display Services (without quantity "1x")
    if (services.length > 0) {
      if (products.length > 0) lines.push("")
      lines.push("🔧 Servizi:")
      for (const item of services) {
        const basePrice = typeof item.price === "number" ? item.price : 0
        const discounted =
          hasDiscount && basePrice > 0
            ? basePrice * (1 - discountPercent / 100)
            : null
        const priceText = discounted
          ? `${formatDisplayPrice(basePrice)} (${formatDisplayPrice(discounted)} con il tuo sconto del ${discountPercent}%)`
          : formatDisplayPrice(basePrice)
        lines.push(`- ${item.name} - ${priceText}`)
      }
    }

    if (cart.transport && cart.transport.totalTransportCost > 0) {
      lines.push("")
      lines.push("Spedizione:")
      for (const [typeName, info] of Object.entries(cart.transport.byType)) {
        lines.push(`- ${typeName}: ${formatDisplayPrice(info.cost)}`)
      }
    }

    const grandTotal = cart.totalAmount + (cart.transport?.totalTransportCost ?? 0)
    lines.push("")
    lines.push(`<b>💰 totale ordine: ${formatDisplayPrice(grandTotal)}</b>`)

    if (response.context.hasDiscount && response.context.discountPercent > 0) {
      lines.push("")
      lines.push(
        `ℹ️ Stai usufruendo del tuo sconto riservato del <b>${response.context.discountPercent}</b>%! Per ogni voce trovi sia il prezzo di listino sia il valore scontato.`
      )
      lines.push(`I prezzi sono IVA esclusa.`)
    }

    const hasRemovableItems = items.length > 1
    let optionNumber = 1
    const actions: string[] = [
      `<b>${optionNumber++}.</b> Confermare l'ordine`,
      `<b>${optionNumber++}.</b> Esplorare il catalogo`,
      `<b>${optionNumber++}.</b> Mostra servizi`,
      `<b>${optionNumber++}.</b> Guardare le offerte`,
    ]
    if (hasRemovableItems) {
      actions.push(`<b>${optionNumber++}.</b> Rimuovere un articolo`)
    }
    actions.push(`<b>${optionNumber++}.</b> Cancella il carrello`)
    // TODO: "Ottimizza spedizione" feature - will be implemented later
    // if (response.context.showOptimizeOption) {
    //   actions.push(`<b>${optionNumber++}.</b> Ottimizza spedizione`)
    // }

    lines.push("")
    lines.push("Cosa vuoi fare?")
    lines.push(...actions)
    lines.push("")
    lines.push("Rispondi con il numero o scrivi cosa stai cercando")

    return lines.join("\n")
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
    const hasImages =
      Array.isArray((response.data as any)?.items) &&
      (response.data as any).items.some((item: any) => item.imageUrl)

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

      case "CATALOG_AGGREGATE":
        parts.push(this.formatCatalogAggregatePrompt(response))
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

      case "OFFER_WITH_PRODUCTS":
        parts.push(this.formatOfferWithProductsPrompt(response))
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
      parts.push(
        `- Customer has a ${response.context.discountPercent}% discount. When priceWithDiscount is present show: "€listino (€scontato dopo il tuo sconto del ${response.context.discountPercent}%)". Do NOT invent discounts.`
      )
    }
    if (response.context.customerName) {
      parts.push(`- Start with a warm greeting for ${response.context.customerName} in the target language.`)
    }
    parts.push("- Keep the tone friendly and natural, avoid robotic phrasing.")
    if (hasImages) {
      parts.push("- If an item has imageUrl, surface it with a short markdown image or link next to the item.")
    }

    return parts.join("\n")
  }

  private formatCategoryListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["AVAILABLE CATEGORIES:"]
    for (const item of items) {
      // Show only category name and product count - NO prices! Numbers in BOLD
      lines.push(`**${item.number}.** ${item.name}${item.extra ? ` (${item.extra})` : ""}`)
    }
    lines.push("")
    if (items.length === 1) {
      lines.push("IMPORTANT: There is only ONE category. Do NOT ask which category. Present it naturally and, if products for this category are already available, list them directly (max 7) grouped by relevance. If products are not available in the payload, ask ONE short clarifying question instead of a menu. Avoid numeric menus.")
    } else {
      lines.push("IMPORTANT: After the list, ask 'Quale categoria vuoi esplorare? 🛍️' or 'Which category would you like to explore?'. DO NOT show any prices for categories. Numbers MUST be bold like **1.** **2.** etc.")
    }
    return lines.join("\n")
  }

  private formatProductListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["PRODUCTS:"]
    for (const item of items) {
      const basePrice = typeof item.price === "number" && Number.isFinite(item.price) ? item.price : undefined
      const discounted =
        typeof item.priceWithDiscount === "number" && Number.isFinite(item.priceWithDiscount)
          ? item.priceWithDiscount
          : undefined
      let priceText = ""
      if (discounted !== undefined && basePrice !== undefined && Math.abs(discounted - basePrice) > 0.009) {
        priceText = ` - ${formatDisplayPrice(basePrice)} (${formatDisplayPrice(discounted)} dopo il tuo sconto)`
      } else if (discounted !== undefined) {
        priceText = ` - ${formatDisplayPrice(discounted)}`
      } else if (basePrice !== undefined) {
        priceText = ` - ${formatDisplayPrice(basePrice)}`
      }
      const imageText = item.imageUrl ? ` | img: ${item.imageUrl}` : ""
      const line = `**${item.number}.** ${item.name}${priceText}${imageText}`
      lines.push(line)
    }
    // Add selection prompt - user-friendly, no technical details
    lines.push("")
    lines.push("IMPORTANT: After the list, ask 'Which product are you interested in? 🛒' or similar. DO NOT show SKU codes or categories to the user. Numbers MUST be bold like **1.** **2.** etc.")
    return lines.join("\n")
  }

  private formatProductGroupedPrompt(response: StructuredResponse): string {
    const groups = response.data.groups || []
    const lines: string[] = []
    groups.forEach((group, index) => {
      lines.push(`**${index + 1}.** ${group.groupName} (${group.variantCount} prodotti)`)
    })

    // Note: groupMapping is computed and added automatically by the format() method
    // after LLM response - NOT in the visible text to the user!

    const base = [
      "GRUPPI DISPONIBILI (non elencare i singoli prodotti):",
      ...lines,
      "",
      "Regole output:",
      "- Mantieni i numeri in grassetto (es. **1.**, **2.**, ...).",
      "- Non inserire riepiloghi \"Prezzi finali\".",
      "- L'intera risposta deve essere nella lingua richiesta (rispetta il campo LINGUA OUTPUT).",
      "- ⚠️ NON INCLUDERE MAI JSON nella risposta visibile all'utente!",
    ]

    if (groups.length === 1) {
      base.push("- C'è un solo gruppo: NON chiedere quale gruppo. Presentalo come sezione e mostra direttamente i prodotti del gruppo (se presenti nel payload) o poni UNA domanda di chiarimento breve. Evita menu numerici.")
    } else {
      base.push("- Chiudi con la domanda tradotta: \"Quale gruppo ti interessa?\" (o equivalente).")
    }

    return base.join("\n")
  }

  private formatCatalogAggregatePrompt(response: StructuredResponse): string {
    const aggregate = response.data.aggregateResult
    if (!aggregate) {
      return "Aggregate result not available."
    }

    const typeLabel =
      aggregate.type === "min"
        ? "valore minimo"
        : aggregate.type === "max"
          ? "valore massimo"
          : "conteggio totale"

    const valueLabel =
      aggregate.field === "price" && aggregate.type !== "count"
        ? formatDisplayPrice(aggregate.value)
        : aggregate.value.toString()

    return [
      "Risultato aggregato catalogo:",
      `- Tipo: ${typeLabel} (${aggregate.type})`,
      `- Campo: ${aggregate.field}`,
      `- Valore: ${valueLabel}`,
      "",
      "Spiega questo dato al cliente in modo naturale e rassicurante.",
    ].join("\n")
  }

  /**
   * Smart Grouping: FORMAT pre-computed groups from CODE (deterministic)
   * Example: 7 "Formaggi" → "Formaggi Freschi (3)" + "Formaggi Stagionati (4)"
   * 
   * ARCHITECTURE: CODE computes groups, LLM only FORMATS the output text
   * The groupMapping is pre-computed in ResponseBuilder.createSmartGroups()
   */
  private formatSmartGroupingPrompt(response: StructuredResponse): string {
    const categoryName = response.data.categoryName || "Products"
    const productGroups = response.data.productGroups || []
    const groupMapping = response.data.groupMapping || {}
    
    // If we have pre-computed groups, use them directly (DETERMINISTIC)
    if (productGroups.length > 0) {
      const groupsList = productGroups.map((g: any) => 
        `**${g.number}.** ${g.name} (${g.productCount} prodotti)`
      ).join("\n")
      
      logger.info("📝 [LLMFormatter] Using CODE-FIRST grouping (deterministic)", {
        categoryName,
        groupCount: productGroups.length,
        groups: productGroups.map((g: any) => g.name),
      })
      
      return `PRODUCT GROUPING (PRE-COMPUTED):

Category: ${categoryName}
Groups:
${groupsList}

TASK: Format this list for the user. Keep the EXACT group names and counts above.

RESPONSE FORMAT (EXACT):

Ecco i gruppi di ${categoryName}:

${groupsList}

Quale gruppo ti interessa?

---JSON_MAPPING---
${JSON.stringify(groupMapping)}
---END_JSON---

CRITICAL: 
- Use EXACTLY the group names and counts shown above
- DO NOT change or invent new groups
- Numbers MUST be bold like **1.**, **2.**, ...`
    }
    
    // FALLBACK: If no pre-computed groups, ask LLM to create them (legacy behavior)
    const items = response.data.items || []
    
    // Build product list with SKUs for LLM to use in grouping
    const productList = items.map((item: any) => {
      const sku = item.sku || item.code || "N/A"
      const priceText =
        typeof item.price === "number" && Number.isFinite(item.price)
          ? formatDisplayPrice(item.price)
          : "N/A"
      let line = `- ${item.name} (SKU: ${sku}, price: ${priceText})`
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

**1.** GroupName1 (N products)
**2.** GroupName2 (N products)

Which group are you interested in?

---JSON_MAPPING---
{"1":{"nome":"GroupName1","skus":["SKU1","SKU2"]},"2":{"nome":"GroupName2","skus":["SKU3","SKU4"]}}
---END_JSON---

CRITICAL: 
- Show ONLY numbered groups, NO individual products, NO prices
- Numbers MUST be bold like **1.**, **2.**, ...
- After "Which group are you interested in?" you MUST add the JSON_MAPPING
- In JSON use group numbers (1, 2, 3...) as keys
- Include ALL SKUs, each product must appear in only one group`
  }

  private formatServiceListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const itemsText = items
      .map((item) => {
        const priceText =
          typeof item.price === "number" && Number.isFinite(item.price)
            ? ` - ${formatDisplayPrice(item.price)}`
            : ""
        const extraText = item.extra ? ` (${item.extra})` : ""
        return `${item.number}. ${item.name}${priceText}${extraText}`
      })
      .join("\n")

    return `Servizi disponibili:\n${itemsText}\n\nIndica il numero del servizio che ti interessa.\n- Non aggiungere totali, sconti o riepiloghi aggiuntivi\n- Usa solo l'elenco numerato sopra e una domanda finale`
  }

  private formatServiceDetailPrompt(response: StructuredResponse): string {
    const s = response.data.service
    if (!s) return "Service not found"

    const lines = [
      "SERVICE DETAIL:",
      `Servizio: ${s.name}`,
      `Prezzo: ${formatDisplayPrice(s.price)}`,
    ]

    if (s.description) {
      lines.push(`Descrizione: ${s.description}`)
    }
    // REMOVED: Duration and Availability - don't show to user
    
    // Add cart prompt
    lines.push("")
    lines.push(`IMPORTANT: 
- Show Name, Price, and Description to the user in a professional format with line breaks
- Do NOT show Duration or Availability 
- After the details, ask 'Vuoi aggiungere questo servizio al tuo ordine?' 
- DO NOT show service codes to the user.`)

    return lines.join("\n")
  }

  private formatProductDetailPrompt(response: StructuredResponse): string {
    const p = response.data.product
    if (!p) return "Product not found"

    const basePrice = p.price
    const discountedPrice =
      typeof p.priceWithDiscount === "number" && p.priceWithDiscount > 0
        ? p.priceWithDiscount
        : undefined
    const targetLang = response.context.customerLanguage?.toLowerCase() || ""
    const isItalian = targetLang.startsWith("it")
    const italianQuestion = `Vuoi aggiungerlo al carrello? Se sì puoi indicare la quantità? (es. "Sì, 2")`
    const englishQuestion = `Would you like to add it to cart? If yes, how many? (e.g., "Yes, 2")`
    const closingQuestion = isItalian ? italianQuestion : englishQuestion

    const detailLines: string[] = []

    if (response.context.customerName) {
      detailLines.push(`Ciao ${response.context.customerName}!`)
      detailLines.push("")
    }

    detailLines.push(`${p.name}`)
    if (discountedPrice !== undefined && basePrice && Math.abs(discountedPrice - basePrice) > 0.009) {
      detailLines.push(
        `Prezzo: ${formatDisplayPrice(basePrice)} (${formatDisplayPrice(discountedPrice)} con il tuo sconto del ${response.context.discountPercent}%)`
      )
    } else {
      detailLines.push(`Prezzo: ${formatDisplayPrice(basePrice)}`)
    }

    detailLines.push(`Foto: ${p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.name}" />` : "(non disponibile)"}`)

    if (p.description) {
      detailLines.push(`Descrizione: ${p.description}`)
    }
    if (p.region) {
      detailLines.push(`Regione: ${p.region}`)
    }
    if (p.formato) {
      detailLines.push(`Formato: ${p.formato}`)
    }
    if (p.certifications && p.certifications.length > 0) {
      detailLines.push(`Certificazioni: ${p.certifications.join(", ")}`)
    }
    if (p.transportType) {
      detailLines.push(`Tipo di trasporto: ${p.transportType}`)
    }
    detailLines.push(`Disponibilità: ${p.isAvailable ? "✅ Disponibile" : "❌ Non disponibile"}`)
    detailLines.push("")
    detailLines.push(closingQuestion)

    const promptLines = [
      "INSTRUCTION: Copy the EXACT_OUTPUT block below verbatim. Do NOT add bullet points, emojis extra, saluti o commenti.",
      "INSTRUCTION: Non aggiungere testo prima o dopo l'EXACT_OUTPUT."
    ]

    if (!isItalian) {
      promptLines.push("INSTRUCTION: Traduci l'EXACT_OUTPUT nella lingua del cliente mantenendo la struttura identica.")
    }

    promptLines.push("", "EXACT_OUTPUT:", ...detailLines)

    return promptLines.join("\n")
  }

  private formatCartPrompt(response: StructuredResponse): string {
    const cart = response.data.cart
    if (!cart) return "Cart not found"

    const listItems = response.data.items || []
    const cartItems = cart.items || []
    const effectiveItems = cartItems.length ? cartItems : listItems

    const cleanDisplayName = (value?: string) => {
      if (!value) return "Articolo"
      return value.replace(/^[🎁🛒✅❌⚠️📦\s]+/g, "").trim() || "Articolo"
    }

    const resolveQuantity = (item: any) => {
      if (typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0) {
        return item.quantity
      }
      if (typeof item.extra === "string") {
        const digits = item.extra.match(/\d+/)
        if (digits?.[0]) {
          const parsed = parseInt(digits[0], 10)
          if (!Number.isNaN(parsed) && parsed > 0) {
            return parsed
          }
        }
      }
      return 1
    }

    const resolveLineTotal = (item: any, quantity: number) => {
      if (typeof item.totalPrice === "number" && Number.isFinite(item.totalPrice)) {
        return item.totalPrice
      }
      if (typeof item.price === "number" && Number.isFinite(item.price)) {
        return item.price
      }
      if (typeof item.unitPrice === "number" && Number.isFinite(item.unitPrice)) {
        return item.unitPrice * quantity
      }
      return 0
    }

    const hasDiscount = response.context.hasDiscount && response.context.discountPercent > 0
    const discountPercent = response.context.discountPercent

    const products: string[] = []
    const services: string[] = []

    effectiveItems.forEach((item: any) => {
      // Use itemType field for proper product/service detection
      const isServiceFlag = item.itemType === "SERVICE" || item.type === "SERVICE" ||
        (typeof item.isService === "boolean" ? item.isService : false) ||
        (item.serviceCode && !item.sku)
      const quantityValue = resolveQuantity(item)
      const qtyText = `${quantityValue}×`
      const displayName = cleanDisplayName(item.productName || item.name)
      const totalPriceValue = resolveLineTotal(item, quantityValue)
      const discountedValue =
        hasDiscount && totalPriceValue > 0
          ? totalPriceValue * (1 - discountPercent / 100)
          : null
      const priceText = discountedValue
        ? `${formatDisplayPrice(totalPriceValue)} (${formatDisplayPrice(discountedValue)} con sconto ${discountPercent}%)`
        : formatDisplayPrice(totalPriceValue)
      const line = `- ${qtyText} ${displayName} · ${priceText}`
      if (isServiceFlag) {
        services.push(line)
      } else {
        products.push(line)
      }
    })

    const cartLines: string[] = []
    const addSection = (title: string, lines: string[]) => {
      if (!lines.length) return
      if (cartLines.length) cartLines.push("")
      cartLines.push(`${title}:`)
      cartLines.push(...lines)
    }

    addSection("🛒 Prodotti", products)
    addSection("🔧 Servizi", services)

    let totalTransportCost = 0
    const transportLines: string[] = []
    if (cart.transport && cart.transport.totalTransportCost > 0) {
      const entries = Object.entries(cart.transport.byType || {})
      const selectedName = cart.transport.selectedTransportTypeName
      const selectedCost = cart.transport.totalTransportCost
      for (const [typeName, info] of entries) {
        const isSelected = selectedName
          ? typeName === selectedName
          : Math.abs(info.cost - selectedCost) < 0.01
        const suffix = isSelected ? " (selezionato)" : ""
        transportLines.push(`- ${typeName}${suffix}: ${formatDisplayPrice(info.cost)}`)
      }
      totalTransportCost = cart.transport.totalTransportCost
      if (transportLines.length === 0) {
        transportLines.push(`- Trasporto: ${formatDisplayPrice(cart.transport.totalTransportCost)}`)
      }
    }
    addSection("Trasporti", transportLines)

    const grandTotal = cart.totalAmount + totalTransportCost
    const totalLine = `<b>💰 totale ordine: ${formatDisplayPrice(grandTotal)}</b>`

    const hasRemovableItems = effectiveItems.length > 1
    let optionNumber = 1
    const actionLines = [
      `${optionNumber++}. Confermare l'ordine`,
      `${optionNumber++}. Esplorare il catalogo`,
      `${optionNumber++}. Mostra servizi`,
      `${optionNumber++}. Guardare le offerte`,
    ]
    if (hasRemovableItems) {
      actionLines.push(`${optionNumber++}. Rimuovere un articolo`)
    }
    actionLines.push(`${optionNumber++}. Cancella il carrello`)
    // TODO: "Ottimizza spedizione" feature - will be implemented later
    // if (response.context.showOptimizeOption) {
    //   actionLines.push(`${optionNumber++}. Ottimizza spedizione`)
    // }

    const outputLines: string[] = [
      response.context.customerName
        ? `Ciao ${response.context.customerName}! Ecco il tuo carrello:`
        : "Ecco il tuo carrello:",
      "",
    ]

    if (cartLines.length) {
      outputLines.push(...cartLines)
      outputLines.push("")
    }

    outputLines.push(totalLine)
    outputLines.push("Prezzi sono IVA esclusa")

    if (response.context.hasDiscount && response.context.discountPercent && response.context.discountPercent > 0) {
      outputLines.push("")
      outputLines.push(
        `ℹ️ Stai usufruendo del tuo sconto riservato del <b>${response.context.discountPercent}</b>%! Per ogni voce trovi sia il prezzo di listino sia il valore scontato.`
      )
    }

    outputLines.push("")
    outputLines.push("Cosa vuoi fare?")
    outputLines.push(...actionLines)
    outputLines.push("")
    outputLines.push("Rispondi con il numero o scrivi cosa stai cercando")

    const preformattedCart = outputLines.join("\n")

    const lines: string[] = [
      "INSTRUCTION: Copy the EXACT_OUTPUT below. Only translate to customer's language if needed. DO NOT reorganize, reorder, or flatten sections.",
      "",
      "EXACT_OUTPUT:",
      preformattedCart
    ]

    return lines.join("\n")
  }

  private formatOrderListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = [
      "FORMAT RULES:",
      "- Start with a friendly heading like '📦 Ecco i tuoi ordini:'",
      "- For each item render: `<number>. **<order code>** · €<amount> · stato <status> · <date>` (status and date are already provided in the extra field).",
      "- Keep numbering exactly as provided.",
      "- DO NOT add any total line or item count.",
      "- After the list, ask: 'Quale ordine desideri visualizzare? Digita il numero.'",
      "",
      "ORDERS DATA:",
    ]
    for (const item of items) {
      const priceText =
        typeof item.price === "number" && Number.isFinite(item.price)
          ? formatDisplayPrice(item.price)
          : "€0.00"
      lines.push(`${item.number}. ${item.name} | ${priceText} | ${item.extra}`)
    }
    return lines.join("\n")
  }

  private formatOrderDetailPrompt(response: StructuredResponse): string {
    const order = response.data.order
    if (!order) return "Order not found"

    const lines = [
      "ORDER DETAIL:",
      `Code: #${order.code}`,
      `Status: ${order.status}`,
      `Total: ${formatDisplayPrice(order.totalAmount)}`,
      `Date: ${order.createdAt.toLocaleDateString("it-IT")}`,
    ]

    if (order.items && order.items.length > 0) {
      lines.push("")
      lines.push("Items:")
      for (const item of order.items) {
        lines.push(`• ${item.quantity}× ${item.productName} - ${formatDisplayPrice(item.totalPrice)}`)
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
   * Format offer with products response - shows single offer context + product list
   * 🆕 For single-offer scenario: emphasizes the discount before showing products
   */
  private formatOfferWithProductsPrompt(response: StructuredResponse): string {
    const offer = response.data.offer
    const products = response.data.products || []
    const items = response.data.items || []

    const lines: string[] = []

    // First: highlight the offer prominently
    lines.push("🎉 SPECIAL OFFER:")
    lines.push(`**${offer.name}**`)
    if (offer.description) {
      lines.push(`${offer.description}`)
    }
    if (offer.discountPercent && offer.discountPercent > 0) {
      lines.push(`💰 **${offer.discountPercent}% OFF** on ${offer.categoryName || 'selected products'}!`)
    }
    if (offer.endDate) {
      const endDate = new Date(offer.endDate)
      lines.push(`⏰ Valid until: ${endDate.toLocaleDateString()}`)
      lines.push("")  // Extra blank line after date
    }

    lines.push("")
    lines.push("PRODUCTS IN THIS OFFER (each on its own line):")

    // List products with numbers - show original price strikethrough → new price
    const discountPercent = offer.discountPercent || 0
    for (const item of items) {
      const product = products.find(p => p.sku === item.sku)
      if (product) {
        const originalPrice = product.price
        const discountedPrice = originalPrice * (1 - discountPercent / 100)
        lines.push(`**${item.number}.** ${product.name} - ~€${originalPrice.toFixed(2)}~ → €${discountedPrice.toFixed(2)} [SKU:${product.sku}]`)
      } else {
        lines.push(`**${item.number}.** ${item.name} - €${item.price?.toFixed(2) || 'N/A'} [SKU:${item.sku}]`)
      }
    }

    lines.push("")
    lines.push("INSTRUCTIONS:")
    lines.push("- Start by presenting the offer/discount")
    lines.push("- Mention the discount percentage (e.g., '20% di sconto!')")
    lines.push("- Add a blank line after the expiry date")
    lines.push("- CRITICAL: Each product MUST be on its own line (use newline/line break between products)")
    lines.push("- Use **bold** for numbers (e.g., **1.**, **2.**)")
    lines.push("- Show prices with strikethrough on original and arrow to new: ~€XX.XX~ → €YY.YY")
    lines.push("- Do NOT put multiple products on the same line")
    lines.push("- Do NOT add 'Totale: X items' at the end")
    lines.push("- Do NOT add phrases like 'Non lasciarti sfuggire' or 'Non perdere questa occasione'")
    lines.push("- Ask which product interests the customer")

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
      const priceText =
        typeof item.price === "number" && Number.isFinite(item.price)
          ? ` - ${formatDisplayPrice(item.price)}`
          : ""
      lines.push(`${item.number}. ${item.name}${priceText}${item.extra ? ` (${item.extra})` : ""}`)
    }
    return lines.join("\n")
  }

  private fallbackProductList(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = [`🍷 Products (${items.length}):`]
    for (const item of items) {
      lines.push(`${item.number}. ${item.name} - ${formatDisplayPrice(item.price)}`)
    }
    return lines.join("\n")
  }

  private fallbackCart(response: StructuredResponse): string {
    const cart = response.data.cart
    if (!cart || cart.isEmpty) {
      return "Il tuo carrello è vuoto"
    }
    const lines = ["Ecco il tuo carrello:", ""]
    
    // Separate products from services
    const products = cart.items.filter((item: any) => item.itemType === "PRODUCT" || item.type === "PRODUCT" || (!item.itemType && !item.serviceCode))
    const services = cart.items.filter((item: any) => item.itemType === "SERVICE" || item.type === "SERVICE" || item.serviceCode)
    
    // Display Products
    if (products.length > 0) {
      lines.push("🛒 Prodotti:")
      for (const item of products) {
        lines.push(`- ${item.quantity}x ${item.productName} - ${formatDisplayPrice(item.totalPrice)}`)
      }
    }
    
    // Display Services (without quantity)
    if (services.length > 0) {
      if (products.length > 0) lines.push("")
      lines.push("🔧 Servizi:")
      for (const item of services) {
        lines.push(
          `- ${item.productName || (item as any).serviceName || "Servizio"} - ${formatDisplayPrice(
            item.totalPrice
          )}`
        )
      }
    }
    
    lines.push("")
    lines.push(`<b>💰 totale ordine: ${formatDisplayPrice(cart.totalAmount)}</b>`)
    
    // Add discount message if customer has discount
    if (response.context.hasDiscount && response.context.discountPercent && response.context.discountPercent > 0) {
      lines.push("")
      lines.push(`Stai usufruendo del tuo sconto riservato del ${response.context.discountPercent}%! I prezzi mostrati includono già lo sconto.`)
    }
    
    // Add cart action options - numbered 1, 2, 3 (cart items use bullet points)
    lines.push("")
    lines.push("Cosa vuoi fare?")
    lines.push("<b>1.</b> Confermare l'ordine")
    lines.push("<b>2.</b> Esplorare il catalogo")
    lines.push("<b>3.</b> Mostra servizi")
    lines.push("<b>4.</b> Guardare le offerte")
    lines.push("<b>5.</b> Rimuovere un articolo")
    lines.push("<b>6.</b> Cancella il carrello")
    lines.push("")
    lines.push("Rispondi con il numero o scrivi cosa stai cercando!")
    
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
  private buildGroupMappingData(response: StructuredResponse): Record<string, { nome: string; skus: string[] }> {
    const existing = (response.data as any)?.groupMapping
    if (existing && Object.keys(existing).length > 0) {
      return existing
    }

    if (!Array.isArray(response.data.groups)) {
      return {}
    }

    const mapping: Record<string, { nome: string; skus: string[] }> = {}
    response.data.groups.forEach((group: GroupedItems, index: number) => {
      mapping[String(index + 1)] = {
        nome: group.groupName,
        skus: (group.items || [])
          .map((item) => item.sku)
          .filter((sku): sku is string => Boolean(sku)),
      }
    })

    return mapping
  }

  private buildGroupMappingBlock(response: StructuredResponse): string {
    const data = this.buildGroupMappingData(response)
    return JSON.stringify(data || {})
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
