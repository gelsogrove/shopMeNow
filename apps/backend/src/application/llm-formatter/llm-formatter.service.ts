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
} from "@shared/pricing"

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
  botIdentity?: string | null    // Bot personality from workspace settings
  customerName?: string          // Customer name for personalization
  isFirstMessage?: boolean       // If true, add greeting
  botName?: string               // Bot name (e.g., "BellItalia")
  chatbotName?: string | null    // 🆕 Custom chatbot name (e.g., "Sofia", "Marco")
  businessType?: string | null   // 🆕 Business sector for context (e.g., "food", "fashion", "tech")
}

// 🆕 Business Type Labels for LLM context
const BUSINESS_TYPE_LABELS: Record<string, string> = {
  automotive: "settore automobilistico (auto, moto, componenti)",
  aerospace: "settore aerospaziale",
  mechanical: "industria meccanica",
  electronics: "settore elettronica",
  chemical: "industria chimica",
  metalwork: "settore metalmeccanico",
  construction: "settore edilizia e costruzioni",
  healthcare: "settore salute e benessere",
  pharma: "settore farmaceutico e biotecnologie",
  medical_devices: "settore dispositivi medici",
  veterinary: "settore veterinaria",
  fashion: "settore moda e abbigliamento",
  footwear: "settore calzature",
  accessories: "settore accessori (borse, gioielli)",
  luxury: "settore lusso",
  food: "settore alimentare (cibo e bevande)",
  restaurant: "settore ristorazione",
  agrifood: "settore agroalimentare",
  catering: "settore catering ed eventi",
  food_delivery: "settore food delivery",
  software: "settore software e sviluppo",
  hardware: "settore hardware e dispositivi",
  ai: "settore intelligenza artificiale",
  cybersecurity: "settore cybersecurity",
  ecommerce: "settore e-commerce",
  gaming: "settore gaming e videogiochi",
  banking: "settore bancario",
  insurance: "settore assicurazioni",
  fintech: "settore fintech",
  investments: "settore investimenti",
  crypto: "settore criptovalute e blockchain",
  retail: "settore retail (negozi fisici)",
  wholesale: "settore commercio all'ingrosso",
  marketplace: "settore marketplace",
  import_export: "settore import/export",
  logistics: "settore logistica",
  transport: "settore trasporti e spedizioni",
  supply_chain: "settore supply chain",
  education: "settore educazione",
  online_courses: "settore formazione online",
  coaching: "settore coaching e formazione",
  entertainment: "settore intrattenimento e media",
  music: "settore musicale",
  events: "settore organizzazione eventi",
  social_media: "settore social media",
  renewable_energy: "settore energie rinnovabili",
  recycling: "settore riciclo e gestione rifiuti",
  green_tech: "settore green tech",
  other: "settore generico",
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
5. RISPONDI SEMPRE NELLA LINGUA RICHIESTA (vedi "LINGUA OUTPUT")
6. Per il CARRELLO: usa trattini (-) NON numeri. I prodotti del carrello NON devono essere numerati.
7. Per le OPZIONI MENU (Cosa vuoi fare?): MANTIENI la numerazione esattamente come fornita (1, 2, 3...)
8. I PREZZI SONO FINALI - NON calcolare o menzionare sconti sui prezzi! I prezzi mostrati già includono eventuali sconti applicabili.

FORMATO OUTPUT:
- Carrello: prefisso trattino (- Prodotto - €XX.XX)
- Opzioni menu: mantieni numerazione (1. ✅ Azione)
- Prezzi: €XX.XX (mostra esattamente come fornito)
- Mostra totale "(N elementi)" se richiesto
- Emoji: 🛒 🍷 📦 ✅ ❌ etc.

TONO: Sii caldo, amichevole e colloquiale - MAI robotico o formale!`

/**
 * Build system prompt with optional custom AI rules and bot personality
 * Custom rules override default behavior when set by workspace admin
 */
function buildSystemPrompt(options?: FormatterOptions): string {
  let prompt = BASE_SYSTEM_PROMPT

  // 🆕 Add chatbot name and business context
  const chatbotName = options?.chatbotName || options?.botName || "Assistente"
  const businessType = options?.businessType || "other"
  const businessLabel = BUSINESS_TYPE_LABELS[businessType] || BUSINESS_TYPE_LABELS.other
  
  prompt += `

## 🏷️ IDENTITÀ E CONTESTO
- Il tuo nome è: ${chatbotName}
- Operi nel: ${businessLabel}
- Quando ti presenti o ti viene chiesto chi sei, usa il tuo nome: "${chatbotName}"
- Adatta il linguaggio e gli esempi al contesto del settore quando appropriato`
  
  // Add bot personality if set
  if (options?.botIdentity && options.botIdentity.trim() !== "") {
    prompt += `

## 🎭 LA TUA PERSONALITÀ (IMPORTANTISSIMO!)
Hai una personalità e uno stile di comunicazione specifico. Applicalo a COME presenti le informazioni:

${options.botIdentity}

Ricorda: Mantieni la personalità nel TONO, ma non modificare i DATI. Sii sempre caloroso e umano!`
  }
  
  // Add greeting instruction if first message
  if (options?.isFirstMessage && options?.customerName) {
    prompt += `

## 👋 SALUTO (Questo è il PRIMO messaggio!)
Inizia con un saluto caloroso e personalizzato:
- Rivolgiti al cliente per nome: "${options.customerName}"
- Presentati brevemente (sei ${chatbotName})
- Poi fornisci le informazioni richieste
- Sii naturale, mai robotico!`
  }
  
  // Add custom AI rules (highest priority)
  if (options?.customAiRules && options.customAiRules.trim() !== "") {
    prompt += `

## 🤖 REGOLE PERSONALIZZATE (ALTA PRIORITÀ)
Le seguenti regole sono state definite dal proprietario del negozio e hanno priorità sulle regole generali:

${options.customAiRules}`
  }
  
  return prompt
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

    // Build system prompt with all options (customAiRules, botIdentity, customerName, etc.)
    const systemPrompt = buildSystemPrompt(options)
    
    // DEBUG: Log all options received
    logger.info("📝 [LLMFormatter] Options received", {
      hasBotIdentity: !!options?.botIdentity,
      botIdentityLength: options?.botIdentity?.length || 0,
      hasCustomAiRules: !!options?.customAiRules,
      customerName: options?.customerName,
      isFirstMessage: options?.isFirstMessage,
      botName: options?.botName,
    })
    
    if (options?.customAiRules) {
      logger.info("📝 [LLMFormatter] Using custom AI rules", {
        rulesLength: options.customAiRules.length,
      })
    }
    
    if (options?.botIdentity) {
      logger.info("📝 [LLMFormatter] Using bot personality", {
        identityLength: options.botIdentity.length,
        isFirstMessage: options.isFirstMessage,
        customerName: options.customerName,
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

      if (response.type === "PRODUCT_GROUPED") {
        const mappingBlock = this.buildGroupMappingBlock(response)
        if (!text.includes("---JSON_MAPPING---")) {
          text = `${text.trim()}\n\n---JSON_MAPPING---\n${mappingBlock}\n---END_JSON---`
        }
      }

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
      it: "Oops, il carrello è vuoto! 🛒\n\nMa niente paura, abbiamo tantissimi prodotti deliziosi che ti aspettano! Vuoi dare un'occhiata? 😊",
      en: "Oops, your cart is empty! 🛒\n\nBut don't worry, we have lots of delicious products waiting for you! Want to take a look? 😊",
      es: "¡Ups, tu carrito está vacío! 🛒\n\n¡Pero no te preocupes, tenemos muchos productos deliciosos esperándote! ¿Quieres echar un vistazo? 😊",
      pt: "Ops, seu carrinho está vazio! 🛒\n\nMas não se preocupe, temos muitos produtos deliciosos esperando por você! Quer dar uma olhada? 😊",
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

    const displayPrice = product.priceWithDiscount || product.price
    const detailLines: string[] = []

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
    detailLines.push(`💰 <b>Prezzo: ${formatDisplayPrice(displayPrice)} Euro</b>`)
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

    const lines: string[] = ["Ecco il tuo carrello:", ""]
    
    // Separate products from services
    const products = items.filter((item: any) => item.itemType === "PRODUCT" || item.type === "PRODUCT" || !item.itemType)
    const services = items.filter((item: any) => item.itemType === "SERVICE" || item.type === "SERVICE")

    // Display Products
    if (products.length > 0) {
      lines.push("🛒 Prodotti:")
      for (const item of products) {
        const qty = (item as any).quantity || 1
        lines.push(`- ${qty}x ${item.name} - ${formatDisplayPrice(item.price)}`)
      }
    }

    // Display Services (without quantity "1x")
    if (services.length > 0) {
      if (products.length > 0) lines.push("")
      lines.push("🔧 Servizi:")
      for (const item of services) {
        lines.push(`- ${item.name} - ${formatDisplayPrice(item.price)}`)
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
        `ℹ️ Stai usufruendo del tuo sconto riservato del <b>${response.context.discountPercent}</b>%! I prezzi mostrati includono già lo sconto.`
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
      it: "🔍 Mmh, non ho trovato nulla",
      en: "🔍 Hmm, I couldn't find anything",
      es: "🔍 Mmm, no encontré nada",
      pt: "🔍 Hmm, não encontrei nada",
    }
    const suffix: Record<string, string> = {
      it: "Prova con altre parole o dai un'occhiata alle nostre categorie! 😊",
      en: "Try different words or take a look at our categories! 😊",
      es: "¡Prueba con otras palabras o echa un vistazo a nuestras categorías! 😊",
      pt: "Tente outras palavras ou dê uma olhada nas nossas categorias! 😊",
    }
    const text = base[lang] || base["it"]
    const hint = suffix[lang] || suffix["it"]
    return detail ? `${text}: ${detail}\n\n${hint}` : `${text}.\n\n${hint}`
  }

  private getError(lang: string, detail?: string): string {
    const base: Record<string, string> = {
      it: "😅 Ops, qualcosa è andato storto",
      en: "😅 Oops, something went wrong",
      es: "😅 Ups, algo salió mal",
      pt: "😅 Ops, algo deu errado",
    }
    const suffix: Record<string, string> = {
      it: "Riprova tra un attimo, sarò pronto ad aiutarti!",
      en: "Try again in a moment, I'll be ready to help!",
      es: "¡Inténtalo de nuevo en un momento, estaré listo para ayudarte!",
      pt: "Tente novamente em um instante, estarei pronto para ajudar!",
    }
    const text = base[lang] || base["it"]
    const hint = suffix[lang] || suffix["it"]
    return detail ? `${text}: ${detail}\n\n${hint}` : `${text}.\n\n${hint}`
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

      case "BUSINESS_INFO":
        parts.push(this.formatBusinessInfoPrompt(response))
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
      parts.push(`- Customer has a ${response.context.discountPercent}% discount, show both prices`)
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
    lines.push("IMPORTANT: After the list, ask 'Quale categoria vuoi esplorare? 🛍️' or 'Which category would you like to explore?'. DO NOT show any prices for categories. Numbers MUST be bold like **1.** **2.** etc.")
    return lines.join("\n")
  }

  private formatProductListPrompt(response: StructuredResponse): string {
    const items = response.data.items || []
    const lines = ["PRODUCTS:"]
    
    // 🔒 Feature 174: Check if ANY product has prices hidden
    const hasPricesHidden = items.some(item => 
      item.price === null && item.priceWithDiscount === null
    )
    
    for (const item of items) {
      // Show only the final price (discounted if applicable)
      // Customer discount is already applied in priceWithDiscount
      const displayPrice = item.priceWithDiscount || item.price
      const hasDisplayPrice = typeof displayPrice === "number" && Number.isFinite(displayPrice)
      const priceText = hasDisplayPrice ? ` - ${formatDisplayPrice(displayPrice)}` : ""
      const line = `**${item.number}.** ${item.name}${priceText}`
      lines.push(line)
    }
    // Add selection prompt - user-friendly, no technical details
    lines.push("")
    
    // 🔒 Feature 174: If prices are hidden, instruct LLM explicitly
    if (hasPricesHidden) {
      lines.push("⚠️ CRITICAL: Some products DO NOT have prices. DO NOT invent or add prices. If a product has no price shown above, DO NOT include any price in your response for that product. This is intentional - the customer must register first to see prices.")
    }
    
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

    return [
      "GRUPPI DISPONIBILI (non elencare i singoli prodotti):",
      ...lines,
      "",
      "Regole output:",
      "- Mostra SOLO i gruppi sopra indicati con il relativo numero di prodotti.",
      "- Mantieni i numeri in grassetto (es. **1.**, **2.**, ...).",
      "- Non inserire l'elenco dei singoli prodotti né riepiloghi \"Prezzi finali\".",
      "- Chiudi con la domanda tradotta nella lingua di output: \"Quale gruppo ti interessa?\" (o equivalente).",
      "- L'intera risposta deve essere nella lingua richiesta (rispetta il campo LINGUA OUTPUT).",
      "- ⚠️ NON INCLUDERE MAI JSON nella risposta visibile all'utente!",
    ].join("\n")
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
        // Numbers in bold
        return `**${item.number}.** ${item.name}${priceText}`
      })
      .join("\n")

    return `Servizi disponibili:\n${itemsText}\n\nIndica il numero del servizio che ti interessa.\n- Non aggiungere totali, sconti o riepiloghi aggiuntivi\n- Usa solo l'elenco numerato sopra e una domanda finale`
  }

  private formatServiceDetailPrompt(response: StructuredResponse): string {
    const s = response.data.service
    if (!s) return "Service not found"

    const lines = [
      "SERVICE DETAIL - Present in a CONVERSATIONAL, natural way:",
      `Nome servizio: ${s.name}`,
      `Prezzo: ${formatDisplayPrice(s.price)}`,
    ]

    if (s.description) {
      lines.push(`Descrizione: ${s.description}`)
    }
    // REMOVED: Duration and Availability - don't show to user
    
    // Add formatting instructions for natural presentation
    lines.push("")
    lines.push(`FORMATTING INSTRUCTIONS:
- Present the service in a NATURAL, conversational tone - like you're describing it to a friend
- Put the service NAME in **bold** (e.g., **Confezione Regalo**)
- Put the PRICE in **bold** (e.g., **€30.00**)
- Do NOT use rigid labels like "Servizio:", "Prezzo:", "Descrizione:" 
- Weave the information into flowing sentences
- The FINAL QUESTION asking if they want to add it MUST be on a NEW LINE (add \\n before it)
- Example format:
  "**Confezione Regalo** è un servizio di lusso che include materiali premium e un messaggio personalizzato. Il costo è di **€30.00**.
  
  Ti piacerebbe aggiungerla al tuo ordine? 🎁"
- Be warm and inviting, not robotic
- DO NOT show service codes to the user`)

    return lines.join("\n")
  }

  private formatProductDetailPrompt(response: StructuredResponse): string {
    const p = response.data.product
    if (!p) return "Product not found"

    const displayPrice = p.priceWithDiscount || p.price
    const targetLang = response.context.customerLanguage?.toLowerCase() || ""
    const isItalian = targetLang.startsWith("it")
    const italianQuestion = `Vuoi aggiungerlo al carrello? Se sì puoi indicare la quantità? (es. "Sì, 2")`
    const englishQuestion = `Would you like to add it to cart? If yes, how many? (e.g., "Yes, 2")`
    const closingQuestion = isItalian ? italianQuestion : englishQuestion

    const detailLines: string[] = [
      `${p.name}`,
    ]
    
    // 🔒 Feature 174: Only show price if customer is registered (Rule #4)
    if (displayPrice !== null && displayPrice !== undefined) {
      detailLines.push(`Prezzo: ${formatDisplayPrice(displayPrice)}`)
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
    
    // 🔒 Feature 174: Only show availability and cart prompt for registered users
    const isRegisteredUser = response.context.customerIsActive === true
    
    if (isRegisteredUser) {
      // Registered user - show availability and add to cart
      detailLines.push(`Disponibilità: ${p.isAvailable ? "✅ Disponibile" : "❌ Non disponibile"}`)
      detailLines.push("")
      detailLines.push(closingQuestion)
    } else {
      // Non-registered user - show registration prompt only
      detailLines.push("")
      const italianRegistration = `Per vedere i prezzi e acquistare, registrati contattando il nostro supporto.`
      const englishRegistration = `To see prices and purchase, please register by contacting our support.`
      const registrationMessage = isItalian ? italianRegistration : englishRegistration
      detailLines.push(registrationMessage)
    }

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
      const priceText = formatDisplayPrice(totalPriceValue)
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
      "Ecco il tuo carrello:",
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
        `ℹ️ Stai usufruendo del tuo sconto riservato del <b>${response.context.discountPercent}</b>%! I prezzi mostrati includono già lo sconto.`
      )
      outputLines.push(`I prezzi sono IVA esclusa.`)
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
      "- For each item render: `<number>. **<order code>** · €<amount> · stato <status>` (status already provided in the extra field).",
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
      `Date: ${order.createdAt.toLocaleDateString()}`,
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
   * Format business info response - for "che settore?" questions
   * Uses BUSINESS_TYPE_LABELS to provide human-readable sector description
   */
  private formatBusinessInfoPrompt(response: StructuredResponse): string {
    const businessInfo = response.data.businessInfo
    if (!businessInfo) return "Business information not available"

    const businessLabel = BUSINESS_TYPE_LABELS[businessInfo.businessType] || BUSINESS_TYPE_LABELS.other

    const lines = [
      "BUSINESS INFORMATION:",
      `Business Name: ${businessInfo.workspaceName}`,
      `Sector/Type: ${businessLabel}`,
      `Assistant Name: ${businessInfo.chatbotName}`,
    ]
    
    if (businessInfo.description) {
      lines.push(`Description: ${businessInfo.description}`)
    }
    if (businessInfo.address) {
      lines.push(`Address: ${businessInfo.address}`)
    }

    lines.push("")
    lines.push("INSTRUCTIONS: Respond naturally to the user's question about what type of business this is.")
    lines.push(`Present yourself as ${businessInfo.chatbotName} and explain you work for a ${businessLabel}.`)

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
