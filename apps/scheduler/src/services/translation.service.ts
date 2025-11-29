import logger from '../utils/logger'

/**
 * Translation Service for Scheduler
 * Uses OpenRouter/LLM to translate campaign messages to customer's language
 */

const TRANSLATION_PROMPT = `You are a professional translator for business communications.

Translate the following message from Italian to {TARGET_LANGUAGE}.

RULES:
1. Maintain a professional, friendly tone
2. Keep the same formatting (line breaks, emojis)
3. Preserve any names or proper nouns
4. If the target language is Italian, return the original text unchanged
5. Return ONLY the translated text, nothing else

Message to translate:
{MESSAGE}`

const LANGUAGE_NAMES: Record<string, string> = {
  it: 'Italian',
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  IT: 'Italian',
  EN: 'English',
  ES: 'Spanish',
  PT: 'Portuguese',
  ENG: 'English', // Some customers may have legacy format
}

export class TranslationService {
  private readonly apiKey: string
  private readonly baseURL: string
  private readonly model: string

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || ''
    this.baseURL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1'
    this.model = process.env.LLM_MODEL || 'openai/gpt-4o-mini'

    if (!this.apiKey) {
      logger.warn('⚠️ [TRANSLATION] OPENROUTER_API_KEY not found - will skip translation')
    } else {
      logger.info('✅ [TRANSLATION] Service initialized')
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

    const languageName = LANGUAGE_NAMES[normalizedLang] || LANGUAGE_NAMES[targetLanguage] || 'English'

    try {
      const prompt = TRANSLATION_PROMPT
        .replace('{TARGET_LANGUAGE}', languageName)
        .replace('{MESSAGE}', message)

      logger.info(`[TRANSLATION] Translating to ${languageName}...`)

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://shopme.com',
          'X-Title': 'ShopME Campaign Translation',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.3, // Low temperature for consistent translations
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error(`[TRANSLATION] API error: ${response.status} - ${errorText}`)
        return message // Fallback to original
      }

      const data = await response.json()
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
