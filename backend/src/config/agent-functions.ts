/**
 * OpenRouter Function Calling Definitions
 *
 * These are the functions available to the Router LLM for executing actions.
 * Format follows OpenAI's function calling schema (compatible with OpenRouter).
 *
 * @see https://platform.openai.com/docs/guides/function-calling
 */

export interface FunctionDefinition {
  name: string
  description: string
  parameters: {
    type: "object"
    properties: Record<string, any>
    required?: string[]
  }
}

export const AGENT_FUNCTIONS: FunctionDefinition[] = [
  // ========================================
  // ROUTER DELEGATION FUNCTIONS (Function Calls to Sub-Agents)
  // ========================================
  {
    name: "productSearchAgent",
    description:
      "Delegate to Product Search Agent for product search, catalog browsing, certification filters. Use when customer asks about products, prices, stock, categories.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer's product search query or question",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "cartManagementAgent",
    description:
      "Delegate to Cart Management Agent for adding/removing products, viewing cart, checkout. Use when customer wants to buy, add to cart, modify cart, or checkout.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer's cart-related request or action",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "orderTrackingAgent",
    description:
      "Delegate to Order Tracking Agent for order history, tracking, invoices, repeat orders. Use when customer asks about their orders, delivery status, or wants to reorder.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer's order-related question or request",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "customerSupportAgent",
    description:
      "Delegate to Customer Support Agent for complaints, refunds, issues, human operator contact. Use when customer is frustrated, has problems, or explicitly asks for human support.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Customer's support request or issue description",
        },
      },
      required: ["query"],
    },
  },

  // ========================================
  // ROUTER DIRECT FUNCTIONS
  // ========================================
  {
    name: "manageNotifications",
    description:
      "Subscribe or unsubscribe customer from promotional notifications. MUST ask for confirmation before calling!",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["SUBSCRIBE", "UNSUBSCRIBE"],
          description:
            "Action to perform: SUBSCRIBE to enable or UNSUBSCRIBE to disable notifications",
        },
      },
      required: ["action"],
    },
  },

  // ========================================
  // PRODUCT SEARCH AGENT FUNCTIONS
  // NOTE: searchProducts REMOVED - LLM uses {{PRODUCTS}} from prompt only
  // ========================================

  {
    name: "searchProductByCertifications",
    description:
      "Search for products filtered by specific certifications. Use this when customer explicitly asks for certified products (bio, halal, vegan, vegetarian, etc.). Returns products that match ALL specified certifications.",
    parameters: {
      type: "object",
      properties: {
        certifications: {
          type: "array",
          items: { type: "string" },
          description:
            'Certification filters to match (e.g., ["bio", "halal", "vegan", "vegetarian"]). Products must have ALL specified certifications.',
        },
        category: {
          type: "string",
          description: "Optional category ID to further filter results",
        },
        minPrice: {
          type: "number",
          description: "Optional minimum price filter in EUR",
        },
        maxPrice: {
          type: "number",
          description: "Optional maximum price filter in EUR",
        },
      },
      required: ["certifications"],
    },
  },

  {
    name: "searchProductForStatistics",
    description:
      "Save customer's product search query for analytics tracking. Called automatically by ProductSearchAgentLLM. Data retained for 6 months with automatic cleanup. DO NOT call manually - internal use only.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The product search query entered by customer (e.g., 'pasta bio', 'vino rosso')",
        },
      },
      required: ["query"],
    },
  },

  {
    name: "addToCart",
    description:
      "Add a specific product to the customer's cart. Use this when customer explicitly wants to purchase or add a product. Requires product ID from catalog.",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description:
            "Product ID to add (must come from {{PRODUCTS}} catalog)",
        },
        quantity: {
          type: "number",
          description: "Quantity to add (must be greater than 0)",
        },
        notes: {
          type: "string",
          description:
            'Optional customer notes or preferences (e.g., "slice thin", "extra packaging")',
        },
      },
      required: ["productId", "quantity"],
    },
  },

  {
    name: "viewCart",
    description:
      "Display the current cart contents with item details, quantities, and total price. Use when customer asks what's in their cart or wants to review before checkout.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "removeFromCart",
    description:
      "Remove a specific item from the cart. Requires cart item ID from viewCart results.",
    parameters: {
      type: "object",
      properties: {
        cartItemId: {
          type: "string",
          description: "ID of the cart item to remove (from viewCart response)",
        },
      },
      required: ["cartItemId"],
    },
  },

  {
    name: "updateCartQuantity",
    description:
      "Update the quantity of an existing cart item. Set quantity to 0 to remove the item.",
    parameters: {
      type: "object",
      properties: {
        cartItemId: {
          type: "string",
          description: "ID of the cart item to update (from viewCart response)",
        },
        newQuantity: {
          type: "number",
          description:
            "New quantity (0 to remove, must be non-negative integer)",
        },
      },
      required: ["cartItemId", "newQuantity"],
    },
  },

  {
    name: "clearCart",
    description:
      "Empty the entire cart, removing all items. Use when customer explicitly asks to clear, empty, or reset their cart.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "getLastOrderDetails",
    description:
      "Get details of the customer's most recent order including product list, quantities, and prices. Use BEFORE repeatLastOrder to show customer what will be added to cart.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "repeatLastOrder",
    description:
      "Copy all items from the customer's most recent completed order into the current cart. Use AFTER showing order details with getLastOrderDetails and getting customer confirmation.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "getOrderHistory",
    description:
      "Retrieve customer's complete order history with status, tracking info, and invoices. Use when customer asks about 'all orders' or 'order history'.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description:
            "Optional number of orders to return (default: 10, max: 50)",
        },
      },
      required: [],
    },
  },

  {
    name: "getLastOrders",
    description:
      "Get last N orders with summary details (orderCode, date, total, status). Use when customer asks for 'recent orders' or 'last orders' with a specific number.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of orders to return (default: 3, max: 10)",
        },
      },
      required: [],
    },
  },

  {
    name: "getOrderDetails",
    description:
      "Get detailed information about a specific order by order code, or get last order if no code provided. Use when customer asks about a specific order or 'last order'.",
    parameters: {
      type: "object",
      properties: {
        orderCode: {
          type: "string",
          description:
            "Order code (e.g., 'ORD-048-2025-9'). Optional: if empty, returns last order",
        },
      },
      required: [],
    },
  },

  {
    name: "trackOrderStatus",
    description:
      "Track the current status of a specific order. Use when customer asks 'where is my order' or wants to check order status.",
    parameters: {
      type: "object",
      properties: {
        orderCode: {
          type: "string",
          description: "Order code or order ID to track",
        },
      },
      required: ["orderCode"],
    },
  },

  {
    name: "sendInvoice",
    description:
      "Send or resend the invoice for a specific order to customer's email. Use when customer requests invoice, receipt, or proof of purchase.",
    parameters: {
      type: "object",
      properties: {
        orderCode: {
          type: "string",
          description: "Order code or order ID to send invoice for",
        },
        email: {
          type: "string",
          description:
            "Optional: Alternative email address (if different from customer's registered email)",
        },
      },
      required: ["orderCode"],
    },
  },

  {
    name: "contactSupport",
    description:
      "Escalate to human customer support when customer is frustrated, has complex issues, or explicitly requests to speak with a person. Creates a support ticket.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Brief explanation of why support is needed (e.g., 'payment issue', 'delivery problem', 'frustrated customer')",
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description:
            "Urgency level: 'low' for general questions, 'medium' for issues, 'high' for frustrated customers or urgent problems",
        },
      },
      required: ["reason", "urgency"],
    },
  },

  {
    name: "manageNotifications",
    description:
      "Manage customer's push notification subscription for offers and updates. Use when customer explicitly requests to subscribe/unsubscribe from promotional messages or asks about notifications. FLOW: 1) Customer asks ('voglio ricevere offerte', 'iscrivimi', 'subscribe', 'non voglio più notifiche', 'unsubscribe'), 2) Confirm intention, 3) Call this function, 4) Show result message. IMPORTANT: Only call after explicit customer confirmation.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["SUBSCRIBE", "UNSUBSCRIBE"],
          description:
            "Action to perform: SUBSCRIBE to enable push notifications, UNSUBSCRIBE to disable them",
        },
      },
      required: ["action"],
    },
  },

  // ========================================
  // SAFETY & TRANSLATION LAYER FUNCTIONS
  // ========================================
  {
    name: "sendAlertEmail",
    description:
      "Send alert email to administrators when detecting security issues, inappropriate content, data leakage attempts, or system policy violations in conversation.",
    parameters: {
      type: "object",
      properties: {
        alertType: {
          type: "string",
          enum: [
            "security_violation",
            "inappropriate_content",
            "data_leakage",
            "policy_violation",
            "suspicious_behavior",
          ],
          description: "Type of security alert",
        },
        severity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
          description:
            "Severity level: 'low' for minor issues, 'medium' for policy violations, 'high' for security concerns, 'critical' for data breaches",
        },
        description: {
          type: "string",
          description:
            "Detailed description of the issue detected (what triggered the alert)",
        },
        conversationId: {
          type: "string",
          description: "ID of the conversation where issue was detected",
        },
        blockedContent: {
          type: "string",
          description:
            "Optional: The content that was blocked (for review purposes)",
        },
      },
      required: ["alertType", "severity", "description", "conversationId"],
    },
  },
  // 🔄 RESET_ACTIVE_AGENT: Router decides when to reset context
  {
    name: "RESET_ACTIVE_AGENT",
    description:
      "Call this function when the user's query is COMPLETELY DIFFERENT from the previous conversation topic. " +
      "Examples: User was searching products, now asks about orders. User was managing cart, now asks FAQ. " +
      "This resets the conversation context so the Router can route to the correct specialist agent. " +
      "DO NOT call if query is a follow-up to the same topic (e.g., 'show me red shoes' after 'show me shoes').",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description:
            "Brief explanation of why context reset is needed (e.g., 'Topic changed from product search to order tracking')",
        },
      },
      required: ["reason"],
    },
  },
]

