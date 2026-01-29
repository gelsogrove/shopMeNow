/**
 * PromptVariableBuilder - Centralized Variable Construction
 * 
 * SINGLE POINT where all prompt variables are constructed.
 * 
 * RULES:
 * 1. Router calls build() ONCE at the start of message processing
 * 2. The result is passed to ALL sub-agents via context.promptVariables
 * 3. Sub-agents NEVER query DB for this data - they use what Router provides
 * 4. preProcessPrompt() receives this object and does ONLY string replacement
 * 
 * BENEFITS:
 * - Single DB query for all variables (no N+1)
 * - Consistent variable names across all agents
 * - Easy to test and debug
 * - Clear contract between Router and sub-agents
 * 
 * @see PromptVariables for variable definitions
 * @see preProcessPrompt() for substitution logic
 */

import { PrismaClient, Products } from "@echatbot/database"
import {
  PromptVariables,
  VARIABLE_DEFAULTS,
  REQUIRED_VARIABLES,
  LARGE_VARIABLES
} from "../../types/prompt-variables.types"
import { SmartPromptBuilder } from "../../services/smart-prompt-builder.service"
import logger from "../../utils/logger"

/**
 * Customer data from database (with sales agent relation)
 */
interface CustomerInput {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  discount?: number | null
  isActive?: boolean | null // 🔒 Feature 174: Registration status
  language?: string | null
  company?: string | null
  push_notifications_consent?: boolean | null
  sales?: {
    firstName?: string | null
    lastName?: string | null
    phone?: string | null
    email?: string | null
  } | null
}

/**
 * Workspace data from database
 */
interface WorkspaceInput {
  id: string
  name?: string | null
  url?: string | null
  language?: string | null
  toneOfVoice?: string | null
  botIdentityResponse?: string | null
  hasHumanSupport?: boolean | null
  humanSupportInstructions?: string | null
  operatorContactMethod?: string | null
  operatorWhatsappNumber?: string | null
  hasSalesAgents?: boolean | null
  notificationEmail?: string | null
  allowedExternalLinks?: string[] | null
  sellsProductsAndServices?: boolean | null
  address?: string | null
  customAiRules?: string | null
  chatbotName?: string | null
  businessType?: string | null
  websiteUrl?: string | null
}

/**
 * Dynamic content (products, categories, etc.)
 * Loaded separately because it can be large
 */
interface DynamicContentInput {
  products?: string
  categories?: string
  services?: string
  offers?: string
  faqs?: string
  productsWithDetails?: string
  featuredProducts?: string
  productCharacteristics?: string
  productsByCategory?: string
}

/**
 * Optional context data
 */
interface ContextInput {
  lastOrderCode?: string
  cartContents?: string
  channelName?: string
  /** 🚫 WIDGET FIX: Channel type (widget vs whatsapp) */
  channel?: string
}

/**
 * Build options for customization
 */
interface BuildOptions {
  /** Skip validation (for testing) */
  skipValidation?: boolean
  /** Include large variables (products, categories) */
  includeDynamicContent?: boolean
}

/**
 * Validation result
 */
interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * PromptVariableBuilder - Centralized Variable Construction
 */
export class PromptVariableBuilder {

