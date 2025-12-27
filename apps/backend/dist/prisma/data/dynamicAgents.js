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
exports.dynamicAgents = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const agent_functions_config_1 = require("../../src/config/agent-functions.config");
// Agent types that are SHARED across all workspace types
const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT", "CONVERSATION_HISTORY"];
// Agent types available ONLY for e-commerce workspaces
const ECOMMERCE_ONLY_AGENTS = ["PRODUCT_SEARCH", "ORDER_TRACKING"];
// Map AgentType to template file
const TEMPLATE_FILES = {
    ROUTER: "01-router.template.md",
    PRODUCT_SEARCH: "02-product-search.template.md",
    ORDER_TRACKING: "03-order-tracking.template.md",
    CUSTOMER_SUPPORT: "04-customer-support.template.md",
    PROFILE_MANAGEMENT: "05-profile-management.template.md",
    SECURITY: "06-security.template.md",
    TRANSLATION: "07-translation.template.md",
    SUMMARY_AGENT: "08-summary.template.md",
    CONVERSATION_HISTORY: "09-conversation-history.template.md",
};
/**
 * Determine which subdirectory to load template from
 */
function getTemplateSubDir(agentType, hasEcommerce) {
    if (SHARED_AGENTS.includes(agentType))
        return "shared";
    if (ECOMMERCE_ONLY_AGENTS.includes(agentType))
        return "ecommerce";
    return hasEcommerce ? "ecommerce" : "informational";
}
/**
 * Load template from src/templates/ directory
 * Templates are organized by workspace type:
 *   - shared/     → Security, Translation, Summary
 *   - ecommerce/  → ProductSearch, OrderTracking, and e-commerce Router/Support
 *   - informational/ → Info-only Router/Support
 */
function loadTemplate(agentType, hasEcommerce = true) {
    const filename = TEMPLATE_FILES[agentType];
    if (!filename) {
        throw new Error(`No template defined for agent type: ${agentType}`);
    }
    const subDir = getTemplateSubDir(agentType, hasEcommerce);
    const templatePath = path.join(__dirname, "../../src/templates", subDir, filename);
    try {
        return fs.readFileSync(templatePath, "utf-8");
    }
    catch (error) {
        // Fallback to root templates folder for backward compatibility
        const fallbackPath = path.join(__dirname, "../../src/templates", filename);
        try {
            console.warn(`⚠️ Using fallback template for ${agentType} (not in ${subDir}/)`);
            return fs.readFileSync(fallbackPath, "utf-8");
        }
        catch (_a) {
            console.error(`❌ Failed to load template: ${filename}`, error);
            throw new Error(`Failed to load template file: ${filename}`);
        }
    }
}
/**
 * Get dynamic agent configurations with Handlebars templates
 * Templates are loaded from different folders based on workspace type:
 *   - ecommerce/  → Full e-commerce functionality
 *   - informational/ → Info-only, no sales
 *   - shared/     → Common agents (Security, Translation, Summary)
 *
 * @param workspaceId - Workspace ID
 * @param hasEcommerce - Whether workspace sells products/services (default: true)
 */
