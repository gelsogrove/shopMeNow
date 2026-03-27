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
// NOTE: ProductSearchAgent removed - LLM uses {{products}} from prompt only
import { CartRepository } from "../repositories/cart.repository"
import { OrderRepository } from "../repositories/order.repository"
import { ProductRepository } from "../repositories/product.repository"
import { ServiceRepository } from "../repositories/service.repository"
import { contactOperator } from "../domain/calling-functions/contactOperator"
import { WorkspaceCallingFunctionRepository } from "../repositories/workspace-calling-function.repository"
import { WebhookDispatchService } from "./webhook-dispatch.service"
import logger from "../utils/logger"

/**
 * Functions that require customer registration (isActive=true)
 * 
 * Philosophy: Users can chat freely without registration.
 * Registration is required ONLY for personalized functions (cart, orders, profile).
 */
/**
 * Functions that require customer registration (isActive=true) at LAYER 1 (FunctionExecutor/Router level).
 *
 * ARCHITECTURE NOTE (3-layer system):
 * - Layer 1 (Router → FunctionExecutor): guards here apply.
 * - Layer 2 (Sub-Agents LLM): confirmOrder, showCheckout, repeatOrder, handlePushNotifications
 *   are called INSIDE their respective sub-agents (OrderTrackingAgentLLM, ProfileManagementAgentLLM)
 *   and are NOT dispatched through this FunctionExecutor — so they do NOT need to be listed here.
 *
 * ❌ DO NOT add sub-agent-internal functions here (confirmOrder, showCheckout, repeatOrder, etc.)
 *    Those sub-agents handle registration checks within their own LLM prompt context.
 */
const FUNCTIONS_REQUIRING_REGISTRATION = [
  // Cart Management — called directly by FunctionExecutor
  'addItemToCart',
  'addToCart',
  'viewCart',
  'clearCart',

  // Order — called directly by FunctionExecutor (not sub-agent internal tools)
  'repeatLastOrder',
  'getOrderHistory',
  'getLastOrders',
  'getOrderDetails',

  // Profile Management — called directly by FunctionExecutor
  'getProfileLink',
]

// Functions that should be blocked for unregistered users even on informational channels
// Includes sub-agent internal tools that are not dispatched by FunctionExecutor
const FUNCTIONS_PROTECTED_FOR_UNREGISTERED = new Set([
  ...FUNCTIONS_REQUIRING_REGISTRATION,
  'getLinkOrderByCode',
  'repeatOrder',
  'confirmOrder',
  'showCheckout',
  'handlePushNotifications',
])

export interface ExecutionContext {
  workspaceId: string
  customerId: string
  customerName?: string
  customerLanguage?: string
  customerDiscount?: number // Customer's discount percentage (e.g., 10 for 10%)
  customerIsActive?: boolean // NEW: Customer registration status
  sellsProductsAndServices?: boolean // NEW: Workspace sells products/services (enables registration)
  channel?: string // "widget" | "whatsapp" — needed for contactOperator routing
}

export interface FunctionResult {
  success: boolean
  data?: any
  error?: string
  executionTimeMs: number
}

export class FunctionExecutor {
  // NOTE: productSearchAgent removed - LLM uses {{products}} from prompt only
  private cartManagementAgent: CartManagementAgent
  private productRepo: ProductRepository
  private orderRepo: OrderRepository
  private cartRepo: CartRepository
  private serviceRepo: ServiceRepository
  private callingFunctionRepo: WorkspaceCallingFunctionRepository
  private webhookDispatcher: WebhookDispatchService

