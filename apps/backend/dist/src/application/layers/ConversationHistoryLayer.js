"use strict";
/**
 * Conversation History Layer
 *
 * Layer centralizzato che umanizza le risposte tecniche degli agent.
 *
 * RESPONSABILITÀ:
 * 1. Leggere storico conversazione per contesto
 * 2. Applicare botIdentity (personalità bot)
 * 3. Applicare customAiRules (regole business)
 * 4. Aggiungere saluti se primo messaggio
 * 5. Suggerire offerte se opportuno
 * 6. Preservare o adattare menu numerici
 * 7. Chiedere chiarimenti se domanda ambigua
 *
 * POSIZIONE NEL FLUSSO:
 * [Intent Parser] → [Agent Funzionale] → [Conversation History Layer] → [Translation] → [Response]
 *
 * @architecture Clean Architecture - Uses AgentConfigRepository
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
exports.ConversationHistoryLayer = void 0;
const axios_1 = __importDefault(require("axios"));
const agent_config_repository_1 = require("../../repositories/agent-config.repository");
const logger_1 = __importDefault(require("../../utils/logger"));
class ConversationHistoryLayer {
    constructor(prisma) {
        this.prisma = prisma;
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        this.agentConfigRepo = new agent_config_repository_1.AgentConfigRepository(prisma);
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.openRouterApiKey) {
            logger_1.default.warn("⚠️ OPENROUTER_API_KEY not found - ConversationHistoryLayer will return raw messages");
        }
    }
    /**
     * Processa la risposta tecnica e la umanizza
     */
    process(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startTime = Date.now();
            // 🚨 DEBUG - VERIFICO CHE QUESTO LAYER SIA CHIAMATO
            console.log("🚨🚨🚨 CONVERSATION_HISTORY LAYER CALLED 🚨🚨🚨");
            console.log("Input technical response:", (_a = input.technicalResponse.rawMessage) === null || _a === void 0 ? void 0 : _a.substring(0, 100));
            logger_1.default.info("🎭 ConversationHistoryLayer.process() called", {
                workspaceId: input.workspaceId,
                customerId: input.customerId,
                responseType: input.technicalResponse.type,
                isFirstMessage: input.isFirstMessage,
                historyLength: input.conversationHistory.length,
                hasOffers: input.activeOffers.length > 0,
            });
            try {
                // 1. Load agent config from DB
                const config = yield this.loadConfig(input.workspaceId);
                if (!config) {
                    logger_1.default.warn(`⚠️ CONVERSATION_HISTORY agent not configured for workspace ${input.workspaceId} - returning raw message`);
                    return this.createPassthroughResponse(input, startTime);
                }
                // 2. Check if we should skip humanization for certain response types
                if (this.shouldSkipHumanization(input.technicalResponse.type)) {
                    logger_1.default.info(`⏭️ Skipping humanization for type: ${input.technicalResponse.type}`);
                    return this.createPassthroughResponse(input, startTime);
                }
                // 3. Build context for LLM
                const userPrompt = this.buildUserPrompt(input);
                // 4. Build system prompt with variables replaced
                const systemPrompt = this.buildSystemPrompt(config.systemPrompt, input);
                // 5. Call LLM
                const llmResponse = yield this.callLLM(systemPrompt, userPrompt, config.model, config.temperature, config.maxTokens);
                // 6. Parse response and return
                const executionTimeMs = Date.now() - startTime;
                logger_1.default.info("✅ ConversationHistoryLayer completed", {
                    executionTimeMs,
                    tokensUsed: llmResponse.tokensUsed,
                    responseLength: llmResponse.message.length,
                });
                return {
                    message: llmResponse.message,
                    optionsMapping: input.technicalResponse.optionsMapping, // Preserve original menu
                    metadata: {
                        addedGreeting: input.isFirstMessage,
                        suggestedOffers: this.detectOfferSuggestion(llmResponse.message, input.activeOffers),
                        askedClarification: this.detectClarificationRequest(llmResponse.message),
                        preservedMenu: !!input.technicalResponse.optionsMapping,
                        tokensUsed: llmResponse.tokensUsed,
                        executionTimeMs,
                        model: config.model,
                    },
                };
            }
            catch (error) {
                logger_1.default.error("❌ ConversationHistoryLayer error:", error);
                return this.createPassthroughResponse(input, startTime);
            }
        });
    }
    /**
     * Load CONVERSATION_HISTORY agent config from database
     */
    loadConfig(workspaceId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const agent = yield this.agentConfigRepo.findByType(workspaceId, "CONVERSATION_HISTORY");
                if (!agent) {
                    return null;
                }
                return {
                    systemPrompt: agent.systemPrompt,
                    model: agent.model,
                    temperature: Number(agent.temperature) || 0.7,
                    maxTokens: agent.maxTokens || 500,
                };
            }
            catch (error) {
                logger_1.default.error("❌ Failed to load CONVERSATION_HISTORY config:", error);
                return null;
            }
        });
    }
    /**
     * Build user prompt with all context
     */
    buildUserPrompt(input) {
        const parts = [];
        // 0. MINDSET - Obiettivo della conversazione
        parts.push("## 🎯 MINDSET ATTUALE");
        if (input.mindset === "SALES") {
            parts.push("**VENDITA** - Il cliente sta esplorando prodotti/categorie");
            parts.push("Obiettivo: Guidare verso l'acquisto, suggerire prodotti, proporre offerte");
            parts.push("");
        }
        else if (input.mindset === "SUPPORT") {
            parts.push("**SUPPORTO** - Il cliente cerca informazioni/assistenza");
            parts.push("Obiettivo: Rispondere con empatia, chiarezza, risolvere dubbi");
            parts.push("");
        }
        else {
            parts.push("**NEUTRALE** - Conversazione generica");
            parts.push("");
        }
        // 1. Conversation history (last 5 messages for context)
        if (input.conversationHistory.length > 0) {
            const recentHistory = input.conversationHistory.slice(-5);
            parts.push("## STORICO CONVERSAZIONE (ultimi messaggi)");
            for (const msg of recentHistory) {
                const role = msg.role === "customer" ? "CLIENTE" : "BOT";
                parts.push(`${role}: ${msg.content}`);
            }
            parts.push("");
        }
        // 2. Current question
        parts.push("## DOMANDA ATTUALE DEL CLIENTE");
        parts.push(input.currentQuestion);
        parts.push("");
        // 3. Technical response from agent
        parts.push("## RISPOSTA TECNICA DA UMANIZZARE");
        parts.push(`Tipo: ${input.technicalResponse.type}`);
        parts.push(`Messaggio: ${input.technicalResponse.rawMessage}`);
        parts.push("");
        // 4. Active offers (if any) - più enfatizzate in SALES mode
        if (input.activeOffers.length > 0) {
            if (input.mindset === "SALES") {
                parts.push("## 🔥 OFFERTE ATTIVE (suggerisci attivamente!)");
            }
            else {
                parts.push("## OFFERTE ATTIVE (menziona solo se pertinenti)");
            }
            for (const offer of input.activeOffers.slice(0, 3)) {
                parts.push(`- ${offer.name}: ${offer.description} (${offer.discountPercent}% sconto)`);
            }
            parts.push("");
        }
        // 5. FAQ - Contesto informativo per l'assistente
        if (input.faqs && input.faqs.length > 0) {
            parts.push("## 📚 FAQ - RISPOSTE PREDEFINITE (usa come contesto)");
            for (const faq of input.faqs.slice(0, 5)) {
                parts.push(`Q: ${faq.question}`);
                parts.push(`A: ${faq.answer}`);
                if (faq.category) {
                    parts.push(`(Categoria: ${faq.category})`);
                }
                parts.push("");
            }
        }
        // 6. Context flags
        parts.push("## CONTESTO");
        parts.push(`- Primo messaggio: ${input.isFirstMessage ? "SÌ (saluta!)" : "NO"}`);
        parts.push(`- Nome cliente: ${input.customerName}`);
        parts.push(`- Ha agenti commerciali: ${input.hasSalesAgents ? "SÌ" : "NO"}`);
        parts.push(`- Mindset: ${input.mindset}`);
        parts.push("");
        // 7. Menu to preserve
        if (input.technicalResponse.optionsMapping) {
            parts.push("## MENU NUMERICO (PRESERVA ESATTAMENTE)");
            const options = input.technicalResponse.optionsMapping.options || [];
            for (const opt of options) {
                parts.push(`${opt.number}. ${opt.label}`);
            }
            parts.push("");
        }
        return parts.join("\n");
    }
    /**
     * Build system prompt with variables replaced
     */
    buildSystemPrompt(template, input) {
        return template
            .replace(/\{\{botName\}\}/g, input.botIdentity.name || "Assistente")
            .replace(/\{\{botIdentity\}\}/g, input.botIdentity.personality || "Sii amichevole e professionale")
            .replace(/\{\{customAiRules\}\}/g, input.customAiRules || "Nessuna regola specifica")
            .replace(/\{\{customerName\}\}/g, input.customerName || "Cliente");
    }
    /**
     * Call OpenRouter LLM
     */
    callLLM(systemPrompt, userPrompt, model, temperature, maxTokens) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!this.openRouterApiKey) {
                return { message: userPrompt, tokensUsed: 0 };
            }
            try {
                const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, {
                    model,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt },
                    ],
                    temperature,
                    max_tokens: maxTokens,
                }, {
                    headers: {
                        Authorization: `Bearer ${this.openRouterApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://echatbot.ai",
                        "X-Title": "eChatbot Conversation History Layer",
                    },
                    timeout: 30000,
                });
                const message = ((_c = (_b = (_a = response.data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "";
                const tokensUsed = ((_d = response.data.usage) === null || _d === void 0 ? void 0 : _d.total_tokens) || 0;
                return { message: message.trim(), tokensUsed };
            }
            catch (error) {
                logger_1.default.error("❌ LLM call failed in ConversationHistoryLayer:", error);
                throw error;
            }
        });
    }
    /**
     * Check if we should skip humanization for certain response types
     */
    shouldSkipHumanization(type) {
        // Skip for error responses - let them pass through
        // Skip for support requests - they need exact handling
        const skipTypes = [
            "ERROR",
            "SUPPORT_REQUEST",
        ];
        return skipTypes.includes(type);
    }
    /**
     * Create passthrough response (no humanization)
     */
    createPassthroughResponse(input, startTime) {
        return {
            message: input.technicalResponse.rawMessage,
            optionsMapping: input.technicalResponse.optionsMapping,
            metadata: {
                addedGreeting: false,
                suggestedOffers: false,
                askedClarification: false,
                preservedMenu: !!input.technicalResponse.optionsMapping,
                tokensUsed: 0,
                executionTimeMs: Date.now() - startTime,
                model: "passthrough",
            },
        };
    }
    /**
     * Detect if response contains offer suggestion
     */
    detectOfferSuggestion(message, offers) {
        if (offers.length === 0)
            return false;
        const offerKeywords = ["offerta", "sconto", "promozione", "speciale"];
        const lowerMessage = message.toLowerCase();
        return offerKeywords.some(keyword => lowerMessage.includes(keyword));
    }
    /**
     * Detect if response asks for clarification
     */
    detectClarificationRequest(message) {
        const clarificationPatterns = [
            "non ho capito",
            "puoi specificare",
            "intendi",
            "cosa intendi",
            "puoi chiarire",
            "riformula",
        ];
        const lowerMessage = message.toLowerCase();
        return clarificationPatterns.some(pattern => lowerMessage.includes(pattern));
    }
}
exports.ConversationHistoryLayer = ConversationHistoryLayer;
//# sourceMappingURL=ConversationHistoryLayer.js.map