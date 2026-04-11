/**
 * OpenAI Agents SDK - Cart Tools
 * 
 * Tools for cart management: add items, remove items, view cart, clear cart.
 * 
 * @architecture Clean Architecture - Tools layer
 * @security ALL queries filtered by workspaceId AND customerId
 * @critical NO hardcoded data - all from database
 */

import { tool } from "@openai/agents"
import { z } from "zod"
import { AgentContext, CartResult, CartItemResult, ToolResult } from "../types"
import logger from "../../../utils/logger"

/**
 * Get customer's cart
 */
export const getCartTool = tool({
  name: "get_cart",
  description: `Get the customer's current shopping cart with all items and totals.
    Use this when the customer asks to see their cart, basket, or wants to know what they have selected.`,
  parameters: z.object({}),
  execute: async (_, { context }) => {
    const ctx = context as AgentContext
    
    try {
      logger.info(`🛒 [getCart] Customer: ${ctx.customerId}, Workspace: ${ctx.workspaceId}`)
      
      // Find or create cart
      let cart = await ctx.prisma.carts.findUnique({
        where: { customerId: ctx.customerId },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })
      
      // Verify workspace isolation
      if (cart && cart.workspaceId !== ctx.workspaceId) {
        logger.error(`🚨 [getCart] Workspace mismatch! Cart: ${cart.workspaceId}, Context: ${ctx.workspaceId}`)
        return {
          success: false,
          error: "Workspace mismatch",
          message: "Errore di sicurezza",
        } as ToolResult<CartResult>
      }
      
      if (!cart || cart.items.length === 0) {
        return {
          success: true,
          data: {
            id: cart?.id || "",
            items: [],
            totalItems: 0,
            subtotal: 0,
            discount: 0,
            total: 0,
          },
          message: "Il carrello è vuoto",
        } as ToolResult<CartResult>
      }
      
      // Calculate totals
      const customerDiscount = ctx.customerDiscount || 0
      let subtotal = 0
      
      const items: CartItemResult[] = cart.items.map((item) => {
        const name = item.product?.name || item.service?.name || "Unknown"
        const unitPrice = Number(item.product?.price || item.service?.price || 0)
        const totalPrice = unitPrice * item.quantity
        subtotal += totalPrice
        
        return {
          id: item.id,
          productId: item.productId || undefined,
          serviceId: item.serviceId || undefined,
          productName: item.product?.name,
          serviceName: item.service?.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          notes: item.notes || undefined,
        }
      })
      
      const discount = customerDiscount > 0 ? subtotal * (customerDiscount / 100) : 0
      const total = subtotal - discount
      
      return {
        success: true,
        data: {
          id: cart.id,
          items,
          totalItems: items.reduce((acc, i) => acc + i.quantity, 0),
          subtotal,
          discount,
          total,
        },
        message: `Carrello con ${items.length} articoli`,
      } as ToolResult<CartResult>
      
    } catch (error) {
      logger.error(`❌ [getCart] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nel recupero del carrello",
      } as ToolResult<CartResult>
    }
  },
})

/**
 * Add item to cart
 */
export const addToCartTool = tool({
  name: "add_to_cart",
  description: `Add a product or service to the customer's cart.
    Use this when the customer wants to add something to their cart/basket.
    Requires product ID and quantity.`,
  parameters: z.object({
    productId: z.string().optional().describe("Product ID to add"),
    serviceId: z.string().optional().describe("Service ID to add"),
    quantity: z.number().min(1).default(1).describe("Quantity to add"),
    notes: z.string().optional().describe("Optional notes for this item"),
  }),
  execute: async ({ productId, serviceId, quantity, notes }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      if (!productId && !serviceId) {
        return {
          success: false,
          error: "Product or service ID required",
          message: "Specifica quale prodotto o servizio vuoi aggiungere",
        } as ToolResult<CartItemResult>
      }
      
      logger.info(`🛒 [addToCart] Adding ${productId || serviceId}, qty: ${quantity}`)
      
      // Verify product/service exists and belongs to workspace
      if (productId) {
        const product = await ctx.prisma.products.findFirst({
          where: {
            id: productId,
            workspaceId: ctx.workspaceId,
            isActive: true,
          },
        })
        
        if (!product) {
          return {
            success: false,
            error: "Product not found",
            message: "Prodotto non trovato o non disponibile",
          } as ToolResult<CartItemResult>
        }
        
        if (product.stock < quantity) {
          return {
            success: false,
            error: "Insufficient stock",
            message: `Disponibilità insufficiente. Stock disponibile: ${product.stock}`,
          } as ToolResult<CartItemResult>
        }
      }
      
      if (serviceId) {
        const service = await ctx.prisma.services.findFirst({
          where: {
            id: serviceId,
            workspaceId: ctx.workspaceId,
            isActive: true,
          },
        })
        
        if (!service) {
          return {
            success: false,
            error: "Service not found",
            message: "Servizio non trovato o non disponibile",
          } as ToolResult<CartItemResult>
        }
      }
      
      // Find or create cart
      let cart = await ctx.prisma.carts.findUnique({
        where: { customerId: ctx.customerId },
      })
      
      if (!cart) {
        cart = await ctx.prisma.carts.create({
          data: {
            customerId: ctx.customerId,
            workspaceId: ctx.workspaceId,
          },
        })
      }
      
      // Check if item already in cart
      const existingItem = await ctx.prisma.cartItems.findFirst({
        where: {
          cartId: cart.id,
          productId: productId || null,
          serviceId: serviceId || null,
        },
      })
      
      let cartItem
      if (existingItem) {
        // Update quantity
        cartItem = await ctx.prisma.cartItems.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + quantity,
            notes: notes || existingItem.notes,
          },
          include: {
            product: true,
            service: true,
          },
        })
      } else {
        // Create new item
        cartItem = await ctx.prisma.cartItems.create({
          data: {
            cartId: cart.id,
            productId: productId || null,
            serviceId: serviceId || null,
            itemType: productId ? "PRODUCT" : "SERVICE",
            quantity,
            notes,
          },
          include: {
            product: true,
            service: true,
          },
        })
      }
      
      const unitPrice = cartItem.product?.price || cartItem.service?.price || 0
      
      return {
        success: true,
        data: {
          id: cartItem.id,
          productId: cartItem.productId || undefined,
          serviceId: cartItem.serviceId || undefined,
          productName: cartItem.product?.name,
          serviceName: cartItem.service?.name,
          quantity: cartItem.quantity,
          unitPrice,
          totalPrice: unitPrice * cartItem.quantity,
          notes: cartItem.notes || undefined,
        },
        message: `Aggiunto ${cartItem.quantity}x "${cartItem.product?.name || cartItem.service?.name}" al carrello`,
      } as ToolResult<CartItemResult>
      
    } catch (error) {
      logger.error(`❌ [addToCart] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nell'aggiunta al carrello",
      } as ToolResult<CartItemResult>
    }
  },
})

