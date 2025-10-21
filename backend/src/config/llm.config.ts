/**
 * LLM Configuration - Switch between OpenRouter (cloud) and Ollama (local)
 *
 * Per usare Ollama locale:
 * 1. Installa Ollama: https://ollama.com/download
 * 2. Scarica un modello: ollama pull llama3.2:3b
 * 3. Avvia il server: ollama serve (oppure npm run dev lo avvia automaticamente)
 * 4. Seleziona "LOCAL:llama3.2:3b" nel dropdown Agent Configuration UI
 *
 * Il prefisso "LOCAL:" attiva automaticamente Ollama, altrimenti usa OpenRouter cloud.
 */

export interface LLMConfig {
  baseURL: string
  apiKey: string
  model: string
  useLocal: boolean
}

/**
 * Ottieni configurazione LLM basata SOLO sul modello dal database
 * @param modelFromAgent - Modello dal database (agentConfig.model)
 *   - Se inizia con "LOCAL:" → usa Ollama locale
 *   - Altrimenti → usa OpenRouter cloud
 */
export function getLLMConfig(modelFromAgent?: string): LLMConfig {
  // 🎯 UNICA FONTE DI VERITÀ: il prefisso "LOCAL:" nel modello dal DB
  const isLocalModel = modelFromAgent?.startsWith("LOCAL:")

  if (isLocalModel) {
    // Estrai il nome del modello (es: "LOCAL:llama3.1:8b" → "llama3.1:8b")
    const localModelName = modelFromAgent!.replace("LOCAL:", "")

    // Configurazione Ollama locale
    return {
      baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
      apiKey: "ollama", // Ollama non richiede API key, ma il campo è necessario
      model: localModelName,
      useLocal: true,
    }
  } else {
    // Configurazione OpenRouter (cloud)
    return {
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY || "",
      model: modelFromAgent || "anthropic/claude-3.5-sonnet", // Fallback a Claude se undefined
      useLocal: false,
    }
  }
}

/**
 * Modelli Ollama consigliati per Mac M1 Pro (32GB RAM):
 *
 * - llama3.2:3b        → Velocissimo, ottimo per chatbot semplici
 * - mistral:7b         → Bilanciato qualità/velocità
 * - llama3.1:8b        → Molto intelligente, consigliato!
 * - qwen2.5:14b        → Molto potente, serve più RAM
 * - llama3.1:70b-q4    → Qualità top (quantizzato per risparmiare RAM)
 *
 * Per scaricare: ollama pull <model-name>
 */
export const RECOMMENDED_LOCAL_MODELS = {
  fast: "llama3.2:3b", // ~2GB RAM
  balanced: "mistral:7b", // ~4GB RAM
  smart: "llama3.1:8b", // ~5GB RAM
  powerful: "qwen2.5:14b", // ~8GB RAM
  top: "llama3.1:70b-q4", // ~40GB RAM
}
