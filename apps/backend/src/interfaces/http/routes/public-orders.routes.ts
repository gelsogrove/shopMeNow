import { Request, Response, Router } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { publicOrdersLimiter } from "../../../config/rate-limiters"
import { prisma } from "../../../lib/prisma"
import { parseCustomerAddresses } from "../../../utils/address-parser"
import logger from "../../../utils/logger"
import { tokenValidationMiddleware } from "../middlewares/token-validation.middleware"

const router = Router()
const secureTokenService = new SecureTokenService()

// ========================================
// 🔧 HELPER: Get Orders List Handler
// ========================================
async function getOrdersListHandler(req: Request, res: Response) {
  try {
    // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
    const customerId = (req as any).customerId
    const workspaceId = (req as any).workspaceId
    const { status, payment, from, to } = req.query

    logger.info(
      `[PUBLIC-ORDERS] Getting orders list for customer: ${customerId}`
    )

    const whereClause: any = {
      customerId: customerId,
      workspaceId: workspaceId,
    }

    if (status && status !== "ALL") {
      whereClause.status = status
    }

    if (payment && payment !== "ALL") {
      whereClause.paymentMethod = payment
    }

    if (from || to) {
      whereClause.createdAt = {}
      if (from) whereClause.createdAt.gte = new Date(from as string)
      if (to) whereClause.createdAt.lte = new Date(to as string)
    }

    const customer = await prisma.customers.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
      },
    })

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: "Customer not found",
      })
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    })

    const orders = await prisma.orders.findMany({
      where: whereClause,
      include: {
        items: {
          select: {
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const formattedOrders = orders.map((order) => ({
      id: order.id,
      orderCode: order.orderCode,
      date: order.createdAt.toISOString(),
      status: order.status,
      paymentStatus: order.paymentMethod,
      totalAmount: order.totalAmount,
      taxAmount: order.taxAmount,
      shippingAmount: order.shippingAmount,
      itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      invoiceUrl: "",
      ddtUrl: "",
    }))

    return res.json({
      success: true,
      data: {
        customer,
        workspace,
        orders: formattedOrders,
      },
    })
  } catch (error) {
    logger.error("[PUBLIC-ORDERS] Error getting orders list:", error)
    return res.status(500).json({
      success: false,
      error: "Error retrieving orders",
    })
  }
}

/**
 * @swagger
 * /api/internal/validate-secure-token:
 *   post:
 *     tags:
 *       - Public Access
 *     summary: Validate secure token for public access (TOKEN-ONLY)
 *     description: Validates a secure token for public page access
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Security token
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID (optional)
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: Token validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 payload:
 *                   type: object
 *       401:
 *         description: Invalid or expired token
 */
router.post("/validate-secure-token", async (req: Request, res: Response) => {
  try {
    const { token, workspaceId } = req.body

    if (!token) {
      return res.status(400).json({
        valid: false,
        error: "Token is required",
      })
    }

    logger.info(
      `[TOKEN-VALIDATION] Validating token for workspace: ${workspaceId || "any"}`
    )

    // Use TOKEN-ONLY system - accept any valid token type
    const validation = await secureTokenService.validateToken(token)

    if (!validation.valid) {
      return res.status(401).json({
        valid: false,
        error: "Invalid or expired token",
      })
    }

    // Optional workspace validation
    if (workspaceId && validation.data?.workspaceId !== workspaceId) {
      return res.status(403).json({
        valid: false,
        error: "Token not authorized for this workspace",
      })
    }

    logger.info("[TOKEN-VALIDATION] ✅ Token validated successfully")

    return res.json({
      valid: true,
      data: validation.data,
      payload: validation.payload,
    })
  } catch (error) {
    logger.error("[TOKEN-VALIDATION] Error validating token:", error)
    return res.status(500).json({
      valid: false,
      error: "Error during token validation",
    })
  }
})

/**
 * @swagger
 * /api/internal/public/orders:
 *   get:
 *     tags:
 *       - Public Orders
 *     summary: Get customer orders list (public access with token)
 *     description: Returns list of orders for a customer using a secure token
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ALL, PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED]
 *         description: Filter by order status
 *       - in: query
 *         name: payment
 *         schema:
 *           type: string
 *           enum: [ALL, PAID, PENDING, FAILED, COMPLETED, DECLINED]
 *         description: Filter by payment status
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders from date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter orders to date
 *     responses:
 *       200:
 *         description: Orders list retrieved successfully
 *       401:
 *         description: Invalid or expired token
 */
// 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
router.get(
  "/public/orders",
  publicOrdersLimiter,
  tokenValidationMiddleware,
  getOrdersListHandler
)

// ✅ ALIAS: Frontend compatibility route
// 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
router.get(
  "/orders-public",
  publicOrdersLimiter,
  tokenValidationMiddleware,
  getOrdersListHandler
)

/**
 * @swagger
 * /api/internal/public/orders/{orderCode}:
 *   get:
 *     tags:
 *       - Public Orders
 *     summary: Get order details (public access with token)
 *     description: Returns detailed information for a specific order using a secure token
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: string
 *         description: Order code
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *     responses:
 *       200:
 *         description: Order details retrieved successfully
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Order not found
 */
router.get(
  "/public/orders/:orderCode",
  tokenValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
      const customerId = (req as any).customerId
      const workspaceId = (req as any).workspaceId
      const { orderCode } = req.params

      logger.info(`[PUBLIC-ORDERS] Getting order details for: ${orderCode}`)

      // Get order with full details
      const order = await prisma.orders.findFirst({
        where: {
          orderCode,
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
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              language: true,
              address: true,
              invoiceAddress: true,
            },
          },
          workspace: {
            select: { id: true, name: true },
          },
        },
      })

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        })
      }

      // Parse customer addresses using utility
      let parsedCustomer = { ...(order as any).customer }

      const invoiceResult = parseCustomerAddresses(
        parsedCustomer.invoiceAddress
      )
      parsedCustomer.invoiceAddress = invoiceResult.success
        ? invoiceResult.addresses
        : null

      const addressResult = parseCustomerAddresses(parsedCustomer.address)
      parsedCustomer.address = addressResult.success
        ? addressResult.addresses
        : null

      // Format order items with imageUrl
      const formattedItems = (order as any).items.map((item: any) => ({
        id: item.id,
        itemType: item.itemType,
        name: item.product?.name || item.service?.name || "Unknown Item",
        code: item.product?.productCode || item.service?.code || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        imageUrl: item.product?.imageUrl || item.service?.imageUrl || [],
      }))

      const formattedOrder = {
        id: order.id,
        orderCode: order.orderCode,
        date: order.createdAt.toISOString(),
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentProvider: null,
        shippingAmount: order.shippingAmount,
        taxAmount: order.taxAmount,
        shippingAddress: order.shippingAddress,
        trackingNumber: order.trackingNumber,
        totalAmount: order.totalAmount,
        items: formattedItems,
        invoiceUrl: "",
        ddtUrl: "",
      }

      return res.json({
        success: true,
        data: {
          order: formattedOrder,
          customer: parsedCustomer,
          workspace: (order as any).workspace,
        },
      })
    } catch (error) {
      logger.error("[PUBLIC-ORDERS] Error getting order details:", error)
      return res.status(500).json({
        success: false,
        error: "Error retrieving order details",
      })
    }
  }
)

