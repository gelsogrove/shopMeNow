import { AgentType } from "@echatbot/database"
import * as fs from "fs"
import * as path from "path"
import { getAgentFunctionNames } from "../../src/config/agent-functions.config"

/**
 * Load template-based agent configurations
 * 
 * These templates use Handlebars syntax ({{#if}}, {{variable}})
 * and are processed at runtime by TemplateEngineService.
 * 
 * Source: apps/backend/src/templates/*.template.md
 */

interface DynamicAgent {
  name: string
  type: AgentType
  description: string
  icon: string
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  order: number
  isActive: boolean
  availableFunctions: string[] | null
}

// Agent types that are SHARED across all workspace types
const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT", "CONVERSATION_HISTORY"]

// Agent types available ONLY for e-commerce workspaces
const ECOMMERCE_ONLY_AGENTS = ["PRODUCT_SEARCH", "ORDER_TRACKING"]

// Map AgentType to template file
const TEMPLATE_FILES: Record<string, string> = {
  ROUTER: "01-router.template.md",
  PRODUCT_SEARCH: "02-product-search.template.md",
  ORDER_TRACKING: "03-order-tracking.template.md",
  CUSTOMER_SUPPORT: "04-customer-support.template.md",
  PROFILE_MANAGEMENT: "05-profile-management.template.md",
  SECURITY: "06-security.template.md",
  TRANSLATION: "07-translation.template.md",
  SUMMARY_AGENT: "08-summary.template.md",
  CONVERSATION_HISTORY: "09-conversation-history.template.md",
}

/**
 * Determine which subdirectory to load template from
 */
function getTemplateSubDir(agentType: string, hasEcommerce: boolean): string {
  if (SHARED_AGENTS.includes(agentType)) return "shared"
  if (ECOMMERCE_ONLY_AGENTS.includes(agentType)) return "ecommerce"
  return hasEcommerce ? "ecommerce" : "informational"
}

/**
 * Load template from src/templates/ directory
 * Templates are organized by workspace type:
 *   - shared/     → Security, Translation, Summary
 *   - ecommerce/  → ProductSearch, OrderTracking, and e-commerce Router/Support
 *   - informational/ → Info-only Router/Support
 */
function loadTemplate(agentType: string, hasEcommerce: boolean = true): string {
  const filename = TEMPLATE_FILES[agentType]
  if (!filename) {
    throw new Error(`No template defined for agent type: ${agentType}`)
  }
  
  const subDir = getTemplateSubDir(agentType, hasEcommerce)
  const templatePath = path.join(__dirname, "../../src/templates", subDir, filename)
  
  try {
    return fs.readFileSync(templatePath, "utf-8")
  } catch (error) {
    // Fallback to root templates folder for backward compatibility
    const fallbackPath = path.join(__dirname, "../../src/templates", filename)
    try {
      console.warn(`⚠️ Using fallback template for ${agentType} (not in ${subDir}/)`)
      return fs.readFileSync(fallbackPath, "utf-8")
    } catch {
      console.error(`❌ Failed to load template: ${filename}`, error)
      throw new Error(`Failed to load template file: ${filename}`)
    }
  }
}

/**
 * Get dynamic agent configurations with Handlebars templates
 * Templates are loaded from different folders based on workspace type:
 *   - ecommerce/  → Full e-commerce functionality
 *   - informational/ → Info-only, no sales
 *   - shared/     → Common agents (Security, Translation, Summary)
 * 
 * @param workspaceId - Workspace ID
 * @param hasEcommerce - Whether workspace sells products/services (default: true)
 */
export const dynamicAgents = (
  workspaceId: string,
  hasEcommerce: boolean = true
): Array<
  Omit<DynamicAgent, "availableFunctions"> & {
    workspaceId: string
    availableFunctions: any
  }