/**
 * Convert functions to OpenRouter API format
 */
export function getFunctionsForAPI() {
  return AGENT_FUNCTIONS.map((fn) => ({
    type: "function" as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    },
  }))
}

/**
 * Get functions for Router Agent
 * Includes: delegation functions (sub-agents) + direct utility functions
 */
export function getFunctionsForRouter() {
  // Router Agent can call:
  // 1. Delegation functions (productSearchAgent, cartManagementAgent, orderTrackingAgent, customerSupportAgent)
  // 2. Direct functions (manageNotifications, RESET_ACTIVE_AGENT)
  const routerFunctions = AGENT_FUNCTIONS.filter((fn) => {
    return (
      fn.name.endsWith("Agent") || // Delegation to sub-agents
      fn.name === "manageNotifications" || // Direct notification management
      fn.name === "RESET_ACTIVE_AGENT" // Context reset when topic changes
    )
  })

  return routerFunctions.map((fn) => ({
    type: "function" as const,
    function: {
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    },
  }))
}

/**
 * Get function names for a specific agent type (for UI display)
 * Extracts function names from AGENT_FUNCTIONS based on agent type
 */
export function getFunctionNamesForAgentType(agentType: string): string[] {
  switch (agentType) {
    case "ROUTER":
      // Router has: delegation functions + manageNotifications + RESET_ACTIVE_AGENT
      return AGENT_FUNCTIONS.filter(
        (fn) =>
          fn.name.endsWith("Agent") ||
          fn.name === "manageNotifications" ||
          fn.name === "RESET_ACTIVE_AGENT"
      ).map((fn) => fn.name)

    case "PRODUCT_SEARCH":
      // NOTE: searchProducts removed - LLM uses {{PRODUCTS}} from prompt
      return ["searchProductByCertifications", "searchProductForStatistics"]

    case "CART_MANAGEMENT":
      return [
        "addToCart",
        "viewCart",
        "removeFromCart",
        "updateCartQuantity",
        "clearCart",
        "getLastOrderDetails",
        "repeatLastOrder",
      ]

    case "ORDER_TRACKING":
      return [
        "getOrderHistory",
        "getLastOrders",
        "getOrderDetails",
        "trackOrderStatus",
        "sendInvoice",
        "repeatLastOrder",
      ]

    case "CUSTOMER_SUPPORT":
      return ["contactSupport"]

    case "SAFETY_TRANSLATION":
      return ["sendAlertEmail"]

    default:
      return []
  }
}

/**
 * Get all unique function names across all agents
 */
export function getAllFunctionNames(): string[] {
  return AGENT_FUNCTIONS.map((fn) => fn.name).sort()
}
