/**
 * ResponseBuilder Service - Code-First LLM Architecture
 *
 * RESPONSIBILITY: Deterministic logic for formatting responses
 *
 * PRINCIPLES:
 * - ALL decisions are made by CODE, not LLM
 * - Grouping rules: >10 products → group by category
 * - Count display: always show (N items)
 * - Numeric options: numbered list for selection
 * - NO LLM calls in this service
 *
 * OUTPUT: StructuredResponse ready for LLMFormatter
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { Intent } from "../intent/intent.types"
import {
  LoadedData,
  CategoryData,
  ProductData,
  CartData,
  OrderData,
  WorkspaceIdentityData,
  WorkspaceLocationData,
} from "../data-loader/data-loader.service"

// ================================================================================
// RESPONSE TYPES - What we send to LLMFormatter
// ================================================================================

export type ResponseType =
  | "CATEGORY_LIST"
  | "PRODUCT_LIST"
  | "PRODUCT_GROUPED"
  | "PRODUCT_NEEDS_SMART_GROUPING"  // LLM creates logical groups (e.g., "Formaggi Freschi" vs "Stagionati")
  | "PRODUCT_DETAIL"
  | "CART_VIEW"
  | "CART_EMPTY"
  | "CART_UPDATED"
  | "ORDER_LIST"
  | "ORDER_DETAIL"
  | "ORDER_NOT_FOUND"
  | "IDENTITY"
  | "LOCATION"
  | "GREETING"
  | "GOODBYE"
  | "THANKS"
  | "HELP"
  | "HUMAN_SUPPORT"
  | "ERROR"
  | "NO_RESULTS"
  | "SIMPLE_TEXT"
  | "NEEDS_LLM_FORMAT"

export interface StructuredResponse {
  type: ResponseType
  data: ResponseData
  formatting: FormattingInstructions
  context: ResponseContext
  // For simple text responses
  text?: string
  // For LLM formatting
  template?: string
}

export interface ResponseData {
  // For lists
  items?: ListItem[]
  groups?: GroupedItems[]
  count?: number

  // For single items
  product?: ProductData
  order?: OrderData
  cart?: CartData

  // For workspace info
  identity?: WorkspaceIdentityData
  location?: WorkspaceLocationData

  // For errors
  errorMessage?: string
  
  // 🆕 For smart grouping (PRODUCT_NEEDS_SMART_GROUPING)
  categoryName?: string
}

export interface ListItem {
  number: number // 1-based for user selection
  id: string
  name: string
  sku?: string // Product code for cart operations
  price?: number
  priceWithDiscount?: number
  stock?: number
  description?: string
  extra?: string // category name, region, etc.
}

export interface GroupedItems {
  groupName: string
  variantCount: number
  items: ListItem[]
}

export interface FormattingInstructions {
  showNumbers: boolean // Show numbered list for selection
  showPrices: boolean // Show prices
  showStock: boolean // Show stock availability
  showTotal: boolean // Show total count "(N items)"
  groupByCategory: boolean // Group products by category
  includeEmoji: boolean // Include emoji in response
  maxItemsBeforeGroup: number // Threshold for grouping (default 10)
}

export interface ResponseContext {
  intentType: string
  customerLanguage: string
  hasDiscount: boolean
  discountPercent: number
}

// ================================================================================
// DEFAULT FORMATTING
// ================================================================================

const DEFAULT_FORMATTING: FormattingInstructions = {
  showNumbers: true,
  showPrices: true,
  showStock: false, // Only show for cart
  showTotal: true,
  groupByCategory: false,
  includeEmoji: true,
  maxItemsBeforeGroup: 5, // AC-10: 6+ prodotti = grouping (soglia = 5, quindi >5 = group)
}

// ================================================================================
// RESPONSE BUILDER SERVICE
// ================================================================================

export class ResponseBuilderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point - build structured response from loaded data
   */
  build(
    intent: Intent,
    loadedData: LoadedData,
    options: {
      customerName?: string
      customerLanguage?: string
      workspaceId: string
    }
  ): StructuredResponse {
    logger.info("🏗️ [ResponseBuilder] Building response", {
      intentType: intent.type,
      dataType: loadedData.type,
    })

    const context: ResponseContext = {
      intentType: intent.type,
      customerLanguage: options.customerLanguage || "it",
      hasDiscount: false,
      discountPercent: 0,
    }

    // Handle errors first
    if (loadedData.type === "ERROR") {
      return this.buildErrorResponse(loadedData.error, context)
    }

    // Build response based on data type
    switch (loadedData.type) {
      case "CATEGORIES":
        return this.buildCategoryList(loadedData.categories, context)

      case "PRODUCTS":
        return this.buildProductList(loadedData.products, context)

      case "PRODUCT_DETAIL":
        return this.buildProductDetail(loadedData.product, context)

      case "CART":
        return this.buildCartResponse(loadedData.cart, context)

      case "ORDER_LIST":
        return this.buildOrderList(loadedData.orders, context)

      case "ORDER_DETAIL":
        return this.buildOrderDetail(loadedData.order, context)

      case "IDENTITY":
        return this.buildIdentityResponse(loadedData.identity, context)

      case "LOCATION":
        return this.buildLocationResponse(loadedData.location, context)

      case "EMPTY":
        return this.buildEmptyResponse(intent.type, loadedData.reason, context)

      default:
        return this.buildErrorResponse("Unknown data type", context)
    }
  }

  // ================================================================================
  // CATEGORY BUILDERS
  // ================================================================================

  private buildCategoryList(
    categories: CategoryData[],
    context: ResponseContext
  ): StructuredResponse {
    if (categories.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "No categories available" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    const items: ListItem[] = categories.map((cat, index) => ({
      number: index + 1,
      id: cat.id,
      name: cat.name,
      description: cat.description,
      extra: cat.productCount > 0 ? `${cat.productCount} prodotti` : undefined,
    }))

    return {
      type: "CATEGORY_LIST",
      data: {
        items,
        count: categories.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showPrices: false,
        showStock: false,
      },
      context,
    }
  }

  // ================================================================================
  // PRODUCT BUILDERS
  // ================================================================================

  private buildProductList(
    products: ProductData[],
    context: ResponseContext
  ): StructuredResponse {
    if (products.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "No products found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    // RULE: If >5 products, try to group by category
    // But only if we can create 2+ meaningful groups
    if (products.length > DEFAULT_FORMATTING.maxItemsBeforeGroup) {
      const grouped = this.buildGroupedProducts(products, context)
      
      // 🔧 FIX: PRODUCT_NEEDS_SMART_GROUPING should be returned directly!
      // It doesn't have `groups`, it has `items` for LLM to group
      if (grouped.type === "PRODUCT_NEEDS_SMART_GROUPING") {
        logger.info("🏗️ [ResponseBuilder] Smart grouping needed for single category", {
          count: products.length,
          category: products[0]?.categoryName,
        })
        return grouped
      }
      
      // Only use category grouping if we have 2+ groups (1 group is useless)
      if (grouped.data.groups && grouped.data.groups.length >= 2) {
        return grouped
      }
      // Otherwise fall through to simple list
    }

    // Simple list
    const items: ListItem[] = products.map((p, index) => ({
      number: index + 1,
      id: p.id,
      name: p.name,
      sku: p.sku, // Include SKU for cart operations
      price: p.price,
      priceWithDiscount: p.priceWithDiscount,
      stock: p.stock,
      description: p.description,
      extra: p.categoryName || p.region,
    }))

    return {
      type: "PRODUCT_LIST",
      data: {
        items,
        count: products.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showStock: products.some((p) => !p.isAvailable),
      },
      context,
    }
  }

  private buildGroupedProducts(
    products: ProductData[],
    context: ResponseContext
  ): StructuredResponse {
    // Group by category
    const groupMap = new Map<string, ProductData[]>()

    for (const product of products) {
      const groupName = product.categoryName || "Altri prodotti"
      if (!groupMap.has(groupName)) {
        groupMap.set(groupName, [])
      }
      groupMap.get(groupName)!.push(product)
    }

    // If ALL products are in the SAME category (1 group with 6+ items),
    // we need SMART GROUPING by LLM (e.g., "Formaggi Freschi" vs "Formaggi Stagionati")
    if (groupMap.size === 1 && products.length >= 6) {
      // Pass raw products to LLM for intelligent grouping
      const items: ListItem[] = products.map((p, index) => ({
        number: index + 1,
        id: p.id,
        name: p.name,
        sku: p.sku, // Include SKU for cart operations
        price: p.price,
        priceWithDiscount: p.priceWithDiscount,
        stock: p.stock,
        description: p.description,
        extra: p.region || p.formato,
      }))
      
      return {
        type: "PRODUCT_NEEDS_SMART_GROUPING",
        data: {
          items,
          count: products.length,
          categoryName: products[0].categoryName || "Prodotti",
        },
        formatting: {
          ...DEFAULT_FORMATTING,
          groupByCategory: true,
        },
        context,
      }
    }

    let itemNumber = 1
    const groups: GroupedItems[] = []

    for (const [groupName, groupProducts] of groupMap) {
      const items: ListItem[] = groupProducts.map((p) => ({
        number: itemNumber++,
        id: p.id,
        name: p.name,
        sku: p.sku, // Include SKU for cart operations
        price: p.price,
        priceWithDiscount: p.priceWithDiscount,
        stock: p.stock,
        extra: p.region || p.formato,
      }))

      groups.push({
        groupName,
        variantCount: groupProducts.length,
        items,
      })
    }

    return {
      type: "PRODUCT_GROUPED",
      data: {
        groups,
        count: products.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        groupByCategory: true,
      },
      context,
    }
  }

  private buildProductDetail(
    product: ProductData | null,
    context: ResponseContext
  ): StructuredResponse {
    if (!product) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "Product not found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    return {
      type: "PRODUCT_DETAIL",
      data: { product },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false, // No selection needed
        showStock: true, // Show availability
      },
      context,
    }
  }

  // ================================================================================
  // CART BUILDERS
  // ================================================================================

  private buildCartResponse(
    cart: CartData,
    context: ResponseContext
  ): StructuredResponse {
    if (cart.isEmpty) {
      return {
        type: "CART_EMPTY",
        data: { cart },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    const items: ListItem[] = cart.items.map((item, index) => ({
      number: index + 1,
      id: item.productId,
      name: item.productName,
      price: item.totalPrice,
      stock: item.stock,
      extra: `${item.quantity}×`,
    }))

    return {
      type: "CART_VIEW",
      data: {
        items,
        cart,
        count: cart.itemCount,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showStock: true,
        showTotal: true,
      },
      context,
    }
  }

  // ================================================================================
  // ORDER BUILDERS
  // ================================================================================

  private buildOrderList(
    orders: OrderData[],
    context: ResponseContext
  ): StructuredResponse {
    if (orders.length === 0) {
      return {
        type: "NO_RESULTS",
        data: { errorMessage: "No orders found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    const items: ListItem[] = orders.map((o, index) => ({
      number: index + 1,
      id: o.id,
      name: `#${o.code}`,
      price: o.totalAmount,
      extra: o.status,
    }))

    return {
      type: "ORDER_LIST",
      data: {
        items,
        count: orders.length,
      },
      formatting: {
        ...DEFAULT_FORMATTING,
        showStock: false,
      },
      context,
    }
  }

  private buildOrderDetail(
    order: OrderData | null,
    context: ResponseContext
  ): StructuredResponse {
    if (!order) {
      return {
        type: "ORDER_NOT_FOUND",
        data: { errorMessage: "Order not found" },
        formatting: { ...DEFAULT_FORMATTING, showNumbers: false },
        context,
      }
    }

    return {
      type: "ORDER_DETAIL",
      data: { order },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
      },
      context,
    }
  }

  // ================================================================================
  // WORKSPACE INFO BUILDERS
  // ================================================================================

  private buildIdentityResponse(
    identity: WorkspaceIdentityData,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "IDENTITY",
      data: { identity },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  private buildLocationResponse(
    location: WorkspaceLocationData,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "LOCATION",
      data: { location },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  // ================================================================================
  // SIMPLE INTENT BUILDERS
  // ================================================================================

  private buildEmptyResponse(
    intentType: string,
    reason: string,
    context: ResponseContext
  ): StructuredResponse {
    // Map simple intents to response types
    const typeMap: Record<string, ResponseType> = {
      GREETING: "GREETING",
      GOODBYE: "GOODBYE",
      THANKS: "THANKS",
      ASK_HELP: "HELP",
      HUMAN_SUPPORT: "HUMAN_SUPPORT",
    }

    const responseType = typeMap[intentType] || "NEEDS_LLM_FORMAT"

    return {
      type: responseType,
      data: {},
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
        showPrices: false,
      },
      context,
    }
  }

  private buildErrorResponse(
    errorMessage: string,
    context: ResponseContext
  ): StructuredResponse {
    return {
      type: "ERROR",
      data: { errorMessage },
      formatting: {
        ...DEFAULT_FORMATTING,
        showNumbers: false,
      },
      context,
    }
  }
}

// ================================================================================
// SINGLETON INSTANCE
// ================================================================================

let responseBuilderInstance: ResponseBuilderService | null = null

export function getResponseBuilder(prisma: PrismaClient): ResponseBuilderService {
  if (!responseBuilderInstance) {
    responseBuilderInstance = new ResponseBuilderService(prisma)
  }
  return responseBuilderInstance
}
