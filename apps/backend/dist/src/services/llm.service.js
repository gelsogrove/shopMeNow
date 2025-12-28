"use strict";
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
exports.LLMService = void 0;
const SafetyTranslationAgent_1 = require("../application/agents/SafetyTranslationAgent");
const link_generator_service_1 = require("../application/services/link-generator.service");
const token_service_1 = require("../application/services/token.service");
const agent_functions_config_1 = require("../config/agent-functions.config");
const llm_config_1 = require("../config/llm.config");
const logger_1 = __importDefault(require("../utils/logger"));
const calling_functions_service_1 = require("./calling-functions.service");
const prompt_processor_service_1 = require("./prompt-processor.service");
const translation_security_service_1 = __importDefault(require("./translation-security.service"));
const database_1 = require("@echatbot/database");
/**
 * Simple token usage calculator (approximation)
 * OpenAI uses ~4 chars per token on average
 */
function calculateLLMTokenUsage(prompt, userQuery, completion) {
    const promptTokens = Math.ceil((prompt.length + userQuery.length) / 4);
    const completionTokens = Math.ceil(completion.length / 4);
    return {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
    };
}
/**
 * Calculate LLM cost based on tokens and model
 * Prices per 1M tokens for gpt-4o-mini:
 * - Input: $0.15
 * - Output: $0.60
 */
