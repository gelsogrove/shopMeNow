import {
  SAFETY_TRANSLATION_PROMPT,
  getLanguageName,
  TRANSLATION_LLM_SETTINGS,
} from '@shared/translation-prompts'
import logger from '../utils/logger'

/**
 * 🔒 Translation & Security Service for Scheduler
 * Uses OpenRouter/LLM to:
 * 1. Translate campaign messages to customer's language
 * 2. Filter inappropriate content (profanity, spam, phishing)
 *
 * 🆕 SHARED PROMPTS: Uses shared/translation-prompts.ts (single source of truth)
 */

export class TranslationService {
  private readonly apiKey: string
  private readonly baseURL: string
  private readonly model: string

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || ''
    this.baseURL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
    this.model = process.env.LLM_MODEL || TRANSLATION_LLM_SETTINGS.model

    if (!this.apiKey) {
      logger.warn('⚠️ [TRANSLATION] OPENROUTER_API_KEY not found - will skip translation')
    } else {
      logger.info('✅ [TRANSLATION] Service initialized (shared prompt)')
    }
  }

  /**
   * Translate message to target language
   * @param message - Original message (in Italian)
   * @param targetLanguage - Customer's language code (it, en, es, pt)
   * @returns Translated message
   */
  async translateMessage(message: string, targetLanguage: string): Promise<string> {
    // Normalize language code
    const normalizedLang = targetLanguage?.toUpperCase() || 'IT'
    
    // If target is Italian, no translation needed
    if (normalizedLang === 'IT') {
      logger.info('[TRANSLATION] Target language is Italian - no translation needed')
      return message
    }

    // If no API key, return original
    if (!this.apiKey) {
      logger.warn('[TRANSLATION] No API key - returning original message')
      return message
    }

    const languageName = getLanguageName(targetLanguage)

    try {
      // Use shared prompt with variable replacement
      const prompt = SAFETY_TRANSLATION_PROMPT
        .replace(/{TARGET_LANGUAGE}/g, languageName)
        .replace(/{CUSTOMER_NAME}/g, 'Cliente')
        .replace('{ALLOWED_LINKS}', '- https://echatbot.ai/*\n- https://wa.me/*')
        .replace('{MESSAGE}', message)

      logger.info(`[TRANSLATION] Translating to ${languageName}...`)

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://echatbot.ai',
          'X-Title': 'eChatbot Campaign Translation',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: TRANSLATION_LLM_SETTINGS.maxTokens,
          temperature: TRANSLATION_LLM_SETTINGS.temperature,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`[TRANSLATION] API error: ${response.status} - ${errorText}`)
        return message // Fallback to original
      }

      const data = await response.json() as {
        choices?: { message?: { content?: string } }[]
      }
      const translatedText = data.choices?.[0]?.message?.content?.trim()

      if (!translatedText) {
        logger.warn('[TRANSLATION] Empty response from LLM - using original')
        return message
      }

      logger.info(`[TRANSLATION] Successfully translated to ${languageName}`)
      return translatedText

    } catch (error) {
      logger.error('[TRANSLATION] Error:', error)
      return message // Fallback to original on error
    }
  }
}

// Singleton instance
export const translationService = new TranslationService()
