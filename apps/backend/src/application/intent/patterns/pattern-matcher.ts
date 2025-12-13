/**
 * Intent Patterns - Deterministic pattern matching for common intents
 * 
 * These patterns are evaluated BEFORE any LLM call.
 * Order matters: more specific patterns should come first.
 */

import { Intent, ListType, ConversationContext, ListItem } from "../intent.types"
import logger from "../../../utils/logger"

// =============================================================================
// PATTERN DEFINITIONS
// =============================================================================

/**
 * Identity patterns - "chi sei?", "chi siete?", "who are you?"
 * Note: \s* before \?? allows for optional space before question mark
 */
const IDENTITY_PATTERNS = [
  // Italian
  /^chi\s+sei\s*\??$/i,
  /^chi\s+siete\s*\??$/i,
  /^tu\s+chi\s+sei\s*\??$/i,
  /^voi\s+chi\s+siete\s*\??$/i,
  /^cosa\s+sei\s*\??$/i,
  /^che\s+cosa\s+sei\s*\??$/i,
  
  // English
  /^who\s+are\s+you\s*\??$/i,
  /^what\s+are\s+you\s*\??$/i,
  
  // Spanish
  /^qui[eé]n\s+eres\s*\??$/i,
  /^qui[eé]nes\s+son\s*\??$/i,
  /^qu[eé]\s+eres\s*\??$/i,
  
  // Portuguese
  /^quem\s+[eé]\s+voc[eê]\s*\??$/i,
  /^quem\s+s[aã]o\s+voc[eê]s\s*\??$/i,
]

/**
 * Location patterns - "dove siete?", "indirizzo?", "where are you?"
 */
const LOCATION_PATTERNS = [
  // Italian
  /^dove\s+siete\s*\??$/i,
  /^dove\s+sei\s*\??$/i,
  /^dove\s+vi\s+trovate\s*\??$/i,
  /^dov['']?\s*[eè]\s+il\s+negozio\s*\??$/i,
  /^indirizzo\s*\??$/i,
  /^qual\s+[eè]\s+(il\s+vostro\s+)?indirizzo\s*\??$/i,
  /^come\s+(vi\s+)?raggiungo\s*\??$/i,
  /^come\s+arrivo\s*\??$/i,
  
  // English
  /^where\s+are\s+you\s*\??$/i,
  /^your\s+address\s*\??$/i,
  /^address\s*\??$/i,
  /^location\s*\??$/i,
  /^where\s+is\s+the\s+store\s*\??$/i,
  /^how\s+(do\s+I\s+)?reach\s+you\??$/i,
  
  // Spanish
  /^d[oó]nde\s+est[aá]n\??$/i,
  /^direcci[oó]n\??$/i,
  /^cu[aá]l\s+es\s+su\s+direcci[oó]n\??$/i,
  
  // Portuguese
  /^onde\s+(voc[eê]s\s+)?est[aã]o?\??$/i,
  /^endere[cç]o\??$/i,
]

/**
 * Human support patterns - "operatore", "parlare con umano"
 */
const HUMAN_SUPPORT_PATTERNS = [
  // Italian
  /^operatore$/i,
  /^umano$/i,
  /^persona\s+reale$/i,
  /^voglio\s+(parlare\s+con\s+)?(un\s+)?operatore$/i,
  /^passami\s+(un\s+)?operatore$/i,
  /^assistenza\s+umana$/i,
  
  // English
  /^human$/i,
  /^operator$/i,
  /^real\s+person$/i,
  /^speak\s+(to|with)\s+(a\s+)?human$/i,
  /^talk\s+to\s+(a\s+)?person$/i,
  
  // Spanish
  /^operador$/i,
  /^humano$/i,
  /^persona\s+real$/i,
  
  // Portuguese
  /^operador$/i,
  /^humano$/i,
  /^pessoa\s+real$/i,
]

/**
 * Categories/catalog patterns - "categorie", "prodotti", "catalogo"
 */
