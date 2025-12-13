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

import logger from "../utils/logger"

/**
 * Result of preprocessing - simplified
 */
export interface PreprocessResult {
  /** Original user message */
  originalMessage: string

  /** Whether this is a short/special input */
  isShortInput: boolean

  /** Type of input detected */
  inputType: "number" | "confirmation" | "confirmation_with_quantity" | "rejection" | "normal"

  /** Extracted number if applicable */
  extractedNumber?: number

  /** Extracted quantity (for "si 4" patterns) */
  extractedQuantity?: number

  /** Enriched message with context hint for LLM */
  enrichedMessage: string
}

// Keep old interface for backward compatibility during transition
export type ListType = "categories" | "groups" | "products" | "orders" | "cart" | "binary" | "unknown"
export interface OptionsMapping {
  type: "numbered" | "binary"
  options?: Array<{ number: number; label: string; count?: number }>
  listType?: ListType
  pendingAction?: {
    type: "ADD_TO_CART" | "VIEW_CART" | "CONFIRM_ORDER" | "REPEAT_ORDER" | "CANCEL_ORDER"
    productId?: string
    productName?: string
    quantity?: number
    orderId?: string
  }
}

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
export class MessagePreprocessorService {
  // Universal patterns ONLY - no language-specific words
  private static readonly CONFIRMATION = /^(sì|si|yes|ok|okay)$/i
  private static readonly CONFIRMATION_WITH_QUANTITY = /^(sì|si|yes|ok|okay)[,\s!.]*\s*(\d+)/i
  private static readonly REJECTION = /^no$/i
  private static readonly NUMBER = /^(\d+)$/

  /**
   * Process user message - detect pattern type and enrich for LLM
   * 
   * @param userMessage - The user's message
   * @param _optionsMapping - IGNORED (kept for backward compatibility)
   */
  process(userMessage: string, _optionsMapping?: OptionsMapping | null): PreprocessResult {
    const trimmed = userMessage?.trim() || ""
    const lower = trimmed.toLowerCase()

    // Default: normal message, pass through unchanged
    const baseResult: PreprocessResult = {
      originalMessage: userMessage,
      isShortInput: false,
      inputType: "normal",
      enrichedMessage: userMessage,
    }

    if (!trimmed) {
      return baseResult
    }

    // CASE 1: Pure number ("1", "2", "3"...)
    const numMatch = trimmed.match(MessagePreprocessorService.NUMBER)
    if (numMatch) {
      const num = parseInt(numMatch[1], 10)
      logger.info("🔢 [Preprocessor] Number detected", { number: num })
      return {
        originalMessage: userMessage,
        isShortInput: true,
        inputType: "number",
        extractedNumber: num,
        enrichedMessage: `[SELECTION: User typed "${num}". This is likely a selection from the previous numbered list. Look at conversation history to find item #${num} and take appropriate action (show details, add to cart, etc).]`,
      }
    }

    // CASE 2: Confirmation WITH quantity ("si 4", "ok 3", "yes 5")
    const confQtyMatch = trimmed.match(MessagePreprocessorService.CONFIRMATION_WITH_QUANTITY)
    if (confQtyMatch) {
      const qty = parseInt(confQtyMatch[2], 10)
      logger.info("✅ [Preprocessor] Confirmation with quantity", { quantity: qty })
      return {
        originalMessage: userMessage,
        isShortInput: true,
        inputType: "confirmation_with_quantity",
        extractedQuantity: qty,
        enrichedMessage: `[CONFIRMATION: User confirmed with quantity ${qty}. Look at conversation history to see what was offered (e.g., "add to cart?") and execute that action with quantity ${qty}.]`,
      }
    }

    // CASE 3: Pure confirmation ("si", "sì", "yes", "ok")
    if (MessagePreprocessorService.CONFIRMATION.test(lower)) {
      logger.info("✅ [Preprocessor] Confirmation detected")
      return {
        originalMessage: userMessage,
        isShortInput: true,
        inputType: "confirmation",
        enrichedMessage: `[CONFIRMATION: User said "${trimmed}" (yes). Look at conversation history to see what question was asked and execute the appropriate action.]`,
      }
    }

    // CASE 4: Rejection ("no")
    if (MessagePreprocessorService.REJECTION.test(lower)) {
      logger.info("❌ [Preprocessor] Rejection detected")
      return {
        originalMessage: userMessage,
        isShortInput: true,
        inputType: "rejection",
        enrichedMessage: `[REJECTION: User said "no". Acknowledge and ask what else they would like to do.]`,
      }
    }

    // Not a short input pattern - pass through unchanged to LLM
    return baseResult
  }
}

// Singleton export
export const messagePreprocessorService = new MessagePreprocessorService()
