/**
 * Template Path Helper - SINGLE SOURCE OF TRUTH
 * 
 * Centralizes all template path resolution logic to avoid duplicated code.
 * Used by: template-loader.service, prompt-render.service, seed scripts, tests
 * 
 * Directory Structure:
 * - templates/ecommerce/     → E-commerce channels (sells products/services)
 * - templates/informational/ → Info-only channels (no products, FAQ/support only)
 * 
 * Each folder is SELF-CONTAINED with all templates needed.
 */

// 🗂️ ECOMMERCE TEMPLATE FILES (10 files)
export const ECOMMERCE_TEMPLATE_FILES: Record<string, string> = {
  ROUTER: "01-router.template.md",
  PRODUCT_SEARCH: "02-product-search.template.md",
  CART_MANAGEMENT: "03-cart-management.template.md",
  ORDER_TRACKING: "03-order-tracking.template.md",
  CUSTOMER_SUPPORT: "04-customer-support.template.md",
  PROFILE_MANAGEMENT: "05-profile-management.template.md",
  SECURITY: "07-security.template.md",
  TRANSLATION: "08-translation.template.md",
  PRODUCT_CONTEXT: "09-product-context.template.md",
  ORDER_OPTIMIZATION: "10-order-optimization.template.md",
}

// 🗂️ INFORMATIONAL TEMPLATE FILES (3 files)
export const INFORMATIONAL_TEMPLATE_FILES: Record<string, string> = {
  CUSTOMER_SUPPORT: "01-info-agent.template.md",  // Main conversational agent for info-only channels
  SECURITY: "02-security.template.md",
  TRANSLATION: "03-translation.template.md",
}

// Agents available ONLY for e-commerce workspaces
export const ECOMMERCE_ONLY_AGENTS = ["ROUTER", "PRODUCT_SEARCH", "ORDER_TRACKING", "CART_MANAGEMENT", "CUSTOMER_SUPPORT", "PROFILE_MANAGEMENT", "PRODUCT_CONTEXT", "ORDER_OPTIMIZATION"]

// All e-commerce agent types
export const ECOMMERCE_AGENTS = Object.keys(ECOMMERCE_TEMPLATE_FILES)

// All informational agent types
export const INFORMATIONAL_AGENTS = Object.keys(INFORMATIONAL_TEMPLATE_FILES)

/**
 * Get template subdirectory based on workspace type
 * 
 * @param isEcommerce - Whether workspace sells products/services
 * @returns Subdirectory name: "ecommerce" | "informational"
 * 
 * @example
 * getTemplateFolder(true)   // → "ecommerce"
 * getTemplateFolder(false)  // → "informational"
 */
export function getTemplateFolder(isEcommerce: boolean): string {
  return isEcommerce ? "ecommerce" : "informational"
}

/**
 * Get template filename for agent type
 * 
 * @param agentType - Agent type (ROUTER, SECURITY, INFO_AGENT, etc.)
 * @param isEcommerce - Whether workspace is ecommerce
 * @returns Template filename (e.g., "01-router.template.md")
 * @throws Error if agent type not found
 */
export function getTemplateFilename(agentType: string, isEcommerce: boolean): string {
  const templateMap = isEcommerce ? ECOMMERCE_TEMPLATE_FILES : INFORMATIONAL_TEMPLATE_FILES
  const filename = templateMap[agentType]
  
  if (!filename) {
    throw new Error(`No template defined for agent type: ${agentType} (isEcommerce: ${isEcommerce})`)
  }
  
  return filename
}

/**
 * Check if agent is e-commerce only
 */
export function isEcommerceOnlyAgent(agentType: string): boolean {
  return ECOMMERCE_ONLY_AGENTS.includes(agentType)
}
