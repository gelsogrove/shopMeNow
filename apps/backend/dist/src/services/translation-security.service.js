"use strict";
/**
 * 🔒 TRANSLATION & SECURITY LAYER
 *
 **Phishing/External Links**:
ANY http:// or https:// links that are NOT in the ALLOWED LINKS list above, .ru, .tk, .xyz, .bit, .zip, .rar, .onion, .top, .app, telegram, t.me, whatsapp group, premio whatsapp, banco, banca, bank, password, contraseña, senha, otp, codice segreto, free gift, verify, verifica, confirmar cuenta, confirmar conta, confirmar accountLayer finale che:
 * 1. Traduce la risposta nella lingua del cliente
 * 2. Filtra contenuti inappropriati (parolacce, spam, phishing)
 *
 * Usa OpenRouter GPT-4-mini con prompt HARDCODED
 *
 * @author Andrea Gelso
 * @date 2025-10-13
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
exports.TranslationSecurityService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = __importDefault(require("../utils/logger"));
const ITALIAN_PROFANITY = [
    "cazzo",
    "troia",
    "puttana",
    "stronzo",
    "stronza",
    "minchia",
    "vaffanculo",
    "coglione",
    "cogliona",
    "fica",
    "pene",
    "pompino",
    "succhiami",
    "leccami",
    "scopare",
    "scopami",
    "succhiare",
    "fottere",
    "frocio",
    "puttanella",
    "stronzetto",
    "zoccola",
];
const ITALIAN_SPAM_TERMS = [
    "subscribe",
    "click here",
    "link in bio",
    "promo",
    "discount",
    "offer",
    "free",
    "gratis",
    "urgent",
    "urgente",
    "regalo",
    "offerta",
    "invest",
    "bitcoin",
    "crypto",
    "referral",
    "bonus",
    "click now",
    "claim now",
    "offerta limitata",
    "promozione",
];
const ITALIAN_PHISHING_TERMS = [
    ".ru",
    ".tk",
    ".xyz",
    ".bit",
    ".zip",
    ".rar",
    ".onion",
    ".top",
    ".app",
    "telegram",
    "t.me",
    "whatsapp group",
    "premio whatsapp",
    "banco",
    "banca",
    "bank",
    "password",
    "contraseña",
    "senha",
    "otp",
    "codice segreto",
    "free gift",
    "verify",
    "verifica",
    "confirmar",
];
const ITALIAN_ADULT_TERMS = [
    "sexy",
    "porno",
    "porn",
    "xxx",
    "cam girl",
    "nude",
    "onlyfans",
    "fansly",
    "webcam",
];
// Prompt HARDCODED (non modificabile da DB)
const TRANSLATION_SECURITY_PROMPT = `You are a SECURITY and TRANSLATION filter for a WhatsApp e-commerce chatbot.

Your job is CRITICAL:
1. Translate the response to the target language
2. Filter and block ANY inappropriate content
3. Block ANY external links except official system links

## ALLOWED LINKS (DO NOT BLOCK):
{{ALLOWED_LINKS}}

## SECURITY FILTERING - Block ANY of these:

**Profanity (Italian)**:
cazzo, troia, puttana, stronzo, stronza, minchia, vaffanculo, coglione, cogliona, fica, pene, pompino, succhiami, leccami, scopare, scopami, succhiare, fottere, frocio, puttanella, stronzetto, zoccola

**Profanity (Spanish)**:
puta, cabrón, cabrona, mierda, coño, culo, polla, verga, pendejo, pendeja, maricón, maricona, chupame, mamada, follar, sexo, porno, follame, cojones, joder, putita, zorra, gilipollas, chupamela

**Profanity (Portuguese)**:
puta, porra, caralho, foda, foder, buceta, piroca, cu, merda, viado, vadia, arrombado, chupameu, sexo, pornô, foda-se, otário, vadia, corno, safada, safado

**Profanity (English)**:
fuck, god, pussy, bitch, dick, shit, cock, blowjob, anal, sex, porn, dildo, suck, suck me, lick me, jerk off, f***

**Spam/Scam**:
subscribe, click here, link in bio, promo, discount, offer, free, gratis, urgent, urgente, regalo, oferta, ganhar dinheiro, vincita, offerta, invest, bitcoin, crypto, referral, bonus, urgent message, special offer, click now, claim now, oferta limitada, promoción

**Phishing**:
.ru, .tk, .xyz, .bit, .zip, .rar, .onion, .top, .app, telegram, t.me, whatsapp group, premio whatsapp, banco, banca, bank, password, contraseña, senha, otp, codice segreto, free gift, verify, verifica, confirmar cuenta, confirmar conta, confirmar account

**Adult Content**:
win, ganar, guadagna, ganar dinero, easy money, fast money, hot girls, sexy girls, click link, vip, follow me, nude, xxx, webcam, onlyfans, fansly, porn link, sexo gratis, porno gratis, xxx video, cam girl, link especial, oferta especial

## TRANSLATION RULES
- Keep formatting (emojis, line breaks, bullets)
- **PRESERVE HTML TAGS** - Keep all <img>, <a>, <strong>, <em>, <br> tags exactly as they appear
- DO NOT remove or modify HTML img src attributes
- Translate category names, descriptions, and conversational text
- **DO NOT translate Italian product names** - keep them in Italian (e.g., "Parmigiano Reggiano", "Prosciutto di Parma")
- Translate product descriptions but preserve Italian food terminology
- Preserve prices, order codes, email addresses exactly as they appear
- Maintain natural, conversational tone
- Use appropriate formality for e-commerce

## EXCEPTIONS - DO NOT translate or filter:
- **Italian product names** - must stay in Italian (e.g., pasta names, cheese names, salumi names)
- Italian food terms (e.g., "al dente", "DOP", "IGP")
- Order codes (e.g., ORD-001-2024)
- Email addresses (@echatbot.ai)
- WhatsApp numbers
- Prices and numbers (€12.50)
- Links listed in ALLOWED LINKS section above

## REPLACEMENT
If you detect inappropriate content, replace with:
- IT: "Mi dispiace, non posso aiutarti con questo. Come posso aiutarti con i nostri prodotti?"
- EN: "I'm sorry, I can't help you with that. How can I assist you with our products?"
- ES: "Lo siento, no puedo ayudarte con eso. ¿Cómo puedo ayudarte con nuestros productos?"
- PT: "Desculpe, não posso ajudar com isso. Como posso ajudá-lo com nossos produtos?"
- DE: "Es tut mir leid, damit kann ich Ihnen nicht helfen. Wie kann ich Ihnen mit unseren Produkten helfen?"
- FR: "Désolé, je ne peux pas vous aider avec ça. Comment puis-je vous aider avec nos produits?"

## OUTPUT FORMAT - CRITICAL: Return ONLY valid JSON:
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

IMPORTANT: 
- Return ONLY the JSON object, no markdown, no extra text
- The JSON must be valid and parseable
- Always include all three fields: translatedText, blocked, reason`;
class TranslationSecurityService {
    constructor() {
        // Try to load from environment
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        if (!this.openRouterApiKey) {
            logger_1.default.warn("⚠️ OPENROUTER_API_KEY not found - Translation layer will fallback to original text");
        }
        else {
            logger_1.default.info("✅ TranslationSecurityService initialized with OpenRouter API key");
        }
    }
    /**
     * Process response: translate + security filter
     * @param response - Text to translate/filter
     * @param targetLanguage - Target language code (it, en, es, pt, de, fr)
     * @param allowedLinks - Array of allowed system links (all other links will be blocked)
     * @param model - LLM model to use (default: openai/gpt-4o-mini for backward compatibility)
     * @param baseURL - LLM API base URL (default: https://openrouter.ai/api/v1)
     * @param apiKey - LLM API key (default: use from constructor for backward compatibility)
     */
    processResponse(response_1, targetLanguage_1) {
        return __awaiter(this, arguments, void 0, function* (response, targetLanguage, allowedLinks = [], model = "openai/gpt-4o-mini", baseURL = "https://openrouter.ai/api/v1", apiKey) {
            // Use provided apiKey or fallback to constructor's key
            const effectiveApiKey = apiKey || this.openRouterApiKey;
            const normalizedTarget = (targetLanguage || "it").toLowerCase();
            const needsTranslation = normalizedTarget !== "it" && !normalizedTarget.startsWith("it-");
            // Check if API key is available
            if (!effectiveApiKey) {
                logger_1.default.warn("⚠️ Translation skipped - No API key available");
                return {
                    translatedText: response,
                    blocked: false,
                    reason: null,
                };
            }
            try {
                // Se siamo già in italiano, applica solo i controlli di sicurezza senza LLM
                if (!needsTranslation) {
                    logger_1.default.info("🔒 TranslationSecurity applying security-only mode", {
                        targetLanguage,
                        responseLength: response.length,
                    });
                    return this.applySecurityOnly(response, targetLanguage, allowedLinks);
                }
                logger_1.default.info("🔒 TranslationSecurity processing", {
                    targetLanguage,
                    needsTranslation,
                    responseLength: response.length,
                    allowedLinksCount: allowedLinks.length,
                    model: model,
                    baseURL: baseURL,
                });
                // Chiama LLM per traduzione + filtro
                const result = yield this.callTranslationLLM(response, targetLanguage, allowedLinks, model, baseURL, effectiveApiKey // Pass effective API key
                );
                if (result.blocked) {
                    logger_1.default.warn("⚠️ BLOCKED inappropriate content", {
                        reason: result.reason,
                        original: response.substring(0, 100),
                    });
                }
                return result;
            }
            catch (error) {
                logger_1.default.error("❌ TranslationSecurity failed", error);
                // Fallback: return original (meglio che crashare)
                return {
                    translatedText: response,
                    blocked: false,
                    reason: null,
                };
            }
        });
    }
    applySecurityOnly(text, targetLanguage, allowedLinks) {
        const lowerText = text.toLowerCase();
        if (this.containsAny(lowerText, ITALIAN_PROFANITY)) {
            return {
                translatedText: this.getBlockMessage(targetLanguage),
                blocked: true,
                reason: "profanity",
            };
        }
        if (this.containsAny(lowerText, ITALIAN_ADULT_TERMS)) {
            return {
                translatedText: this.getBlockMessage(targetLanguage),
                blocked: true,
                reason: "adult",
            };
        }
        if (this.containsAny(lowerText, ITALIAN_SPAM_TERMS)) {
            return {
                translatedText: this.getBlockMessage(targetLanguage),
                blocked: true,
                reason: "spam",
            };
        }
        if (this.containsAny(lowerText, ITALIAN_PHISHING_TERMS) ||
            this.hasDisallowedLinks(text, allowedLinks)) {
            return {
                translatedText: this.getBlockMessage(targetLanguage),
                blocked: true,
                reason: "phishing",
            };
        }
        return {
            translatedText: text,
            blocked: false,
            reason: null,
        };
    }
    containsAny(text, terms) {
        return terms.some((term) => text.includes(term.toLowerCase()));
    }
    hasDisallowedLinks(text, allowedLinks) {
        const matches = text.match(/https?:\/\/[^\s)]+/gi);
        if (!matches || matches.length === 0) {
            return false;
        }
        const normalizedAllowed = allowedLinks
            .map((link) => link.trim().toLowerCase().replace(/\/+$/, ""))
            .filter(Boolean);
        return matches.some((rawLink) => {
            const normalizedLink = rawLink.trim().toLowerCase();
            return !normalizedAllowed.some((allowed) => normalizedLink.startsWith(allowed));
        });
    }
    getBlockMessage(language) {
        const baseMessages = {
            it: "Mi dispiace, non posso aiutarti con questo. Come posso aiutarti con i nostri prodotti?",
            en: "I'm sorry, I can't help you with that. How can I assist you with our products?",
            es: "Lo siento, no puedo ayudarte con eso. ¿Cómo puedo ayudarte con nuestros productos?",
            pt: "Desculpe, não posso ajudar com isso. Como posso ajudá-lo com nossos produtos?",
            de: "Es tut mir leid, damit kann ich Ihnen nicht helfen. Wie kann ich Ihnen mit unseren Produkten helfen?",
            fr: "Désolé, je ne peux pas vous aider avec ça. Comment puis-je vous aider avec nos produits?",
        };
        const normalized = (language === null || language === void 0 ? void 0 : language.toLowerCase()) || "it";
        if (baseMessages[normalized]) {
            return baseMessages[normalized];
        }
        if (normalized.startsWith("it"))
            return baseMessages.it;
        if (normalized.startsWith("en"))
            return baseMessages.en;
        if (normalized.startsWith("es"))
            return baseMessages.es;
        if (normalized.startsWith("pt"))
            return baseMessages.pt;
        if (normalized.startsWith("de"))
            return baseMessages.de;
        if (normalized.startsWith("fr"))
            return baseMessages.fr;
        return baseMessages.it;
    }
    /**
     * Call LLM for translation + security
     * @param model - LLM model to use (default: openai/gpt-4o-mini)
     * @param baseURL - LLM API base URL (default: https://openrouter.ai/api/v1)
     * @param apiKey - LLM API key to use for authentication
     */
    callTranslationLLM(text_1, targetLanguage_1, allowedLinks_1) {
        return __awaiter(this, arguments, void 0, function* (text, targetLanguage, allowedLinks, model = "openai/gpt-4o-mini", baseURL = "https://openrouter.ai/api/v1", apiKey) {
            var _a, _b, _c, _d, _e;
            // Replace {{ALLOWED_LINKS}} in prompt with actual links
            const allowedLinksText = allowedLinks.length > 0
                ? allowedLinks.map((link) => `- ${link}`).join("\n")
                : "- (No system links defined yet)";
            const promptWithLinks = TRANSLATION_SECURITY_PROMPT.replace("{{ALLOWED_LINKS}}", allowedLinksText);
            const userPrompt = `Target Language: ${this.getLanguageName(targetLanguage)}

Response to translate and filter:
${text}

Remember: Return ONLY the JSON object with translatedText, blocked, and reason fields.`;
            try {
                logger_1.default.info("🔐 Calling OpenRouter API", {
                    model,
                    baseURL,
                    textLength: text.length,
                    targetLanguage,
                });
                const response = yield axios_1.default.post(`${baseURL}/chat/completions`, {
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: promptWithLinks, // Use prompt with replaced allowed links
                        },
                        {
                            role: "user",
                            content: userPrompt,
                        },
                    ],
                    temperature: 0.3, // Bassa per essere consistente
                    max_tokens: 2000,
                }, {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://echatbot.ai",
                        "X-Title": "eChatbot Translation Security",
                    },
                });
                logger_1.default.info("✅ OpenRouter API response received", {
                    status: response.status,
                    hasChoices: !!response.data.choices,
                    choicesLength: (_a = response.data.choices) === null || _a === void 0 ? void 0 : _a.length,
                });
                const content = (_d = (_c = (_b = response.data.choices[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.trim();
                if (!content) {
                    logger_1.default.error("❌ Empty content from OpenRouter");
                    throw new Error("Empty response from OpenRouter");
                }
                logger_1.default.info("📝 Raw LLM response:", {
                    contentLength: content.length,
                    contentPreview: content.substring(0, 200),
                });
                // Parse JSON (rimuovi eventuali markdown)
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    logger_1.default.error("❌ Failed to extract JSON from LLM response:", {
                        fullContent: content,
                    });
                    throw new Error("Invalid JSON response");
                }
                logger_1.default.info("🔍 Extracted JSON string:", {
                    jsonLength: jsonMatch[0].length,
                    jsonPreview: jsonMatch[0].substring(0, 200),
                });
                const result = JSON.parse(jsonMatch[0]);
                logger_1.default.info("✅ Parsed translation result:", {
                    blocked: result.blocked,
                    reason: result.reason,
                    translatedLength: (_e = result.translatedText) === null || _e === void 0 ? void 0 : _e.length,
                });
                // Validate structure
                if (typeof result.translatedText !== "string" ||
                    typeof result.blocked !== "boolean") {
                    throw new Error("Invalid response structure");
                }
                return result;
            }
            catch (error) {
                logger_1.default.error("Failed to call translation LLM:", error);
                throw error;
            }
        });
    }
    /**
     * Get full language name for prompt
     */
    getLanguageName(code) {
        const languages = {
            // Lowercase ISO codes
            it: "Italian",
            en: "English",
            es: "Spanish",
            pt: "Portuguese",
            de: "German",
            fr: "French",
            // Uppercase database format
            IT: "Italian",
            ENG: "English",
            ESP: "Spanish",
            PRT: "Portuguese",
        };
        return languages[code] || languages[code.toLowerCase()] || "Italian";
    }
    /**
     * Health check - verify service is working
     */
    healthCheck() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const testResult = yield this.processResponse("Ciao, come stai?", "en", [] // No allowed links for health check
                );
                return (testResult.translatedText.includes("Hello") ||
                    testResult.translatedText.includes("Hi"));
            }
            catch (error) {
                logger_1.default.error("TranslationSecurity healthCheck failed", error);
                return false;
            }
        });
    }
}
exports.TranslationSecurityService = TranslationSecurityService;
exports.default = new TranslationSecurityService();
//# sourceMappingURL=translation-security.service.js.map