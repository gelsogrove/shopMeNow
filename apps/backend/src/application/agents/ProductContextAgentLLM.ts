import { PrismaClient } from "@echatbot/database"
import axios from "axios"
import { config } from "../../config"
import { TemplateLoaderService } from "../services/template-loader.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"
import {
  DEFAULT_ROUNDING_STEP,
  formatRoundedCurrency,
} from "@shared/pricing"

export interface ProductContextData {
  id: string
  name: string
  description?: string | null
  format?: string | null
  price?: number | null
  region?: string | null
  certifications?: string[]
  transportType?: string | null
  ingredients?: string[]
  tags?: string[]
  storageInfo?: string | null
  pairingSuggestions?: string[]
  allergens?: string[]
  imageUrl?: string | null
}

export interface ProductContextWorkspaceInfo {
  name?: string | null
  botIdentityResponse?: string | null
  customAiRules?: string | null
  sellsProductsAndServices?: boolean
  address?: string | null
}

export interface ProductContextAgentInput {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number
  question: string
  product: ProductContextData
  workspaceInfo?: ProductContextWorkspaceInfo
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
}

export interface ProductContextAgentResponse {
  success: boolean
  output: string
  tokensUsed: number
  executionTimeMs: number
  systemPrompt?: string
  model?: string
}

const formatProductPrice = (value?: number | null) =>
  formatRoundedCurrency(value ?? 0, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useSmartRound: true,
    step: DEFAULT_ROUNDING_STEP,
  })

export class ProductContextAgentLLM {
  private templateLoader: TemplateLoaderService
  private promptProcessor: PromptProcessorService
  private openRouterApiKey: string
  private openRouterBaseUrl: string

  constructor(private prisma: PrismaClient) {
    this.templateLoader = TemplateLoaderService.getInstance(prisma)
    this.promptProcessor = new PromptProcessorService()
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ""
    this.openRouterBaseUrl = "https://openrouter.ai/api/v1"

    if (!this.openRouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required for ProductContextAgentLLM")
    }
  }

  /**
   * Get relative image path (frontend will resolve with IMG_BASE_URL)
   */
  private getFullImageUrl(imageUrl: string | null | undefined): string {
    if (!imageUrl) return "N/A"
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
  async handleQuestion(input: ProductContextAgentInput): Promise<ProductContextAgentResponse> {
    const start = Date.now()
    try {
      logger.info("🧀 ProductContextAgentLLM: handling question", {
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        productId: input.product?.id,
      })

      if (!input.product || !input.product.name) {
        throw new Error("Product data is required for ProductContextAgentLLM")
      }

      const template = await this.templateLoader.loadAndRenderTemplate(
        "PRODUCT_CONTEXT",
        input.workspaceId
      )

      const workspaceName =
        input.workspaceInfo?.name ||
        (await this.prisma.workspace.findUnique({
          where: { id: input.workspaceId },
          select: { name: true },
        }))?.name ||
        "Il nostro shop"

      const customerDataForPrompt = {
        nameUser: input.customerName || "Cliente",
        email: "",
        phone: "",
        discountUser: input.customerDiscount || 0,
        companyName: workspaceName,
        lastordercode: "",
        languageUser: input.customerLanguage || "it",
        agentName: "Non assegnato",
        agentPhone: "N/A",
        agentEmail: "N/A",
        botIdentityResponse: input.workspaceInfo?.botIdentityResponse || "",
      }

      const workspaceConfig = {
        customAiRules: input.workspaceInfo?.customAiRules || "",
        botIdentityResponse: input.workspaceInfo?.botIdentityResponse || "",
        sellsProductsAndServices: input.workspaceInfo?.sellsProductsAndServices ?? true,
        address: input.workspaceInfo?.address || "",
      }

      const processedPrompt = await this.promptProcessor.preProcessPrompt(
        template,
        input.workspaceId,
        customerDataForPrompt,
        {
          faqs: "",
          products: "",
          categories: "",
          services: "",
          offers: "",
        },
        undefined,
        workspaceConfig
      )

      const finalPrompt = this.injectProductData(processedPrompt, input.product)

      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: finalPrompt },
      ]

      if (input.conversationHistory?.length) {
        input.conversationHistory.slice(-4).forEach((msg) => {
          messages.push({
            role: msg.role,
            content: msg.content.slice(0, 500),
          })
        })
      }

      messages.push({
        role: "user",
        content: input.question,
      })

      const response = await axios.post(
        `${this.openRouterBaseUrl}/chat/completions`,
        {
          model: "openai/gpt-4o-mini",
          temperature: 0.2,
          messages,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openRouterApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 1000 * 20,
        }
      )

      let content = response.data?.choices?.[0]?.message?.content?.trim() || ""
      const usage = response.data?.usage

      // Post-process: ensure img tag is complete
      // LLM sometimes outputs: URL" alt="Name" /> instead of <img src="URL" alt="Name" />
      const fullImageUrl = this.getFullImageUrl(input.product.imageUrl)
      logger.info("🖼️ ProductContextAgent: Checking image URL", {
        fullImageUrl,
        hasUrlInContent: content.includes(fullImageUrl),
        contentPreview: content.substring(0, 300),
      })
      
      if (fullImageUrl !== "N/A" && content.includes(fullImageUrl)) {
        // Check if it's already correct (has <img src=" before URL)
        const correctPattern = `<img src="${fullImageUrl}"`
        if (!content.includes(correctPattern)) {
          logger.info("🔧 Img tag is malformed, attempting fix...")
          // Replace the broken pattern: URL" alt="X" /> → <img src="URL" alt="X" />
          // Match: URL followed by " alt=" and anything until />
          const escapedUrl = fullImageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const brokenPattern = new RegExp(`${escapedUrl}"\\s*alt="([^"]*)"\\s*/>`, 'g')
          const newContent = content.replace(
            brokenPattern,
            `<img src="${fullImageUrl}" alt="$1" />`
          )
          if (newContent !== content) {
            content = newContent
            logger.info("✅ Fixed malformed img tag in ProductContextAgent response")
          } else {
            // Try simpler approach: just wrap the URL with img tag if it appears on its own line
            const simplePattern = new RegExp(`^(${escapedUrl})`, 'gm')
            content = content.replace(simplePattern, `<img src="$1" alt="${input.product.name}" />`)
            logger.info("✅ Applied simple img tag wrapper")
          }
        }
      }

      return {
        success: true,
        output: content,
        tokensUsed: usage?.total_tokens || 0,
        executionTimeMs: Date.now() - start,
        systemPrompt: finalPrompt,
        model: "openai/gpt-4o-mini",
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorStack = error instanceof Error ? error.stack : undefined
      logger.error("❌ ProductContextAgentLLM failed", { 
        error: errorMessage,
        stack: errorStack,
        workspaceId: input.workspaceId,
        productId: input.product?.id,
        productName: input.product?.name,
      })
      return {
        success: false,
        output: "Mi dispiace, non riesco a recuperare altre informazioni su questo prodotto in questo momento.",
        tokensUsed: 0,
        executionTimeMs: Date.now() - start,
      }
    }
  }