const CATEGORIES_PATTERNS = [
  // Italian
  /^(che\s+)?categorie(\s+(avete|hai|offrite|fornite))?\s*\??$/i,
  /^mostr(a|ami)\s+(le\s+)?categorie$/i,
  /^catalogo\s*\??$/i,
  /^(mostrami\s+il\s+)?catalogo\s*\??$/i,
  /^(che\s+)?prodotti(\s+(avete|hai|offrite|fornite|vendete))?\s*\??$/i,
  /^cosa\s+(avete|vendete|offrite|fornite)\s*\??$/i,
  /^che\s+cosa\s+(avete|vendete|offrite|fornite)\s*\??$/i,
  /^menu\s*\??$/i,
  
  // English
  /^(what\s+)?categories(\s+do\s+you\s+have)?\s*\??$/i,
  /^show\s+(me\s+)?(the\s+)?categories$/i,
  /^catalog(ue)?\s*\??$/i,
  /^(what\s+)?products(\s+do\s+you\s+(have|sell|offer))?\s*\??$/i,
  /^what\s+do\s+you\s+(have|sell|offer)\s*\??$/i,
  /^menu\s*\??$/i,
  
  // Spanish
  /^(qu[eé]\s+)?categor[ií]as(\s+tienen)?\s*\??$/i,
  /^cat[aá]logo\s*\??$/i,
  /^(qu[eé]\s+)?productos(\s+tienen)?\s*\??$/i,
  /^qu[eé]\s+venden\s*\??$/i,
  
  // Portuguese
  /^(quais?\s+)?categorias(\s+tem)?\s*\??$/i,
  /^cat[aá]logo\s*\??$/i,
  /^(quais?\s+)?produtos(\s+tem)?\s*\??$/i,
]

/**
 * Cart patterns - "carrello", "cart"
 */
