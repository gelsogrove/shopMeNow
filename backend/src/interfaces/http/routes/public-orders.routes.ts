import { Request, Response, Router } from "express"
import { SecureTokenService } from "../../../application/services/secure-token.service"
import { prisma } from "../../../lib/prisma"
import logger from "../../../utils/logger"
import { publicOrdersLimiter } from "../../../config/rate-limiters"

const router = Router()
const secureTokenService = new SecureTokenService()

// ========================================
// 🔧 HELPER: Get Orders List Handler
// ========================================
async function getOrdersListHandler(req: Request, res: Response) {
  try {
    const { token, status, payment, from, to } = req.query

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      })
    }

    // Validate token
    const validation = await secureTokenService.validateToken(token as string)
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      })
    }

    const tokenData = validation.data
    const payload = validation.payload as any

    let customerId =
      payload?.customerId || tokenData?.customerId || tokenData?.userId
    const workspaceId = tokenData?.workspaceId

    if (!customerId && tokenData?.phoneNumber && workspaceId) {
      const customer = await prisma.customers.findFirst({
        where: {
          phone: tokenData.phoneNumber,
          workspaceId: workspaceId,
        },
      })
      if (customer) {
        customerId = customer.id
        logger.info(
          `[PUBLIC-ORDERS] Found customer by phone fallback: ${customerId}`
        )
      }
    }

    if (!customerId || !workspaceId) {
      return res.status(401).json({
        success: false,
        error: "Token does not contain valid customer information",
      })
    }

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
router.get("/public/orders", publicOrdersLimiter, getOrdersListHandler)

