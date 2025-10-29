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
  {
    name: "searchProducts",
    description:
      "Search for products in the catalog based on keywords, filters, and customer preferences. Use this when customer asks to find, search, or browse products.",
    parameters: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          description:
            "Search keywords extracted from customer message (product names, categories, etc.)",
        },
        category: {
          type: "string",
          description: "Optional category ID to filter by specific category",
        },
        minPrice: {
          type: "number",
          description: "Optional minimum price filter in EUR",
        },
        maxPrice: {
          type: "number",
          description: "Optional maximum price filter in EUR",
        },
        allergens: {
          type: "array",
          items: { type: "string" },
          description:
            'Optional allergen filters to EXCLUDE (e.g., ["gluten", "lactose", "nuts"])',
        },
        certifications: {
          type: "array",
          items: { type: "string" },
          description:
            'Optional certification filters to INCLUDE (e.g., ["bio", "halal", "vegan", "vegetarian"])',
        },
      },
      required: ["keywords"],
    },
  },

  {
    name: "addToCart",
    description:
      "Add a specific product to the customer's cart. Use this when customer explicitly wants to purchase or add a product. Requires product ID from previous search results.",
    parameters: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description:
            "Product ID to add (must come from previous searchProducts results)",
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
    name: "repeatLastOrder",
    description:
      "Copy all items from the customer's most recent completed order into the current cart. Use when customer wants to reorder or repeat a previous purchase.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },

  {
    name: "getOrders",
    description:
      "Retrieve customer's order history with status, tracking info, and invoices. Use when customer asks about their orders, delivery status, or invoices.",
    parameters: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description:
            "Optional specific order ID to retrieve details for one order",
        },
        limit: {
          type: "number",
          description:
            "Optional number of recent orders to return (default: 10, max: 50)",
        },
      },
      required: [],
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