const CART_PATTERNS = [
  // Italian
  /^carrello$/i,
  /^(mostrami\s+il\s+)?carrello$/i,
  /^vedi\s+carrello$/i,
  /^cosa\s+(c'è|ho)\s+(nel|in)\s+carrello\??$/i,
  
  // English
  /^cart$/i,
  /^(show\s+(me\s+)?(my\s+)?)?cart$/i,
  /^view\s+cart$/i,
  /^what('s|\s+is)\s+in\s+(my\s+)?cart\??$/i,
  
  // Spanish
  /^carrito$/i,
  /^(ver\s+)?(mi\s+)?carrito$/i,
  
  // Portuguese
  /^carrinho$/i,
  /^(ver\s+)?(meu\s+)?carrinho$/i,
]

/**
 * Orders patterns - "ordini", "orders"
 */
const ORDERS_PATTERNS = [
  // Italian
  /^ordini$/i,
  /^(i\s+)?miei\s+ordini$/i,
  /^(mostrami\s+)?gli\s+ordini$/i,
  /^storico\s+ordini$/i,
  
  // English
  /^orders$/i,
  /^my\s+orders$/i,
  /^order\s+history$/i,
  /^show\s+(me\s+)?(my\s+)?orders$/i,
  
  // Spanish
  /^(mis\s+)?pedidos$/i,
  /^historial\s+de\s+pedidos$/i,
  
  // Portuguese
  /^(meus\s+)?pedidos$/i,
  /^hist[oó]rico\s+de\s+pedidos$/i,
]

/**
 * Confirmation patterns - "sì", "ok", "va bene"
 */
const CONFIRM_PATTERNS = [
  // Italian
  /^s[iì]$/i,
  /^ok$/i,
  /^okay$/i,
  /^va\s+bene$/i,
  /^certo$/i,
  /^certamente$/i,
  /^perfetto$/i,
  /^d'accordo$/i,
  /^confermo$/i,
  /^esatto$/i,
  /^giusto$/i,
  
  // English
  /^yes$/i,
  /^yeah$/i,
  /^yep$/i,
  /^sure$/i,
  /^of\s+course$/i,
  /^absolutely$/i,
  /^confirm$/i,
  /^correct$/i,
  
  // Spanish
  /^s[ií]$/i,
  /^claro$/i,
  /^por\s+supuesto$/i,
  /^de\s+acuerdo$/i,
  
  // Portuguese
  /^sim$/i,
  /^claro$/i,
  /^com\s+certeza$/i,
]

/**
 * Rejection patterns - "no", "annulla"
 */
const REJECT_PATTERNS = [
  // Italian
  /^no$/i,
  /^annulla$/i,
  /^cancella$/i,
  /^non\s+voglio$/i,
  /^lascia\s+(stare|perdere)$/i,
  /^niente$/i,
  
  // English
  /^no$/i,
  /^nope$/i,
  /^cancel$/i,
  /^never\s*mind$/i,
  /^forget\s+it$/i,
  
  // Spanish
  /^no$/i,
  /^cancelar$/i,
  /^olvida(lo)?$/i,
  
  // Portuguese
  /^n[aã]o$/i,
  /^cancelar$/i,
  /^esquece$/i,
]

/**
 * Numeric selection pattern - "1", "2", "il primo", "the second"
 */
const NUMERIC_PATTERNS = [
  // Pure numbers
  /^(\d+)$/,
  
  // Italian ordinals
  /^(il\s+)?(primo|secondo|terzo|quarto|quinto|sesto|settimo|ottavo|nono|decimo)$/i,
  /^voglio\s+il\s+(\d+)$/i,
  /^prendo\s+il\s+(\d+)$/i,
  /^numero\s+(\d+)$/i,
  
  // English ordinals
  /^(the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)$/i,
  /^(I('ll)?\s+)?(want|take)\s+(the\s+)?(\d+)$/i,
  /^number\s+(\d+)$/i,
  
  // Spanish ordinals
  /^(el\s+)?(primero|segundo|tercero|cuarto|quinto)$/i,
  /^n[uú]mero\s+(\d+)$/i,
  
  // Portuguese ordinals
  /^(o\s+)?(primeiro|segundo|terceiro|quarto|quinto)$/i,
  /^n[uú]mero\s+(\d+)$/i,
]

/**
 * Ordinal to number mapping
 */
const ORDINAL_TO_NUMBER: Record<string, number> = {
  // Italian
  primo: 1, secondo: 2, terzo: 3, quarto: 4, quinto: 5,
  sesto: 6, settimo: 7, ottavo: 8, nono: 9, decimo: 10,
  
  // English
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  
  // Spanish
  primero: 1, tercero: 3,
  
  // Portuguese
  primeiro: 1, terceiro: 3,
}

// =============================================================================
// PATTERN MATCHING FUNCTIONS
// =============================================================================

/**
 * Check if message matches identity patterns
 */
export function matchIdentityPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of IDENTITY_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: IDENTITY - "${message}"`)
      return { type: "ASK_IDENTITY" }
    }
  }
  
  return null
}

/**
 * Check if message matches location patterns
 */
export function matchLocationPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of LOCATION_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: LOCATION - "${message}"`)
      return { type: "ASK_LOCATION" }
    }
  }
  
  return null
}

/**
 * Check if message matches human support patterns
 */
export function matchHumanSupportPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of HUMAN_SUPPORT_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: HUMAN_SUPPORT - "${message}"`)
      return { type: "REQUEST_HUMAN" }
    }
  }
  
  return null
}

/**
 * Check if message matches categories patterns
 */
export function matchCategoriesPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of CATEGORIES_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: CATEGORIES - "${message}"`)
      return { type: "SHOW_CATEGORIES" }
    }
  }
  
  return null
}

/**
 * Check if message matches cart patterns
 */
export function matchCartPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of CART_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: CART - "${message}"`)
      return { type: "VIEW_CART" }
    }
  }
  
  return null
}

/**
 * Check if message matches orders patterns
 */
export function matchOrdersPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of ORDERS_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: ORDERS - "${message}"`)
      return { type: "VIEW_ORDERS" }
    }
  }
  
  return null
}

/**
 * Check if message matches confirmation patterns
 */
