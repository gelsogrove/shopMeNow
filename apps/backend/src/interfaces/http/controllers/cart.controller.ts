import { Request, Response } from "express"
import { PriceCalculationService } from "../../../application/services/price-calculation.service"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { BillingPrices } from "../../../domain/enums/billing-prices.enum"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"

export class CartController {
  private secureTokenService = new SecureTokenService()

  /**
   * 🎯 TASK: Clean up orphaned cart items (items with missing products OR services)
   */
  private async cleanupOrphanedCartItems(workspaceId: string): Promise<void> {
    try {
      // Find ALL cart items for this workspace with relations loaded
      const allItems = await prisma.cartItems.findMany({
        where: {
          cart: {
            workspaceId: workspaceId,
          },
        },
        include: {
          cart: true,
          product: true,
          service: true,
        },
      })

      // Filter orphaned items in memory
      const orphanedItems = allItems.filter((item) => {
        // PRODUCT items without a product are orphaned
        if (item.itemType === "PRODUCT" && !item.product) {
          return true
        }
        // SERVICE items without a service are orphaned
        if (item.itemType === "SERVICE" && !item.service) {
          return true
        }
        return false
      })

      if (orphanedItems.length > 0) {
        logger.warn(
          `🧹 Found ${orphanedItems.length} orphaned cart items in workspace ${workspaceId}`
        )

        // Delete orphaned items
        await prisma.cartItems.deleteMany({
          where: {
            id: {
              in: orphanedItems.map((item) => item.id),
            },
          },
        })

        logger.info(`🧹 Cleaned up ${orphanedItems.length} orphaned cart items`)
      }
    } catch (error) {
      logger.error("❌ Error cleaning up orphaned cart items:", error)
      // Don't throw - we don't want cleanup to break the request
    }
  }

  /**
   * � Helper: Calculate product item pricing with discounts
   * Extracts duplicated logic from getCartByToken, addItemToCart, checkoutByToken
   */
  private async calculateProductItemPrice(
    item: any,
    workspaceId: string,
    customerDiscount: number
  ): Promise<{
    originalPrice: number
    finalPrice: number
    discountAmount: number
    appliedDiscount: number
    itemTotal: number
  }> {
    const priceService = new PriceCalculationService(prisma)

    const itemPrices = await priceService.calculatePricesWithDiscounts(
      workspaceId,
      [item.productId],
      customerDiscount
    )

    const originalPrice = item.product.price || 0
    const finalPrice = itemPrices.products[0]?.finalPrice || originalPrice
    const discountInfo = itemPrices.products[0]
    const appliedDiscount = discountInfo?.appliedDiscount || 0
    const discountAmount =
      appliedDiscount > 0 ? (originalPrice * appliedDiscount) / 100 : 0
    const itemTotal = finalPrice * item.quantity

    return {
      originalPrice,
      finalPrice,
      discountAmount,
      appliedDiscount,
      itemTotal,
    }
  }

  /**
   * 🎯 Helper: Calculate service item pricing (no discounts)
   * Extracts duplicated logic from getCartByToken, addItemToCart, checkoutByToken
   */
  private calculateServiceItemPrice(item: any): {
    originalPrice: number
    finalPrice: number
    discountAmount: number
    appliedDiscount: number
    itemTotal: number
  } {
    const originalPrice = item.service?.price || 0
    const finalPrice = originalPrice // Services are NEVER discounted
    const appliedDiscount = 0
    const discountAmount = 0
    const itemTotal = finalPrice * item.quantity

    return {
      originalPrice,
      finalPrice,
      discountAmount,
      appliedDiscount,
      itemTotal,
    }
  }

  /**
   * Helper: Calculate cart total amount (base prices without discounts)
   * Used in addItemToCart, updateCartItem, removeCartItem
   */
  private calculateCartTotal(items: any[]): number {
    return items.reduce((sum, item) => {
      if (item.itemType === "PRODUCT") {
        if (!item.product) {
          logger.warn(
            `Cart item ${item.id} has missing product (productId: ${item.productId})`
          )
          return sum
        }
        return sum + (item.product.price || 0) * item.quantity
      }
      if (item.itemType === "SERVICE") {
        if (!item.service) {
          logger.warn(
            `Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`
          )
          return sum
        }
        return sum + (item.service.price || 0) * item.quantity
      }
      return sum
    }, 0)
  }

