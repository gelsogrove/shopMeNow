/**
 * OptionsMappingService
 *
 * Manages lastOptionsMapping for FAST-PATH numeric selection handling.
 *
 * CRITICAL FOR: "Codice decide, LLM formatta" principle
 * - Saves numbered list options from assistant responses
 * - Loads mapping for next user message
 * - Enables deterministic resolution: "5" → "Formaggi"
 *
 * Used by CodeFirstLLMService to:
 * 1. Load mapping before processing
 * 2. Save mapping after response
 *
 * @see docs/regole_di_prompts.md - FAST-PATH section
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"

/**
 * Structure for numbered list options
 */
export interface OptionItem {
  number: number
  label: string
  count?: number // e.g., "Formaggi (7 prodotti)" → count: 7
  skus?: string[] // e.g., "Condimenti Freschi [SKUS:COND-003,COND-004,COND-005]" → skus: ["COND-003", "COND-004", "COND-005"]
}

/**
 * Type of list displayed to user
 * Using UPPERCASE to match intent.types.ts ListType
 */
export type ListType = "CATEGORIES" | "GROUPS" | "PRODUCTS" | "ORDERS" | "CART_ITEMS" | "SERVICES" | "binary" | "unknown"

/**
 * Pending action after user confirmation (sì/no)
 */
export interface PendingAction {
  type: "ADD_TO_CART" | "VIEW_CART" | "CONFIRM_ORDER" | "REPEAT_ORDER" | "CANCEL_ORDER"
  productId?: string
  productName?: string
  quantity?: number
  orderId?: string
}

/**
 * Options mapping stored in searchConversations.metadata.lastOptionsMapping
 */
export interface OptionsMapping {
  type: "numbered" | "binary"
  options?: OptionItem[]
  listType?: ListType
  pendingAction?: PendingAction // 🆕 Action awaiting confirmation
  // 🆕 For smart grouping: mapping of group number -> product SKUs
  // Created by LLM when grouping products, used to resolve "1" -> products in group 1
  groupMapping?: Record<string, { nome: string; skus: string[] }>
}

