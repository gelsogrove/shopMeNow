/**
 * FunctionExecutor
 *
 * Maps function calls from Router LLM to actual agent implementations.
 *
 * Responsibilities:
 * 1. Validate function names and parameters
 * 2. Execute the correct agent/repository method
 * 3. Handle errors gracefully
 * 4. Log all executions
 * 5. Return standardized results
 *
 * @architecture Clean Architecture - Dependency Injection
 */

import { PrismaClient } from "@echatbot/database"
import { CartManagementAgent } from "../application/agents/CartManagementAgent"
// NOTE: ProductSearchAgent removed - LLM uses {{PRODUCTS}} from prompt only
import { CartRepository } from "../repositories/cart.repository"
import { OrderRepository } from "../repositories/order.repository"
import { ProductRepository } from "../repositories/product.repository"
import { ServiceRepository } from "../repositories/service.repository"
import { ContactOperator } from "../domain/calling-functions/ContactOperator"
import logger from "../utils/logger"

export interface ExecutionContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number // Customer's discount percentage (e.g., 10 for 10%)
}

export interface FunctionResult {
  success: boolean
  data?: any
  error?: string
  executionTimeMs: number
}

export class FunctionExecutor {
  // NOTE: productSearchAgent removed - LLM uses {{PRODUCTS}} from prompt only
  private cartManagementAgent: CartManagementAgent
  private productRepo: ProductRepository
  private serviceRepo: ServiceRepository
  private cartRepo: CartRepository
  private orderRepo: OrderRepository

  constructor(private prisma: PrismaClient) {
    // Initialize repositories
    this.productRepo = new ProductRepository()
    this.serviceRepo = new ServiceRepository()
    this.cartRepo = new CartRepository()
    this.orderRepo = new OrderRepository()

    // Initialize agents
    // NOTE: ProductSearchAgent removed - no database search needed
    this.cartManagementAgent = new CartManagementAgent(
      this.cartRepo,
      this.productRepo,
      this.serviceRepo,
      this.orderRepo
    )

    logger.info("✅ FunctionExecutor initialized with all agents")
  }