  /**
   * �🆕 Generate a new cart token for public access
   */
  async generateToken(req: Request, res: Response): Promise<void> {
    try {
      const { customerId, workspaceId, expiresInMinutes = 60 } = req.body

      if (!customerId || !workspaceId) {
        res.status(400).json({
          success: false,
          error: "customerId and workspaceId are required",
        })
        return
      }

      // Verify customer exists
      const customer = await prisma.customers.findFirst({
        where: {
          id: customerId,
          workspaceId: workspaceId,
          isActive: true,
        },
      })

      if (!customer) {
        res.status(400).json({
          success: false,
          error: "Customer not found",
        })
        return
      }

      // Get or create cart for customer
      let cart = await prisma.carts.findFirst({
        where: {
          customerId: customerId,
          workspaceId: workspaceId,
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

      if (!cart) {
        cart = await prisma.carts.create({
          data: {
            customerId: customerId,
            workspaceId: workspaceId,
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
      }

      // Calculate total amount
      const totalAmount = cart.items.reduce((sum, item) => {
        const price =
          item.itemType === "PRODUCT"
            ? item.product?.price || 0
            : item.service?.price || 0
        return sum + price * item.quantity
      }, 0)

      // Generate token
      const tokenData = {
        customerId: customer.id,
        cartId: cart.id,
        items: cart.items,
        totalAmount: totalAmount,
        currency: customer.currency || "EUR",
        createdAt: new Date().toISOString(),
      }

      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

      const token = await this.secureTokenService.createToken(
        "cart",
        workspaceId,
        tokenData,
        `${expiresInMinutes}m`,
        undefined,
        undefined,
        undefined,
        customer.id
      )

      logger.info(
        `[CART] Token generated for customer ${customer.id}, cart ${cart.id}`
      )

      res.json({
        success: true,
        token: token,
        expiresAt: expiresAt.toISOString(),
        cartId: cart.id,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          company: customer.company,
        },
      })
    } catch (error) {
      logger.error("[CART] Error generating token:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Get cart contents by token
   */
  async getCartByToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token

      const validation = await this.secureTokenService.validateToken(token) // 🚀 KISS: Solo esistenza + non scaduto

      if (!validation.valid || !validation.payload) {
        res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        })
        return
      }

      const payload = validation.payload as any
      const customerId = payload.customerId || validation.data.customerId
      const workspaceId = validation.data.workspaceId

      // 🎯 TASK: Clean up orphaned cart items before retrieving cart
      await this.cleanupOrphanedCartItems(workspaceId)

      // Try to get existing cart by cartId (if available) or find/create cart for customer
      let cart = null

      if (payload.cartId) {
        // Token has specific cartId
        cart = await prisma.carts.findFirst({
          where: {
            id: payload.cartId,
            customerId: customerId,
            workspaceId: workspaceId,
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                    description: true,
                    formato: true,
                    imageUrl: true,
                  },
                },
                service: true,
              },
            },
            customer: true,
          },
        })
      } else {
        // Token doesn't have cartId (e.g., checkout token), find or create cart for customer
        cart = await prisma.carts.findFirst({
          where: {
            customerId: customerId,
            workspaceId: workspaceId,
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    price: true,
                    description: true,
                    formato: true,
                    imageUrl: true,
                  },
                },
                service: true,
              },
            },
            customer: true,
          },
        })

        // If no cart exists, create one
        if (!cart) {
          logger.info(
            `🛒 Creating new cart for customer ${customerId} in workspace ${workspaceId}`
          )
          cart = await prisma.carts.create({
            data: {
              customerId: customerId,
              workspaceId: workspaceId,
            },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      price: true,
                      description: true,
                      formato: true,
                      imageUrl: true,
                    },
                  },
                  service: true,
                },
              },
              customer: true,
            },
          })
        }
      }

      if (!cart) {
        res.status(400).json({
          success: false,
          error: "Cart not found",
        })
        return
      }

      logger.info(
        `🛒 Cart found with ${cart.items.length} items:`,
        cart.items.map((item) => ({
          id: item.id,
          itemType: item.itemType,
          productId: item.productId,
          serviceId: item.serviceId,
        }))
      )

      // Get customer discount
      const customerDiscount = cart.customer?.discount || 0

      // Calculate updated totals with discounts
      let totalAmount = 0
      const items = []

      for (const item of cart.items) {
        // Handle PRODUCT items
        if (item.itemType === "PRODUCT") {
          // 🎯 TASK: Handle missing product gracefully
          if (!item.product) {
            logger.warn(
              `⚠️ Cart item ${item.id} has missing product (productId: ${item.productId})`
            )
            items.push({
              id: item.id,
              type: "product",
              itemType: "PRODUCT",
              productId: item.productId,
              sku: "N/A",
              name: `Product ${item.productId} (Not Found)`,
              originalPrice: 0,
              finalPrice: 0,
              discountAmount: 0,
              appliedDiscount: 0,
              quantity: item.quantity,
              total: 0,
              imageUrl: [], // No image for missing product
            })
            continue
          }

          // 🚀 Use helper method to calculate pricing with discounts
          const pricing = await this.calculateProductItemPrice(
            item,
            validation.data.workspaceId,
            customerDiscount
          )
          totalAmount += pricing.itemTotal

          items.push({
            id: item.id,
            type: "product",
            itemType: "PRODUCT",
            productId: item.productId,
            sku: item.product.sku || item.productId,
            name: item.product.formato
              ? `${item.product.name} ${item.product.formato}`
              : item.product.name || `Product ${item.productId}`,
            formato: item.product.formato || null,
            originalPrice: pricing.originalPrice,
            finalPrice: pricing.finalPrice,
            discountAmount: pricing.discountAmount,
            appliedDiscount: pricing.appliedDiscount,
            quantity: item.quantity,
            total: pricing.itemTotal,
            imageUrl: item.product.imageUrl || [], // Add product images
          })
        }

        // Handle SERVICE items
        else if (item.itemType === "SERVICE") {
          if (!item.service) {
            logger.warn(
              `⚠️ Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`
            )
            items.push({
              id: item.id,
              type: "service",
              itemType: "SERVICE",
              serviceId: item.serviceId,
              serviceCode: "N/A",
              name: `Service ${item.serviceId} (Not Found)`,
              originalPrice: 0,
              finalPrice: 0,
              discountAmount: 0,
              appliedDiscount: 0,
              quantity: item.quantity,
              notes: item.notes || null,
              total: 0,
              imageUrl: [], // No image for missing service
            })
            continue
          }

          // 🚀 Use helper method to calculate service pricing (no discounts)
          const pricing = this.calculateServiceItemPrice(item)
          totalAmount += pricing.itemTotal

          items.push({
            id: item.id,
            type: "service",
            itemType: "SERVICE",
            serviceId: item.serviceId,
            serviceCode: item.service.code || item.serviceId,
            name: item.service.name || `Service ${item.serviceId}`,
            description: item.service.description || null,
            duration: item.service.duration || null,
            originalPrice: pricing.originalPrice,
            finalPrice: pricing.finalPrice,
            discountAmount: 0, // Services NEVER have discount amount
            appliedDiscount: 0, // Services NEVER have applied discount
            quantity: item.quantity,
            notes: item.notes || null,
            total: pricing.itemTotal,
            imageUrl: item.service.imageUrl || [], // Add service images
          })
        }
      }

      // 🚀 KISS: Return format compatible with CheckoutPage frontend
      res.json({
        success: true,
        data: {
          id: cart.id,
          customerId: cart.customerId,
          workspaceId: validation.data.workspaceId,
          items,
          totalItems: items.length,
          subtotal: totalAmount,
          totalDiscount: 0,
          finalTotal: totalAmount,
          lastUpdated: cart.updatedAt,
          createdAt: cart.createdAt,
        },
        // 🎯 Frontend expects these fields for CheckoutPage compatibility
        customer: {
          id: cart.customer.id,
          name: cart.customer.name,
          email: cart.customer.email,
          phone: cart.customer.phone,
          address: cart.customer.address, // Include address for frontend
          company: cart.customer.company, // Include company for frontend
          language: cart.customer.language, // 🌐 Include language for translations
        },
        prodotti: items.map((item) => ({
          id: item.id,
          itemType: item.itemType, // 🎯 CRITICAL: Include itemType (PRODUCT or SERVICE)
          productId: item.productId || null,
          serviceId: item.serviceId || null,
          codice:
            item.itemType === "PRODUCT" ? item.sku : item.serviceCode, // Use correct code based on type
          descrizione: item.name,
          formato: item.formato || null, // Only products have formato
          duration: item.duration || null, // Only services have duration
          notes: item.notes || null, // Only services have notes
          quantita: item.quantity,
          prezzo: item.originalPrice,
          prezzoScontato: item.finalPrice,
          sconto: item.appliedDiscount,
          totale: item.total,
        })),
      })
    } catch (error) {
      logger.error("[CART] Error getting cart by token:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Add item to cart by token
   */
  async addItemToCart(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token
      const {
        productId,
        serviceId,
        quantity = 1,
        notes,
        itemType = "PRODUCT",
      } = req.body

      // Validate that either productId or serviceId is provided
      if (!productId && !serviceId) {
        res.status(400).json({
          success: false,
          error: "Either productId or serviceId is required",
        })
        return
      }

      // Validate itemType matches the provided ID
      if (itemType === "PRODUCT" && !productId) {
        res.status(400).json({
          success: false,
          error: "productId is required when itemType is PRODUCT",
        })
        return
      }

      if (itemType === "SERVICE" && !serviceId) {
        res.status(400).json({
          success: false,
          error: "serviceId is required when itemType is SERVICE",
        })
        return
      }

      const validation = await this.secureTokenService.validateToken(token) // 🚀 KISS: Solo esistenza + non scaduto

      if (!validation.valid || !validation.payload) {
        res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        })
        return
      }

      const payload = validation.payload as any
      const customerId = payload.customerId || validation.data.customerId
      const workspaceId = validation.data.workspaceId

      // Get or create cart (following same logic as getCartByToken)
      let cart = await prisma.carts.findFirst({
        where: {
          id: payload.cartId,
          customerId: customerId,
          workspaceId: workspaceId,
        },
      })

      // If cart with specific ID not found, try to find or create cart for customer
      if (!cart) {
        cart = await prisma.carts.findFirst({
          where: {
            customerId: customerId,
            workspaceId: workspaceId,
          },
        })

        // If no cart exists for customer, create one
        if (!cart) {
          logger.info(
            `🛒 Creating new cart for customer ${customerId} in workspace ${workspaceId}`
          )
          cart = await prisma.carts.create({
            data: {
              customerId: customerId,
              workspaceId: workspaceId,
            },
          })
        }
      }

      // Verify product or service exists
      if (itemType === "PRODUCT" && productId) {
        const product = await prisma.products.findFirst({
          where: {
            id: productId,
            workspaceId: validation.data.workspaceId,
            isActive: true,
          },
        })

        if (!product) {
          res.status(400).json({
            success: false,
            error: "Product not found",
          })
          return
        }
      } else if (itemType === "SERVICE" && serviceId) {
        const service = await prisma.services.findFirst({
          where: {
            id: serviceId,
            workspaceId: validation.data.workspaceId,
          },
        })

        if (!service) {
          res.status(400).json({
            success: false,
            error: "Service not found",
          })
          return
        }
      }

      // Check if item already exists in cart
      const existingCartItem = await prisma.cartItems.findFirst({
        where: {
          cartId: cart.id,
          ...(itemType === "PRODUCT"
            ? { productId: productId }
            : { serviceId: serviceId }),
          itemType: itemType,
        },
      })

      let cartItem
      if (existingCartItem) {
        // Update quantity
        cartItem = await prisma.cartItems.update({
          where: { id: existingCartItem.id },
          data: {
            quantity: existingCartItem.quantity + quantity,
            ...(notes ? { notes } : {}),
          },
          include: {
            product: true,
            service: true,
          },
        })
      } else {
        // Create new cart item
        const createData = {
          cartId: cart.id,
          itemType: itemType,
          ...(productId ? { productId } : {}),
          ...(serviceId ? { serviceId } : {}),
          quantity,
          ...(notes ? { notes } : {}),
        }

        logger.info(`🔨 Creating cart item with data:`, createData)

        cartItem = await prisma.cartItems.create({
          data: createData,
          include: {
            product: true,
            service: true,
          },
        })

        logger.info(`✅ Cart item created:`, {
          id: cartItem.id,
          itemType: cartItem.itemType,
          productId: cartItem.productId,
          serviceId: cartItem.serviceId,
          hasProduct: !!cartItem.product,
          hasService: !!cartItem.service,
        })
      }

      // Calculate cart totals
      const cartWithItems = await prisma.carts.findFirst({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })

      const totalAmount = this.calculateCartTotal(cartWithItems!.items)

      logger.info(
        `[CART] Item added to cart ${cart.id} via token - ${itemType}: ${productId || serviceId}`
      )

      res.json({
        success: true,
        cartItem: {
          id: cartItem.id,
          type: itemType.toLowerCase(), // Use actual itemType (product or service)
          itemType: itemType, // Include full itemType for frontend
          name:
            itemType === "PRODUCT"
              ? cartItem.product?.name || `Product ${cartItem.productId}`
              : cartItem.service?.name || `Service ${cartItem.serviceId}`,
          formato:
            itemType === "PRODUCT" ? cartItem.product?.formato || null : null,
          duration:
            itemType === "SERVICE" ? cartItem.service?.duration || null : null,
          notes: cartItem.notes || null,
          price:
            itemType === "PRODUCT"
              ? cartItem.product?.price || 0
              : cartItem.service?.price || 0,
          quantity: cartItem.quantity,
          total:
            itemType === "PRODUCT"
              ? (cartItem.product?.price || 0) * cartItem.quantity
              : (cartItem.service?.price || 0) * cartItem.quantity,
        },
        cart: {
          totalAmount: totalAmount,
          itemCount: cartWithItems!.items.length,
        },
      })
    } catch (error) {
      logger.error("[CART] Error adding item to cart:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Update cart item by token
   */
  async updateCartItem(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token
      const itemId = req.params.productId // Keep param name for backwards compatibility
      const { quantity, itemType = "PRODUCT" } = req.body

      logger.info(
        `[CART] UPDATE ITEM - Token: ${token?.substring(0, 10)}..., ItemId: ${itemId}, ItemType: ${itemType}, Quantity: ${quantity}`
      )

      if (quantity === undefined) {
        res.status(400).json({
          success: false,
          error: "quantity is required",
        })
        return
      }

      const validation = await this.secureTokenService.validateToken(token) // 🚀 KISS: Solo esistenza + non scaduto

      if (!validation.valid || !validation.payload) {
        res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        })
        return
      }

      const payload = validation.payload as any
      const customerId = payload.customerId || validation.data.customerId
      const workspaceId = validation.data.workspaceId

      // Find the cart for this customer/token (same logic as getCartByToken)
      let cart = null

      if (payload.cartId) {
        // Token has specific cartId - look for that cart first
        cart = await prisma.carts.findFirst({
          where: {
            id: payload.cartId,
            customerId: customerId,
            workspaceId: workspaceId,
          },
        })
      }

      if (!cart) {
        // If no specific cart found, look for any cart for this customer
        cart = await prisma.carts.findFirst({
          where: {
            customerId: customerId,
            workspaceId: workspaceId,
          },
        })
      }

      if (!cart) {
        logger.error("[CART] UPDATE - Cart not found")
        res.status(400).json({
          success: false,
          error: "Cart not found",
        })
        return
      }

      logger.info(`[CART] UPDATE - Cart found: ${cart.id}`)

      // Find cart item by productId or serviceId depending on itemType
      const cartItem = await prisma.cartItems.findFirst({
        where: {
          cartId: cart.id,
          itemType: itemType,
          ...(itemType === "PRODUCT"
            ? { productId: itemId }
            : { serviceId: itemId }),
        },
        include: {
          product: true,
          service: true,
        },
      })

      logger.info(
        `[CART] UPDATE - Cart item found: ${cartItem ? cartItem.id : "null"}`
      )

      if (!cartItem) {
        logger.error(
          `[CART] UPDATE - Cart item not found for ${itemType}: ${itemId} in cart: ${cart.id}`
        )
        res.status(400).json({
          success: false,
          error: "Cart item not found",
        })
        return
      }

      logger.info(
        `[CART] UPDATE - Updating cart item ${cartItem.id} quantity from ${cartItem.quantity} to ${quantity}`
      )

      // Update cart item with explicit transaction
      const updatedCartItem = await prisma.$transaction(async (tx) => {
        const updated = await tx.cartItems.update({
          where: { id: cartItem.id },
          data: { quantity },
          include: {
            product: true,
            service: true,
          },
        })

        logger.info(
          `[CART] UPDATE - Transaction completed, updated quantity: ${updated.quantity}`
        )
        return updated
      })

      logger.info(
        `[CART] UPDATE - Cart item updated successfully: ${updatedCartItem.id}, new quantity: ${updatedCartItem.quantity}`
      )

      // Calculate cart totals
      const cartWithItems = await prisma.carts.findFirst({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })

      const totalAmount = this.calculateCartTotal(cartWithItems!.items)

      logger.info(
        `[CART] Item ${cartItem.id} updated in cart ${cart.id} via token`
      )

      const itemData =
        updatedCartItem.itemType === "PRODUCT"
          ? {
              id: updatedCartItem.id,
              type: "product",
              itemType: "PRODUCT",
              name:
                updatedCartItem.product?.name ||
                `Product ${updatedCartItem.productId}`,
              formato: updatedCartItem.product?.formato || null,
              price: updatedCartItem.product?.price || 0,
            }
          : {
              id: updatedCartItem.id,
              type: "service",
              itemType: "SERVICE",
              name:
                updatedCartItem.service?.name ||
                `Service ${updatedCartItem.serviceId}`,
              description: updatedCartItem.service?.description || null,
              price: updatedCartItem.service?.price || 0,
            }

      res.json({
        success: true,
        cartItem: {
          ...itemData,
          quantity: updatedCartItem.quantity,
          total:
            (updatedCartItem.product?.price || 0) * updatedCartItem.quantity,
        },
        cart: {
          totalAmount: totalAmount,
          itemCount: cartWithItems!.items.length,
        },
      })
    } catch (error) {
      logger.error("[CART] Error updating cart item:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Remove item from cart by token
   */
  async removeCartItem(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token
      const itemId = req.params.productId // Keep param name for backwards compatibility
      const { itemType = "PRODUCT" } = req.body

      const validation = await this.secureTokenService.validateToken(token) // 🚀 KISS: Solo esistenza + non scaduto

      if (!validation.valid || !validation.payload) {
        res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        })
        return
      }

      const payload = validation.payload as any
      const customerId = payload.customerId || validation.data.customerId
      const workspaceId = validation.data.workspaceId

      // Find the cart for this customer/token (same logic as getCartByToken)
      let cart = null

      if (payload.cartId) {
        // Token has specific cartId - look for that cart first
        cart = await prisma.carts.findFirst({
          where: {
            id: payload.cartId,
            customerId: customerId,
            workspaceId: workspaceId,
          },
        })
      }

      if (!cart) {
        // If no specific cart found, look for any cart for this customer
        cart = await prisma.carts.findFirst({
          where: {
            customerId: customerId,
            workspaceId: workspaceId,
          },
        })
      }

      if (!cart) {
        res.status(400).json({
          success: false,
          error: "Cart not found",
        })
        return
      }

      // Find cart item by productId or serviceId
      const cartItem = await prisma.cartItems.findFirst({
        where: {
          cartId: cart.id,
          itemType: itemType,
          ...(itemType === "PRODUCT"
            ? { productId: itemId }
            : { serviceId: itemId }),
        },
      })

      if (!cartItem) {
        res.status(400).json({
          success: false,
          error: "Cart item not found",
        })
        return
      }

      // Remove cart item
      await prisma.cartItems.delete({
        where: { id: cartItem.id },
      })

      // Calculate cart totals
      const cartWithItems = await prisma.carts.findFirst({
        where: { id: payload.cartId },
        include: {
          items: {
            include: {
              product: true,
              service: true,
            },
          },
        },
      })

      const totalAmount = this.calculateCartTotal(cartWithItems!.items)

      logger.info(
        `[CART] Item ${itemType} ${itemId} removed from cart ${cart.id} via token`
      )

      res.json({
        success: true,
        message: "Item removed from cart",
        cart: {
          totalAmount: totalAmount,
          itemCount: cartWithItems!.items.length,
        },
      })
    } catch (error) {
      logger.error("[CART] Error removing cart item:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Checkout cart by token
   */
  async checkoutByToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.params.token
      const { shippingAddress, paymentMethod = "CASH" } = req.body

      const validation = await this.secureTokenService.validateToken(token) // 🚀 KISS: Solo esistenza + non scaduto

      if (!validation.valid || !validation.payload) {
        res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        })
        return
      }

      const payload = validation.payload as any

      // Get cart with items
      const cart = await prisma.carts.findFirst({
        where: {
          id: payload.cartId,
          customerId: payload.customerId,
          workspaceId: validation.data.workspaceId,
        },
        include: {
          items: {
            include: {
              product: true,
              service: true, // ✅ Include services
            },
          },
          customer: true,
        },
      })

      if (!cart || cart.items.length === 0) {
        res.status(400).json({
          success: false,
          error: "Cart is empty or not found",
        })
        return
      }

      const totalAmount = cart.items.reduce((sum, item) => {
        // Handle PRODUCT items
        if (item.itemType === "PRODUCT") {
          if (!item.product) {
            logger.warn(
              `⚠️ Cart item ${item.id} has missing product (productId: ${item.productId})`
            )
            return sum
          }
          return sum + (item.product.price || 0) * item.quantity
        }

        // Handle SERVICE items
        if (item.itemType === "SERVICE") {
          if (!item.service) {
            logger.warn(
              `⚠️ Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`
            )
            return sum
          }
          return sum + (item.service.price || 0) * item.quantity
        }

        return sum
      }, 0)

      // Generate unique order code - 5 uppercase letters
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      let orderCode = ""
      for (let i = 0; i < 5; i++) {
        orderCode += letters.charAt(Math.floor(Math.random() * letters.length))
      }

      // 🔒 TRANSACTION: Ensure order creation, customer update, and cart clearing are atomic
      // Prevents: duplicate orders if cart clear fails, orphan orders if customer update crashes
      const order = await prisma.$transaction(async (tx) => {
        // 1️⃣ Create order with items
        const newOrder = await tx.orders.create({
          data: {
            orderCode,
            customerId: cart.customerId,
            workspaceId: validation.data.workspaceId,
            totalAmount: totalAmount,
            status: "PENDING",
            paymentMethod: paymentMethod as any,
            shippingAddress: shippingAddress || cart.customer.address,
            items: {
              create: cart.items.map((item) => {
                // Handle PRODUCT items
                if (item.itemType === "PRODUCT") {
                  if (!item.product) {
                    logger.warn(
                      `⚠️ Cart item ${item.id} has missing product (productId: ${item.productId})`
                    )
                    return {
                      itemType: "PRODUCT",
                      productId: item.productId,
                      quantity: item.quantity,
                      unitPrice: 0,
                      totalPrice: 0,
                    }
                  }
                  return {
                    itemType: "PRODUCT",
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.product.price || 0,
                    totalPrice: (item.product.price || 0) * item.quantity,
                  }
                }

                // Handle SERVICE items
                if (item.itemType === "SERVICE") {
                  if (!item.service) {
                    logger.warn(
                      `⚠️ Cart item ${item.id} has missing service (serviceId: ${item.serviceId})`
                    )
                    return {
                      itemType: "SERVICE",
                      serviceId: item.serviceId,
                      quantity: item.quantity,
                      unitPrice: 0,
                      totalPrice: 0,
                    }
                  }
                  return {
                    itemType: "SERVICE",
                    serviceId: item.serviceId,
                    quantity: item.quantity,
                    unitPrice: item.service.price || 0,
                    totalPrice: (item.service.price || 0) * item.quantity,
                  }
                }

                // Fallback for unknown item types
                logger.warn(
                  `⚠️ Cart item ${item.id} has unknown itemType: ${item.itemType}`
                )
                return {
                  itemType: "PRODUCT",
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: 0,
                  totalPrice: 0,
                }
              }),
            },
          },
          include: {
            items: true,
          },
        })

        // 2️⃣ Auto-update customer address in database (within transaction)
        const hasValidShippingAddress =
          shippingAddress &&
          shippingAddress.firstName &&
          shippingAddress.lastName &&
          shippingAddress.address &&
          shippingAddress.city &&
          shippingAddress.postalCode

        if (hasValidShippingAddress) {
          // Create structured address object for customer
          const customerAddress = {
            name: `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim(),
            street: shippingAddress.address,
            city: shippingAddress.city,
            postalCode: shippingAddress.postalCode,
            province: shippingAddress.province || "",
            country: shippingAddress.country || "Italy",
            phone: shippingAddress.phone || cart.customer.phone || "",
          }

          await tx.customers.update({
            where: {
              id: cart.customerId,
              workspaceId: validation.data.workspaceId,
            },
            data: {
              address: JSON.stringify(customerAddress),
              updatedAt: new Date(),
            },
          })

          logger.info(
            `[CART] Auto-updated customer address for ${cart.customerId}:`,
            customerAddress
          )
        } else {
          logger.info(
            `[CART] No valid shipping address provided for customer ${cart.customerId}, using existing address`
          )
        }

        // 3️⃣ Clear cart items (within transaction)
        await tx.cartItems.deleteMany({
          where: { cartId: cart.id },
        })

        return newOrder
      })

      // Invalidate token (optional since user might want to create new orders)
      // await this.secureTokenService.invalidateToken(token)

      logger.info(
        `[CART] Checkout completed for cart ${cart.id}, order ${order.id} created via token`
      )

      res.json({
        success: true,
        order: {
          id: order.id,
          orderCode: order.orderCode,
          totalAmount: order.totalAmount,
          status: order.status,
          createdAt: order.createdAt,
          itemCount: order.items.length,
        },
        message: "Checkout completed successfully",
      })
    } catch (error) {
      logger.error("[CART] Error during checkout:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const token = req.query.token as string

      if (!token) {
        res.status(400).json({
          valid: false,
          error: "Token is required",
        })
        return
      }

      const validation = await this.secureTokenService.validateToken(token) // 🚀 KISS: Solo esistenza + non scaduto

      if (!validation.valid) {
        res.status(400).json({
          valid: false,
          error: "Token non valido o scaduto",
          errorType: "INVALID_TOKEN",
        })
        return
      }

      const secureToken = validation.data

      if (!validation.payload) {
        res.status(400).json({
          valid: false,
          error: "Token corrotto",
          errorType: "CORRUPTED_TOKEN",
        })
        return
      }

      const payload = validation.payload as any
      const customer = await prisma.customers.findFirst({
        where: {
          id: payload.customerId,
          workspaceId: secureToken.workspaceId,
        },
      })

      if (!customer) {
        res.status(400).json({
          valid: false,
          error: "Customer not found",
        })
        return
      }

      logger.info(`[CART] Token validated for customer ${customer.id}`)

      res.json({
        success: true,
        data: {
          id: payload.cartId,
          customerId: customer.id,
          workspaceId: secureToken.workspaceId,
          items: (payload.items || []).map((item: any) => ({
            id: item.id,
            productId: item.productId || "",
            sku: item.code,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.finalPrice,
            totalPrice: item.total,
            discountAmount: item.appliedDiscount
              ? (item.originalPrice - item.finalPrice) * item.quantity
              : 0,
            finalPrice: item.finalPrice,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })),
          totalItems: (payload.items || []).reduce(
            (sum: number, item: any) => sum + item.quantity,
            0
          ),
          subtotal: payload.totalAmount,
          totalDiscount: (payload.items || []).reduce(
            (sum: number, item: any) => {
              return (
                sum +
                (item.appliedDiscount
                  ? (item.originalPrice - item.finalPrice) * item.quantity
                  : 0)
              )
            },
            0
          ),
          finalTotal: payload.totalAmount,
          lastUpdated: new Date().toISOString(),
          createdAt: payload.createdAt || new Date().toISOString(),
        },
      })
    } catch (error) {
      logger.error("[CART] Error validating token:", error)
      res.status(500).json({
        valid: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * 💰 Calculate discounted price for a product
   * Used by admin panel when adding products to orders manually
   * Applies same discount logic as web cart (customer discount + active offers)
   */
  async calculatePrice(req: Request, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params
      const { productId, quantity = 1, customerId } = req.body

      if (!productId) {
        res.status(400).json({ error: "Product ID is required" })
        return
      }

      // Get product details
      const product = await prisma.products.findFirst({
        where: {
          id: productId,
          workspaceId: workspaceId,
        },
      })

      if (!product) {
        res.status(404).json({ error: "Product not found" })
        return
      }

      // Get customer discount if customerId provided
      let customerDiscount = 0
      if (customerId) {
        const customer = await prisma.customers.findFirst({
          where: {
            id: customerId,
            workspaceId: workspaceId,
          },
        })
        if (customer) {
          customerDiscount = customer.discount || 0
          logger.info(
            `[CART] Customer ${customer.name} has ${customerDiscount}% discount`
          )
        }
      }

      // Calculate price with discounts (including customer discount)
      const priceService = new PriceCalculationService(prisma)
      logger.info(
        `[CART] Calculating price for product ${productId} in workspace ${workspaceId} with customer discount ${customerDiscount}%`
      )

      const result = await priceService.calculatePricesWithDiscounts(
        workspaceId,
        [productId],
        customerDiscount
      )

      logger.info(
        `[CART] Price calculation result:`,
        JSON.stringify(result, null, 2)
      )

      if (result.products.length === 0) {
        res.status(404).json({ error: "Product pricing not found" })
        return
      }

      const productPricing = result.products[0]
      const originalPrice = product.price
      const unitPrice = productPricing.finalPrice || originalPrice
      const totalPrice = unitPrice * quantity

      logger.info(
        `[CART] Final pricing - Original: ${originalPrice}, Unit: ${unitPrice}, Total: ${totalPrice}, Discount: ${productPricing.appliedDiscount}%`
      )

      // Build discount message if applicable
      let discountApplied = null
      if (
        productPricing.appliedDiscount &&
        productPricing.appliedDiscount > 0
      ) {
        discountApplied = `${productPricing.appliedDiscount}% off`
        if (productPricing.discountName) {
          discountApplied += ` (${productPricing.discountName})`
        }
      }

      res.json({
        productId,
        productName: product.name,
        quantity,
        originalPrice,
        unitPrice,
        totalPrice,
        discountApplied,
        appliedDiscountPercent: productPricing.appliedDiscount || 0,
      })
    } catch (error) {
      logger.error("[CART] Error calculating price:", error)
      res.status(500).json({
        error: "Failed to calculate price",
        message: (error as Error).message,
      })
    }
  }
}