export function matchConfirmPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of CONFIRM_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: CONFIRM - "${message}"`)
      return { type: "CONFIRM" }
    }
  }
  
  return null
}

/**
 * Check if message matches rejection patterns
 */
export function matchRejectPattern(message: string): Intent | null {
  const normalized = message.trim()
  
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(normalized)) {
      logger.debug(`🎯 Pattern match: REJECT - "${message}"`)
      return { type: "REJECT" }
    }
  }
  
  return null
}

/**
 * Extract number from message and resolve against list context
 */
export function matchNumericSelection(
  message: string, 
  context: ConversationContext
): Intent | null {
  const normalized = message.trim().toLowerCase()
  let selectedNumber: number | null = null
  
  // Try pure number first
  const pureNumberMatch = normalized.match(/^(\d+)$/)
  if (pureNumberMatch) {
    selectedNumber = parseInt(pureNumberMatch[1], 10)
  }
  
  // Try ordinal words
  if (!selectedNumber) {
    for (const [word, num] of Object.entries(ORDINAL_TO_NUMBER)) {
      if (normalized.includes(word)) {
        selectedNumber = num
        break
      }
    }
  }
  
  // Try "number N" patterns
  if (!selectedNumber) {
    const numberPatternMatch = normalized.match(/(?:numero|number|n[uú]mero)\s*(\d+)/i)
    if (numberPatternMatch) {
      selectedNumber = parseInt(numberPatternMatch[1], 10)
    }
  }
  
  // Try "want/take the N" patterns
  if (!selectedNumber) {
    const wantPatternMatch = normalized.match(/(?:voglio|prendo|want|take)\s+(?:il\s+|the\s+)?(\d+)/i)
    if (wantPatternMatch) {
      selectedNumber = parseInt(wantPatternMatch[1], 10)
    }
  }
  
  if (selectedNumber === null) {
    return null
  }
  
  // We have a number - try to resolve it against the context
  if (!context.lastListItems || context.lastListItems.length === 0) {
    logger.warn(`⚠️ Numeric selection "${selectedNumber}" but no list context available`)
    // Still return the intent, let the orchestrator handle missing context
    return {
      type: "SELECT_OPTION",
      number: selectedNumber,
      resolvedValue: `option_${selectedNumber}`, // Placeholder
      listType: context.lastListType || "PRODUCTS"
    }
  }
  
  // Find the item in the list
  const selectedItem = context.lastListItems.find(item => item.number === selectedNumber)
  
  if (!selectedItem) {
    logger.warn(`⚠️ Selection ${selectedNumber} not found in list (items: ${context.lastListItems.map(i => i.number).join(', ')})`)
    return {
      type: "SELECT_OPTION",
      number: selectedNumber,
      resolvedValue: `invalid_option_${selectedNumber}`,
      listType: context.lastListType || "PRODUCTS"
    }
  }
  
  logger.debug(`🎯 Pattern match: NUMERIC_SELECTION - "${message}" → ${selectedNumber} = "${selectedItem.value}"`)
  
  return {
    type: "SELECT_OPTION",
    number: selectedNumber,
    resolvedValue: selectedItem.value,
    listType: context.lastListType || "PRODUCTS"
  }
}

/**
 * Run all pattern matchers in priority order
 * 
 * CRITICAL: NO HARDCODED LANGUAGE PATTERNS!
 * This function should ONLY match:
 * - Pure numbers for list selection (handled by MessagePreprocessor, but kept for backwards compat)
 * 
 * ALL other intent detection is done by the LLM Router which:
 * - Understands ANY language
 * - Has conversation history context
 * - Can semantically match user intent
 */
export function matchAllPatterns(message: string, context: ConversationContext): Intent | null {
  // ONLY match pure numeric selection - everything else goes to LLM
  // Note: This is also handled by MessagePreprocessor, but kept for backwards compatibility
  const numeric = matchNumericSelection(message, context)
  if (numeric) return numeric
  
  // NO OTHER PATTERNS! Let the LLM decide the intent.
  // The LLM can understand:
  // - "mostra carrello" (IT) → VIEW_CART
  // - "show my cart" (EN) → VIEW_CART  
  // - "muéstrame el carrito" (ES) → VIEW_CART
  // - "mostrar carrinho" (PT) → VIEW_CART
  // - etc.
  
  return null
}
