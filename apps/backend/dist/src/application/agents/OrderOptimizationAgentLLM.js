"use strict";
/**
 * OrderOptimizationAgentLLM
 *
 * ✅ SPECIALIST AGENT with OWN LLM - Clean Architecture
 *
 * Responsibilities:
 * 1. Analyze transport costs using OrderOptimizationService
 * 2. Generate natural language explanation via GPT-4.1
 * 3. Provide optimization suggestions
 *
 * Architecture:
 * - Own LLM instance (OpenRouter + GPT-4.1 for Premium feature)
 * - System prompt from template file (10-order-optimization.template.md)
 * - Data calculated by OrderOptimizationService (deterministic)
 * - Returns Italian response (Router handles translation to customer language)
 *
 * Flow:
 * 1. CallingFunctions triggers "OPTIMIZE_ORDER" action
 * 2. OrderOptimizationService calculates transport analysis
 * 3. This agent generates human-friendly explanation
 * 4. Response goes through Translation Agent
 *
 * Security:
 * - ALL queries filtered by workspaceId
 * - Premium/Enterprise plan gating done BEFORE calling this agent
 *
 * @feature optimize-transport (specs/optimize-transport/)
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
exports.OrderOptimizationAgentLLM = void 0;
const axios_1 = __importDefault(require("axios"));
const order_optimization_service_1 = require("../services/order-optimization.service");
const logger_1 = __importDefault(require("../../utils/logger"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ============================================================================
// AGENT
// ============================================================================
class OrderOptimizationAgentLLM {
    constructor(prisma) {
        // GPT-4.1 for Premium feature (higher quality)
        this.MODEL = "openai/gpt-4.1";
        this.TIMEOUT_MS = 30000;
        this.prisma = prisma;
        this.orderOptimizationService = new order_optimization_service_1.OrderOptimizationService(prisma);
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.openRouterBaseUrl = "https://openrouter.ai/api/v1";
        if (!this.openRouterApiKey) {
            throw new Error("OPENROUTER_API_KEY is required for OrderOptimizationAgentLLM");
        }
    }
    /**
     * Process optimization request
     *
     * @param input - Workspace and customer context
     * @returns Optimization explanation and suggestions
     */
    process(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                logger_1.default.info("🚚 OrderOptimizationAgentLLM: Processing", {
                    workspaceId: input.workspaceId,
                    customerId: input.customerId,
                });
                // STEP 1: Check if transport prices are configured
                const isConfigured = yield this.orderOptimizationService.hasTransportPricesConfigured(input.workspaceId);
                if (!isConfigured) {
                    return {
                        success: false,
                        explanation: "Al momento non posso calcolare i costi di spedizione perché i prezzi dei trasporti non sono configurati. Puoi comunque continuare con il tuo ordine.",
                        recommendations: [],
                        nextAction: "proceed_checkout",
                        executionTimeMs: Date.now() - startTime,
                        error: "TRANSPORT_PRICES_NOT_CONFIGURED",
                    };
                }
                // STEP 2: Analyze cart transport costs
                const analysis = yield this.orderOptimizationService.analyzeCart(input.workspaceId, input.customerId);
                if (analysis.isEmpty) {
                    return {
                        success: true,
                        explanation: "Il tuo carrello è vuoto. Aggiungi qualche prodotto per vedere l'analisi dei costi di spedizione!",
                        recommendations: [],
                        nextAction: "continue_shopping",
                        analysis,
                        executionTimeMs: Date.now() - startTime,
                    };
                }
                // STEP 3: Get available products for suggestions
                const cartProductIds = analysis.allocationByItem.map(item => item.productId);
                const availableProducts = yield this.orderOptimizationService.getAvailableProductsForOptimization(input.workspaceId, cartProductIds, 5 // Limit 5 products per transport type
                );
                // STEP 4: Call LLM to generate explanation
                const llmInput = {
                    analysis: {
                        transports: analysis.transports.map(t => ({
                            transportTypeName: t.transportTypeName,
                            transportPrice: t.transportPrice,
                            totalQuantity: t.totalQuantity,
                            productCount: t.productCount,
                        })),
                        totalUnits: analysis.totalUnits,
                        totalProductsCost: analysis.totalProductsCost,
                        totalTransportCost: analysis.totalTransportCost,
                        grandTotal: analysis.grandTotal,
                        shippingCostPerUnit: analysis.shippingCostPerUnit,
                        ivaAmount: analysis.ivaAmount,
                    },
                    availableProducts: availableProducts.slice(0, 3), // Limit to 3 transport types
                    customerLanguage: input.customerLanguage || "it",
                };
                const llmResponse = yield this.callLLM(llmInput);
                return {
                    success: true,
                    explanation: llmResponse.explanation,
                    recommendations: llmResponse.recommendations || [],
                    nextAction: llmResponse.nextAction || "continue_shopping",
                    analysis,
                    tokensUsed: llmResponse.tokensUsed,
                    executionTimeMs: Date.now() - startTime,
                };
            }
            catch (error) {
                logger_1.default.error("❌ OrderOptimizationAgentLLM error:", error);
                return {
                    success: false,
                    explanation: "Mi dispiace, c'è stato un problema nell'analisi dei costi di spedizione. Riprova tra qualche secondo.",
                    recommendations: [],
                    nextAction: "proceed_checkout",
                    executionTimeMs: Date.now() - startTime,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
    }
    /**
     * Call LLM to generate explanation
     */
    callLLM(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                // Load system prompt from template
                const systemPrompt = this.loadSystemPrompt();
                const response = yield axios_1.default.post(`${this.openRouterBaseUrl}/chat/completions`, {
                    model: this.MODEL,
                    messages: [
                        {
                            role: "system",
                            content: systemPrompt,
                        },
                        {
                            role: "user",
                            content: JSON.stringify(input, null, 2),
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 1000,
                    response_format: { type: "json_object" },
                }, {
                    headers: {
                        Authorization: `Bearer ${this.openRouterApiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://echatbot.ai",
                        "X-Title": "eChatbot Order Optimization",
                    },
                    timeout: this.TIMEOUT_MS,
                });
                const content = (_b = (_a = response.data.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content;
                const tokensUsed = (_c = response.data.usage) === null || _c === void 0 ? void 0 : _c.total_tokens;
                if (!content) {
                    throw new Error("Empty response from LLM");
                }
                // Parse JSON response
                const parsed = JSON.parse(content);
                return {
                    explanation: parsed.explanation || this.getFallbackExplanation(input),
                    recommendations: parsed.recommendations || [],
                    nextAction: parsed.nextAction || "continue_shopping",
                    tokensUsed,
                };
            }
            catch (error) {
                logger_1.default.error("LLM call failed:", error);
                // Return fallback response using service's format method
                return {
                    explanation: this.getFallbackExplanation(input),
                    recommendations: [],
                    nextAction: "continue_shopping",
                };
            }
        });
    }
    /**
     * Load system prompt from template file
     */
    loadSystemPrompt() {
        try {
            const templatePath = path.join(__dirname, "..", "services", "..", "..", "templates", "ecommerce", "10-order-optimization.template.md");
            // Simplified path
            const simplePath = path.join(process.cwd(), "src", "templates", "ecommerce", "10-order-optimization.template.md");
            // Try both paths
            for (const p of [simplePath, templatePath]) {
                if (fs.existsSync(p)) {
                    const content = fs.readFileSync(p, "utf-8");
                    // Extract just the system prompt section
                    const systemPromptMatch = content.match(/## System Prompt\s*([\s\S]*?)(?=##|$)/);
                    if (systemPromptMatch) {
                        return systemPromptMatch[1].trim();
                    }
                    return content;
                }
            }
            logger_1.default.warn("Template file not found, using inline prompt");
            return this.getInlineSystemPrompt();
        }
        catch (error) {
            logger_1.default.warn("Error loading template, using inline prompt:", error);
            return this.getInlineSystemPrompt();
        }
    }
    /**
     * Inline system prompt fallback
     */
    getInlineSystemPrompt() {
        return `Sei un assistente specializzato nell'ottimizzazione dei costi di spedizione per ordini e-commerce.

Analizza i dati JSON forniti e genera una risposta in italiano che spiega:
1. Quali trasporti sono richiesti e quanto costano
2. Come l'utente può ottimizzare i costi

VINCOLI:
- Usa SOLO i dati forniti, non inventare
- NON menzionare mai l'IVA
- Tono amichevole e non aggressivo

Rispondi in JSON con: explanation (string), recommendations (array), nextAction (string).`;
    }
    /**
     * Fallback explanation when LLM fails
     */
    getFallbackExplanation(input) {
        const analysis = input.analysis;
        const lines = [];
        lines.push("🚚 **Riepilogo dei tuoi costi di spedizione**");
        lines.push("");
        if (analysis.transports && analysis.transports.length > 0) {
            lines.push("**Trasporti richiesti:**");
            for (const t of analysis.transports) {
                const emoji = t.transportTypeName.toLowerCase().includes("frozen") ? "🧊" :
                    t.transportTypeName.toLowerCase().includes("refriger") ? "❄️" : "📦";
                lines.push(`${emoji} ${t.transportTypeName}: €${t.transportPrice.toFixed(2)} (${t.totalQuantity} prodotti)`);
            }
            lines.push("");
        }
        lines.push(`💰 **Totale spedizione**: €${analysis.totalTransportCost.toFixed(2)}`);
        lines.push(`📋 **Totale ordine**: €${analysis.grandTotal.toFixed(2)}`);
        lines.push("");
        lines.push("Cosa vuoi fare?");
        lines.push("1. 🧊 Mostra prodotti Frozen");
        lines.push("2. ❄️ Mostra prodotti Refrigerati");
        lines.push("3. 📦 Mostra prodotti Temperatura Ambiente");
        lines.push("4. 🛒 Torna al carrello");
        return lines.join("\n");
    }
}
exports.OrderOptimizationAgentLLM = OrderOptimizationAgentLLM;
//# sourceMappingURL=OrderOptimizationAgentLLM.js.map