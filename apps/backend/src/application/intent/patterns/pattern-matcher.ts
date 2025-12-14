/**
 * Intent Patterns - Deterministic pattern matching
 *
 * Evaluated BEFORE any LLM call.
 *
 * CRITICAL: Avoid hardcoded multilingual patterns.
 * This module intentionally supports ONLY pure numeric selection for list choices.
 */

import { Intent, ListType, ConversationContext } from "../intent.types"
import logger from "../../../utils/logger"

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

  return {
    type: "SELECT_OPTION",
    number: selectedNumber,
    resolvedValue: selectedItem.value,
    listType: (context.lastListType || "PRODUCTS") as ListType,
  }
}

/**
 * Run all pattern matchers in priority order.
 *
 * Intentionally minimal: numeric list selection only.
 */
export function matchAllPatterns(
  message: string,
  context: ConversationContext
): Intent | null {
  return matchNumericSelection(message, context)
}