  /**
   * Build all prompt variables from input data
   * 
   * @param customer - Customer data from database
   * @param workspace - Workspace data from database
   * @param dynamicContent - Optional products/categories/etc.
   * @param context - Optional context (lastOrderCode, etc.)
   * @param options - Build options
   * @returns Complete PromptVariables object
   * 
   * @example
   * const variables = PromptVariableBuilder.build(customer, workspace, { products, categories })
   * const processedPrompt = await preProcessPrompt(template, variables)
   */
  static build(
    customer: CustomerInput | null,
    workspace: WorkspaceInput | null,
    dynamicContent?: DynamicContentInput,
    context?: ContextInput,
    options?: BuildOptions
  ): PromptVariables {

    // Start with defaults
    const variables: PromptVariables = {
      // Customer variables
      // 🚫 WIDGET FIX: Remove name from greetings ONLY for widget channel
      // Widget visitors are anonymous/temporary, so no personalized greetings
      // WhatsApp customers keep their names regardless (even if they start with "Visitor")
      customerName: context?.channel === 'widget'
        ? '' // Widget: no name in greetings
        : (customer?.name || VARIABLE_DEFAULTS.customerName!),
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      customerDiscount: customer?.discount || 0,
      customerIsActive: customer?.isActive ?? false, // 🔒 Feature 174: Registration status for price visibility
      languageUser: this.getLanguageDisplayName(customer?.language || workspace?.language || 'it'),
      pushNotificationsConsent: customer?.push_notifications_consent ?? undefined,

      // Sales agent variables
      agentName: customer?.sales
        ? `${customer.sales.firstName || ''} ${customer.sales.lastName || ''}`.trim() || VARIABLE_DEFAULTS.agentName!
        : VARIABLE_DEFAULTS.agentName!,
      agentPhone: customer?.sales?.phone || VARIABLE_DEFAULTS.agentPhone!,
      agentEmail: customer?.sales?.email || VARIABLE_DEFAULTS.agentEmail!,

      // Workspace variables
      companyName: workspace?.name || customer?.company || VARIABLE_DEFAULTS.companyName!,
      botIdentityResponse: workspace?.botIdentityResponse || '',
      customAiRules: workspace?.customAiRules || '',
      address: workspace?.address || '',
      adminEmail: workspace?.notificationEmail || '', // 🆕 For support/escalation links
      channelName: context?.channelName || VARIABLE_DEFAULTS.channelName!,
      workspaceUrl: workspace?.url || '',
      toneOfVoice: workspace?.toneOfVoice || VARIABLE_DEFAULTS.toneOfVoice!,
      hasHumanSupport: workspace?.hasHumanSupport ?? VARIABLE_DEFAULTS.hasHumanSupport!,
      humanSupportInstructions: workspace?.humanSupportInstructions || '',
      hasSalesAgents: workspace?.hasSalesAgents ?? VARIABLE_DEFAULTS.hasSalesAgents!,
      sellsProductsAndServices: workspace?.sellsProductsAndServices ?? VARIABLE_DEFAULTS.sellsProductsAndServices!,
      allowedExternalLinks: workspace?.allowedExternalLinks?.join('\n') || '',
      chatbotName: workspace?.chatbotName || VARIABLE_DEFAULTS.chatbotName!,
      businessType: workspace?.businessType || VARIABLE_DEFAULTS.businessType!,
      operatorContactMethod: workspace?.operatorContactMethod || VARIABLE_DEFAULTS.operatorContactMethod!,
      operatorWhatsappNumber: workspace?.operatorWhatsappNumber || VARIABLE_DEFAULTS.operatorWhatsappNumber!,
      websiteUrl: workspace?.websiteUrl || workspace?.url || VARIABLE_DEFAULTS.websiteUrl!,
      supportEmail: workspace?.notificationEmail || VARIABLE_DEFAULTS.supportEmail!,

      // Context variables
      lastOrderCode: context?.lastOrderCode,
      cartContents: context?.cartContents,
      tokenDuration: this.formatTokenDuration(process.env.TOKEN_EXPIRATION || '1h'),
      channel: context?.channel || VARIABLE_DEFAULTS.channel,

      // Dynamic content (only if included)
      ...(options?.includeDynamicContent !== false && dynamicContent ? {
        products: dynamicContent.products,
        categories: dynamicContent.categories,
        services: dynamicContent.services,
        offers: dynamicContent.offers,
        faqs: dynamicContent.faqs,
        // 🆕 New enhanced variables
        productsWithDetails: dynamicContent.productsWithDetails,
        featuredProducts: dynamicContent.featuredProducts,
        productCharacteristics: dynamicContent.productCharacteristics,
        productsByCategory: dynamicContent.productsByCategory,
      } : {}),
    }

    // Validate unless skipped
    if (!options?.skipValidation) {
      const validation = this.validate(variables)

      if (validation.errors.length > 0) {
        logger.error('❌ PromptVariableBuilder validation errors:', validation.errors)
      }

      if (validation.warnings.length > 0) {
        logger.warn('⚠️ PromptVariableBuilder validation warnings:', validation.warnings)
      }
    }

    // Log what we built
    logger.info('📦 PromptVariableBuilder.build() completed:', {
      companyName: variables.companyName,
      customerName: variables.customerName,
      hasBotIdentity: !!variables.botIdentityResponse,
      hasProducts: !!variables.products,
      hasCategories: !!variables.categories,
    })

    return variables
  }

