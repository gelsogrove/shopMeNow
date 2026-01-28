/**
 * OrderOptimizationService
 *
 * Service for calculating transport costs and optimization suggestions for cart items.
 * Used by the "Ottimizzazione dell'ordine" feature (menu option 5).
 *
 * Key responsibilities:
 * 1. Calculate transport costs based on cart items
 * 2. Group items by transport type
 * 3. Calculate "spalmatura" (cost allocation per item)
 * 4. Check if transport prices are configured
 *
 * @architecture Clean Architecture - Application Service
 * @feature optimize-transport (specs/optimize-transport/)
 */

import { PrismaClient } from "@echatbot/database"
import { TypeRepository } from "../../repositories/type.repository"
import { CartRepository } from "../../repositories/cart.repository"
import logger from "../../utils/logger"

// ============================================================================
// TYPES
// ============================================================================

export interface TransportBreakdown {
  typeId: string
  typeName: string
  transportPrice: number       // Costo fisso per questo tipo di trasporto
  productCount: number         // Quanti prodotti usano questo trasporto
  totalQuantity: number        // Quantità totale di prodotti
  products: CartProductSummary[]
  subtotal: number             // Costo prodotti con questo trasporto
}

export interface CartProductSummary {
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  lineTotal: number
  typeName: string
}

export interface TransportAnalysis {
  workspaceId: string
  cartId: string
  timestamp: Date

  // Transport breakdown
  transports: TransportBreakdown[]

  // Summary (all values are rounded integers)
  totalUnits: number             // Total quantity of items
  totalProductsCost: number      // Subtotal products (gross, IVA included)
  totalTransportCost: number     // Selected transport cost applied to order
  grandTotal: number             // totalProductsCost + totalTransportCost
  shippingCostPerUnit: number    // Average shipping per unit
  selectedTypeId: string | null
  selectedTypeName: string | null

  // IVA breakdown (22%)
  ivaAmount: number              // IVA included in grandTotal
  netTotal: number               // grandTotal - ivaAmount

  // Allocation per item (shipping cost "spalmato")
  allocationByItem: Array<{
    productId: string
    productName: string
    quantity: number
    productTotal: number
    shippingAllocated: number
    lineGrandTotal: number
  }>

  // Status
  isConfigured: boolean          // true if transport prices are configured
  isEmpty: boolean               // true if cart is empty
}

// ============================================================================
// SERVICE
// ============================================================================

