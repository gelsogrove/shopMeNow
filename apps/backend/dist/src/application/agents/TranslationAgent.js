"use strict";
/**
 * TranslationAgent
 *
 * Translation layer that runs AFTER Security Agent validates content.
 * Translates all agent responses to customer's language.
 *
 * Uses TRANSLATION agent config from database (order: 99)
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
 * @critical ALWAYS call this AFTER Security Agent passes
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
exports.TranslationAgent = void 0;
const database_1 = require("@echatbot/database");
const axios_1 = __importDefault(require("axios"));
const agent_config_repository_1 = require("../../repositories/agent-config.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
class TranslationAgent {
    constructor(prisma) {
        this.prisma = prisma;
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        this.agentConfigRepo = new agent_config_repository_1.AgentConfigRepository(prisma);
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.openRouterApiKey) {
            logger_1.default.warn("⚠️ OPENROUTER_API_KEY not found - Translation layer will return message as-is");
        }
        else {
            logger_1.default.info("✅ TranslationAgent initialized with OpenRouter API key");
        }
    }
    /**
     * Translate message to target language
     *
     * @param options - Processing options
     * @returns TranslationResult with translated message
     */
    process(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const startTime = Date.now();
            // 🔍 DEBUG: Log exactly what language we received
            logger_1.default.info(`🌍 TranslationAgent.process() called`, {
                targetLanguage: options.targetLanguage,
                workspaceId: options.workspaceId,
                customerName: options.customerName,
                messageLength: (_a = options.message) === null || _a === void 0 ? void 0 : _a.length,
            });
            try {
                // 1. Normalize target language
                const normalizedLanguage = this.normalizeLanguage(options.targetLanguage);
                // 🆕 ALWAYS translate to target language - input may be mixed Italian/English
                // The Translation Agent will translate EVERYTHING to the target language
                // NOTE: Never skip translation - content from DB may be in any language
                logger_1.default.info(`🌍 TranslationAgent - Translating to ${normalizedLanguage.toUpperCase()} (original input: ${options.targetLanguage})`);
                // 2. Load TRANSLATION agent config from database
                const translationAgent = yield this.agentConfigRepo.findByType(options.workspaceId, "TRANSLATION");
                if (!translationAgent) {
                    logger_1.default.warn(`⚠️ TRANSLATION agent not configured for workspace ${options.workspaceId}`);
                    // Fallback: return message without translation
                    return {
                        translated: false,
                        originalLanguage: "it",
                        targetLanguage: options.targetLanguage,
                        message: options.message,
                        tokensUsed: 0,
                        executionTimeMs: Date.now() - startTime,
                    };
                }
                if (!translationAgent.isActive) {
                    logger_1.default.warn(`⚠️ TRANSLATION agent is INACTIVE for workspace ${options.workspaceId}`);
                    // Return message without translation if agent disabled
                    return {
                        translated: false,
                        originalLanguage: "it",
                        targetLanguage: options.targetLanguage,
                        message: options.message,
                        tokensUsed: 0,
                        executionTimeMs: Date.now() - startTime,
                    };
                }
                // 2.5 🆕 Load translation settings from workspace
                const translationSettings = yield this.loadTranslationSettings(options.workspaceId);
                logger_1.default.info("🌍 TranslationAgent settings loaded", {
                    translateProductNames: translationSettings.translateProductNames,
                    translateCategoryNames: translationSettings.translateCategoryNames,
                    translateServiceNames: translationSettings.translateServiceNames,
                    catalogBaseLanguage: translationSettings.catalogBaseLanguage,
                });
                // 3. Build system prompt with dynamic customer info
                const systemPrompt = this.buildSystemPrompt(translationAgent.systemPrompt, {
                    nameUser: options.customerName || "Customer",
                    languageUser: normalizedLanguage,
                    workspaceId: options.workspaceId,
                });
                // 4. Build user message with translation rules based on workspace settings
                const targetLanguageName = this.getLanguageName(normalizedLanguage);
                const preservationRules = this.buildPreservationRules(translationSettings);
                const userMessage = `Translate this message to ${targetLanguageName}. The input may be in Italian, English, or mixed. Output must be 100% in ${targetLanguageName}.

${preservationRules}

Message to translate:
"${options.message}"

Respond with JSON: {"translated": true, "originalLanguage": "mixed", "targetLanguage": "${normalizedLanguage}", "message": "..."}`;
                // 🔍 DEBUG: Log INPUT to TranslationAgent
                logger_1.default.info("🔍 TranslationAgent INPUT", {
                    containsImgTag: (_b = options.message) === null || _b === void 0 ? void 0 : _b.includes('<img'),
                    messagePreview: (_c = options.message) === null || _c === void 0 ? void 0 : _c.substring(0, 500),
                    preservationRules,
                });
                // 5. Call OpenRouter LLM
                logger_1.default.info("🌍 Calling TranslationAgent LLM", {
                    workspaceId: options.workspaceId,
                    model: translationAgent.model,
                    targetLanguage: normalizedLanguage,
                });
                const headers = {
                    Authorization: `Bearer ${this.openRouterApiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
                    "X-Title": "eChatbot Translation Layer",
                };
                const buildRequest = (userContent) => ({
                    model: translationAgent.model,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                        },
                        {
                            role: "user",
                            content: userContent,
                        },
                    ],
                    temperature: translationAgent.temperature,
                    max_tokens: translationAgent.maxTokens,
                    response_format: { type: "json_object" },
                });
                const callTranslationLLM = (userContent) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c, _d, _e, _f;
                    const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, buildRequest(userContent), {
                        headers,
                        timeout: 30000,
                    });
                    const llmResponse = ((_d = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.choices) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "";
                    const tokensUsed = ((_f = (_e = response.data) === null || _e === void 0 ? void 0 : _e.usage) === null || _f === void 0 ? void 0 : _f.total_tokens) || 0;
                    return { llmResponse, tokensUsed };
                });
                const initialCall = yield callTranslationLLM(userMessage);
                let totalTokens = initialCall.tokensUsed;
                let parsedResult = this.parseTranslationResponse(initialCall.llmResponse);
                let translatedMessage = (parsedResult === null || parsedResult === void 0 ? void 0 : parsedResult.message) || options.message;
                let translated = parsedResult
                    ? parsedResult.translated !== false && parsedResult.message !== undefined
                    : false;
                const needsForceTranslation = !translated ||
                    (translatedMessage.trim() === options.message.trim() &&
                        this.detectEnglishContent(options.message));
                if (needsForceTranslation) {
                    logger_1.default.info("🌍 TranslationAgent forcing re-translation", {
                        workspaceId: options.workspaceId,
                        targetLanguage: normalizedLanguage,
                    });
                    const forceInstruction = `IMPORTANT: The previous translation matched the original input. Translate the text again to ${targetLanguageName}, ensure the output is entirely in ${targetLanguageName} and not identical to the input, and still respond with the requested JSON object.`;
                    const forcedCall = yield callTranslationLLM(`${userMessage}\n${forceInstruction}`);
                    totalTokens += forcedCall.tokensUsed;
                    const forcedParsed = this.parseTranslationResponse(forcedCall.llmResponse);
                    if (forcedParsed === null || forcedParsed === void 0 ? void 0 : forcedParsed.message) {
                        parsedResult = forcedParsed;
                        translatedMessage = forcedParsed.message;
                        translated =
                            forcedParsed.translated !== false && forcedParsed.message !== undefined;
                    }
                }
                const executionTimeMs = Date.now() - startTime;
                // 🔍 DEBUG: Log OUTPUT from TranslationAgent LLM
                logger_1.default.info("🔍 TranslationAgent OUTPUT", {
                    containsImgTag: translatedMessage === null || translatedMessage === void 0 ? void 0 : translatedMessage.includes('<img'),
                    llmResponsePreview: translatedMessage === null || translatedMessage === void 0 ? void 0 : translatedMessage.substring(0, 500),
                });
                logger_1.default.info("✅ TranslationAgent completed", {
                    translated,
                    targetLanguage: normalizedLanguage,
                    tokensUsed: totalTokens,
                    executionTimeMs,
                });
                return {
                    translated,
                    originalLanguage: "en",
                    targetLanguage: normalizedLanguage,
                    message: translatedMessage,
                    tokensUsed: totalTokens,
                    executionTimeMs,
                    systemPrompt: systemPrompt,
                    model: translationAgent.model,
                };
            }
            catch (error) {
                logger_1.default.error("❌ TranslationAgent error", error);
                // On error, return message as-is (fail-open for availability)
                return {
                    translated: false,
                    originalLanguage: "en",
                    targetLanguage: options.targetLanguage,
                    message: options.message,
                    tokensUsed: 0,
                    executionTimeMs: Date.now() - startTime,
                };
            }
        });
    }
    /**
     * Build system prompt with template variable replacement
     *
     * @param basePrompt - Base prompt from database
     * @param variables - Template variables for replacement
     * @returns Processed system prompt
     */
    buildSystemPrompt(basePrompt, variables) {
        let prompt = basePrompt;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, "g");
            prompt = prompt.replace(regex, value);
        }
        return prompt;
    }
    /**
     * Normalize language code (it, es, pt, en)
     *
     * @param language - Language code or name
     * @returns Normalized language code
     */
    normalizeLanguage(language) {
        var _a;
        const normalized = ((_a = language === null || language === void 0 ? void 0 : language.toLowerCase) === null || _a === void 0 ? void 0 : _a.call(language)) || "en";
        // Map common language codes
        const mapping = {
            italian: "it",
            italiano: "it",
            it: "it",
            ita: "it", // 🆕 Handle ITA code for Italian
            spanish: "es",
            español: "es",
            espanol: "es",
            es: "es",
            esp: "es",
            spa: "es", // 🆕 Handle SPA code for Spanish
            portuguese: "pt",
            português: "pt",
            portugues: "pt",
            pt: "pt",
            prt: "pt", // 🆕 Handle PRT code for Portuguese
            english: "en",
            en: "en",
            eng: "en",
            french: "fr",
            francais: "fr",
            français: "fr",
            fr: "fr",
            german: "de",
            deutsch: "de",
            de: "de",
        };
        return mapping[normalized] || "en";
    }
    /**
     * Get full language name from code
     *
     * @param code - Language code (it, es, pt, en)
     * @returns Full language name
     */
    getLanguageName(code) {
        const names = {
            it: "Italian",
            es: "Spanish",
            pt: "Portuguese",
            en: "English",
            fr: "French",
            de: "German",
        };
        return names[code] || "English";
    }
    /**
     * Detect if message appears to be in English
     * Simple heuristic based on common English words
     *
     * @param message - Message to check
     * @returns true if message appears to be English
     */
    detectEnglishContent(message) {
        const englishIndicators = [
            /\bthe\b/i,
            /\byour\b/i,
            /\bwith\b/i,
            /\bfor\b/i,
            /\band\b/i,
            /\bhas been\b/i,
            /\bwould you\b/i,
            /\bplease\b/i,
            /\bhere is\b/i,
            /\bhere are\b/i,
            /\bsuccessfully\b/i,
            /\border\b/i,
            /\bcart\b/i,
            /\bproduct\b/i,
        ];
        let matchCount = 0;
        for (const pattern of englishIndicators) {
            if (pattern.test(message)) {
                matchCount++;
            }
        }
        // If 2+ English indicators found, likely English
        return matchCount >= 2;
    }
    /**
     * Parse LLM JSON response and log parsing failures
     */
    parseTranslationResponse(llmResponse) {
        if (!llmResponse)
            return null;
        try {
            return JSON.parse(llmResponse);
        }
        catch (error) {
            logger_1.default.error("❌ Failed to parse TranslationAgent JSON response", {
                llmResponse,
                error,
            });
            return null;
        }
    }
    /**
     * Health check - verify agent is configured
     */
    healthCheck(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agent = yield this.agentConfigRepo.findByType(workspaceId, "TRANSLATION");
                return agent !== null && agent.isActive;
            }
            catch (error) {
                logger_1.default.error("TranslationAgent health check failed", error);
                return false;
            }
        });
    }
    /**
     * Get supported languages
     */
    static getSupportedLanguages() {
        return ["en", "it", "es", "pt"];
    }
    /**
     * Load translation settings from workspace configuration
     *
     * @param workspaceId - Workspace ID to load settings for
     * @returns Translation settings with defaults if not configured
     */
    loadTranslationSettings(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                // Use raw query to avoid TypeScript type issues with new schema fields
                const result = yield database_1.prisma.$queryRaw `
        SELECT "translateProductNames", "translateCategoryNames", "translateServiceNames", "catalogBaseLanguage"
        FROM "Workspace"
        WHERE id = ${workspaceId}
        LIMIT 1
      `;
                if (!result || result.length === 0) {
                    logger_1.default.warn("⚠️ Workspace not found for translation settings, using defaults", { workspaceId });
                    return {
                        translateProductNames: false, // Preserve product names by default
                        translateCategoryNames: false, // Preserve category names by default
                        translateServiceNames: true, // Translate service names by default
                        catalogBaseLanguage: "it", // Default to Italian catalog
                    };
                }
                const workspace = result[0];
                return {
                    translateProductNames: (_a = workspace.translateProductNames) !== null && _a !== void 0 ? _a : false,
                    translateCategoryNames: (_b = workspace.translateCategoryNames) !== null && _b !== void 0 ? _b : false,
                    translateServiceNames: (_c = workspace.translateServiceNames) !== null && _c !== void 0 ? _c : true,
                    catalogBaseLanguage: (_d = workspace.catalogBaseLanguage) !== null && _d !== void 0 ? _d : "it",
                };
            }
            catch (error) {
                logger_1.default.error("❌ Error loading translation settings", { workspaceId, error });
                return {
                    translateProductNames: false,
                    translateCategoryNames: false,
                    translateServiceNames: true,
                    catalogBaseLanguage: "it",
                };
            }
        });
    }
    /**
     * Build preservation rules string based on workspace settings
     * These rules tell the LLM what to preserve vs translate
     *
     * @param settings - Translation settings from workspace
     * @returns Formatted rules string for LLM prompt
     */
    buildPreservationRules(settings) {
        const rules = [];
        const baseLanguageName = this.getLanguageName(settings.catalogBaseLanguage);
        // Product names
        if (!settings.translateProductNames) {
            rules.push(`- DO NOT translate product names. Keep them EXACTLY as they appear in ${baseLanguageName} (e.g., "Pecorino Romano" stays "Pecorino Romano", "Prosciutto di Parma" stays "Prosciutto di Parma")`);
        }
        // Category names
        if (!settings.translateCategoryNames) {
            rules.push(`- DO NOT translate category names. Keep them EXACTLY as they appear in ${baseLanguageName}`);
        }
        // Service names
        if (!settings.translateServiceNames) {
            rules.push(`- DO NOT translate service names. Keep them EXACTLY as they appear in ${baseLanguageName}`);
        }
        rules.push(`- ALWAYS translate supporting descriptions, ingredients, flavors or textures even when they follow product/service names; only the official name itself can stay unchanged.`);
        // Additional rules for data preservation
        rules.push(`- ALWAYS preserve: prices (€X.XX), order codes (ORD-xxxxx), product codes, HTML tags (<img>, <b>, etc.)`);
        rules.push(`- ALWAYS preserve: emojis, bullet points, numbered lists formatting`);
        if (rules.length === 1) {
            // Only generic preservation rule, all translations enabled
            return "PRESERVATION RULES:\n" + rules.join("\n");
        }
        return "IMPORTANT PRESERVATION RULES:\n" + rules.join("\n");
    }
}
exports.TranslationAgent = TranslationAgent;
//# sourceMappingURL=TranslationAgent.js.map