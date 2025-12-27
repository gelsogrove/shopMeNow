"use strict";
/**
 * PromptBuilderService - Dynamic Prompt Generation
 *
 * 🎯 THE HEART OF THE PROJECT
 *
 * This service generates prompts DYNAMICALLY at runtime based on:
 * - Workspace configuration (sellsProductsAndServices, hasHumanSupport, etc.)
 * - Customer context (name, language, discount, etc.)
 * - Dynamic data (products, offers, FAQs, etc.)
 *
 * Architecture:
 * - TemplateLoaderService: Loads base templates from filesystem
 * - VariableResolverService: Collects all 35+ variables from DB
 * - TemplateEngineService: Replaces {{var}} and handles {{#if}}
 *
 * Single Responsibility: Each LLM gets ONLY its relevant prompt.
 * - Router: decides which agent to call
 * - ProductSearch: searches products, manages cart
 * - OrderTracking: manages existing orders
 * - CustomerSupport: handles complaints, escalation
 * - ProfileManagement: manages profile, notifications
 * - Security: validates message safety
 * - Translation: translates + formats final response
 * - Summary: summarizes conversation for operator email
 *
 * @critical NEVER mix responsibilities between agents
 * @critical ALWAYS generate at runtime for fresh data
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
exports.PromptBuilderService = void 0;
const logger_1 = __importDefault(require("../../../utils/logger"));
const template_loader_service_1 = require("./template-loader.service");
const variable_resolver_service_1 = require("./variable-resolver.service");
const template_engine_service_1 = require("./template-engine.service");
class PromptBuilderService {
    constructor(prisma) {
        this.prisma = prisma;
        this.templateLoader = new template_loader_service_1.TemplateLoaderService();
        this.variableResolver = new variable_resolver_service_1.VariableResolverService(prisma);
        this.templateEngine = new template_engine_service_1.TemplateEngineService();
        logger_1.default.info("✅ PromptBuilderService initialized");
    }
    /**
     * Build prompt for a specific agent type
     *
     * @param agentType - Which agent needs the prompt
     * @param context - Workspace and customer context
     * @returns Generated prompt ready for LLM
     */
    build(agentType, context) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = Date.now();
            logger_1.default.info(`🔨 Building prompt for ${agentType}`, {
                workspaceId: context.workspaceId,
                customerId: context.customerId,
            });
            try {
                // 0. Get workspace config to determine template folder
                const workspace = yield this.prisma.workspace.findUnique({
                    where: { id: context.workspaceId },
                    select: { sellsProductsAndServices: true },
                });
                const hasEcommerce = (_a = workspace === null || workspace === void 0 ? void 0 : workspace.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true;
                // 1. Load base template for this agent (from correct folder based on workspace type)
                const template = yield this.templateLoader.load(agentType, hasEcommerce);
                // 2. Resolve all variables needed for this agent
                const variables = yield this.variableResolver.resolve(agentType, context.workspaceId, context.customerId);
                // 3. Apply template engine (replace variables, handle conditionals)
                const content = this.templateEngine.process(template, variables);
                // 🔴 ZERO SECTION: Custom AI Rules (ABSOLUTE PRIORITY - prepended to prompt)
                const customAiRules = variables.customAiRules || "";
                const finalContent = customAiRules
                    ? `🔴 CUSTOM AI RULES (ABSOLUTE PRIORITY - Override all default instructions):
${customAiRules}

---

${content}`
                    : content;
                const executionTime = Date.now() - startTime;
                logger_1.default.info(`✅ Prompt built for ${agentType} in ${executionTime}ms`, {
                    templateLength: template.length,
                    contentLength: finalContent.length,
                    variablesCount: Object.keys(variables).length,
                    hasCustomRules: !!customAiRules,
                });
                return {
                    content: finalContent,
                    agentType,
                    variables,
                    generatedAt: new Date(),
                };
            }
            catch (error) {
                logger_1.default.error(`❌ Failed to build prompt for ${agentType}:`, error);
                throw error;
            }
        });
    }
    /**
     * Build Router prompt (most common use case)
     */
    buildRouterPrompt(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.build("ROUTER", context);
            return result.content;
        });
    }
    /**
     * Build prompt for specialist agent
     */
    buildAgentPrompt(agentType, context) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.build(agentType, context);
            return result.content;
        });
    }
    /**
     * Check if an agent should be available based on workspace config
     */
    isAgentAvailable(agentType, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const workspace = yield this.prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    sellsProductsAndServices: true,
                    hasHumanSupport: true,
                    hasSalesAgents: true,
                },
            });
            if (!workspace)
                return false;
            // Agents that require e-commerce
            const ecommerceAgents = [
                "PRODUCT_SEARCH",
                "ORDER_TRACKING",
            ];
            // Agents that require human support
            const humanSupportAgents = [
                "SUMMARY_AGENT",
            ];
            if (ecommerceAgents.includes(agentType)) {
                return workspace.sellsProductsAndServices === true;
            }
            if (humanSupportAgents.includes(agentType)) {
                return workspace.hasHumanSupport === true;
            }
            // Always available: ROUTER, CUSTOMER_SUPPORT, PROFILE_MANAGEMENT, SECURITY, TRANSLATION
            return true;
        });
    }
    /**
     * Get list of available agents for a workspace
     */
    getAvailableAgents(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            const allAgents = [
                "ROUTER",
                "PRODUCT_SEARCH",
                "ORDER_TRACKING",
                "CUSTOMER_SUPPORT",
                "PROFILE_MANAGEMENT",
                "SECURITY",
                "TRANSLATION",
                "SUMMARY_AGENT",
            ];
            const available = [];
            for (const agent of allAgents) {
                if (yield this.isAgentAvailable(agent, workspaceId)) {
                    available.push(agent);
                }
            }
            return available;
        });
    }
}
exports.PromptBuilderService = PromptBuilderService;
//# sourceMappingURL=prompt-builder.service.js.map