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

import logger from '../../utils/logger'
import { CartRepository } from '../../repositories/cart.repository'
import { ProductRepository } from '../../repositories/product.repository'
import { OrderRepository } from '../../repositories/order.repository'

export interface CartAgentContext {
  workspaceId: string
  customerId: string
  customerName?: string
  language?: string
}

export interface AddToCartParams {
  productId: string
  quantity: number
  notes?: string
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
  private orderRepo: OrderRepository

  constructor(
    cartRepo: CartRepository,
    productRepo: ProductRepository,
    orderRepo: OrderRepository
  ) {
    this.cartRepo = cartRepo
    this.productRepo = productRepo
    this.orderRepo = orderRepo
  }

  /**
   * Get cart contents with full details
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
            itemCount: 0
          }
        }
      }

      // Calculate totals
      const items = cart.items.map(item => {
        const price = item.product?.price || item.service?.price || 0
        return {
          id: item.id,
          type: item.itemType,
          name: item.product?.name || item.service?.name || 'Unknown',
          quantity: item.quantity,
          unitPrice: price,
          total: price * item.quantity,
          notes: item.notes,
          product: item.product,
          service: item.service
        }
      })

      const total = items.reduce((sum, item) => sum + item.total, 0)

      return {
        success: true,
        isEmpty: false,
        cart: {
          id: cart.id,
          items,
          total,
          itemCount: items.length
        }
      }
    } catch (error) {
      logger.error('CartManagementAgent.getCart error:', error)
      return {
        success: false,
        error: 'Failed to retrieve cart',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Add product to cart
   */
  async addToCart(context: CartAgentContext, params: AddToCartParams) {
    try {
      const { productId, quantity, notes } = params

      // Validate quantity
      if (quantity <= 0) {
        return {
          success: false,
          error: 'INVALID_QUANTITY',
          message: 'Quantity must be greater than 0'
        }
      }

      // Verify product exists and is available
      const product = await this.productRepo.findById(
        context.workspaceId,
        productId
      )

      if (!product) {
        return {
          success: false,
          error: 'PRODUCT_NOT_FOUND',
          message: `Product with ID ${productId} not found`
        }
      }

      if (!product.isActive) {
        return {
          success: false,
          error: 'PRODUCT_UNAVAILABLE',
          message: `Product "${product.name}" is currently unavailable`
        }
      }

      // Check stock availability
      if (product.stock !== null && product.stock < quantity) {
        return {
          success: false,
          error: 'INSUFFICIENT_STOCK',
          message: `Only ${product.stock} units available for "${product.name}"`,
          availableStock: product.stock
        }
      }

      // Get or create cart
      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )

      // Add item to cart
      await this.cartRepo.addItem(cart.id, {
        itemType: 'PRODUCT',
        productId,
        quantity,
        notes
      })

      // Return updated cart
      const updatedCart = await this.getCart(context)

      logger.info('Product added to cart:', {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        productId,
        quantity
      })

      return {
        success: true,
        message: `Added ${quantity}x "${product.name}" to cart`,
        product: {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity
        },
        cart: updatedCart.cart
      }
    } catch (error) {
      logger.error('CartManagementAgent.addToCart error:', error)
      return {
        success: false,
        error: 'ADD_TO_CART_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
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
      const item = cart.items.find(i => i.id === cartItemId)

      if (!item) {
        return {
          success: false,
          error: 'ITEM_NOT_FOUND',
          message: 'Item not found in cart'
        }
      }

      const itemName = item.product?.name || item.service?.name || 'Item'

      // Remove item
      await this.cartRepo.removeItem(cartItemId)

      // Return updated cart
      const updatedCart = await this.getCart(context)

      logger.info('Item removed from cart:', {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        cartItemId
      })

      return {
        success: true,
        message: `Removed "${itemName}" from cart`,
        cart: updatedCart.cart
      }
    } catch (error) {
      logger.error('CartManagementAgent.removeFromCart error:', error)
      return {
        success: false,
        error: 'REMOVE_FROM_CART_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update item quantity
   */
  async updateQuantity(context: CartAgentContext, params: UpdateQuantityParams) {
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
          error: 'INVALID_QUANTITY',
          message: 'Quantity cannot be negative'
        }
      }

      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )

      // Find item in cart
      const item = cart.items.find(i => i.id === cartItemId)

      if (!item) {
        return {
          success: false,
          error: 'ITEM_NOT_FOUND',
          message: 'Item not found in cart'
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
            error: 'INSUFFICIENT_STOCK',
            message: `Only ${product.stock} units available`,
            availableStock: product.stock
          }
        }
      }

      // Update quantity
      await this.cartRepo.updateItemQuantity(cartItemId, newQuantity)

      // Return updated cart
      const updatedCart = await this.getCart(context)

      const itemName = item.product?.name || item.service?.name || 'Item'

      logger.info('Cart item quantity updated:', {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        cartItemId,
        newQuantity
      })

      return {
        success: true,
        message: `Updated "${itemName}" quantity to ${newQuantity}`,
        cart: updatedCart.cart
      }
    } catch (error) {
      logger.error('CartManagementAgent.updateQuantity error:', error)
      return {
        success: false,
        error: 'UPDATE_QUANTITY_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
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
          message: 'Cart is already empty',
          cart: {
            items: [],
            total: 0,
            itemCount: 0
          }
        }
      }

      const itemCount = cart.items.length

      // Clear all items
      await this.cartRepo.clearCart(cart.id)

      logger.info('Cart cleared:', {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        itemsRemoved: itemCount
      })

      return {
        success: true,
        message: `Cart cleared (${itemCount} items removed)`,
        cart: {
          items: [],
          total: 0,
          itemCount: 0
        }
      }
    } catch (error) {
      logger.error('CartManagementAgent.resetCart error:', error)
      return {
        success: false,
        error: 'RESET_CART_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
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
      const order = await this.orderRepo.findById(
        context.workspaceId,
        orderId
      )

      if (!order) {
        return {
          success: false,
          error: 'ORDER_NOT_FOUND',
          message: `Order ${orderId} not found`
        }
      }

      // Verify order belongs to customer
      if (order.customerId !== context.customerId) {
        return {
          success: false,
          error: 'UNAUTHORIZED',
          message: 'This order does not belong to you'
        }
      }

      if (!order.items || order.items.length === 0) {
        return {
          success: false,
          error: 'EMPTY_ORDER',
          message: 'This order has no items'
        }
      }

      // Clear current cart first
      const cart = await this.cartRepo.getOrCreateCart(
        context.workspaceId,
        context.customerId
      )
      await this.cartRepo.clearCart(cart.id)

      // Add all order items to cart
      const results = []
      for (const orderItem of order.items) {
        if (orderItem.productId) {
          const addResult = await this.addToCart(context, {
            productId: orderItem.productId,
            quantity: orderItem.quantity
          })
          results.push(addResult)
        }
      }

      // Check if any items failed
      const failedItems = results.filter(r => !r.success)
      const successItems = results.filter(r => r.success)

      // Get final cart state
      const updatedCart = await this.getCart(context)

      logger.info('Order repeated:', {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        orderId,
        successCount: successItems.length,
        failedCount: failedItems.length
      })

      return {
        success: true,
        message: `Added ${successItems.length} items from order to cart`,
        cart: updatedCart.cart,
        failedItems: failedItems.length > 0 ? failedItems : undefined
      }
    } catch (error) {
      logger.error('CartManagementAgent.repeatOrder error:', error)
      return {
        success: false,
        error: 'REPEAT_ORDER_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
