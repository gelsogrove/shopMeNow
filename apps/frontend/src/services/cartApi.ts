import { logger } from "@/lib/logger"
import { api } from "@/services/api"

// Cart types aligned with backend
export interface CartItem {
  id: string
  productId: string
  productCode?: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  discountAmount?: number
  finalPrice: number
  createdAt: string
  updatedAt: string
}

export interface Cart {
  id: string
  customerId: string
  workspaceId: string
  items: CartItem[]
  totalItems: number
  subtotal: number
  totalDiscount: number
  finalTotal: number
  lastUpdated: string
  createdAt: string
}

export interface CartSummary {
  itemCount: number
  subtotal: number
  totalDiscount: number
  finalTotal: number
}

export interface AddToCartRequest {
  productId?: string
  productCode?: string
  productName?: string
  quantity: number
  workspaceId: string
  customerId: string
}

export interface UpdateCartItemRequest {
  cartItemId: string
  quantity: number
}

export interface CartTokenResponse {
  token: string
  expiresAt: string
  cartData: Cart
}

/**
 * Cart API Service
 * Handles all cart-related operations for the frontend
 */
class CartApi {
  
  /**
   * Get cart information by token
   */
  async getCartByToken(token: string): Promise<Cart> {
    try {
      logger.debug('🛒 Getting cart by token', { token: token.substring(0, 10) + '...' })
      
      const response = await api.get(`/cart/token?token=${encodeURIComponent(token)}`)
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get cart')
      }
      
      logger.debug('✅ Cart retrieved successfully', { 
        cartId: response.data.data.id,
        itemCount: response.data.data.items.length 
      })
      
      return response.data.data
    } catch (error) {
      logger.error('❌ Error getting cart by token:', error)
      throw new Error('Failed to load cart. Please check your link.')
    }
  }

  /**
   * Generate cart access token
   */
  async generateCartToken(customerId: string, workspaceId: string): Promise<CartTokenResponse> {
    try {
      logger.debug('🔑 Generating cart token', { customerId, workspaceId })
      
      const response = await api.post('/cart/generate-token', {
        customerId,
        workspaceId
      })
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to generate cart token')
      }
      
      logger.debug('✅ Cart token generated successfully')
      
      return response.data.data
    } catch (error) {
      logger.error('❌ Error generating cart token:', error)
      throw new Error('Failed to generate cart access token')
    }
  }

  /**
   * Add item to cart
   */
  async addToCart(request: AddToCartRequest): Promise<Cart> {
    try {
      logger.debug('➕ Adding item to cart', request)
      
      const response = await api.post('/api/cart/add', request)
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to add item to cart')
      }
      
      logger.debug('✅ Item added to cart successfully', {
        cartId: response.data.data.id,
        newItemCount: response.data.data.items.length
      })
      
      return response.data.data
    } catch (error) {
      logger.error('❌ Error adding item to cart:', error)
      throw new Error('Failed to add item to cart')
    }
  }

  /**
   * Update cart item quantity
   */
  async updateCartItem(request: UpdateCartItemRequest): Promise<Cart> {
    try {
      logger.debug('📝 Updating cart item', request)
      
      const response = await api.put('/api/cart/item', request)
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to update cart item')
      }
      
      logger.debug('✅ Cart item updated successfully')
      
      return response.data.data
    } catch (error) {
      logger.error('❌ Error updating cart item:', error)
      throw new Error('Failed to update cart item')
    }
  }

  /**
   * Remove item from cart
   */
  async removeFromCart(cartItemId: string): Promise<Cart> {
    try {
      logger.debug('🗑️ Removing item from cart', { cartItemId })
      
      const response = await api.delete(`/api/cart/item/${cartItemId}`)
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to remove item from cart')
      }
      
      logger.debug('✅ Item removed from cart successfully')
      
      return response.data.data
    } catch (error) {
      logger.error('❌ Error removing item from cart:', error)
      throw new Error('Failed to remove item from cart')
    }
  }

  /**
   * Clear entire cart
   */
  async clearCart(customerId: string, workspaceId: string): Promise<{ success: boolean }> {
    try {
      logger.debug('🧹 Clearing cart', { customerId, workspaceId })
      
      const response = await api.delete('/api/cart/clear', {
        data: { customerId, workspaceId }
      })
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to clear cart')
      }
      
      logger.debug('✅ Cart cleared successfully')
      
      return { success: true }
    } catch (error) {
      logger.error('❌ Error clearing cart:', error)
      throw new Error('Failed to clear cart')
    }
  }

  /**
   * Get cart summary (lightweight version)
   */
  async getCartSummary(customerId: string, workspaceId: string): Promise<CartSummary> {
    try {
      logger.debug('📊 Getting cart summary', { customerId, workspaceId })
      
      const response = await api.get('/api/cart/summary', {
        params: { customerId, workspaceId }
      })
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to get cart summary')
      }
      
      logger.debug('✅ Cart summary retrieved successfully')
      
      return response.data.data
    } catch (error) {
      logger.error('❌ Error getting cart summary:', error)
      throw new Error('Failed to load cart summary')
    }
  }

  /**
   * Create order from cart
   */
  async createOrderFromCart(
    customerId: string, 
    workspaceId: string,
    orderData: {
      shippingAddress?: any
      billingAddress?: any
      paymentMethod?: string
      notes?: string
    }
  ): Promise<{ orderId: string, success: boolean }> {
    try {
      logger.debug('🛍️ Creating order from cart', { customerId, workspaceId })
      
      const response = await api.post('/api/cart/checkout', {
        customerId,
        workspaceId,
        ...orderData
      })
      
      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create order from cart')
      }
      
      logger.debug('✅ Order created from cart successfully', { 
        orderId: response.data.data.orderId 
      })
      
      return response.data.data
    } catch (error) {
      logger.error('❌ Error creating order from cart:', error)
      throw new Error('Failed to create order from cart')
    }
  }
}

// Export singleton instance
export const cartApi = new CartApi()
