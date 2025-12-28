"use strict";
/**
 * SafetyTranslationAgent
 *
 * Final layer that ALWAYS processes responses before sending to customer.
 *
 * Functions:
 * 1. **Safety Check**: Blocks PII, profanity, phishing, spam
 * 2. **Translation**: Translates response to customer's language (IT → target)
 *
 * Uses TRANSLATION agent config from database
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
 * @critical ALWAYS call this before sending response to customer
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
exports.SafetyTranslationAgent = void 0;
const axios_1 = __importDefault(require("axios"));
const agent_config_repository_1 = require("../../repositories/agent-config.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
class SafetyTranslationAgent {
    constructor(prisma) {
        this.prisma = prisma;
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        this.agentConfigRepo = new agent_config_repository_1.AgentConfigRepository(prisma);
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.openRouterApiKey) {
            logger_1.default.warn("⚠️ OPENROUTER_API_KEY not found - Safety layer will fallback to original text");
        }
        else {
            logger_1.default.info("✅ SafetyTranslationAgent initialized with OpenRouter API key");
        }
    }
    /**
     * Process response through safety and translation layer
     *
     * @param options - Processing options
     * @returns SafetyResult with translated and filtered text
     */
    process(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = Date.now();
            try {
                // 1. Load TRANSLATION agent config from database
                const safetyAgent = yield this.agentConfigRepo.findByType(options.workspaceId, "TRANSLATION");
                if (!safetyAgent) {
                    logger_1.default.warn(`⚠️ TRANSLATION agent not configured for workspace ${options.workspaceId}`);
                    // Fallback: return original text without safety check (NOT RECOMMENDED)
                    return {
                        safe: true,
                        translatedText: options.response,
                        blockedReason: undefined,
                        tokensUsed: 0,
                        executionTimeMs: Date.now() - startTime,
                    };
                }
                if (!safetyAgent.isActive) {
                    logger_1.default.warn(`⚠️ TRANSLATION agent is INACTIVE for workspace ${options.workspaceId}`);
                    // Return original if agent disabled
                    return {
                        safe: true,
                        translatedText: options.response,
                        tokensUsed: 0,
                        executionTimeMs: Date.now() - startTime,
                    };
                }
                // 2. Build system prompt with dynamic allowed links and customer name
                const systemPrompt = this.buildSystemPrompt(safetyAgent.systemPrompt, options.allowedLinks || [], options.customerName);
                // 3. Build user message with context
                const userMessage = this.buildUserMessage(options.response, options.targetLanguage, options.customerName);
                // 4. Call OpenRouter LLM
                logger_1.default.info("🔒 Calling SafetyTranslationAgent LLM", {
                    workspaceId: options.workspaceId,
                    model: safetyAgent.model,
                    targetLanguage: options.targetLanguage,
                });
                const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, {
                    model: safetyAgent.model,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                        },
                        {
                            role: "user",
                            content: userMessage,
                        },
                    ],
                    temperature: safetyAgent.temperature,
                    max_tokens: safetyAgent.maxTokens,
                    response_format: { type: "json_object" }, // Force JSON response
                }, {
                    headers: {
                        Authorization: `Bearer ${this.openRouterApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": process.env.FRONTEND_URL || "https://echatbot.ai",
                        "X-Title": "eChatbot Safety & Translation Layer",
                    },
                    timeout: 30000, // 30 second timeout
                });
                const llmResponse = response.data.choices[0].message.content;
                const tokensUsed = ((_a = response.data.usage) === null || _a === void 0 ? void 0 : _a.total_tokens) || 0;
                const executionTimeMs = Date.now() - startTime;
                // 5. Parse JSON response
                let parsed;
                try {
                    parsed = JSON.parse(llmResponse);
                }
                catch (error) {
                    logger_1.default.error("❌ Failed to parse SafetyTranslationAgent JSON response", {
                        llmResponse,
                        error,
                    });
                    // Fallback: return original text
                    return {
                        safe: true,
                        translatedText: options.response,
                        blockedReason: "JSON parse error",
                        tokensUsed,
                        executionTimeMs,
                    };
                }
                // 6. Extract result (handle multiple field name formats)
                const safe = parsed.safe !== undefined ? parsed.safe : !parsed.blocked;
                const translatedText = parsed.translatedText || parsed.translatedResponse || options.response;
                const blockedReason = parsed.blockedReason || parsed.reason;
                logger_1.default.info("✅ SafetyTranslationAgent completed", {
                    safe,
                    blocked: !safe,
                    blockedReason,
                    tokensUsed,
                    executionTimeMs,
                });
                return {
                    safe,
                    translatedText,
                    blockedReason,
                    tokensUsed,
                    executionTimeMs,
                    systemPrompt, // ✅ Add processed system prompt for debugging
                };
            }
            catch (error) {
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.error("❌ SafetyTranslationAgent error", error);
                // Fallback: return original text (UNSAFE - but better than crash)
                return {
                    safe: true, // Assume safe to not block customer
                    translatedText: options.response,
                    blockedReason: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    tokensUsed: 0,
                    executionTimeMs,
                };
            }
        });
    }
    /**
     * Build system prompt with allowed links injection
     */
    buildSystemPrompt(basePrompt, allowedLinks, customerName) {
        // Replace {{ALLOWED_LINKS}} placeholder with workspace-specific links
        const allowedLinksText = allowedLinks.length > 0
            ? allowedLinks.map((link) => `- ${link}`).join("\n")
            : "- No allowed links configured for this workspace";
        // Replace {{nameUser}} with actual customer name in examples
        const withCustomerName = basePrompt.replace(/\{\{nameUser\}\}/g, customerName || "Cliente");
        return withCustomerName.replace("{{ALLOWED_LINKS}}", allowedLinksText);
    }
    /**
     * Build user message with context
     */
    buildUserMessage(response, targetLanguage, customerName) {
        return `# Response to translate and check:
${response}

# Target language: ${targetLanguage}
# Customer name: ${customerName || "Unknown"}

Please:
1. Check safety (PII, profanity, phishing, spam)
2. Translate to ${targetLanguage} if needed
3. Return JSON with: { "safe": true/false, "translatedText": "...", "blockedReason": "..." }`;
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
                logger_1.default.error("SafetyTranslationAgent health check failed", error);
                return false;
            }
        });
    }
    /**
     * Get fallback messages for blocked content
     */
    static getFallbackMessage(language) {
        const messages = {
            it: "Mi dispiace, non posso completare questa richiesta. Contatta il supporto se hai bisogno di assistenza.",
            es: "Lo siento, no puedo completar esta solicitud. Contacta con soporte si necesitas ayuda.",
            en: "I'm sorry, I cannot complete this request. Contact support if you need assistance.",
            pt: "Desculpe, não posso completar esta solicitação. Entre em contato com o suporte se precisar de ajuda.",
            de: "Es tut mir leid, ich kann diese Anfrage nicht bearbeiten. Kontaktieren Sie den Support, wenn Sie Hilfe benötigen.",
            fr: "Désolé, je ne peux pas compléter cette demande. Contactez le support si vous avez besoin d'aide.",
        };
        return messages[language] || messages.en;
    }
}
exports.SafetyTranslationAgent = SafetyTranslationAgent;
//# sourceMappingURL=SafetyTranslationAgent.js.map