/**
 * History Parser - Extract list context from conversation history
 * 
 * Parses the last assistant message to understand what kind of list
 * was shown and what items it contained. This enables numeric selection
 * resolution without LLM.
 */

import { ListType, ListItem, ConversationContext } from "../intent.types"
import logger from "../../../utils/logger"

// =============================================================================
// LIST DETECTION PATTERNS
// =============================================================================

/**
 * Pattern to detect category lists: "1. CategoryName (N prodotti)"
 */
const CATEGORY_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^(]+?)\*?\*?\s*\((\d+)\s*(?:prodott[io]|items?|productos?|produtos?)\)/gim

/**
 * Pattern to detect product lists with prices: "1. ProductName - €XX.XX"
 */
const PRODUCT_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^-€]+?)\*?\*?\s*[-–]\s*€([\d.,]+)/gim

/**
 * Pattern to detect group lists: "1. GroupName (N)" or "1. GroupName (N items)"
 */
const GROUP_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^(]+?)\*?\*?\s*\((\d+)(?:\s*(?:items?|prodott[io]|productos?|produtos?))?\)/gim

/**
 * Pattern to detect order lists: "1. #CODE - DATE" or "1️⃣ #CODE"
 */
const ORDER_LIST_PATTERN = /^(?:\d+\.?|[1-9]️⃣)\s*#([A-Z0-9-]+)\s*[-–]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})?/gim

/**
 * Pattern to detect cart items: "1. ProductName × N" or "1. ProductName - €XX × N"
 */
const CART_LIST_PATTERN = /^(\d+)\.\s*\*?\*?([^×\-]+?)\*?\*?\s*(?:[-–]\s*€[\d.,]+\s*)?[×x]\s*(\d+)/gim

// =============================================================================
// LIST PARSING FUNCTIONS
// =============================================================================

/**
 * Parse category list from message
 */
function parseCategoryList(message: string): ListItem[] | null {
  const items: ListItem[] = []
  const regex = new RegExp(CATEGORY_LIST_PATTERN.source, "gim")
  
  let match
  while ((match = regex.exec(message)) !== null) {
    items.push({
      number: parseInt(match[1], 10),
      value: match[2].trim(),
      metadata: {
        count: parseInt(match[3], 10)
      }
    })
  }
  
  return items.length > 0 ? items : null
}

/**
 * Parse product list from message
 */
function parseProductList(message: string): ListItem[] | null {
  const items: ListItem[] = []
  const regex = new RegExp(PRODUCT_LIST_PATTERN.source, "gim")
  
  let match
  while ((match = regex.exec(message)) !== null) {
    items.push({
      number: parseInt(match[1], 10),
      value: match[2].trim(),
      metadata: {
        price: parseFloat(match[3].replace(",", "."))
      }
    })
  }
  
  return items.length > 0 ? items : null
}

/**
 * Parse group list from message
 */
function parseGroupList(message: string): ListItem[] | null {
  const items: ListItem[] = []
  const regex = new RegExp(GROUP_LIST_PATTERN.source, "gim")
  
  let match
  while ((match = regex.exec(message)) !== null) {
    // Skip if this looks like a category list (has "prodotti" etc.)
    const fullMatch = match[0].toLowerCase()
    if (fullMatch.includes("prodott") || fullMatch.includes("items") || fullMatch.includes("product")) {
      // This is a category list, not a group list - skip
      continue
    }
    
    items.push({
      number: parseInt(match[1], 10),
      value: match[2].trim(),
      metadata: {
        count: parseInt(match[3], 10)
      }
    })
  }
  
  return items.length > 0 ? items : null
}

/**
 * Parse order list from message
 */
function parseOrderList(message: string): ListItem[] | null {
  const items: ListItem[] = []
  const regex = new RegExp(ORDER_LIST_PATTERN.source, "gim")
  
  let match
  let number = 1
  while ((match = regex.exec(message)) !== null) {
    items.push({
      number: number++,
      value: match[1], // Order code without #
      metadata: {
        code: `#${match[1]}`
      }
    })
  }
  
  return items.length > 0 ? items : null
}

