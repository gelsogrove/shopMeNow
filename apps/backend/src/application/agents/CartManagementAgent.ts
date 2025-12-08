/**
 * Cart Management Agent
 *
 * Handles all cart operations:
 * - addToCart: Add products/services to cart
 * - removeFromCart: Remove items from cart
 * - viewCart: Display cart contents
 * - updateQuantity: Modify item quantities
 * - resetCart: Clear entire cart
 * - repeatOrder: Copy items from previous order
 *
 * @architecture Clean Architecture - Uses repositories, no direct DB access
 */

import { CartRepository } from "../../repositories/cart.repository"
import { OrderRepository } from "../../repositories/order.repository"
import { ProductRepository } from "../../repositories/product.repository"
import { ServiceRepository } from "../../repositories/service.repository"
import logger from "../../utils/logger"

export interface CartAgentContext {
  workspaceId: string
  customerId: string
  customerName?: string
  language?: string
  customerDiscount?: number // Customer's discount percentage (e.g., 10 for 10%)
}

export interface AddToCartParams {
  productId: string
  quantity: number
  notes?: string
  type?: "PRODUCT" | "SERVICE" // Default: "PRODUCT" for backward compatibility
}

export interface UpdateQuantityParams {
  cartItemId: string
  newQuantity: number
}

export interface RepeatOrderParams {
  orderId: string
}

export class CartManagementAgent {
  private cartRepo: CartRepository
  private productRepo: ProductRepository
  private serviceRepo: ServiceRepository
  private orderRepo: OrderRepository

  constructor(
    cartRepo: CartRepository,
    productRepo: ProductRepository,
    serviceRepo: ServiceRepository,
    orderRepo: OrderRepository
  ) {
    this.cartRepo = cartRepo
    this.productRepo = productRepo
    this.serviceRepo = serviceRepo
    this.orderRepo = orderRepo
  }

