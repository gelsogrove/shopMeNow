/**
 * Agent Functions Configuration
 *
 * Maps each AgentType to its available function calls.
 * This is used by the Agent Settings UI to display which functions each agent can use.
 */

export const AGENT_FUNCTION_MAPPING = {
  ROUTER: [
    "searchProducts",
    "addToCart",
    "viewCart",
    "removeFromCart",
    "updateCartQuantity",
    "clearCart",
    "repeatLastOrder",
    "getOrders",
    "contactSupport",
  ],
  PRODUCT_SEARCH: ["searchProducts", "getProductDetails"],
  CART_MANAGEMENT: [
    "addToCart",
    "removeFromCart",
    "viewCart",
    "updateCartQuantity",
    "clearCart",
    "repeatLastOrder",
  ],
  ORDER_TRACKING: ["getOrders", "getOrderDetails", "generateInvoice"],
  CUSTOMER_SUPPORT: ["contactSupport", "reportIssue"],
  SAFETY_TRANSLATION: [], // No functions - only validates and translates
} as const

/**
 * Get function calls for a specific agent type
 */
export function getFunctionsForAgentType(agentType: string): readonly string[] {
  return (
    AGENT_FUNCTION_MAPPING[agentType as keyof typeof AGENT_FUNCTION_MAPPING] ||
    []
  )
}

/**
 * Get all unique function names across all agents
 */
export function getAllFunctionNames(): string[] {
  const allFunctions = new Set<string>()
  Object.values(AGENT_FUNCTION_MAPPING).forEach((functions) => {
    functions.forEach((fn) => allFunctions.add(fn))
  })
  return Array.from(allFunctions).sort()
}
