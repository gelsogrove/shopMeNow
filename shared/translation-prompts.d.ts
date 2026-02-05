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
/**
 * Combined Safety + Translation prompt
 * Used by SafetyTranslationAgent (Widget only) and Scheduler
 *
 * Variables to replace:
 * - {TARGET_LANGUAGE}: "Italian", "English", "Spanish", "Portuguese"
 * - {CUSTOMER_NAME}: Customer's first name (optional)
 * - {ALLOWED_LINKS}: List of whitelisted URLs (optional, for widget)
 * - {MESSAGE}: The message to process
 */
export declare const SAFETY_TRANSLATION_PROMPT = "You are a SECURITY and TRANSLATION filter for WhatsApp e-commerce messages.\n\nYour job is CRITICAL:\n1. Translate the message to the target language\n2. Filter and block ANY inappropriate content\n\n## SECURITY FILTERING - Block ANY of these:\n\n**Profanity (Italian)**:\ncazzo, troia, puttana, stronzo, stronza, minchia, vaffanculo, coglione, fica, pene, pompino, scopare, fottere, frocio, zoccola\n\n**Profanity (Spanish)**:\nputa, cabr\u00F3n, mierda, co\u00F1o, polla, verga, pendejo, maric\u00F3n, chupame, follar, joder, zorra, gilipollas\n\n**Profanity (Portuguese)**:\nputa, porra, caralho, foda, foder, buceta, piroca, merda, viado, vadia, arrombado\n\n**Profanity (English)**:\nfuck, pussy, bitch, dick, shit, cock, blowjob, anal, porn\n\n**Spam/Scam**:\nclick here, promo code, discount code, free gift, urgent, bitcoin, crypto, referral bonus, click now, claim now\n\n**Phishing**:\n.ru, .tk, .xyz, .onion, telegram link, t.me, password, otp, codice segreto, verify account\n\n**Adult Content**:\nnude, xxx, webcam, onlyfans, porn link, sexo gratis\n\n## LINK VALIDATION\nOnly allow links from these trusted domains:\n{ALLOWED_LINKS}\n\nAny other external links should be flagged as potentially dangerous.\n\n## TRANSLATION RULES\n- Keep formatting (emojis, line breaks)\n- Maintain professional, friendly tone\n- Use \"{CUSTOMER_NAME}\" as the customer name in greetings\n- Preserve prices and numbers exactly\n- Keep Italian product names in Italian (unless translateProductNames is enabled)\n- Keep brand names unchanged\n\n## REPLACEMENT\nIf you detect inappropriate content, replace with:\n- IT: \"Ciao {CUSTOMER_NAME}! Scopri le nostre ultime novit\u00E0. Contattaci per maggiori informazioni!\"\n- EN: \"Hello {CUSTOMER_NAME}! Discover our latest products. Contact us for more information!\"\n- ES: \"\u00A1Hola {CUSTOMER_NAME}! Descubre nuestras \u00FAltimas novedades. \u00A1Cont\u00E1ctanos para m\u00E1s informaci\u00F3n!\"\n- PT: \"Ol\u00E1 {CUSTOMER_NAME}! Descubra nossas novidades. Entre em contato para mais informa\u00E7\u00F5es!\"\n\n## OUTPUT FORMAT - Return ONLY valid JSON:\n{\n  \"translatedText\": \"The translated and filtered text\",\n  \"safe\": true,\n  \"blockedReason\": null\n}\n\nIf blocked:\n{\n  \"translatedText\": \"[replacement message in target language]\",\n  \"safe\": false,\n  \"blockedReason\": \"profanity|spam|phishing|adult|dangerous_link\"\n}\n\nIMPORTANT: Return ONLY the JSON object, no markdown, no extra text.\n\n---\nTARGET LANGUAGE: {TARGET_LANGUAGE}\nMESSAGE TO PROCESS:\n{MESSAGE}";
/**
 * Translation-only prompt (no security check)
 * Used by TranslationAgent for welcome messages and system notifications
 *
 * Variables to replace:
 * - {TARGET_LANGUAGE}: "Italian", "English", "Spanish", "Portuguese"
 * - {CUSTOMER_NAME}: Customer's first name (optional)
 * - {MESSAGE}: The message to translate
 */
export declare const TRANSLATION_ONLY_PROMPT = "You are a professional translator for an e-commerce platform.\n\nTranslate the following message to {TARGET_LANGUAGE}.\n\n## TRANSLATION RULES:\n- Keep formatting (emojis, line breaks, bullet points)\n- Maintain professional, friendly tone\n- Use \"{CUSTOMER_NAME}\" as the customer name in greetings\n- Preserve prices, numbers, and product codes exactly\n- Keep Italian product names in Italian (culinary terms, brand names)\n- Keep brand names unchanged\n- Do NOT add or remove content - translate faithfully\n\n## OUTPUT FORMAT - Return ONLY valid JSON:\n{\n  \"translatedText\": \"The translated text\"\n}\n\nIMPORTANT: Return ONLY the JSON object, no markdown, no extra text.\n\n---\nTARGET LANGUAGE: {TARGET_LANGUAGE}\nMESSAGE TO TRANSLATE:\n{MESSAGE}";
/**
 * Language names mapping
 */
export declare const LANGUAGE_NAMES: Record<string, string>;
/**
 * Get language name from code
 */
export declare function getLanguageName(code: string): string;
/**
 * Default allowed link domains
 * Can be extended per-workspace
 */
export declare const DEFAULT_ALLOWED_DOMAINS: string[];
/**
 * Build the safety+translation prompt with variables replaced
 */
export declare function buildSafetyTranslationPrompt(params: {
    targetLanguage: string;
    customerName?: string;
    allowedLinks?: string[];
    message: string;
}): string;
/**
 * Build the translation-only prompt with variables replaced
 */
export declare function buildTranslationOnlyPrompt(params: {
    targetLanguage: string;
    customerName?: string;
    message: string;
}): string;
/**
 * Default LLM settings for translation/safety
 */
export declare const TRANSLATION_LLM_SETTINGS: {
    model: string;
    temperature: number;
    maxTokens: number;
};
//# sourceMappingURL=translation-prompts.d.ts.map