  constructor(private prisma: PrismaClient) {
    // Initialize repositories
    this.productRepo = new ProductRepository()
    this.cartRepo = new CartRepository()
    this.orderRepo = new OrderRepository()
    this.serviceRepo = new ServiceRepository()
    this.callingFunctionRepo = new WorkspaceCallingFunctionRepository(prisma)
    this.webhookDispatcher = new WebhookDispatchService()

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
        customerIsActive: context.customerIsActive,
      })

      // 🔐 REGISTRATION GUARD: Check if function requires registration
      if (FUNCTIONS_PROTECTED_FOR_UNREGISTERED.has(functionName)) {
        if (!context.customerIsActive) {
          // 🛍️ Registration link only if workspace sells products/services
          if (context.sellsProductsAndServices) {
            logger.warn(`🚫 Registration required for function: ${functionName}`, {
              customerId: context.customerId,
              workspaceId: context.workspaceId,
            })

            return {
              success: false,
              error: 'REGISTRATION_REQUIRED',
              data: {
                message: `Per utilizzare "${functionName}" devi completare la registrazione: [LINK_REGISTRATION]`,
                functionName,
                requiresRegistration: true,
              },
              executionTimeMs: Date.now() - startTime,
            }
          } else {
            // 🚫 Function not available if workspace doesn't sell products
            logger.warn(`🚫 Function not available (workspace doesn't sell products): ${functionName}`, {
              customerId: context.customerId,
              workspaceId: context.workspaceId,
            })

            return {
              success: false,
              error: 'FEATURE_NOT_AVAILABLE',
              data: {
                message: `La funzione "${functionName}" non è disponibile per questo canale.`,
                functionName,
                requiresRegistration: false,
              },
              executionTimeMs: Date.now() - startTime,
            }
          }
        }
      }

      // 🆕 Load function from DB to check executionType
      const dbFunction = await this.callingFunctionRepo.findByName(context.workspaceId, functionName)

      // 🛍️ Load workspace for webhook settings/isolation
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: context.workspaceId },
      })

      // Route to correct implementation
      let result: any
      const executionType = dbFunction?.executionType || "INTERNAL"

      if (executionType === "WEBHOOK" && dbFunction) {
        // Load workspace for webhook settings
        if (!workspace) {
          throw new Error(`Workspace not found: ${context.workspaceId}`)
        }

        // 🆕 Priority: 1. Function-specific URL, 2. Global Workspace URL
        const finalUrl = dbFunction.webhookUrl || workspace.webhookUrl

        if (!finalUrl) {
          throw new Error(`Webhook URL not configured for function ${functionName} or workspace ${context.workspaceId}`)
        }

        result = await this.webhookDispatcher.dispatch({
          url: finalUrl,
          secret: workspace.webhookSecret || undefined, // 🔐 FIX: pass HMAC secret so signing actually activates
          timeout: workspace.webhookTimeout || undefined,
          payload: {
            function: functionName,
            parameters: args,
            context: {
              workspaceId: context.workspaceId,
              customerId: context.customerId,
              customerLanguage: context.customerLanguage
            }
          }
        })

        logger.info(`✅ Webhook function ${functionName} executed successfully`)
      } else {
        // Handle INTERNAL or DELEGATE_TO_AGENT
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

          // Website scraping function
          case "fetchWebsitePage":
            result = await this.fetchWebsitePage(args, context)
            break

          // Direct function calls (Sub-Agents)
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

          case "getProfileLink":
            result = await this.getProfileLink(context)
            break

          case "contactOperator":
            result = await this.contactOperator(args, context)
            break

          default:
            if (executionType === "DELEGATE_TO_AGENT") {
              throw new Error(`Sub-agent handler for "${functionName}" not implemented`)
            }
            throw new Error(`Unknown internal function: ${functionName}`)
        }
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

  // NOTE: searchProducts method removed - LLM uses {{products}} from prompt only

  /**
   * Add product to cart
   */
  private async addToCart(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    // Build cart context
    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    // Batch add (items array)
    if (Array.isArray(args.items) && args.items.length > 0 && !args.productId) {
      const results = []
      for (const item of args.items) {
        if (!item?.productId) {
          throw new Error("addToCart requires 'productId' for each item")
        }
        const quantity = item.quantity ?? 1
        if (quantity <= 0) {
          throw new Error("addToCart requires 'quantity' > 0")
        }

        const result = await this.cartManagementAgent.addToCart(cartContext, {
          productId: item.productId,
          quantity,
          notes: item.notes,
          type: item.type,
        })
        results.push(result)
      }

      const anyFailed = results.some((r: any) => r?.success === false)
      return { success: !anyFailed, results }
    }

    // Single item add
    if (!args.productId) {
      throw new Error("addToCart requires 'productId'")
    }
    if (!args.quantity || args.quantity <= 0) {
      throw new Error("addToCart requires 'quantity' > 0")
    }

    const result = await this.cartManagementAgent.addToCart(cartContext, {
      productId: args.productId,
      quantity: args.quantity,
      notes: args.notes,
      type: args.type,
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
    const cartItemId = await this.resolveCartItemId(args, context, "removeFromCart")

    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    const result = await this.cartManagementAgent.removeFromCart(
      cartContext,
      cartItemId
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
    if (args.newQuantity === undefined || args.newQuantity < 0) {
      throw new Error("updateCartQuantity requires 'newQuantity' >= 0")
    }
    const cartItemId = await this.resolveCartItemId(args, context, "updateCartQuantity")

    const cartContext = {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      customerName: context.customerName,
      language: context.customerLanguage,
      customerDiscount: context.customerDiscount,
    }

    const result = await this.cartManagementAgent.updateQuantity(cartContext, {
      cartItemId,
      newQuantity: args.newQuantity,
    })

    return result
  }

  /**
   * Resolve cartItemId from cartItemId, sku, or productName
   */
  private async resolveCartItemId(
    args: Record<string, any>,
    context: ExecutionContext,
    actionName: string
  ): Promise<string> {
    if (args.cartItemId) {
      return args.cartItemId
    }

    const cart = await this.cartRepo.getOrCreateCart(
      context.workspaceId,
      context.customerId
    )

    if (args.sku) {
      const product = await this.productRepo.findBySku(
        args.sku,
        context.workspaceId
      )
      if (product) {
        const item = cart.items.find((i) => i.productId === product.id)
        if (item) return item.id
      }

      const service = await this.serviceRepo.findByServiceCode(
        args.sku,
        context.workspaceId
      )
      if (service) {
        const item = cart.items.find((i) => i.serviceId === service.id)
        if (item) return item.id
      }
    }

    if (args.productName) {
      const target = String(args.productName).toLowerCase()
      const item = cart.items.find((i) => {
        const name = i.product?.name || i.service?.name || ""
        return name.toLowerCase() === target
      })
      if (item) return item.id
    }

    throw new Error(`${actionName} could not find item in cart`)
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
    logger.info("📞 contactSupport CF called, invoking contactOperator.ts", {
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      reason: args.reason,
      urgency: args.urgency,
    })

    // Get customer phone number to call contactOperator
    const customer = await this.prisma.customers.findUnique({
      where: { id: context.customerId },
      select: { phone: true },
    })

    if (!customer) {
      throw new Error(`Customer not found: ${context.customerId}`)
    }

    // Call the actual contactOperator function
    // CRITICAL: pass channel so contactOperator sets originChannel correctly.
    // widget → replies saved as ConversationMessage (polled by widget)
    // whatsapp → replies queued via WhatsApp
    const result = await contactOperator({
      phoneNumber: customer.phone,
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      reason: args.reason || "Customer requested operator assistance",
      channel: context.channel || "whatsapp", // default to whatsapp for backward compat
    })

    logger.info("✅ contactOperator completed", {
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
            error: `removeFromCart requires 'sku', 'productName', or 'cartItemId'`,
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

  /**
   * 🌐 Fetch Website Page - Scrape content from business website
   * USE ONLY when customer asks info NOT in FAQ/products/services
   */
  private async fetchWebsitePage(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("🌐 Fetching website content", { args, context })

    const { CallingFunctionsService } = require("./calling-functions.service")
    const callingFunctionsService = new CallingFunctionsService()

    const result = await callingFunctionsService.fetchWebsitePage({
      url: args.url,
      workspaceId: context.workspaceId,
    })

    return result
  }

  /**
   * 🔗 Get Profile Link - Generate secure token link to customer profile page
   */
  private async getProfileLink(context: ExecutionContext): Promise<any> {
    logger.info("🔗 Generating profile link", { context })

    const { CallingFunctionsService } = require("./calling-functions.service")
    const callingFunctions = new CallingFunctionsService()

    return await callingFunctions.getProfileLink({
      workspaceId: context.workspaceId,
      customerId: context.customerId,
    })
  }

  /**
   * 🆘 Contact Operator - Escalate to human support
   */
  private async contactOperator(
    args: Record<string, any>,
    context: ExecutionContext
  ): Promise<any> {
    logger.info("🆘 Contacting operator", { args, context })

    const { CallingFunctionsService } = require("./calling-functions.service")
    const callingFunctions = new CallingFunctionsService()

    return await callingFunctions.contactOperator({
      workspaceId: context.workspaceId,
      customerId: context.customerId,
      reason: args.reason || "Customer requested support",
      urgency: args.urgency || "medium",
      channel: context.channel, // 🐛 FIX: must forward channel so contactOperator routes reply to the correct channel (widget vs whatsapp)
    })
  }
}
