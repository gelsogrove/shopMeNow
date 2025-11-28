import { prisma } from "../../lib/prisma"
import { pushMessagingService } from "../../services/push-messaging.service"
import logger from "../../utils/logger"
import { EmailService } from "./email.service"

export class StockService {
  private emailService = new EmailService()

  /**
   * Update product stock based on order status change
   */
  async handleOrderStatusChange(
    orderId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      logger.info(
        `[STOCK] Processing status change for order ${orderId}: ${oldStatus} → ${newStatus}`
      )

      // Get order with items
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          customer: true,
          workspace: true,
        },
      })

      if (!order) {
        logger.error(`[STOCK] Order ${orderId} not found`)
        return
      }

      // Handle different status transitions
      if (oldStatus === "PENDING" && newStatus === "CONFIRMED") {
        await this.scaleStockForConfirmedOrder(order)
        await this.sendConfirmationNotifications(order)
      } else if (oldStatus === "CONFIRMED" && newStatus === "CANCELLED") {
        await this.restoreStockForCancelledOrder(order)
      } else if (newStatus === "CANCELLED" && oldStatus !== "PENDING") {
        await this.restoreStockForCancelledOrder(order)
      }

      logger.info(`[STOCK] Stock management completed for order ${orderId}`)
    } catch (error) {
      logger.error(
        `[STOCK] Error handling order status change for ${orderId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Scale stock when order is confirmed (PENDING → CONFIRMED)
   */
  private async scaleStockForConfirmedOrder(order: any): Promise<void> {
    logger.info(`[STOCK] Scaling stock for confirmed order ${order.orderCode}`)

    for (const item of order.items) {
      if (item.itemType === "PRODUCT" && item.productId) {
        try {
          // Get current product
          const product = await prisma.products.findUnique({
            where: { id: item.productId },
          })

          if (!product) {
            logger.warn(
              `[STOCK] Product ${item.productId} not found for order item`
            )
            continue
          }

          // Check if enough stock
          if (product.stock < item.quantity) {
            logger.warn(
              `[STOCK] Insufficient stock for product ${product.name}: ${product.stock} < ${item.quantity}`
            )
            // Could throw error or handle gracefully - for now we continue
            continue
          }

          // Update stock
          const newStock = product.stock - item.quantity
          await prisma.products.update({
            where: { id: item.productId },
            data: { stock: newStock },
          })

          logger.info(
            `[STOCK] Updated product ${product.name}: ${product.stock} → ${newStock} (-${item.quantity})`
          )

          // Log stock change
          await this.logStockChange(
            item.productId,
            order.workspaceId,
            -item.quantity,
            `Order confirmed: ${order.orderCode}`,
            order.id
          )
        } catch (error) {
          logger.error(
            `[STOCK] Error updating stock for product ${item.productId}:`,
            error
          )
          // Continue with other products
        }
      }
    }
  }

  /**
   * Restore stock when order is cancelled
   */
  private async restoreStockForCancelledOrder(order: any): Promise<void> {
    logger.info(
      `[STOCK] Restoring stock for cancelled order ${order.orderCode}`
    )

    for (const item of order.items) {
      if (item.itemType === "PRODUCT" && item.productId) {
        try {
          // Get current product
          const product = await prisma.products.findUnique({
            where: { id: item.productId },
          })

          if (!product) {
            logger.warn(
              `[STOCK] Product ${item.productId} not found for stock restoration`
            )
            continue
          }

          // Restore stock
          const newStock = product.stock + item.quantity
          await prisma.products.update({
            where: { id: item.productId },
            data: { stock: newStock },
          })

          logger.info(
            `[STOCK] Restored product ${product.name}: ${product.stock} → ${newStock} (+${item.quantity})`
          )

          // Log stock change
          await this.logStockChange(
            item.productId,
            order.workspaceId,
            item.quantity,
            `Order cancelled: ${order.orderCode}`,
            order.id
          )
        } catch (error) {
          logger.error(
            `[STOCK] Error restoring stock for product ${item.productId}:`,
            error
          )
          // Continue with other products
        }
      }
    }
  }

  /**
   * Send confirmation notifications when order is confirmed
   */
  private async sendConfirmationNotifications(order: any): Promise<void> {
    try {
      // Get admin email from whatsapp settings
      const whatsappSettings = await prisma.whatsappSettings.findFirst({
        where: { workspaceId: order.workspaceId },
      })

      const adminEmail =
        whatsappSettings?.adminEmail || order.workspace.notificationEmail

      // Send email to customer
      if (order.customer.email) {
        await this.sendCustomerConfirmationEmail(
          order.customer.email,
          order,
          order.customer.name
        )
      }

      // Send email to admin
      if (adminEmail) {
        await this.sendAdminConfirmationEmail(adminEmail, order, order.customer)
      }

      // Send WhatsApp confirmation
      await this.sendWhatsAppConfirmation(
        order.customer.phone,
        order.orderCode,
        order.workspaceId
      )

      logger.info(
        `[STOCK] Confirmation notifications sent for order ${order.orderCode}`
      )
    } catch (error) {
      logger.error(`[STOCK] Error sending confirmation notifications:`, error)
      // Don't throw - order is already confirmed
    }
  }

  /**
   * Send confirmation email to customer
   */
  private async sendCustomerConfirmationEmail(
    email: string,
    order: any,
    customerName: string
  ): Promise<void> {
    try {
      const emailContent = `
Ciao ${customerName},

🎉 Il tuo ordine ${order.orderCode} è stato confermato!

Il nostro team ti contatterà per i dettagli di consegna.

Dettagli ordine:
${order.items
  .map(
    (item: any) =>
      `- ${item.quantity}x ${item.productVariant?.descrizione || "Prodotto"} (€${item.unitPrice.toFixed(2)})`
  )
  .join("\n")}

Totale: €${order.totalAmount.toFixed(2)}

Grazie per aver scelto i nostri servizi!

Cordiali saluti,
Il Team
      `.trim()

      const transporter = await this.emailService["transporter"]
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@shopme.com",
        to: email,
        subject: `🎉 Ordine Confermato - ${order.orderCode}`,
        text: emailContent,
      })

      logger.info(`[STOCK] Customer confirmation email sent to ${email}`)
    } catch (error) {
      logger.error("[STOCK] Error sending customer confirmation email:", error)
    }
  }

  /**
   * Send confirmation email to admin
   */
  private async sendAdminConfirmationEmail(
    email: string,
    order: any,
    customer: any
  ): Promise<void> {
    try {
      const emailContent = `
Ordine confermato e processato:

Ordine: ${order.orderCode}
Cliente: ${customer.name}
Email: ${customer.email}
Telefono: ${customer.phone}
Totale: €${order.totalAmount.toFixed(2)}
Status: CONFERMATO

Prodotti (stock aggiornato):
${order.items
  .map(
    (item: any) =>
      `- ${item.quantity}x ${item.productVariant?.descrizione || "Prodotto"} (€${item.unitPrice.toFixed(2)})`
  )
  .join("\n")}

L'ordine è stato processato e lo stock è stato aggiornato.
      `.trim()

      const transporter = await this.emailService["transporter"]
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "noreply@shopme.com",
        to: email,
        subject: `Ordine Confermato e Processato - ${order.orderCode}`,
        text: emailContent,
      })

      logger.info(`[STOCK] Admin confirmation email sent to ${email}`)
    } catch (error) {
      logger.error("[STOCK] Error sending admin confirmation email:", error)
    }
  }

  /**
   * Send WhatsApp confirmation using centralized push messaging service
   */
  private async sendWhatsAppConfirmation(
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
          `[STOCK] Customer not found for WhatsApp confirmation: ${phoneNumber}`
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
          `[STOCK] ✅ WhatsApp confirmation sent via push service for ${phoneNumber}: ${orderCode}`
        )
      } else {
        logger.error(
          `[STOCK] ❌ Failed to send WhatsApp confirmation for ${phoneNumber}: ${orderCode}`
        )
      }
    } catch (error) {
      logger.error("[STOCK] Error sending WhatsApp confirmation:", error)
    }
  }

  /**
   * Log stock changes for audit
   */
  private async logStockChange(
    productId: string,
    workspaceId: string,
    change: number,
    reason: string,
    orderId?: string
  ): Promise<void> {
    try {
      // This could be a separate StockLog table, for now just log to console
      logger.info(
        `[STOCK_LOG] Product ${productId}: ${change > 0 ? "+" : ""}${change} (${reason})`
      )
    } catch (error) {
      logger.error("[STOCK] Error logging stock change:", error)
    }
  }

  /**
   * Check stock availability for products
   */
  async checkStockAvailability(
    productId: string,
    quantity: number
  ): Promise<boolean> {
    try {
      const product = await prisma.products.findUnique({
        where: { id: productId },
      })

      if (!product || !product.isActive) {
        return false
      }

      return product.stock >= quantity
    } catch (error) {
      logger.error(
        `[STOCK] Error checking stock availability for ${productId}:`,
        error
      )
      return false
    }
  }

  /**
   * Get products with low stock (stock = 0)
   */
  async getOutOfStockProducts(workspaceId: string): Promise<any[]> {
    try {
      return await prisma.products.findMany({
        where: {
          workspaceId,
          stock: 0,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          // sku: true, // REMOVED: field no longer exists
          stock: true,
          price: true,
        },
      })
    } catch (error) {
      logger.error(`[STOCK] Error getting out of stock products:`, error)
      return []
    }
  }
}
