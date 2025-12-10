/**
 * TemplateLoaderService - Load prompt templates from filesystem
 *
 * Single Responsibility: Load template files for each agent type.
 * Templates are organized by workspace type:
 *   - shared/     → Templates used by ALL workspace types (Security, Translation, Summary)
 *   - ecommerce/  → Templates for e-commerce workspaces (sell products/services)
 *   - informational/ → Templates for info-only workspaces (no sales)
 *
 * @architecture Part of PromptBuilder system
 */

import { AgentType } from "@echatbot/database"
import * as fs from "fs"
import * as path from "path"
import logger from "../../../utils/logger"

// Agent types that are SHARED across all workspace types
const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT"]

// Agent types available ONLY for e-commerce workspaces
const ECOMMERCE_ONLY_AGENTS = ["PRODUCT_SEARCH", "ORDER_TRACKING"]

// Map agent types to template file names
const TEMPLATE_FILES: Record<string, string> = {
  // Shared agents
  SECURITY: "06-security.template.md",
  TRANSLATION: "07-translation.template.md",
  SUMMARY_AGENT: "08-summary.template.md",
  // Workspace-specific agents
  ROUTER: "01-router.template.md",
  PRODUCT_SEARCH: "02-product-search.template.md",
  ORDER_TRACKING: "03-order-tracking.template.md",
  CUSTOMER_SUPPORT: "04-customer-support.template.md",
  PROFILE_MANAGEMENT: "05-profile-management.template.md",
}

export class TemplateLoaderService {
  private templatesDir: string
  private cache: Map<string, string> = new Map()

  constructor() {
    // Templates are in src/templates/ directory (up 3 levels from prompt-builder folder)
    this.templatesDir = path.join(__dirname, "..", "..", "..", "templates")
    logger.info(`✅ TemplateLoaderService initialized (dir: ${this.templatesDir})`)
  }

  /**
   * Load template for a specific agent type
   *
   * @param agentType - The agent type (ROUTER, PRODUCT_SEARCH, etc.)
   * @param hasEcommerce - Whether this workspace sells products/services
   * @returns Template content as string
   */
  async load(agentType: AgentType | string, hasEcommerce: boolean = true): Promise<string> {
    const typeKey = String(agentType)
    const cacheKey = `${typeKey}:${hasEcommerce ? "ecommerce" : "informational"}`

    // Check cache first
    if (this.cache.has(cacheKey)) {
      logger.debug(`📋 Template cache hit for ${cacheKey}`)
      return this.cache.get(cacheKey)!
    }

    // Validate agent type for informational workspaces
    if (!hasEcommerce && ECOMMERCE_ONLY_AGENTS.includes(typeKey)) {
      throw new Error(`Agent type ${typeKey} is not available for informational workspaces`)
    }

    // Get template file name
    const templateFile = TEMPLATE_FILES[typeKey]
    if (!templateFile) {
      throw new Error(`No template defined for agent type: ${typeKey}`)
    }

    // Determine subdirectory based on agent type and workspace type
    const subDir = this.getTemplateSubDir(typeKey, hasEcommerce)
    
    // Build full path
    const templatePath = path.join(this.templatesDir, subDir, templateFile)

    // Check if file exists
    if (!fs.existsSync(templatePath)) {
      // Fallback to root templates folder for backward compatibility
      const fallbackPath = path.join(this.templatesDir, templateFile)
      if (fs.existsSync(fallbackPath)) {
        logger.warn(`⚠️ Using fallback template for ${typeKey} (not in ${subDir}/)`)
        const content = fs.readFileSync(fallbackPath, "utf-8")
        this.cache.set(cacheKey, content)
        return content
      }
      throw new Error(`Template file not found: ${templatePath}`)
    }

    // Read template content
    const content = fs.readFileSync(templatePath, "utf-8")

    // Cache it
    this.cache.set(cacheKey, content)

    logger.info(`📄 Loaded template for ${typeKey} from ${subDir}/ (${content.length} chars)`)

    return content
  }

  /**
   * Determine which subdirectory to load template from
   */
  private getTemplateSubDir(agentType: string, hasEcommerce: boolean): string {
    // Shared agents always from shared/
    if (SHARED_AGENTS.includes(agentType)) {
      return "shared"
    }
    
    // E-commerce agents always from ecommerce/
    if (ECOMMERCE_ONLY_AGENTS.includes(agentType)) {
      return "ecommerce"
    }
    
    // Other agents depend on workspace type
    return hasEcommerce ? "ecommerce" : "informational"
  }

  /**
   * Get list of available agent types for a workspace type
   */
  getAvailableTypes(hasEcommerce: boolean = true): string[] {
    if (hasEcommerce) {
      return Object.keys(TEMPLATE_FILES)
    }
    // Informational workspaces don't have e-commerce agents
    return Object.keys(TEMPLATE_FILES).filter(
      type => !ECOMMERCE_ONLY_AGENTS.includes(type)
    )
  }

  /**
   * Clear template cache (useful for development/testing)
   */
  clearCache(): void {
    this.cache.clear()
    logger.info("🗑️ Template cache cleared")
  }

  /**
   * Reload all templates (useful for hot-reload during development)
   */
  async reloadAll(hasEcommerce: boolean = true): Promise<void> {
    this.clearCache()
    for (const agentType of this.getAvailableTypes(hasEcommerce)) {
      await this.load(agentType as AgentType, hasEcommerce)
    }
    logger.info("🔄 All templates reloaded")
  }
}
