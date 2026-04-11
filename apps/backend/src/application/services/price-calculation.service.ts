/**
 * Price Calculation Service
 * Handles price calculations with customer and offer discounts
 * Logic: NON-CUMULATIVE - highest discount wins
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"

export interface ProductWithPrice {
  id: string
  name: string
  price: number
  formato?: string | null
  description?: string | null
  stock?: number
  sku?: string | null
  originalPrice?: number
  finalPrice?: number
  appliedDiscount?: number
  discountSource?: "customer" | "offer"
  discountName?: string
}

interface PriceCalculationResult {
  products: ProductWithPrice[]
  totalDiscount: number
  discountsApplied: {
    customerDiscount: number
    bestOfferDiscount: number
    appliedDiscount: number
    source: "customer" | "offer" | "none"
  }
}

export interface OfferData {
  id: string
  name: string
  discountPercent: number
  startDate: Date
  endDate: Date
  isActive: boolean
  categoryId: string | null
}

export class PriceCalculationService {
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Calculate final prices for products applying discounts
   * Andrea's Logic: NON-CUMULATIVE - highest discount wins
   * If customer has 10% and Black Friday has 20%, use 20%
   * When Black Friday ends, return to 10%
   */
  async calculatePricesWithDiscounts(
    workspaceId: string,
    productIds?: string[],
    customerDiscount: number = 0
  ): Promise<PriceCalculationResult> {
    try {
      logger.info(
        `Calculating prices for workspace ${workspaceId} with customer discount ${customerDiscount}%`
      )

      // Get products
      const products = await this.getProducts(workspaceId, productIds)
      if (products.length === 0) {
        return {
          products: [],
          totalDiscount: 0,
          discountsApplied: {
            customerDiscount: 0,
            bestOfferDiscount: 0,
            appliedDiscount: 0,
            source: "none",
          },
        }
      }

      // Get active offers for workspace
      const activeOffers = await this.getActiveOffers(workspaceId)
      logger.info(`Found ${activeOffers.length} active offers`)

      // Calculate prices for each product
      const productsWithPrices = products.map((product) => {
        // Find best offer for this product
        const applicableOffers = this.findApplicableOffers(
          product,
          activeOffers
        )
        const bestOffer = this.getBestOffer(applicableOffers)

        const bestOfferDiscount = bestOffer ? bestOffer.discountPercent : 0

        // Andrea's Logic: Highest discount wins (NON-CUMULATIVE)
        let appliedDiscount = 0
        let discountSource: "customer" | "offer" | "none" = "none"
        let discountName = ""

        if (bestOfferDiscount > customerDiscount) {
          // Offer discount is higher
          appliedDiscount = bestOfferDiscount
          discountSource = "offer"
          discountName = bestOffer?.name || ""
        } else if (customerDiscount > 0) {
          // Customer discount is higher (or equal)
          appliedDiscount = customerDiscount
          discountSource = "customer"
          discountName = "Customer Discount"
        }

        // Calculate final price
        const originalPrice = Number(product.price)
        let finalPrice =
          appliedDiscount > 0
            ? originalPrice * (1 - appliedDiscount / 100)
            : originalPrice

        // 🔴 CRITICAL: Round UP to nearest 10 cents (€8.01 → €8.10, €8.11 → €8.20)
        // Andrea's requirement: arrotondamento per eccesso ai 10 centesimi
        finalPrice = Math.ceil(finalPrice * 10) / 10

        return {
          ...product,
          price: Number(product.price),
          originalPrice,
          finalPrice,
          appliedDiscount,
          discountSource:
            discountSource !== "none" ? discountSource : undefined,
          discountName: discountName || undefined,
        }
      })

      // Calculate total discount applied
      const totalOriginalPrice = productsWithPrices.reduce(
        (sum, p) => sum + p.originalPrice!,
        0
      )
      const totalFinalPrice = productsWithPrices.reduce(
        (sum, p) => sum + p.finalPrice!,
        0
      )
      const totalDiscount = totalOriginalPrice - totalFinalPrice

      // Get best overall discount applied
      const bestOverallDiscount = Math.max(
        ...productsWithPrices.map((p) => p.appliedDiscount || 0)
      )
      const bestOfferDiscount = Math.max(
        ...activeOffers.map((o) => o.discountPercent),
        0
      )

      return {
        products: productsWithPrices,
        totalDiscount,
        discountsApplied: {
          customerDiscount,
          bestOfferDiscount,
          appliedDiscount: bestOverallDiscount,
          source:
            bestOverallDiscount === bestOfferDiscount
              ? "offer"
              : bestOverallDiscount === customerDiscount
                ? "customer"
                : "none",
        },
      }
    } catch (error) {
      logger.error("Error calculating prices with discounts:", error)
      throw error
    }
  }

  /**
   * Get products from database
   */
  private async getProducts(workspaceId: string, productIds?: string[]) {
    const whereClause: any = {
      workspaceId,
      isActive: true,
      status: "ACTIVE",
    }

    if (productIds && productIds.length > 0) {
      whereClause.id = { in: productIds }
    }

    return await this.prisma.products.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        price: true,
        formato: true,
        sku: true,
        description: true,
        stock: true,
      },
    })
  }

  /**
   * Get active offers for workspace
   */
  private async getActiveOffers(workspaceId: string): Promise<OfferData[]> {
    const now = new Date()

    // Offers expire based on dates only - isActive flag is ignored
    return await this.prisma.offers.findMany({
      where: {
        workspaceId,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: {
        id: true,
        name: true,
        discountPercent: true,
        startDate: true,
        endDate: true,
        isActive: true,
        categoryId: true,
      },
    })
  }

  /**
   * Find offers applicable to a specific product
   */
  private findApplicableOffers(product: any, offers: OfferData[]): OfferData[] {
    return offers.filter((offer) => {
      // If offer has no categoryId, it applies to all products
      if (!offer.categoryId) {
        return true
      }

      // If product has no category, it can't match category-specific offers
      if (!product.categoryId) {
        return false
      }

      // Check if product category matches offer category
      return offer.categoryId === product.categoryId
    })
  }

  /**
   * Get the best offer (highest discount)
   */
  private getBestOffer(offers: OfferData[]): OfferData | null {
    if (offers.length === 0) {
      return null
    }

    return offers.reduce((best, current) =>
      current.discountPercent > best.discountPercent ? current : best
    )
  }

  /**
   * Check what discounts are available for a customer
   */
  async getAvailableDiscounts(workspaceId: string, customerId?: string) {
    try {
      // Get customer discount
      let customerDiscount = 0
      if (customerId) {
        const customer = await this.prisma.customers.findUnique({
          where: { id: customerId },
          select: { discount: true },
        })
        customerDiscount = customer?.discount || 0
      }

      // Get active offers
      const activeOffers = await this.getActiveOffers(workspaceId)
      const bestOfferDiscount =
        activeOffers.length > 0
          ? Math.max(...activeOffers.map((o) => o.discountPercent))
          : 0

      return {
        customerDiscount,
        bestOfferDiscount,
        activeOffers: activeOffers.map((offer) => ({
          id: offer.id,
          name: offer.name,
          discountPercent: offer.discountPercent,
          categoryId: offer.categoryId,
        })),
        bestDiscount: Math.max(customerDiscount, bestOfferDiscount),
        discountSource:
          bestOfferDiscount > customerDiscount
            ? "offer"
            : customerDiscount > 0
              ? "customer"
              : "none",
      }
    } catch (error) {
      logger.error("Error getting available discounts:", error)
      throw error
    }
  }
}
