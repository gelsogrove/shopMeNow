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

import { PrismaClient } from "@prisma/client"
import { CartManagementAgent } from "../application/agents/CartManagementAgent"
import { ProductSearchAgent } from "../application/agents/ProductSearchAgent"
import { CartRepository } from "../repositories/cart.repository"
import { OrderRepository } from "../repositories/order.repository"
import { ProductRepository } from "../repositories/product.repository"
import logger from "../utils/logger"

export interface ExecutionContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
}

export interface FunctionResult {
  success: boolean
  data?: any
  error?: string
  executionTimeMs: number
}

export class FunctionExecutor {
  private productSearchAgent: ProductSearchAgent
  private cartManagementAgent: CartManagementAgent
  private productRepo: ProductRepository
  private cartRepo: CartRepository
  private orderRepo: OrderRepository

  constructor(private prisma: PrismaClient) {
    // Initialize repositories
    this.productRepo = new ProductRepository()
    this.cartRepo = new CartRepository()
    this.orderRepo = new OrderRepository()

    // Initialize agents
    this.productSearchAgent = new ProductSearchAgent(prisma)
    this.cartManagementAgent = new CartManagementAgent(
      this.cartRepo,
      this.productRepo,
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

        // Direct function calls (Sub-Agents)
        case "searchProducts":
          result = await this.searchProducts(args, context)
          break

        case "addToCart":
          result = await this.addToCart(args, context)
          break

        case "viewCart":
          result = await this.viewCart(context)
          break

        case "removeFromCart":
          result = await this.removeFromCart(args, context)
          break

        case "updateCartQuantity":
          result = await this.updateCartQuantity(args, context)
          break

        case "clearCart":
          result = await this.clearCart(context)
          break

        case "repeatLastOrder":
          result = await this.repeatLastOrder(context)
          break

        case "getOrders":
          result = await this.getOrders(args, context)
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

  /**
   * Search products in catalog
   */
  private async searchProducts(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // Validate required parameters
    if (!args.keywords || !Array.isArray(args.keywords)) {
      throw new Error("searchProducts requires 'keywords' array")
    }

    // Build search context
    const searchContext = {
      detectedLanguage: context.customerLanguage || "it",
      keywords: args.keywords,
      filters: {
        category: args.category,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice,
        allergens: args.allergens,
        certifications: args.certifications,
      },
      urgency: "medium" as "medium" | "low" | "high",
    }

    // Execute search via ProductSearchAgent
    const result = await this.productSearchAgent.search(
      context.workspaceId,
      searchContext
    )

    return result
  }

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
    }

    const result = await this.cartManagementAgent.repeatOrder(cartContext, {
      orderId: lastOrder.id,
    })

    return result
  }

  /**
   * Get customer orders
   */
  private async getOrders(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // If specific order requested
    if (args.orderId) {
      const order = await this.orderRepo.findById(
        context.workspaceId,
        args.orderId
      )

      if (!order) {
        return {
          success: false,
          message: `Order ${args.orderId} not found`,
        }
      }

      // Check order belongs to customer (security)
      if (order.customerId !== context.customerId) {
        return {
          success: false,
          message: "Unauthorized access to order",
        }
      }

      return {
        success: true,
        orders: [order],
        totalCount: 1,
      }
    }

    // Get recent orders (all for customer)
    const orders = await this.orderRepo.findByCustomerId(
      context.customerId,
      context.workspaceId
    )

    // Limit results if requested
    const limit = args.limit || 10
    const limitedOrders = orders.slice(0, limit)

    return {
      success: true,
      orders: limitedOrders,
      totalCount: orders.length,
    }
  }

  /**
   * Contact support (create ticket)
   */
  private async contactSupport(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // Validate required parameters
    if (!args.reason) {
      throw new Error("contactSupport requires 'reason'")
    }
    if (!args.urgency) {
      throw new Error("contactSupport requires 'urgency'")
    }

    // TODO: Implement support ticket creation
    // For now, just log and return acknowledgment
    logger.info("📞 Support ticket created", {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      reason: args.reason,
      urgency: args.urgency,
    })

    return {
      success: true,
      ticketId: `TICKET-${Date.now()}`, // Temporary ID
      message: "Support ticket created. An operator will contact you soon.",
      estimatedResponseTime: args.urgency === "high" ? "15 minutes" : "1 hour",
    }
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
      case "searchProducts":
        if (!args.keywords || !Array.isArray(args.keywords)) {
          return {
            valid: false,
            error: "searchProducts requires 'keywords' array",
          }
        }
        break

      case "addToCart":
        if (!args.productId) {
          return { valid: false, error: "addToCart requires 'productId'" }
        }
        if (!args.quantity || args.quantity <= 0) {
          return {
            valid: false,
            error: "addToCart requires 'quantity' > 0",
          }
        }
        break

      case "removeFromCart":
      case "updateCartQuantity":
        if (!args.cartItemId) {
          return {
            valid: false,
            error: `${functionName} requires 'cartItemId'`,
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
      case "getOrders":
        break

      // Delegation functions
      case "productSearchAgent":
      case "cartManagementAgent":
      case "orderTrackingAgent":
      case "customerSupportAgent":
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
    logger.info("🔍 Delegating to Product Search Agent", { args, context })

    // Return a special response that signals llm-router.service.ts to call Product Search Agent
    return {
      delegateTo: "PRODUCT_SEARCH",
      query: args.query,
      message: `Delegating to Product Search Agent for: ${args.query}`,
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
}
