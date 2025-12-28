"use strict";
/**
 * LLM Configuration - OpenRouter (cloud) only
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLLMConfig = getLLMConfig;
/**
 * Ottieni configurazione LLM basata sul modello dal database
 * @param modelFromAgent - Modello dal database (agentConfig.model)
 */
function getLLMConfig(modelFromAgent) {
    return {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY || "",
        model: modelFromAgent || "anthropic/claude-3.5-sonnet",
    };
}
//# sourceMappingURL=llm.config.js.map