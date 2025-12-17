/**
 * OpenAI Agents SDK - Tools Index
 * 
 * Central export for all agent tools.
 */

export * from "./product.tools"
export * from "./cart.tools"
export * from "./order.tools"
export * from "./support.tools"

// Combined tool sets for different agent types
import { productTools } from "./product.tools"
import { cartTools } from "./cart.tools"
import { orderTools } from "./order.tools"
import { supportTools } from "./support.tools"

/**
 * All tools for the triage agent (can access everything)
 */
export const allTools = [
  ...productTools,
  ...cartTools,
  ...orderTools,
  ...supportTools,
]

/**
 * Tools for product-focused agents
 */
export const productAgentTools = productTools

/**
 * Tools for cart-focused agents
 */
export const cartAgentTools = [
  ...cartTools,
  ...productTools.slice(0, 2), // search and details only
]

/**
 * Tools for order-focused agents
 */
export const orderAgentTools = orderTools

/**
 * Tools for support-focused agents
 */
export const supportAgentTools = supportTools