/**
 * @swagger
 * /api/internal/customer-profile/{token}:
 *   get:
 *     tags:
 *       - Public Profile
 *     summary: Get customer profile (public access with token)
 *     description: Returns customer profile information using a secure token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Customer not found
 */
router.get(
  "/customer-profile/:token",
  tokenValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
      const customerId = (req as any).customerId
      const workspaceId = (req as any).workspaceId

      logger.info(
        `[PUBLIC-PROFILE] Getting profile for customer: ${customerId}`
      )

      // Get customer profile
      const customer = await prisma.customers.findFirst({
        where: {
          id: customerId,
          workspaceId: workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          company: true,
          language: true,
          currency: true,
          discount: true,
          invoiceAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: "Customer not found",
        })
      }

      // Get workspace info
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true },
      })

      // Parse customer addresses using utility
      let parsedCustomer: any = { ...customer }

      const invoiceResult = parseCustomerAddresses(
        parsedCustomer.invoiceAddress
      )
      parsedCustomer.invoiceAddress = invoiceResult.success
        ? invoiceResult.addresses
        : null

      const addressResult = parseCustomerAddresses(parsedCustomer.address)
      parsedCustomer.address = addressResult.success
        ? addressResult.addresses
        : null

      return res.json({
        success: true,
        data: {
          ...parsedCustomer,
          workspace,
        },
      })
    } catch (error) {
      logger.error("[PUBLIC-PROFILE] Error getting customer profile:", error)
      return res.status(500).json({
        success: false,
        error: "Error retrieving profile",
      })
    }
  }
)