  /**
   * Get cart contents with full details
   * Applies customer discount to all prices
   */
  async getCart(context: CartAgentContext) {
    try {
      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )

      if (!cart || cart.items.length === 0) {
        return {
          success: true,
          isEmpty: true,
          cart: {
            items: [],
            total: 0,
            itemCount: 0,
          },
        }
      }

      // Customer discount percentage (e.g., 10 for 10%)
      const discountPercent = context.customerDiscount || 0
      const discountMultiplier = 1 - discountPercent / 100

      // Calculate totals with customer discount applied
      const items = cart.items.map((item) => {
        const originalPrice = item.product?.price || item.service?.price || 0
        // Apply customer discount
        let discountedPrice = originalPrice * discountMultiplier
        // 🔴 CRITICAL: Round UP to nearest 10 cents (€7.02 → €7.10)
        // Andrea's requirement: arrotondamento per eccesso ai 10 centesimi
        // Must match PriceCalculationService logic!
        discountedPrice = Math.ceil(discountedPrice * 10) / 10
        
        return {
          id: item.id,
          type: item.itemType,
          name: item.product?.name || item.service?.name || "Unknown",
          quantity: item.quantity,
          originalPrice, // Price before discount
          unitPrice: discountedPrice, // Price after discount (rounded up to 10 cents)
          total: Number((discountedPrice * item.quantity).toFixed(2)),
          notes: item.notes,
          product: item.product,
          service: item.service,
        }
      })

      const total = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2))

      return {
        success: true,
        isEmpty: false,
        cart: {
          id: cart.id,
          items,
          total,
          itemCount: items.length,
          discountApplied: discountPercent, // Show what discount was applied
        },
      }
    } catch (error) {
      logger.error("CartManagementAgent.getCart error:", error)
      return {
        success: false,
        error: "Failed to retrieve cart",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Add product or service to cart
   */
  async addToCart(context: CartAgentContext, params: AddToCartParams) {
    try {
      const { productId, quantity, notes, type = "PRODUCT" } = params

      logger.info("🛒 addToCart called:", {
        productId,
        quantity,
        type,
        workspaceId: context.workspaceId,
      })

      // Validate quantity
      if (quantity <= 0) {
        return {
          success: false,
          error: "INVALID_QUANTITY",
          message: "Quantity must be greater than 0",
        }
      }

      // 🔍 CRITICAL FIX: productId is actually a code (e.g., "SALUMI-006" or "GFT001")
      // Search in appropriate repository based on type
      let item: any = null
      let itemName: string = ""
      let itemPrice: number = 0
      let itemId: string = ""

      if (type === "PRODUCT") {
        const product = await this.productRepo.findBySku(
          productId, // This is actually sku like "SALUMI-006"
          context.workspaceId
        )

        if (!product) {
          return {
            success: false,
            error: "PRODUCT_NOT_FOUND",
            message: `Product with code ${productId} not found`,
          }
        }

        if (!product.isActive) {
          return {
            success: false,
            error: "PRODUCT_UNAVAILABLE",
            message: `Product "${product.name}" is currently unavailable`,
          }
        }

        // Check stock availability (only for products)
        if (product.stock !== null && product.stock < quantity) {
          return {
            success: false,
            error: "INSUFFICIENT_STOCK",
            message: `Only ${product.stock} units available for "${product.name}"`,
            availableStock: product.stock,
          }
        }

        item = product
        itemName = product.name
        itemPrice = product.price
        itemId = product.id
      } else if (type === "SERVICE") {
        const service = await this.serviceRepo.findByServiceCode(
          productId, // For services, this is serviceCode like "GFT001"
          context.workspaceId
        )

        if (!service) {
          return {
            success: false,
            error: "SERVICE_NOT_FOUND",
            message: `Service with code ${productId} not found`,
          }
        }

        if (!service.isActive) {
          return {
            success: false,
            error: "SERVICE_UNAVAILABLE",
            message: `Service "${service.name}" is currently unavailable`,
          }
        }

        // Services don't have stock checks
        item = service
        itemName = service.name
        itemPrice = service.price
        itemId = service.id
      }

      // Get or create cart
      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )

      // ✅ Feature 191: Check if service is already in cart (services can only be added once)
      if (type === "SERVICE") {
        const serviceAlreadyInCart = cart.items?.some(
          (item: any) => item.serviceId === itemId
        )
        
        if (serviceAlreadyInCart) {
          // Return cart without adding duplicate service
          const updatedCart = await this.getCart(context)
          return {
            success: true,
            message: `Service "${itemName}" is already in your cart`,
            alreadyInCart: true,
            item: {
              id: itemId,
              name: itemName,
              price: itemPrice,
              quantity: 1,
              type,
            },
            cart: updatedCart.cart,
          }
        }
      }

      // Add item to cart with correct type
      // CRITICAL: Use productId for PRODUCT, serviceId for SERVICE
      await this.cartRepo.addItem(cart.id, {
        itemType: type, // "PRODUCT" or "SERVICE"
        productId: type === "PRODUCT" ? itemId : undefined,
        serviceId: type === "SERVICE" ? itemId : undefined,
        quantity: type === "SERVICE" ? 1 : quantity, // Services always quantity 1
        notes,
      })

      // Return updated cart
      const updatedCart = await this.getCart(context)

      logger.info(`${type} added to cart:`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        code: productId,
        type,
        quantity,
      })

      return {
        success: true,
        message: `Added ${quantity}x "${itemName}" to cart`,
        item: {
          id: itemId,
          name: itemName,
          price: itemPrice,
          quantity,
          type,
        },
        cart: updatedCart.cart,
      }
    } catch (error) {
      logger.error("CartManagementAgent.addToCart error:", error)
      return {
        success: false,
        error: "ADD_TO_CART_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(context: CartAgentContext, cartItemId: string) {
    try {
      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )

      // Find item in cart
      const item = cart.items.find((i) => i.id === cartItemId)

      if (!item) {
        return {
          success: false,
          error: "ITEM_NOT_FOUND",
          message: "Item not found in cart",
        }
      }

      const itemName = item.product?.name || item.service?.name || "Item"

      // Remove item (with workspace validation for security)
      await this.cartRepo.removeItem(cartItemId, context.workspaceId)

      // Return updated cart
      const updatedCart = await this.getCart(context)

      logger.info("Item removed from cart:", {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        cartItemId,
      })

      return {
        success: true,
        message: `Removed "${itemName}" from cart`,
        cart: updatedCart.cart,
      }
    } catch (error) {
      logger.error("CartManagementAgent.removeFromCart error:", error)
      return {
        success: false,
        error: "REMOVE_FROM_CART_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Update item quantity
   */
  async updateQuantity(
    context: CartAgentContext,
    params: UpdateQuantityParams
  ) {
    try {
      const { cartItemId, newQuantity } = params

      // If quantity is 0, remove the item
      if (newQuantity === 0) {
        return this.removeFromCart(context, cartItemId)
      }

      // Validate quantity
      if (newQuantity < 0) {
        return {
          success: false,
          error: "INVALID_QUANTITY",
          message: "Quantity cannot be negative",
        }
      }

      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )

      // Find item in cart
      const item = cart.items.find((i) => i.id === cartItemId)

      if (!item) {
        return {
          success: false,
          error: "ITEM_NOT_FOUND",
          message: "Item not found in cart",
        }
      }

      // Check stock if updating product
      if (item.productId) {
        const product = await this.productRepo.findById(
          context.workspaceId,
          item.productId
        )

        if (product && product.stock !== null && product.stock < newQuantity) {
          return {
            success: false,
            error: "INSUFFICIENT_STOCK",
            message: `Only ${product.stock} units available`,
            availableStock: product.stock,
          }
        }
      }

      // Update quantity (with workspace validation for security)
      await this.cartRepo.updateItemQuantity(cartItemId, newQuantity, context.workspaceId)

      // Return updated cart
      const updatedCart = await this.getCart(context)

      const itemName = item.product?.name || item.service?.name || "Item"

      logger.info("Cart item quantity updated:", {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        cartItemId,
        newQuantity,
      })

      return {
        success: true,
        message: `Updated "${itemName}" quantity to ${newQuantity}`,
        cart: updatedCart.cart,
      }
    } catch (error) {
      logger.error("CartManagementAgent.updateQuantity error:", error)
      return {
        success: false,
        error: "UPDATE_QUANTITY_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Clear entire cart
   */
  async resetCart(context: CartAgentContext) {
    try {
      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )

      if (cart.items.length === 0) {
        return {
          success: true,
          message: "Cart is already empty",
          cart: {
            items: [],
            total: 0,
            itemCount: 0,
          },
        }
      }

      const itemCount = cart.items.length

      // Clear all items (with workspace validation for security)
      await this.cartRepo.clearCart(cart.id, context.workspaceId)

      logger.info("Cart cleared:", {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        itemsRemoved: itemCount,
      })

      return {
        success: true,
        message: `Cart cleared (${itemCount} items removed)`,
        cart: {
          items: [],
          total: 0,
          itemCount: 0,
        },
      }
    } catch (error) {
      logger.error("CartManagementAgent.resetCart error:", error)
      return {
        success: false,
        error: "RESET_CART_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  /**
   * Copy items from previous order to cart
   */
  async repeatOrder(context: CartAgentContext, params: RepeatOrderParams) {
    try {
      const { orderId } = params

      // Get order details
      const order = await this.orderRepo.findById(orderId, context.workspaceId)

      if (!order) {
        return {
          success: false,
          error: "ORDER_NOT_FOUND",
          message: `Order ${orderId} not found`,
        }
      }

      // Verify order belongs to customer
      if (order.customerId !== context.customerId) {
        return {
          success: false,
          error: "UNAUTHORIZED",
          message: "This order does not belong to you",
        }
      }

      if (!order.items || order.items.length === 0) {
        return {
          success: false,
          error: "EMPTY_ORDER",
          message: "This order has no items",
        }
      }

      // Clear current cart first (with workspace validation)
      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )
      await this.cartRepo.clearCart(cart.id, context.workspaceId)

      logger.info("🔍 About to add order items to cart:", {
        orderId: order.id,
        orderCode: order.orderCode,
        itemsCount: order.items?.length || 0,
        items: order.items?.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
      })

      // Add all order items to cart
      const results = []
      for (const orderItem of order.items) {
        if (orderItem.productId) {
          // 🔍 CRITICAL: orderItem.productId is UUID, but addToCart expects sku
          // First, get the product to find its code
          const product = await this.productRepo.findById(
            orderItem.productId,
            context.workspaceId
          )

          if (!product) {
            logger.warn(`⚠️ Product not found by ID: ${orderItem.productId}`)
            results.push({
              success: false,
              error: "PRODUCT_NOT_FOUND",
              message: `Product not found`,
            })
            continue
          }

          if (!product.sku) {
            logger.warn(`⚠️ Product has no sku: ${orderItem.productId}`)
            results.push({
              success: false,
              error: "PRODUCT_NO_CODE",
              message: `Product ${product.name} has no code`,
            })
            continue
          }

          logger.info("🔄 Attempting to add product to cart:", {
            productId: orderItem.productId,
            sku: product.sku,
            productName: product.name,
            quantity: orderItem.quantity,
          })

          const addResult = await this.addToCart(context, {
            productId: product.sku, // Use CODE, not UUID!
            quantity: orderItem.quantity,
          })

          logger.info("✅ addToCart result:", {
            success: addResult.success,
            error: addResult.error,
            message: addResult.message,
          })

          results.push(addResult)
        }
      }

      // Check if any items failed
      const failedItems = results.filter((r) => !r.success)
      const successItems = results.filter((r) => r.success)

      // Get final cart state
      const updatedCart = await this.getCart(context)

      logger.info("Order repeated:", {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        orderId,
        successCount: successItems.length,
        failedCount: failedItems.length,
        failedReasons: failedItems.map((f) => f.error || f.message),
      })

      // If ALL items failed, return error
      if (successItems.length === 0) {
        return {
          success: false,
          error: "ALL_PRODUCTS_UNAVAILABLE",
          message: `None of the ${order.items.length} products from this order are currently available`,
          failedItems: failedItems.map((f) => ({
            error: f.error,
            message: f.message,
          })),
        }
      }

      // If some items succeeded
      return {
        success: true,
        message:
          successItems.length === order.items.length
            ? `Added ${successItems.length} items from order ${order.orderCode} to cart`
            : `Added ${successItems.length} of ${order.items.length} items to cart (${failedItems.length} products unavailable)`,
        cart: updatedCart.cart,
        failedItems:
          failedItems.length > 0
            ? failedItems.map((f) => ({
                error: f.error,
                message: f.message,
              }))
            : undefined,
      }
    } catch (error) {
      logger.error("CartManagementAgent.repeatOrder error:", error)
      return {
        success: false,
        error: "REPEAT_ORDER_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }
}
