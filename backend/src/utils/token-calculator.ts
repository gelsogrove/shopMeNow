/**
 * Token calculation utility for OpenAI models
 * Provides token counting for prompt and response messages
 */

import logger from './logger'

/**
 * Estimates token count for text based on character count
 * This is an approximation - for exact counts, use OpenAI's tiktoken library
 * Rule of thumb: ~4 characters = 1 token for GPT models
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0
  
  // More accurate estimation considering:
  // - Average word length in Italian/Spanish/English
  // - Punctuation and special characters
  // - Typical token/character ratio for multilingual content
  const charCount = text.length
  const estimatedTokens = Math.ceil(charCount / 3.8) // Slightly more conservative than 4
  
  logger.debug(`Token estimation: ${charCount} chars → ~${estimatedTokens} tokens`)
  return estimatedTokens
}

/**
 * Calculates token usage for a complete LLM interaction
 */
export function calculateLLMTokenUsage(
  prompt: string,
  userMessage: string,
  response: string
): {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  details: {
    promptCharacters: number
    userMessageCharacters: number
    responseCharacters: number
  }
} {
  const promptTokens = estimateTokenCount(prompt + userMessage)
  const completionTokens = estimateTokenCount(response)
  const totalTokens = promptTokens + completionTokens

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    details: {
      promptCharacters: prompt.length,
      userMessageCharacters: userMessage.length,
      responseCharacters: response.length,
    }
  }
}

/**
 * Calculates estimated cost based on model pricing
 * Prices for gpt-4o-mini via OpenRouter (2024)
 */
export function calculateLLMCost(
  promptTokens: number,
  completionTokens: number,
  modelName: string = 'gpt-4o-mini'
): {
  promptCost: number
  completionCost: number
  totalCost: number
  currency: string
} {
  // Pricing per 1K tokens (USD) - OpenRouter rates for gpt-4o-mini
  const modelPricing: Record<string, { prompt: number; completion: number }> = {
    'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 }, // $0.15/$0.60 per 1M tokens
    'gpt-4o': { prompt: 0.005, completion: 0.015 }, // $5/$15 per 1M tokens
    'openai/gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
    'openai/gpt-4o': { prompt: 0.005, completion: 0.015 },
  }

  const pricing = modelPricing[modelName] || modelPricing['gpt-4o-mini']
  
  const promptCost = (promptTokens / 1000) * pricing.prompt
  const completionCost = (completionTokens / 1000) * pricing.completion
  const totalCost = promptCost + completionCost

  return {
    promptCost: parseFloat(promptCost.toFixed(6)),
    completionCost: parseFloat(completionCost.toFixed(6)),
    totalCost: parseFloat(totalCost.toFixed(6)),
    currency: 'USD'
  }
}