/**
 * @swagger
 * /api/internal/customer-profile/{token}:
 *   put:
 *     tags:
 *       - Public Profile
 *     summary: Update customer profile (public access with token)
 *     description: Updates customer profile information using a secure token
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Security token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Customer not found
 */
router.put(
  "/customer-profile/:token",
  tokenValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
      const customerId = (req as any).customerId
      const workspaceId = (req as any).workspaceId
      const updateData = req.body

      logger.info(
        `[PUBLIC-PROFILE] Updating profile for customer: ${customerId}`
      )

      // Update customer profile
      const updatedCustomer = await prisma.customers.update({
        where: {
          id: customerId,
          workspaceId: workspaceId,
        },
        data: {
          ...(updateData.name && { name: updateData.name }),
          ...(updateData.email && { email: updateData.email }),
          ...(updateData.phone && { phone: updateData.phone }),
          ...(updateData.address && { address: updateData.address }),
          ...(updateData.company && { company: updateData.company }),
          ...(updateData.language && { language: updateData.language }),
          ...(updateData.currency && { currency: updateData.currency }),
          ...(updateData.invoiceAddress && {
            invoiceAddress: updateData.invoiceAddress,
          }),
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          company: true,
          language: true,
          currency: true,
          discount: true,
          invoiceAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      // Parse customer addresses using utility
      let parsedCustomer: any = { ...updatedCustomer }

      const invoiceResult = parseCustomerAddresses(
        parsedCustomer.invoiceAddress
      )
      parsedCustomer.invoiceAddress = invoiceResult.success
        ? invoiceResult.addresses
        : null

      const addressResult = parseCustomerAddresses(parsedCustomer.address)
      parsedCustomer.address = addressResult.success
        ? addressResult.addresses
        : null

      return res.json({
        success: true,
        data: parsedCustomer,
        message: "Profile updated successfully",
      })
    } catch (error) {
      logger.error("[PUBLIC-PROFILE] Error updating customer profile:", error)
      return res.status(500).json({
        success: false,
        error: "Error updating profile",
      })
    }
  }
)

/**
 * @swagger
 * /api/internal/get-all-products:
 *   post:
 *     tags:
 *       - Public Access
 *     summary: Get all products with discounts applied for a customer (TOKEN REQUIRED)
 *     description: Returns all active products with customer-specific discounts applied using secure token validation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: Security token containing workspaceId and customerId
 *             required:
 *               - token
 *     responses:
 *       200:
 *         description: List of products with discounts applied
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                     customerDiscount:
 *                       type: number
 *                     totalProducts:
 *                       type: number
 *       400:
 *         description: Missing token
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
router.post(
  "/get-all-products",
  publicOrdersLimiter,
  tokenValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      // � customerId and workspaceId are set by tokenValidationMiddleware
      const customerId = (req as any).customerId
      const workspaceId = (req as any).workspaceId

      logger.info("[GET-ALL-PRODUCTS] Request with validated token:", {
        workspaceId,
        customerId,
      })

      // Get customer to fetch their discount
      const customer = await prisma.customers.findFirst({
        where: {
          id: customerId,
          workspaceId: workspaceId,
          isActive: true,
        },
      })

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: "Customer not found",
        })
      }

      const customerDiscount = customer.discount || 0
      logger.info("[GET-ALL-PRODUCTS] Customer discount:", customerDiscount)

      // Get all active products for the workspace
      const products = await prisma.products.findMany({
        where: {
          workspaceId: workspaceId,
          isActive: true,
          status: "ACTIVE",
        },
        select: {
          id: true,
          name: true,
          productCode: true,
          description: true,
          price: true,
          stock: true,
          isActive: true,
          imageUrl: true,
          formato: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [
          {
            category: {
              name: "asc",
            },
          },
          {
            name: "asc",
          },
        ],
      })

      // Apply customer discount to all products
      const productsWithDiscounts = products.map((product) => {
        const originalPrice = product.price
        const discountAmount = originalPrice * (customerDiscount / 100)
        const finalPrice = originalPrice - discountAmount
        const appliedDiscount = customerDiscount > 0 ? customerDiscount : 0

        return {
          id: product.id,
          name: product.name,
          productCode: product.productCode,
          description: product.description,
          formato: product.formato || null,
          price: originalPrice,
          originalPrice: originalPrice,
          finalPrice: finalPrice,
          appliedDiscount: appliedDiscount,
          discount: customerDiscount,
          stock: product.stock,
          isActive: product.isActive,
          imageUrl: (product as any).imageUrl || [], // 🖼️ Include product images
          category: product.category
            ? {
                id: product.category.id,
                name: product.category.name,
              }
            : null,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        }
      })

      logger.info("[GET-ALL-PRODUCTS] Returning products:", {
        count: productsWithDiscounts.length,
        customerDiscount,
      })

      return res.json({
        success: true,
        data: {
          products: productsWithDiscounts,
          customerDiscount: customerDiscount,
          totalProducts: productsWithDiscounts.length,
        },
      })
    } catch (error) {
      logger.error("[GET-ALL-PRODUCTS] Error fetching products:", error)
      return res.status(500).json({
        success: false,
        error: "Internal server error while fetching products",
      })
    }
  }
)

// ========================================
// 🔄 ADDITIONAL ROUTE ALIAS for GET /:orderCode
// ========================================
// Note: GET /orders-public is already added above after GET /public/orders handler

/**
 * Alias: GET /orders-public/:orderCode
 * Same handler as GET /public/orders/:orderCode
 * 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
 */
router.get(
  "/orders-public/:orderCode",
  publicOrdersLimiter,
  tokenValidationMiddleware,
  async (req: Request, res: Response) => {
    try {
      // 🔐 customerId and workspaceId are set by tokenValidationMiddleware
      const customerId = (req as any).customerId
      const workspaceId = (req as any).workspaceId
      const { orderCode } = req.params

      if (!customerId || !workspaceId) {
        return res.status(401).json({
          success: false,
          error: "Token does not contain valid customer information",
        })
      }

      logger.info(`[PUBLIC-ORDERS] Getting order details for: ${orderCode}`)

      const order = await prisma.orders.findFirst({
        where: {
          orderCode,
          customerId: customerId,
          workspaceId: workspaceId,
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  productCode: true,
                },
              },
              service: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              language: true,
              address: true,
              invoiceAddress: true,
            },
          },
          workspace: {
            select: { id: true, name: true },
          },
        },
      })

      if (!order) {
        return res.status(404).json({
          success: false,
          error: "Order not found",
        })
      }

      let parsedCustomer: any = { ...order.customer }

      const invoiceResult = parseCustomerAddresses(
        parsedCustomer.invoiceAddress
      )
      parsedCustomer.invoiceAddress = invoiceResult.success
        ? invoiceResult.addresses
        : null

      const addressResult = parseCustomerAddresses(parsedCustomer.address)
      parsedCustomer.address = addressResult.success
        ? addressResult.addresses
        : null

      const formattedItems = order.items.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        name: item.product?.name || item.service?.name || "Unknown Item",
        code: item.product?.productCode || item.service?.code || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      }))

      const formattedOrder = {
        id: order.id,
        orderCode: order.orderCode,
        date: order.createdAt.toISOString(),
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentProvider: null,
        shippingAmount: order.shippingAmount,
        taxAmount: order.taxAmount,
        shippingAddress: order.shippingAddress,
        trackingNumber: order.trackingNumber,
        totalAmount: order.totalAmount,
        items: formattedItems,
        invoiceUrl: "",
        ddtUrl: "",
      }

      return res.json({
        success: true,
        data: {
          customer: parsedCustomer,
          workspace: order.workspace,
          order: formattedOrder,
        },
      })
    } catch (error) {
      logger.error("[PUBLIC-ORDERS] Error getting order details:", error)
      return res.status(500).json({
        success: false,
        error: "Error retrieving order",
      })
    }
  }
)

logger.info(
  "✅ Added /orders-public/:orderCode route alias for frontend compatibility"
)

export default router
