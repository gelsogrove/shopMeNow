import { Request, Response } from "express"
import { BillingService } from "../../../application/services/billing.service"
import { EmailService } from "../../../application/services/email.service"
import { PriceCalculationService } from "../../../application/services/price-calculation.service"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { prisma } from "../../../lib/prisma"
import { pushMessagingService } from "../../../services/push-messaging.service"
import logger from "../../../utils/logger"

export class CheckoutController {
  private billingService = new BillingService(prisma)
  private emailService = new EmailService()
  private secureTokenService = new SecureTokenService()
  private priceCalculationService = new PriceCalculationService(prisma)

  /**
   * Validate checkout token and return order data
   */
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

      // Use SecureTokenService for unified token validation
      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid) {
        res.status(400).json({
          valid: false,
          error: "Token non valido o scaduto",
          errorType: "INVALID_TOKEN",
        })
        return
      }

      const secureToken = validation.data

      // Check payload validity
      if (!validation.payload) {
        res.status(400).json({
          valid: false,
          error: "Token corrotto",
          errorType: "CORRUPTED_TOKEN",
        })
        return
      }

      // Get customer and workspace data
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

      logger.info(`[CHECKOUT] Token validated for customer ${customer.id}`)

      // Get customer cart products AND services from database
      const cart = await prisma.carts.findFirst({
        where: {
          customerId: customer.id,
          workspaceId: secureToken.workspaceId,
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

      // Calculate prices with discounts applied
      // 🎯 Filter out null productIds (from SERVICE items)
      const productIds =
        cart?.items
          .filter((item) => item.productId !== null)
          .map((item) => item.productId) || []
      const priceResult =
        await this.priceCalculationService.calculatePricesWithDiscounts(
          secureToken.workspaceId,
          productIds,
          customer.discount || 0
        )

      // Create a map of product prices with discounts
      const productPriceMap = new Map()
      priceResult.products.forEach((product) => {
        productPriceMap.set(product.id, {
          finalPrice: product.finalPrice || product.price,
          originalPrice: product.originalPrice,
          appliedDiscount: product.appliedDiscount || 0,
          discountSource: product.discountSource,
          discountName: product.discountName,
        })
      })

      // Calculate cart totals with discounted prices
      let totalAmount = 0
      const cartItems =
        cart?.items.map((item) => {
          // Handle SERVICE items - Services are NEVER discounted
          if (item.itemType === "SERVICE" && item.service) {
            const originalPrice = Number(item.service.price || 0)
            const finalPrice = originalPrice // Services NEVER have discount
            const itemTotal = finalPrice * item.quantity
            totalAmount += itemTotal

            return {
              id: item.id,
              itemType: "SERVICE",
              serviceId: item.serviceId,
              codice: item.service.code || "N/A",
              descrizione: item.service.name,
              formato: null,
              duration: item.service.duration,
              notes: item.notes,
              prezzo: finalPrice,
              prezzoOriginale: originalPrice,
              scontoApplicato: 0, // Services NEVER have discount
              fonteSconto: undefined,
              nomeSconto: undefined,
              qty: item.quantity,
              total: itemTotal,
            }
          }

          // Handle PRODUCT items
          const priceInfo = productPriceMap.get(item.productId) || {
            finalPrice: item.product?.price || 0,
            originalPrice: item.product?.price || 0,
            appliedDiscount: 0,
            discountSource: undefined,
            discountName: undefined,
          }

          const itemTotal = priceInfo.finalPrice * item.quantity
          totalAmount += itemTotal

          return {
            id: item.id,
            itemType: "PRODUCT",
            productId: item.productId,
            codice: item.product?.sku || "N/A",
            descrizione: item.product?.name || "Unknown Product",
            formato: item.product?.formato,
            prezzo: priceInfo.finalPrice,
            prezzoOriginale: priceInfo.originalPrice,
            scontoApplicato: priceInfo.appliedDiscount,
            fonteSconto: priceInfo.discountSource,
            nomeSconto: priceInfo.discountName,
            qty: item.quantity,
            total: itemTotal,
          }
        }) || []

      res.json({
        valid: true,
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          invoiceAddress: customer.invoiceAddress,
          company: customer.company,
          language: customer.language,
        },
        prodotti: cartItems,
        totalAmount: totalAmount,
        workspaceId: secureToken.workspaceId,
      })
    } catch (error) {
      logger.error("[CHECKOUT] Error validating token:", error)
      res.status(500).json({
        valid: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Submit order and send notifications
   */
  async submitOrder(req: Request, res: Response): Promise<void> {
    try {
      const { token, prodotti, shippingAddress, billingAddress, notes } =
        req.body

      if (!token || !prodotti || !shippingAddress) {
        res.status(400).json({
          success: false,
          error: "Missing required fields",
        })
        return
      }

      // Validate token again using SecureTokenService
      const validation = await this.secureTokenService.validateToken(token)

      if (!validation.valid) {
        res.status(400).json({
          success: false,
          error: "Invalid or expired token",
        })
        return
      }

      const secureToken = validation.data
      const payload = validation.payload as any

      // 🔧 CRITICAL FIX: Get customerId from payload first, then fallback to tokenData
      let customerId =
        payload?.customerId || secureToken?.customerId || secureToken?.userId
      const workspaceId = secureToken.workspaceId

      // 🔧 ULTIMATE FALLBACK: If no customerId, try to find customer by phone number
      if (!customerId && secureToken?.phoneNumber && workspaceId) {
        const customer = await prisma.customers.findFirst({
          where: {
            phone: secureToken.phoneNumber,
            workspaceId: workspaceId,
          },
        })
        if (customer) {
          customerId = customer.id
          logger.info(
            `[CHECKOUT] Found customer by phone fallback: ${customerId}`
          )
        }
      }

      if (!customerId || !workspaceId) {
        res.status(400).json({
          success: false,
          error: "Token does not contain valid customer information",
        })
        return
      }

      // Get customer and workspace
      const [customer, workspace] = await Promise.all([
        prisma.customers.findFirst({
          where: { id: customerId, workspaceId },
        }),
        prisma.workspace.findUnique({
          where: { id: workspaceId },
        }),
      ])

      if (!customer || !workspace) {
        res.status(400).json({
          success: false,
          error: "Customer or workspace not found",
        })
        return
      }

      // Calculate total
      const totalAmount = prodotti.reduce(
        (sum: number, item: any) => sum + item.prezzo * item.qty,
        0
      )

      // Generate order code
      const orderCode = await this.generateOrderCode()

      // Separate products from services
      const productItems = prodotti.filter(
        (item: any) => item.itemType === "PRODUCT" || !item.serviceId
      )
      const serviceItems = prodotti.filter(
        (item: any) => item.itemType === "SERVICE" && item.serviceId
      )

      // Find products by code to get productId
      const skus = productItems.map((item: any) => item.codice)
      const products = await prisma.products.findMany({
        where: {
          sku: { in: skus },
          workspaceId: workspaceId,
        },
      })

      // Create a map of sku -> productId
      const productMap = new Map()
      products.forEach((product) => {
        productMap.set(product.sku, product.id)
      })

      // Find services by serviceId
      const serviceIds = serviceItems
        .map((item: any) => item.serviceId)
        .filter(Boolean)
      const services = await prisma.services.findMany({
        where: {
          id: { in: serviceIds },
          workspaceId: workspaceId,
        },
      })

      // Create a map of serviceId -> service
      const serviceMap = new Map()
      services.forEach((service) => {
        serviceMap.set(service.id, service)
      })

      // Create order
      const order = await prisma.orders.create({
        data: {
          orderCode,
          status: "CONFIRMED", // 💰 Create as CONFIRMED to trigger billing
          totalAmount,
          shippingAmount: 0,
          taxAmount: 0,
          shippingAddress,
          billingAddress,
          notes,
          customerId,
          workspaceId,
          items: {
            create: [
              // PRODUCT items
              ...productItems.map((item: any) => ({
                itemType: "PRODUCT",
                quantity: item.qty,
                unitPrice: item.prezzo,
                totalPrice: item.prezzo * item.qty,
                productId: productMap.get(item.codice), // ✅ CORRECT: Save productId from sku lookup
                productVariant: {
                  codice: item.codice,
                  descrizione: item.descrizione,
                  formato: item.formato,
                },
              })),
              // SERVICE items
              ...serviceItems.map((item: any) => {
                const service = serviceMap.get(item.serviceId)
                return {
                  itemType: "SERVICE",
                  quantity: item.qty || 1,
                  unitPrice: item.prezzo,
                  totalPrice: item.prezzo * (item.qty || 1),
                  serviceId: item.serviceId,
                  productVariant: {
                    codice: item.codice || service?.code || "N/A",
                    descrizione: item.descrizione,
                    duration: item.duration,
                    notes: item.notes,
                  },
                }
              }),
            ],
          },
        },
        include: {
          items: true,
        },
      })

      // 🎯 TASK: Auto-update customer address in database
      try {
        // Validate shipping address fields (use correct field names from frontend)
        const hasValidShippingAddress =
          shippingAddress &&
          shippingAddress.name &&
          shippingAddress.street &&
          shippingAddress.city &&
          shippingAddress.postalCode

        if (hasValidShippingAddress) {
          // Create structured address object for customer
          const customerAddress = {
            name: shippingAddress.name,
            street: shippingAddress.street,
            city: shippingAddress.city,
            postalCode: shippingAddress.postalCode,
            province: shippingAddress.province || "",
            country: shippingAddress.country || "Italia",
            phone: shippingAddress.phone || customer.phone || "",
            company: shippingAddress.company || "",
          }

          // Update customer address in database
          await prisma.customers.update({
            where: {
              id: customerId,
              workspaceId: workspaceId,
            },
            data: {
              address: JSON.stringify(customerAddress),
              // Also update customer company if provided
              company: shippingAddress.company || customer.company,
              updatedAt: new Date(),
            },
          })

          logger.info(
            `[CHECKOUT] Auto-updated customer address for ${customerId}:`,
            customerAddress
          )
        } else {
          logger.warn(
            `[CHECKOUT] Invalid shipping address provided for customer ${customerId}, skipping auto-update`
          )
        }

        // Auto-update billing address if provided and different from shipping
        if (billingAddress && billingAddress !== shippingAddress) {
          const hasValidBillingAddress =
            billingAddress.name &&
            billingAddress.street &&
            billingAddress.city &&
            billingAddress.postalCode

          if (hasValidBillingAddress) {
            const customerInvoiceAddress = {
              name: billingAddress.name,
              address: billingAddress.street,
              city: billingAddress.city,
              postalCode: billingAddress.postalCode,
              province: billingAddress.province || "",
              country: billingAddress.country || "Italia",
              phone: billingAddress.phone || customer.phone || "",
              company: billingAddress.company || "",
            }

            // Update customer invoice address in database
            await prisma.customers.update({
              where: {
                id: customerId,
                workspaceId: workspaceId,
              },
              data: {
                invoiceAddress: customerInvoiceAddress,
                updatedAt: new Date(),
              },
            })

            logger.info(
              `[CHECKOUT] Auto-updated customer invoice address for ${customerId}:`,
              customerInvoiceAddress
            )
          }
        }
      } catch (addressUpdateError) {
        // Don't fail the order if address update fails
        logger.error(
          `[CHECKOUT] Failed to auto-update customer address for ${customerId}:`,
          addressUpdateError
        )
      }

      // Token remains valid for reuse until expiration

      logger.info(
        `[CHECKOUT] Order created: ${orderCode} for customer ${customerId}`
      )

      // 💰 BILLING: Billing handled by OrderService.createOrder() - REMOVED DUPLICATE CALL
      // OrderService automatically calls trackNewOrder() when order created as CONFIRMED
      // This prevents double-billing (was charging €2.00 instead of €1.00)

      // Send notifications
      await this.sendNotifications(order, customer, workspace)

      // Reset customer cart after successful order
      await this.resetCustomerCart(customerId, workspaceId)

      res.json({
        success: true,
        orderId: order.id,
        orderCode: order.orderCode,
      })
    } catch (error) {
      logger.error("[CHECKOUT] Error submitting order:", error)
      res.status(500).json({
        success: false,
        error: "Internal server error",
      })
    }
  }

  /**
   * Generate unique order code - 5 uppercase letters
   */
  private async generateOrderCode(): Promise<string> {
    // Generate 5 random uppercase letters
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    let orderCode = ""

    // Generate unique 5-letter code
    let attempts = 0
    const maxAttempts = 10

    do {
      orderCode = ""
      for (let i = 0; i < 5; i++) {
        orderCode += letters.charAt(Math.floor(Math.random() * letters.length))
      }

      // Check if this code already exists
      const existingOrder = await prisma.orders.findFirst({
        where: {
          orderCode: orderCode,
        },
      })

      if (!existingOrder) {
        break // Unique code found
      }

      attempts++
    } while (attempts < maxAttempts)

    // If we couldn't find a unique code after maxAttempts, add timestamp suffix
    if (attempts >= maxAttempts) {
      const timestamp = Date.now().toString().slice(-2) // Last 2 digits of timestamp
      orderCode = orderCode.slice(0, 3) + timestamp
    }

    return orderCode
  }

  /**
   * Send email and WhatsApp notifications
   */
  private async sendNotifications(
    order: any,
    customer: any,
    workspace: any
  ): Promise<void> {
    try {
      // Get admin email from whatsapp settings
      const whatsappSettings = await prisma.whatsappSettings.findFirst({
        where: { workspaceId: workspace.id },
      })

      const adminEmail =
        whatsappSettings?.adminEmail || workspace.notificationEmail

      // Send email to customer
      if (customer.email) {
        await this.sendCustomerEmail(customer.email, order, customer.name)
      }

      // Send email to admin
      if (adminEmail) {
        await this.sendAdminEmail(adminEmail, order, customer)
      }

      // Send WhatsApp message
      await this.sendWhatsAppNotification(
        customer.phone,
        order.orderCode,
        workspace.id
      )

      logger.info(`[CHECKOUT] Notifications sent for order ${order.orderCode}`)
    } catch (error) {
      logger.error("[CHECKOUT] Error sending notifications:", error)
      // Don't throw error - order is already created
    }
  }

  /**
   * Send email to customer
   */
  private async sendCustomerEmail(
    email: string,
    order: any,
    customerName: string
  ): Promise<void> {
    try {
      const emailContent = `
Ciao ${customerName},

Il tuo ordine ${order.orderCode} è stato ricevuto con successo.

Il nostro team ti contatterà il prima possibile per la conferma dell'ordine.

Totale: €${order.totalAmount.toFixed(2)}

Grazie per aver scelto i nostri servizi!

Cordiali saluti,
Il Team
      `.trim()

      const transporter = await this.emailService["transporter"]
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@echatbot.ai",
        to: email,
        subject: `Ordine Ricevuto - ${order.orderCode}`,
        text: emailContent,
      })

      logger.info(`[CHECKOUT] Customer email sent to ${email}`)
    } catch (error) {
      logger.error("[CHECKOUT] Error sending customer email:", error)
    }
  }

  /**
   * Send email to admin
   */
  private async sendAdminEmail(
    email: string,
    order: any,
    customer: any
  ): Promise<void> {
    try {
      const emailContent = `
Nuovo ordine ricevuto da confermare:

Ordine: ${order.orderCode}
Cliente: ${customer.name}
Email: ${customer.email}
Telefono: ${customer.phone}
Totale: €${order.totalAmount.toFixed(2)}

Prodotti:
${order.items
  .map(
    (item: any) =>
      `- ${item.quantity}x ${item.productVariant?.descrizione || "Prodotto"} (€${item.unitPrice.toFixed(2)})`
  )
  .join("\n")}

Accedi al pannello amministrativo per confermare l'ordine.
      `.trim()

      const transporter = await this.emailService["transporter"]
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@echatbot.ai",
        to: email,
        subject: `Nuovo Ordine da Confermare - ${order.orderCode}`,
        text: emailContent,
      })

      logger.info(`[CHECKOUT] Admin email sent to ${email}`)
    } catch (error) {
      logger.error("[CHECKOUT] Error sending admin email:", error)
    }
  }

  /**
   * Send WhatsApp notification using centralized push messaging service
   */
  private async sendWhatsAppNotification(
    phoneNumber: string,
    orderCode: string,
    workspaceId: string
  ): Promise<void> {
    try {
      // Find customer
      const customer = await prisma.customers.findFirst({
        where: { phone: phoneNumber, workspaceId },
      })

      if (!customer) {
        logger.error(
          `[CHECKOUT] Customer not found for WhatsApp notification: ${phoneNumber}`
        )
        return
      }

      // 🚀 Use centralized push messaging service
      const success = await pushMessagingService.sendOrderConfirmation(
        customer.id,
        phoneNumber,
        workspaceId,
        orderCode
      )

      if (success) {
        logger.info(
          `[CHECKOUT] ✅ WhatsApp notification sent via push service for ${phoneNumber}: ${orderCode}`
        )
      } else {
        logger.error(
          `[CHECKOUT] ❌ Failed to send WhatsApp notification for ${phoneNumber}: ${orderCode}`
        )
      }
    } catch (error) {
      logger.error("[CHECKOUT] Error sending WhatsApp notification:", error)
    }
  }

  /**
   * Reset customer cart after successful order
   */
  private async resetCustomerCart(
    customerId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      // Find customer cart
      const cart = await prisma.carts.findFirst({
        where: {
          customerId,
          workspaceId,
        },
        include: {
          items: true,
        },
      })

      if (cart) {
        // Delete all cart items
        await prisma.cartItems.deleteMany({
          where: {
            cartId: cart.id,
          },
        })

        logger.info(
          `[CHECKOUT] Cart reset for customer ${customerId} - ${cart.items.length} items removed`
        )
      } else {
        logger.info(
          `[CHECKOUT] No cart found for customer ${customerId} - nothing to reset`
        )
      }
    } catch (error) {
      logger.error("[CHECKOUT] Error resetting customer cart:", error)
      // Don't throw error - order is already created successfully
    }
  }
}
