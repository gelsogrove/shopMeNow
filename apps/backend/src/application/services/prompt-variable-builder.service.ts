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

import { PrismaClient } from "@echatbot/database"
import { 
  PromptVariables, 
  VARIABLE_DEFAULTS, 
  REQUIRED_VARIABLES,
  LARGE_VARIABLES 
} from "../../types/prompt-variables.types"
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
}

/**
 * Optional context data
 */
interface ContextInput {
  lastOrderCode?: string
  cartContents?: string
  channelName?: string
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
      customerName: customer?.name || VARIABLE_DEFAULTS.customerName!,
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
      
      // Context variables
      lastOrderCode: context?.lastOrderCode,
      cartContents: context?.cartContents,
      tokenDuration: this.formatTokenDuration(process.env.TOKEN_EXPIRATION || '1h'),
      
      // Dynamic content (only if included)
      ...(options?.includeDynamicContent !== false && dynamicContent ? {
        products: dynamicContent.products,
        categories: dynamicContent.categories,
        services: dynamicContent.services,
        offers: dynamicContent.offers,
        faqs: dynamicContent.faqs,
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
}
