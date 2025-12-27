"use strict";
/**
 * SummaryAgentLLM - Utility Service
 *
 * Generates concise summaries of conversation history for email notifications.
 * This is NOT a database agent - it's a utility function called by ContactOperator.
 *
 * Flow:
 * 1. Receives array of conversation messages from last hour
 * 2. Loads summary-agent.md prompt
 * 3. Replaces variables: {{conversationHistory}}, {{customerName}}, {{agentName}}
 * 4. Calls OpenRouter API
 * 5. Returns text summary (<250 words)
 *
 * @architecture Utility Service (not stored in agentConfigs table)
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
exports.SummaryAgentLLM = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const llm_config_1 = require("../config/llm.config");
const logger_1 = __importDefault(require("../utils/logger"));
const prompt_processor_service_1 = require("./prompt-processor.service");
class SummaryAgentLLM {
    constructor() {
        this.promptProcessorService = new prompt_processor_service_1.PromptProcessorService();
        this.summaryPrompt = this.loadSummaryPrompt();
    }
    /**
     * Load summary-agent.md prompt file
     */
    loadSummaryPrompt() {
        try {
            const promptPath = path_1.default.join(__dirname, "../../docs/prompts/summary-agent.md");
            const promptContent = fs_1.default.readFileSync(promptPath, "utf-8");
            logger_1.default.info("📄 Summary Agent prompt loaded from file");
            return promptContent;
        }
        catch (error) {
            logger_1.default.error("❌ Failed to load summary-agent.md prompt:", error);
            throw new Error("Summary Agent prompt file not found");
        }
    }
    /**
     * Generate summary from conversation history
     */
    generateSummary(request) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                logger_1.default.info("🤖 [SummaryAgent] Generating summary for conversation", {
                    messageCount: request.conversationHistory.length,
                    customerName: request.customerName,
                });
                // Check if conversation history is empty
                if (!request.conversationHistory ||
                    request.conversationHistory.length === 0) {
                    logger_1.default.warn("⚠️ [SummaryAgent] No conversation history provided");
                    return {
                        success: false,
                        error: "No conversation history available",
                    };
                }
                // Format conversation history for prompt
                const formattedHistory = this.formatConversationHistory(request.conversationHistory);
                // Replace variables in prompt
                let processedPrompt = this.summaryPrompt;
                processedPrompt = processedPrompt.replace(/\{\{conversationHistory\}\}/g, formattedHistory);
                processedPrompt = processedPrompt.replace(/\{\{customerName\}\}/g, request.customerName || "Cliente");
                processedPrompt = processedPrompt.replace(/\{\{agentName\}\}/g, request.agentName || "Agente");
                logger_1.default.info("🤖 [SummaryAgent] Prompt processed, calling OpenRouter API", {
                    promptLength: processedPrompt.length,
                    historyMessages: request.conversationHistory.length,
                });
                // Call OpenRouter API
                const llmConfig = (0, llm_config_1.getLLMConfig)();
                const response = yield fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${llmConfig.apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model: "openai/gpt-4o-mini", // Fixed model for summaries
                        messages: [
                            {
                                role: "system",
                                content: processedPrompt,
                            },
                            {
                                role: "user",
                                content: `Genera un riassunto della conversazione con ${request.customerName}. La conversazione contiene ${request.conversationHistory.length} messaggi dell'ultima ora.`,
                            },
                        ],
                        temperature: 0.5, // Balanced between creative and deterministic
                        max_tokens: 500, // ~250 words
                    }),
                });
                if (!response.ok) {
                    const errorText = yield response.text();
                    logger_1.default.error("❌ [SummaryAgent] OpenRouter API error:", {
                        status: response.status,
                        error: errorText,
                    });
                    return {
                        success: false,
                        error: `OpenRouter API error: ${response.status}`,
                    };
                }
                const data = yield response.json();
                const summary = (_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content;
                if (!summary) {
                    logger_1.default.error("❌ [SummaryAgent] No summary generated by LLM");
                    return {
                        success: false,
                        error: "LLM returned empty summary",
                    };
                }
                logger_1.default.info("✅ [SummaryAgent] Summary generated successfully", {
                    summaryLength: summary.length,
                    summaryWords: summary.split(" ").length,
                });
                return {
                    success: true,
                    summary: summary,
                };
            }
            catch (error) {
                logger_1.default.error("❌ [SummaryAgent] Failed to generate summary:", error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Unknown error",
                };
            }
        });
    }
    /**
     * Format conversation history for prompt
     */
    formatConversationHistory(messages) {
        return messages
            .map((msg) => {
            const timestamp = new Date(msg.createdAt).toLocaleTimeString("it-IT", {
                hour: "2-digit",
                minute: "2-digit",
            });
            const role = msg.role === "customer" ? "Cliente" : "Assistente";
            return `[${timestamp}] ${role}: ${msg.content}`;
        })
            .join("\n");
    }
}
exports.SummaryAgentLLM = SummaryAgentLLM;
//# sourceMappingURL=summary-agent-llm.service.js.map