/**
 * Template Path Helper - SINGLE SOURCE OF TRUTH
 *
 * Centralizes all template path resolution logic to avoid duplicated code.
 * Used by: template-loader.service, prompt-render.service, seed scripts, tests
 *
 * Directory Structure:
 * - templates/ecommerce/     → E-commerce channels (products, orders, cart)
 * - templates/informational/ → Info-only channels (FAQ/support only)
 * - templates/flow/          → Guided step-by-step channels (identical to informational for now)
 *
 * Each folder is SELF-CONTAINED with all templates needed.
 */

// Use string literal type to avoid runtime dependency on Prisma enum (Jest compatibility)
type ChannelMode = "ECOMMERCE" | "INFORMATIONAL" | "FLOW"

// Minimal workspace shape needed by helper functions
type WorkspaceWithMode = { channelMode: ChannelMode }

// --- Mode check helpers ---

export function isEcommerce(workspace: WorkspaceWithMode): boolean {
  return workspace.channelMode === "ECOMMERCE"
}

export function isInformational(workspace: WorkspaceWithMode): boolean {
  return workspace.channelMode === "INFORMATIONAL"
}

export function isFlow(workspace: WorkspaceWithMode): boolean {
  return workspace.channelMode === "FLOW"
}

// 🗂️ ECOMMERCE TEMPLATE FILES (10 files — removed orphaned PRODUCT_CONTEXT, ORDER_OPTIMIZATION)
export const ECOMMERCE_TEMPLATE_FILES: Record<string, string> = {
  ROUTER: "01-router.template.md",
  PRODUCT_SEARCH: "02-product-search.template.md",
  CART_MANAGEMENT: "03-cart-management.template.md",
  ORDER_TRACKING: "03-order-tracking.template.md",
  CUSTOMER_SUPPORT: "04-customer-support.template.md",
  PROFILE_MANAGEMENT: "05-profile-management.template.md",
  SECURITY: "07-security.template.md",
  TRANSLATION: "08-translation.template.md",
  SUMMARY_AGENT: "11-summary.template.md",
  CONVERSATION_HISTORY: "12-conversation-history.template.md",
}

// 🗂️ INFORMATIONAL TEMPLATE FILES (6 files)
export const INFORMATIONAL_TEMPLATE_FILES: Record<string, string> = {
  INFO_AGENT: "01-info-agent.template.md",
  SECURITY: "02-security.template.md",
  TRANSLATION: "03-translation.template.md",
  SUMMARY_AGENT: "04-summary.template.md",
  CONVERSATION_HISTORY: "05-conversation-history.template.md",
  PROFILE_MANAGEMENT: "06-profile-management.template.md",
}

// 🗂️ FLOW TEMPLATE FILES (6 files — identical to informational for now)
export const FLOW_TEMPLATE_FILES: Record<string, string> = {
  INFO_AGENT: "01-flow-agent.template.md",
  SECURITY: "02-security.template.md",
  TRANSLATION: "03-translation.template.md",
  SUMMARY_AGENT: "04-summary.template.md",
  CONVERSATION_HISTORY: "05-conversation-history.template.md",
  PROFILE_MANAGEMENT: "06-profile-management.template.md",
}

// Agents that exist ONLY in e-commerce workspaces (aligned with dynamicAgents() actual creation)
export const ECOMMERCE_ONLY_AGENTS = [
  "ROUTER", "PRODUCT_SEARCH", "ORDER_TRACKING", "CART_MANAGEMENT", "CUSTOMER_SUPPORT", "PROFILE_MANAGEMENT",
]

// Agents that exist ONLY in informational/flow workspaces
export const INFORMATIONAL_ONLY_AGENTS = ["INFO_AGENT"]

// All agent types per mode
export const ECOMMERCE_AGENTS = Object.keys(ECOMMERCE_TEMPLATE_FILES)
export const INFORMATIONAL_AGENTS = Object.keys(INFORMATIONAL_TEMPLATE_FILES)
export const FLOW_AGENTS = Object.keys(FLOW_TEMPLATE_FILES)

/**
 * Get the template file map for a given channel mode
 */
export function getTemplateFilesForMode(mode: ChannelMode): Record<string, string> {
  switch (mode) {
    case "ECOMMERCE": return ECOMMERCE_TEMPLATE_FILES
    case "INFORMATIONAL": return INFORMATIONAL_TEMPLATE_FILES
    case "FLOW": return FLOW_TEMPLATE_FILES
  }
}

/**
 * Get valid agent types for a given channel mode
 */
export function getValidAgentTypesForMode(mode: ChannelMode): string[] {
  switch (mode) {
    case "ECOMMERCE": return ECOMMERCE_AGENTS
    case "INFORMATIONAL": return INFORMATIONAL_AGENTS
    case "FLOW": return FLOW_AGENTS
  }
}

/**
 * Get template subdirectory based on channel mode
 */
export function getTemplateFolder(mode: ChannelMode): string {
  switch (mode) {
    case "ECOMMERCE": return "ecommerce"
    case "INFORMATIONAL": return "informational"
    case "FLOW": return "flow"
  }
}

/**
 * Get template filename for agent type based on channel mode
 */
export function getTemplateFilename(agentType: string, mode: ChannelMode): string {
  const templateMap = getTemplateFilesForMode(mode)
  const filename = templateMap[agentType]

  if (!filename) {
    throw new Error(`No template defined for agent type: ${agentType} (channelMode: ${mode})`)
  }

  return filename
}

/**
 * Check if agent is e-commerce only
 */
export function isEcommerceOnlyAgent(agentType: string): boolean {
  return ECOMMERCE_ONLY_AGENTS.includes(agentType)
}
