"use strict";
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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTriageAgent = exports.createSupportAgent = exports.createOrderAgent = exports.createCartAgent = exports.createProductAgent = void 0;
exports.createAgentSystem = createAgentSystem;
const agents_1 = require("@openai/agents");
const tools_1 = require("./tools");
const logger_1 = __importDefault(require("../../utils/logger"));
// ============================================================================
// SPECIALIZED AGENTS
// ============================================================================
/**
 * Product Search Agent
 * Handles product queries, catalog browsing, and search
 */
const createProductAgent = (systemPrompt) => {
    return new agents_1.Agent({
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
        tools: tools_1.productAgentTools,
    });
};
exports.createProductAgent = createProductAgent;
/**
 * Cart Management Agent
 * Handles adding/removing items, viewing cart, checkout preparation
 */
const createCartAgent = (systemPrompt) => {
    return new agents_1.Agent({
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
        tools: tools_1.cartAgentTools,
    });
};
exports.createCartAgent = createCartAgent;
/**
 * Order Tracking Agent
 * Handles order history, tracking, and reordering
 */
const createOrderAgent = (systemPrompt) => {
    return new agents_1.Agent({
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
        tools: tools_1.orderAgentTools,
    });
};
exports.createOrderAgent = createOrderAgent;
/**
 * Customer Support Agent
 * Handles FAQs, services, profile, and human handoff
 */
const createSupportAgent = (systemPrompt) => {
    return new agents_1.Agent({
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
        tools: tools_1.supportAgentTools,
    });
};
exports.createSupportAgent = createSupportAgent;
// ============================================================================
// TRIAGE AGENT (Main Router)
// ============================================================================
/**
 * Triage Agent
 * Main entry point that routes to specialized agents
 */
const createTriageAgent = (productAgent, cartAgent, orderAgent, supportAgent, systemPrompt) => {
    return agents_1.Agent.create({
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
    });
};
exports.createTriageAgent = createTriageAgent;
// ============================================================================
// FACTORY FUNCTION
// ============================================================================
/**
 * Create the complete multi-agent system
 * Loads prompts from database if available
 */
function createAgentSystem(prisma, workspaceId) {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.default.info(`🤖 Creating agent system for workspace: ${workspaceId}`);
        // Load prompts from database (agentConfig table)
        const agentConfigs = yield prisma.agentConfig.findMany({
            where: {
                workspaceId,
                isActive: true,
            },
        });
        const getPromptByType = (type) => {
            const config = agentConfigs.find((c) => c.type === type);
            return config === null || config === void 0 ? void 0 : config.systemPrompt;
        };
        // Create specialized agents with DB prompts or defaults
        const productAgent = (0, exports.createProductAgent)(getPromptByType("PRODUCT_SEARCH"));
        const cartAgent = (0, exports.createCartAgent)(getPromptByType("CART_MANAGEMENT"));
        const orderAgent = (0, exports.createOrderAgent)(getPromptByType("ORDER_TRACKING"));
        const supportAgent = (0, exports.createSupportAgent)(getPromptByType("CUSTOMER_SUPPORT"));
        // Create triage agent with all handoffs
        const triageAgent = (0, exports.createTriageAgent)(productAgent, cartAgent, orderAgent, supportAgent, getPromptByType("ROUTER"));
        logger_1.default.info(`✅ Agent system created with ${agentConfigs.length} custom prompts`);
        return {
            triageAgent,
            productAgent,
            cartAgent,
            orderAgent,
            supportAgent,
        };
    });
}
//# sourceMappingURL=agents.js.map