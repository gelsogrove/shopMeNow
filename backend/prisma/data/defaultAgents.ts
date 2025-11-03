import { AgentType } from "@prisma/client"
import * as fs from "fs"
import * as path from "path"

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
 * @param filename - Name of the markdown file in docs/prompts/
 * @returns Prompt content as string
 */
function loadPrompt(filename: string): string {
  const promptPath = path.join(__dirname, "../../../docs/prompts", filename)
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
  // ROUTER AGENT (order: 0) - Entry point, FAQ + Intent Classification
  // ====================================================================
  {
    workspaceId,
    name: "Router Agent",
    type: "ROUTER" as AgentType,
    icon: "GitBranch",
    description:
      "Entry point & orchestrator - handles FAQ, services, offers, and delegates to specialist agents",
    systemPrompt: loadPrompt("router-agent.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    order: 0,
    isActive: true,
    availableFunctions: null,
  },

  // ====================================================================
  // PRODUCT SEARCH AGENT (order: 1) - Product catalog expert
  // ====================================================================
  {
    workspaceId,
    name: "Product Search Agent",
    type: "PRODUCT_SEARCH" as AgentType,
    icon: "Search",
    description:
      "Specialist in product search, filters, certifications, and catalog navigation",
    systemPrompt: loadPrompt("product-search-agent.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    order: 1,
    isActive: true,
    availableFunctions: null,
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
    systemPrompt: loadPrompt("cart-management-agent.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    order: 2,
    isActive: true,
    availableFunctions: null,
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
    systemPrompt: loadPrompt("order-tracking-agent.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    order: 3,
    isActive: true,
    availableFunctions: null,
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
    systemPrompt: loadPrompt("customer-support-agent.md"),
    model: "openai/gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
    order: 4,
    isActive: true,
    availableFunctions: null,
  },

  // ====================================================================
  // SAFETY & TRANSLATION AGENT (order: 5) - Final security layer
  // ====================================================================
  {
    workspaceId,
    name: "Safety & Translation Agent",
    type: "SAFETY_TRANSLATION" as AgentType,
    icon: "Shield",
    description:
      "Final security layer: checks content safety, translates to customer language, removes sensitive data",
    systemPrompt: loadPrompt("safety-translation-agent.md"),
    model: "openai/gpt-4o-mini", // Can use Claude Sonnet if preferred
    temperature: 0.1, // Very low for consistency
    maxTokens: 1024,
    order: 5,
    isActive: true,
    availableFunctions: null,
  },
]