  /**
   * Execute a function by name
   *
   * @param functionName - Name of function to execute
   * @param args - Function arguments (validated by caller)
   * @param context - Execution context (workspace, customer, etc.)
   * @returns FunctionResult with data or error
   */
  async execute(
    functionName: string,
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<FunctionResult> {
    const startTime = Date.now()

    try {
      logger.info(`⚙️ Executing function: ${functionName}`, {
        workspaceId: context.workspaceId,
        customerId: context.customerId,
        args,
      })

      // Route to correct implementation
      let result: any

      switch (functionName) {
        // Delegation functions (Router → Sub-Agent)
        case "productSearchAgent":
          result = await this.delegateToProductSearch(args, context)
          break

        case "cartManagementAgent":
          result = await this.delegateToCartManagement(args, context)
          break

        case "orderTrackingAgent":
          result = await this.delegateToOrderTracking(args, context)
          break

        case "customerSupportAgent":
          result = await this.delegateToCustomerSupport(args, context)
          break

        case "profileManagementAgent":
          result = await this.delegateToProfileManagement(args, context)
          break

        // Direct function calls (Sub-Agents)
        // NOTE: searchProducts removed - LLM uses {{PRODUCTS}} from prompt

        case "addItemToCart":
        case "addToCart": // backward compatibility
          result = await this.addToCart(args, context)
          break

        case "viewCart":
          result = await this.viewCart(context)
          break

        case "removeFromCart":
          result = await this.removeFromCart(args, context)
          break

        case "updateCartItem":
        case "updateCartQuantity": // backward compatibility
          result = await this.updateCartQuantity(args, context)
          break

        case "clearCart":
          result = await this.clearCart(context)
          break

        case "repeatLastOrder":
          result = await this.repeatLastOrder(context)
          break

        // Order Tracking Functions (aligned naming)
        case "getOrderHistory":
          result = await this.getOrderHistory(args, context)
          break

        case "getLastOrders":
          result = await this.getLastOrders(args, context)
          break

        case "getOrderDetails":
          result = await this.getOrderDetails(args, context)
          break

        case "trackOrderStatus":
          result = await this.trackOrderStatus(args, context)
          break

        // Backward compatibility aliases (deprecated)
        case "getOrders":
          logger.warn("⚠️ DEPRECATED: Use getOrderHistory instead of getOrders")
          result = await this.getOrderHistory(args, context)
          break

        case "getOrder":
          logger.warn("⚠️ DEPRECATED: Use getOrderDetails instead of getOrder")
          result = await this.getOrderDetails(args, context)
          break

        case "trackOrder":
          logger.warn(
            "⚠️ DEPRECATED: Use trackOrderStatus instead of trackOrder"
          )
          result = await this.trackOrderStatus(args, context)
          break

        case "contactSupport":
          result = await this.contactSupport(args, context)
          break

        default:
          throw new Error(`Unknown function: ${functionName}`)
      }

      const executionTimeMs = Date.now() - startTime

      logger.info(`✅ Function executed successfully: ${functionName}`, {
        executionTimeMs,
      })

      return {
        success: true,
        data: result,
        executionTimeMs,
      }
    } catch (error) {
      const executionTimeMs = Date.now() - startTime

      logger.error(`❌ Function execution failed: ${functionName}`, {
        error,
        executionTimeMs,
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs,
      }
    }
  }

  // NOTE: searchProducts method removed - LLM uses {{PRODUCTS}} from prompt only

  /**
   * Add product to cart
   */
  private async addToCart(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // Validate required parameters
    if (!args.productId) {
      throw new Error("addToCart requires 'productId'")
    }
    if (!args.quantity || args.quantity <= 0) {
      throw new Error("addToCart requires 'quantity' > 0")
    }

    // Build cart context
    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    // Execute via CartManagementAgent
    const result = await this.cartManagementAgent.addToCart(cartContext, {
      productId: args.productId,
      quantity: args.quantity,
      notes: args.notes,
    })

    return result
  }

  /**
   * View cart contents
   */
  private async viewCart(context: ExecutionContext): Promise<any> {
    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    const result = await this.cartManagementAgent.getCart(cartContext)
    return result
  }

  /**
   * Remove item from cart
   */
  private async removeFromCart(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // Validate required parameters
    if (!args.cartItemId) {
      throw new Error("removeFromCart requires 'cartItemId'")
    }

    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    const result = await this.cartManagementAgent.removeFromCart(
      cartContext,
      args.cartItemId
    )

    return result
  }

  /**
   * Update cart item quantity
   */
  private async updateCartQuantity(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // Validate required parameters
    if (!args.cartItemId) {
      throw new Error("updateCartQuantity requires 'cartItemId'")
    }
    if (args.newQuantity === undefined || args.newQuantity < 0) {
      throw new Error("updateCartQuantity requires 'newQuantity' >= 0")
    }

    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    const result = await this.cartManagementAgent.updateQuantity(cartContext, {
      cartItemId: args.cartItemId,
      newQuantity: args.newQuantity,
    })

    return result
  }

  /**
   * Clear entire cart
   */
  private async clearCart(context: ExecutionContext): Promise<any> {
    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    const result = await this.cartManagementAgent.resetCart(cartContext)
    return result
  }

  /**
   * Repeat last order (copy items to cart)
   */
  private async repeatLastOrder(context: ExecutionContext): Promise<any> {
    // Get last order for customer
    const orders = await this.orderRepo.findByCustomerId(
      context.customerId,
      context.workspaceId
    )

    if (!orders || orders.length === 0) {
      return {
        success: false,
        message: "No previous orders found",
      }
    }

    const lastOrder = orders[0]

    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    const result = await this.cartManagementAgent.repeatOrder(cartContext, {
      orderId: lastOrder.id,
    })

    return result
  }

  /**
   * Get customer complete order history
   */
  private async getOrderHistory(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const limit = args.limit || 10
    const orders = await this.orderRepo.findByCustomerId(
      context.customerId,
      context.workspaceId
    )

    // Return limited orders with correct field mapping
    const limitedOrders = orders.slice(0, Math.min(limit, 50))

    // Map orders to include totalAmount explicitly for LLM consumption
    const mappedOrders = limitedOrders.map((order: any) => ({
      orderCode: order.orderCode,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount || 0, // ✅ Use totalAmount, not totalPrice
      status: order.status,
      itemCount: order.items?.length || 0,
    }))

    return {
      success: true,
      orders: mappedOrders,
      total: orders.length,
      limit: limitedOrders.length,
    }
  }

  /**
   * Get last N orders with summary details
   */
  private async getLastOrders(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    const limit = args.limit || 20
    const orders = await this.orderRepo.findByCustomerId(
      context.customerId,
      context.workspaceId
    )

    // Return only the first N orders (already sorted by date DESC)
    const limitedOrders = orders.slice(0, Math.min(limit, 50))

    return limitedOrders.map((order: any) => ({
      orderCode: order.orderCode,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount || 0, // ✅ Fixed: use totalAmount, not totalPrice
      status: order.status,
      itemCount: order.items?.length || 0,
    }))
  }

  /**
   * Get detailed information about a specific order
   */
  private async getOrderDetails(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    let order = null

    // If orderCode provided, get specific order
    if (args.orderCode) {
      order = await this.orderRepo.findByOrderCode(
        args.orderCode,
        context.workspaceId
      )
    } else {
      // If no orderCode, get last order
      const orders = await this.orderRepo.findByCustomerId(
        context.customerId,
        context.workspaceId
      )
      order = orders && orders.length > 0 ? orders[0] : null
    }

    if (!order) {
      return {
        success: false,
        message: args.orderCode
          ? `Ordine ${args.orderCode} non trovato`
          : "Nessun ordine trovato",
      }
    }

    return {
      success: true,
      order: order,
    }
  }

  /**
   * Track order status
   */
  private async trackOrderStatus(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    if (!args.orderCode) {
      return {
        success: false,
        error: "Order code required",
        message: "Fornisci il codice ordine per il tracking",
      }
    }

    const order = await this.orderRepo.findByOrderCode(
      args.orderCode,
      context.workspaceId
    )

    if (!order) {
      return {
        success: false,
        error: "Order not found",
        message: `Ordine ${args.orderCode} non trovato`,
      }
    }

    return {
      success: true,
      order: order,
      status: order.status,
      trackingNumber: order.trackingNumber || null,
    }
  }

  /**
   * Get customer orders (DEPRECATED - use getOrderHistory)
   * @deprecated Use getOrderHistory, getLastOrders, or getOrderDetails instead
   */
  private async getOrders(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // Backward compatibility: delegate to new methods
    logger.warn(
      "⚠️ DEPRECATED METHOD CALLED: getOrders - use getOrderHistory instead"
    )

    if (args.orderId) {
      // Single order request → use getOrderDetails
      return this.getOrderDetails({ orderCode: args.orderId }, context)
    }

    // Multiple orders → use getOrderHistory
    return this.getOrderHistory(args, context)
  }

  /**
   * Contact support (create ticket)
   */
  private async contactSupport(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("📞 contactSupport CF called, invoking ContactOperator.ts", {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      reason: args.reason,
      urgency: args.urgency,
    })

    // Get customer phone number to call ContactOperator
    const customer = await this.prisma.customers.findUnique({
      where: { id: context.customerId },
      select: { phone: true },
    })

    if (!customer) {
      throw new Error(`Customer not found: ${context.customerId}`)
    }

    // Call the actual ContactOperator function
    const result = await ContactOperator({
      phoneNumber: customer.phone,
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      reason: args.reason || "Customer requested operator assistance",
    })

    logger.info("✅ ContactOperator completed", {
      success: result.success,
      customerId: context.customerId,
    })

    return result
  }

  /**
   * Validate function arguments against schema
   *
   * @param functionName - Function name
   * @param args - Arguments to validate
   * @returns Validation result
   */
  static validateArguments(
    functionName: string,
    args: Record<string, any>
  ): { valid: boolean; error?: string } {
    // Basic validation - can be extended with Zod schemas
    switch (functionName) {
      // NOTE: searchProducts validation removed - function disabled

      case "addItemToCart":
      case "addToCart":
        if (!args.productId && !args.items) {
          return { valid: false, error: "addItemToCart requires 'productId' or 'items'" }
        }
        if (args.productId && (!args.quantity || args.quantity <= 0)) {
          return {
            valid: false,
            error: "addItemToCart requires 'quantity' > 0",
          }
        }
        break

      case "removeFromCart":
        // Now uses sku/productName instead of cartItemId
        if (!args.cartItemId && !args.sku && !args.productName) {
          return {
            valid: false,
            error: `removeFromCart requires 'sku' or 'productName'`,
          }
        }
        break

      case "updateCartItem":
      case "updateCartQuantity":
        if (args.newQuantity === undefined || args.newQuantity < 0) {
          return {
            valid: false,
            error: `${functionName} requires 'newQuantity' >= 0`,
          }
        }
        // Allow sku/productName or cartItemId
        if (!args.cartItemId && !args.sku && !args.productName) {
          return {
            valid: false,
            error: `${functionName} requires 'sku', 'productName', or 'cartItemId'`,
          }
        }
        break

      case "contactSupport":
        if (!args.reason || !args.urgency) {
          return {
            valid: false,
            error: "contactSupport requires 'reason' and 'urgency'",
          }
        }
        break

      // Functions with no required args
      case "viewCart":
      case "clearCart":
      case "repeatLastOrder":
      case "getOrderHistory":
      case "getLastOrders":
      case "getOrderDetails":
        // Optional arguments only
        break

      case "trackOrderStatus":
        if (!args.orderCode) {
          return {
            valid: false,
            error: "trackOrderStatus requires 'orderCode'",
          }
        }
        break

      // Deprecated functions (backward compatibility)
      case "getOrders":
      case "getOrder":
      case "trackOrder":
        // Allow deprecated functions but log warning
        logger.warn(`⚠️ DEPRECATED FUNCTION: ${functionName}`)
        break
      case "getOrders":
        break

      // Delegation functions
      case "productSearchAgent":
      case "cartManagementAgent":
      case "orderTrackingAgent":
      case "customerSupportAgent":
      case "profileManagementAgent":
        if (!args.query) {
          return {
            valid: false,
            error: `${functionName} requires 'query' parameter`,
          }
        }
        break

      default:
        return { valid: false, error: `Unknown function: ${functionName}` }
    }

    return { valid: true }
  }

  /**
   * Delegation methods - Router → Sub-Agent
   * These methods signal that a sub-agent should be called
   */

  private async delegateToProductSearch(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("🔍 Delegating to Product and Services Agent", {
      args,
      context,
    })

    // Return a special response that signals llm-router.service.ts to call Product and Services Agent
    return {
      delegateTo: "PRODUCT_SEARCH",
      query: args.query,
      message: `Delegating to Product and Services Agent for: ${args.query}`,
    }
  }

  private async delegateToCartManagement(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("🛒 Delegating to Cart Management Agent", { args, context })

    return {
      delegateTo: "CART_MANAGEMENT",
      query: args.query,
      message: `Delegating to Cart Management Agent for: ${args.query}`,
    }
  }

  private async delegateToOrderTracking(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("📦 Delegating to Order Tracking Agent", { args, context })

    return {
      delegateTo: "ORDER_TRACKING",
      query: args.query,
      message: `Delegating to Order Tracking Agent for: ${args.query}`,
    }
  }

  private async delegateToCustomerSupport(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("💬 Delegating to Customer Support Agent", { args, context })

    return {
      delegateTo: "CUSTOMER_SUPPORT",
      query: args.query,
      message: `Delegating to Customer Support Agent for: ${args.query}`,
    }
  }

  private async delegateToProfileManagement(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("👤 Delegating to Profile Management Agent", { args, context })

    return {
      delegateTo: "PROFILE_MANAGEMENT",
      query: args.query,
      message: `Delegating to Profile Management Agent for: ${args.query}`,
    }
  }
}
