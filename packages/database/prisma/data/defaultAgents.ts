import { AgentType } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"
import { getAgentFunctionNames } from "../../src/config/agent-functions.config"

interface DefaultAgent {
  name: string
  type: AgentType
  description: string
  icon: string // Lucide icon name
  systemPrompt: string
  model: string
  temperature: number
  maxTokens: number
  order: number
  isActive: boolean
  availableFunctions: string[] | null
}

/**
 * Load prompt from markdown file
 * @param filename - Name of the markdown file in docs/prompts/templates/
 * @returns Prompt content as string
 */
function loadPrompt(filename: string): string {
  // Path: packages/database/prisma/data/ -> ../../../../docs/prompts/templates/
  const promptPath = path.join(__dirname, "../../../../docs/prompts/templates", filename)
  try {
    return fs.readFileSync(promptPath, "utf-8")
  } catch (error) {
    console.error(`❌ Failed to load prompt: ${filename}`, error)
    throw new Error(`Failed to load prompt file: ${filename}`)
  }
}

export const defaultAgents = (
  workspaceId: string
): Array<
  Omit<DefaultAgent, "availableFunctions"> & {
    workspaceId: string
    availableFunctions: any
  }
> => [
  // ====================================================================
  // ROUTER AGENT (order: 0) - Pure orchestration + context interpretation
  // ====================================================================
  {
    workspaceId,
    name: "Router Agent",
    type: "ROUTER" as AgentType,
    icon: "GitBranch",
    description:
      "Pure orchestration: intent classification, context interpretation for short responses (with CONFERMA keyword), and FAQ handling",
    systemPrompt: loadPrompt("01-router.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0, // ✅ Zero temperature = fully deterministic routing (no creativity needed)
    maxTokens: 500, // ✅ JSON response only
    order: 0,
    isActive: true,
    availableFunctions: getAgentFunctionNames("ROUTER"),
  },

  // ====================================================================
  // PRODUCT SEARCH AGENT (order: 1) - Product catalog expert with progressive filtering
  // ====================================================================
  {
    workspaceId,
    name: "Product Search Agent",
    type: "PRODUCT_SEARCH" as AgentType,
    icon: "Search",
    description:
      "Specialist in product search with progressive filtering strategy (Regola 11): guides customers from categories to specific products",
    systemPrompt: loadPrompt("02-product-search.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.2, // ✅ Low temperature for consistent product responses
    maxTokens: 2048,
    order: 1,
    isActive: true,
    availableFunctions: getAgentFunctionNames("PRODUCT_SEARCH"),
  },

  // ====================================================================
  // CART MANAGEMENT AGENT (order: 2) - Cart operations expert
  // ====================================================================
  {
    workspaceId,
    name: "Cart Management Agent",
    type: "CART_MANAGEMENT" as AgentType,
    icon: "ShoppingCart",
    description:
      "Specialist in cart operations: add/remove products, repeat orders, manage quantities",
    systemPrompt: loadPrompt("03-cart-management.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.2, // ✅ Low temperature for consistent cart operations
    maxTokens: 2048,
    order: 2,
    isActive: true,
    availableFunctions: getAgentFunctionNames("CART_MANAGEMENT"),
  },

  // ====================================================================
  // ORDER TRACKING AGENT (order: 3) - Order history and tracking expert
  // ====================================================================
  {
    workspaceId,
    name: "Order Tracking Agent",
    type: "ORDER_TRACKING" as AgentType,
    icon: "Package",
    description:
      "Specialist in order tracking, history, invoices, and delivery status",
    systemPrompt: loadPrompt("03-order-tracking.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.2, // ✅ Low temperature for consistent order responses
    maxTokens: 2048,
    order: 3,
    isActive: true,
    availableFunctions: getAgentFunctionNames("ORDER_TRACKING"),
  },

  // ====================================================================
  // CUSTOMER SUPPORT AGENT (order: 4) - Human escalation and support
  // ====================================================================
  {
    workspaceId,
    name: "Customer Support Agent",
    type: "CUSTOMER_SUPPORT" as AgentType,
    icon: "Headset",
    description:
      "Specialist in customer support, human escalation, complaints, and urgent issues",
    systemPrompt: loadPrompt("04-customer-support.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.2, // ✅ Low temperature for empathetic but consistent support
    maxTokens: 2048,
    order: 4,
    isActive: true,
    availableFunctions: getAgentFunctionNames("CUSTOMER_SUPPORT"),
  },

  // ====================================================================
  // SUMMARY AGENT (order: 5) - Conversation summarization for email notifications
  // ====================================================================
  {
    workspaceId,
    name: "Summary Agent",
    type: "SUMMARY_AGENT" as AgentType,
    icon: "FileText",
    description:
      "Specialist in creating concise conversation summaries for support team email notifications",
    systemPrompt: loadPrompt("08-summary.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.2, // Low temperature for consistent, factual summaries
    maxTokens: 500,   // 250 words ≈ 350-500 tokens
    order: 5,
    isActive: true,
    availableFunctions: getAgentFunctionNames("SUMMARY_AGENT"),
  },

  // ====================================================================
  // PROFILE MANAGEMENT AGENT (order: 7) - Customer profile & notifications
  // ====================================================================
  {
    workspaceId,
    name: "Profile Management Agent",
    type: "PROFILE_MANAGEMENT" as AgentType,
    icon: "User",
    description:
      "Specialist in managing customer profile information and notification preferences (enable/disable push notifications)",
    systemPrompt: loadPrompt("05-profile-management.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.2, // ✅ Low temperature for consistent profile operations
    maxTokens: 500,
    order: 6,
    isActive: true,
    availableFunctions: getAgentFunctionNames("PROFILE_MANAGEMENT"),
  },

  // ====================================================================
  // FORMAT AND TRANSLATION AGENT (order: 7) - Format and translate to customer language
  // ====================================================================
  {
    workspaceId,
    name: "Format and Translation Agent",
    type: "TRANSLATION" as AgentType,
    icon: "Globe",
    description:
      "Format and translation layer: formats responses for WhatsApp and translates to customer language (Italian, Spanish, Portuguese, English)",
    systemPrompt: loadPrompt("07-translation.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.1, // Very low for consistency
    maxTokens: 1024,
    order: 7, // After Profile Management (6)
    isActive: true,
    availableFunctions: getAgentFunctionNames("TRANSLATION"),
  },

  // ====================================================================
  // SECURITY AGENT (order: 99) - Security validation and content moderation
  // ====================================================================
  {
    workspaceId,
    name: "Security Agent",
    type: "SECURITY" as AgentType,
    icon: "Shield",
    description:
      "Security validation: detects dangerous content, SQL injection, XSS, offensive language. Blocks unsafe messages completely (no send, shows 🚫 icon)",
    systemPrompt: loadPrompt("06-security.template.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0, // Zero temperature = deterministic security checks
    maxTokens: 500, // Security checks don't need long responses
    order: 99, // Last - final security check before sending
    isActive: true,
    availableFunctions: getAgentFunctionNames("SECURITY"),
  },
]
