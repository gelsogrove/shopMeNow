/**
 * VariableResolverService - Collect all variables for prompt templates
 *
 * Single Responsibility: Gather all 35+ variables from database.
 * Variables come from: workspace config, customer data, dynamic content.
 *
 * @architecture Part of PromptBuilder system
 */

import { AgentType, PrismaClient } from "@echatbot/database"
import logger from "../../../utils/logger"
import { getCurrencySymbol } from "../../../utils/currency"

export interface PromptVariables {
  // Workspace Config (16 variables)
  workspaceName: string
  workspaceUrl: string
  toneOfVoice: string
  botIdentityResponse: string
  welcomeMessage: string
  wipMessage: string
  language: string
  currency: string
  sellsProductsAndServices: boolean
  hasHumanSupport: boolean
  hasSalesAgents: boolean
  humanSupportInstructions: string
  frustrationEscalationInstructions: string // 🆕 Feature 203: Custom escalation triggers
  operatorContactMethod: string
  operatorWhatsappNumber: string
  allowedExternalLinks: string
  customAiRules: string
  adminEmail: string
  address: string
  chatbotName: string
  businessType: string
  websiteUrl: string
  supportEmail: string

  // Customer Context (7 variables)
  customerName: string
  customerEmail: string
  customerPhone: string
  customerDiscount: number
  customerIsActive?: boolean // 🔒 Feature 174: Registration status
  pushNotificationsConsent: boolean
  languageUser: string
  lastOrderCode: string

  // Sales Agent (3 variables)
  agentName: string
  agentPhone: string
  agentEmail: string

  // Dynamic Data (7 variables)
  products: string
  services: string
  categories: string
  offers: string
  faq: string // 🆕 FAQ content for Router
  lastOrder: string
  conversationHistory: string

  // Counters (3 variables)
  faqCount: number
  productsCount: number
  offersActive: boolean
}

