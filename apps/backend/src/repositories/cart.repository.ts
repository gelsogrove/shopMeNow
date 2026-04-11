/**
 * Cart Repository
 * 
 * Data access layer for cart operations.
 * Handles all database interactions for carts and cart items.
 * 
 * @architecture Clean Architecture - Repository Pattern
 */

import { PrismaClient, ItemType } from '@echatbot/database'
import logger from '../utils/logger'
import { prisma } from "@echatbot/database"

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
    this.prisma = prisma
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

      // If no cart exists, create one (with retry on unique constraint violation)
      if (!cart) {
        try {
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
        } catch (createError: any) {
          // P2002 = Unique constraint violation (race condition: another request created the cart)
          if (createError.code === 'P2002') {
            logger.warn('Cart creation race condition, fetching existing cart:', { customerId })
            cart = await this.prisma.carts.findUnique({
              where: { customerId },
              include: {
                items: {
                  include: {
                    product: {
                      select: { id: true, name: true, price: true, stock: true, isActive: true }
                    },
                    service: {
                      select: { id: true, name: true, price: true, isActive: true }
                    }
                  }
                }
              }
            })
            if (!cart) throw createError
          } else {
            throw createError
          }
        }
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
        // ✅ Feature 191: Services can only have quantity 1 (no stacking)
        if (itemType === 'SERVICE') {
          logger.info('Service already in cart, keeping quantity 1:', { cartId, serviceId })
          // Return existing item without updating - service already in cart
          return existingItem
        }
        
        // For products, update quantity (stack)
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
   * @param cartItemId Cart item ID
   * @param workspaceId Workspace ID for security validation
   */
  async removeItem(cartItemId: string, workspaceId: string) {
    try {
      // SECURITY: First verify the item belongs to this workspace
      const cartItem = await this.prisma.cartItems.findUnique({
        where: { id: cartItemId },
        include: {
          cart: {
            select: { workspaceId: true }
          }
        }
      })

      if (!cartItem) {
        throw new Error('Cart item not found')
      }

      if (cartItem.cart.workspaceId !== workspaceId) {
        logger.warn('🚨 SECURITY: Attempted cross-workspace cart item deletion', {
          cartItemId,
          requestedWorkspaceId: workspaceId,
          actualWorkspaceId: cartItem.cart.workspaceId
        })
        throw new Error('Cart item not found') // Don't reveal it exists in another workspace
      }

      await this.prisma.cartItems.delete({
        where: { id: cartItemId }
      })

      logger.info('Removed item from cart:', { cartItemId, workspaceId })
    } catch (error) {
      logger.error('CartRepository.removeItem error:', error)
      throw error
    }
  }

  /**
   * Update item quantity
   * @param cartItemId Cart item ID
   * @param newQuantity New quantity
   * @param workspaceId Workspace ID for security validation
   */
  async updateItemQuantity(cartItemId: string, newQuantity: number, workspaceId: string) {
    try {
      // SECURITY: First verify the item belongs to this workspace
      const cartItem = await this.prisma.cartItems.findUnique({
        where: { id: cartItemId },
        include: {
          cart: {
            select: { workspaceId: true }
          }
        }
      })

      if (!cartItem) {
        throw new Error('Cart item not found')
      }

      if (cartItem.cart.workspaceId !== workspaceId) {
        logger.warn('🚨 SECURITY: Attempted cross-workspace cart item update', {
          cartItemId,
          requestedWorkspaceId: workspaceId,
          actualWorkspaceId: cartItem.cart.workspaceId
        })
        throw new Error('Cart item not found') // Don't reveal it exists in another workspace
      }

      await this.prisma.cartItems.update({
        where: { id: cartItemId },
        data: {
          quantity: newQuantity,
          updatedAt: new Date()
        }
      })

      logger.info('Updated cart item quantity:', { cartItemId, newQuantity, workspaceId })
    } catch (error) {
      logger.error('CartRepository.updateItemQuantity error:', error)
      throw error
    }
  }

  /**
   * Clear all items from cart
   * @param cartId Cart ID
   * @param workspaceId Workspace ID for security validation
   */
  async clearCart(cartId: string, workspaceId: string) {
    try {
      // SECURITY: First verify the cart belongs to this workspace
      const cart = await this.prisma.carts.findUnique({
        where: { id: cartId },
        select: { workspaceId: true }
      })

      if (!cart) {
        throw new Error('Cart not found')
      }

      if (cart.workspaceId !== workspaceId) {
        logger.warn('🚨 SECURITY: Attempted cross-workspace cart clear', {
          cartId,
          requestedWorkspaceId: workspaceId,
          actualWorkspaceId: cart.workspaceId
        })
        throw new Error('Cart not found') // Don't reveal it exists in another workspace
      }

      await this.prisma.cartItems.deleteMany({
        where: { cartId }
      })

      logger.info('Cleared cart:', { cartId, workspaceId })
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
        const price = Number(item.product?.price || item.service?.price || 0)
        return total + (price * item.quantity)
      }, 0)
    } catch (error) {
      logger.error('CartRepository.getCartTotal error:', error)
      throw error
    }
  }
}
