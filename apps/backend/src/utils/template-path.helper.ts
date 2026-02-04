/**
 * Template Path Helper - SINGLE SOURCE OF TRUTH
 * 
 * Centralizes all template path resolution logic to avoid duplicated code.
 * Used by: template-loader.service, prompt-render.service, seed scripts, tests
 * 
 * Directory Structure:
 * - templates/shared/       → SECURITY, TRANSLATION, SUMMARY_AGENT, CONVERSATION_HISTORY
 * - templates/ecommerce/    → E-commerce versions of ROUTER, PRODUCT_SEARCH, ORDER_TRACKING, etc.
 * - templates/informational/→ Info-only versions (fallback to ecommerce if missing)
 */

export const TEMPLATE_FILES: Record<string, string> = {
  ROUTER: "01-router.template.md",
  PRODUCT_SEARCH: "02-product-search.template.md",
  CART_MANAGEMENT: "03-cart-management.template.md",
  ORDER_TRACKING: "03-order-tracking.template.md",
  CUSTOMER_SUPPORT: "04-customer-support.template.md",
  PROFILE_MANAGEMENT: "05-profile-management.template.md",
  SECURITY: "06-security.template.md",
  TRANSLATION: "07-translation.template.md",
  SUMMARY_AGENT: "08-summary.template.md",
  CONVERSATION_HISTORY: "09-conversation-history.template.md",
  PRODUCT_CONTEXT: "09-product-context.template.md",
}

// Agents that are workspace-type agnostic (same template for ecommerce & informational)
export const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT", "CONVERSATION_HISTORY"]

// Agents available ONLY for e-commerce workspaces
export const ECOMMERCE_ONLY_AGENTS = ["PRODUCT_SEARCH", "ORDER_TRACKING", "CART_MANAGEMENT"]

// All e-commerce agents (ecommerce folder + shared)
export const ECOMMERCE_AGENTS = [
  "ROUTER",
  "PRODUCT_SEARCH",
  "CART_MANAGEMENT",
  "ORDER_TRACKING",
  "CUSTOMER_SUPPORT",
  "PROFILE_MANAGEMENT",
  "PRODUCT_CONTEXT",
  ...SHARED_AGENTS,
]

// All informational agents (informational folder + shared)
export const INFORMATIONAL_AGENTS = [
  "ROUTER",
  "CUSTOMER_SUPPORT",
  "PROFILE_MANAGEMENT",
  ...SHARED_AGENTS,
]

/**
 * Get template subdirectory based on agent type and workspace config
 * 
 * @param agentType - Agent type (ROUTER, PRODUCT_SEARCH, etc.)
 * @param isEcommerce - Whether workspace sells products/services
 * @returns Subdirectory name: "shared" | "ecommerce" | "informational"
 * 
 * @example
 * getTemplateFolder("SECURITY", true)        // → "shared"
 * getTemplateFolder("PRODUCT_SEARCH", true)  // → "ecommerce"
 * getTemplateFolder("ROUTER", false)         // → "informational"
 */
export function getTemplateFolder(agentType: string, isEcommerce: boolean): string {
  // Shared agents: always from /shared folder
  if (SHARED_AGENTS.includes(agentType)) {
    return "shared"
  }
  
  // E-commerce only agents: always from /ecommerce folder
  if (ECOMMERCE_ONLY_AGENTS.includes(agentType)) {
    return "ecommerce"
  }
  
  // Other agents: workspace-specific (ecommerce vs informational)
  return isEcommerce ? "ecommerce" : "informational"
}

/**
 * Get template filename for agent type
 * 
 * @param agentType - Agent type
 * @returns Template filename (e.g., "01-router.template.md")
 * @throws Error if agent type not found
 */
export function getTemplateFilename(agentType: string): string {
  const filename = TEMPLATE_FILES[agentType]
  if (!filename) {
    throw new Error(`No template defined for agent type: ${agentType}`)
  }
  return filename
}

/**
 * Check if agent type is workspace-type agnostic (shared)
 */
export function isSharedAgent(agentType: string): boolean {
  return SHARED_AGENTS.includes(agentType)
}

/**
 * Check if agent is e-commerce only
 */
export function isEcommerceOnlyAgent(agentType: string): boolean {
  return ECOMMERCE_ONLY_AGENTS.includes(agentType)
}