export class OrderOptimizationService {
  private prisma: PrismaClient
  private typeRepo: TypeRepository
  private cartRepo: CartRepository

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.typeRepo = new TypeRepository(prisma)
    this.cartRepo = new CartRepository()
  }

  /**
   * Check if workspace has transport prices configured
   * @param workspaceId Workspace ID
   * @returns true if at least one transport type has price > 0
   */
  async hasTransportPricesConfigured(workspaceId: string): Promise<boolean> {
    return this.typeRepo.hasConfiguredPrices(workspaceId)
  }

  /**
   * Analyze cart transport costs and generate breakdown
   * All prices are GROSS (IVA 22% included) and ROUNDED to integers
   *
   * @param workspaceId Workspace ID
   * @param customerId Customer ID
   * @returns Complete transport analysis
   */
  async analyzeCart(
    workspaceId: string,
    customerId: string
  ): Promise<TransportAnalysis> {
    const timestamp = new Date()

    logger.info("🚚 OrderOptimizationService.analyzeCart", {
      workspaceId,
      customerId,
    })

    // 1. Check if transport prices are configured
    const isConfigured = await this.hasTransportPricesConfigured(workspaceId)
    if (!isConfigured) {
      logger.warn("⚠️ Transport prices not configured", { workspaceId })
      return this.createEmptyAnalysis(workspaceId, "", timestamp, false)
    }

    // 2. Get cart with items
    const cart = await this.cartRepo.getOrCreateCart(workspaceId, customerId)
    if (!cart.items || cart.items.length === 0) {
      return this.createEmptyAnalysis(workspaceId, cart.id, timestamp, true)
    }

    // 3. Get transport types with prices
    const types = await this.typeRepo.findActiveWithPrices(workspaceId)
    const transportMap = new Map(types.map(t => [t.id, t]))

    // 4. Get product transport types (many-to-many relation)
    const productIds = cart.items
      .filter(item => item.productId)
      .map(item => item.productId!)

    const productTypes = await this.prisma.productType.findMany({
      where: { productId: { in: productIds } },
      include: { type: true },
    })

    // Map: productId -> type
    const productToTransport = new Map<string, { id: string; name: string; price: number }>()
    for (const ptt of productTypes) {
      // If product has multiple transports, use the first one (primary)
      if (!productToTransport.has(ptt.productId)) {
        productToTransport.set(ptt.productId, {
          id: ptt.type.id,
          name: ptt.type.name,
          price: Number(ptt.type.price),
        })
      }
    }

    // 5. Group cart items by transport type
    const transportGroups = new Map<string, TransportBreakdown>()
    let totalUnits = 0
    let totalProductsCost = 0

    for (const item of cart.items) {
      if (!item.product) continue

      const quantity = item.quantity || 1
      const unitPrice = item.product.price || 0
      const lineTotal = unitPrice * quantity

      totalUnits += quantity
      totalProductsCost += lineTotal

      // Get transport for this product
      const transport = productToTransport.get(item.productId!)
      if (!transport) {
        // Fallback: use "Ambient Temperature" or first available
        const defaultTransport = types[0]
        if (defaultTransport) {
          productToTransport.set(item.productId!, {
            id: defaultTransport.id,
            name: defaultTransport.name,
            price: defaultTransport.price,
          })
        }
      }

      const productTransport = productToTransport.get(item.productId!) || {
        id: "unknown",
        name: "Unknown",
        price: 0,
      }

      // Add to transport group
      if (!transportGroups.has(productTransport.id)) {
        transportGroups.set(productTransport.id, {
          typeId: productTransport.id,
          typeName: productTransport.name,
          transportPrice: productTransport.price,
          productCount: 0,
          totalQuantity: 0,
          products: [],
          subtotal: 0,
        })
      }

      const group = transportGroups.get(productTransport.id)!
      group.productCount++
      group.totalQuantity += quantity
      group.subtotal += lineTotal
      group.products.push({
        productId: item.productId!,
        productName: item.product.name,
        quantity,
        unitPrice,
        lineTotal,
        typeName: productTransport.name,
      })
    }

    // 6. Calculate transport costs (select the strictest requirement)
    const transports = Array.from(transportGroups.values())
    const selectedTransport = transports.reduce<TransportBreakdown | null>(
      (prev, current) => {
        if (!prev) return current
        return current.transportPrice > prev.transportPrice ? current : prev
      },
      null
    )

    const selectedTransportCost = selectedTransport?.transportPrice ?? 0
    const totalTransportCost = Math.round(selectedTransportCost * 100) / 100

    // 7. Calculate totals (keep two decimals)
    const roundedProductsCost = Math.round(totalProductsCost * 100) / 100
    const grandTotal = Math.round((roundedProductsCost + totalTransportCost) * 100) / 100

    // IVA 22% (already included in prices)
    const ivaRate = 0.22
    const netTotal = Math.round((grandTotal / (1 + ivaRate)) * 100) / 100
    const ivaAmount = Math.round((grandTotal - netTotal) * 100) / 100

    // Shipping cost per unit (rounded to whole euros)
    const shippingCostPerUnit = totalUnits > 0
      ? Math.round(totalTransportCost / totalUnits)
      : 0

    // 8. Calculate allocation per item ("spalmatura")
    const allocationByItem: TransportAnalysis["allocationByItem"] = []
    let allocatedShippingCents = 0
    const totalTransportCostCents = Math.round(totalTransportCost * 100)
    const productItems = cart.items.filter((item) => !!item.product)
    const productItemsCount = productItems.length
    let processedProducts = 0

    for (const item of cart.items) {
      if (!item.product) continue

      processedProducts++
      const quantity = item.quantity || 1
      const productTotal = Math.round((item.product.price || 0) * quantity)

      // Allocate shipping proportionally to quantity (work in cents)
      let shippingAllocatedCents = totalUnits > 0
        ? Math.round((totalTransportCostCents * quantity) / totalUnits)
        : 0

      // Handle rounding difference on last product item
      if (processedProducts === productItemsCount) {
        shippingAllocatedCents = totalTransportCostCents - allocatedShippingCents
      }

      allocatedShippingCents += shippingAllocatedCents
      const shippingAllocated = shippingAllocatedCents / 100

      allocationByItem.push({
        productId: item.productId!,
        productName: item.product.name,
        quantity,
        productTotal,
        shippingAllocated,
        lineGrandTotal: productTotal + shippingAllocated,
      })
    }

    return {
      workspaceId,
      cartId: cart.id,
      timestamp,
      transports,
      totalUnits,
      totalProductsCost: roundedProductsCost,
      totalTransportCost,
      grandTotal,
      shippingCostPerUnit,
      ivaAmount,
      netTotal,
      allocationByItem,
      isConfigured: true,
      isEmpty: false,
      selectedTypeId: selectedTransport?.typeId ?? null,
      selectedTypeName: selectedTransport?.typeName ?? null,
    }
  }

  /**
   * Create empty analysis result
   */
  private createEmptyAnalysis(
    workspaceId: string,
    cartId: string,
    timestamp: Date,
    isConfigured: boolean
  ): TransportAnalysis {
    return {
      workspaceId,
      cartId,
      timestamp,
      transports: [],
      totalUnits: 0,
      totalProductsCost: 0,
      totalTransportCost: 0,
      grandTotal: 0,
      shippingCostPerUnit: 0,
      ivaAmount: 0,
      netTotal: 0,
      allocationByItem: [],
      isConfigured,
      isEmpty: true,
      selectedTypeId: null,
      selectedTypeName: null,
    }
  }

  /**
   * Format transport analysis for display in WhatsApp
   * Returns Italian text (will be translated by Translation Agent)
   */
  formatAnalysisForDisplay(analysis: TransportAnalysis): string {
    if (!analysis.isConfigured) {
      return "Al momento non posso calcolare i costi di spedizione perché i prezzi dei trasporti non sono configurati. Puoi comunque continuare con il tuo ordine."
    }

    if (analysis.isEmpty) {
      return "Il tuo carrello è vuoto. Aggiungi qualche prodotto per vedere l'analisi dei costi di spedizione."
    }

    const lines: string[] = []

    // Header
    lines.push("📦 **Riepilogo Trasporti**")
    lines.push("")

    // Transport breakdown
    for (const transport of analysis.transports) {
      const emoji = this.getTransportEmoji(transport.typeName)
      lines.push(
        `${emoji} **${transport.typeName}**: €${transport.transportPrice.toFixed(2)} (${transport.totalQuantity} prodotti)`
      )
    }

    if (analysis.selectedTypeName) {
      lines.push("")
      lines.push(`✅ **Spedizione applicata:** ${analysis.selectedTypeName}`)
    }

    lines.push("")
    lines.push("---")
    lines.push("")

    // Totals
    lines.push(`📋 **Subtotale prodotti**: €${analysis.totalProductsCost.toFixed(2)}`)
    lines.push(`🚚 **Totale spedizione**: €${analysis.totalTransportCost.toFixed(2)}`)
    lines.push(`💰 **Totale ordine**: €${analysis.grandTotal.toFixed(2)}`)
    lines.push(`💶 **IVA 22%**: €${analysis.ivaAmount.toFixed(2)}`)
    lines.push(`📑 **Totale IVA esclusa**: €${analysis.netTotal.toFixed(2)}`)

    // Cost per unit insight
    if (analysis.shippingCostPerUnit > 0) {
      lines.push("")
      lines.push(
        `💡 _Costo spedizione medio per prodotto: €${analysis.shippingCostPerUnit.toFixed(2)}_`
      )
    }

    return lines.join("\n")
  }

  /**
   * Get available products for optimization suggestions
   * Returns products grouped by transport type, excluding those already in cart
   * 
   * @param workspaceId Workspace ID
   * @param excludeProductIds Product IDs already in cart
   * @param limit Max products per transport type
   */
  async getAvailableProductsForOptimization(
    workspaceId: string,
    excludeProductIds: string[],
    limit: number = 5
  ): Promise<Array<{
    typeName: string
    typeId: string
    products: Array<{
      id: string
      name: string
      price: number
      category: string
    }>
  }>> {
    // Get transport types
    const types = await this.typeRepo.findActiveWithPrices(workspaceId)
    
    const result: Array<{
      typeName: string
      typeId: string
      products: Array<{ id: string; name: string; price: number; category: string }>
    }> = []

    for (const transport of types) {
      // Get products for this transport type
      const productTransports = await this.prisma.productType.findMany({
        where: {
          typeId: transport.id,
          product: {
            workspaceId,
            isActive: true,
            id: { notIn: excludeProductIds },
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              productCategories: {
                include: {
                  category: {
                    select: { name: true },
                  },
                },
                take: 1,
              },
            },
          },
        },
        take: limit,
      })

      if (productTransports.length > 0) {
        result.push({
          typeName: transport.name,
          typeId: transport.id,
          products: productTransports.map(pt => ({
            id: pt.product.id,
            name: pt.product.name,
            price: pt.product.price,
            category: pt.product.productCategories[0]?.category?.name || "Altro",
          })),
        })
      }
    }

    return result
  }

  /**
   * Get emoji for transport type
   */
  private getTransportEmoji(transportName: string): string {
    const name = transportName.toLowerCase()
    if (name.includes("frozen") || name.includes("congel") || name.includes("surgel")) {
      return "🧊"
    }
    if (name.includes("refriger") || name.includes("frigo") || name.includes("fresco")) {
      return "❄️"
    }
    return "📦" // Ambiente
  }
}