  private injectProductData(prompt: string, product: ProductContextData): string {
    const replaceAll = (text: string, key: string, value: string) =>
      text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "N/A")

    const formatList = (items?: string[] | null): string =>
      items && items.length ? items.join(", ") : "N/A"

    const facts: string[] = []
    if (product.description) facts.push(`Descrizione: ${product.description}`)
    if (product.region) facts.push(`Origine: ${product.region}`)
    if (product.format) facts.push(`Formato: ${product.format}`)
    if (product.certifications?.length)
      facts.push(`Certificazioni: ${product.certifications.join(", ")}`)
    if (product.transportType) facts.push(`Trasporto: ${product.transportType}`)
    if (product.ingredients?.length)
      facts.push(`Ingredienti: ${product.ingredients.join(", ")}`)
    if (product.tags?.length) facts.push(`Note: ${product.tags.join(", ")}`)
    if (product.storageInfo) facts.push(`Conservazione: ${product.storageInfo}`)
    if (product.allergens?.length)
      facts.push(`Allergeni: ${product.allergens.join(", ")}`)
    if (product.pairingSuggestions?.length)
      facts.push(`Abbinamenti consigliati: ${product.pairingSuggestions.join(", ")}`)

    const formattedFacts =
      facts.length > 0
        ? `\n## 📌 DETTAGLI DISPONIBILI\n${facts.map((item) => `- ${item}`).join("\n")}`
        : "\n## 📌 DETTAGLI DISPONIBILI\n- Nessun dettaglio aggiuntivo fornito dal catalogo."

    let result = prompt
    result = replaceAll(result, "PRODUCT_NAME", product.name || "Prodotto")
    result = replaceAll(result, "PRODUCT_DESCRIPTION", product.description || "N/A")
    const priceText =
      typeof product.price === "number" && Number.isFinite(product.price)
        ? formatProductPrice(product.price)
        : "N/A"
    result = replaceAll(result, "PRODUCT_PRICE", priceText)
    result = replaceAll(result, "PRODUCT_REGION", product.region || "N/A")
    result = replaceAll(
      result,
      "PRODUCT_CERTIFICATIONS",
      formatList(product.certifications)
    )
    result = replaceAll(result, "PRODUCT_TRANSPORT", product.transportType || "N/A")
    result = replaceAll(result, "PRODUCT_INGREDIENTS", formatList(product.ingredients))
    result = replaceAll(result, "PRODUCT_TAGS", formatList(product.tags))
    result = replaceAll(result, "PRODUCT_STORAGE", product.storageInfo || "N/A")
    result = replaceAll(
      result,
      "PRODUCT_PAIRINGS",
      formatList(product.pairingSuggestions)
    )
    result = replaceAll(result, "PRODUCT_IMAGE_URL", this.getFullImageUrl(product.imageUrl))
    result = result.replace("{{PRODUCT_FACTS}}", formattedFacts)

    return result
  }
}