/**
 * Remove item from cart
 */
export const removeFromCartTool = tool({
  name: "remove_from_cart",
  description: `Remove an item from the customer's cart.
    Use this when the customer wants to remove something from their cart.`,
  parameters: z.object({
    cartItemId: z.string().optional().describe("Cart item ID to remove"),
    productId: z.string().optional().describe("Product ID to remove"),
    serviceId: z.string().optional().describe("Service ID to remove"),
    quantity: z.number().optional().describe("Quantity to remove (if omitted, removes all)"),
  }),
  execute: async ({ cartItemId, productId, serviceId, quantity }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const cart = await ctx.prisma.carts.findUnique({
        where: { customerId: ctx.customerId },
      })
      
      if (!cart || cart.workspaceId !== ctx.workspaceId) {
        return {
          success: false,
          error: "Cart not found",
          message: "Carrello non trovato",
        } as ToolResult<boolean>
      }
      
      // Find the item
      let whereClause: any = { cartId: cart.id }
      if (cartItemId) {
        whereClause.id = cartItemId
      } else if (productId) {
        whereClause.productId = productId
      } else if (serviceId) {
        whereClause.serviceId = serviceId
      } else {
        return {
          success: false,
          error: "Item identifier required",
          message: "Specifica quale articolo vuoi rimuovere",
        } as ToolResult<boolean>
      }
      
      const item = await ctx.prisma.cartItems.findFirst({
        where: whereClause,
        include: { product: true, service: true },
      })
      
      if (!item) {
        return {
          success: false,
          error: "Item not found in cart",
          message: "Articolo non trovato nel carrello",
        } as ToolResult<boolean>
      }
      
      const itemName = item.product?.name || item.service?.name
      
      if (quantity && quantity < item.quantity) {
        // Reduce quantity
        await ctx.prisma.cartItems.update({
          where: { id: item.id },
          data: { quantity: item.quantity - quantity },
        })
        return {
          success: true,
          data: true,
          message: `Rimosso ${quantity}x "${itemName}" dal carrello`,
        } as ToolResult<boolean>
      } else {
        // Remove entirely
        await ctx.prisma.cartItems.delete({
          where: { id: item.id },
        })
        return {
          success: true,
          data: true,
          message: `"${itemName}" rimosso dal carrello`,
        } as ToolResult<boolean>
      }
      
    } catch (error) {
      logger.error(`❌ [removeFromCart] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nella rimozione dal carrello",
      } as ToolResult<boolean>
    }
  },
})

/**
 * Update cart item quantity
 */
export const updateCartQuantityTool = tool({
  name: "update_cart_quantity",
  description: `Update the quantity of an item in the cart.
    Use this when the customer wants to change how many of something they want.`,
  parameters: z.object({
    cartItemId: z.string().optional().describe("Cart item ID"),
    productId: z.string().optional().describe("Product ID"),
    newQuantity: z.number().min(0).describe("New quantity (0 to remove)"),
  }),
  execute: async ({ cartItemId, productId, newQuantity }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      const cart = await ctx.prisma.carts.findUnique({
        where: { customerId: ctx.customerId },
      })
      
      if (!cart || cart.workspaceId !== ctx.workspaceId) {
        return {
          success: false,
          error: "Cart not found",
          message: "Carrello non trovato",
        } as ToolResult<CartItemResult>
      }
      
      let whereClause: any = { cartId: cart.id }
      if (cartItemId) {
        whereClause.id = cartItemId
      } else if (productId) {
        whereClause.productId = productId
      } else {
        return {
          success: false,
          error: "Item identifier required",
          message: "Specifica quale articolo modificare",
        } as ToolResult<CartItemResult>
      }
      
      const item = await ctx.prisma.cartItems.findFirst({
        where: whereClause,
        include: { product: true, service: true },
      })
      
      if (!item) {
        return {
          success: false,
          error: "Item not found",
          message: "Articolo non trovato nel carrello",
        } as ToolResult<CartItemResult>
      }
      
      const itemName = item.product?.name || item.service?.name
      
      if (newQuantity === 0) {
        await ctx.prisma.cartItems.delete({ where: { id: item.id, cart: { workspaceId: ctx.workspaceId } } })
        return {
          success: true,
          message: `"${itemName}" rimosso dal carrello`,
        } as ToolResult<CartItemResult>
      }
      
      // Check stock
      if (item.product && item.product.stock < newQuantity) {
        return {
          success: false,
          error: "Insufficient stock",
          message: `Disponibilità insufficiente. Stock: ${item.product.stock}`,
        } as ToolResult<CartItemResult>
      }
      
      const updated = await ctx.prisma.cartItems.update({
        where: { id: item.id },
        data: { quantity: newQuantity },
        include: { product: true, service: true },
      })
      
      const unitPrice = Number(updated.product?.price || updated.service?.price || 0)
      
      return {
        success: true,
        data: {
          id: updated.id,
          productId: updated.productId || undefined,
          serviceId: updated.serviceId || undefined,
          productName: updated.product?.name,
          serviceName: updated.service?.name,
          quantity: updated.quantity,
          unitPrice,
          totalPrice: unitPrice * updated.quantity,
          notes: updated.notes || undefined,
        },
        message: `Quantità di "${itemName}" aggiornata a ${newQuantity}`,
      } as ToolResult<CartItemResult>
      
    } catch (error) {
      logger.error(`❌ [updateCartQuantity] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nell'aggiornamento quantità",
      } as ToolResult<CartItemResult>
    }
  },
})

