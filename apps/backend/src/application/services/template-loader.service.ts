/**
 * TemplateLoaderService - Lightweight On-Demand Template Loading
 * 
 * PERFORMANCE-OPTIMIZED: Only handles STEP 1 (RENDER conditionals)
 * Each agent handles STEP 2 (REPLACE variables) with its own optimized queries
 * 
 * Flow:
 * 1. Load template from file (CACHED in memory)
 * 2. Compile {{#if}} conditionals with workspace settings
 * 3. Return template ready for variable replacement
 * 
 * Performance:
 * - Template cache: O(1) lookup after first load
 * - Conditional compilation: O(n) where n = template length
 * - Total overhead: < 5ms per request
 */

import * as fs from "fs"
import * as path from "path"
import { PrismaClient } from "@echatbot/database"
import { TemplateEngineService } from "./prompt-builder/template-engine.service"
import logger from "../../utils/logger"

// Template file mapping by agent type
const TEMPLATE_FILES: Record<string, string> = {
  ROUTER: "01-router.template.md",
  PRODUCT_SEARCH: "02-product-search.template.md",
  CART_MANAGEMENT: "03-cart-management.template.md", // Dedicated template with {{products}}
  ORDER_TRACKING: "03-order-tracking.template.md",
  CUSTOMER_SUPPORT: "04-customer-support.template.md",
  PROFILE_MANAGEMENT: "05-profile-management.template.md",
  SECURITY: "06-security.template.md",
  TRANSLATION: "07-translation.template.md",
  SUMMARY_AGENT: "08-summary.template.md",
  PRODUCT_CONTEXT: "09-product-context.template.md",
}

// Shared agents (always from root templates)
const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT"]

// Template cache - lives for entire server lifetime
const templateCache = new Map<string, string>()

// Workspace settings cache - short TTL for freshness
const workspaceCache = new Map<string, { settings: WorkspaceSettings; timestamp: number }>()
const WORKSPACE_CACHE_TTL_MS = 30000 // 30 seconds

interface WorkspaceSettings {
  sellsProductsAndServices: boolean
  hasHumanSupport: boolean
  hasSalesAgents: boolean
  hasSuppliers: boolean
  address: string // 🆕 Physical address for {{#if address}} conditional
}

export class TemplateLoaderService {
  private static instance: TemplateLoaderService
  private templateEngine: TemplateEngineService
  private prisma: PrismaClient

  private constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.templateEngine = new TemplateEngineService()
  }

  /**
   * Singleton instance for maximum cache efficiency
   */
  static getInstance(prisma: PrismaClient): TemplateLoaderService {
    if (!TemplateLoaderService.instance) {
      TemplateLoaderService.instance = new TemplateLoaderService(prisma)
    }
    return TemplateLoaderService.instance
  }

  /**
   * Load and render template with conditionals compiled
   * 
   * @param agentType - Agent type (ROUTER, PRODUCT_SEARCH, etc.)
   * @param workspaceId - Workspace ID for settings lookup
   * @returns Template with {{#if}} resolved, {{variables}} intact
   * 
   * Performance: < 5ms (cached template + cached workspace settings)
   */
  async loadAndRenderTemplate(agentType: string, workspaceId: string): Promise<string> {
    const startTime = performance.now()

    try {
      // 1. Get workspace settings (cached)
      const settings = await this.getWorkspaceSettings(workspaceId)

      // 2. Load template (cached)
      const template = this.loadTemplate(agentType, settings.sellsProductsAndServices)

      // 3. Process conditionals (pure CPU, no I/O)
      const rendered = this.templateEngine.process(template, settings)

      const elapsed = performance.now() - startTime
      logger.debug(`⚡ Template loaded in ${elapsed.toFixed(2)}ms`, { agentType, chars: rendered.length })

      return rendered
    } catch (error) {
      logger.error(`❌ Failed to load template for ${agentType}:`, error)
      throw error
    }
  }

  /**
   * Load template from file (cached in memory - DISABLED IN DEVELOPMENT)
   */
  private loadTemplate(agentType: string, isEcommerce: boolean): string {
    const templateFile = TEMPLATE_FILES[agentType]
    if (!templateFile) {
      throw new Error(`Unknown agent type: ${agentType}`)
    }

    // Determine folder
    let folder: string
    if (SHARED_AGENTS.includes(agentType)) {
      folder = "" // Root templates
    } else if (isEcommerce) {
      folder = "ecommerce"
    } else {
      folder = "informational"
    }

    const cacheKey = `${folder}/${templateFile}`

    // 🔧 DEVELOPMENT: Always reload from disk (no cache)
    const isDevelopment = process.env.NODE_ENV === "development"

    // Cache hit - instant return (SKIP IN DEVELOPMENT)
    if (!isDevelopment && templateCache.has(cacheKey)) {
      return templateCache.get(cacheKey)!
    }

    // Load from disk
    const templatePath = folder
      ? path.join(__dirname, "..", "..", "templates", folder, templateFile)
      : path.join(__dirname, "..", "..", "templates", templateFile)

    try {
      const content = fs.readFileSync(templatePath, "utf-8")
      
      // Only cache in production
      if (!isDevelopment) {
        templateCache.set(cacheKey, content)
        logger.info(`📂 Template cached: ${cacheKey}`)
      } else {
        logger.debug(`📂 Template loaded (no cache in dev): ${cacheKey}`)
      }
      
      return content
    } catch (error) {
      // Fallback for informational: try ecommerce version
      if (folder === "informational") {
        const fallbackPath = path.join(__dirname, "..", "..", "templates", "ecommerce", templateFile)
        try {
          const content = fs.readFileSync(fallbackPath, "utf-8")
          
          // Only cache in production
          if (!isDevelopment) {
            templateCache.set(cacheKey, content)
          }
          
          logger.warn(`⚠️ Using ecommerce fallback for: ${templateFile}`)
          return content
        } catch {
          // Fall through to original error
        }
      }
      throw new Error(`Template not found: ${templatePath}`)
    }
  }

  /**
   * Get workspace settings (cached with short TTL)
   */
  private async getWorkspaceSettings(workspaceId: string): Promise<WorkspaceSettings> {
    const now = Date.now()
    const cached = workspaceCache.get(workspaceId)

    // Cache hit and still fresh
    if (cached && (now - cached.timestamp) < WORKSPACE_CACHE_TTL_MS) {
      return cached.settings
    }

    // Cache miss or stale - fetch from DB
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        sellsProductsAndServices: true,
        hasHumanSupport: true,
        hasSalesAgents: true,
        hasSuppliers: true,
        address: true, // 🆕 For {{#if address}} conditional in templates
      },
    })

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    const settings: WorkspaceSettings = {
      sellsProductsAndServices: workspace.sellsProductsAndServices ?? true,
      hasHumanSupport: workspace.hasHumanSupport ?? false,
      hasSalesAgents: workspace.hasSalesAgents ?? false,
      hasSuppliers: workspace.hasSuppliers ?? false,
      address: workspace.address || "", // 🆕 Physical address for location questions
    }

    workspaceCache.set(workspaceId, { settings, timestamp: now })
    return settings
  }

  /**
   * Clear all caches (for testing)
   */
  static clearCaches(): void {
    templateCache.clear()
    workspaceCache.clear()
    logger.info("🗑️ Template and workspace caches cleared")
  }

  /**
   * Invalidate workspace cache (call after workspace settings update)
   */
  static invalidateWorkspace(workspaceId: string): void {
    workspaceCache.delete(workspaceId)
    logger.debug(`🔄 Workspace cache invalidated: ${workspaceId}`)
  }
}
