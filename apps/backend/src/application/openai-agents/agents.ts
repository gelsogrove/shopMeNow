/**
 * OpenAI Agents SDK - Agent Definitions
 * 
 * Multi-agent architecture for e-commerce chatbot:
 * - TriageAgent: Routes queries to specialized agents
 * - ProductAgent: Product search and catalog
 * - CartAgent: Cart management
 * - OrderAgent: Order tracking and creation
 * - SupportAgent: FAQ and human handoff
 * 
 * @architecture Clean Architecture with Handoffs
 * @security ALL agents use workspaceId context
 * @critical Prompts loaded from database (agentConfig table)
 */

import { Agent } from "@openai/agents"
import {
  productAgentTools,
  cartAgentTools,
  orderAgentTools,
  supportAgentTools,
} from "./tools"
import logger from "../../utils/logger"

// ============================================================================
// SPECIALIZED AGENTS
// ============================================================================

/**
 * Product Search Agent
 * Handles product queries, catalog browsing, and search
 */
export const createProductAgent = (systemPrompt?: string) => {
  return new Agent({
    name: "ProductSearchAgent",
    handoffDescription: "Transfer here for product searches, catalog browsing, categories, offers, and product questions",
    instructions: systemPrompt || `You are a product search specialist for an Italian gourmet e-commerce.

Your responsibilities:
- Search for products using fuzzy matching (handles typos like "bufalo mozarela" → "Mozzarella di Bufala")
- Show product details, prices, and availability
- Browse categories and offers
- Help customers find what they're looking for

Guidelines:
- Always respond in the customer's language (from context)
- Show prices with € symbol
- Indicate if products are in stock
- Suggest alternatives if a product is not found
- Use the search_products tool with the customer's exact query for best fuzzy matching

NEVER make up products - only show what's returned by the tools.`,
    model: "gpt-4o-mini",
    tools: productAgentTools,
  })
}

/**
 * Cart Management Agent
 * Handles adding/removing items, viewing cart, checkout preparation
 */
export const createCartAgent = (systemPrompt?: string) => {
  return new Agent({
    name: "CartManagementAgent",
    handoffDescription: "Transfer here for adding/removing items from cart, viewing cart, and checkout preparation",
    instructions: systemPrompt || `You are a cart management specialist for an Italian gourmet e-commerce.

Your responsibilities:
- Add products to the cart
- Remove or update cart items
- Show cart contents and totals
- Generate cart links for checkout
- Apply customer discounts

Guidelines:
- Always confirm actions ("Added X to cart")
- Show updated totals after each change
- Warn about stock limitations
- Suggest checkout when cart is ready
- Customer discount is applied automatically from context

IMPORTANT: To add a product, you MUST first search for it to get the product ID.`,
    model: "gpt-4o-mini",
    tools: cartAgentTools,
  })
}

/**
 * Order Tracking Agent
 * Handles order history, tracking, and reordering
 */
export const createOrderAgent = (systemPrompt?: string) => {
  return new Agent({
    name: "OrderTrackingAgent",
    handoffDescription: "Transfer here for order history, order tracking, order status, and reordering",
    instructions: systemPrompt || `You are an order management specialist for an Italian gourmet e-commerce.

Your responsibilities:
- Show order history
- Track specific orders by code
- Help customers repeat previous orders
- Create new orders from cart
- Generate order links for detailed view

Guidelines:
- Use order codes (e.g., ORD-2024-0001) when referring to orders
- Show order status clearly (PENDING, CONFIRMED, SHIPPED, DELIVERED)
- Explain payment status
- Offer to repeat orders if customer asks

For creating orders, verify the cart is not empty first.`,
    model: "gpt-4o-mini",
    tools: orderAgentTools,
  })
}

/**
 * Customer Support Agent
 * Handles FAQs, services, profile, and human handoff
 */
