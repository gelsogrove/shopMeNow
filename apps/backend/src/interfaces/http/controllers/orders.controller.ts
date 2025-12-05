import { prisma } from "@echatbot/database"
import { Request, Response } from "express"
import logger from "../../../utils/logger"

interface JWTPayload {
  clientId: string
  workspaceId: string
  scope: string
  orderCode?: string
  iat?: number
  exp?: number
}

export class OrdersController {
  private prisma: PrismaClient

  constructor() {
    this.prisma = prisma
  }
  /**
   * Get customer orders list
   * GET /api/orders
   */
  async getCustomerOrders(req: Request, res: Response): Promise<void> {
    try {
      const token = req.query.token as string
      if (!token) {
        res.status(401).json({ 
          success: false, 
          error: "Token is required" 
        })
        return
      }

      // Get JWT payload from middleware
      const payload = (req as any).jwtPayload as JWTPayload
      if (!payload) {
        res.status(401).json({ 
          success: false, 
          error: "Invalid or expired token" 
        })
        return
      }

      // Check if token has orders:list scope
      if (payload.scope !== "orders:list") {
        res.status(403).json({ 
          success: false, 
          error: "Token not authorized for orders access" 
        })
        return
      }

      const { clientId, workspaceId } = payload

      // Get customer (for testing, use the first customer if clientId is mock)
      const customer = await this.prisma.customers.findFirst({
        where: clientId === "mock-customer-id" 
          ? { workspaceId }
          : { id: clientId, workspaceId },
        include: { workspace: true },
      })

      if (!customer) {
        res.status(404).json({ 
          success: false, 
          error: "Customer not found" 
        })
        return
      }

      // Get orders for customer (for testing, use all orders if clientId is mock)
      const orders = await this.prisma.orders.findMany({
        where: clientId === "mock-customer-id"
          ? { workspaceId }
          : { customerId: clientId, workspaceId },
        include: {
          items: { include: { product: true, service: true } },
        },
        orderBy: { createdAt: "desc" },
      })

      const mapped = orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        date: o.createdAt,
        status: o.status,
        totalAmount: o.totalAmount,
        itemsCount: o.items.length,
        invoiceUrl: `/api/orders/${o.orderCode}/invoice?token=${token}`,
        ddtUrl: `/api/orders/${o.orderCode}/ddt?token=${token}`,
      }))

      res.status(200).json({
        success: true,
        data: {
          customer: { 
            id: customer.id, 
            name: customer.name, 
            phone: customer.phone, 
            email: customer.email 
          },
          workspace: { 
            id: customer.workspace.id, 
            name: customer.workspace.name 
          },
          orders: mapped,
        },
      })
    } catch (error) {
      logger.error("[ORDERS] Error fetching customer orders:", error)
      res.status(500).json({ 
        success: false, 
        error: "Internal server error" 
      })
    }
  }

  /**
   * Get order detail
   * GET /api/orders/:orderCode
   */
  async getOrderDetail(req: Request, res: Response): Promise<void> {
    try {
      const { orderCode } = req.params
      const token = req.query.token as string

      if (!token) {
        res.status(401).json({ 
          success: false, 
          error: "Token is required" 
        })
        return
      }

      // Get JWT payload from middleware
      const payload = (req as any).jwtPayload as JWTPayload
      if (!payload) {
        res.status(401).json({ 
          success: false, 
          error: "Invalid or expired token" 
        })
        return
      }

      // Check if token has orders:detail scope
      if (payload.scope !== "orders:detail") {
        res.status(403).json({ 
          success: false, 
          error: "Token not authorized for order detail access" 
        })
        return
      }

      const { clientId, workspaceId } = payload

      // Optional: if token payload restricts to a specific orderCode
      if (payload.orderCode && payload.orderCode !== orderCode) {
        res.status(403).json({ 
          success: false, 
          error: "Token not authorized for this order" 
        })
        return
      }

      const order = await this.prisma.orders.findFirst({
        where: clientId === "mock-customer-id"
          ? { orderCode, workspaceId }
          : { orderCode, customerId: clientId, workspaceId },
        include: {
          items: { include: { product: true, service: true } },
          customer: true,
        },
      })

      if (!order) {
        res.status(404).json({ 
          success: false, 
          error: "Order not found" 
        })
        return
      }

      res.status(200).json({
        success: true,
        data: {
          order: {
            id: order.id,
            orderCode: order.orderCode,
            date: order.createdAt,
            status: order.status,
            totalAmount: order.totalAmount,
            notes: order.notes,
            items: order.items.map((it) => ({
              id: it.id,
              itemType: it.itemType,
              name: it.product?.name || it.service?.name || "Item",
              formato: it.product?.formato || null, // 🧀 Include formato field for products
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              totalPrice: it.totalPrice,
            })),
            invoiceUrl: `/api/orders/${order.orderCode}/invoice?token=${token}`,
            ddtUrl: `/api/orders/${order.orderCode}/ddt?token=${token}`,
          },
          customer: { 
            id: order.customer.id, 
            name: order.customer.name 
          },
        },
      })
    } catch (error) {
      logger.error("[ORDERS] Error fetching order detail:", error)
      res.status(500).json({ 
        success: false, 
        error: "Internal server error" 
      })
    }
  }

  /**
   * Download invoice
   * GET /api/orders/:orderCode/invoice
   */
  async downloadInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { orderCode } = req.params
      const token = req.query.token as string

      if (!token) {
        res.status(401).json({ 
          success: false, 
          error: "Token required" 
        })
        return
      }

      const payload = (req as any).jwtPayload as JWTPayload
      if (!payload) {
        res.status(401).json({ 
          success: false, 
          error: "Invalid or expired token" 
        })
        return
      }

      // Get order with customer and items
      const order = await this.prisma.orders.findFirst({
        where: { 
          orderCode,
          workspaceId: payload.workspaceId 
        },
        include: {
          customer: true,
          items: {
            include: {
              product: { select: { name: true, productCode: true } },
              service: { select: { name: true, code: true } },
            },
          },
        },
      })

      if (!order) {
        res.status(404).json({ 
          success: false, 
          error: "Order not found" 
        })
        return
      }

      // Generate professional PDF invoice
      const PDFDocument = require('pdfkit')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderCode}.pdf`)
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      doc.pipe(res)

      // Professional Invoice Header
      doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Invoice Number: ${order.orderCode}`, { align: 'center' })
      doc.moveDown(2)

      // Company and Customer Information
      const startX = 50
      const startY = doc.y
      const colWidth = 250

      // Left column - Company Info
      doc.fontSize(12).font('Helvetica-Bold').text('FROM:', startX, startY)
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text('eChatbot E-commerce Platform')
      doc.text('123 Business Street')
      doc.text('City, State 12345')
      doc.text('Phone: +1 (555) 123-4567')
      doc.text('Email: info@echatbot.ai')

      // Right column - Customer Info
      doc.fontSize(12).font('Helvetica-Bold').text('BILL TO:', startX + colWidth, startY)
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text(order.customer.name)
      if (order.billingAddress) {
        const billing = order.billingAddress as any
        if (billing.street) doc.text(billing.street)
        if (billing.city && billing.postalCode) {
          doc.text(`${billing.postalCode} ${billing.city}`)
        }
        if (billing.country) doc.text(billing.country)
        if (billing.phone) doc.text(`Phone: ${billing.phone}`)
      }
      doc.text(`Email: ${order.customer.email || 'N/A'}`)
      doc.text(`Phone: ${order.customer.phone}`)

      // Invoice Details
      doc.moveDown(2)
      doc.fontSize(12).font('Helvetica-Bold').text('INVOICE DETAILS')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text(`Invoice Date: ${new Date(order.createdAt).toLocaleDateString('en-US')}`)
      doc.text(`Due Date: ${new Date(order.createdAt).toLocaleDateString('en-US')}`)
      doc.text(`Payment Method: ${order.paymentMethod || 'Not specified'}`)
      doc.text(`Status: ${order.status}`)

      // Items Table
      doc.moveDown(2)
      doc.fontSize(12).font('Helvetica-Bold').text('ITEMS')
      doc.moveDown(0.5)

      // Table header
      const tableTop = doc.y
      const itemX = 50
      const qtyX = 300
      const priceX = 350
      const totalX = 450

      doc.fontSize(10).font('Helvetica-Bold')
      doc.text('Item', itemX, tableTop)
      doc.text('Qty', qtyX, tableTop)
      doc.text('Unit Price', priceX, tableTop)
      doc.text('Total', totalX, tableTop)

      // Table content
      let currentY = tableTop + 20
      doc.fontSize(10).font('Helvetica')

      if (order.items.length > 0) {
        order.items.forEach((it: any) => {
          const name = it.product?.name || it.service?.name || 'Item'
          const code = it.product?.ProductCode || it.service?.code || ''
          const itemName = code ? `${name} (${code})` : name
          
          doc.text(itemName, itemX, currentY)
          doc.text(it.quantity.toString(), qtyX, currentY)
          doc.text(`€${it.unitPrice.toFixed(2)}`, priceX, currentY)
          doc.text(`€${it.totalPrice.toFixed(2)}`, totalX, currentY)
          
          currentY += 20
        })
      }

      // Totals Section
      doc.moveDown(2)
      const totalsY = doc.y
      const taxAmount = Number(order.taxAmount || 0)
      const shippingAmount = Number(order.shippingAmount || 0)
      const total = Number(order.totalAmount || 0)
      const subtotal = Math.max(0, total - taxAmount - shippingAmount)

      doc.fontSize(10).font('Helvetica')
      doc.text('Subtotal:', 350, totalsY)
      doc.text(`€${subtotal.toFixed(2)}`, 450, totalsY)
      
      if (taxAmount > 0) {
        doc.text('Tax (VAT):', 350, totalsY + 20)
        doc.text(`€${taxAmount.toFixed(2)}`, 450, totalsY + 20)
      }
      
      if (shippingAmount > 0) {
        doc.text('Shipping:', 350, totalsY + 40)
        doc.text(`€${shippingAmount.toFixed(2)}`, 450, totalsY + 40)
      }

      doc.fontSize(12).font('Helvetica-Bold')
      doc.text('TOTAL:', 350, totalsY + 60)
      doc.text(`€${total.toFixed(2)}`, 450, totalsY + 60)

      // Footer
      doc.moveDown(3)
      doc.fontSize(10).font('Helvetica').text('Thank you for your business!', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(8).text('This is a computer-generated invoice. No signature required.', { align: 'center' })

      doc.end()
    } catch (error) {
      logger.error("[ORDERS] Error downloading invoice:", error)
      res.status(500).json({ 
        success: false, 
        error: "Internal server error" 
      })
    }
  }

  /**
   * Download DDT
   * GET /api/orders/:orderCode/ddt
   */
  async downloadDdt(req: Request, res: Response): Promise<void> {
    try {
      const { orderCode } = req.params
      const token = req.query.token as string

      if (!token) {
        res.status(401).json({ 
          success: false, 
          error: "Token required" 
        })
        return
      }

      const payload = (req as any).jwtPayload as JWTPayload
      if (!payload) {
        res.status(401).json({ 
          success: false, 
          error: "Invalid or expired token" 
        })
        return
      }

      // Get order with customer and items
      const order = await this.prisma.orders.findFirst({
        where: { 
          orderCode,
          workspaceId: payload.workspaceId 
        },
        include: {
          customer: true,
          items: {
            include: {
              product: { select: { name: true, productCode: true } },
              service: { select: { name: true, code: true } },
            },
          },
        },
      })

      if (!order) {
        res.status(404).json({ 
          success: false, 
          error: "Order not found" 
        })
        return
      }

      const PDFDocument = require('pdfkit')
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename=delivery-note-${order.orderCode}.pdf`)
      const doc = new PDFDocument({ size: 'A4', margin: 50 })
      doc.pipe(res)

      // Professional Delivery Note Header
      doc.fontSize(24).font('Helvetica-Bold').text('DELIVERY NOTE', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica').text(`Document Number: ${order.orderCode}`, { align: 'center' })
      doc.moveDown(2)

      // Company and Customer Information
      const startX = 50
      const startY = doc.y
      const colWidth = 250

      // Left column - Company Info
      doc.fontSize(12).font('Helvetica-Bold').text('FROM:', startX, startY)
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text('eChatbot E-commerce Platform')
      doc.text('123 Business Street')
      doc.text('City, State 12345')
      doc.text('Phone: +1 (555) 123-4567')
      doc.text('Email: info@echatbot.ai')

      // Right column - Customer Info
      doc.fontSize(12).font('Helvetica-Bold').text('DELIVER TO:', startX + colWidth, startY)
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text(order.customer.name)
      if (order.shippingAddress) {
        const shipping = order.shippingAddress as any
        if (shipping.street) doc.text(shipping.street)
        if (shipping.city && shipping.postalCode) {
          doc.text(`${shipping.postalCode} ${shipping.city}`)
        }
        if (shipping.country) doc.text(shipping.country)
        if (shipping.phone) doc.text(`Phone: ${shipping.phone}`)
      }
      doc.text(`Email: ${order.customer.email || 'N/A'}`)
      doc.text(`Phone: ${order.customer.phone}`)

      // Delivery Details
      doc.moveDown(2)
      doc.fontSize(12).font('Helvetica-Bold').text('DELIVERY DETAILS')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text(`Document Date: ${new Date(order.createdAt).toLocaleDateString('en-US')}`)
      doc.text(`Order Status: ${order.status}`)
      if (order.trackingNumber) {
        doc.text(`Tracking Number: ${order.trackingNumber}`)
      }

      // Items Table (no prices for delivery note)
      doc.moveDown(2)
      doc.fontSize(12).font('Helvetica-Bold').text('ITEMS TO DELIVER')
      doc.moveDown(0.5)

      // Table header
      const tableTop = doc.y
      const itemX = 50
      const qtyX = 400
      const codeX = 500

      doc.fontSize(10).font('Helvetica-Bold')
      doc.text('Item Description', itemX, tableTop)
      doc.text('Quantity', qtyX, tableTop)
      doc.text('Product Code', codeX, tableTop)

      // Table content
      let currentY = tableTop + 20
      doc.fontSize(10).font('Helvetica')

      if (order.items.length > 0) {
        order.items.forEach((it: any) => {
          const name = it.product?.name || it.service?.name || 'Item'
          const code = it.product?.ProductCode || it.service?.code || 'N/A'
          
          doc.text(name, itemX, currentY)
          doc.text(it.quantity.toString(), qtyX, currentY)
          doc.text(code, codeX, currentY)
          
          currentY += 20
        })
      }

      // Delivery Instructions
      doc.moveDown(2)
      doc.fontSize(12).font('Helvetica-Bold').text('DELIVERY INSTRUCTIONS')
      doc.moveDown(0.5)
      doc.fontSize(10).font('Helvetica')
      doc.text('• Please verify all items before signing')
      doc.text('• Report any damages immediately')
      doc.text('• Keep this document for your records')

      // Footer
      doc.moveDown(3)
      doc.fontSize(10).font('Helvetica').text('Customer Signature: _________________________', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(8).text('Date: _________________________', { align: 'center' })

      doc.end()
    } catch (error) {
      logger.error("[ORDERS] Error downloading DDT:", error)
      res.status(500).json({ 
        success: false, 
        error: "Internal server error" 
      })
    }
  }

  async deleteOrder(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      
      // Get JWT payload from middleware
      const payload = (req as any).jwtPayload as JWTPayload
      if (!payload) {
        res.status(401).json({ 
          success: false, 
          error: "Invalid or expired token" 
        })
        return
      }

      const { workspaceId } = payload

      if (!id) {
        res.status(400).json({
          success: false,
          error: "Order ID is required"
        })
        return
      }

      if (!workspaceId) {
        res.status(400).json({
          success: false,
          error: "Workspace ID is required"
        })
        return
      }

      // Delete order using Prisma directly
      const deletedOrder = await this.prisma.orders.deleteMany({
        where: {
          id: id,
          workspaceId: workspaceId
        }
      })

      if (deletedOrder.count === 0) {
        res.status(404).json({
          success: false,
          error: "Order not found"
        })
        return
      }

      res.status(200).json({
        success: true,
        message: "Order deleted successfully"
      })
    } catch (error) {
      logger.error("[ORDERS] Error deleting order:", error)
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete order"
      })
    }
  }

}
