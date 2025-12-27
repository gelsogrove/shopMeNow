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
exports.PromptProcessorService = void 0;
const database_1 = require("@echatbot/database");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const template_engine_service_1 = require("../application/services/prompt-builder/template-engine.service");
const message_repository_1 = require("../repositories/message.repository");
const logger_1 = __importDefault(require("../utils/logger"));
const PromptValidationError_1 = require("../utils/PromptValidationError");
// prisma imported
class PromptProcessorService {
    constructor() {
        this.messageRepository = new message_repository_1.MessageRepository();
        this.templateEngine = new template_engine_service_1.TemplateEngineService();
    }
    // ══════════════════════════════════════════════════════════════════════════
    // 🆕 NEW SIMPLIFIED API - Uses PromptVariables directly
    // ══════════════════════════════════════════════════════════════════════════
    /**
     * 🆕 SIMPLIFIED PROMPT PROCESSING - Uses standardized PromptVariables
     *
     * This is the NEW recommended method. It receives pre-built PromptVariables
     * from PromptVariableBuilder and does ONLY string replacement.
     *
     * NO database queries, NO complex logic, NO side effects.
     *
     * @param template - Template string with {{variables}}
     * @param variables - Pre-built PromptVariables from PromptVariableBuilder
     * @returns Processed template with all variables replaced
     *
     * @example
     * const variables = PromptVariableBuilder.build(customer, workspace, dynamicContent)
     * const processed = promptProcessor.processWithVariables(template, variables)
     */
    processWithVariables(template, variables) {
        // STEP 1: Validate for duplicate large variables
        this.validatePromptVariables(template);
        let result = template;
        // STEP 2: Process {{#if}} conditionals FIRST
        if (result.includes("{{#if") || result.includes("{{#unless")) {
            const conditionalVars = {
                // Booleans for {{#if}} conditions
                sellsProductsAndServices: variables.sellsProductsAndServices,
                hasHumanSupport: variables.hasHumanSupport,
                hasSalesAgents: variables.hasSalesAgents,
                // Computed booleans
                hasIdentity: !!variables.botIdentityResponse,
                hasFaq: !!variables.faqs,
                hasCustomAiRules: !!variables.customAiRules,
                hasAgentAssigned: variables.agentName !== 'Non assegnato',
                hasProducts: !!variables.products,
                hasCategories: !!variables.categories,
                hasServices: !!variables.services,
                hasOffers: !!variables.offers,
                hasAddress: !!variables.address,
                // String values (truthiness for conditionals)
                address: variables.address,
                customAiRules: variables.customAiRules,
                botIdentityResponse: variables.botIdentityResponse,
                humanSupportInstructions: variables.humanSupportInstructions,
                allowedExternalLinks: variables.allowedExternalLinks,
            };
            result = this.templateEngine.process(result, conditionalVars);
            logger_1.default.debug("✅ Processed {{#if}} conditionals");
        }
        // STEP 3: Replace all standard variables
        result = this.replaceStandardVariables(result, variables);
        // STEP 4: Replace legacy aliases for backward compatibility
        result = this.replaceLegacyAliases(result, variables);
        // STEP 5: Handle empty dynamic content with explicit messages
        result = this.handleEmptyContent(result, variables);
        // Log any unreplaced variables (debugging)
        const unreplaced = result.match(/\{\{[^}#/]+\}\}/g);
        if (unreplaced && unreplaced.length > 0) {
            logger_1.default.warn(`⚠️ Unreplaced variables in prompt: ${[...new Set(unreplaced)].join(', ')}`);
        }
        return result;
    }
    /**
     * Replace all standard PromptVariables
     */
    replaceStandardVariables(text, vars) {
        return text
            // Customer variables
            .replace(/\{\{customerName\}\}/g, vars.customerName || 'Cliente')
            .replace(/\{\{customerPhone\}\}/g, vars.customerPhone || '')
            .replace(/\{\{customerEmail\}\}/g, vars.customerEmail || '')
            .replace(/\{\{customerDiscount\}\}/g, String(vars.customerDiscount || 0))
            .replace(/\{\{languageUser\}\}/g, vars.languageUser || 'ITALIANO')
            .replace(/\{\{pushNotificationsConsent\}\}/g, vars.pushNotificationsConsent ? 'true' : 'false')
            // Sales agent variables
            .replace(/\{\{agentName\}\}/g, vars.agentName || 'Non assegnato')
            .replace(/\{\{agentPhone\}\}/g, vars.agentPhone || 'N/A')
            .replace(/\{\{agentEmail\}\}/g, vars.agentEmail || 'N/A')
            // Workspace/Company variables
            .replace(/\{\{companyName\}\}/g, vars.companyName || 'Shop')
            .replace(/\{\{botIdentityResponse\}\}/g, vars.botIdentityResponse || '')
            .replace(/\{\{customAiRules\}\}/g, vars.customAiRules || '')
            .replace(/\{\{address\}\}/g, vars.address || '')
            .replace(/\{\{channelName\}\}/g, vars.channelName || 'Shop')
            .replace(/\{\{workspaceUrl\}\}/g, vars.workspaceUrl || '')
            .replace(/\{\{url\}\}/g, vars.workspaceUrl || '') // Alias
            .replace(/\{\{toneOfVoice\}\}/g, vars.toneOfVoice || 'friendly')
            .replace(/\{\{humanSupportInstructions\}\}/g, vars.humanSupportInstructions || '')
            .replace(/\{\{allowedExternalLinks\}\}/g, vars.allowedExternalLinks || '')
            // Context variables
            .replace(/\{\{lastOrderCode\}\}/g, vars.lastOrderCode || '')
            .replace(/\{\{lastordercode\}\}/g, vars.lastOrderCode || '') // Alias (lowercase)
            .replace(/\{\{cartContents\}\}/g, vars.cartContents || '')
            .replace(/\{\{tokenDuration\}\}/g, vars.tokenDuration || '15 minutes')
            .replace(/\{\{TOKEN_DURATION\}\}/g, vars.tokenDuration || '15 minutes') // Alias
            // Dynamic content
            .replace(/\{\{products\}\}/g, vars.products || '')
            .replace(/\{\{categories\}\}/g, vars.categories || '')
            .replace(/\{\{services\}\}/g, vars.services || '')
            .replace(/\{\{offers\}\}/g, vars.offers || '')
            .replace(/\{\{faqs\}\}/g, vars.faqs || '')
            .replace(/\{\{faq\}\}/g, vars.faqs || ''); // Alias
    }
    /**
     * Replace legacy variable names for backward compatibility
     * @deprecated These aliases will be removed in next major version
     */
    replaceLegacyAliases(text, vars) {
        return text
            // Customer aliases
            .replace(/\{\{nameUser\}\}/g, vars.customerName || 'Cliente')
            .replace(/\{\{nome\}\}/g, vars.customerName || 'Cliente')
            .replace(/\{\{phone\}\}/g, vars.customerPhone || '')
            .replace(/\{\{email\}\}/g, vars.customerEmail || '')
            .replace(/\{\{discountUser\}\}/g, String(vars.customerDiscount || 0));
    }
    /**
     * Handle empty dynamic content with explicit LLM-friendly messages
     */
    handleEmptyContent(text, vars) {
        // Only add messages if the variable was present but empty
        // (prevents double-messaging if variable wasn't in template)
        if (!vars.products && text.includes('CATALOGO VUOTO')) {
            // Already has empty message from replaceStandardVariables
        }
        // Products empty warning is already handled in replaceStandardVariables
        // but we can add additional context here if needed
        return text;
    }
    // ══════════════════════════════════════════════════════════════════════════
    // LEGACY API - Maintained for backward compatibility
    // ══════════════════════════════════════════════════════════════════════════
    /**
     * Validate prompt variables to prevent duplicate large variables
     * Constitution v1.5.0 Principle III Compliance
     *
     * MUST throw error if {{products}}, {{offers}}, {{services}}, or {{categories}}
     * appear more than once in the same prompt (prevents 100k+ token prompts)
     *
     * STRATEGY: Only count variables that appear ALONE on a line (actual placeholders),
     * ignore those in instructional text, examples, or inline documentation.
     *
     * @param prompt Prompt content to validate
     * @throws PromptValidationError if duplicate large variables detected
     */
    validatePromptVariables(prompt) {
        const largeVariables = ["products", "offers", "services", "categories"];
        for (const variable of largeVariables) {
            // Match ONLY when variable appears alone or at start/end of line
            // This excludes instructional text like "scroll to {{products}}"
            const standaloneRegex = new RegExp(`^\\s*\\{\\{${variable}\\}\\}\\s*$`, "gm");
            const matches = prompt.match(standaloneRegex);
            if (matches && matches.length > 1) {
                const errorMessage = `Variable {{${variable}}} can only appear once per prompt. Found ${matches.length} occurrences.`;
                logger_1.default.error(`[PromptValidation] ${errorMessage}`);
                throw new PromptValidationError_1.PromptValidationError(errorMessage);
            }
        }
    }
    /**
     * Pre-processa il prompt sostituendo i placeholder dinamici.
     * @param promptContent Il contenuto del prompt da processare.
     * @param workspaceId L'ID del workspace.
     * @param customerData I dati del cliente per la sostituzione delle variabili.
     * @returns Il prompt processato.
     */
    /**
     * Pre-processa il prompt sostituendo i placeholder dinamici.
     * @param promptContent Il contenuto del prompt da processare
     * @param workspaceId L'ID del workspace
     * @param customerData I dati del cliente
     * @param dynamicContent Contenuti dinamici pre-recuperati (FAQ, prodotti, etc)
     * @returns Il prompt processato
     */
    preProcessPrompt(promptContent, workspaceId, customerData, dynamicContent, workspaceUrl, workspaceConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
            // 🔒 STEP 1: Validate prompt BEFORE replacement (Constitution v1.5.0 Principle III)
            // Fail-fast pattern: prevents 100k+ token prompts from duplicate variables
            this.validatePromptVariables(promptContent);
            let processedPrompt = promptContent;
            // 🆕 STEP 1.5: Process {{#if}} conditionals FIRST (Handlebars syntax)
            // This handles workspace config conditionals like {{#if sellsProductsAndServices}}
            if (processedPrompt.includes("{{#if") || processedPrompt.includes("{{#unless")) {
                // NOTE: Only pass variables needed for CONDITIONALS, not for text replacement
                // Text replacement happens in STEP 2 via replaceVariables()
                const conditionalVariables = {
                    // Workspace config booleans (for {{#if}} conditions)
                    sellsProductsAndServices: (_a = workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.sellsProductsAndServices) !== null && _a !== void 0 ? _a : true,
                    hasHumanSupport: (_b = workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.hasHumanSupport) !== null && _b !== void 0 ? _b : true,
                    hasSalesAgents: (_c = workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.hasSalesAgents) !== null && _c !== void 0 ? _c : false,
                    // ✅ FIX: Add hasIdentity, hasFaq, hasCustomAiRules boolean checks for {{#if}} conditionals
                    hasIdentity: !!(workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.botIdentityResponse),
                    hasFaq: !!(dynamicContent === null || dynamicContent === void 0 ? void 0 : dynamicContent.faqs),
                    hasCustomAiRules: !!(workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.customAiRules),
                    // String variables - ONLY truthiness matters for {{#if}}, actual value substituted later
                    address: (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.address) || "",
                    customAiRules: (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.customAiRules) || "",
                    botIdentityResponse: (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.botIdentityResponse) || "",
                    humanSupportInstructions: (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.humanSupportInstructions) || "",
                    allowedExternalLinks: ((_d = workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.allowedExternalLinks) === null || _d === void 0 ? void 0 : _d.join("\n")) || "",
                    // Customer booleans (for conditionals)
                    hasAgentAssigned: !!(customerData === null || customerData === void 0 ? void 0 : customerData.agentName),
                };
                processedPrompt = this.templateEngine.process(processedPrompt, conditionalVariables);
                logger_1.default.debug("✅ Processed {{#if}} conditionals in prompt");
            }
            // 🔧 STEP 1.6: Replace workspace config string variables
            // These are replaced AFTER conditionals are processed
            if (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.address) {
                processedPrompt = processedPrompt.replace(/\{\{address\}\}/g, workspaceConfig.address);
            }
            if (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.customAiRules) {
                processedPrompt = processedPrompt.replace(/\{\{customAiRules\}\}/g, workspaceConfig.customAiRules);
            }
            if (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.botIdentityResponse) {
                processedPrompt = processedPrompt.replace(/\{\{botIdentityResponse\}\}/g, workspaceConfig.botIdentityResponse);
            }
            if (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.humanSupportInstructions) {
                processedPrompt = processedPrompt.replace(/\{\{humanSupportInstructions\}\}/g, workspaceConfig.humanSupportInstructions);
            }
            if ((_e = workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.allowedExternalLinks) === null || _e === void 0 ? void 0 : _e.length) {
                processedPrompt = processedPrompt.replace(/\{\{allowedExternalLinks\}\}/g, workspaceConfig.allowedExternalLinks.join("\n"));
            }
            if (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.adminEmail) {
                processedPrompt = processedPrompt.replace(/\{\{adminEmail\}\}/g, workspaceConfig.adminEmail);
            }
            // Sostituzione URL workspace (PRIMA di altre sostituzioni)
            if (workspaceUrl && processedPrompt.includes("{{url}}")) {
                processedPrompt = processedPrompt.replace(/\{\{url\}\}/g, workspaceUrl);
            }
            // Sostituzione delle informazioni utente
            processedPrompt = this.replaceVariables(processedPrompt, customerData);
            // Sostituzione {{SUBSCRIBE_MESSAGE}} basato su push_notifications_consent
            if (processedPrompt.includes("{{SUBSCRIBE_MESSAGE}}")) {
                const subscribeMessage = this.getSubscribeMessage(customerData);
                processedPrompt = processedPrompt.replace(/\{\{SUBSCRIBE_MESSAGE\}\}/g, subscribeMessage);
            }
            // Sostituzione contenuti dinamici
            if (processedPrompt.includes("{{faq}}")) {
                // 🚨 CRITICAL: If no FAQ, tell LLM explicitly
                const faqContent = ((_f = dynamicContent.faqs) === null || _f === void 0 ? void 0 : _f.trim())
                    ? dynamicContent.faqs
                    : "⚠️ Non abbiamo FAQ in questo workspace.";
                processedPrompt = processedPrompt.replace("{{faq}}", faqContent);
            }
            if (processedPrompt.includes("{{products}}")) {
                // Feature 123: Log token count for {{products}} variable
                const productsTokenCount = this.estimateTokenCount(dynamicContent.products || "");
                logger_1.default.info(`[ProductSearch] {{products}} token count: ${productsTokenCount}`);
                if (productsTokenCount > 50000) {
                    logger_1.default.warn(`[ProductSearch] ⚠️ {{products}} exceeds 50k tokens (${productsTokenCount}). Consider filtering.`);
                }
                // 🚨 CRITICAL: If no products, tell LLM explicitly - DON'T let it invent from examples!
                const productsContent = ((_g = dynamicContent.products) === null || _g === void 0 ? void 0 : _g.trim())
                    ? dynamicContent.products
                    : "⚠️ CATALOGO VUOTO - Non ci sono prodotti in questo workspace. Rispondi: 'Mi dispiace, al momento non abbiamo prodotti nel catalogo.'";
                processedPrompt = processedPrompt.replace("{{products}}", productsContent);
            }
            if (processedPrompt.includes("{{categories}}")) {
                // 🚨 CRITICAL: If no categories, tell LLM explicitly
                const categoriesContent = ((_h = dynamicContent.categories) === null || _h === void 0 ? void 0 : _h.trim())
                    ? dynamicContent.categories
                    : "⚠️ Non abbiamo categorie in questo workspace.";
                processedPrompt = processedPrompt.replace("{{categories}}", categoriesContent);
            }
            if (processedPrompt.includes("{{services}}")) {
                // 🚨 CRITICAL: If no services, tell LLM explicitly
                const servicesContent = ((_j = dynamicContent.services) === null || _j === void 0 ? void 0 : _j.trim())
                    ? dynamicContent.services
                    : "⚠️ Non abbiamo servizi in questo workspace.";
                processedPrompt = processedPrompt.replace("{{services}}", servicesContent);
            }
            if (processedPrompt.includes("{{offers}}")) {
                // 🚨 CRITICAL: If no offers, tell LLM explicitly
                const offersContent = ((_k = dynamicContent.offers) === null || _k === void 0 ? void 0 : _k.trim())
                    ? dynamicContent.offers
                    : "⚠️ Non abbiamo offerte attive in questo momento.";
                processedPrompt = processedPrompt.replace("{{offers}}", offersContent);
            }
            // Sostituzione {{lastOrder}} - FR-13 Repeat Order
            if (processedPrompt.includes("{{lastOrder}}")) {
                const lastOrderSummary = yield this.getLastOrderVariable(customerData.id, workspaceId);
                processedPrompt = processedPrompt.replace(/\{\{lastOrder\}\}/g, lastOrderSummary);
            }
            // 🆕 Feature 199: Channel Configuration Variables
            // {{BOT_PERSONALITY}} - Tone of voice (friendly, professional, formal, casual)
            if (processedPrompt.includes("{{BOT_PERSONALITY}}")) {
                const toneOfVoice = (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.toneOfVoice) || "friendly";
                const personalityMap = {
                    friendly: "Sei amichevole, caloroso e usi emoji per rendere la conversazione piacevole 😊. Parli in modo informale ma rispettoso.",
                    professional: "Sei professionale e cortese. Rispondi in modo chiaro e diretto, mantenendo un tono business appropriato.",
                    formal: "Sei formale ed educato. Usi il 'Lei' e mantieni un tono tradizionale e rispettoso.",
                    casual: "Sei rilassato e informale ✌️. Parli come un amico, in modo naturale e divertente.",
                };
                processedPrompt = processedPrompt.replace(/\{\{BOT_PERSONALITY\}\}/g, personalityMap[toneOfVoice] || personalityMap.friendly);
            }
            // {{BOT_IDENTITY}} - How the bot introduces itself
            if (processedPrompt.includes("{{BOT_IDENTITY}}")) {
                const botIdentity = (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.botIdentityResponse) ||
                    "Sono l'assistente virtuale di questo negozio. Posso aiutarti a trovare prodotti, rispondere alle domande e gestire i tuoi ordini.";
                processedPrompt = processedPrompt.replace(/\{\{BOT_IDENTITY\}\}/g, botIdentity);
            }
            // {{HUMAN_SUPPORT_INFO}} - How to contact human support
            if (processedPrompt.includes("{{HUMAN_SUPPORT_INFO}}")) {
                let humanSupportInfo;
                if (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.hasHumanSupport) {
                    // Human support is enabled
                    if (workspaceConfig.hasSalesAgents) {
                        // Has sales agents - customer gets their assigned agent
                        humanSupportInfo = `Il tuo agente di riferimento è:
• {{agentName}}
• 📞 {{agentPhone}}
• ✉️ {{agentEmail}}

⏸️ Da questo momento la chat è in pausa.
Il nostro agente ti contatterà il prima possibile direttamente in questa chat per risolvere la situazione.`;
                    }
                    else {
                        // No sales agents - use Admin Email
                        const email = workspaceConfig.adminEmail || "support@echatbot.ai";
                        humanSupportInfo = `⏸️ Da questo momento la chat è in pausa.

Il nostro team ti contatterà via email (${email}) il prima possibile per risolvere la situazione.`;
                    }
                    // Add custom instructions if provided
                    if ((_l = workspaceConfig.humanSupportInstructions) === null || _l === void 0 ? void 0 : _l.trim()) {
                        humanSupportInfo += `\n\n${workspaceConfig.humanSupportInstructions}`;
                    }
                }
                else {
                    // Human support disabled - generic response
                    humanSupportInfo = "Al momento non è disponibile supporto umano. Prova a riformulare la tua richiesta o consulta le nostre FAQ.";
                }
                processedPrompt = processedPrompt.replace(/\{\{HUMAN_SUPPORT_INFO\}\}/g, humanSupportInfo);
            }
            // {{SALES_AGENT_CONTACT}} - Sales agent contact block (only if hasSalesAgents=true)
            if (processedPrompt.includes("{{SALES_AGENT_CONTACT}}")) {
                const salesAgentContact = (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.hasSalesAgents)
                    ? `L'agente {{agentName}} ti contatterà per assisterti.\n📧 Email: {{agentEmail}}\n📞 Telefono: {{agentPhone}}`
                    : ""; // Empty if no sales agents
                processedPrompt = processedPrompt.replace(/\{\{SALES_AGENT_CONTACT\}\}/g, salesAgentContact);
            }
            // {{ALLOWED_EXTERNAL_LINKS}} - List of allowed domains for external links
            if (processedPrompt.includes("{{ALLOWED_EXTERNAL_LINKS}}")) {
                const allowedLinks = (workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.allowedExternalLinks) || [];
                let linksContent;
                if (allowedLinks.length > 0) {
                    linksContent = `**Domini autorizzati per link esterni:**\n${allowedLinks.map(link => `- ${link}`).join('\n')}\n\n⚠️ **REGOLA CRITICA**: NON includere MAI link a domini diversi da quelli elencati sopra. Se devi suggerire un link esterno, verifica che il dominio sia nella lista autorizzata.`;
                }
                else {
                    linksContent = `⚠️ **REGOLA CRITICA**: NON includere MAI link esterni nelle risposte. Puoi usare solo link interni al sistema (ordini, profilo, carrello).`;
                }
                processedPrompt = processedPrompt.replace(/\{\{ALLOWED_EXTERNAL_LINKS\}\}/g, linksContent);
            }
            // {{ADDRESS}} - Physical location/address of the business
            if (processedPrompt.includes("{{ADDRESS}}")) {
                const address = ((_m = workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.address) === null || _m === void 0 ? void 0 : _m.trim()) || "";
                if (address) {
                    processedPrompt = processedPrompt.replace(/\{\{ADDRESS\}\}/g, address);
                }
                else {
                    // If no address configured, replace with instruction to not answer location questions
                    processedPrompt = processedPrompt.replace(/\{\{ADDRESS\}\}/g, "⚠️ Indirizzo non configurato - Se il cliente chiede dove siete, rispondi che l'indirizzo non è disponibile.");
                }
            }
            // {{CUSTOM_AI_RULES}} - Custom rules that OVERRIDE default behavior
            if (processedPrompt.includes("{{CUSTOM_AI_RULES}}")) {
                const customRules = ((_o = workspaceConfig === null || workspaceConfig === void 0 ? void 0 : workspaceConfig.customAiRules) === null || _o === void 0 ? void 0 : _o.trim()) || "";
                if (customRules) {
                    processedPrompt = processedPrompt.replace(/\{\{CUSTOM_AI_RULES\}\}/g, `⚠️ REGOLE PRIORITARIE (hanno la precedenza su tutto):\n${customRules}`);
                }
                else {
                    // Remove placeholder if no custom rules
                    processedPrompt = processedPrompt.replace(/\{\{CUSTOM_AI_RULES\}\}/g, "");
                }
            }
            // Remove duplicate CATEGORIES check since it's already handled above
            // DEBUG: Salva il prompt finale per debugging
            yield this.saveDebugPrompt(processedPrompt, workspaceId);
            return processedPrompt;
        });
    }
    /**
     * Post-processa la risposta dell'LLM.
     * @param response La risposta dell'LLM.
     * @param customerId I dati del cliente per la sostituzione delle variabili.
     * @param workspaceId L'ID del workspace.
     * @returns La risposta processata.
     */
    postProcessResponse(response, customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            let processedResponse = response;
            // Sostituzione link con token
            if (customerId && workspaceId) {
                const { ReplaceLinkWithToken } = yield Promise.resolve().then(() => __importStar(require("../application/services/link-replacement.service")));
                const linkResult = yield ReplaceLinkWithToken({ response: processedResponse }, customerId, workspaceId);
                if (linkResult.success && linkResult.response) {
                    processedResponse = linkResult.response;
                }
            }
            return processedResponse;
        });
    }
    /**
     * 🆕 PUBLIC METHOD: Replace customer-specific variables in ANY text (prompts or LLM responses)
     *
     * CRITICAL FIX (Feature 124): Variables from calling functions (RepeatOrder.ts, ResetCart.ts)
     * were not being replaced in LLM responses, showing {{discountUser}} to customers.
     *
     * This is now the SINGLE SOURCE OF TRUTH for all variable replacements.
     * Use this method for BOTH prompts AND responses to avoid duplication.
     *
     * Handles:
     * - Customer data: {{nameUser}}, {{email}}, {{phone}}, {{discountUser}}
     * - Sales agent data: {{agentName}}, {{agentPhone}}, {{agentEmail}}
     * - Company data: {{companyName}}, {{channelName}}, {{languageUser}}
     * - Order data: {{lastordercode}}
     * - System data: {{TOKEN_DURATION}}
     *
     * @param text - Text with potential {{variables}} (from LLM response or prompt)
     * @param customerData - Customer data from database
     * @returns Text with all variables replaced
     *
     * @see Constitution Principle I - Database-First Architecture (no hardcoded values)
     * @see specs/124-customer-variables-replacement/spec.md FR-1, FR-2
     * @see MULTI_AGENT_FLOW.md Step 4.6 - Variable Replacement
     *
     * @example
     * const input = "Hello {{nameUser}}, you have {{discountUser}}% discount! Contact {{agentName}}"
     * const output = replaceCustomerVariables(input, { nome: "Mario", discountUser: 15, agentName: "Giovanni", ... })
     * // → "Hello Mario, you have 15% discount! Contact Giovanni"
     */
    replaceCustomerVariables(text, customerData) {
        if (!text)
            return text;
        return text
            .replace(/\{\{nameUser\}\}/g, customerData.nome || "Cliente")
            .replace(/\{\{customerName\}\}/g, customerData.nome || "Cliente") // 🔧 Alias for templates using {{customerName}}
            .replace(/\{\{email\}\}/g, customerData.email || "")
            .replace(/\{\{phone\}\}/g, customerData.phone || "")
            .replace(/\{\{customerPhone\}\}/g, customerData.phone || "") // 🔧 Alias for templates using {{customerPhone}}
            .replace(/\{\{discountUser\}\}/g, String(customerData.discountUser || 0))
            .replace(/\{\{agentName\}\}/g, customerData.agentName || "Non assegnato")
            .replace(/\{\{agentPhone\}\}/g, customerData.agentPhone || "N/A")
            .replace(/\{\{agentEmail\}\}/g, customerData.agentEmail || "N/A")
            .replace(/\{\{companyName\}\}/g, customerData.companyName || "L'Altra Italia")
            .replace(/\{\{languageUser\}\}/g, customerData.languageUser || "ITALIANO")
            .replace(/\{\{lastordercode\}\}/g, customerData.lastordercode || "N/A")
            .replace(/\{\{TOKEN_DURATION\}\}/g, this.formatTokenDuration(process.env.TOKEN_EXPIRATION || "1h"))
            .replace(/\{\{pushNotificationsConsent\}\}/g, customerData.pushNotificationsConsent === true ? "true" : "false")
            .replace(/\{\{pushNotificationsConsentAt\}\}/g, customerData.pushNotificationsConsentAt
            ? new Date(customerData.pushNotificationsConsentAt).toISOString()
            : "Mai modificato")
            .replace(/\{\{channelName\}\}/g, customerData.channelName || "Shop")
            .replace(/\{\{adminEmail\}\}/g, customerData.adminEmail || "support@echatbot.ai") // 🆕 Support email
            .replace(/\{\{botIdentityResponse\}\}/g, customerData.botIdentityResponse || "Virtual Assistant"); // 🆕 Bot identity
    }
    /**
     * @deprecated Use replaceCustomerVariables() instead - this is kept for backward compatibility
     *
     * Sostituisce le variabili nel testo.
     * Questo metodo ora chiama replaceCustomerVariables() per evitare duplicazione.
     *
     * @param text Il testo da processare.
     * @param customerData I dati del cliente.
     * @returns Il testo con le variabili sostituite.
     */
    replaceVariables(text, customerData) {
        if (!text || !customerData)
            return text;
        // 🔄 REFACTORED: Now calls replaceCustomerVariables() for centralized replacement
        // This ensures consistency and avoids code duplication
        return this.replaceCustomerVariables(text, {
            nome: customerData.nameUser || "",
            email: customerData.email || "",
            phone: customerData.phone || "",
            discountUser: customerData.discountUser || 0,
            agentName: customerData.agentName,
            agentPhone: customerData.agentPhone,
            agentEmail: customerData.agentEmail,
            companyName: customerData.companyName,
            languageUser: customerData.languageUser,
            lastordercode: customerData.lastordercode,
            pushNotificationsConsent: customerData.push_notifications_consent,
            pushNotificationsConsentAt: customerData.push_notifications_consent_at,
            channelName: customerData.channelName,
            adminEmail: customerData.adminEmail, // 🆕 For support/escalation links
            botIdentityResponse: customerData.botIdentityResponse, // 🆕 For identity answers
        });
    } /**
     * Format token duration from environment variable
     * Examples: "15m" → "15 minutes", "1h" → "1 hour", "2h" → "2 hours"
     *
     * @param duration - Duration string from env (e.g., "15m", "1h")
     * @returns Human-readable duration string
     */
    formatTokenDuration(duration) {
        const match = duration.match(/^(\d+)([mh])$/);
        if (!match)
            return "15 minutes"; // Fallback for invalid format
        const value = parseInt(match[1]);
        const unit = match[2];
        if (unit === "m")
            return value === 1 ? "1 minute" : `${value} minutes`;
        if (unit === "h")
            return value === 1 ? "1 hour" : `${value} hours`;
        return "15 minutes";
    }
    /**
     * Genera il messaggio di invito alla sottoscrizione push notifications.
     * Se l'utente è già iscritto (push_notifications_consent = true), ritorna stringa vuota.
     * Se non è iscritto, ritorna il messaggio di invito.
     * @param customerData I dati del cliente.
     * @returns Il messaggio di subscribe o stringa vuota.
     */
    getSubscribeMessage(customerData) {
        // Se l'utente è già iscritto, non mostrare nulla
        if ((customerData === null || customerData === void 0 ? void 0 : customerData.push_notifications_consent) === true) {
            return "";
        }
        // Se non è iscritto, mostra invito semplice (in inglese - translation layer traduce)
        return "💡 Want to receive exclusive offers and updates via WhatsApp? Let me know!";
    }
    /**
     * FR-13: Ottiene il sommario dell'ultimo ordine DELIVERED del cliente.
     * Formatta i dettagli dell'ordine in italiano per il prompt dell'agent.
     * @param customerId ID del cliente
     * @param workspaceId ID del workspace
     * @returns Sommario formattato dell'ultimo ordine o messaggio di nessun ordine disponibile
     */
    getLastOrderVariable(customerId, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Query ultimo ordine DELIVERED del cliente
                const lastOrder = yield database_1.prisma.orders.findFirst({
                    where: {
                        customerId: customerId,
                        workspaceId: workspaceId,
                        status: "DELIVERED",
                    },
                    include: {
                        items: {
                            include: {
                                product: true,
                                service: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                });
                // Nessun ordine trovato
                if (!lastOrder) {
                    return "Nessun ordine precedente disponibile.";
                }
                // Formatta data in italiano (es: "15 ottobre 2025")
                const orderDate = new Date(lastOrder.createdAt);
                const formattedDate = orderDate.toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                });
                // Formatta lista prodotti
                const itemsText = lastOrder.items
                    .map((item) => {
                    var _a, _b, _c, _d;
                    const name = ((_a = item.product) === null || _a === void 0 ? void 0 : _a.name) || ((_b = item.service) === null || _b === void 0 ? void 0 : _b.name) || "Prodotto";
                    const code = ((_c = item.product) === null || _c === void 0 ? void 0 : _c.sku) || ((_d = item.service) === null || _d === void 0 ? void 0 : _d.code) || "N/A";
                    const qty = item.quantity;
                    const price = parseFloat(item.unitPrice.toString());
                    const total = qty * price;
                    return `- ${code} ${name} x${qty} (${price.toFixed(2)}€ cad.) = ${total.toFixed(2)}€`;
                })
                    .join("\n");
                // Totale ordine
                const totalAmount = parseFloat(lastOrder.totalAmount.toString());
                // Formato finale per il prompt (in italiano)
                const summary = `Ultimo ordine: ${lastOrder.orderCode} del ${formattedDate}
Prodotti ordinati:
${itemsText}
Totale ordine: ${totalAmount.toFixed(2)}€
Stato: ${lastOrder.status}`;
                logger_1.default.info(`[PromptProcessor] Last order variable generated for customer ${customerId}: ${lastOrder.orderCode}`);
                return summary;
            }
            catch (error) {
                logger_1.default.error(`[PromptProcessor] Error getting last order for customer ${customerId}:`, error);
                return "Nessun ordine precedente disponibile.";
            }
        });
    }
    /**
     * Stima il numero di token in una stringa.
     * Usa una euristica semplice: ~1 token ogni 4 caratteri (media per italiano/inglese)
     * @param text Il testo da analizzare
     * @returns Numero stimato di token
     */
    estimateTokenCount(text) {
        // Null/undefined safety
        if (!text)
            return 0;
        // Euristica: 1 token ≈ 4 caratteri (più accurato per GPT-4)
        // Include overhead per whitespace e punteggiatura
        return Math.ceil(text.length / 4);
    }
    /**
     * Salva il prompt finale per debugging.
     * @param prompt Il prompt processato.
     * @param workspaceId L'ID del workspace.
     */
    saveDebugPrompt(prompt, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const logsDir = path_1.default.join(process.cwd(), "logs");
                if (!fs_1.default.existsSync(logsDir)) {
                    fs_1.default.mkdirSync(logsDir, { recursive: true });
                }
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const filename = `prompt-debug-${workspaceId}-${timestamp}.txt`;
                const filepath = path_1.default.join(logsDir, filename);
                const debugContent = `
================== PROMPT DEBUG ==================
Timestamp: ${new Date().toISOString()}
Workspace ID: ${workspaceId}
================== FINAL PROMPT ==================

${prompt}

================== END PROMPT ==================
`;
                fs_1.default.writeFileSync(filepath, debugContent, "utf8");
                logger_1.default.info(`[DEBUG] Prompt salvato in: ${filepath}`);
            }
            catch (error) {
                logger_1.default.error("[DEBUG] Errore nel salvare il prompt:", error);
            }
        });
    }
}
exports.PromptProcessorService = PromptProcessorService;
//# sourceMappingURL=prompt-processor.service.js.map