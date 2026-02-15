/**
 * SystemContextService
 * 
 * Manages the hidden System message context that LLM sees but customer doesn't.
 * 
 * PURPOSE:
 * - Store SKU mappings for list selections (1, 2, 3...)
 * - Store groupings created by LLM
 * - Store cart summary for dialogue context
 * - Store active offers and customer discount
 * 
 * PATTERN:
 * - Customer sees: "1. Stagionati (4) 2. Freschi (3)"
 * - System has: { grouping: [{index:1, skus:[...]}, {index:2, skus:[...]}] }
 * - When user says "2", LLM knows exactly which SKUs to show
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../utils/logger"

// ================================================================================
// TYPES
// ================================================================================

export interface ListItem {
  index: number
  label: string          // What customer sees: "Stagionati (4 prodotti)"
  sku?: string           // Single product SKU (for product lists)
  skus?: string[]        // Multiple SKUs (for groupings)
  type: "product" | "category" | "grouping" | "order"
}

export interface CartSummary {
  itemCount: number      // Number of distinct items
  totalQuantity: number  // Total quantity of all items
  skus: string[]         // SKUs in cart
  totalValue: string     // Formatted total: "€85.50"
}

export interface SystemContext {
  /** Current list being shown to customer */
  currentList?: {
    type: "products" | "categories" | "groupings" | "orders"
    items: ListItem[]
  }

  /** Cart summary for dialogue context */
  cartSummary?: CartSummary

  /** Customer's personal discount percentage */
  customerDiscount?: number

  /** Active offers for this workspace */
  activeOffers?: Array<{
    name: string
    discount: number
    applicableSkus?: string[]
  }>

  /** Last action context (for confirmations) */
  pendingAction?: {
    type: "ADD_TO_CART" | "CONFIRM_ORDER" | "CLEAR_CART"
    sku?: string
    productName?: string
    quantity?: number
  }
}

// ================================================================================
// IN-MEMORY CACHE (per conversation)
// ================================================================================

// Cache key: `${workspaceId}:${customerId}`
const contextCache = new Map<string, SystemContext>()

// Cache TTL: 30 minutes (conversation timeout)
const CACHE_TTL = 30 * 60 * 1000

// Track last access for cleanup
const lastAccess = new Map<string, number>()

// ================================================================================
// SERVICE
// ================================================================================

export class SystemContextService {
  constructor(private prisma: PrismaClient) { }

  /**
   * Get cache key for workspace + customer
   */
  private getCacheKey(workspaceId: string, customerId: string): string {
    return `${workspaceId}:${customerId}`
  }

  /**
   * Get current system context for a conversation
   */
  async getContext(workspaceId: string, customerId: string): Promise<SystemContext> {
    const key = this.getCacheKey(workspaceId, customerId)
    lastAccess.set(key, Date.now())

    // Return cached if exists
    if (contextCache.has(key)) {
      return contextCache.get(key)!
    }

    // Initialize new context
    const context: SystemContext = {}

    // Load cart summary from DB
    context.cartSummary = await this.loadCartSummary(workspaceId, customerId)

    // Load customer discount
    context.customerDiscount = await this.loadCustomerDiscount(workspaceId, customerId)

    // Load active offers
    context.activeOffers = await this.loadActiveOffers(workspaceId)

    contextCache.set(key, context)
    return context
  }

  /**
   * Update context with new list (for selection tracking)
   */
  async setCurrentList(
    workspaceId: string,
    customerId: string,
    list: SystemContext["currentList"]
  ): Promise<void> {
    const context = await this.getContext(workspaceId, customerId)
    context.currentList = list

    const key = this.getCacheKey(workspaceId, customerId)
    contextCache.set(key, context)

    logger.info("📋 [SystemContext] List updated", {
      workspaceId,
      customerId,
      listType: list?.type,
      itemCount: list?.items.length,
    })
  }

  /**
   * Set pending action (for confirmations like "Vuoi aggiungerlo?")
   */
  async setPendingAction(
    workspaceId: string,
    customerId: string,
    action: SystemContext["pendingAction"]
  ): Promise<void> {
    const context = await this.getContext(workspaceId, customerId)
    context.pendingAction = action

    const key = this.getCacheKey(workspaceId, customerId)
    contextCache.set(key, context)

    logger.info("⏳ [SystemContext] Pending action set", {
      workspaceId,
      customerId,
      actionType: action?.type,
      sku: action?.sku,
    })
  }

  /**
   * Clear pending action after it's processed
   */
  async clearPendingAction(workspaceId: string, customerId: string): Promise<void> {
    const context = await this.getContext(workspaceId, customerId)
    context.pendingAction = undefined

    const key = this.getCacheKey(workspaceId, customerId)
    contextCache.set(key, context)
  }

