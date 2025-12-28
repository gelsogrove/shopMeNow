"use strict";
/**
 * MessagePreprocessorService - SIMPLIFIED
 *
 * ONLY detects short input patterns (numbers, yes/no) and enriches message for LLM.
 *
 * THE LLM IS INTELLIGENT - it has conversation history and understands context!
 *
 * RULES:
 * - NO language-specific patterns (no "primo", "voglio", etc.)
 * - NO list parsing or mapping
 * - NO cleanLabel regex
 * - Just detect pattern type and let LLM do the work with history
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messagePreprocessorService = exports.MessagePreprocessorService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * MessagePreprocessorService
 *
 * Detects short inputs and enriches them with context hints for LLM.
 * THE LLM DOES THE ACTUAL WORK with conversation history.
 *
 * ONLY HANDLES:
 * - Pure numbers: "1", "2", "3"...
 * - Confirmations: "si", "sì", "yes", "ok"
 * - Confirmation + quantity: "si 4", "ok 3"
 * - Rejection: "no"
 */
class MessagePreprocessorService {
    /**
     * Process user message - detect pattern type and enrich for LLM
     *
     * @param userMessage - The user's message
     * @param _optionsMapping - IGNORED (kept for backward compatibility)
     */
    process(userMessage, _optionsMapping) {
        const trimmed = (userMessage === null || userMessage === void 0 ? void 0 : userMessage.trim()) || "";
        const lower = trimmed.toLowerCase();
        // Default: normal message, pass through unchanged
        const baseResult = {
            originalMessage: userMessage,
            isShortInput: false,
            inputType: "normal",
            enrichedMessage: userMessage,
        };
        if (!trimmed) {
            return baseResult;
        }
        // CASE 1: Pure number ("1", "2", "3"...)
        const numMatch = trimmed.match(MessagePreprocessorService.NUMBER);
        if (numMatch) {
            const num = parseInt(numMatch[1], 10);
            logger_1.default.info("🔢 [Preprocessor] Number detected", { number: num });
            return {
                originalMessage: userMessage,
                isShortInput: true,
                inputType: "number",
                extractedNumber: num,
                enrichedMessage: `[SELECTION: User typed "${num}". This is likely a selection from the previous numbered list. Look at conversation history to find item #${num} and take appropriate action (show details, add to cart, etc).]`,
            };
        }
        // CASE 2: Confirmation WITH quantity ("si 4", "ok 3", "yes 5")
        const confQtyMatch = trimmed.match(MessagePreprocessorService.CONFIRMATION_WITH_QUANTITY);
        if (confQtyMatch) {
            const qty = parseInt(confQtyMatch[2], 10);
            logger_1.default.info("✅ [Preprocessor] Confirmation with quantity", { quantity: qty });
            return {
                originalMessage: userMessage,
                isShortInput: true,
                inputType: "confirmation_with_quantity",
                extractedQuantity: qty,
                enrichedMessage: `[CONFIRMATION: User confirmed with quantity ${qty}. Look at conversation history to see what was offered (e.g., "add to cart?") and execute that action with quantity ${qty}.]`,
            };
        }
        // CASE 3: Pure confirmation ("si", "sì", "yes", "ok")
        if (MessagePreprocessorService.CONFIRMATION.test(lower)) {
            logger_1.default.info("✅ [Preprocessor] Confirmation detected");
            return {
                originalMessage: userMessage,
                isShortInput: true,
                inputType: "confirmation",
                enrichedMessage: `[CONFIRMATION: User said "${trimmed}" (yes). Look at conversation history to see what question was asked and execute the appropriate action.]`,
            };
        }
        // CASE 4: Rejection ("no")
        if (MessagePreprocessorService.REJECTION.test(lower)) {
            logger_1.default.info("❌ [Preprocessor] Rejection detected");
            return {
                originalMessage: userMessage,
                isShortInput: true,
                inputType: "rejection",
                enrichedMessage: `[REJECTION: User said "no". Acknowledge and ask what else they would like to do.]`,
            };
        }
        // Not a short input pattern - pass through unchanged to LLM
        return baseResult;
    }
}
exports.MessagePreprocessorService = MessagePreprocessorService;
// Universal patterns - includes IT/EN/ES/PT confirmations
// 🇮🇹 Italian: sì, si, confermo, conferma, certo, esatto, perfetto, va bene, d'accordo
// 🇬🇧 English: yes, sure, right, perfect, alright, agreed, confirm
// 🇪🇸 Spanish: sí, claro, exacto, perfecto, de acuerdo, vale, confirmo
// 🇵🇹 Portuguese: sim, certo, exato, perfeito, de acordo, está bem, confirmo
MessagePreprocessorService.CONFIRMATION = /^(sì|si|sim|yes|ok|okay|confermo|confirmo|confirma|confirm|certo|claro|sure|esatto|exacto|exato|right|perfetto|perfecto|perfeito|perfect|va bene|alright|de acuerdo|de acordo|d'accordo|agreed|vale|está bem|está bien)$/i;
MessagePreprocessorService.CONFIRMATION_WITH_QUANTITY = /^(sì|si|sim|yes|ok|okay|confermo|confirmo|confirm|claro|sure|certo|vale)[,\s!.]*\s*(\d+)/i;
MessagePreprocessorService.REJECTION = /^(no|não|nao|never)$/i;
MessagePreprocessorService.NUMBER = /^(\d+)$/;
// Singleton export
exports.messagePreprocessorService = new MessagePreprocessorService();
//# sourceMappingURL=message-preprocessor.service.js.map