function calculateLLMCost(promptTokens, completionTokens, model) {
    const inputCostPer1M = 0.15;
    const outputCostPer1M = 0.6;
    const inputCost = (promptTokens / 1000000) * inputCostPer1M;
    const outputCost = (completionTokens / 1000000) * outputCostPer1M;
    return {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
    };
}
class LLMService {
    constructor() {
        const linkGeneratorService = new link_generator_service_1.LinkGeneratorService();
        this.callingFunctionsService = new calling_functions_service_1.CallingFunctionsService(linkGeneratorService);
        this.promptProcessorService = new prompt_processor_service_1.PromptProcessorService();
    }
    handleMessage(llmRequest, customerData, skipTranslation // NEW: Skip translation when called from delegation
    ) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            logger_1.default.info("🚀 LLM: handleMessage chiamato per telefono:", llmRequest.phone);
            const messageRepo = new (require("../repositories/message.repository").MessageRepository)();
            const { workspaceService } = require("../services/workspace.service");
            const debugInfo = {
                stage: "initializing",
                timestamp: new Date().toISOString(),
                requestPhone: llmRequest.phone,
                requestWorkspaceId: llmRequest.workspaceId,
            };
            // 1. Get Data
            // 🔒 SECURITY: Find customer by phone AND workspace (prevents cross-workspace mix)
            let customer = yield messageRepo.findCustomerByPhone(llmRequest.phone, llmRequest.workspaceId);
            const workspaceId = customer ? customer.workspaceId : llmRequest.workspaceId;
            const workspace = yield workspaceService.getById(workspaceId);
            debugInfo.workspaceId = workspaceId;
            debugInfo.customerId = (customer === null || customer === void 0 ? void 0 : customer.id) || null;
            debugInfo.customer = customer
                ? {
                    name: customer.name,
                    language: customer.language,
                    discount: customer.discount,
                    company: customer.company,
                    lastOrderCode: customer.lastOrderCode || (customerData === null || customerData === void 0 ? void 0 : customerData.lastordercode),
                }
                : null;
            // 2. New User Check
            if (!customer) {
                debugInfo.stage = "new_user";
                return yield this.NewUser(llmRequest, workspace, messageRepo, debugInfo);
            }
            // 3. Blocca se blacklisted - NON processare ma SALVARE messaggio in history
            const isBlocked = yield messageRepo.isCustomerBlacklisted(customer.phone, workspace.id);
            // Block if user is blacklisted
            if (isBlocked || customer.isBlacklisted) {
                debugInfo.stage = "blocked_user";
                return {
                    success: false,
                    output: "❌ User blocked",
                    debugInfo: JSON.stringify(debugInfo),
                };
            }
            // 3b. Se chatbot disabilitato, SALVA messaggio ma NON processare con LLM
            if (!customer.activeChatbot) {
                debugInfo.stage = "chatbot_disabled_save_only";
                // Salva messaggio cliente in history
                yield messageRepo.saveMessage({
                    customerId: customer.id,
                    workspaceId: workspace.id,
                    direction: "INBOUND",
                    content: llmRequest.chatInput,
                    type: "TEXT",
                    aiGenerated: false,
                    metadata: {
                        chatbotDisabled: true,
                        savedAt: new Date().toISOString(),
                    },
                });
                logger_1.default.info("✅ Message saved to history (chatbot disabled)", {
                    customerId: customer.id,
                    messageLength: llmRequest.chatInput.length,
                });
                return {
                    success: true,
                    output: "Message saved to history (chatbot disabled - no LLM processing)",
                    debugInfo: JSON.stringify(debugInfo),
                    chatbotDisabled: true, // Flag per sapere che non deve inviare risposta
                };
            }
            // 4. Get prompt - SPECIFIC AGENT if agentType provided, otherwise Router
            const agentType = llmRequest.agentType || "ROUTER";
            let prompt = null;
            if (agentType && agentType !== "ROUTER") {
                // Get specific agent prompt from database
                const prisma = new (require("@prisma/client").PrismaClient)();
                const agentConfig = yield prisma.agentConfig.findFirst({
                    where: {
                        workspaceId: workspace.id,
                        type: agentType,
                        isActive: true,
                    },
                });
                prompt = (agentConfig === null || agentConfig === void 0 ? void 0 : agentConfig.systemPrompt) || null;
                yield prisma.$disconnect();
                logger_1.default.info(`🤖 Loading prompt for specific agent: ${agentType}`, {
                    found: !!prompt,
                    promptLength: (prompt === null || prompt === void 0 ? void 0 : prompt.length) || 0,
                });
            }
            else {
                // Default: get Router agent prompt
                prompt = yield workspaceService.getActivePromptByWorkspaceId(workspace.id);
            }
            if (!prompt) {
                debugInfo.stage = "no_prompt";
                return {
                    success: false,
                    output: "❌ Servizio temporaneamente non disponibile.",
                    debugInfo: JSON.stringify(debugInfo),
                };
            }
            const linkCounts = yield messageRepo.getLinkCounts(workspaceId);
            debugInfo.linkCounts = linkCounts;
            // 5. Pre-processing:
            const userLanguage = customer.language || workspace.language || "it";
            const faqs = yield messageRepo.getActiveFaqs(workspace.id);
            const services = yield messageRepo.getActiveServices(workspace.id);
            // Use customerData if provided (from delegation), otherwise fetch from DB
            const categories = (customerData === null || customerData === void 0 ? void 0 : customerData.CATEGORIES) ||
                (yield messageRepo.getActiveCategories(workspace.id));
            const offers = (customerData === null || customerData === void 0 ? void 0 : customerData.OFFERS) || (yield messageRepo.getActiveOffers(workspace.id));
            const customerDiscount = customer.discount || 0;
            const products = (customerData === null || customerData === void 0 ? void 0 : customerData.PRODUCTS) ||
                (yield messageRepo.getActiveProducts(workspace.id, customerDiscount)) ||
                "";
            // 🔍 DEBUG: Log catalog data
            logger_1.default.info("📦 Catalog data for LLM", {
                hasProducts: !!products,
                productsLength: (products === null || products === void 0 ? void 0 : products.length) || 0,
                productsPreview: products === null || products === void 0 ? void 0 : products.substring(0, 200),
                hasCategories: !!categories,
                hasOffers: !!offers,
                usingCustomerData: !!(customerData === null || customerData === void 0 ? void 0 : customerData.PRODUCTS),
            });
            const userInfo = {
                nameUser: (customerData === null || customerData === void 0 ? void 0 : customerData.nameUser) || customer.name || "",
                discountUser: (customerData === null || customerData === void 0 ? void 0 : customerData.discountUser) || customer.discount || 0,
                companyName: (customerData === null || customerData === void 0 ? void 0 : customerData.companyName) || customer.company || "",
                lastordercode: (customerData === null || customerData === void 0 ? void 0 : customerData.lastordercode) || customer.lastOrderCode || "",
                languageUser: (customerData === null || customerData === void 0 ? void 0 : customerData.languageUser) || this.getLanguageDisplayName(userLanguage),
                agentName: (customerData === null || customerData === void 0 ? void 0 : customerData.agentName) ||
                    (customer.sales
                        ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
                        : "Non assegnato"),
                agentPhone: (customerData === null || customerData === void 0 ? void 0 : customerData.agentPhone) || ((_a = customer.sales) === null || _a === void 0 ? void 0 : _a.phone) || "N/A",
                agentEmail: (customerData === null || customerData === void 0 ? void 0 : customerData.agentEmail) || ((_b = customer.sales) === null || _b === void 0 ? void 0 : _b.email) || "N/A",
                push_notifications_consent: customer.push_notifications_consent || false,
            };
            debugInfo.userInfo = {
                language: userLanguage,
                discount: customerDiscount,
                lastOrder: userInfo.lastordercode,
                displayLanguage: userInfo.languageUser,
            };
            if (!faqs && !products && !services && !categories) {
                debugInfo.stage = "no_content";
                return {
                    success: false,
                    output: "❌ Non ci sono FAQ, Prodotti, Servizi o Categorie disponibili.",
                    debugInfo: JSON.stringify(debugInfo),
                };
            }
            // Get token duration from env and format it for display
            const tokenDuration = this.formatTokenDuration(process.env.TOKEN_EXPIRATION || "1h");
            // Get workspace URL for {{url}} replacement
            const workspaceUrl = workspace.url || "http://localhost:3000";
            // 🔍 DEBUG: Check prompt BEFORE replacement (for PRODUCT_SEARCH only)
            if (llmRequest.agentType === "PRODUCT_SEARCH") {
                logger_1.default.info("🔍 BEFORE replacement", {
                    promptLength: prompt.length,
                    hasPlaceholder: prompt.includes("{{products}}"),
                    placeholderCount: (prompt.match(/\{\{products\}\}/g) || []).length,
                });
            }
            let promptWithVars = prompt
                .replace("{{faq}}", faqs)
                .replace("{{services}}", services)
                .replace("{{products}}", products)
                .replace("{{categories}}", categories)
                .replace("{{offers}}", offers)
                .replace(/\{\{url\}\}/g, workspaceUrl) // Replace ALL occurrences of {{url}}
                .replace(/\{\{nameUser\}\}/g, userInfo.nameUser) // Replace ALL occurrences
                .replace(/\{\{discountUser\}\}/g, String(userInfo.discountUser)) // Replace ALL occurrences
                .replace(/\{\{companyName\}\}/g, userInfo.companyName) // Replace ALL occurrences
                .replace(/\{\{lastordercode\}\}/g, userInfo.lastordercode) // Replace ALL occurrences
                .replace(/\{\{languageUser\}\}/g, userInfo.languageUser) // Replace ALL occurrences - FIX BUG LINGUA
                .replace(/\{\{agentName\}\}/g, userInfo.agentName) // Replace ALL occurrences
                .replace(/\{\{agentPhone\}\}/g, userInfo.agentPhone) // Replace ALL occurrences
                .replace(/\{\{agentEmail\}\}/g, userInfo.agentEmail) // Replace ALL occurrences
                .replace(/\{\{TOKEN_DURATION\}\}/g, tokenDuration); // Replace ALL occurrences
            // ❌ REMOVED: prompt.txt generation (obsolete - use AgentConversationLog for debugging)
            // Old code wrote to prompt.txt file for debugging
            // New multi-agent system logs everything to database via AgentLoggerService
            debugInfo.promptInfo = {
                originalLength: prompt.length,
                processedLength: promptWithVars.length,
                userMessageLength: llmRequest.chatInput.length,
            };
            // 🔍 DEBUG: Check if {{products}} was replaced
            if (llmRequest.agentType === "PRODUCT_SEARCH") {
                const hasProductsPlaceholder = promptWithVars.includes("{{products}}");
                const hasProductsContent = promptWithVars.includes("Panettone Classico");
                const hasDolciCategory = promptWithVars.includes("**DESSERTS**");
                const productsHasPanettone = (products === null || products === void 0 ? void 0 : products.includes("Panettone Classico")) || false;
                const productsHasDesserts = (products === null || products === void 0 ? void 0 : products.includes("**DESSERTS**")) || false;
                logger_1.default.info("🔍 PRODUCT_SEARCH prompt check", {
                    hasPlaceholder: hasProductsPlaceholder,
                    hasProductContentInPrompt: hasProductsContent,
                    hasDolciCategoryInPrompt: hasDolciCategory,
                    hasProductContentInSource: productsHasPanettone,
                    hasDolciCategoryInSource: productsHasDesserts,
                    promptLength: promptWithVars.length,
                    productsSourceLength: (products === null || products === void 0 ? void 0 : products.length) || 0,
                });
            }
            // 6.5 Get conversation history (last 5 minutes for context)
            const recentMessages = yield messageRepo.getRecentMessagesByTime(customer.phone, 5, // Last 5 minutes of conversation for full context
            workspace.id);
            logger_1.default.info(`📚 [HISTORY] Retrieved ${recentMessages.length} messages from last 5 minutes for context`);
            debugInfo.historyMessagesCount = recentMessages.length;
            // resoonse
            const llmResult = yield this.generateLLMResponse(promptWithVars, llmRequest.chatInput, workspace, customer, customerData, userLanguage, debugInfo, // Pass debug info to track function calls
            recentMessages // Pass conversation history
            );
            // Check if LLM response is valid before post-processing
            if (!llmResult || !llmResult.response) {
                logger_1.default.error("❌ LLM returned empty or invalid response", {
                    llmResult,
                    customerId: customer.id,
                });
                return {
                    success: false,
                    output: "Mi dispiace, il servizio LLM non è al momento disponibile.",
                    debugInfo: JSON.stringify(Object.assign(Object.assign({}, debugInfo), { error: "LLM returned empty response" })),
                };
            }
            // 7. Post-processing: Replace link tokens
            const linkReplacements = [];
            let finalResponse = yield this.replaceLinkTokens(llmResult.response, customer, workspace, linkReplacements // Pass array to collect replacement info
            );
            debugInfo.linkReplacements = linkReplacements;
            // 8. 🔒 TRANSLATION & SECURITY LAYER - Final filter before sending to customer
            // 🚨 SKIP if called from delegation (Router will handle translation)
            if (skipTranslation) {
                logger_1.default.info("⏭️ Skipping Translation & Security Layer (delegation mode)");
                debugInfo.translationSkipped = true;
            }
            else {
                try {
                    // 🔧 Get LLM config to use same model/provider as agent
                    const agentConfig = (_c = workspace.agentConfigs) === null || _c === void 0 ? void 0 : _c[0];
                    const agentModel = agentConfig === null || agentConfig === void 0 ? void 0 : agentConfig.model;
                    const llmConfig = (0, llm_config_1.getLLMConfig)(agentModel);
                    logger_1.default.info("🔒 Applying Translation & Security Layer", {
                        customerId: customer.id,
                        language: userLanguage,
                        usingAgentModel: agentModel, // 📊 Same model as agent
                        usingProvider: "OpenRouter (cloud)",
                    });
                    // Build list of allowed system links (all other links will be blocked)
                    const workspaceUrl = workspace.url || "http://localhost:3000";
                    const allowedLinks = [
                        workspaceUrl, // Base workspace URL
                        `${workspaceUrl}/s/`, // Short URLs (secure with token)
                        `${workspaceUrl}/orders-public`, // Public orders (secure with token)
                        `${workspaceUrl}/register`, // Registration page
                        `${workspaceUrl}/api/`, // API endpoints
                        "https://wa.me/", // WhatsApp official links
                    ];
                    // 🚨 SECURITY: /orders and /checkout are NOT allowed!
                    // They must use short URLs with tokens generated by auto-fix
                    const translationResult = yield translation_security_service_1.default.processResponse(finalResponse, userLanguage, allowedLinks, llmConfig.model, // Use same model as agent
                    llmConfig.baseURL, // Use same baseURL as agent (OpenRouter)
                    llmConfig.apiKey // Use same API key as agent
                    );
                    if (translationResult.blocked) {
                        logger_1.default.warn("⚠️ SECURITY: Blocked inappropriate content", {
                            customerId: customer.id,
                            reason: translationResult.reason,
                            originalLength: finalResponse.length,
                        });
                    }
                    finalResponse = translationResult.translatedText;
                    debugInfo.translationBlocked = translationResult.blocked;
                    debugInfo.translationReason = translationResult.reason;
                }
                catch (error) {
                    logger_1.default.error("❌ Translation & Security Layer failed", error);
                    // Continue with original response if translation fails
                }
            }
            // 🔧 DEBUG: Complete debug information
            debugInfo.stage = "completed";
            debugInfo.finalResponseLength = finalResponse.length;
            debugInfo.tokenUsage = llmResult.tokenUsage;
            debugInfo.costInfo = llmResult.costInfo;
            debugInfo.functionCalls = llmResult.functionCalls || [];
            return {
                success: true,
                output: finalResponse,
                debugInfo: JSON.stringify(debugInfo),
            };
        });
    }
    /**
     * Converte il codice lingua nel nome visualizzato corretto per il prompt
     * @param languageCode Codice lingua (it, en, es, pt)
     * @returns Nome lingua per il prompt
     */
    /**
     * Converte il codice lingua in nome visualizzabile
     * IMPORTANTE: Se language è null/undefined/empty, defaulta a ITALIANO (lingua base del sistema)
     * @param languageCode - Codice lingua (IT, ENG, ESP, PRT) - può essere null
     * @returns Nome visualizzabile della lingua (ITALIANO, ENGLISH, ESPAÑOL, PORTUGUÊS)
     */
    getLanguageDisplayName(languageCode) {
        // ⚠️ FALLBACK: Se language è null/undefined/empty, defaulta a ITALIANO
        if (!languageCode || languageCode.trim() === "") {
            logger_1.default.warn("⚠️ [LANGUAGE] Customer language is null/undefined/empty, defaulting to ITALIANO");
            return "ITALIANO"; // Default per L'Altra Italia
        }
        const languageMap = {
            // Lowercase format (old)
            it: "ITALIANO",
            en: "ENGLISH",
            es: "ESPAÑOL",
            pt: "PORTUGUÊS",
            // Uppercase format (database)
            IT: "ITALIANO",
            ENG: "ENGLISH",
            ESP: "ESPAÑOL",
            PRT: "PORTUGUÊS",
        };
        const displayName = languageMap[languageCode];
        // Se il codice non è riconosciuto, default a ITALIANO (non uppercase del codice sconosciuto)
        if (!displayName) {
            logger_1.default.warn(`⚠️ [LANGUAGE] Unknown language code: ${languageCode}, defaulting to ITALIANO`);
            return "ITALIANO";
        }
        return displayName;
    }
    /**
     * Converte il formato durata token (es. "1h", "30m", "2h") in formato leggibile
     * @param duration Durata in formato "1h", "30m", etc.
     * @returns Durata formattata per il prompt (es. "1 ora", "30 minuti", "2 ore")
     */
    formatTokenDuration(duration) {
        // Estrai numero e unità (es. "1h" -> numero=1, unità=h)
        const match = duration.match(/^(\d+)([hm])$/);
        if (!match)
            return "1 ora"; // Fallback
        const value = parseInt(match[1], 10);
        const unit = match[2];
        if (unit === "h") {
            return value === 1 ? "1 ora" : `${value} ore`;
        }
        else if (unit === "m") {
            return value === 1 ? "1 minuto" : `${value} minuti`;
        }
        return "1 ora"; // Fallback
    }
    /**
     * 🆕 Handle new user welcome message flow
     *
     * This is the ONLY entry point for new user messages.
     * Ensures ALL messages go through Safety & Translation layer.
     *
     * @param phone - Customer phone number
     * @param workspaceId - Workspace ID
     * @param messageContent - Original message from customer
     * @returns Object with welcome message, registration link, and debug info
     */
    handleNewUserWelcome(phone, workspaceId, messageContent) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            logger_1.default.info(`🆕 handleNewUserWelcome called for new user`, {
                phone,
                workspaceId,
            });
            try {
                const messageRepo = new (require("../repositories/message.repository").MessageRepository)();
                const { workspaceService } = require("../services/workspace.service");
                // 1. Get workspace
                const workspace = yield workspaceService.getById(workspaceId);
                if (!workspace) {
                    throw new Error(`Workspace not found: ${workspaceId}`);
                }
                // 2. Get welcome message from database (English)
                const welcomeMessageEnglish = yield messageRepo.getWelcomeMessage(workspaceId);
                if (!welcomeMessageEnglish) {
                    throw new Error("Welcome message not configured in database");
                }
                // 3. Detect customer language
                const { detectLanguageFromPhonePrefix, } = require("../utils/language-detector");
                const detectedLanguage = detectLanguageFromPhonePrefix(phone);
                // 4. Translate through Safety & Translation layer (MANDATORY)
                const welcomeMessageTranslated = yield this.translateSystemMessage(welcomeMessageEnglish, workspaceId, detectedLanguage, undefined, "new_user_welcome");
                // 5. Generate registration link
                const registrationLink = yield this.generateRegistrationLink(phone, workspaceId);
                // 6. Build complete message with link
                const { getRegistrationText } = require("../utils/language-detector");
                const registrationText = getRegistrationText(detectedLanguage);
                const completeMessage = `${welcomeMessageTranslated}\n\n🔗 **${registrationText.link}:**\n${registrationLink}\n\n⏰ ${registrationText.validity}`;
                const executionTimeMs = Date.now() - startTime;
                const debugInfo = {
                    stage: "new_user_welcome",
                    translationLayerPassed: true,
                    detectedLanguage,
                    executionTimeMs,
                    timestamp: new Date().toISOString(),
                };
                logger_1.default.info(`✅ handleNewUserWelcome completed`, {
                    phone,
                    workspaceId,
                    detectedLanguage,
                    executionTimeMs,
                });
                return {
                    success: true,
                    message: completeMessage,
                    debugInfo,
                };
            }
            catch (error) {
                logger_1.default.error(`❌ handleNewUserWelcome failed`, {
                    phone,
                    workspaceId,
                    error: error instanceof Error ? error.message : String(error),
                });
                throw error; // Don't send message if translation/safety failed
            }
        });
    }
    /**
     * Replace all link tokens in the response with actual URLs
     */
    replaceLinkTokens(response_1, customer_1, workspace_1) {
        return __awaiter(this, arguments, void 0, function* (response, customer, workspace, linkReplacements = []) {
            var _a, _b, _c;
            let finalResponse = response;
            // 🚨 NORMALIZE WRONG TOKENS - LLM sometimes writes wrong patterns
            // Convert all wrong variations to correct token format BEFORE checking
            const wrongProfilePatterns = [
                /\[link profilo\]/gi,
                /\[link profile\]/gi,
                /\[profilo link\]/gi,
                /link profilo(?!\w)/gi,
            ];
            wrongProfilePatterns.forEach(pattern => {
                if (pattern.test(finalResponse)) {
                    logger_1.default.warn(`⚠️ LLM wrote wrong token, normalizing to [LINK_PROFILE_WITH_TOKEN]`);
                    finalResponse = finalResponse.replace(pattern, "[LINK_PROFILE_WITH_TOKEN]");
                }
            });
            const wrongCartPatterns = [
                /\[link carrello\]/gi,
                /\[link cart\]/gi,
                /link carrello(?!\w)/gi,
            ];
            wrongCartPatterns.forEach(pattern => {
                if (pattern.test(finalResponse)) {
                    logger_1.default.warn(`⚠️ LLM wrote wrong cart token, normalizing to [LINK_CHECKOUT_WITH_TOKEN]`);
                    finalResponse = finalResponse.replace(pattern, "[LINK_CHECKOUT_WITH_TOKEN]");
                }
            });
            // 🔗 Lista completa dei token supportati
            const SUPPORTED_TOKENS = [
                "[LINK_CHECKOUT_WITH_TOKEN]",
                "[LINK_PROFILE_WITH_TOKEN]",
                "[LINK_CATALOG]",
                "[LINK_REGISTRATION_WITH_TOKEN]",
            ];
            // 🔍 Check e replace di tutti i token in sequenza
            for (const token of SUPPORTED_TOKENS) {
                if (!finalResponse.includes(token))
                    continue;
                try {
                    switch (token) {
                        case "[LINK_CHECKOUT_WITH_TOKEN]": {
                            const checkoutLink = yield this.callingFunctionsService.getCartLink({
                                customerId: customer.id,
                                workspaceId: workspace.id,
                            });
                            const linkUrl = (checkoutLink === null || checkoutLink === void 0 ? void 0 : checkoutLink.linkUrl) || "";
                            linkReplacements.push({
                                token,
                                replacedWith: linkUrl,
                                tokenGenerated: (checkoutLink === null || checkoutLink === void 0 ? void 0 : checkoutLink.token) || "N/A",
                                shortUrlCreated: linkUrl.includes("/s/"),
                                timestamp: new Date().toISOString(),
                            });
                            finalResponse = finalResponse.replace(token, linkUrl);
                            break;
                        }
                        case "[LINK_PROFILE_WITH_TOKEN]": {
                            const profileResult = yield this.callingFunctionsService.replaceLinkWithToken(finalResponse, "profile", customer.id, workspace.id);
                            const profileUrl = ((_b = (_a = profileResult === null || profileResult === void 0 ? void 0 : profileResult.message) === null || _a === void 0 ? void 0 : _a.match(/https?:\/\/[^\s)]+/)) === null || _b === void 0 ? void 0 : _b[0]) || "";
                            linkReplacements.push({
                                token,
                                replacedWith: profileUrl,
                                tokenGenerated: (profileResult === null || profileResult === void 0 ? void 0 : profileResult.token) || "N/A",
                                shortUrlCreated: profileUrl.includes("/s/"),
                                timestamp: new Date().toISOString(),
                            });
                            finalResponse = finalResponse.replace(token, profileUrl);
                            break;
                        }
                        case "[LINK_CATALOG]": {
                            const catalogResult = yield this.callingFunctionsService.replaceLinkWithToken(finalResponse, "catalog", customer.id, workspace.id);
                            if ((catalogResult === null || catalogResult === void 0 ? void 0 : catalogResult.success) && (catalogResult === null || catalogResult === void 0 ? void 0 : catalogResult.message)) {
                                const catalogUrl = ((_c = catalogResult.message.match(/https?:\/\/[^\s)]+/)) === null || _c === void 0 ? void 0 : _c[0]) || "";
                                linkReplacements.push({
                                    token,
                                    replacedWith: catalogUrl,
                                    tokenGenerated: (catalogResult === null || catalogResult === void 0 ? void 0 : catalogResult.token) || "N/A",
                                    shortUrlCreated: catalogUrl.includes("/s/"),
                                    timestamp: new Date().toISOString(),
                                });
                                finalResponse = catalogResult.message;
                            }
                            break;
                        }
                        case "[LINK_REGISTRATION_WITH_TOKEN]": {
                            // TODO: Implementare la logica per il token di registrazione
                            logger_1.default.warn(`⚠️ [TOKEN-REPLACE] Token ${token} found but not implemented yet`);
                            break;
                        }
                        default:
                            logger_1.default.warn(`⚠️ [TOKEN-REPLACE] Unknown token: ${token}`);
                    }
                }
                catch (error) {
                    logger_1.default.error(`❌ [TOKEN-REPLACE] Error replacing ${token}:`, error);
                }
            }
            // 🚨 AUTO-FIX: Replace hardcoded links with proper tokens (LAST STEP)
            const workspaceUrl = workspace.url || "http://localhost:3000";
            // Pattern 1: /orders (without token) -> generate proper link with token
            const ordersPattern = new RegExp(`${workspaceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/orders(?![\\-/])`, "g");
            if (ordersPattern.test(finalResponse)) {
                logger_1.default.warn(`⚠️ AUTO-FIX: LLM generated hardcoded /orders link, replacing with token-based link`);
                // Generate proper orders link with token
                const ordersLink = yield this.callingFunctionsService.getOrdersListLink({
                    customerId: customer.id,
                    workspaceId: workspace.id,
                });
                const properOrdersLink = (ordersLink === null || ordersLink === void 0 ? void 0 : ordersLink.linkUrl) || "";
                // Replace the hardcoded link
                finalResponse = finalResponse.replace(ordersPattern, properOrdersLink);
                linkReplacements.push({
                    token: "[AUTO-FIX: hardcoded /orders]",
                    replacedWith: properOrdersLink,
                    tokenGenerated: (ordersLink === null || ordersLink === void 0 ? void 0 : ordersLink.token) || "N/A",
                    shortUrlCreated: properOrdersLink.includes("/s/"),
                    timestamp: new Date().toISOString(),
                    autoFixed: true,
                });
                logger_1.default.info(`✅ AUTO-FIX: Replaced hardcoded /orders link with: ${properOrdersLink}`);
            }
            // Pattern 2: /checkout (without token) -> generate proper link with token
            const checkoutPattern = new RegExp(`${workspaceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/checkout(?![\\-/])`, "g");
            if (checkoutPattern.test(finalResponse)) {
                logger_1.default.warn(`⚠️ AUTO-FIX: LLM generated hardcoded /checkout link, replacing with token-based link`);
                const checkoutLink = yield this.callingFunctionsService.getCartLink({
                    customerId: customer.id,
                    workspaceId: workspace.id,
                });
                const properCheckoutLink = (checkoutLink === null || checkoutLink === void 0 ? void 0 : checkoutLink.linkUrl) || "";
                finalResponse = finalResponse.replace(checkoutPattern, properCheckoutLink);
                linkReplacements.push({
                    token: "[AUTO-FIX: hardcoded /checkout]",
                    replacedWith: properCheckoutLink,
                    tokenGenerated: (checkoutLink === null || checkoutLink === void 0 ? void 0 : checkoutLink.token) || "N/A",
                    shortUrlCreated: properCheckoutLink.includes("/s/"),
                    timestamp: new Date().toISOString(),
                    autoFixed: true,
                });
                logger_1.default.info(`✅ AUTO-FIX: Replaced hardcoded /checkout link with: ${properCheckoutLink}`);
            }
            return finalResponse;
        });
    }
    getAvailableFunctions() {
        // ✅ SINGLE SOURCE OF TRUTH: Functions loaded from agent-functions.config.ts
        // This ensures consistency between LLM, database seed, and frontend UI
        return (0, agent_functions_config_1.getAllFunctions)();
    }
    generateLLMResponse(processedPrompt_1, userQuery_1, workspace_1, customer_1, customerData_1) {
        return __awaiter(this, arguments, void 0, function* (processedPrompt, userQuery, workspace, customer, customerData, language = "it", // default italiano
        debugInfo, recentMessages = [] // 🆕 Conversation history
        ) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
            try {
                // Build conversation history from recent messages (last 5 minutes)
                const conversationHistory = [];
                // Messages come in desc order, reverse for chronological (oldest to newest)
                const messagesToInclude = recentMessages.reverse();
                for (const msg of messagesToInclude) {
                    // Skip current message to avoid duplication
                    if (msg.content === userQuery && msg.direction === "INBOUND") {
                        continue;
                    }
                    if (msg.direction === "INBOUND") {
                        conversationHistory.push({
                            role: "user",
                            content: msg.content,
                        });
                    }
                    else if (msg.direction === "OUTBOUND" && msg.aiGenerated) {
                        conversationHistory.push({
                            role: "assistant",
                            content: msg.content,
                        });
                    }
                }
                logger_1.default.info(`💬 [HISTORY] Including ${conversationHistory.length} messages in context`);
                if (conversationHistory.length > 0) {
                    logger_1.default.info(`📝 [HISTORY] Last message in history:`, conversationHistory[conversationHistory.length - 1]);
                }
                const messages = [
                    {
                        role: "system",
                        content: processedPrompt,
                    },
                    ...conversationHistory, // 🆕 Add conversation history
                    {
                        role: "user",
                        content: userQuery,
                    },
                ];
                logger_1.default.info(`🔢 [MESSAGES] Total messages sent to LLM: ${messages.length}`);
                // 🤖 Get LLM configuration (OpenRouter cloud)
                const agentConfig = (_a = workspace.agentConfigs) === null || _a === void 0 ? void 0 : _a[0];
                const agentModel = agentConfig === null || agentConfig === void 0 ? void 0 : agentConfig.model;
                logger_1.default.info(`📊 Agent model from DB: "${agentModel}"`);
                const llmConfig = (0, llm_config_1.getLLMConfig)(agentModel);
                logger_1.default.info(`🤖 Using OpenRouter: ${llmConfig.model} at ${llmConfig.baseURL}`);
                // Debug API key
                if (!llmConfig.apiKey) {
                    logger_1.default.error("❌ API KEY MANCANTE! llmConfig.apiKey è vuoto/undefined");
                }
                const response = yield fetch(`${llmConfig.baseURL}/chat/completions`, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${llmConfig.apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "http://localhost:3001",
                        "X-Title": "eChatbot LLM Response",
                    },
                    body: JSON.stringify({
                        model: llmConfig.model,
                        messages: messages,
                        tools: this.getAvailableFunctions(),
                        temperature: 0,
                        max_tokens: workspace.maxTokens || 5000,
                    }),
                });
                logger_1.default.info("***language", language);
                logger_1.default.info(`🌐 OpenRouter status:`, response.status);
                // Check if response is OK
                if (!response.ok) {
                    const errorText = yield response.text();
                    logger_1.default.error(`❌ LLM API Error (${response.status}):`, errorText);
                    throw new Error(`LLM API returned ${response.status}: ${errorText}`);
                }
                const data = yield response.json();
                logger_1.default.info(`🌐 OpenRouter response:`, JSON.stringify(data, null, 2));
                // Verify response structure
                if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                    logger_1.default.error("❌ Invalid LLM response structure:", data);
                    throw new Error("LLM response missing choices/message");
                }
                // 🔧 DEBUG: Calculate token usage and cost
                let tokenUsage = null;
                let costInfo = null;
                if (data.usage) {
                    tokenUsage = {
                        promptTokens: data.usage.prompt_tokens,
                        completionTokens: data.usage.completion_tokens,
                        totalTokens: data.usage.total_tokens,
                    };
                    costInfo = calculateLLMCost(data.usage.prompt_tokens, data.usage.completion_tokens, "openai/gpt-4o-mini");
                }
                else {
                    // Fallback calculation if API doesn't return usage
                    const estimatedUsage = calculateLLMTokenUsage(processedPrompt, userQuery, ((_d = (_c = (_b = data.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "");
                    tokenUsage = estimatedUsage;
                    costInfo = calculateLLMCost(estimatedUsage.promptTokens, estimatedUsage.completionTokens, "openai/gpt-4o-mini");
                }
                // 🌍 Base messages in English - Translation & Security Layer will translate to customer's language
                const i18n = {
                    errors: {
                        orderNotFound: "Sorry, we couldn't find your order. Please provide the order code and I'll help you find it.",
                        trackingNotFound: "Sorry, I can't find tracking information for your order right now. Please contact our customer service for assistance.",
                        generic: "An error has occurred.",
                    },
                    success: {
                        orderLink: "Hello! To protect your privacy I cannot send you the details here via WhatsApp but here is a secure link where you can download documents and see all the details realted, Do you need help with anything else? 😊",
                        trackingLink: "Hello! Your order is on the way 📦 Track your package in real time:",
                        default: "Hello! 😊 Here you can see your order: for security reasons it will be valid for 1 hour -",
                    },
                    fallback: "Hello! How can I help you today? ",
                };
                // 🔧 DEBUG: Track function calls
                let functionCalls = [];
                // 🧪 TEST MODE: If in test environment, only track function calls without executing them
                const isTestMode = process.env.NODE_ENV === "test" ||
                    process.env.INTEGRATION_TEST === "true";
                // Gestione tool calls (chiamate funzioni)
                // 🔧 SUPPORT MULTIPLE TOOL CALLS - Process all tool_calls returned by LLM
                if ((_g = (_f = (_e = data.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.tool_calls) {
                    const toolCalls = data.choices[0].message.tool_calls;
                    // 🚨 Log multiple function calls
                    if (toolCalls.length > 1) {
                        logger_1.default.info(`🔄 Multiple function calls detected: ${toolCalls.length} calls`);
                        toolCalls.forEach((tc, idx) => {
                            logger_1.default.info(`  ${idx + 1}. ${tc.function.name}`);
                        });
                    }
                    // Process FIRST tool call (for now, maintain backward compatibility)
                    const toolCall = toolCalls[0];
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
                    // 🔧 DEBUG: Record function call details
                    functionCalls.push({
                        name: functionName,
                        arguments: functionArgs,
                        timestamp: new Date().toISOString(),
                    });
                    // 🧪 TEST MODE: Skip function execution, just return detection info
                    if (isTestMode) {
                        logger_1.default.info(`🧪 [TEST MODE] Function detected but NOT executed: ${functionName}`);
                        const testResponse = data.choices[0].message.content ||
                            `Function ${functionName} would be called with args: ${JSON.stringify(functionArgs)}`;
                        return {
                            response: testResponse,
                            tokenUsage,
                            costInfo,
                            functionCalls,
                        };
                    }
                    // 📊 BACKGROUND FUNCTIONS (PRIORITY 5) - Non bloccare il flusso conversazionale
                    // Queste funzioni vengono eseguite in parallelo senza aspettare il risultato
                    // L'utente NON è consapevole dell'esecuzione, il LLM risponde normalmente
                    const BACKGROUND_FUNCTIONS = ["searchProduct"];
                    if (BACKGROUND_FUNCTIONS.includes(functionName)) {
                        // Esegui la funzione in background (non aspettare il risultato)
                        logger_1.default.info(`🔍 [BACKGROUND] Executing ${functionName} in background...`);
                        this.executeFunctionCall(functionName, functionArgs, customer, workspace, customerData).catch((error) => {
                            logger_1.default.error(`❌ [BACKGROUND] Error in ${functionName}:`, error);
                        });
                        // Chiedi all'LLM di generare una risposta naturale come se la funzione non fosse stata chiamata
                        logger_1.default.info("💬 [BACKGROUND] Asking LLM for natural response (ignoring function call)...");
                        // Fai una seconda chiamata all'LLM dicendogli che la funzione è stata eseguita con successo
                        // ma chiedi una risposta naturale come se non ci fosse stata chiamata
                        const followUpMessages = [
                            {
                                role: "system",
                                content: processedPrompt,
                            },
                            ...conversationHistory,
                            {
                                role: "user",
                                content: userQuery,
                            },
                            {
                                role: "assistant",
                                content: null,
                                tool_calls: [toolCall],
                            },
                            {
                                role: "tool",
                                tool_call_id: toolCall.id,
                                name: functionName,
                                content: JSON.stringify({
                                    success: true,
                                    message: "Ricerca registrata con successo (background)",
                                }),
                            },
                        ];
                        // 🤖 Get LLM configuration for follow-up request
                        // FIX: workspace has agentConfigs (array), not agentConfig (singular)
                        const agentConfigFollowUp = (_h = workspace.agentConfigs) === null || _h === void 0 ? void 0 : _h[0];
                        const llmConfigFollowUp = (0, llm_config_1.getLLMConfig)(agentConfigFollowUp === null || agentConfigFollowUp === void 0 ? void 0 : agentConfigFollowUp.model);
                        const followUpResponse = yield fetch(`${llmConfigFollowUp.baseURL}/chat/completions`, {
                            method: "POST",
                            headers: {
                                Authorization: `Bearer ${llmConfigFollowUp.apiKey}`,
                                "Content-Type": "application/json",
                                "HTTP-Referer": "http://localhost:3001",
                                "X-Title": "eChatbot LLM Response",
                            },
                            body: JSON.stringify({
                                model: llmConfigFollowUp.model,
                                messages: followUpMessages,
                                temperature: 0,
                                max_tokens: workspace.maxTokens || 5000,
                            }),
                        });
                        const followUpData = yield followUpResponse.json();
                        logger_1.default.info("🌐 [BACKGROUND] Follow-up response:", JSON.stringify(followUpData, null, 2));
                        const naturalResponse = ((_l = (_k = (_j = followUpData.choices) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.message) === null || _l === void 0 ? void 0 : _l.content) ||
                            i18n.fallback[language];
                        logger_1.default.info(`✅ [BACKGROUND] Natural response generated:`, naturalResponse);
                        return {
                            response: naturalResponse,
                            tokenUsage,
                            costInfo,
                            functionCalls,
                        };
                    }
                    // Funzioni NORMALI (bloccanti) - comportamento originale
                    const functionResult = yield this.executeFunctionCall(functionName, functionArgs, customer, workspace, customerData);
                    // Add function result to debug info
                    functionCalls[0].result = {
                        success: functionResult.success,
                        message: functionResult.message || functionResult.output,
                    };
                    if (functionResult.success === false) {
                        if (functionName === "getLinkOrderByCode") {
                            return {
                                response: i18n.errors.orderNotFound,
                                tokenUsage,
                                costInfo,
                                functionCalls,
                            };
                        }
                        if (functionName === "GetShipmentTrackingLink") {
                            return {
                                response: i18n.errors.trackingNotFound,
                                tokenUsage,
                                costInfo,
                                functionCalls,
                            };
                        }
                        return {
                            response: functionResult.message ||
                                functionResult.error ||
                                i18n.errors.generic,
                            tokenUsage,
                            costInfo,
                            functionCalls,
                        };
                    }
                    if (functionName === "contactOperator") {
                        // 🚨 CRITICAL: Return EXACT message from function - NO LLM reformulation
                        // Operator escalation must use precise, contractual language
                        const processedMessage = this.replaceVariablesInResponse(functionResult.message || "", {
                            nameUser: (customerData === null || customerData === void 0 ? void 0 : customerData.nameUser) || customer.name || "Cliente",
                            discountUser: String((customerData === null || customerData === void 0 ? void 0 : customerData.discountUser) || customer.discount || 0),
                            companyName: (customerData === null || customerData === void 0 ? void 0 : customerData.companyName) || workspace.name || "Shop",
                            lastordercode: (customerData === null || customerData === void 0 ? void 0 : customerData.lastordercode) || customer.lastOrderCode || "",
                            languageUser: (customerData === null || customerData === void 0 ? void 0 : customerData.languageUser) || customer.language || language,
                            agentName: customer.sales
                                ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
                                : "Alessandro Romano",
                            agentPhone: ((_m = customer.sales) === null || _m === void 0 ? void 0 : _m.phone) || "+39 333 890 1234",
                            agentEmail: ((_o = customer.sales) === null || _o === void 0 ? void 0 : _o.email) || "andrea_gelsomino@hotmail.com",
                            tokenDuration: this.getTokenDurationText(process.env.TOKEN_EXPIRATION || "1h"),
                        });
                        return {
                            response: processedMessage,
                            tokenUsage,
                            costInfo,
                            functionCalls,
                        };
                    }
                    if (functionName === "getLinkOrderByCode") {
                        // Always return in English - Translation & Security Layer will translate to customer's language
                        const tokenDuration = this.getTokenDurationText(process.env.TOKEN_EXPIRATION || "15m");
                        return {
                            response: `${i18n.success.orderLink} ${functionResult.linkUrl || functionResult.output || functionResult.message}\n\n⏰ Link valid for ${tokenDuration}`,
                            tokenUsage,
                            costInfo,
                            functionCalls,
                        };
                    }
                    // Replace variables in function result message before returning
                    const rawResponse = functionResult.message ||
                        functionResult.output ||
                        functionResult.linkUrl ||
                        `${i18n.success.default[language]} ${functionResult.linkUrl}`;
                    const processedFunctionResponse = this.replaceVariablesInResponse(rawResponse, {
                        nameUser: (customerData === null || customerData === void 0 ? void 0 : customerData.nameUser) || customer.name || "Cliente",
                        discountUser: String((customerData === null || customerData === void 0 ? void 0 : customerData.discountUser) || customer.discount || 0),
                        companyName: (customerData === null || customerData === void 0 ? void 0 : customerData.companyName) || workspace.name || "Shop",
                        lastordercode: (customerData === null || customerData === void 0 ? void 0 : customerData.lastordercode) || customer.lastOrderCode || "",
                        languageUser: (customerData === null || customerData === void 0 ? void 0 : customerData.languageUser) || customer.language || language,
                        agentName: customer.sales
                            ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
                            : "Agente",
                        agentPhone: ((_p = customer.sales) === null || _p === void 0 ? void 0 : _p.phone) || "N/A",
                        agentEmail: ((_q = customer.sales) === null || _q === void 0 ? void 0 : _q.email) || "info@laltrait.com",
                        tokenDuration: this.getTokenDurationText(process.env.TOKEN_EXPIRATION || "1h"),
                    });
                    // 🔗 Replace link tokens in CF response (e.g., [LINK_CHECKOUT_WITH_TOKEN])
                    const linkReplacements = [];
                    const finalFunctionResponse = yield this.replaceLinkTokens(processedFunctionResponse, customer, workspace, linkReplacements);
                    return {
                        response: finalFunctionResponse,
                        tokenUsage,
                        costInfo,
                        functionCalls,
                    };
                }
                const llmResponse = ((_t = (_s = (_r = data.choices) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.message) === null || _t === void 0 ? void 0 : _t.content) || i18n.fallback;
                logger_1.default.info(`📝 LLM Response content length: ${(llmResponse === null || llmResponse === void 0 ? void 0 : llmResponse.length) || 0} chars`);
                // 🔧 POST-PROCESS: Replace variables in LLM response
                // LLM might generate text with {{variables}} that need to be replaced
                const processedResponse = this.replaceVariablesInResponse(llmResponse, {
                    nameUser: (customerData === null || customerData === void 0 ? void 0 : customerData.nameUser) || customer.name || "Cliente",
                    discountUser: String((customerData === null || customerData === void 0 ? void 0 : customerData.discountUser) || customer.discount || 0),
                    companyName: (customerData === null || customerData === void 0 ? void 0 : customerData.companyName) || workspace.name || "Shop",
                    lastordercode: (customerData === null || customerData === void 0 ? void 0 : customerData.lastordercode) || customer.lastOrderCode || "",
                    languageUser: (customerData === null || customerData === void 0 ? void 0 : customerData.languageUser) || customer.language || language,
                    agentName: customer.sales
                        ? `${customer.sales.firstName} ${customer.sales.lastName}`.trim()
                        : "Agente",
                    agentPhone: ((_u = customer.sales) === null || _u === void 0 ? void 0 : _u.phone) || "N/A",
                    agentEmail: ((_v = customer.sales) === null || _v === void 0 ? void 0 : _v.email) || "info@laltrait.com",
                    tokenDuration: this.getTokenDurationText(process.env.TOKEN_EXPIRATION || "1h"),
                });
                logger_1.default.info("🎯 LLM Final Response:", processedResponse);
                return {
                    response: processedResponse,
                    tokenUsage,
                    costInfo,
                    functionCalls,
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error generating LLM response:", error);
                return {
                    response: "❌ Sorry, an error occurred. Please try again later. Translation & Security Layer will translate this.",
                    tokenUsage: null,
                    costInfo: null,
                    functionCalls: [],
                };
            }
        });
    }
    executeFunctionCall(functionName, args, customer, workspace, customerData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 🎯 PRIORITY ORDER (reflected in switch statement order):
                // 1. contactOperator (🚨 PRIORITY 1 - Frustration, explicit operator request)
                // 2. getLinkOrderByCode (🚨 PRIORITY 2 - View specific order)
                // 3. repeatOrder (⚙️ PRIORITY 3 - Repeat previous order)
                // 4. addProduct (⚙️ PRIORITY 4 - Add single product)
                // 5. searchProduct (📊 PRIORITY 5 - BACKGROUND ONLY)
                switch (functionName) {
                    case "contactOperator":
                        // 🚨 PRIORITY 1 - HIGHEST
                        logger_1.default.info("📞 contactOperator called (PRIORITY 1)");
                        const contactResult = yield this.callingFunctionsService.contactOperator({
                            customerId: customer.id,
                            workspaceId: workspace.id,
                            phoneNumber: customer.phone,
                        });
                        // 📧 Se il Summary Agent è stato eseguito, logga per debug
                        if (contactResult.summaryAgentExecuted) {
                            logger_1.default.info("🤖 Summary Agent executed within contactOperator", {
                                agentType: "summary_agent",
                                ticketId: contactResult.ticketId,
                                emailSent: contactResult.summaryEmailSent,
                                timestamp: new Date().toISOString(),
                                function: "contactOperator"
                            });
                        }
                        return contactResult;
                    case "getLinkOrderByCode":
                        // 🚨 PRIORITY 2 - HIGH
                        logger_1.default.info("📦 getLinkOrderByCode called (PRIORITY 2):", args);
                        return yield this.callingFunctionsService.getOrdersListLink({
                            customerId: customer.id,
                            workspaceId: workspace.id,
                            orderCode: args.orderCode ||
                                (customerData === null || customerData === void 0 ? void 0 : customerData.lastordercode) ||
                                customer.lastOrderCode,
                        });
                    case "repeatOrder":
                        // ⚙️ PRIORITY 3 - MEDIUM (requires confirmation)
                        logger_1.default.info("🔄 repeatOrder called (PRIORITY 3):", args);
                        const { repeatOrder, } = require("../domain/calling-functions/repeatOrder");
                        return yield repeatOrder({
                            customerId: customer.id,
                            workspaceId: workspace.id,
                            orderCode: args.orderCode,
                        });
                    case "resetCart":
                        // 🗑️ PRIORITY 3.5 - MEDIUM (requires confirmation)
                        logger_1.default.info("🗑️ resetCart called (PRIORITY 3.5):", args);
                        const { resetCart } = require("../domain/calling-functions/resetCart");
                        return yield resetCart({
                            customerId: customer.id,
                            workspaceId: workspace.id,
                        });
                    case "addProduct":
                        // 🛒 PRIORITY 4 - MEDIUM (requires confirmation, add one or more products)
                        logger_1.default.info("🛒 addProduct called (PRIORITY 4):", args);
                        const { addProduct, } = require("../domain/calling-functions/addProduct");
                        return yield addProduct({
                            customerId: customer.id,
                            workspaceId: workspace.id,
                            products: args.products, // Array of {sku, quantity, notes}
                        });
                    case "manageNotifications":
                        // 🔔 PRIORITY 4.5 - MEDIUM (SUBSCRIBE/UNSUBSCRIBE push notifications)
                        logger_1.default.info("🔔 manageNotifications called (PRIORITY 4.5):", args);
                        return yield this.callingFunctionsService.manageNotifications({
                            action: args.action,
                            customerId: customer.id,
                            workspaceId: workspace.id,
                        });
                    case "searchProduct":
                        // 📊 PRIORITY 5 - BACKGROUND ONLY (non-blocking, analytics)
                        logger_1.default.info("🔍 searchProduct called (PRIORITY 5 - BACKGROUND):", args);
                        return yield this.callingFunctionsService.searchProduct({
                            customerId: customer.id,
                            workspaceId: workspace.id,
                            productName: args.productName,
                        });
                    default:
                        logger_1.default.error(`❌ Unknown function: ${functionName}`);
                        return { error: "Funzione non riconosciuta" };
                }
            }
            catch (error) {
                logger_1.default.error(`❌ Error executing function ${functionName}:`, error);
                return { error: `Errore nell'esecuzione della funzione ${functionName}` };
            }
        });
    }
    // Funzione helper per generare il messaggio di benvenuto con link di registrazione
    newUserLink(phone, workspaceId, welcomeMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            const registrationLink = yield this.generateRegistrationLink(phone, workspaceId);
            if (welcomeMessage.includes("[LINK_REGISTRATION_WITH_TOKEN]")) {
                return welcomeMessage.replace("[LINK_REGISTRATION_WITH_TOKEN]", registrationLink);
            }
            else {
                return (welcomeMessage + `\nPer registrarti clicca qui: ${registrationLink}`);
            }
        });
    }
    generateRegistrationLink(phone, workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Crea un token di registrazione e restituisci il link completo
            const tokenService = new token_service_1.TokenService();
            const messageRepo = new (require("../repositories/message.repository").MessageRepository)();
            const token = yield tokenService.createRegistrationToken(phone, workspaceId);
            const workspaceUrl = yield messageRepo.getWorkspaceUrl(workspaceId);
            const registrationLink = `${workspaceUrl.replace(/\/$/, "")}/registration?token=${token}`;
            // Create short URL for registration link
            try {
                const { URLShortenerService, } = require("../application/services/url-shortener.service");
                const urlShortenerService = new URLShortenerService();
                const shortResult = yield urlShortenerService.createShortUrl(registrationLink, workspaceId);
                const finalRegistrationLink = `${workspaceUrl.replace(/\/$/, "")}${shortResult.shortUrl}`;
                logger_1.default.info(`📎 Created short registration link: ${finalRegistrationLink} → ${registrationLink}`);
                return finalRegistrationLink;
            }
            catch (shortError) {
                logger_1.default.warn("⚠️ Failed to create short URL for registration, using long URL:", shortError);
                return registrationLink;
            }
        });
    }
    /**
     * Translate system message (welcome/WIP) through Safety & Translation layer
     * @param message - System message in English
     * @param workspaceId - Workspace ID
     * @param targetLanguage - Customer's language (it/es/en/pt)
     * @param customerName - Optional customer name for context
     * @param messageType - Type of message for debug logging
     * @returns Translated and safety-checked message
     */
    translateSystemMessage(message_1, workspaceId_1, targetLanguage_1, customerName_1) {
        return __awaiter(this, arguments, void 0, function* (message, workspaceId, targetLanguage, customerName, messageType = "system_message") {
            const startTime = Date.now();
            try {
                logger_1.default.info(`🌐 Translating ${messageType} through Safety & Translation layer`, {
                    workspaceId,
                    targetLanguage,
                    messageType,
                    originalLength: message.length,
                });
                const safetyAgent = new SafetyTranslationAgent_1.SafetyTranslationAgent(database_1.prisma);
                const result = yield safetyAgent.process({
                    workspaceId,
                    response: message,
                    targetLanguage,
                    customerName,
                    allowedLinks: [], // System messages don't have dynamic links
                });
                const executionTimeMs = Date.now() - startTime;
                if (!result.safe) {
                    logger_1.default.error(`❌ ${messageType} BLOCKED by Safety & Translation`, {
                        workspaceId,
                        blockedReason: result.blockedReason,
                        messageType,
                    });
                    // BLOCK: Don't send if safety check fails
                    throw new Error(`System message blocked: ${result.blockedReason}`);
                }
                logger_1.default.info(`✅ ${messageType} translated successfully`, {
                    workspaceId,
                    targetLanguage,
                    tokensUsed: result.tokensUsed,
                    executionTimeMs,
                    messageType,
                });
                return result.translatedText;
            }
            catch (error) {
                logger_1.default.error(`❌ Failed to translate ${messageType}`, {
                    workspaceId,
                    error: error instanceof Error ? error.message : String(error),
                    messageType,
                });
                throw error; // BLOCK: Don't fall back to untranslated message
            }
        });
    }
    // Funzione che gestisce il flusso per un nuovo utente e ritorna direttamente l'oggetto di risposta
    NewUser(llmRequest, workspace, messageRepo, debugInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            // 1. Get welcome message from database (English only)
            const welcomeMessageEnglish = yield messageRepo.getWelcomeMessage(workspace.id);
            if (!welcomeMessageEnglish) {
                throw new Error("Welcome message not configured in database - this should not happen");
            }
            // 2. Detect customer language
            const { detectLanguageFromPhonePrefix, } = require("../utils/language-detector");
            const detectedLanguage = detectLanguageFromPhonePrefix(llmRequest.phone);
            logger_1.default.info(`🌐 NewUser: Detected language ${detectedLanguage} for phone ${llmRequest.phone}`);
            // 3. Translate welcome message through Safety & Translation layer
            let welcomeMessage;
            try {
                welcomeMessage = yield this.translateSystemMessage(welcomeMessageEnglish, workspace.id, detectedLanguage, undefined, // No customer name yet (new user)
                "welcome_message");
                debugInfo = Object.assign(Object.assign({}, debugInfo), { stage: "new_user_welcome", translationLayerPassed: true, detectedLanguage, translationTimeMs: Date.now() - startTime });
            }
            catch (translationError) {
                // BLOCK: If translation fails, don't send message
                logger_1.default.error("❌ NewUser: Translation layer BLOCKED welcome message", {
                    error: translationError instanceof Error
                        ? translationError.message
                        : String(translationError),
                    workspaceId: workspace.id,
                    phone: llmRequest.phone,
                });
                throw new Error(`Welcome message translation failed: ${translationError instanceof Error ? translationError.message : "Unknown error"}`);
            }
            // 4. Generate registration link and build final message
            const output = yield this.newUserLink(llmRequest.phone, workspace.id, welcomeMessage);
            return {
                success: false,
                output,
                debugInfo: JSON.stringify(debugInfo),
            };
        });
    }
    /**
     * Replace variables in LLM response
     * LLM might generate text with {{variables}} that need to be replaced with actual values
     */
    replaceVariablesInResponse(text, variables) {
        let result = text;
        // Replace all known variables
        result = result.replace(/\{\{nameUser\}\}/g, variables.nameUser);
        result = result.replace(/\{\{discountUser\}\}/g, variables.discountUser);
        result = result.replace(/\{\{companyName\}\}/g, variables.companyName);
        result = result.replace(/\{\{lastordercode\}\}/g, variables.lastordercode);
        result = result.replace(/\{\{languageUser\}\}/g, variables.languageUser);
        result = result.replace(/\{\{agentName\}\}/g, variables.agentName);
        result = result.replace(/\{\{agentPhone\}\}/g, variables.agentPhone);
        result = result.replace(/\{\{agentEmail\}\}/g, variables.agentEmail);
        result = result.replace(/\{\{TOKEN_DURATION\}\}/g, variables.tokenDuration);
        return result;
    }
    /**
     * Convert token expiration time to human-readable text
     */
    getTokenDurationText(expiration) {
        const hours = parseInt(expiration.replace(/[^0-9]/g, ""));
        if (expiration.includes("h")) {
            return hours === 1 ? "1 ora" : `${hours} ore`;
        }
        else if (expiration.includes("m")) {
            const minutes = hours;
            return `${minutes} minuti`;
        }
        else if (expiration.includes("d")) {
            const days = hours;
            return days === 1 ? "1 giorno" : `${days} giorni`;
        }
        // Default fallback
        return "1 ora";
    }
}
exports.LLMService = LLMService;
//# sourceMappingURL=llm.service.js.map