  /**
   * Validate prompt variables
   * 
   * @param variables - Variables to validate
   * @returns Validation result with errors and warnings
   */
  static validate(variables: PromptVariables): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Check required variables
    for (const key of REQUIRED_VARIABLES) {
      const value = variables[key]
      if (value === undefined || value === null || value === '') {
        errors.push(`Required variable '${key}' is empty or missing`)
      }
    }

    // Check large variables for excessive size
    for (const key of LARGE_VARIABLES) {
      const value = variables[key]
      if (value && typeof value === 'string') {
        const estimatedTokens = this.estimateTokenCount(value)
        if (estimatedTokens > 50000) {
          warnings.push(`Variable '${key}' has ${estimatedTokens} estimated tokens (>50k)`)
        }
      }
    }

    // Check for empty company name (critical)
    if (!variables.companyName) {
      errors.push('companyName is empty - this will show {{companyName}} in prompts!')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Build variables directly from Prisma queries
   * 
   * Convenience method that loads all data from database.
   * Use this when you don't have the data pre-loaded.
   * 
   * @param prisma - Prisma client
   * @param workspaceId - Workspace ID
   * @param customerId - Customer ID
   * @returns Complete PromptVariables
   */
  static async buildFromDatabase(
    prisma: PrismaClient,
    workspaceId: string,
    customerId: string
  ): Promise<PromptVariables> {

    // Load customer with sales agent
    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      include: {
        sales: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    })

    // Load workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        url: true,
        language: true,
        toneOfVoice: true,
        botIdentityResponse: true,
        hasHumanSupport: true,
        humanSupportInstructions: true,
        operatorContactMethod: true,
        operatorWhatsappNumber: true,
        hasSalesAgents: true,
        notificationEmail: true,
        allowedExternalLinks: true,
        sellsProductsAndServices: true,
        address: true,
        customAiRules: true,
        chatbotName: true,
        businessType: true,
        websiteUrl: true,
      },
    })

    // Load last order
    const lastOrder = await prisma.orders.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { orderCode: true },
    })

    return this.build(
      customer,
      workspace,
      undefined, // Dynamic content loaded separately
      { lastOrderCode: lastOrder?.orderCode || undefined }
    )
  }

  /**
   * Convert language code to display name
   * 
   * @param langCode - ISO language code (it, en, es, pt)
   * @returns Display name (ITALIANO, ENGLISH, etc.)
   */
  private static getLanguageDisplayName(langCode: string | null | undefined): string {
    const languageMap: Record<string, string> = {
      'it': 'ITALIANO',
      'en': 'ENGLISH',
      'es': 'ESPAÑOL',
      'pt': 'PORTUGUÊS',
      'ITALIAN': 'ITALIANO',
      'ITALIANO': 'ITALIANO',
      'ENGLISH': 'ENGLISH',
      'SPANISH': 'ESPAÑOL',
      'ESPAÑOL': 'ESPAÑOL',
      'PORTUGUESE': 'PORTUGUÊS',
      'PORTUGUÊS': 'PORTUGUÊS',
    }

    return languageMap[langCode?.toUpperCase() || 'IT'] || 'ITALIANO'
  }

  /**
   * Format token duration for display
   * 
   * @param duration - Duration string (e.g., '15m', '1h', '2h')
   * @returns Human readable string
   */
  private static formatTokenDuration(duration: string): string {
    const match = duration.match(/^(\d+)([mh])$/)
    if (!match) return '15 minutes'

    const value = parseInt(match[1], 10)
    const unit = match[2]

    if (unit === 'm') {
      return value === 1 ? '1 minute' : `${value} minutes`
    } else {
      return value === 1 ? '1 hour' : `${value} hours`
    }
  }

  /**
   * Estimate token count (rough approximation)
   * 
   * @param text - Text to estimate
   * @returns Estimated token count
   */
  private static estimateTokenCount(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English, 2-3 for other languages
    return Math.ceil(text.length / 3.5)
  }

  /**
   * Merge partial variables with existing ones
   * 
   * Used when sub-agents need to add agent-specific variables.
   * 
   * @param base - Base variables from Router
   * @param additions - Additional variables to merge
   * @returns Merged variables
   */
  static merge(
    base: PromptVariables,
    additions: Partial<PromptVariables>
  ): PromptVariables {
    return {
      ...base,
      ...additions,
    }
  }

  /**
   * Extract only the variables needed for a specific template
   * 
   * Useful for debugging - shows which variables a template needs.
   * 
   * @param template - Template string with {{variables}}
   * @returns Array of variable names found in template
   */
  static extractRequiredVariables(template: string): string[] {
    const matches = template.match(/\{\{([^}#/]+)\}\}/g) || []
    const variables = matches.map(m => m.replace(/\{\{|\}\}/g, '').trim())
    return [...new Set(variables)] // Remove duplicates
  }

  /**
   * 🆕 Build optimized product list using SmartPromptBuilder
   * 
   * This method uses:
   * - Intent analysis from user message
   * - Priority loading (featured → category → keyword → others)
   * - Selective characteristics (only essentials)
   * - Token optimization (-70% vs naive approach)
   * 
   * @param workspaceId - Workspace ID
   * @param userMessage - Current user message (for intent analysis)
   * @param businessType - Business type from workspace
   * @param maxTokens - Maximum tokens to allocate (default: 8000)
   * @returns Optimized product list string
   * 
   * @example
   * const products = await PromptVariableBuilder.buildOptimizedProducts(
   *   workspaceId, 
   *   "dammi un piso de 40mq zona centro",
   *   "real_estate"
   * )
   * // Returns: "• Appartamento Via Roma - €180k (42mq, 2loc, centro, 3°piano)\n..."
   */
  static async buildOptimizedProducts(
    workspaceId: string,
    userMessage: string = '',
    businessType: string = 'default',
    maxTokens: number = 8000
  ): Promise<string> {

    try {
      const result = await SmartPromptBuilder.buildOptimizedProductList(
        workspaceId,
        userMessage,
        businessType,
        maxTokens
      )

      logger.info('✅ PromptVariableBuilder.buildOptimizedProducts', {
        productsIncluded: result.productsIncluded,
        tokenCount: result.tokenCount,
        efficiency: `${((result.tokenCount / maxTokens) * 100).toFixed(1)}%`,
        cacheHit: result.cacheHit
      })

      return result.products

    } catch (error) {
      logger.error('❌ PromptVariableBuilder.buildOptimizedProducts failed', error)
      return '' // Graceful fallback
    }
  }

  /**
   * 🆕 Build products grouped by category
   * 
   * Returns products organized by categories with selective characteristics.
   * Useful for {{productsByCategory}} variable in prompts.
   * 
   * @param workspaceId - Workspace ID
   * @param businessType - Business type for characteristic filtering
   * @returns Formatted string with products grouped by category
   * 
   * @example
   * const byCategory = await PromptVariableBuilder.buildProductsByCategory(workspaceId, "real_estate")
   * // Returns:
   * // 🏷️ **Immobili Residenziali** (12 prodotti):
   * //   • Appartamento Via Roma - €180k (42mq, 2loc, centro)
   * //   • Bilocale Duomo - €195k (38mq, 2loc, centro)
   */
  static async buildProductsByCategory(
    workspaceId: string,
    businessType: string = 'default'
  ): Promise<string> {

    try {
      return await SmartPromptBuilder.buildProductsByCategory(workspaceId, businessType)
    } catch (error) {
      logger.error('❌ PromptVariableBuilder.buildProductsByCategory failed', error)
      return ''
    }
  }

  /**
   * 🆕 Build list of available product characteristics
   * 
   * Returns all unique characteristics used in workspace products.
   * Useful for {{productCharacteristics}} variable in prompts.
   * 
   * @param workspaceId - Workspace ID
   * @returns Formatted string with available characteristics
   * 
   * @example
   * const characteristics = await PromptVariableBuilder.buildProductCharacteristics(workspaceId)
   * // Returns:
   * // 🔍 superficie: 42mq, 38mq, 120mq (+15 altri)
   * // 🔍 locali: 2n., 3n., 4n.
   * // 🔍 zona: centro, periferia, mare
   */
  static async buildProductCharacteristics(
    workspaceId: string
  ): Promise<string> {

    try {
      return await SmartPromptBuilder.buildProductCharacteristics(workspaceId)
    } catch (error) {
      logger.error('❌ PromptVariableBuilder.buildProductCharacteristics failed', error)
      return ''
    }
  }

  /**
   * 🆕 Build complete dynamic content with optimized products
   * 
   * Replacement for the old approach of loading all products naively.
   * Uses SmartPromptBuilder for intelligent product loading.
   * 
   * @param prisma - Prisma client
   * @param workspaceId - Workspace ID
   * @param userMessage - Current user message (for intent analysis)
   * @param businessType - Business type from workspace
   * @returns DynamicContentInput with optimized product list
   */
  static async buildDynamicContentOptimized(
    prisma: PrismaClient,
    workspaceId: string,
    userMessage: string = '',
    businessType: string = 'default'
  ): Promise<DynamicContentInput> {

    try {
      // Use SmartPromptBuilder for products (optimized)
      const products = await this.buildOptimizedProducts(
        workspaceId,
        userMessage,
        businessType
      )

      // Products grouped by category
      const productsByCategory = await this.buildProductsByCategory(
        workspaceId,
        businessType
      )

      // Available characteristics
      const productCharacteristics = await this.buildProductCharacteristics(
        workspaceId
      )

      // Load other dynamic content (categories, services, offers, FAQs)
      const [categories, services, offers, faqs] = await Promise.all([
        this.loadCategories(prisma, workspaceId),
        this.loadServices(prisma, workspaceId),
        this.loadOffers(prisma, workspaceId),
        this.loadFAQs(prisma, workspaceId)
      ])

      return {
        products,
        // 🆕 New variables for enhanced prompts
        productsByCategory,
        productCharacteristics,
        productsWithDetails: await this.buildProductsWithCharacteristics(prisma, workspaceId),
        featuredProducts: await this.buildFeaturedProducts(prisma, workspaceId),
        // Existing variables
        categories,
        services,
        offers,
        faqs
      }

    } catch (error) {
      logger.error('❌ PromptVariableBuilder.buildDynamicContentOptimized failed', error)
      return {}
    }
  }

  /**
   * 🆕 Build products with FULL details (characteristics, description)
   * 
   * Provides comprehensive product info for deep analysis/filtering by LLM.
   * Format includes: Name, Price, Category, Characteristics, Description, ID.
   * 
   * @param workspaceId - Workspace ID
   * @returns Detailed string representation of products
   */
  private static async buildProductsWithCharacteristics(prisma: PrismaClient, workspaceId: string): Promise<string> {
    const products: any[] = await prisma.products.findMany({
      where: { workspaceId, isActive: true },
      include: {
        characteristics: true,
        productCategories: { include: { category: true } }
      } as any,
      take: 100,
      orderBy: { createdAt: 'desc' }
    })

    return products.map(product => {
      const characteristics = product.characteristics
        .map((c: any) => `${c.name}: ${c.value}${c.unit ? ` ${c.unit}` : ''}`)
        .join(', ')

      const categories = product.productCategories
        .map((pc: any) => pc.category.name)
        .join(', ')

      return `
📦 **${product.name}**
💰 Prezzo: €${product.price.toLocaleString()}
📂 Categoria: ${categories || 'Non categorizzato'}
📋 Caratteristiche: ${characteristics || 'Nessuna caratteristica'}
📝 Descrizione: ${product.description?.substring(0, 200) || 'Nessuna descrizione'}
🆔 ID: ${product.id}
`.trim()
    }).join('\n\n')
  }

  /**
   * 🆕 Build featured products list
   */
  private static async buildFeaturedProducts(prisma: PrismaClient, workspaceId: string): Promise<string> {
    const products: any[] = await prisma.products.findMany({
      where: {
        workspaceId,
        isActive: true,
        OR: [
          { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }, // Ultimi 30 giorni
          { price: { gte: 1000 } } // Prodotti premium
        ]
      },
      include: { characteristics: true } as any,
      take: 20,
      orderBy: { price: 'desc' }
    })

    return products.map(product => {
      const keyCharacteristics = product.characteristics
        .filter((c: any) => ['superficie', 'taglia', 'peso', 'marca'].some(key =>
          c.name.toLowerCase().includes(key)
        ))
        .slice(0, 2)
        .map((c: any) => `${c.value}${c.unit || ''}`)
        .join(' ')

      return `⭐ ${product.name} - €${product.price.toLocaleString()} ${keyCharacteristics ? `(${keyCharacteristics})` : ''}`
    }).join('\n')
  }

  // --- Real Implementation Below ---


  /**
   * Load categories (existing method - kept for compatibility)
   */
  private static async loadCategories(prisma: PrismaClient, workspaceId: string): Promise<string> {
    const categories = await prisma.categories.findMany({
      where: { workspaceId, isActive: true },
      select: { name: true }
    })
    return categories.map(c => `• ${c.name}`).join('\n')
  }

  /**
   * Load services (existing method - kept for compatibility)
   */
  private static async loadServices(prisma: PrismaClient, workspaceId: string): Promise<string> {
    const services = await prisma.services.findMany({
      where: { workspaceId, isActive: true },
      select: { name: true, price: true }
    })
    return services.map(s => `• ${s.name} - €${s.price.toLocaleString()}`).join('\n')
  }

  /**
   * Load offers (existing method - kept for compatibility)
   */
  private static async loadOffers(prisma: PrismaClient, workspaceId: string): Promise<string> {
    const now = new Date()
    const offers = await prisma.offers.findMany({
      where: {
        workspaceId,
        startDate: { lte: now },
        endDate: { gte: now }
      },
      select: { name: true, description: true, discountPercent: true }
    })
    return offers.map(o =>
      `• ${o.name}${o.discountPercent ? ` (-${o.discountPercent}%)` : ''}${o.description ? `: ${o.description}` : ''}`
    ).join('\n')
  }

  /**
   * Load FAQs (existing method - kept for compatibility)
   */
  private static async loadFAQs(prisma: PrismaClient, workspaceId: string): Promise<string> {
    const faqs = await prisma.fAQ.findMany({
      where: { workspaceId, isActive: true },
      select: { question: true, answer: true },
      take: 20
    })
    return faqs.map(faq => `Q: ${faq.question}\nA: ${faq.answer}`).join('\n\n')
  }
}