export class OptionsMappingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Load lastOptionsMapping from database for a conversation
   */
  async loadMapping(
    workspaceId: string,
    conversationId: string
  ): Promise<OptionsMapping | null> {
    try {
      logger.info("📋📥📥📥 [OptionsMapping] LOADING from DB", {
        conversationId,
        conversationIdLength: conversationId?.length,
        workspaceId: workspaceId.substring(0, 8) + "...",
      })
      
      const searchConv = await this.prisma.searchConversations.findUnique({
        where: { sessionId: conversationId },
      })
      
      logger.info("📋📥📥📥 [OptionsMapping] DB result", {
        conversationId,
        found: !!searchConv,
        searchConvId: searchConv?.id?.substring(0, 8),
        hasMetadata: !!searchConv?.metadata,
        metadataKeys: searchConv?.metadata ? Object.keys(searchConv.metadata as any) : [],
      })

      const mapping = (searchConv?.metadata as any)?.lastOptionsMapping || null

      logger.debug("📋 [OptionsMapping] Loaded mapping", {
        conversationId,
        hasMapping: !!mapping,
        listType: mapping?.listType,
        optionsCount: mapping?.options?.length,
      })

      return mapping
    } catch (error) {
      logger.error("❌ [OptionsMapping] Failed to load mapping", {
        conversationId,
        error,
      })
      return null
    }
  }

  /**
   * Save lastOptionsMapping to database after assistant response
   */
  async saveMapping(options: {
    workspaceId: string
    conversationId: string
    customerId: string
    responseText: string
    forceClear?: boolean
    // 🆕 For smart grouping: LLM-generated mapping of group number -> SKUs
    groupMapping?: Record<string, { nome: string; skus: string[] }>
  }): Promise<void> {
    const { workspaceId, conversationId, customerId, responseText, forceClear, groupMapping } = options

    try {
      let mapping = forceClear ? null : this.extractFromResponse(responseText)

      // 🆕 If we have a groupMapping from LLM, add it to the mapping
      if (groupMapping && mapping) {
        mapping.groupMapping = groupMapping
        mapping.listType = "GROUPS" // Mark as smart grouping
        logger.info("📋 [OptionsMapping] Adding LLM groupMapping to options", {
          conversationId,
          groupCount: Object.keys(groupMapping).length,
          totalSkus: Object.values(groupMapping).reduce((sum, g) => sum + (g.skus?.length || 0), 0),
        })
      }

      // 🔧 FIX: Don't overwrite existing mapping with null
      // Only update if we have a new list OR if explicitly clearing
      if (!mapping && !forceClear) {
        logger.debug("📋 [OptionsMapping] No new list found, keeping existing mapping", {
          conversationId,
          responseTextPreview: responseText.substring(0, 100),
        })
        return // Don't overwrite existing mapping with null
      }

      logger.info("📋💾💾💾 [OptionsMapping] SAVING mapping to DB", {
        conversationId,
        conversationIdLength: conversationId?.length,
        customerId,
        workspaceId: workspaceId.substring(0, 8) + "...",
        extracted: mapping
          ? { type: mapping.type, listType: mapping.listType, count: mapping.options?.length }
          : null,
        responseTextPreview: responseText.substring(0, 100),
        isForceClear: forceClear,
      })

      const existing = await this.prisma.searchConversations.findUnique({
        where: { sessionId: conversationId },
      })

      const currentMetadata = (existing?.metadata as any) || {}
      const updatedMetadata = {
        ...currentMetadata,
        lastOptionsMapping: mapping,
      }

      await this.prisma.searchConversations.upsert({
        where: { sessionId: conversationId },
        create: {
          sessionId: conversationId,
          workspaceId,
          customerId,
          metadata: updatedMetadata,
          activeAgent: null,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
        } as any,
        update: {
          metadata: updatedMetadata,
        } as any,
      })

      logger.debug("✅ [OptionsMapping] Mapping saved successfully")
    } catch (error) {
      logger.error("❌ [OptionsMapping] Failed to save mapping", {
        conversationId,
        error,
      })
      // Don't throw - mapping failure shouldn't break chat
    }
  }

  /**
   * Set a pending action awaiting user confirmation (sì/no)
   * Called when showing product detail with "Vuoi aggiungerlo al carrello?"
   * 
   * NOTE: This ADDS pendingAction to existing mapping, does NOT replace type/listType
   */
  async setPendingAction(options: {
    workspaceId: string
    conversationId: string
    pendingAction: PendingAction
  }): Promise<void> {
    const { workspaceId, conversationId, pendingAction } = options

    try {
      logger.info("🛒 [OptionsMapping] Setting pending action", {
        conversationId,
        actionType: pendingAction.type,
        productId: pendingAction.productId,
        productName: pendingAction.productName,
      })

      const existing = await this.prisma.searchConversations.findUnique({
        where: { sessionId: conversationId },
      })

      const currentMetadata = (existing?.metadata as any) || {}
      const currentMapping = currentMetadata.lastOptionsMapping || {}

      // 🔧 FIX: Only ADD pendingAction, keep existing type/listType/options
      const updatedMetadata = {
        ...currentMetadata,
        lastOptionsMapping: {
          ...currentMapping,
          pendingAction, // Just add/update the pending action
        },
      }

      await this.prisma.searchConversations.upsert({
        where: { sessionId: conversationId },
        create: {
          sessionId: conversationId,
          workspaceId,
          customerId: existing?.customerId || "unknown",
          metadata: updatedMetadata,
          activeAgent: null,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        } as any,
        update: {
          metadata: updatedMetadata,
        } as any,
      })

      logger.debug("✅ [OptionsMapping] Pending action set successfully")
    } catch (error) {
      logger.error("❌ [OptionsMapping] Failed to set pending action", {
        conversationId,
        error,
      })
    }
  }

  /**
   * Clear pending action after it's been processed
   */
  async clearPendingAction(conversationId: string): Promise<void> {
    try {
      const existing = await this.prisma.searchConversations.findUnique({
        where: { sessionId: conversationId },
      })

      if (!existing) return

      const currentMetadata = (existing.metadata as any) || {}
      const currentMapping = currentMetadata.lastOptionsMapping || {}

      // Remove pendingAction but keep the rest
      const { pendingAction, ...restMapping } = currentMapping

      const updatedMetadata = {
        ...currentMetadata,
        lastOptionsMapping: Object.keys(restMapping).length > 0 ? restMapping : null,
      }

      await this.prisma.searchConversations.update({
        where: { sessionId: conversationId },
        data: { metadata: updatedMetadata } as any,
      })

      logger.debug("✅ [OptionsMapping] Pending action cleared")
    } catch (error) {
      logger.error("❌ [OptionsMapping] Failed to clear pending action", {
        conversationId,
        error,
      })
    }
  }

  /**
   * Extract numbered list or yes/no pattern from assistant response
   *
   * Detects patterns like:
   * 1. Bevande (4 prodotti)
   * 2. Condimenti (6 prodotti)
   * ...
   * 
   * Also extracts SKU codes from patterns like:
   * 1. Condimenti Freschi (3 prodotti) [SKUS:COND-003,COND-004,COND-005]
   *
   * Or binary yes/no prompts
   */
  extractFromResponse(responseText: string): OptionsMapping | null {
    if (!responseText) return null

    const lines = responseText.split(/\r?\n/)
    const options: OptionItem[] = []

    for (const line of lines) {
      // Match: "1. Label" or "1) Label"
      const match = line.match(/^\s*(\d+)[\.|\)]\s*(.+)$/)
      if (match) {
        const number = parseInt(match[1], 10)
        let label = match[2].trim()

        if (!Number.isNaN(number) && label) {
          // Extract SKUs if present: "[SKUS:COND-003,COND-004,COND-005]"
          let skus: string[] | undefined
          const skusMatch = label.match(/\[SKUS?:([A-Z0-9-,]+)\]/i)
          if (skusMatch) {
            skus = skusMatch[1].split(',').map(s => s.trim())
            // Remove SKU tag from label for cleaner display
            label = label.replace(/\s*\[SKUS?:[A-Z0-9-,]+\]/gi, '').trim()
            logger.debug("📋 [OptionsMapping] Extracted SKUs from label", {
              number,
              skus,
              cleanLabel: label.substring(0, 30),
            })
          }
          
          // Extract count if present: "(7 prodotti)" or "(4 items)"
          const countMatch = label.match(/\((\d+)\s*(prodotti|items|servizi)\)/i)
          const count = countMatch ? parseInt(countMatch[1], 10) : undefined

          options.push({ number, label, count, skus })
        }
      }
    }

    // Need at least 2 options to be a list
    if (options.length >= 2) {
      const listType = this.detectListType(responseText, options)

      logger.debug("📋 [OptionsMapping] Extracted numbered list", {
        optionsCount: options.length,
        listType,
        firstThree: options.slice(0, 3).map((o) => ({ 
          label: o.label.substring(0, 30),
          skus: o.skus
        })),
      })

      return {
        type: "numbered",
        options: options.slice(0, 30), // Limit to 30 options
        listType,
      }
    }

    // Check for binary yes/no prompt
    const lower = responseText.toLowerCase()
    const hasYesNoPrompt =
      /vuoi|confermi|procedo|aggiungo|desideri/i.test(lower) ||
      /\?\s*$/m.test(responseText)

    if (hasYesNoPrompt && /\b(sì|si|no|ok)\b/i.test(lower)) {
      return {
        type: "binary",
        options: [
          { number: 1, label: "sì" },
          { number: 2, label: "no" },
        ],
        listType: "binary",
      }
    }

    return null
  }

  /**
   * Detect what type of list was displayed
   * Returns UPPERCASE ListType to match intent.types.ts
   */
  private detectListType(responseText: string, options: OptionItem[]): ListType {
    const lower = responseText.toLowerCase()

    // Check for price indicators → products
    const hasPrice = /€|euro/i.test(responseText)
    if (hasPrice) {
      return "PRODUCTS"
    }

    // Check for group indicators FIRST (more specific than category)
    // Groups are sub-divisions created by LLM within a category
    // Multilingual: "gruppi", "groups", "grupos", "sub-groups", etc.
    const hasGroupCue = /grupp[oi]|groups?|sub-?categor|sottocategor|grupos/i.test(lower)
    if (hasGroupCue) {
      return "GROUPS"
    }

    // Check for category indicators
    // Multilingual: "categorie", "categories", "categorías", "catalog", etc.
    const hasCategoryCue =
      /categori[ae]s?|catalogo?|disponibil|catalog/i.test(lower) ||
      (options.some((o) => /\(\d+\s*(prodotti|items|productos|products)\)/i.test(o.label)) &&
       !hasGroupCue) // Only category if NOT groups

    if (hasCategoryCue) {
      return "CATEGORIES"
    }

    // Check for order indicators
    const hasOrderCue = /ordin[ei]|#[A-Z0-9]/i.test(lower)
    if (hasOrderCue) {
      return "ORDERS"
    }

    // Check for cart indicators
    const hasCartCue = /carrello|cart/i.test(lower)
    if (hasCartCue) {
      return "CART_ITEMS"
    }

    return "unknown"
  }
  /**
   * Clean a label by removing:
   * - Count suffix: "(7 prodotti)"
   * - Price suffix: "- €12.50"
   * - SKU codes: "(FROZ-CAR-001)"
   * - Category tags: "[Surgelati]"
   * - Emojis
   * 
   * Examples:
   * "Formaggi (7 prodotti)" → "Formaggi"
   * "Condimenti (6 prodotti) 🥫" → "Condimenti"
   * "Mozzarella (FORM-001) - €12.50 [Formaggi]" → "Mozzarella"
   * "Carciofi alla Romana Surgelati (FROZ-CAR-001) - €8.50 [Surgelati]" → "Carciofi alla Romana Surgelati"
   */
  static cleanLabel(label: string): string {
    return label
      .replace(/\s*\(\d+\s*(prodotti|items|servizi)?\)\s*/gi, " ") // (7 prodotti)
      .replace(/\s*-\s*€[\d.,]+.*$/i, "") // - €12.50 [...]
      .replace(/\s*\([A-Z0-9-]+\)\s*$/i, "") // (FROZ-CAR-001) at end
      .replace(/\s*\([A-Z]{2,}-[A-Z0-9-]+\)/gi, "") // (SKU-CODE) anywhere
      .replace(/\s*\[[^\]]+\]\s*$/i, "") // [Surgelati] category
      .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, "") // Remove emojis
      .trim()
  }
}

// ================================================================================
// SINGLETON
// ================================================================================

let instance: OptionsMappingService | null = null

export function getOptionsMappingService(prisma: PrismaClient): OptionsMappingService {
  if (!instance) {
    instance = new OptionsMappingService(prisma)
  }
  return instance
}
