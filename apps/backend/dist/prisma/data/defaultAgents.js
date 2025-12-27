"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultAgents = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const agent_functions_config_1 = require("../../src/config/agent-functions.config");
/**
 * Load prompt from markdown file
 * @param filename - Name of the markdown file in docs/prompts/ or templates/
 * @param subdir - Optional subdirectory (e.g., 'shared' for templates/shared/)
 * @returns Prompt content as string
 */
function loadPrompt(filename, subdir) {
    // Default: docs/prompts/
    // With subdir "shared": src/templates/shared/
    let promptPath;
    if (subdir === "shared") {
        promptPath = path.join(__dirname, "../../src/templates/shared", filename);
    }
    else {
        promptPath = path.join(__dirname, "../../../../docs/prompts", filename);
    }
    try {
        return fs.readFileSync(promptPath, "utf-8");
    }
    catch (error) {
        console.error(`❌ Failed to load prompt: ${filename} (path: ${promptPath})`, error);
        throw new Error(`Failed to load prompt file: ${filename}`);
    }
}
const defaultAgents = (workspaceId) => [
    // ====================================================================
    // ROUTER AGENT (order: 0) - Entry point, FAQ + Intent Classification
    // ====================================================================
    // ROUTER AGENT (order: 0) - Pure orchestration + context interpretation
    // ====================================================================
    {
        workspaceId,
        name: "Router Agent",
        type: "ROUTER",
        icon: "GitBranch",
        description: "Pure orchestration: intent classification, context interpretation for short responses (with CONFERMA keyword), and FAQ handling",
        systemPrompt: loadPrompt("router-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0, // ✅ Zero temperature = fully deterministic routing (no creativity needed)
        maxTokens: 500, // ✅ JSON response only
        order: 0,
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("ROUTER"),
    },
    // ====================================================================
    // PRODUCT SEARCH AGENT (order: 1) - Product catalog expert with progressive filtering
    // ====================================================================
    {
        workspaceId,
        name: "Product Search Agent",
        type: "PRODUCT_SEARCH",
        icon: "Search",
        description: "Specialist in product search with progressive filtering strategy (Regola 11): guides customers from categories to specific products",
        systemPrompt: loadPrompt("product-search-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0, // ✅ Zero temperature = deterministic, reads exact data from {{PRODUCTS}} (no hallucination)
        maxTokens: 2048,
        order: 1,
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("PRODUCT_SEARCH"),
    },
    // ====================================================================
    // CART MANAGEMENT AGENT (order: 2) - Cart operations expert
    // ====================================================================
    {
        workspaceId,
        name: "Cart Management Agent",
        type: "CART_MANAGEMENT",
        icon: "ShoppingCart",
        description: "Specialist in cart operations: add/remove products, repeat orders, manage quantities",
        systemPrompt: loadPrompt("cart-management-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 2048,
        order: 2,
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("CART_MANAGEMENT"),
    },
    // ====================================================================
    // ORDER TRACKING AGENT (order: 3) - Order history and tracking expert
    // ====================================================================
    {
        workspaceId,
        name: "Order Tracking Agent",
        type: "ORDER_TRACKING",
        icon: "Package",
        description: "Specialist in order tracking, history, invoices, and delivery status",
        systemPrompt: loadPrompt("order-tracking-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 2048,
        order: 3,
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("ORDER_TRACKING"),
    },
    // ====================================================================
    // CUSTOMER SUPPORT AGENT (order: 4) - Human escalation and support
    // ====================================================================
    {
        workspaceId,
        name: "Customer Support Agent",
        type: "CUSTOMER_SUPPORT",
        icon: "Headset",
        description: "Specialist in customer support, human escalation, complaints, and urgent issues",
        systemPrompt: loadPrompt("customer-support-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 2048,
        order: 4,
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("CUSTOMER_SUPPORT"),
    },
    // ====================================================================
    // SUMMARY AGENT (order: 5) - Conversation summarization for email notifications
    // ====================================================================
    {
        workspaceId,
        name: "Summary Agent",
        type: "SUMMARY_AGENT",
        icon: "FileText",
        description: "Specialist in creating concise conversation summaries for support team email notifications",
        systemPrompt: loadPrompt("summary-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0.2, // Low temperature for consistent, factual summaries
        maxTokens: 500, // 250 words ≈ 350-500 tokens
        order: 5,
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("SUMMARY_AGENT"),
    },
    // ====================================================================
    // PROFILE MANAGEMENT AGENT (order: 7) - Customer profile & notifications
    // ====================================================================
    {
        workspaceId,
        name: "Profile Management Agent",
        type: "PROFILE_MANAGEMENT",
        icon: "User",
        description: "Specialist in managing customer profile information and notification preferences (enable/disable push notifications)",
        systemPrompt: loadPrompt("profile-management-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0.4,
        maxTokens: 500,
        order: 7, // ✅ Changed from 6 to 7 to make room for Summary Agent
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("PROFILE_MANAGEMENT"),
    },
    // ====================================================================
    // FORMAT AND TRANSLATION AGENT (order: 7) - Format and translate to customer language
    // ====================================================================
    {
        workspaceId,
        name: "Format and Translation Agent",
        type: "TRANSLATION",
        icon: "Globe",
        description: "Format and translation layer: formats responses for WhatsApp and translates to customer language (Italian, Spanish, Portuguese, English)",
        systemPrompt: loadPrompt("translation-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0.1, // Very low for consistency
        maxTokens: 1024,
        order: 7, // After Profile Management (6)
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("TRANSLATION"),
    },
    // ====================================================================
    // CONVERSATION HISTORY LAYER (order: 8) - Humanization layer
    // ====================================================================
    {
        workspaceId,
        name: "Conversation History Layer",
        type: "CONVERSATION_HISTORY",
        icon: "MessageCircle",
        description: "Humanization layer: transforms technical responses into natural, contextual messages with greetings, offers suggestions, and personality",
        systemPrompt: loadPrompt("09-conversation-history.template.md", "shared"),
        model: "openai/gpt-4o-mini",
        temperature: 0.7, // Higher for creativity and natural language
        maxTokens: 500,
        order: 8, // After Translation (7)
        isActive: true,
        availableFunctions: null, // No function calls - pure text transformation
    },
    // ====================================================================
    // SECURITY AGENT (order: 99) - Security validation and content moderation
    // ====================================================================
    {
        workspaceId,
        name: "Security Agent",
        type: "SECURITY",
        icon: "Shield",
        description: "Security validation: detects dangerous content, SQL injection, XSS, offensive language. Blocks unsafe messages completely (no send, shows 🚫 icon)",
        systemPrompt: loadPrompt("security-agent.md"),
        model: "openai/gpt-4o-mini",
        temperature: 0, // Zero temperature = deterministic security checks
        maxTokens: 500, // Security checks don't need long responses
        order: 99, // Last - final security check before sending
        isActive: true,
        availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("SECURITY"),
    },
];
exports.defaultAgents = defaultAgents;
//# sourceMappingURL=defaultAgents.js.map