/**
 * Parse cart list from message
 */
function parseCartList(message: string): ListItem[] | null {
  const items: ListItem[] = []
  const regex = new RegExp(CART_LIST_PATTERN.source, "gim")
  
  let match
  while ((match = regex.exec(message)) !== null) {
    items.push({
      number: parseInt(match[1], 10),
      value: match[2].trim(),
      metadata: {
        count: parseInt(match[3], 10) // quantity
      }
    })
  }
  
  return items.length > 0 ? items : null
}

// =============================================================================
// MAIN PARSER
// =============================================================================

/**
 * Detect what type of list is in the message and extract items
 */
export function parseListFromMessage(message: string): { listType: ListType; items: ListItem[] } | null {
  if (!message) return null
  
  // Order of detection matters - more specific patterns first
  
  // 1. Cart items (has × quantity)
  const cartItems = parseCartList(message)
  if (cartItems && cartItems.length > 0) {
    logger.debug(`📋 Detected CART list with ${cartItems.length} items`)
    return { listType: "CART_ITEMS", items: cartItems }
  }
  
  // 2. Order list (has # codes)
  const orderItems = parseOrderList(message)
  if (orderItems && orderItems.length > 0) {
    logger.debug(`📋 Detected ORDER list with ${orderItems.length} items`)
    return { listType: "ORDERS", items: orderItems }
  }
  
  // 3. Category list (has "N prodotti")
  const categoryItems = parseCategoryList(message)
  if (categoryItems && categoryItems.length > 0) {
    logger.debug(`📋 Detected CATEGORY list with ${categoryItems.length} items`)
    return { listType: "CATEGORIES", items: categoryItems }
  }
  
  // 4. Product list (has € prices)
  const productItems = parseProductList(message)
  if (productItems && productItems.length > 0) {
    logger.debug(`📋 Detected PRODUCT list with ${productItems.length} items`)
    return { listType: "PRODUCTS", items: productItems }
  }
  
  // 5. Group list (has just count in parentheses)
  const groupItems = parseGroupList(message)
  if (groupItems && groupItems.length > 0) {
    logger.debug(`📋 Detected GROUP list with ${groupItems.length} items`)
    return { listType: "GROUPS", items: groupItems }
  }
  
  return null
}

/**
 * Build conversation context from history
 */
export function buildContextFromHistory(
  lastAssistantMessage?: string,
  previousContext?: Partial<ConversationContext>
): ConversationContext {
  const context: ConversationContext = {
    lastAssistantMessage,
    ...previousContext
  }
  
  if (lastAssistantMessage) {
    const listInfo = parseListFromMessage(lastAssistantMessage)
    if (listInfo) {
      context.lastListType = listInfo.listType
      context.lastListItems = listInfo.items
      
      logger.info(`📋 Context updated from history:`, {
        listType: listInfo.listType,
        itemCount: listInfo.items.length,
        firstItem: listInfo.items[0]?.value,
        lastItem: listInfo.items[listInfo.items.length - 1]?.value
      })
    }
  }
  
  return context
}

/**
 * Extract active category from context
 * Looks for patterns like "nella categoria X" or "category X"
 */
export function extractActiveCategory(message: string): string | null {
  // Italian patterns
  const itMatch = message.match(/(?:categoria|categor[ií]a)\s+['"]?([^'",:.\n]+)['"]?/i)
  if (itMatch) return itMatch[1].trim()
  
  // English patterns
  const enMatch = message.match(/(?:category)\s+['"]?([^'",:.\n]+)['"]?/i)
  if (enMatch) return enMatch[1].trim()
  
  // Header patterns like "**Formaggi** (7 prodotti)"
  const headerMatch = message.match(/^\*\*([^*]+)\*\*\s*\(/m)
  if (headerMatch) return headerMatch[1].trim()
  
  return null
}