  /**
   * Refresh cart summary from DB
   */
  async refreshCartSummary(workspaceId: string, customerId: string): Promise<void> {
    const context = await this.getContext(workspaceId, customerId)
    context.cartSummary = await this.loadCartSummary(workspaceId, customerId)

    const key = this.getCacheKey(workspaceId, customerId)
    contextCache.set(key, context)
  }

  /**
   * Format context as JSON string for System message
   */
  async formatForSystemMessage(workspaceId: string, customerId: string): Promise<string> {
    const context = await this.getContext(workspaceId, customerId)

    // Only include non-empty fields
    const systemData: Record<string, unknown> = {}

    if (context.currentList?.items.length) {
      systemData.currentList = context.currentList
    }

    if (context.cartSummary && context.cartSummary.itemCount > 0) {
      systemData.cart = context.cartSummary
    }

    if (context.customerDiscount && context.customerDiscount > 0) {
      systemData.customerDiscount = `${context.customerDiscount}%`
    }

    if (context.activeOffers?.length) {
      systemData.activeOffers = context.activeOffers
    }

    if (context.pendingAction) {
      systemData.pendingAction = context.pendingAction
    }

    if (Object.keys(systemData).length === 0) {
      return ""
    }

    return `
---
CONTEXT (use this to understand user selections and cart state):
${JSON.stringify(systemData, null, 2)}
---`
  }

  /**
   * Resolve selection number to SKU(s)
   * Returns null if selection not found
   */
  async resolveSelection(
    workspaceId: string,
    customerId: string,
    selectionIndex: number
  ): Promise<{ type: string; sku?: string; skus?: string[]; label: string } | null> {
    const context = await this.getContext(workspaceId, customerId)

    if (!context.currentList?.items.length) {
      return null
    }

    const item = context.currentList.items.find(i => i.index === selectionIndex)
    if (!item) {
      return null
    }

    return {
      type: item.type,
      sku: item.sku,
      skus: item.skus,
      label: item.label,
    }
  }

  // ================================================================================
  // PRIVATE: DB LOADERS
  // ================================================================================

  private async loadCartSummary(workspaceId: string, customerId: string): Promise<CartSummary> {
    try {
      const cartItems = await this.prisma.cartItems.findMany({
        where: {
          cart: {
            customerId,
            workspaceId,
          },
        },
        include: {
          product: {
            select: {
              sku: true,
              price: true,
            },
          },
        },
      })

      if (cartItems.length === 0) {
        return {
          itemCount: 0,
          totalQuantity: 0,
          skus: [],
          totalValue: "€0.00",
        }
      }

      const totalQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0)
      const totalValue = cartItems.reduce((sum, item) => {
        const price = item.product?.price || 0
        return sum + (Number(price) * item.quantity)
      }, 0)

      return {
        itemCount: cartItems.length,
        totalQuantity,
        skus: cartItems.map(item => item.product?.sku).filter(Boolean) as string[],
        totalValue: `€${totalValue.toFixed(2)}`,
      }
    } catch (error) {
      logger.error("❌ [SystemContext] Failed to load cart summary", { error })
      return {
        itemCount: 0,
        totalQuantity: 0,
        skus: [],
        totalValue: "€0.00",
      }
    }
  }

  private async loadCustomerDiscount(workspaceId: string, customerId: string): Promise<number> {
    try {
      const customer = await this.prisma.customers.findFirst({
        where: { id: customerId, workspaceId },
        select: { discount: true },
      })
      return customer?.discount || 0
    } catch (error) {
      logger.error("❌ [SystemContext] Failed to load customer discount", { error })
      return 0
    }
  }

  private async loadActiveOffers(workspaceId: string): Promise<SystemContext["activeOffers"]> {
    try {
      const now = new Date()
      const offers = await this.prisma.offers.findMany({
        where: {
          workspaceId,
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: {
          name: true,
          discountPercent: true,
        },
        take: 5, // Limit to avoid token overload
      })

      return offers.map(o => ({
        name: o.name,
        discount: o.discountPercent || 0,
      }))
    } catch (error) {
      logger.error("❌ [SystemContext] Failed to load offers", { error })
      return []
    }
  }

  // ================================================================================
  // CLEANUP
  // ================================================================================

  /**
   * Clean up expired contexts (call periodically)
   */
  static cleanup(): void {
    const now = Date.now()
    for (const [key, time] of lastAccess.entries()) {
      if (now - time > CACHE_TTL) {
        contextCache.delete(key)
        lastAccess.delete(key)
      }
    }
  }
}

// Cleanup every 5 minutes
const cleanupInterval = setInterval(
  () => SystemContextService.cleanup(),
  5 * 60 * 1000
)
cleanupInterval.unref?.()

// ================================================================================
// SINGLETON
// ================================================================================

let instance: SystemContextService | null = null

export function getSystemContextService(prisma: PrismaClient): SystemContextService {
  if (!instance) {
    instance = new SystemContextService(prisma)
  }
  return instance
}