/**
 * Clear entire cart
 */
export const clearCartTool = tool({
  name: "clear_cart",
  description: `Clear all items from the customer's cart.
    Use this when the customer wants to empty their cart completely.`,
  parameters: z.object({
    confirm: z.boolean().describe("Confirmation to clear cart"),
  }),
  execute: async ({ confirm }, { context }) => {
    const ctx = context as AgentContext
    
    try {
      if (!confirm) {
        return {
          success: false,
          error: "Confirmation required",
          message: "Conferma che vuoi svuotare il carrello",
        } as ToolResult<boolean>
      }
      
      const cart = await ctx.prisma.carts.findUnique({
        where: { customerId: ctx.customerId },
      })
      
      if (!cart || cart.workspaceId !== ctx.workspaceId) {
        return {
          success: true,
          data: true,
          message: "Il carrello è già vuoto",
        } as ToolResult<boolean>
      }
      
      await ctx.prisma.cartItems.deleteMany({
        where: { cartId: cart.id },
      })
      
      return {
        success: true,
        data: true,
        message: "Carrello svuotato",
      } as ToolResult<boolean>
      
    } catch (error) {
      logger.error(`❌ [clearCart] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nello svuotamento del carrello",
      } as ToolResult<boolean>
    }
  },
})

/**
 * Get cart link for checkout
 */
export const getCartLinkTool = tool({
  name: "get_cart_link",
  description: `Generate a secure link for the customer to view and checkout their cart.
    Use this when the customer is ready to checkout or wants to view their cart in the browser.`,
  parameters: z.object({}),
  execute: async (_, { context }) => {
    const ctx = context as AgentContext
    
    try {
      // Import SecureTokenService
      const { SecureTokenService } = await import("../../services/secure-token.service")
      const secureTokenService = new SecureTokenService()
      
      const token = await secureTokenService.createToken(
        "cart",
        ctx.workspaceId,
        undefined,  // payload
        "1h",       // expiresIn
        undefined,  // userId
        undefined,  // phoneNumber
        undefined,  // ipAddress
        ctx.customerId
      )
      
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000"
      const cartUrl = `${baseUrl}/cart-public?token=${token}`
      
      return {
        success: true,
        data: cartUrl,
        message: "Link carrello generato (valido 1 ora)",
      } as ToolResult<string>
      
    } catch (error) {
      logger.error(`❌ [getCartLink] Error:`, error)
      return {
        success: false,
        error: (error as Error).message,
        message: "Errore nella generazione del link carrello",
      } as ToolResult<string>
    }
  },
})

// Export all cart tools
export const cartTools = [
  getCartTool,
  addToCartTool,
  removeFromCartTool,
  updateCartQuantityTool,
  clearCartTool,
  getCartLinkTool,
]
