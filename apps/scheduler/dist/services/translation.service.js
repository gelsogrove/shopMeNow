"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationService = exports.TranslationService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * 🔒 Translation & Security Service for Scheduler
 * Uses OpenRouter/LLM to:
 * 1. Translate campaign messages to customer's language
 * 2. Filter inappropriate content (profanity, spam, phishing)
 */
const TRANSLATION_SECURITY_PROMPT = `You are a SECURITY and TRANSLATION filter for WhatsApp marketing campaigns.

Your job is CRITICAL:
1. Translate the message to the target language
2. Filter and block ANY inappropriate content

## SECURITY FILTERING - Block ANY of these:

**Profanity (Italian)**:
cazzo, troia, puttana, stronzo, stronza, minchia, vaffanculo, coglione, fica, pene, pompino, scopare, fottere, frocio, zoccola

**Profanity (Spanish)**:
puta, cabrón, mierda, coño, polla, verga, pendejo, maricón, chupame, follar, joder, zorra, gilipollas

**Profanity (Portuguese)**:
puta, porra, caralho, foda, foder, buceta, piroca, merda, viado, vadia, arrombado

**Profanity (English)**:
fuck, pussy, bitch, dick, shit, cock, blowjob, anal, porn

**Spam/Scam**:
click here, promo code, discount code, free gift, urgent, bitcoin, crypto, referral bonus, click now, claim now

**Phishing**:
.ru, .tk, .xyz, .onion, telegram link, t.me, password, otp, codice segreto, verify account

**Adult Content**:
nude, xxx, webcam, onlyfans, porn link, sexo gratis

## TRANSLATION RULES
- Keep formatting (emojis, line breaks)
- Maintain professional, friendly tone
- Preserve customer name placeholder if present
- Preserve prices and numbers exactly
- Keep Italian product names in Italian

## REPLACEMENT
If you detect inappropriate content, replace with:
- IT: "Ciao! Scopri le nostre ultime novità. Contattaci per maggiori informazioni!"
- EN: "Hello! Discover our latest products. Contact us for more information!"
- ES: "¡Hola! Descubre nuestras últimas novedades. ¡Contáctanos para más información!"
- PT: "Olá! Descubra nossas novidades. Entre em contato para mais informações!"

## OUTPUT FORMAT - Return ONLY valid JSON:
{
  "translatedText": "The translated and filtered text",
  "blocked": false,
  "reason": null
}

If blocked:
{
  "translatedText": "[replacement message in target language]",
  "blocked": true,
  "reason": "profanity|spam|phishing|adult"
}

IMPORTANT: Return ONLY the JSON object, no markdown, no extra text.

---
TARGET LANGUAGE: {TARGET_LANGUAGE}
MESSAGE TO PROCESS:
{MESSAGE}`;
const LANGUAGE_NAMES = {
    it: 'Italian',
    en: 'English',
    es: 'Spanish',
    pt: 'Portuguese',
    IT: 'Italian',
    EN: 'English',
    ES: 'Spanish',
    PT: 'Portuguese',
    ENG: 'English', // Some customers may have legacy format
};
class TranslationService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.baseURL = process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1';
        this.model = process.env.LLM_MODEL || 'openai/gpt-4o-mini';
        if (!this.apiKey) {
            logger_1.default.warn('⚠️ [TRANSLATION] OPENROUTER_API_KEY not found - will skip translation');
        }
        else {
            logger_1.default.info('✅ [TRANSLATION] Service initialized');
        }
    }
    /**
     * Translate message to target language
     * @param message - Original message (in Italian)
     * @param targetLanguage - Customer's language code (it, en, es, pt)
     * @returns Translated message
     */
    async translateMessage(message, targetLanguage) {
        // Normalize language code
        const normalizedLang = targetLanguage?.toUpperCase() || 'IT';
        // If target is Italian, no translation needed
        if (normalizedLang === 'IT') {
            logger_1.default.info('[TRANSLATION] Target language is Italian - no translation needed');
            return message;
        }
        // If no API key, return original
        if (!this.apiKey) {
            logger_1.default.warn('[TRANSLATION] No API key - returning original message');
            return message;
        }
        const languageName = LANGUAGE_NAMES[normalizedLang] || LANGUAGE_NAMES[targetLanguage] || 'English';
        try {
            const prompt = TRANSLATION_SECURITY_PROMPT
                .replace('{TARGET_LANGUAGE}', languageName)
                .replace('{MESSAGE}', message);
            logger_1.default.info(`[TRANSLATION] Translating to ${languageName}...`);
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
                    max_tokens: 1000,
                    temperature: 0.3, // Low temperature for consistent translations
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                logger_1.default.error(`[TRANSLATION] API error: ${response.status} - ${errorText}`);
                return message; // Fallback to original
            }
            const data = await response.json();
            const translatedText = data.choices?.[0]?.message?.content?.trim();
            if (!translatedText) {
                logger_1.default.warn('[TRANSLATION] Empty response from LLM - using original');
                return message;
            }
            logger_1.default.info(`[TRANSLATION] Successfully translated to ${languageName}`);
            return translatedText;
        }
        catch (error) {
            logger_1.default.error('[TRANSLATION] Error:', error);
            return message; // Fallback to original on error
        }
    }
}
exports.TranslationService = TranslationService;
// Singleton instance
exports.translationService = new TranslationService();
//# sourceMappingURL=translation.service.js.map