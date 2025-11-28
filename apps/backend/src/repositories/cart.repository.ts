/**
 * Cart Repository
 * 
 * Data access layer for cart operations.
 * Handles all database interactions for carts and cart items.
 * 
 * @architecture Clean Architecture - Repository Pattern
 */

import { PrismaClient, ItemType } from '@prisma/client'
import logger from '../utils/logger'

export interface AddItemParams {
  itemType: ItemType
  productId?: string
  serviceId?: string
  quantity: number
  notes?: string
}

export interface CartWithItems {
  id: string
  customerId: string
  workspaceId: string
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    itemType: ItemType
    quantity: number
    notes: string | null
    productId: string | null
    serviceId: string | null
    product?: {
      id: string
      name: string
      price: number
      stock: number | null
      isActive: boolean
    } | null
    service?: {
      id: string
      name: string
      price: number
      isActive: boolean
    } | null
  }>
}

export class CartRepository {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Get or create cart for customer
   */
  async getOrCreateCart(
    workspaceId: string,
    customerId: string
  ): Promise<CartWithItems> {
    try {
      // Try to find existing cart
      let cart = await this.prisma.carts.findUnique({
        where: {
          customerId
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  isActive: true
                }
              },
              service: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  isActive: true
                }
              }
            }
          }
        }
      })

      // If no cart exists, create one
      if (!cart) {
        cart = await this.prisma.carts.create({
          data: {
            workspaceId,
            customerId,
            items: {
              create: []
            }
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    stock: true,
                    isActive: true
                  }
                },
                service: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    isActive: true
                  }
                }
              }
            }
          }
        })

        logger.info('Created new cart:', { workspaceId, customerId, cartId: cart.id })
      }

      return cart as CartWithItems
    } catch (error) {
      logger.error('CartRepository.getOrCreateCart error:', error)
      throw error
    }
  }

  /**
   * Add item to cart
   */
  async addItem(cartId: string, params: AddItemParams) {
    try {
      const { itemType, productId, serviceId, quantity, notes } = params

      // Check if item already exists in cart
      const existingItem = await this.prisma.cartItems.findFirst({
        where: {
          cartId,
          ...(productId && { productId }),
          ...(serviceId && { serviceId })
        }
      })

      if (existingItem) {
        // Update quantity if item already exists
        return await this.prisma.cartItems.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + quantity,
            updatedAt: new Date()
          }
        })
      }

      // Create new cart item
      const cartItem = await this.prisma.cartItems.create({
        data: {
          cartId,
          itemType,
          productId,
          serviceId,
          quantity,
          notes
        }
      })

      logger.info('Added item to cart:', { cartId, itemType, productId, serviceId, quantity })
      return cartItem
    } catch (error) {
      logger.error('CartRepository.addItem error:', error)
      throw error
    }
  }

  /**
   * Remove item from cart
   */
  async removeItem(cartItemId: string) {
    try {
      await this.prisma.cartItems.delete({
        where: { id: cartItemId }
      })

      logger.info('Removed item from cart:', { cartItemId })
    } catch (error) {
      logger.error('CartRepository.removeItem error:', error)
      throw error
    }
  }

  /**
   * Update item quantity
   */
  async updateItemQuantity(cartItemId: string, newQuantity: number) {
    try {
      await this.prisma.cartItems.update({
        where: { id: cartItemId },
        data: {
          quantity: newQuantity,
          updatedAt: new Date()
        }
      })

      logger.info('Updated cart item quantity:', { cartItemId, newQuantity })
    } catch (error) {
      logger.error('CartRepository.updateItemQuantity error:', error)
      throw error
    }
  }

  /**
   * Clear all items from cart
   */
  async clearCart(cartId: string) {
    try {
      await this.prisma.cartItems.deleteMany({
        where: { cartId }
      })

      logger.info('Cleared cart:', { cartId })
    } catch (error) {
      logger.error('CartRepository.clearCart error:', error)
      throw error
    }
  }

  /**
   * Get cart item by ID
   */
  async getItemById(cartItemId: string) {
    try {
      return await this.prisma.cartItems.findUnique({
        where: { id: cartItemId },
        include: {
          product: true,
          service: true
        }
      })
    } catch (error) {
      logger.error('CartRepository.getItemById error:', error)
      throw error
    }
  }

  /**
   * Get cart total value
   */
  async getCartTotal(cartId: string): Promise<number> {
    try {
      const cart = await this.prisma.carts.findUnique({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: {
                select: { price: true }
              },
              service: {
                select: { price: true }
              }
            }
          }
        }
      })

      if (!cart) return 0

      return cart.items.reduce((total, item) => {
        const price = item.product?.price || item.service?.price || 0
        return total + (price * item.quantity)
      }, 0)
    } catch (error) {
      logger.error('CartRepository.getCartTotal error:', error)
      throw error
    }
  }
}
