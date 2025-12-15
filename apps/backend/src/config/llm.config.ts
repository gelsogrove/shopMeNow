/**
 * LLM Configuration - OpenRouter (cloud) only
 */

export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
}

/**
 * Ottieni configurazione LLM basata sul modello dal database
 * @param modelFromAgent - Modello dal database (agentConfig.model)
 */
export function getLLMConfig(modelFromAgent?: string): LLMConfig {
  return {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: modelFromAgent || "anthropic/claude-3.5-sonnet",
  }
}
