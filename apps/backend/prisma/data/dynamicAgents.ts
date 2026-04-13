import { AgentType, ChannelMode } from "@echatbot/database"
import * as fs from "fs"
import * as path from "path"
import { getAgentFunctionNames } from "../../src/config/agent-functions.config"
import {
  ECOMMERCE_TEMPLATE_FILES,
  INFORMATIONAL_TEMPLATE_FILES,
  ECOMMERCE_ONLY_AGENTS,
  getTemplateFolder,
  getTemplateFilename,
} from "../../src/utils/template-path.helper"

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

// Note: SHARED_AGENTS, ECOMMERCE_ONLY_AGENTS, TEMPLATE_FILES imported from template-path.helper

/**
 * Load template from src/templates/ directory
 * Uses centralized helper for path resolution
 */
function loadTemplate(agentType: string, channelMode: ChannelMode = "ECOMMERCE"): string {
  const filename = getTemplateFilename(agentType, channelMode)
  const subDir = getTemplateFolder(channelMode)
  
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
 * @param channelMode - Workspace channel mode (default: ECOMMERCE)
 */
export const dynamicAgents = (
  workspaceId: string,
  channelMode: ChannelMode = "ECOMMERCE"
): Array<
  Omit<DynamicAgent, "availableFunctions"> & {
    workspaceId: string
    availableFunctions: any
  }
> => {
  const hasEcommerce = channelMode === "ECOMMERCE"
  const isInformational = !hasEcommerce
  const customerSupportFunctions = getAgentFunctionNames("CUSTOMER_SUPPORT") || []
  const profileFunctions = getAgentFunctionNames("PROFILE_MANAGEMENT") || []
  const infoAgentFunctions = Array.from(
    new Set([...customerSupportFunctions, ...profileFunctions])
  )

  // Base agents available for ALL workspaces (with conditional info-only tweaks)
  const baseAgents: Array<
    Omit<DynamicAgent, "availableFunctions"> & {
      workspaceId: string
      availableFunctions: any
    }
  > = []

  // ROUTER AGENT (order: 0) - Only for e-commerce / multi-agent routing
  if (hasEcommerce) {
    baseAgents.push({
      workspaceId,
      name: "Router Agent",
      type: "ROUTER" as AgentType,
      icon: "GitBranch",
      description: "Dynamic routing with conditional logic based on workspace settings",
      systemPrompt: loadTemplate("ROUTER", channelMode),
      model: "openai/gpt-4o-mini",
      temperature: 0,
      maxTokens: 500,
      order: 0,
      isActive: true,
      availableFunctions: getAgentFunctionNames("ROUTER"),
    })
  }

  // CUSTOMER SUPPORT / INFO AGENT
  baseAgents.push({
    workspaceId,
    name: isInformational ? "Info Agent" : "Customer Support Agent",
    type: (isInformational ? "INFO_AGENT" : "CUSTOMER_SUPPORT") as AgentType,
    icon: "Headset",
    description: isInformational
      ? "Answers FAQs and informational requests with optional escalation"
      : "Customer support with conditional human escalation",
    systemPrompt: loadTemplate(isInformational ? "INFO_AGENT" : "CUSTOMER_SUPPORT", channelMode),
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    order: isInformational ? 0 : 4,
    isActive: true,
    availableFunctions: isInformational ? infoAgentFunctions : customerSupportFunctions,
  })

  // SUMMARY AGENT (order: 5) - Shared
  baseAgents.push({
    workspaceId,
    name: "Summary Agent",
    type: "SUMMARY_AGENT" as AgentType,
    icon: "FileText",
    description: "Conversation summary for operator emails",
    systemPrompt: loadTemplate("SUMMARY_AGENT", channelMode),
    model: "openai/gpt-4o-mini",
    temperature: 0.2,
    maxTokens: 500,
    order: 5,
    isActive: true,
    availableFunctions: getAgentFunctionNames("SUMMARY_AGENT"),
  })

  // PROFILE MANAGEMENT AGENT (order: 6) - Only for e-commerce flow
  if (hasEcommerce) {
    baseAgents.push({
      workspaceId,
      name: "Profile Management Agent",
      type: "PROFILE_MANAGEMENT" as AgentType,
      icon: "User",
      description: "Profile and notification management",
      systemPrompt: loadTemplate("PROFILE_MANAGEMENT", channelMode),
      model: "openai/gpt-4o-mini",
      temperature: 0.4,
      maxTokens: 500,
      order: 6,
      isActive: true,
      availableFunctions: profileFunctions,
    })
  }

  // FORMAT AND TRANSLATION AGENT (order: 7) - Shared
  baseAgents.push({
    workspaceId,
    name: "Format and Translation Agent",
    type: "TRANSLATION" as AgentType,
    icon: "Globe",
    description: "Format for WhatsApp and translate to customer language",
    systemPrompt: loadTemplate("TRANSLATION", channelMode),
    model: "openai/gpt-4o-mini",
    temperature: 0.1,
    maxTokens: 1024,
    order: 7,
    isActive: true,
    availableFunctions: getAgentFunctionNames("TRANSLATION"),
  })

  // CONVERSATION HISTORY LAYER (order: 8) - Shared
  // Umanizza le risposte tecniche, aggiunge contesto, saluti, offerte
  baseAgents.push({
    workspaceId,
    name: "Conversation History Layer",
    type: "CONVERSATION_HISTORY" as AgentType,
    icon: "MessageCircle",
    description: "Umanizza risposte con contesto, saluti, offerte",
    systemPrompt: loadTemplate("CONVERSATION_HISTORY", channelMode),
    model: "openai/gpt-4o-mini",
    temperature: 0.7, // Più creativo per umanizzare
    maxTokens: 500,
    order: 8, // Dopo agent funzionali, prima di Security
    isActive: true,
    availableFunctions: null, // Non chiama funzioni
  })

  // SECURITY AGENT (order: 99) - Shared
  baseAgents.push({
    workspaceId,
    name: "Security Agent",
    type: "SECURITY" as AgentType,
    icon: "Shield",
    description: "Security validation with conditional external links",
    systemPrompt: loadTemplate("SECURITY", channelMode),
    model: "openai/gpt-4o-mini",
    temperature: 0,
    maxTokens: 500,
    order: 99,
    isActive: true,
    availableFunctions: getAgentFunctionNames("SECURITY"),
  })

  // E-commerce only agents
  const ecommerceAgents = hasEcommerce ? [
    // PRODUCT SEARCH AGENT (order: 1)
    {
      workspaceId,
      name: "Product Search Agent",
      type: "PRODUCT_SEARCH" as AgentType,
      icon: "Search",
      description: "Product catalog search with dynamic template",
      systemPrompt: loadTemplate("PRODUCT_SEARCH", channelMode),
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
      systemPrompt: loadTemplate("CART_MANAGEMENT", channelMode),
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
      systemPrompt: loadTemplate("ORDER_TRACKING", channelMode),
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
