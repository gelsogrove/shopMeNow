/**
 * Intent Patterns - Deterministic pattern matching
 *
 * Evaluated BEFORE any LLM call.
 *
 * ⚠️ PRINCIPLE XV: USER CONTEXT FREEDOM (Constitution v2.2.0)
 * 
 * CRITICAL CONSTRAINTS:
 * - ✅ ONLY numeric selection allowed (e.g., "1", "2", "3")
 * - ✅ ONLY yes/no confirmation allowed (e.g., "sì", "no", "ok")
 * - ❌ NO hardcoded phrase detection (if message.includes("ordine"))
 * - ❌ NO language-specific regex patterns (/mostra.*prodotti/)
 * - ❌ NO keyword arrays (["ordine", "order", "pedido"])
 * 
 * WHY: Users can switch context at ANY moment. TEXT input = reset state.
 * All phrase-based intent detection goes to Intent Parser (LLM-based).
 * 
 * See: .specify/memory/constitution.md → Principle XV
 */

import { Intent, ListType, ConversationContext } from "../intent.types"
import logger from "../../../utils/logger"

/**
 * Detect removal/deletion commands when viewing cart
 * e.g., "rimuovi", "cancella", "togli", "remove"
 */
export function matchRemovalIntent(
  message: string,
  context: ConversationContext
): Intent | null {
  const normalized = message.toLowerCase().trim()
  
  // Only match if user has stated a product name (text input, not numeric)
  const removalKeywords = ["rimuovi", "cancella", "togli", "remove", "elimina", "delete"]
  const hasRemovalKeyword = removalKeywords.some(keyword => normalized.includes(keyword))
  
  if (!hasRemovalKeyword) {
    return null
  }

  // Extract product name (everything after the keyword, except the keyword itself)
  let productName = normalized
  for (const keyword of removalKeywords) {
    if (normalized.includes(keyword)) {
      // Remove the keyword and get what's left
      const idx = normalized.indexOf(keyword)
      productName = (normalized.substring(0, idx) + normalized.substring(idx + keyword.length))
        .trim()
        .replace(/^(da|dal|dal|di|per|un|una|l|lo|la)\s+/i, "") // Remove prepositions
        .trim()
      break
    }
  }

  if (productName.length > 0) {
    logger.debug(
      `🎯 Pattern match: REMOVE_FROM_CART - "${message}" → product: "${productName}"`
    )

    return {
      type: "REMOVE_FROM_CART",
      productName: productName || undefined,
    }
  }

  return null
}

/**
 * Extract number from message and resolve against list context.
 * Only supports pure digits, e.g. "1".
 */
export function matchNumericSelection(
  message: string,
  context: ConversationContext
): Intent | null {
  const normalized = message.trim()

  const pureNumberMatch = normalized.match(/^(\d+)$/)
  if (!pureNumberMatch) {
    return null
  }

  const selectedNumber = parseInt(pureNumberMatch[1], 10)

  if (!context.lastListItems || context.lastListItems.length === 0) {
    logger.warn(
      `⚠️ Numeric selection "${selectedNumber}" but no list context available`
    )

    return {
      type: "SELECT_OPTION",
      number: selectedNumber,
      resolvedValue: `option_${selectedNumber}`,
      listType: (context.lastListType || "PRODUCTS") as ListType,
    }
  }

  const selectedItem = context.lastListItems.find(
    (item) => item.number === selectedNumber
  )

  if (!selectedItem) {
    logger.warn(
      `⚠️ Selection ${selectedNumber} not found in list (items: ${context.lastListItems
        .map((i) => i.number)
        .join(", ")})`
    )

    return {
      type: "SELECT_OPTION",
      number: selectedNumber,
      resolvedValue: `invalid_option_${selectedNumber}`,
      listType: (context.lastListType || "PRODUCTS") as ListType,
    }
  }

  logger.debug(
    `🎯 Pattern match: NUMERIC_SELECTION - "${message}" → ${selectedNumber} = "${selectedItem.value}"`
  )

  const normalizedLastListType =
    context.lastListType === "PRODUCT_DETAIL_ACTIONS"
      ? ("CATEGORIES" as ListType)
      : ((context.lastListType || "PRODUCTS") as ListType)

  return {
    type: "SELECT_OPTION",
    number: selectedNumber,
    resolvedValue: selectedItem.value,
    listType: normalizedLastListType,
  }
}

/**
 * Run all pattern matchers in priority order.
 *
 * Priority:
 * 1. Numeric selection (list menu)
 * 2. Removal commands (rimuovi, cancella, togli)
 */
export function matchAllPatterns(
  message: string,
  context: ConversationContext
): Intent | null {
  // STEP 1: Numeric selection (e.g., "1", "2", "3")
  const numericMatch = matchNumericSelection(message, context)
  if (numericMatch) {
    return numericMatch
  }

  // STEP 2: Removal/deletion commands (e.g., "rimuovi una mozzarella")
  const removalMatch = matchRemovalIntent(message, context)
  if (removalMatch) {
    return removalMatch
  }

  return null
}