// ✅ ALIAS: Frontend compatibility route
// 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
router.get("/orders-public", publicOrdersLimiter, getOrdersListHandler)

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
router.get("/public/orders/:orderCode", async (req: Request, res: Response) => {
  try {
    const { orderCode } = req.params
    const { token } = req.query

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      })
    }

    // Validate token
    const validation = await secureTokenService.validateToken(token as string)
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      })
    }

    const tokenData = validation.data
    const payload = validation.payload as any

    // 🔧 CRITICAL FIX: Get customerId from payload first (like checkout), then fallback to tokenData
    let customerId =
      payload?.customerId || tokenData?.customerId || tokenData?.userId
    const workspaceId = tokenData?.workspaceId

    // 🔧 ULTIMATE FALLBACK: If no customerId, try to find customer by phone number
    if (!customerId && tokenData?.phoneNumber && workspaceId) {
      const customer = await prisma.customers.findFirst({
        where: {
          phone: tokenData.phoneNumber,
          workspaceId: workspaceId,
        },
      })
      if (customer) {
        customerId = customer.id
        logger.info(
          `[PUBLIC-ORDERS] Found customer by phone fallback: ${customerId}`
        )
      }
    }

    if (!customerId || !workspaceId) {
      return res.status(401).json({
        success: false,
        error: "Token does not contain valid customer information",
      })
    }

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
            product: {
              select: {
                name: true,
                ProductCode: true,
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

    // Parse customer addresses if they're JSON strings
    let parsedCustomer = { ...order.customer }

    // Parse invoiceAddress if it's a JSON string
    if (
      parsedCustomer.invoiceAddress &&
      typeof parsedCustomer.invoiceAddress === "string"
    ) {
      try {
        parsedCustomer.invoiceAddress = JSON.parse(
          parsedCustomer.invoiceAddress
        )
      } catch (error) {
        logger.warn(
          "[PUBLIC-ORDERS] Failed to parse invoiceAddress JSON:",
          error
        )
        parsedCustomer.invoiceAddress = null
      }
    }

    // Parse address if it's a JSON string
    if (parsedCustomer.address && typeof parsedCustomer.address === "string") {
      try {
        parsedCustomer.address = JSON.parse(parsedCustomer.address)
      } catch (error) {
        logger.warn("[PUBLIC-ORDERS] Failed to parse address JSON:", error)
        parsedCustomer.address = null
      }
    }

    // Format order items
    const formattedItems = order.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      name: item.product?.name || item.service?.name || "Unknown Item",
      code: item.product?.ProductCode || item.service?.code || null,
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
        order: formattedOrder,
        customer: parsedCustomer,
        workspace: order.workspace,
      },
    })
  } catch (error) {
    logger.error("[PUBLIC-ORDERS] Error getting order details:", error)
    return res.status(500).json({
      success: false,
      error: "Error retrieving order details",
    })
  }
})

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
router.get("/customer-profile/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      })
    }

    // Validate token
    const validation = await secureTokenService.validateToken(token)
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      })
    }

    const tokenData = validation.data
    const payloadData = validation.payload

    // 🔧 CRITICAL FIX: Get customerId from payload first (like checkout), then fallback to tokenData
    let customerId =
      payloadData?.customerId || tokenData?.customerId || tokenData?.userId
    const workspaceId = tokenData?.workspaceId

    // 🔧 ULTIMATE FALLBACK: If no customerId, try to find customer by phone number
    if (!customerId && tokenData?.phoneNumber && workspaceId) {
      const customer = await prisma.customers.findFirst({
        where: {
          phone: tokenData.phoneNumber,
          workspaceId: workspaceId,
        },
      })
      if (customer) {
        customerId = customer.id
        logger.info(
          `[PUBLIC-PROFILE] Found customer by phone fallback: ${customerId}`
        )
      }
    }

    if (!customerId || !workspaceId) {
      return res.status(401).json({
        success: false,
        error: "Token does not contain valid customer information",
      })
    }

    logger.info(`[PUBLIC-PROFILE] Getting profile for customer: ${customerId}`)

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

    // Parse invoiceAddress and address if they're JSON strings
    let parsedCustomer = { ...customer }

    // Parse invoiceAddress if it's a JSON string
    if (
      parsedCustomer.invoiceAddress &&
      typeof parsedCustomer.invoiceAddress === "string"
    ) {
      try {
        parsedCustomer.invoiceAddress = JSON.parse(
          parsedCustomer.invoiceAddress
        )
      } catch (error) {
        logger.warn(
          "[PUBLIC-PROFILE] Failed to parse invoiceAddress JSON:",
          error
        )
        parsedCustomer.invoiceAddress = null
      }
    }

    // Parse address if it's a JSON string
    if (parsedCustomer.address && typeof parsedCustomer.address === "string") {
      try {
        parsedCustomer.address = JSON.parse(parsedCustomer.address)
      } catch (error) {
        logger.warn("[PUBLIC-PROFILE] Failed to parse address JSON:", error)
        parsedCustomer.address = null
      }
    }

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
})

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
router.put("/customer-profile/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params
    const updateData = req.body

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      })
    }

    // Validate token
    const validation = await secureTokenService.validateToken(token)
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      })
    }

    const tokenData = validation.data
    const payloadData = validation.payload

    // Get customer ID from either data or payload
    const customerId = tokenData?.customerId || payloadData?.customerId
    const workspaceId = tokenData?.workspaceId || payloadData?.workspaceId

    if (!customerId || !workspaceId) {
      return res.status(401).json({
        success: false,
        error: "Token does not contain valid customer information",
      })
    }

    logger.info(`[PUBLIC-PROFILE] Updating profile for customer: ${customerId}`)

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

    // Parse invoiceAddress and address if they're JSON strings
    let parsedCustomer = { ...updatedCustomer }

    // Parse invoiceAddress if it's a JSON string
    if (
      parsedCustomer.invoiceAddress &&
      typeof parsedCustomer.invoiceAddress === "string"
    ) {
      try {
        parsedCustomer.invoiceAddress = JSON.parse(
          parsedCustomer.invoiceAddress
        )
      } catch (error) {
        logger.warn(
          "[PUBLIC-PROFILE] Failed to parse invoiceAddress JSON after update:",
          error
        )
        parsedCustomer.invoiceAddress = null
      }
    }

    // Parse address if it's a JSON string
    if (parsedCustomer.address && typeof parsedCustomer.address === "string") {
      try {
        parsedCustomer.address = JSON.parse(parsedCustomer.address)
      } catch (error) {
        logger.warn(
          "[PUBLIC-PROFILE] Failed to parse address JSON after update:",
          error
        )
        parsedCustomer.address = null
      }
    }

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
})

