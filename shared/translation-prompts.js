"use strict";
/**
 * 🌍 Shared Translation & Safety Prompts
 *
 * Single source of truth for translation and security prompts.
 * Used by both Backend (SafetyTranslationAgent, TranslationAgent) and Scheduler.
 *
 * HARDCODED: These prompts are NOT stored in database.
 * To modify: Update this file and redeploy both backend and scheduler.
 *
 * @architecture Shared module - used by backend + scheduler
 * @updated 2025-01-31
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANSLATION_LLM_SETTINGS = exports.DEFAULT_ALLOWED_DOMAINS = exports.LANGUAGE_NAMES = exports.TRANSLATION_ONLY_PROMPT = exports.SAFETY_TRANSLATION_PROMPT = void 0;
exports.getLanguageName = getLanguageName;
exports.buildSafetyTranslationPrompt = buildSafetyTranslationPrompt;
exports.buildTranslationOnlyPrompt = buildTranslationOnlyPrompt;
/**
 * Combined Safety + Translation prompt
 * Used by SafetyTranslationAgent and Scheduler
 *
 * Variables to replace:
 * - {TARGET_LANGUAGE}: "Italian", "English", "Spanish", "Portuguese"
 * - {CUSTOMER_NAME}: Customer's first name (optional)
 * - {ALLOWED_LINKS}: List of whitelisted URLs (optional, for widget)
 * - {MESSAGE}: The message to process
 */
exports.SAFETY_TRANSLATION_PROMPT = `You are a SECURITY and TRANSLATION filter for WhatsApp e-commerce messages.

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

## LINK VALIDATION
Only allow links from these trusted domains:
{ALLOWED_LINKS}

Any other external links should be flagged as potentially dangerous.

## TRANSLATION RULES
- Keep formatting (emojis, line breaks)
- Maintain professional, friendly tone
- Use "{CUSTOMER_NAME}" as the customer name in greetings
- Preserve prices and numbers exactly
- Keep Italian product names in Italian (unless translateProductNames is enabled)
- Keep brand names unchanged

## REPLACEMENT
If you detect inappropriate content, replace with:
- IT: "Ciao {CUSTOMER_NAME}! Scopri le nostre ultime novità. Contattaci per maggiori informazioni!"
- EN: "Hello {CUSTOMER_NAME}! Discover our latest products. Contact us for more information!"
- ES: "¡Hola {CUSTOMER_NAME}! Descubre nuestras últimas novedades. ¡Contáctanos para más información!"
- PT: "Olá {CUSTOMER_NAME}! Descubra nossas novidades. Entre em contato para mais informações!"

## OUTPUT FORMAT - Return ONLY valid JSON:
{
  "translatedText": "The translated and filtered text",
  "safe": true,
  "blockedReason": null
}

If blocked:
{
  "translatedText": "[replacement message in target language]",
  "safe": false,
  "blockedReason": "profanity|spam|phishing|adult|dangerous_link"
}

IMPORTANT: Return ONLY the JSON object, no markdown, no extra text.

---
TARGET LANGUAGE: {TARGET_LANGUAGE}
MESSAGE TO PROCESS:
{MESSAGE}`;
/**
 * Translation-only prompt (no security check)
 * Used by TranslationAgent for welcome messages and system notifications
 *
 * Variables to replace:
 * - {TARGET_LANGUAGE}: "Italian", "English", "Spanish", "Portuguese"
 * - {CUSTOMER_NAME}: Customer's first name (optional)
 * - {MESSAGE}: The message to translate
 */
exports.TRANSLATION_ONLY_PROMPT = `You are a professional translator for an e-commerce platform.

Translate the following message to {TARGET_LANGUAGE}.

## TRANSLATION RULES:
- Keep formatting (emojis, line breaks, bullet points)
- Maintain professional, friendly tone
- Use "{CUSTOMER_NAME}" as the customer name in greetings
- Preserve prices, numbers, and product codes exactly
- Keep Italian product names in Italian (culinary terms, brand names)
- Keep brand names unchanged
- Do NOT add or remove content - translate faithfully

## OUTPUT FORMAT - Return ONLY valid JSON:
{
  "translatedText": "The translated text"
}

IMPORTANT: Return ONLY the JSON object, no markdown, no extra text.

---
TARGET LANGUAGE: {TARGET_LANGUAGE}
MESSAGE TO TRANSLATE:
{MESSAGE}`;
/**
 * Language names mapping
 */
exports.LANGUAGE_NAMES = {
    it: "Italian",
    en: "English",
    es: "Spanish",
    pt: "Portuguese",
    IT: "Italian",
    EN: "English",
    ES: "Spanish",
    PT: "Portuguese",
    ENG: "English", // Legacy format
};
/**
 * Get language name from code
 */
function getLanguageName(code) {
    return exports.LANGUAGE_NAMES[code] || exports.LANGUAGE_NAMES[code?.toUpperCase()] || "English";
}
/**
 * Default allowed link domains
 * Can be extended per-workspace
 */
exports.DEFAULT_ALLOWED_DOMAINS = [
    "echatbot.ai",
    "shopmenow.it",
    "wa.me",
    "api.whatsapp.com",
];
/**
 * Build the safety+translation prompt with variables replaced
 */
function buildSafetyTranslationPrompt(params) {
    const languageName = getLanguageName(params.targetLanguage);
    const customerName = params.customerName || "Cliente";
    // Build allowed links section
    const allowedLinksText = params.allowedLinks?.length
        ? params.allowedLinks.map((link) => `- ${link}`).join("\n")
        : exports.DEFAULT_ALLOWED_DOMAINS.map((d) => `- https://${d}/*`).join("\n");
    return exports.SAFETY_TRANSLATION_PROMPT
        .replace(/{TARGET_LANGUAGE}/g, languageName)
        .replace(/{CUSTOMER_NAME}/g, customerName)
        .replace("{ALLOWED_LINKS}", allowedLinksText)
        .replace("{MESSAGE}", params.message);
}
/**
 * Build the translation-only prompt with variables replaced
 */
function buildTranslationOnlyPrompt(params) {
    const languageName = getLanguageName(params.targetLanguage);
    const customerName = params.customerName || "Cliente";
    return exports.TRANSLATION_ONLY_PROMPT
        .replace(/{TARGET_LANGUAGE}/g, languageName)
        .replace(/{CUSTOMER_NAME}/g, customerName)
        .replace("{MESSAGE}", params.message);
}
/**
 * Default LLM settings for translation/safety
 */
exports.TRANSLATION_LLM_SETTINGS = {
    model: "openai/gpt-4o-mini",
    temperature: 0.3, // Low temperature for consistent translations
    maxTokens: 1000,
};
//# sourceMappingURL=translation-prompts.js.map