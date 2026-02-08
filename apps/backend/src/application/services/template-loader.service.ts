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
import {
  ECOMMERCE_TEMPLATE_FILES,
  INFORMATIONAL_TEMPLATE_FILES,
  getTemplateFolder,
  getTemplateFilename,
} from "../../utils/template-path.helper"

// Template file mapping - now imported from centralized helper
// Shared agents list - now imported from centralized helper

// Template cache - lives for entire server lifetime
const templateCache = new Map<string, string>()

// Workspace settings cache - short TTL for freshness
const workspaceCache = new Map<string, { settings: WorkspaceSettings; timestamp: number }>()
const WORKSPACE_CACHE_TTL_MS = 30000 // 30 seconds

interface WorkspaceSettings {
  sellsProductsAndServices: boolean
  hasHumanSupport: boolean
  hasSalesAgents: boolean
  address: string // 🆕 Physical address for {{#if address}} conditional
  hasAddress: boolean
  botIdentityResponse: string
  chatbotName: string // 🆕 Bot name for {{#if chatbotName}} in IDENTITY
  companyName: string // 🆕 Company name for {{companyName}}
  toneOfVoice: string // 🆕 Tone of voice for {{toneOfVoice}}
  customAiRules: string
  allowedExternalLinks: string
  humanSupportInstructions: string
  frustrationEscalationInstructions: string
  operatorContactMethod: string
  operatorWhatsappNumber: string
  supportEmail: string
  websiteUrl: string
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
  async loadAndRenderTemplate(
    agentType: string,
    workspaceId: string,
    extraConditionals: Record<string, any> = {}
  ): Promise<string> {
    const startTime = performance.now()

    try {
      // 1. Get workspace settings (cached)
      const settings = await this.getWorkspaceSettings(workspaceId)

      // 2. Load template (cached)
      const template = this.loadTemplate(agentType, settings.sellsProductsAndServices)

      // 3. Process conditionals ONLY - keep {{variables}} intact for later replacement
      // 🔒 CRITICAL: Only pass boolean flags for {{#if}} conditionals
      // Do NOT pass string values like companyName, chatbotName - these must remain as {{variables}}
      const conditionalFlags = {
        // Boolean flags for conditionals
        sellsProductsAndServices: settings.sellsProductsAndServices,
        hasHumanSupport: settings.hasHumanSupport,
        hasSalesAgents: settings.hasSalesAgents,
        hasAddress: settings.hasAddress,
        // These determine if section should be included (truthy check for {{#if}})
        // but the actual values are NOT replaced - they stay as {{variable}}
        hasCustomAiRules: !!settings.customAiRules,
        hasBotIdentityResponse: !!settings.botIdentityResponse,
        hasChatbotName: !!settings.chatbotName,
        hasAllowedExternalLinks: !!settings.allowedExternalLinks,
        hasHumanSupportInstructions: !!settings.humanSupportInstructions,
        hasFrustrationEscalationInstructions: !!settings.frustrationEscalationInstructions,
        // 🆕 NEW: For template conditionals that use the variable name directly
        customAiRules: !!settings.customAiRules, // truthy for {{#if customAiRules}}
        botIdentityResponse: !!settings.botIdentityResponse, // truthy for {{#if botIdentityResponse}}
        chatbotName: !!settings.chatbotName, // truthy for {{#if chatbotName}}
        address: !!settings.address, // truthy for {{#if address}}
        allowedExternalLinks: !!settings.allowedExternalLinks, // truthy for {{#if allowedExternalLinks}}
        humanSupportInstructions: !!settings.humanSupportInstructions,
        frustrationEscalationInstructions: !!settings.frustrationEscalationInstructions,
        operatorContactMethod: !!settings.operatorContactMethod,
        operatorWhatsappNumber: !!settings.operatorWhatsappNumber,
        toneOfVoice: !!settings.toneOfVoice, // truthy for {{#if toneOfVoice}}
        ...extraConditionals,
      }

      const rendered = this.templateEngine.processConditionalsOnly(template, conditionalFlags)

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
    const templateFile = getTemplateFilename(agentType, isEcommerce)
    const folder = getTemplateFolder(isEcommerce)

    const cacheKey = `${folder}/${templateFile}`

    // 🔧 DEVELOPMENT: Always reload from disk (no cache)
    const isDevelopment = process.env.NODE_ENV === "development"

    // Cache hit - instant return (SKIP IN DEVELOPMENT)
    if (!isDevelopment && templateCache.has(cacheKey)) {
      return templateCache.get(cacheKey)!
    }

    // Load from disk
    const templatePath = path.join(__dirname, "..", "..", "templates", folder, templateFile)

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
        address: true, // 🆕 For {{#if address}} conditional in templates
        botIdentityResponse: true,
        chatbotName: true, // 🆕 For {{#if chatbotName}} in IDENTITY section
        customAiRules: true,
        allowedExternalLinks: true,
        humanSupportInstructions: true,
        frustrationEscalationInstructions: true,
        operatorContactMethod: true,
        operatorWhatsappNumber: true,
        notificationEmail: true,
        websiteUrl: true,
        url: true,
        name: true, // 🆕 For {{companyName}}
        toneOfVoice: true, // 🆕 For {{toneOfVoice}}
      },
    })

    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    const allowedLinks = Array.isArray(workspace.allowedExternalLinks)
      ? workspace.allowedExternalLinks.join("\n")
      : ""
    const address = workspace.address || ""
    const settings: WorkspaceSettings = {
      sellsProductsAndServices: workspace.sellsProductsAndServices ?? true,
      hasHumanSupport: workspace.hasHumanSupport ?? false,
      hasSalesAgents: workspace.hasSalesAgents ?? false,
      address,
      hasAddress: !!address,
      botIdentityResponse: workspace.botIdentityResponse || "",
      chatbotName: workspace.chatbotName || "", // 🆕 Bot name for IDENTITY
      companyName: workspace.name || "", // 🆕 Company name
      toneOfVoice: workspace.toneOfVoice || "friendly", // 🆕 Tone of voice
      customAiRules: workspace.customAiRules || "",
      allowedExternalLinks: allowedLinks,
      humanSupportInstructions: workspace.humanSupportInstructions || "",
      frustrationEscalationInstructions: workspace.frustrationEscalationInstructions || "",
      operatorContactMethod: workspace.operatorContactMethod || "email",
      operatorWhatsappNumber: workspace.operatorWhatsappNumber || "",
      supportEmail: workspace.notificationEmail || "",
      websiteUrl: workspace.websiteUrl || workspace.url || "",
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