export class VariableResolverService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    logger.info("✅ VariableResolverService initialized")
  }

  /**
   * Resolve all variables needed for a specific agent
   *
   * @param agentType - Which agent needs variables
   * @param workspaceId - Workspace to get data from
   * @param customerId - Customer context (optional)
   * @returns All resolved variables
   */
  async resolve(
    agentType: AgentType | string,
    workspaceId: string,
    customerId?: string
  ): Promise<Partial<PromptVariables>> {
    logger.info(`🔍 Resolving variables for ${agentType}`, { workspaceId, customerId })

    const variables: Partial<PromptVariables> = {}

    // Always load workspace config
    await this.loadWorkspaceConfig(workspaceId, variables)

    // Load customer context if customerId provided
    if (customerId) {
      await this.loadCustomerContext(workspaceId, customerId, variables)
    }

    // Load agent-specific dynamic data
    await this.loadDynamicData(agentType, workspaceId, customerId, variables)

    logger.info(`✅ Resolved ${Object.keys(variables).length} variables for ${agentType}`)

    return variables
  }

  /**
   * Load workspace configuration variables
   */
  private async loadWorkspaceConfig(
    workspaceId: string,
    variables: Partial<PromptVariables>
  ): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        name: true,
        url: true,
        websiteUrl: true,
        language: true,
        currency: true,
        toneOfVoice: true,
        botIdentityResponse: true,
        welcomeMessage: true,
        wipMessage: true,
        sellsProductsAndServices: true,
        hasHumanSupport: true,
        hasSalesAgents: true,
        humanSupportInstructions: true,
        frustrationEscalationInstructions: true, // 🆕 Feature 203
        operatorContactMethod: true,
        operatorWhatsappNumber: true,
        allowedExternalLinks: true,
        customAiRules: true,
        notificationEmail: true,
        address: true,
        chatbotName: true,
        businessType: true,
      },
    })

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    variables.workspaceName = workspace.name || ""
    variables.workspaceUrl = workspace.websiteUrl || workspace.url || ""
    variables.language = workspace.language || "ITA"
    variables.currency = workspace.currency || "USD"
    variables.toneOfVoice = workspace.toneOfVoice || "friendly"
    variables.botIdentityResponse = workspace.botIdentityResponse || ""
    variables.welcomeMessage = typeof workspace.welcomeMessage === 'string' 
      ? workspace.welcomeMessage 
      : JSON.stringify(workspace.welcomeMessage || "")
    variables.wipMessage = typeof workspace.wipMessage === 'string'
      ? workspace.wipMessage
      : JSON.stringify(workspace.wipMessage || "")
    variables.sellsProductsAndServices = workspace.sellsProductsAndServices ?? true
    variables.hasHumanSupport = workspace.hasHumanSupport ?? true
    variables.hasSalesAgents = workspace.hasSalesAgents ?? false
    variables.humanSupportInstructions = workspace.humanSupportInstructions || ""
    variables.frustrationEscalationInstructions = workspace.frustrationEscalationInstructions || "" // 🆕 Feature 203
    variables.operatorContactMethod = workspace.operatorContactMethod || "email"
    variables.operatorWhatsappNumber = workspace.operatorWhatsappNumber || ""
    variables.allowedExternalLinks = Array.isArray(workspace.allowedExternalLinks)
      ? workspace.allowedExternalLinks.join("\n")
      : ""
    variables.customAiRules = workspace.customAiRules || ""
    variables.adminEmail = workspace.notificationEmail || ""
    variables.address = workspace.address || ""
    variables.chatbotName = workspace.chatbotName || "Assistente"
    variables.businessType = workspace.businessType || "other"
    variables.websiteUrl = workspace.websiteUrl || workspace.url || ""
    variables.supportEmail = workspace.notificationEmail || ""

    // 🔧 Aliases for template compatibility (templates use old variable names)
    ;(variables as any).companyName = variables.workspaceName
    ;(variables as any).websiteUrl = variables.websiteUrl
    ;(variables as any).supportEmail = variables.supportEmail
    ;(variables as any).chatbotName = variables.chatbotName
    ;(variables as any).businessType = variables.businessType
    ;(variables as any).nameUser = variables.customerName || "Customer" // Transfer messages use {{nameUser}}
  }

  /**
   * Load customer context variables
   */
  private async loadCustomerContext(
    workspaceId: string,
    customerId: string,
    variables: Partial<PromptVariables>
  ): Promise<void> {
    const customer = await this.prisma.customers.findFirst({
      where: { id: customerId, workspaceId },
      include: { sales: true },
    })

    if (!customer) {
      logger.warn(`Customer not found: ${customerId}`)
      variables.customerName = "Customer"
      variables.customerEmail = ""
      variables.customerPhone = ""
      variables.customerDiscount = 0
      variables.pushNotificationsConsent = false
      variables.languageUser = variables.language || "it"
      variables.customerIsActive = false // 🔒 Feature 174: Default to non-registered
      // 🔧 Set agentName even if customer not found
      variables.agentName = "Not assigned"
      variables.agentPhone = ""
      variables.agentEmail = ""
      return
    }

    variables.customerName = customer.name || "Customer"
    variables.customerEmail = customer.email || ""
    variables.customerPhone = customer.phone || ""
    variables.customerDiscount = customer.discount || 0
    variables.pushNotificationsConsent = customer.push_notifications_consent ?? false
    variables.languageUser = this.getLanguageDisplayName(customer.language || variables.language || "it")
    variables.customerIsActive = customer.isActive ?? false // 🔒 Feature 174: Registration status

    // Sales agent info
    if (customer.sales) {
      variables.agentName = `${customer.sales.firstName || ""} ${customer.sales.lastName || ""}`.trim()
      variables.agentPhone = customer.sales.phone || ""
      variables.agentEmail = customer.sales.email || ""
    } else {
      variables.agentName = "Not assigned"
      variables.agentPhone = ""
      variables.agentEmail = ""
    }

    // Last order
    const lastOrder = await this.prisma.orders.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      select: { orderCode: true },
    })
    variables.lastOrderCode = lastOrder?.orderCode || ""

    // 🔧 Alias: nameUser = customerName (transfer messages use {{nameUser}})
    ;(variables as any).nameUser = variables.customerName
  }

  /**
   * Load dynamic data based on agent type
   */
  private async loadDynamicData(
    agentType: AgentType | string,
    workspaceId: string,
    customerId: string | undefined,
    variables: Partial<PromptVariables>
  ): Promise<void> {
    const typeKey = String(agentType)

    // Product Search needs: PRODUCTS, SERVICES, CATEGORIES, OFFERS
    if (typeKey === "PRODUCT_SEARCH") {
      const [products, services, categories, offers] = await Promise.all([
        this.getActiveProducts(workspaceId, variables.customerDiscount || 0, variables.customerIsActive ?? false),
        this.getActiveServices(workspaceId, variables.customerIsActive ?? false), // 🔒 Feature 174: Hide prices
        this.getActiveCategories(workspaceId),
        this.getActiveOffers(workspaceId),
      ])

      variables.products = products
      variables.services = services
      variables.categories = categories
      variables.offers = offers
      variables.productsCount = products.split("\n").filter(l => l.trim()).length
      variables.offersActive = offers.length > 0
      
      // 🔒 Feature 174: Flag per LLM
      const vars = variables as Record<string, any>
      vars.customerIsRegistered = variables.customerIsActive ?? false
      const isRegistered = variables.customerIsActive === true
      vars.pricingInstructions = isRegistered ? "" : "[WARNING] Non-registered customer - do not show prices"
    }

    // Order Tracking needs: lastOrder
    if (typeKey === "ORDER_TRACKING" && customerId) {
      variables.lastOrder = await this.getLastOrderDetails(workspaceId, customerId)
    }

    // Router needs to know what's available AND have FAQ content
    if (typeKey === "ROUTER") {
      const [faqContent, faqCount, productsCount, offersCount] = await Promise.all([
        this.getActiveFaqs(workspaceId), // 🆕 Load actual FAQ content for Router
        this.prisma.fAQ.count({ where: { workspaceId, isActive: true } }),
        this.prisma.products.count({ where: { workspaceId, isActive: true } }),
        this.prisma.offers.count({ where: { workspaceId, isActive: true } }),
      ])

      variables.faq = faqContent // 🆕 FAQ content for template {{faq}}
      variables.faqCount = faqCount
      variables.productsCount = productsCount
      variables.offersActive = offersCount > 0
    }
  }

  /**
   * Get active products formatted for prompt
   */
  private async getActiveProducts(workspaceId: string, discount: number, customerIsActive: boolean): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { currency: true },
    })
    const currencySymbol = getCurrencySymbol(workspace?.currency || "USD")

    const products = await this.prisma.products.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        description: true,
        category: { select: { name: true } },
      },
      take: 100, // Limit to avoid huge prompts
    })

    if (products.length === 0) return "No products available."

    return products.map(p => {
      const discountedPrice = discount > 0 
        ? (Number(p.price) * (1 - discount / 100)).toFixed(2)
        : Number(p.price).toFixed(2)
      
      // 🔒 Feature 174: Hide prices for non-registered customers - GENERICO
      const priceSection = customerIsActive 
        ? ` - ${currencySymbol}${discountedPrice}`
        : "" // No price section for non-registered (cleaner template)
      
      // GENERICO: Funziona per panettoni, borse, qualsiasi prodotto
      // Format: - Nome (SKU) - €prezzo - Categoria (only if registered gets price)
      return `- ${p.name} (${p.sku})${priceSection} - ${p.category?.name || "Uncategorized"}`
    }).join("\n")
  }

  /**
   * Get active services formatted for prompt
   * @param customerIsActive If false, hides prices (Feature 174 - Rule #4)
   */
  private async getActiveServices(
    workspaceId: string,
    customerIsActive: boolean = true
  ): Promise<string> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { currency: true },
    })
    const currencySymbol = getCurrencySymbol(workspace?.currency || "USD")

    const services = await this.prisma.services.findMany({
      where: { workspaceId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        price: true,
        description: true,
      },
      take: 50,
    })

    if (services.length === 0) return "No services available."

    return services.map(s => {
      // 🔒 Feature 174: Hide prices for non-registered customers (Rule #4)
      if (customerIsActive) {
        return `- ${s.name} (${s.code}): ${currencySymbol}${Number(s.price).toFixed(2)}`
      } else {
        return `- ${s.name} (${s.code}): 💳 Registrati per vedere i prezzi: [LINK_REGISTRATION]`
      }
    }).join("\n")
  }

  /**
   * Get active categories formatted for prompt
   */
  private async getActiveCategories(workspaceId: string): Promise<string> {
    const categories = await this.prisma.categories.findMany({
      where: { workspaceId, isActive: true },
      select: { name: true },
    })

    if (categories.length === 0) return "No categories."

    return categories.map(c => `- ${c.name}`).join("\n")
  }

  /**
   * Get active offers formatted for prompt
   */
  private async getActiveOffers(workspaceId: string): Promise<string> {
    const now = new Date()
    const offers = await this.prisma.offers.findMany({
      where: {
        workspaceId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        name: true,
        discountPercent: true,
        description: true,
      },
      take: 20,
    })

    if (offers.length === 0) return "No active offers."

    return offers.map(o => 
      `- ${o.name}: ${o.discountPercent}% off - ${o.description || ""}`
    ).join("\n")
  }

  /**
   * Get last order details for customer
   */
  private async getLastOrderDetails(workspaceId: string, customerId: string): Promise<string> {
    const order = await this.prisma.orders.findFirst({
      where: { customerId, workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { product: true },
        },
      },
    })

    if (!order) return "No previous orders."

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { currency: true },
    })
    const currencySymbol = getCurrencySymbol(workspace?.currency || "USD")

    const items = order.items.map(i => 
      `- ${i.product?.name || "Item"} x${i.quantity}: ${currencySymbol}${Number(i.unitPrice).toFixed(2)}`
    ).join("\n")

    return `Order: ${order.orderCode}
Date: ${order.createdAt.toLocaleDateString()}
Status: ${order.status}
Total: ${currencySymbol}${Number(order.totalAmount).toFixed(2)}
Items:
${items}`
  }

  /**
   * Convert language code to display name
   */
  private getLanguageDisplayName(code: string): string {
    const map: Record<string, string> = {
      it: "Italian",
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      pt: "Portuguese",
      ITA: "Italian",
      ENG: "English",
      SPA: "Spanish",
      FRA: "French",
      DEU: "German",
      POR: "Portuguese",
    }
    return map[code] || code
  }

  /**
   * Get active FAQs formatted for prompt
   * Used by Router to answer FAQ questions directly
   */
  private async getActiveFaqs(workspaceId: string): Promise<string> {
    const faqs = await this.prisma.fAQ.findMany({
      where: { workspaceId, isActive: true },
      select: {
        question: true,
        answer: true,
      },
      take: 50, // Limit to avoid huge prompts
    })

    if (faqs.length === 0) {
      return [
        "Q: What is BellItalia? A: BellItalia is our premium Italian gourmet importer specializing in food, beverages, and logistics.",
        "Q: How does shipping work? A: We handle ambient, refrigerated and frozen shipments with temperature monitoring and express delivery.",
        "Q: Can I speak with a human operator? A: Yes, just ask for human support and one of our consultants will respond within minutes."
      ].join("\n\n")
    }

    return faqs.map(f => 
      `Q: ${f.question}\nA: ${f.answer}`
    ).join("\n\n")
  }
}