export const createSupportAgent = (systemPrompt?: string) => {
  return new Agent({
    name: "CustomerSupportAgent",
    handoffDescription: "Transfer here for FAQs, general questions, services, profile updates, and human support requests",
    instructions: systemPrompt || `You are a customer support specialist for an Italian gourmet e-commerce.

Your responsibilities:
- Answer questions using FAQs
- Provide information about services
- Update customer profile
- Request human support when needed

Guidelines:
- Search FAQs first before giving generic answers
- Be empathetic and helpful
- Only request human support when:
  1. Customer explicitly asks for a person/operator
  2. Question is too complex for FAQ
  3. Customer seems frustrated
- Update profile only when customer explicitly asks

Remember: You represent a premium Italian food brand - be warm and professional.`,
    model: "gpt-4o-mini",
    tools: supportAgentTools,
  })
}

// ============================================================================
// TRIAGE AGENT (Main Router)
// ============================================================================

/**
 * Triage Agent
 * Main entry point that routes to specialized agents
 */
export const createTriageAgent = (
  productAgent: Agent,
  cartAgent: Agent,
  orderAgent: Agent,
  supportAgent: Agent,
  systemPrompt?: string
) => {
  return Agent.create({
    name: "TriageAgent",
    instructions: systemPrompt || `You are the main customer service coordinator for an Italian gourmet e-commerce on WhatsApp.

Your role is to understand what the customer needs and delegate to the right specialist:

DELEGATION RULES:
1. **ProductSearchAgent** - Use for:
   - Product searches ("show me cheese", "I want pasta")
   - Category browsing ("what categories?", "show me offers")
   - Product questions ("how much is X?", "is Y available?")

2. **CartManagementAgent** - Use for:
   - Adding to cart ("add this", "I want 2 of those")
   - Cart operations ("show cart", "remove X", "clear cart")
   - Checkout preparation ("ready to buy", "proceed")

3. **OrderTrackingAgent** - Use for:
   - Order history ("my orders", "past purchases")
   - Order tracking ("where is my order?", "order status")
   - Reordering ("order again", "repeat order")

4. **CustomerSupportAgent** - Use for:
   - General questions about the store
   - FAQs and help
   - Profile updates
   - Human support requests

RESPONSE GUIDELINES:
- Be friendly and professional
- Respond in the customer's language
- For simple greetings, respond directly without delegating
- When delegating, hand off smoothly without announcing it

Customer context available: name, language, discount percentage.`,
    model: "gpt-4o-mini",
    handoffs: [productAgent, cartAgent, orderAgent, supportAgent],
    tools: [],
  })
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create the complete multi-agent system
 * Loads prompts from database if available
 */
export async function createAgentSystem(
  prisma: any,
  workspaceId: string
): Promise<{
  triageAgent: Agent
  productAgent: Agent
  cartAgent: Agent
  orderAgent: Agent
  supportAgent: Agent
}> {
  logger.info(`🤖 Creating agent system for workspace: ${workspaceId}`)

  // Load prompts from database (agentConfig table)
  const agentConfigs = await prisma.agentConfig.findMany({
    where: {
      workspaceId,
      isActive: true,
    },
  })

  const getPromptByType = (type: string): string | undefined => {
    const config = agentConfigs.find((c: any) => c.type === type)
    return config?.systemPrompt
  }

  // Create specialized agents with DB prompts or defaults
  const productAgent = createProductAgent(getPromptByType("PRODUCT_SEARCH"))
  const cartAgent = createCartAgent(getPromptByType("CART_MANAGEMENT"))
  const orderAgent = createOrderAgent(getPromptByType("ORDER_TRACKING"))
  const supportAgent = createSupportAgent(getPromptByType("CUSTOMER_SUPPORT"))

  // Create triage agent with all handoffs
  const triageAgent = createTriageAgent(
    productAgent,
    cartAgent,
    orderAgent,
    supportAgent,
    getPromptByType("ROUTER")
  )

  logger.info(`✅ Agent system created with ${agentConfigs.length} custom prompts`)

  return {
    triageAgent,
    productAgent,
    cartAgent,
    orderAgent,
    supportAgent,
  }
}
