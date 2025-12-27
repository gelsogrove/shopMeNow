"use strict";
/**
 * PromptRenderService - On-Demand Prompt Generation
 *
 * This service handles the 2-step prompt generation:
 * STEP 1: RENDER - Compile {{#if}} conditionals with workspace settings
 * STEP 2: REPLACE - Substitute {{variables}} with runtime data
 *
 * Templates are loaded from /apps/backend/src/templates/{ecommerce|informational}/
 * Prompts are generated FRESH at every LLM call (not stored in DB)
 */
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
exports.PromptRenderService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const template_engine_service_1 = require("./prompt-builder/template-engine.service");
const prompt_processor_service_1 = require("../../services/prompt-processor.service");
const logger_1 = __importDefault(require("../../utils/logger"));
// Template file mapping by agent type
const TEMPLATE_FILES = {
    ROUTER: "01-router.template.md",
    PRODUCT_SEARCH: "02-product-search.template.md",
    ORDER_TRACKING: "03-order-tracking.template.md",
    CART_MANAGEMENT: "03-order-tracking.template.md", // Uses order tracking template for cart context
    CUSTOMER_SUPPORT: "04-customer-support.template.md",
    PROFILE_MANAGEMENT: "05-profile-management.template.md",
    SECURITY: "06-security.template.md",
    TRANSLATION: "07-translation.template.md",
    SUMMARY_AGENT: "08-summary.template.md",
};
// Agents available per workspace type
const ECOMMERCE_AGENTS = [
    "ROUTER",
    "PRODUCT_SEARCH",
    "ORDER_TRACKING",
    "CART_MANAGEMENT",
    "CUSTOMER_SUPPORT",
    "PROFILE_MANAGEMENT",
];
const INFORMATIONAL_AGENTS = [
    "ROUTER",
    "CUSTOMER_SUPPORT",
    "PROFILE_MANAGEMENT",
];
// Shared agents (always loaded from root templates)
const SHARED_AGENTS = ["SECURITY", "TRANSLATION", "SUMMARY_AGENT"];
// Template cache (invalidated on server restart)
const templateCache = new Map();
class PromptRenderService {
    constructor(prisma) {
        this.prisma = prisma;
        this.templateEngine = new template_engine_service_1.TemplateEngineService();
        this.promptProcessor = new prompt_processor_service_1.PromptProcessorService();
    }
    /**
     * Generate prompt on-demand for an agent
     *
     * @param agentType - Type of agent (ROUTER, PRODUCT_SEARCH, etc.)
     * @param context - Render context with workspaceId, customerId, etc.
     * @returns Final prompt ready for LLM
     */
    renderPrompt(agentType, context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = Date.now();
            try {
                // 1. Load workspace settings (for conditionals)
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: context.workspaceId },
                });
                if (!workspace) {
                    throw new Error(`Workspace not found: ${context.workspaceId}`);
                }
                // 2. Load template from file (cached)
                const template = yield this.loadTemplate(agentType, (_a = workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true);
                // 3. STEP 1: RENDER - Process conditionals
                const conditionalValues = this.buildConditionalValues(workspace);
                const renderedTemplate = this.templateEngine.process(template, conditionalValues);
                // 4. STEP 2: REPLACE - Substitute variables
                const finalPrompt = yield this.replaceVariables(renderedTemplate, context, workspace);
                const elapsed = Date.now() - startTime;
                logger_1.default.debug(`📝 Prompt rendered for ${agentType} in ${elapsed}ms (${finalPrompt.length} chars)`);
                return finalPrompt;
            }
            catch (error) {
                logger_1.default.error(`❌ Failed to render prompt for ${agentType}:`, error);
                throw error;
            }
        });
    }
    /**
     * Load template from file system (with caching)
     */
    loadTemplate(agentType, isEcommerce) {
        return __awaiter(this, void 0, void 0, function* () {
            const templateFile = TEMPLATE_FILES[agentType];
            if (!templateFile) {
                throw new Error(`Unknown agent type: ${agentType}`);
            }
            // Determine folder based on agent type and workspace type
            let folder;
            if (SHARED_AGENTS.includes(agentType)) {
                // Shared agents use root templates folder
                folder = "";
            }
            else if (isEcommerce) {
                folder = "ecommerce";
            }
            else {
                folder = "informational";
            }
            const cacheKey = `${folder}/${templateFile}`;
            // Check cache first
            if (templateCache.has(cacheKey)) {
                return templateCache.get(cacheKey);
            }
            // Load from file
            const templatePath = folder
                ? path.join(__dirname, "..", "..", "templates", folder, templateFile)
                : path.join(__dirname, "..", "..", "templates", templateFile);
            try {
                const content = fs.readFileSync(templatePath, "utf-8");
                templateCache.set(cacheKey, content);
                logger_1.default.debug(`📂 Loaded template: ${cacheKey}`);
                return content;
            }
            catch (error) {
                // Fallback: try shared templates folder for non-existent informational templates
                if (folder === "informational") {
                    const fallbackPath = path.join(__dirname, "..", "..", "templates", "ecommerce", templateFile);
                    try {
                        const content = fs.readFileSync(fallbackPath, "utf-8");
                        templateCache.set(cacheKey, content);
                        logger_1.default.warn(`⚠️ Used ecommerce fallback for informational template: ${templateFile}`);
                        return content;
                    }
                    catch (_a) {
                        // Continue to throw original error
                    }
                }
                throw new Error(`Template not found: ${templatePath}`);
            }
        });
    }
    /**
     * Build conditional values from workspace settings
     */
    buildConditionalValues(workspace) {
        var _a, _b, _c;
        return {
            sellsProductsAndServices: (_a = workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true,
            hasHumanSupport: (_b = workspace.hasHumanSupport) !== null && _b !== void 0 ? _b : false,
            hasSalesAgents: (_c = workspace.hasSalesAgents) !== null && _c !== void 0 ? _c : false,
            // Add any additional conditional flags here
        };
    }
    /**
     * Replace all variables in the rendered template
     */
    replaceVariables(template, context, workspace // Using any for workspace to avoid type issues
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            // If no customer context, just replace workspace variables
            if (!context.customerId) {
                return this.replaceWorkspaceVariables(template, workspace);
            }
            // Get customer data
            const customer = yield this.prisma.customers.findUnique({
                where: { id: context.customerId },
            });
            if (!customer) {
                logger_1.default.warn(`Customer not found: ${context.customerId}, using workspace-only replacement`);
                return this.replaceWorkspaceVariables(template, workspace);
            }
            // Get dynamic content (products, categories, etc.)
            const dynamicContent = yield this.getDynamicContent(context.workspaceId);
            // Build workspace config for variable replacement
            const workspaceConfig = {
                sellsProductsAndServices: (_a = workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true,
                toneOfVoice: workspace.toneOfVoice,
                botIdentityResponse: workspace.botIdentityResponse,
                hasHumanSupport: (_b = workspace.hasHumanSupport) !== null && _b !== void 0 ? _b : false,
                humanSupportInstructions: workspace.humanSupportInstructions,
                operatorContactMethod: workspace.operatorContactMethod,
                operatorWhatsappNumber: workspace.operatorWhatsappNumber,
                hasSalesAgents: (_c = workspace.hasSalesAgents) !== null && _c !== void 0 ? _c : false,
                adminEmail: workspace.adminEmail,
                allowedExternalLinks: workspace.allowedExternalLinks,
                address: workspace.address,
                customAiRules: workspace.customAiRules,
            };
            // Use PromptProcessorService for full variable replacement
            try {
                const processedPrompt = yield this.promptProcessor.preProcessPrompt(template, context.workspaceId, customer, // Pass full customer object
                dynamicContent, workspace.url, workspaceConfig);
                return processedPrompt;
            }
            catch (error) {
                logger_1.default.error(`Error in variable replacement:`, error);
                // Fallback to workspace-only replacement
                return this.replaceWorkspaceVariables(template, workspace);
            }
        });
    }
    /**
     * Get dynamic content (products, categories, FAQs, etc.)
     */
    getDynamicContent(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get FAQs
                const faqs = yield this.prisma.fAQ.findMany({
                    where: { workspaceId, isActive: true },
                    orderBy: { order: "asc" },
                });
                const faqsText = faqs.length > 0
                    ? faqs.map(f => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")
                    : "No FAQs available";
                // Get Products (use isActive filter - no soft delete on Products)
                const products = yield this.prisma.products.findMany({
                    where: { workspaceId, isActive: true },
                    include: { category: true },
                    orderBy: { name: "asc" },
                });
                const productsText = products.length > 0
                    ? products.map(p => `- ${p.name}: ${p.description || ""} (${p.price}€)`).join("\n")
                    : "No products available";
                // Get Categories (no soft delete on Categories)
                const categories = yield this.prisma.categories.findMany({
                    where: { workspaceId },
                    orderBy: { name: "asc" },
                });
                const categoriesText = categories.length > 0
                    ? categories.map(c => `- ${c.name}`).join("\n")
                    : "No categories available";
                // Get Services (no soft delete on Services)  
                const services = yield this.prisma.services.findMany({
                    where: { workspaceId, isActive: true },
                    orderBy: { name: "asc" },
                });
                const servicesText = services.length > 0
                    ? services.map(s => `- ${s.name}: ${s.description || ""}`).join("\n")
                    : "No services available";
                // Get Offers (check isActive and date range)
                const now = new Date();
                const offers = yield this.prisma.offers.findMany({
                    where: {
                        workspaceId,
                        isActive: true,
                    },
                    orderBy: { createdAt: "desc" },
                });
                // Filter valid offers by endDate
                const validOffers = offers.filter(o => {
                    if (!o.endDate)
                        return true;
                    return new Date(o.endDate) >= now;
                });
                const offersText = validOffers.length > 0
                    ? validOffers.map(o => `- ${o.name}: ${o.description || ""}`).join("\n")
                    : "No active offers";
                return {
                    faqs: faqsText,
                    products: productsText,
                    categories: categoriesText,
                    services: servicesText,
                    offers: offersText,
                };
            }
            catch (error) {
                logger_1.default.error(`Error getting dynamic content for workspace ${workspaceId}:`, error);
                return {
                    faqs: "Error loading FAQs",
                    products: "Error loading products",
                    categories: "Error loading categories",
                    services: "Error loading services",
                    offers: "Error loading offers",
                };
            }
        });
    }
    /**
     * Replace only workspace-level variables (when no customer context)
     */
    replaceWorkspaceVariables(template, workspace) {
        const companyName = workspace.companyName || workspace.name || "";
        return template
            .replace(/\{\{companyName\}\}/g, companyName)
            .replace(/\{\{workspaceName\}\}/g, workspace.name || "")
            .replace(/\{\{url\}\}/g, workspace.url || "")
            .replace(/\{\{address\}\}/g, workspace.address || "")
            .replace(/\{\{customAiRules\}\}/g, workspace.customAiRules || "")
            .replace(/\{\{botIdentityResponse\}\}/g, workspace.botIdentityResponse || "")
            .replace(/\{\{humanSupportInstructions\}\}/g, workspace.humanSupportInstructions || "");
    }
    /**
     * Clear template cache (for testing or hot reload)
     */
    static clearCache() {
        templateCache.clear();
        logger_1.default.info("🗑️ Template cache cleared");
    }
    /**
     * Check if an agent type is available for a workspace type
     */
    static isAgentAvailable(agentType, isEcommerce) {
        if (SHARED_AGENTS.includes(agentType)) {
            return true;
        }
        if (isEcommerce) {
            return ECOMMERCE_AGENTS.includes(agentType);
        }
        return INFORMATIONAL_AGENTS.includes(agentType);
    }
}
exports.PromptRenderService = PromptRenderService;
//# sourceMappingURL=prompt-render.service.js.map