> => {
  // Base agents available for ALL workspaces
  const baseAgents = [
    // ROUTER AGENT (order: 0)
    {
      workspaceId,
      name: "Router Agent",
      type: "ROUTER" as AgentType,
      icon: "GitBranch",
      description: "Dynamic routing with conditional logic based on workspace settings",
      systemPrompt: loadTemplate("ROUTER", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0,
      maxTokens: 500,
      order: 0,
      isActive: true,
      availableFunctions: getAgentFunctionNames("ROUTER"),
    },

    // CUSTOMER SUPPORT AGENT (order: 4)
    {
      workspaceId,
      name: "Customer Support Agent",
      type: "CUSTOMER_SUPPORT" as AgentType,
      icon: "Headset",
      description: "Customer support with conditional human escalation",
      systemPrompt: loadTemplate("CUSTOMER_SUPPORT", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 2048,
      order: 4,
      isActive: true,
      availableFunctions: getAgentFunctionNames("CUSTOMER_SUPPORT"),
    },

    // SUMMARY AGENT (order: 5) - Shared
    {
      workspaceId,
      name: "Summary Agent",
      type: "SUMMARY_AGENT" as AgentType,
      icon: "FileText",
      description: "Conversation summary for operator emails",
      systemPrompt: loadTemplate("SUMMARY_AGENT", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 500,
      order: 5,
      isActive: true,
      availableFunctions: getAgentFunctionNames("SUMMARY_AGENT"),
    },

    // PROFILE MANAGEMENT AGENT (order: 6)
    {
      workspaceId,
      name: "Profile Management Agent",
      type: "PROFILE_MANAGEMENT" as AgentType,
      icon: "User",
      description: "Profile and notification management",
      systemPrompt: loadTemplate("PROFILE_MANAGEMENT", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0.4,
      maxTokens: 500,
      order: 6,
      isActive: true,
      availableFunctions: getAgentFunctionNames("PROFILE_MANAGEMENT"),
    },

    // FORMAT AND TRANSLATION AGENT (order: 7) - Shared
    {
      workspaceId,
      name: "Format and Translation Agent",
      type: "TRANSLATION" as AgentType,
      icon: "Globe",
      description: "Format for WhatsApp and translate to customer language",
      systemPrompt: loadTemplate("TRANSLATION", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0.1,
      maxTokens: 1024,
      order: 7,
      isActive: true,
      availableFunctions: getAgentFunctionNames("TRANSLATION"),
    },

    // CONVERSATION HISTORY LAYER (order: 8) - Shared
    // Umanizza le risposte tecniche, aggiunge contesto, saluti, offerte
    {
      workspaceId,
      name: "Conversation History Layer",
      type: "CONVERSATION_HISTORY" as AgentType,
      icon: "MessageCircle",
      description: "Umanizza risposte con contesto, saluti, offerte",
      systemPrompt: loadTemplate("CONVERSATION_HISTORY", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0.7, // Più creativo per umanizzare
      maxTokens: 500,
      order: 8, // Dopo agent funzionali, prima di Security
      isActive: true,
      availableFunctions: null, // Non chiama funzioni
    },

    // SECURITY AGENT (order: 99) - Shared
    {
      workspaceId,
      name: "Security Agent",
      type: "SECURITY" as AgentType,
      icon: "Shield",
      description: "Security validation with conditional external links",
      systemPrompt: loadTemplate("SECURITY", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0,
      maxTokens: 500,
      order: 99,
      isActive: true,
      availableFunctions: getAgentFunctionNames("SECURITY"),
    },
  ]

  // E-commerce only agents
  const ecommerceAgents = hasEcommerce ? [
    // PRODUCT SEARCH AGENT (order: 1)
    {
      workspaceId,
      name: "Product Search Agent",
      type: "PRODUCT_SEARCH" as AgentType,
      icon: "Search",
      description: "Product catalog search with dynamic template",
      systemPrompt: loadTemplate("PRODUCT_SEARCH", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0,
      maxTokens: 2048,
      order: 1,
      isActive: true,
      availableFunctions: getAgentFunctionNames("PRODUCT_SEARCH"),
    },

    // CART MANAGEMENT AGENT (order: 2)
    {
      workspaceId,
      name: "Cart Management Agent",
      type: "CART_MANAGEMENT" as AgentType,
      icon: "ShoppingCart",
      description: "Cart operations with dynamic template",
      systemPrompt: loadTemplate("PRODUCT_SEARCH", hasEcommerce), // Cart uses same base
      model: "openai/gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 2048,
      order: 2,
      isActive: true,
      availableFunctions: getAgentFunctionNames("CART_MANAGEMENT"),
    },

    // ORDER TRACKING AGENT (order: 3)
    {
      workspaceId,
      name: "Order Tracking Agent",
      type: "ORDER_TRACKING" as AgentType,
      icon: "Package",
      description: "Order tracking with dynamic template",
      systemPrompt: loadTemplate("ORDER_TRACKING", hasEcommerce),
      model: "openai/gpt-4o-mini",
      temperature: 0.3,
      maxTokens: 2048,
      order: 3,
      isActive: true,
      availableFunctions: getAgentFunctionNames("ORDER_TRACKING"),
    },
  ] : []

  return [...baseAgents, ...ecommerceAgents]
}
