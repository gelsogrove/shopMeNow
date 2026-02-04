/**
 * PromptRenderService - On-Demand Prompt Generation
 * 
 * This service handles the 2-step prompt generation:
 * STEP 1: RENDER - Compile {{#if}} conditionals with workspace settings
 * STEP 2: REPLACE - Substitute {{variables}} with runtime data
 * 
 * Templates are loaded from /apps/backend/src/templates/{ecommerce|informational}/
 * Prompts are generated FRESH at every LLM call (not stored in DB)
 */

import * as fs from "fs"
import * as path from "path"
import { PrismaClient } from "@echatbot/database"
import { TemplateEngineService } from "./prompt-builder/template-engine.service"
import { PromptProcessorService } from "../../services/prompt-processor.service"
import logger from "../../utils/logger"
import {
  TEMPLATE_FILES,
  SHARED_AGENTS,
  getTemplateFolder,
  getTemplateFilename,
} from "../../utils/template-path.helper"

// Template cache (invalidated on server restart)
const templateCache = new Map<string, string>()

export interface RenderContext {
  workspaceId: string
  customerId?: string
  sessionId?: string
  // Additional context for variable replacement
  additionalContext?: Record<string, any>
}

export class PromptRenderService {
  private templateEngine: TemplateEngineService
  private promptProcessor: PromptProcessorService
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.templateEngine = new TemplateEngineService()
    this.promptProcessor = new PromptProcessorService()
  }

  /**
   * Generate prompt on-demand for an agent
   * 
   * @param agentType - Type of agent (ROUTER, PRODUCT_SEARCH, etc.)
   * @param context - Render context with workspaceId, customerId, etc.
   * @returns Final prompt ready for LLM
   */
  async renderPrompt(agentType: string, context: RenderContext): Promise<string> {
    const startTime = Date.now()
    
    try {
      // 1. Load workspace settings (for conditionals)
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
      })

      if (!workspace) {
        throw new Error(`Workspace not found: ${context.workspaceId}`)
      }

      // 2. Load template from file (cached)
      const template = await this.loadTemplate(agentType, workspace.sellsProductsAndServices ?? true)

      // 3. STEP 1: RENDER - Process conditionals
      const conditionalValues = this.buildConditionalValues(workspace)
      const renderedTemplate = this.templateEngine.process(template, conditionalValues)

      // 4. STEP 2: REPLACE - Substitute variables
      const finalPrompt = await this.replaceVariables(renderedTemplate, context, workspace)

      const elapsed = Date.now() - startTime
      logger.debug(`📝 Prompt rendered for ${agentType} in ${elapsed}ms (${finalPrompt.length} chars)`)

      return finalPrompt
    } catch (error) {
      logger.error(`❌ Failed to render prompt for ${agentType}:`, error)
      throw error
    }
  }

  /**
   * Load template from file system (with caching)
   */
  private async loadTemplate(agentType: string, isEcommerce: boolean): Promise<string> {
    const templateFile = getTemplateFilename(agentType)
    const folder = getTemplateFolder(agentType, isEcommerce)

    const cacheKey = `${folder}/${templateFile}`

    // Check cache first
    if (templateCache.has(cacheKey)) {
      return templateCache.get(cacheKey)!
    }

    // Load from file
    const templatePath = path.join(__dirname, "..", "..", "templates", folder, templateFile)

    try {
      const content = fs.readFileSync(templatePath, "utf-8")
      templateCache.set(cacheKey, content)
      logger.debug(`📂 Loaded template: ${cacheKey}`)
      return content
    } catch (error) {
      // Fallback: try shared templates folder for non-existent informational templates
      if (folder === "informational") {
        const fallbackPath = path.join(__dirname, "..", "..", "templates", "ecommerce", templateFile)
        try {
          const content = fs.readFileSync(fallbackPath, "utf-8")
          templateCache.set(cacheKey, content)
          logger.warn(`⚠️ Used ecommerce fallback for informational template: ${templateFile}`)
          return content
        } catch {
          // Continue to throw original error
        }
      }
      throw new Error(`Template not found: ${templatePath}`)
    }
  }

  /**
   * Build conditional values from workspace settings
   */
  private buildConditionalValues(workspace: any): Record<string, any> {
    const allowedLinks = Array.isArray(workspace.allowedExternalLinks)
      ? workspace.allowedExternalLinks.join("\n")
      : ""
    const address = workspace.address || ""
    return {
      sellsProductsAndServices: workspace.sellsProductsAndServices ?? true,
      hasHumanSupport: workspace.hasHumanSupport ?? false,
      hasSalesAgents: workspace.hasSalesAgents ?? false,
      address,
      hasAddress: !!address,
      customAiRules: workspace.customAiRules || "",
      botIdentityResponse: workspace.botIdentityResponse || "",
      humanSupportInstructions: workspace.humanSupportInstructions || "",
      frustrationEscalationInstructions: workspace.frustrationEscalationInstructions || "",
      allowedExternalLinks: allowedLinks,
      operatorContactMethod: workspace.operatorContactMethod || "",
      operatorWhatsappNumber: workspace.operatorWhatsappNumber || "",
      supportEmail: workspace.notificationEmail || workspace.adminEmail || "",
      websiteUrl: workspace.websiteUrl || workspace.url || "",
    }
  }

  /**
   * Replace all variables in the rendered template
   */
  private async replaceVariables(
    template: string,
    context: RenderContext,
    workspace: any // Using any for workspace to avoid type issues
  ): Promise<string> {
    // If no customer context, just replace workspace variables
    if (!context.customerId) {
      return this.replaceWorkspaceVariables(template, workspace)
    }

    // Get customer data
    const customer = await this.prisma.customers.findUnique({
      where: { id: context.customerId },
    })

    if (!customer) {
      logger.warn(`Customer not found: ${context.customerId}, using workspace-only replacement`)
      return this.replaceWorkspaceVariables(template, workspace)
    }

    // Get dynamic content (products, categories, etc.)
    const dynamicContent = await this.getDynamicContent(context.workspaceId)

    // Build workspace config for variable replacement
    const workspaceConfig = {
      sellsProductsAndServices: workspace.sellsProductsAndServices ?? true,
      toneOfVoice: workspace.toneOfVoice,
      botIdentityResponse: workspace.botIdentityResponse,
      hasHumanSupport: workspace.hasHumanSupport ?? false,
      humanSupportInstructions: workspace.humanSupportInstructions,
      operatorContactMethod: workspace.operatorContactMethod,
      operatorWhatsappNumber: workspace.operatorWhatsappNumber,
      hasSalesAgents: workspace.hasSalesAgents ?? false,
      adminEmail: workspace.adminEmail,
      supportEmail: workspace.notificationEmail || workspace.adminEmail,
      allowedExternalLinks: workspace.allowedExternalLinks,
      address: workspace.address,
      customAiRules: workspace.customAiRules,
      websiteUrl: workspace.websiteUrl || workspace.url,
    }

    // Use PromptProcessorService for full variable replacement
    try {
      const processedPrompt = await this.promptProcessor.preProcessPrompt(
        template,
        context.workspaceId,
        customer, // Pass full customer object
        dynamicContent,
        workspace.url,
        workspaceConfig
      )
      return processedPrompt
    } catch (error) {
      logger.error(`Error in variable replacement:`, error)
      // Fallback to workspace-only replacement
      return this.replaceWorkspaceVariables(template, workspace)
    }
  }

  /**
   * Get dynamic content (products, categories, FAQs, etc.)
   */
  private async getDynamicContent(workspaceId: string): Promise<{
    faqs: string
    products: string
    categories: string
    services: string
    offers: string
  }> {
    try {
      // Get FAQs
      const faqs = await this.prisma.fAQ.findMany({
        where: { workspaceId, isActive: true },
        orderBy: { order: "asc" },
      })
      const faqsText = faqs.length > 0 
        ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
        : "No FAQs available"

      // Get Products (use isActive filter - no soft delete on Products)
      const products = await this.prisma.products.findMany({
        where: { workspaceId, isActive: true },
        include: { category: true },
        orderBy: { name: "asc" },
      })
      const productsText = products.length > 0
        ? products.map(p => `- ${p.name}: ${p.description || ""} (${p.price}€)`).join("\n")
        : "No products available"

      // Get Categories (no soft delete on Categories)
      const categories = await this.prisma.categories.findMany({
        where: { workspaceId },
        orderBy: { name: "asc" },
      })
      const categoriesText = categories.length > 0
        ? categories.map(c => `- ${c.name}`).join("\n")
        : "No categories available"

      // Get Services (no soft delete on Services)  
      const services = await this.prisma.services.findMany({
        where: { workspaceId, isActive: true },
        orderBy: { name: "asc" },
      })
      const servicesText = services.length > 0
        ? services.map(s => `- ${s.name}: ${s.description || ""}`).join("\n")
        : "No services available"

      // Get Offers (check isActive and date range)
      const now = new Date()
      const offers = await this.prisma.offers.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        orderBy: { createdAt: "desc" },
      })
      // Filter valid offers by endDate
      const validOffers = offers.filter(o => {
        if (!o.endDate) return true
        return new Date(o.endDate) >= now
      })
      const offersText = validOffers.length > 0
        ? validOffers.map(o => `- ${o.name}: ${o.description || ""}`).join("\n")
        : "No active offers"

      return {
        faqs: faqsText,
        products: productsText,
        categories: categoriesText,
        services: servicesText,
        offers: offersText,
      }
    } catch (error) {
      logger.error(`Error getting dynamic content for workspace ${workspaceId}:`, error)
      return {
        faqs: "Error loading FAQs",
        products: "Error loading products",
        categories: "Error loading categories",
        services: "Error loading services",
        offers: "Error loading offers",
      }
    }
  }

  /**
   * Replace only workspace-level variables (when no customer context)
   */
  private replaceWorkspaceVariables(template: string, workspace: any): string {
    const companyName = workspace.companyName || workspace.name || ""
    return template
      .replace(/\{\{companyName\}\}/g, companyName)
      .replace(/\{\{workspaceName\}\}/g, workspace.name || "")
      .replace(/\{\{url\}\}/g, workspace.url || "")
      .replace(/\{\{address\}\}/g, workspace.address || "")
      .replace(/\{\{customAiRules\}\}/g, workspace.customAiRules || "")
      .replace(/\{\{botIdentityResponse\}\}/g, workspace.botIdentityResponse || "")
      .replace(/\{\{humanSupportInstructions\}\}/g, workspace.humanSupportInstructions || "")
  }

  /**
   * Clear template cache (for testing or hot reload)
   */
  static clearCache(): void {
    templateCache.clear()
    logger.info("🗑️ Template cache cleared")
  }

  /**
   * Check if an agent type is available for a workspace type
   */
  static isAgentAvailable(agentType: string, isEcommerce: boolean): boolean {
    if (SHARED_AGENTS.includes(agentType)) {
      return true
    }
    
    if (isEcommerce) {
      return ECOMMERCE_AGENTS.includes(agentType)
    }
    
    return INFORMATIONAL_AGENTS.includes(agentType)
  }
}
