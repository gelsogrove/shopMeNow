"use strict";
/**
 * PromptVariableBuilder - Centralized Variable Construction
 *
 * SINGLE POINT where all prompt variables are constructed.
 *
 * RULES:
 * 1. Router calls build() ONCE at the start of message processing
 * 2. The result is passed to ALL sub-agents via context.promptVariables
 * 3. Sub-agents NEVER query DB for this data - they use what Router provides
 * 4. preProcessPrompt() receives this object and does ONLY string replacement
 *
 * BENEFITS:
 * - Single DB query for all variables (no N+1)
 * - Consistent variable names across all agents
 * - Easy to test and debug
 * - Clear contract between Router and sub-agents
 *
 * @see PromptVariables for variable definitions
 * @see preProcessPrompt() for substitution logic
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
exports.PromptVariableBuilder = void 0;
const prompt_variables_types_1 = require("../../types/prompt-variables.types");
const logger_1 = __importDefault(require("../../utils/logger"));
/**
 * PromptVariableBuilder - Centralized Variable Construction
 */
class PromptVariableBuilder {
    /**
     * Build all prompt variables from input data
     *
     * @param customer - Customer data from database
     * @param workspace - Workspace data from database
     * @param dynamicContent - Optional products/categories/etc.
     * @param context - Optional context (lastOrderCode, etc.)
     * @param options - Build options
     * @returns Complete PromptVariables object
     *
     * @example
     * const variables = PromptVariableBuilder.build(customer, workspace, { products, categories })
     * const processedPrompt = await preProcessPrompt(template, variables)
     */
    static build(customer, workspace, dynamicContent, context, options) {
        var _a, _b, _c, _d, _e, _f, _g;
        // Start with defaults
        const variables = Object.assign({ 
            // Customer variables
            customerName: (customer === null || customer === void 0 ? void 0 : customer.name) || prompt_variables_types_1.VARIABLE_DEFAULTS.customerName, customerPhone: (customer === null || customer === void 0 ? void 0 : customer.phone) || '', customerEmail: (customer === null || customer === void 0 ? void 0 : customer.email) || '', customerDiscount: (customer === null || customer === void 0 ? void 0 : customer.discount) || 0, languageUser: this.getLanguageDisplayName((customer === null || customer === void 0 ? void 0 : customer.language) || (workspace === null || workspace === void 0 ? void 0 : workspace.language) || 'it'), pushNotificationsConsent: (_a = customer === null || customer === void 0 ? void 0 : customer.push_notifications_consent) !== null && _a !== void 0 ? _a : undefined, 
            // Sales agent variables
            agentName: (customer === null || customer === void 0 ? void 0 : customer.sales)
                ? `${customer.sales.firstName || ''} ${customer.sales.lastName || ''}`.trim() || prompt_variables_types_1.VARIABLE_DEFAULTS.agentName
                : prompt_variables_types_1.VARIABLE_DEFAULTS.agentName, agentPhone: ((_b = customer === null || customer === void 0 ? void 0 : customer.sales) === null || _b === void 0 ? void 0 : _b.phone) || prompt_variables_types_1.VARIABLE_DEFAULTS.agentPhone, agentEmail: ((_c = customer === null || customer === void 0 ? void 0 : customer.sales) === null || _c === void 0 ? void 0 : _c.email) || prompt_variables_types_1.VARIABLE_DEFAULTS.agentEmail, 
            // Workspace variables
            companyName: (workspace === null || workspace === void 0 ? void 0 : workspace.name) || (customer === null || customer === void 0 ? void 0 : customer.company) || prompt_variables_types_1.VARIABLE_DEFAULTS.companyName, botIdentityResponse: (workspace === null || workspace === void 0 ? void 0 : workspace.botIdentityResponse) || '', customAiRules: (workspace === null || workspace === void 0 ? void 0 : workspace.customAiRules) || '', address: (workspace === null || workspace === void 0 ? void 0 : workspace.address) || '', adminEmail: (workspace === null || workspace === void 0 ? void 0 : workspace.notificationEmail) || '', channelName: (context === null || context === void 0 ? void 0 : context.channelName) || prompt_variables_types_1.VARIABLE_DEFAULTS.channelName, workspaceUrl: (workspace === null || workspace === void 0 ? void 0 : workspace.url) || '', toneOfVoice: (workspace === null || workspace === void 0 ? void 0 : workspace.toneOfVoice) || prompt_variables_types_1.VARIABLE_DEFAULTS.toneOfVoice, hasHumanSupport: (_d = workspace === null || workspace === void 0 ? void 0 : workspace.hasHumanSupport) !== null && _d !== void 0 ? _d : prompt_variables_types_1.VARIABLE_DEFAULTS.hasHumanSupport, humanSupportInstructions: (workspace === null || workspace === void 0 ? void 0 : workspace.humanSupportInstructions) || '', hasSalesAgents: (_e = workspace === null || workspace === void 0 ? void 0 : workspace.hasSalesAgents) !== null && _e !== void 0 ? _e : prompt_variables_types_1.VARIABLE_DEFAULTS.hasSalesAgents, sellsProductsAndServices: (_f = workspace === null || workspace === void 0 ? void 0 : workspace.sellsProductsAndServices) !== null && _f !== void 0 ? _f : prompt_variables_types_1.VARIABLE_DEFAULTS.sellsProductsAndServices, allowedExternalLinks: ((_g = workspace === null || workspace === void 0 ? void 0 : workspace.allowedExternalLinks) === null || _g === void 0 ? void 0 : _g.join('\n')) || '', 
            // Context variables
            lastOrderCode: context === null || context === void 0 ? void 0 : context.lastOrderCode, cartContents: context === null || context === void 0 ? void 0 : context.cartContents, tokenDuration: this.formatTokenDuration(process.env.TOKEN_EXPIRATION || '1h') }, ((options === null || options === void 0 ? void 0 : options.includeDynamicContent) !== false && dynamicContent ? {
            products: dynamicContent.products,
            categories: dynamicContent.categories,
            services: dynamicContent.services,
            offers: dynamicContent.offers,
            faqs: dynamicContent.faqs,
        } : {}));
        // Validate unless skipped
        if (!(options === null || options === void 0 ? void 0 : options.skipValidation)) {
            const validation = this.validate(variables);
            if (validation.errors.length > 0) {
                logger_1.default.error('❌ PromptVariableBuilder validation errors:', validation.errors);
            }
            if (validation.warnings.length > 0) {
                logger_1.default.warn('⚠️ PromptVariableBuilder validation warnings:', validation.warnings);
            }
        }
        // Log what we built
        logger_1.default.info('📦 PromptVariableBuilder.build() completed:', {
            companyName: variables.companyName,
            customerName: variables.customerName,
            hasBotIdentity: !!variables.botIdentityResponse,
            hasProducts: !!variables.products,
            hasCategories: !!variables.categories,
        });
        return variables;
    }
    /**
     * Validate prompt variables
     *
     * @param variables - Variables to validate
     * @returns Validation result with errors and warnings
     */
    static validate(variables) {
        const errors = [];
        const warnings = [];
        // Check required variables
        for (const key of prompt_variables_types_1.REQUIRED_VARIABLES) {
            const value = variables[key];
            if (value === undefined || value === null || value === '') {
                errors.push(`Required variable '${key}' is empty or missing`);
            }
        }
        // Check large variables for excessive size
        for (const key of prompt_variables_types_1.LARGE_VARIABLES) {
            const value = variables[key];
            if (value && typeof value === 'string') {
                const estimatedTokens = this.estimateTokenCount(value);
                if (estimatedTokens > 50000) {
                    warnings.push(`Variable '${key}' has ${estimatedTokens} estimated tokens (>50k)`);
                }
            }
        }
        // Check for empty company name (critical)
        if (!variables.companyName) {
            errors.push('companyName is empty - this will show {{companyName}} in prompts!');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    /**
     * Build variables directly from Prisma queries
     *
     * Convenience method that loads all data from database.
     * Use this when you don't have the data pre-loaded.
     *
     * @param prisma - Prisma client
     * @param workspaceId - Workspace ID
     * @param customerId - Customer ID
     * @returns Complete PromptVariables
     */
    static buildFromDatabase(prisma, workspaceId, customerId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Load customer with sales agent
            const customer = yield prisma.customers.findUnique({
                where: { id: customerId },
                include: {
                    sales: {
                        select: {
                            firstName: true,
                            lastName: true,
                            phone: true,
                            email: true,
                        },
                    },
                },
            });
            // Load workspace
            const workspace = yield prisma.workspace.findUnique({
                where: { id: workspaceId },
                select: {
                    id: true,
                    name: true,
                    url: true,
                    language: true,
                    toneOfVoice: true,
                    botIdentityResponse: true,
                    hasHumanSupport: true,
                    humanSupportInstructions: true,
                    operatorContactMethod: true,
                    operatorWhatsappNumber: true,
                    hasSalesAgents: true,
                    notificationEmail: true,
                    allowedExternalLinks: true,
                    sellsProductsAndServices: true,
                    address: true,
                    customAiRules: true,
                },
            });
            // Load last order
            const lastOrder = yield prisma.orders.findFirst({
                where: { customerId },
                orderBy: { createdAt: 'desc' },
                select: { orderCode: true },
            });
            return this.build(customer, workspace, undefined, // Dynamic content loaded separately
            { lastOrderCode: (lastOrder === null || lastOrder === void 0 ? void 0 : lastOrder.orderCode) || undefined });
        });
    }
    /**
     * Convert language code to display name
     *
     * @param langCode - ISO language code (it, en, es, pt)
     * @returns Display name (ITALIANO, ENGLISH, etc.)
     */
    static getLanguageDisplayName(langCode) {
        const languageMap = {
            'it': 'ITALIANO',
            'en': 'ENGLISH',
            'es': 'ESPAÑOL',
            'pt': 'PORTUGUÊS',
            'ITALIAN': 'ITALIANO',
            'ITALIANO': 'ITALIANO',
            'ENGLISH': 'ENGLISH',
            'SPANISH': 'ESPAÑOL',
            'ESPAÑOL': 'ESPAÑOL',
            'PORTUGUESE': 'PORTUGUÊS',
            'PORTUGUÊS': 'PORTUGUÊS',
        };
        return languageMap[(langCode === null || langCode === void 0 ? void 0 : langCode.toUpperCase()) || 'IT'] || 'ITALIANO';
    }
    /**
     * Format token duration for display
     *
     * @param duration - Duration string (e.g., '15m', '1h', '2h')
     * @returns Human readable string
     */
    static formatTokenDuration(duration) {
        const match = duration.match(/^(\d+)([mh])$/);
        if (!match)
            return '15 minutes';
        const value = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === 'm') {
            return value === 1 ? '1 minute' : `${value} minutes`;
        }
        else {
            return value === 1 ? '1 hour' : `${value} hours`;
        }
    }
    /**
     * Estimate token count (rough approximation)
     *
     * @param text - Text to estimate
     * @returns Estimated token count
     */
    static estimateTokenCount(text) {
        // Rough estimate: 1 token ≈ 4 characters for English, 2-3 for other languages
        return Math.ceil(text.length / 3.5);
    }
    /**
     * Merge partial variables with existing ones
     *
     * Used when sub-agents need to add agent-specific variables.
     *
     * @param base - Base variables from Router
     * @param additions - Additional variables to merge
     * @returns Merged variables
     */
    static merge(base, additions) {
        return Object.assign(Object.assign({}, base), additions);
    }
    /**
     * Extract only the variables needed for a specific template
     *
     * Useful for debugging - shows which variables a template needs.
     *
     * @param template - Template string with {{variables}}
     * @returns Array of variable names found in template
     */
    static extractRequiredVariables(template) {
        const matches = template.match(/\{\{([^}#/]+)\}\}/g) || [];
        const variables = matches.map(m => m.replace(/\{\{|\}\}/g, '').trim());
        return [...new Set(variables)]; // Remove duplicates
    }
}
exports.PromptVariableBuilder = PromptVariableBuilder;
//# sourceMappingURL=prompt-variable-builder.service.js.map