const dynamicAgents = (workspaceId, hasEcommerce = true) => {
    // Base agents available for ALL workspaces
    const baseAgents = [
        // ROUTER AGENT (order: 0)
        {
            workspaceId,
            name: "Router Agent",
            type: "ROUTER",
            icon: "GitBranch",
            description: "Dynamic routing with conditional logic based on workspace settings",
            systemPrompt: loadTemplate("ROUTER", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0,
            maxTokens: 500,
            order: 0,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("ROUTER"),
        },
        // CUSTOMER SUPPORT AGENT (order: 4)
        {
            workspaceId,
            name: "Customer Support Agent",
            type: "CUSTOMER_SUPPORT",
            icon: "Headset",
            description: "Customer support with conditional human escalation",
            systemPrompt: loadTemplate("CUSTOMER_SUPPORT", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0.3,
            maxTokens: 2048,
            order: 4,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("CUSTOMER_SUPPORT"),
        },
        // SUMMARY AGENT (order: 5) - Shared
        {
            workspaceId,
            name: "Summary Agent",
            type: "SUMMARY_AGENT",
            icon: "FileText",
            description: "Conversation summary for operator emails",
            systemPrompt: loadTemplate("SUMMARY_AGENT", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0.2,
            maxTokens: 500,
            order: 5,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("SUMMARY_AGENT"),
        },
        // PROFILE MANAGEMENT AGENT (order: 6)
        {
            workspaceId,
            name: "Profile Management Agent",
            type: "PROFILE_MANAGEMENT",
            icon: "User",
            description: "Profile and notification management",
            systemPrompt: loadTemplate("PROFILE_MANAGEMENT", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0.4,
            maxTokens: 500,
            order: 6,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("PROFILE_MANAGEMENT"),
        },
        // FORMAT AND TRANSLATION AGENT (order: 7) - Shared
        {
            workspaceId,
            name: "Format and Translation Agent",
            type: "TRANSLATION",
            icon: "Globe",
            description: "Format for WhatsApp and translate to customer language",
            systemPrompt: loadTemplate("TRANSLATION", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0.1,
            maxTokens: 1024,
            order: 7,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("TRANSLATION"),
        },
        // CONVERSATION HISTORY LAYER (order: 8) - Shared
        // Umanizza le risposte tecniche, aggiunge contesto, saluti, offerte
        {
            workspaceId,
            name: "Conversation History Layer",
            type: "CONVERSATION_HISTORY",
            icon: "MessageCircle",
            description: "Umanizza risposte con contesto, saluti, offerte",
            systemPrompt: loadTemplate("CONVERSATION_HISTORY", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0.7, // Più creativo per umanizzare
            maxTokens: 500,
            order: 8, // Dopo agent funzionali, prima di Security
            isActive: true,
            availableFunctions: null, // Non chiama funzioni
        },
        // SECURITY AGENT (order: 99) - Shared
        {
            workspaceId,
            name: "Security Agent",
            type: "SECURITY",
            icon: "Shield",
            description: "Security validation with conditional external links",
            systemPrompt: loadTemplate("SECURITY", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0,
            maxTokens: 500,
            order: 99,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("SECURITY"),
        },
    ];
    // E-commerce only agents
    const ecommerceAgents = hasEcommerce ? [
        // PRODUCT SEARCH AGENT (order: 1)
        {
            workspaceId,
            name: "Product Search Agent",
            type: "PRODUCT_SEARCH",
            icon: "Search",
            description: "Product catalog search with dynamic template",
            systemPrompt: loadTemplate("PRODUCT_SEARCH", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0,
            maxTokens: 2048,
            order: 1,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("PRODUCT_SEARCH"),
        },
        // CART MANAGEMENT AGENT (order: 2)
        {
            workspaceId,
            name: "Cart Management Agent",
            type: "CART_MANAGEMENT",
            icon: "ShoppingCart",
            description: "Cart operations with dynamic template",
            systemPrompt: loadTemplate("PRODUCT_SEARCH", hasEcommerce), // Cart uses same base
            model: "openai/gpt-4o-mini",
            temperature: 0.3,
            maxTokens: 2048,
            order: 2,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("CART_MANAGEMENT"),
        },
        // ORDER TRACKING AGENT (order: 3)
        {
            workspaceId,
            name: "Order Tracking Agent",
            type: "ORDER_TRACKING",
            icon: "Package",
            description: "Order tracking with dynamic template",
            systemPrompt: loadTemplate("ORDER_TRACKING", hasEcommerce),
            model: "openai/gpt-4o-mini",
            temperature: 0.3,
            maxTokens: 2048,
            order: 3,
            isActive: true,
            availableFunctions: (0, agent_functions_config_1.getAgentFunctionNames)("ORDER_TRACKING"),
        },
    ] : [];
    return [...baseAgents, ...ecommerceAgents];
};
exports.dynamicAgents = dynamicAgents;
//# sourceMappingURL=dynamicAgents.js.map