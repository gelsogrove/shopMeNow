/**
 * ShowCheckout - LLM-Callable Function
 *
 * Shows the cart summary and asks for order confirmation.
 * Used when customer wants to proceed with checkout.
 *
 * Flow:
 * 1. Get customer's cart with items
 * 2. Calculate totals using PriceCalculationService (same as product search)
 * 3. Show cart summary with profile link for data verification
 * 4. Ask for confirmation
 * 
 * IMPORTANT: Uses PriceCalculationService to ensure consistent pricing
 * with product search (including rounding to nearest 10 cents)
 */

import { prisma } from "@echatbot/database"
import { PriceCalculationService } from "../../application/services/price-calculation.service"
import logger from "../../utils/logger"

export interface ShowCheckoutRequest {
  customerId: string
  workspaceId: string
}

export interface ShowCheckoutResult {
  success: boolean
  message: string
  cartTotal?: number
  itemsCount?: number
  discountPercent?: number
  timestamp: string
  error?: string
}

/**
 * Shows cart summary and asks for order confirmation
 */
export async function showCheckout(
  request: ShowCheckoutRequest
): Promise<ShowCheckoutResult> {
  // prisma imported
  
  try {
    logger.info("🛒 ShowCheckout called with:", {
      customerId: request.customerId,
      workspaceId: request.workspaceId,
    })

    if (!request.customerId || !request.workspaceId) {
      logger.error("❌ Missing required parameters in ShowCheckout")
      return {
        success: false,
        error: "Missing required parameters",
        message: "Unable to show checkout. Missing parameters.",
        timestamp: new Date().toISOString(),
      }
    }

    // 1. Get customer
    const customer = await prisma.customers.findFirst({
      where: {
        id: request.customerId,
        workspaceId: request.workspaceId,
      },
    })

    if (!customer) {
      logger.error("❌ Customer not found in ShowCheckout")
      await prisma.$disconnect()
      return {
        success: false,
        error: "Customer not found",
        message: "Unable to find your account.",
        timestamp: new Date().toISOString(),
      }
    }

    // 2. Get cart with items
    const cart = await prisma.carts.findFirst({
      where: {
        customerId: request.customerId,
        workspaceId: request.workspaceId,
      },
      include: {
        items: {
          include: {
            product: true,
            service: true,
          },
        },
      },
    })

    if (!cart || !cart.items || cart.items.length === 0) {
      logger.error("❌ Cart empty in ShowCheckout")
      await prisma.$disconnect()
      return {
        success: false,
        error: "Cart empty",
        message:
          "Your cart is empty! 🛒\n\n" +
          "Add some products before proceeding to checkout.",
        timestamp: new Date().toISOString(),
      }
    }

    // 3. Calculate prices using PriceCalculationService (same as product search)
    // This ensures consistent pricing with rounding to nearest 10 cents
    const priceService = new PriceCalculationService(prisma)
    const productIds = cart.items
      .filter(item => item.product)
      .map(item => item.product!.id)
    
    // Get calculated prices for all products
    const priceResult = await priceService.calculatePricesWithDiscounts(
      request.workspaceId,
      productIds,
      customer.discount || 0
    )
    
    // Create a map for quick lookup: productId -> {originalPrice, finalPrice}
    const priceMap = new Map<string, {originalPrice?: number, finalPrice?: number}>(
      priceResult.products.map(p => [p.id, { originalPrice: p.originalPrice, finalPrice: p.finalPrice }])
    )

    // 4. Build cart summary with correct prices
    let totalAmount = 0
    const cartItems: string[] = []

    for (const item of cart.items) {
      if (item.product) {
        const calculatedPrice = priceMap.get(item.product.id)
        // Use finalPrice from PriceCalculationService (already discounted and rounded)
        const unitPrice = calculatedPrice?.finalPrice || Number(item.product.price) || 0
        const itemTotal = unitPrice * item.quantity
        totalAmount += itemTotal
        
        // Show simple format: quantity × product = total (NO discount info)
        // The price shown IS the final price customer pays
        cartItems.push(`• ${item.quantity}x ${item.product.name} - €${itemTotal.toFixed(2)}`)
        
        logger.info(`📦 Product: ${item.product.name}, qty: ${item.quantity}, unitPrice: €${unitPrice.toFixed(2)}, total: €${itemTotal.toFixed(2)}`)
      } else if (item.service) {
        // Services don't get discounts
        const price = Number(item.service.price) || 0
        const itemTotal = price * item.quantity
        totalAmount += itemTotal
        cartItems.push(`• ${item.quantity}x ${item.service.name} - €${itemTotal.toFixed(2)}`)
      }
    }

    await prisma.$disconnect()

    // 5. Build checkout message (English - Translation Agent will translate)
    // Include discount info if customer has one
    const customerDiscount = customer.discount || 0
    
    let message = `📦 **Order Summary:**\n\n`
    message += cartItems.join("\n") + "\n\n"
    message += `💰 **Total:** €${totalAmount.toFixed(2)}`
    
    // Add discount info if customer has a discount
    if (customerDiscount > 0) {
      message += ` *(includes your ${customerDiscount}% personal discount)*`
    }
    
    message += `\n\n🔐 Before proceeding, please verify your shipping details:\n`
    message += `[LINK_PROFILE_WITH_TOKEN]\n\n`
    message += `✅ Are your details correct? Reply **"confirm"** or **"ok"** to proceed with the order.`

    logger.info("✅ ShowCheckout completed successfully:", {
      itemsCount: cart.items.length,
      total: totalAmount,
      discountPercent: customerDiscount,
    })

    return {
      success: true,
      message,
      cartTotal: totalAmount,
      itemsCount: cart.items.length,
      discountPercent: customerDiscount,
      timestamp: new Date().toISOString(),
    }
  } catch (error) {
    logger.error("❌ Error in ShowCheckout:", error)
    await prisma.$disconnect()
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error",
      message:
        "A technical issue occurred. Please try again later or contact support.",
      timestamp: new Date().toISOString(),
    }
  }
}