/**
 * @swagger
 * /api/internal/get-all-products:
 *   post:
 *     tags:
 *       - Public Access
 *     summary: Get all products with discounts applied for a customer
 *     description: Returns all active products with customer-specific discounts applied
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workspaceId:
 *                 type: string
 *                 description: Workspace ID
 *               customerId:
 *                 type: string
 *                 description: Customer ID
 *             required:
 *               - workspaceId
 *               - customerId
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
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       ProductCode:
 *                         type: string
 *                       price:
 *                         type: number
 *                       originalPrice:
 *                         type: number
 *                       finalPrice:
 *                         type: number
 *                       discount:
 *                         type: number
 *                       description:
 *                         type: string
 *                       category:
 *                         type: object
 *       400:
 *         description: Missing required parameters
 *       404:
 *         description: Customer or workspace not found
 *       500:
 *         description: Internal server error
 */
router.post("/get-all-products", async (req: Request, res: Response) => {
  try {
    const { workspaceId, customerId } = req.body

    if (!workspaceId || !customerId) {
      return res.status(400).json({
        success: false,
        error: "workspaceId and customerId are required",
      })
    }

    logger.info("[GET-ALL-PRODUCTS] Request received:", {
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
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
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

      return {
        id: product.id,
        name: product.name,
        ProductCode: product.ProductCode,
        description: product.description,
        price: originalPrice,
        originalPrice: originalPrice,
        finalPrice: finalPrice,
        discount: customerDiscount,
        stock: product.stock,
        isActive: product.isActive,
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
})

// ========================================
// 🔄 ADDITIONAL ROUTE ALIAS for GET /:orderCode
// ========================================
// Note: GET /orders-public is already added above after GET /public/orders handler

/**
 * Alias: GET /orders-public/:orderCode
 * Same handler as GET /public/orders/:orderCode
 * 🔒 SECURITY: Rate limited to 30 requests per 15 minutes per IP
 */
router.get("/orders-public/:orderCode", publicOrdersLimiter, async (req: Request, res: Response) => {
  try {
    const { orderCode } = req.params
    const { token } = req.query

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Token is required",
      })
    }

    const validation = await secureTokenService.validateToken(token as string)
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      })
    }

    const tokenData = validation.data
    const payload = validation.payload as any

    let customerId =
      payload?.customerId || tokenData?.customerId || tokenData?.userId
    const workspaceId = tokenData?.workspaceId

    if (!customerId && tokenData?.phoneNumber && workspaceId) {
      const customer = await prisma.customers.findFirst({
        where: {
          phone: tokenData.phoneNumber,
          workspaceId: workspaceId,
        },
      })
      if (customer) {
        customerId = customer.id
      }
    }

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
                ProductCode: true,
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

    let parsedCustomer = { ...order.customer }

    if (
      parsedCustomer.invoiceAddress &&
      typeof parsedCustomer.invoiceAddress === "string"
    ) {
      try {
        parsedCustomer.invoiceAddress = JSON.parse(
          parsedCustomer.invoiceAddress
        )
      } catch (error) {
        parsedCustomer.invoiceAddress = null
      }
    }

    if (parsedCustomer.address && typeof parsedCustomer.address === "string") {
      try {
        parsedCustomer.address = JSON.parse(parsedCustomer.address)
      } catch (error) {
        parsedCustomer.address = null
      }
    }

    const formattedItems = order.items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      name: item.product?.name || item.service?.name || "Unknown Item",
      code: item.product?.ProductCode || item.service?.code || null,
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
})

logger.info(
  "✅ Added /orders-public/:orderCode route alias for frontend compatibility"
)

export default router
