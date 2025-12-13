/**
 * DataLoader Service - Code-First LLM Architecture
 *
 * RESPONSIBILITY: Load data from database based on intent type
 *
 * PRINCIPLES:
 * - ALL data comes from database (NO hardcoded values)
 * - ALL queries filter by workspaceId (multi-tenant isolation)
 * - Returns raw data, no formatting decisions
 * - Deterministic: same intent + params = same data
 */

import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import {
  Intent,
  isProductSearchIntent,
  isCartIntent,
  isOrderIntent,
  isSupportIntent,
  isSelectionIntent,
  ShowCategoryIntent,
  ShowProductIntent,
  SearchProductsIntent,
  AddToCartIntent,
  RemoveFromCartIntent,
  UpdateCartQuantityIntent,
  OrderDetailsIntent,
  SelectOptionIntent,
} from "../intent/intent.types"
import { OptionsMappingService } from "../chat-engine/options-mapping.service"

// ================================================================================
// DATA TYPES - What we return from database
// ================================================================================

export interface CategoryData {
  id: string
  name: string
  description?: string
  productCount: number
}

export interface ProductData {
  id: string
  name: string
  sku?: string
  description?: string
  price: number
  priceWithDiscount?: number
  stock: number
  imageUrl?: string
  categoryId?: string
  categoryName?: string
  region?: string
  formato?: string
  certifications: string[]
  allergens: string[]
  isAvailable: boolean
}

export interface CartItemData {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  stock: number
}

export interface CartData {
  id: string
  items: CartItemData[]
  itemCount: number
  totalAmount: number
  isEmpty: boolean
}

export interface OrderData {
  id: string
  code: string
  status: string
  totalAmount: number
  itemCount: number
  createdAt: Date
  items?: OrderItemData[]
}

export interface OrderItemData {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface WorkspaceIdentityData {
  name: string
  description?: string
  botName?: string
  welcomeMessage?: string
}

export interface WorkspaceLocationData {
  address?: string
  phone?: string
  email?: string
}

// ================================================================================
// LOADED DATA UNION TYPE
// ================================================================================

export type LoadedData =
  | { type: "CATEGORIES"; categories: CategoryData[] }
  | { type: "PRODUCTS"; products: ProductData[] }
  | { type: "PRODUCT_DETAIL"; product: ProductData | null }
  | { type: "CART"; cart: CartData }
  | { type: "ORDER_LIST"; orders: OrderData[] }
  | { type: "ORDER_DETAIL"; order: OrderData | null }
  | { type: "IDENTITY"; identity: WorkspaceIdentityData }
  | { type: "LOCATION"; location: WorkspaceLocationData }
  | { type: "EMPTY"; reason: string }
  | { type: "ERROR"; error: string }

// ================================================================================
// DATA LOADER SERVICE
// ================================================================================

export class DataLoaderService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point - load data based on intent
   */
  async loadForIntent(
    intent: Intent,
    workspaceId: string,
    customerId: string,
    customerDiscount: number = 0
  ): Promise<LoadedData> {
    logger.info("📦 [DataLoader] Loading data for intent", {
      intentType: intent.type,
      workspaceId,
      customerId,
    })

    // Product Search Intents
    if (isProductSearchIntent(intent)) {
      switch (intent.type) {
        case "SHOW_CATEGORIES":
          return this.loadCategories(workspaceId)
        case "SHOW_CATEGORY":
          return this.loadProductsByCategory(workspaceId, customerDiscount, (intent as ShowCategoryIntent).categoryName)
        case "SHOW_PRODUCT":
          return this.loadProductByName(workspaceId, customerDiscount, (intent as ShowProductIntent).productName)
        case "SEARCH_PRODUCTS":
          return this.loadProductSearch(workspaceId, customerDiscount, (intent as SearchProductsIntent).query)
        default:
          return this.loadProducts(workspaceId, customerDiscount)
      }
    }

    // Cart Intents
    if (isCartIntent(intent)) {
      switch (intent.type) {
        case "VIEW_CART":
          return this.loadCart(workspaceId, customerId, customerDiscount)
        case "ADD_TO_CART":
          return this.handleCartAdd(workspaceId, customerId, customerDiscount, intent as AddToCartIntent)
        case "REMOVE_FROM_CART":
          return this.handleCartRemove(workspaceId, customerId, intent as RemoveFromCartIntent)
        case "UPDATE_CART_QUANTITY":
          return this.handleCartUpdate(workspaceId, customerId, customerDiscount, intent as UpdateCartQuantityIntent)
        case "CLEAR_CART":
          return this.handleCartClear(workspaceId, customerId)
        default:
          return this.loadCart(workspaceId, customerId, customerDiscount)
      }
    }

    // Order Intents
    if (isOrderIntent(intent)) {
      switch (intent.type) {
        case "VIEW_ORDERS":
          return this.loadOrders(workspaceId, customerId)
        case "ORDER_DETAILS":
          return this.loadOrderStatus(workspaceId, customerId, (intent as OrderDetailsIntent).orderCode)
        default:
          return this.loadOrders(workspaceId, customerId)
      }
    }

    // Support Intents
    if (isSupportIntent(intent)) {
      switch (intent.type) {
        case "ASK_IDENTITY":
          return this.loadWorkspaceIdentity(workspaceId)
        case "ASK_LOCATION":
        case "ASK_CONTACT":
          return this.loadWorkspaceLocation(workspaceId)
        default:
          return { type: "EMPTY", reason: "support_intent" }
      }
    }

    // Selection Intent - interpret based on listType
    if (isSelectionIntent(intent)) {
      const selectIntent = intent as SelectOptionIntent
      
      // Clean the resolvedValue to remove count suffixes, emojis, etc.
      const cleanedValue = OptionsMappingService.cleanLabel(selectIntent.resolvedValue)
      
      logger.info("📦 [DataLoader] Processing selection", {
        number: selectIntent.number,
        resolvedValue: selectIntent.resolvedValue,
        cleanedValue,
        listType: selectIntent.listType,
        skus: selectIntent.skus,
      })

      switch (selectIntent.listType) {
        case "CATEGORIES":
          // User selected a category → load products in that category
          return this.loadProductsByCategory(workspaceId, customerDiscount, cleanedValue)
        
        case "PRODUCTS":
          // User selected a product → load product detail
          return this.loadProductByName(workspaceId, customerDiscount, cleanedValue)
        
        case "ORDERS":
          // User selected an order → load order details
          return this.loadOrderStatus(workspaceId, customerId, cleanedValue)
        
        case "CART_ITEMS":
          // User selected a cart item → could be for removal/update
          return this.loadCart(workspaceId, customerId, customerDiscount)
        
        case "GROUPS":
          // User selected a product group
          // If SKUs are provided, load products by SKUs directly
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            const products = await this.loadProductsBySkus(workspaceId, selectIntent.skus, customerDiscount)
            return { type: "PRODUCTS", products }
          }
          // Fallback: try by group name (for backward compatibility)
          return this.loadProductsByGroup(workspaceId, customerDiscount, cleanedValue)
        
        case "SERVICES":
          // User selected a service
          return this.loadServiceByName(workspaceId, cleanedValue)
        
        default:
          logger.warn("📦 [DataLoader] Unknown listType for selection", { listType: selectIntent.listType })
          return { type: "EMPTY", reason: `unknown_list_type_${selectIntent.listType}` }
      }
    }

    // Default - simple intents
    return { type: "EMPTY", reason: intent.type }
  }

  // ================================================================================
  // CATALOG LOADERS
  // ================================================================================

  private async loadCategories(workspaceId: string): Promise<LoadedData> {
    try {
      const categories = await this.prisma.categories.findMany({
        where: { workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          description: true,
          _count: {
            select: { productCategories: true },
          },
        },
        orderBy: { name: "asc" },
      })

      const categoryData: CategoryData[] = categories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description || undefined,
        productCount: c._count.productCategories,
      }))

      return { type: "CATEGORIES", categories: categoryData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading categories", { error })
      return { type: "ERROR", error: "Failed to load categories" }
    }
  }

  private async loadProducts(
    workspaceId: string,
    customerDiscount: number,
    limit: number = 100
  ): Promise<LoadedData> {
    try {
      const products = await this.prisma.products.findMany({
        where: { workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          certifications: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
        take: limit,
      })

      const productData = this.mapProducts(products, customerDiscount)
      return { type: "PRODUCTS", products: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products", { error })
      return { type: "ERROR", error: "Failed to load products" }
    }
  }

  private async loadProductsByCategory(
    workspaceId: string,
    customerDiscount: number,
    categoryName: string
  ): Promise<LoadedData> {
    try {
      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          productCategories: {
            some: {
              category: {
                name: { contains: categoryName, mode: "insensitive" },
              },
            },
          },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          certifications: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      })

      const productData = this.mapProducts(products, customerDiscount)
      return { type: "PRODUCTS", products: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products by category", { error })
      return { type: "ERROR", error: "Failed to load products" }
    }
  }

  private async loadProductByName(
    workspaceId: string,
    customerDiscount: number,
    productName: string
  ): Promise<LoadedData> {
    try {
      const product = await this.prisma.products.findFirst({
        where: {
          workspaceId,
          isActive: true,
          name: { contains: productName, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          certifications: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
      })

      if (!product) {
        return { type: "PRODUCT_DETAIL", product: null }
      }

      const productData = this.mapProduct(product, customerDiscount)
      return { type: "PRODUCT_DETAIL", product: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading product", { error })
      return { type: "ERROR", error: "Failed to load product" }
    }
  }

  private async loadProductSearch(
    workspaceId: string,
    customerDiscount: number,
    query: string
  ): Promise<LoadedData> {
    try {
      // SEMPRE usa LLM per filtrare - capisce sinonimi, altre lingue, termini generici
      // Es: "latticini" → formaggi, "dairy" → formaggi, "qualcosa di fresco" → prodotti freschi
      logger.info("📦 [DataLoader] Loading all products for LLM semantic search", {
        query,
        workspaceId,
      })

      const allProducts = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          certifications: true,
          allergens: true,
          productCategories: {
            select: {
              category: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      })

      if (allProducts.length === 0) {
        logger.info("📦 [DataLoader] No products in workspace", { workspaceId })
        return { type: "PRODUCTS", products: [] }
      }

      // LLM filtra i prodotti in base alla query
      // Capisce: sinonimi, altre lingue, termini generici, categorie implicite
      const filteredProducts = await this.semanticFilterProducts(allProducts, query, customerDiscount)
      
      logger.info("📦 [DataLoader] LLM filtered products", {
        query,
        totalProducts: allProducts.length,
        matchingProducts: filteredProducts.length,
      })

      return { type: "PRODUCTS", products: filteredProducts }
    } catch (error) {
      logger.error("❌ [DataLoader] Error searching products", { error })
      return { type: "ERROR", error: "Failed to search products" }
    }
  }

  // ================================================================================
  // CART OPERATIONS
  // ================================================================================

  private async loadCart(
    workspaceId: string,
    customerId: string,
    customerDiscount: number
  ): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({
        where: { customerId, workspaceId },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, price: true, stock: true } },
            },
          },
        },
      })

      if (!cart) {
        return {
          type: "CART",
          cart: { id: "", items: [], itemCount: 0, totalAmount: 0, isEmpty: true },
        }
      }

      const cartItems: CartItemData[] = cart.items.map((item) => {
        const unitPrice = customerDiscount > 0
          ? item.product.price * (1 - customerDiscount / 100)
          : item.product.price
        return {
          id: item.id,
          productId: item.productId || "",
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
          stock: item.product.stock,
        }
      })

      const totalAmount = cartItems.reduce((sum, item) => sum + item.totalPrice, 0)

      return {
        type: "CART",
        cart: { id: cart.id, items: cartItems, itemCount: cartItems.length, totalAmount, isEmpty: cartItems.length === 0 },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading cart", { error })
      return { type: "ERROR", error: "Failed to load cart" }
    }
  }

  private async handleCartAdd(
    workspaceId: string,
    customerId: string,
    customerDiscount: number,
    intent: AddToCartIntent
  ): Promise<LoadedData> {
    try {
      logger.info("🛒 [DataLoader] Adding to cart", {
        productId: intent.productId,
        productName: intent.productName,
        quantity: intent.quantity,
      })

      // Find product by ID (preferred) or by name (fallback with fuzzy search)
      let product
      if (intent.productId) {
        product = await this.prisma.products.findFirst({
          where: { id: intent.productId, workspaceId, isActive: true },
          select: { id: true, name: true, price: true, stock: true },
        })
      }
      
      if (!product && intent.productName) {
        // Try exact contains first
        product = await this.prisma.products.findFirst({
          where: { workspaceId, isActive: true, name: { contains: intent.productName, mode: "insensitive" } },
          select: { id: true, name: true, price: true, stock: true },
        })
        
        // If not found, try fuzzy search with word roots (handles plurals like "pecorini" → "pecorino")
        if (!product) {
          // Remove common Italian plural endings and search
          const searchTerm = intent.productName
            .replace(/i$/i, "")  // pecorini → pecorin
            .replace(/e$/i, "")  // mele → mel
            .replace(/hi$/i, "o") // funghi → fungo
            .trim()
          
          if (searchTerm.length >= 3) {
            product = await this.prisma.products.findFirst({
              where: { 
                workspaceId, 
                isActive: true, 
                name: { contains: searchTerm, mode: "insensitive" } 
              },
              select: { id: true, name: true, price: true, stock: true },
            })
            
            if (product) {
              logger.info("🛒 [DataLoader] Found product via fuzzy search", {
                searchTerm,
                originalTerm: intent.productName,
                foundProduct: product.name,
              })
            }
          }
        }
      }

      if (!product) {
        logger.warn("🛒 [DataLoader] Product not found for cart add", {
          productId: intent.productId,
          productName: intent.productName,
          searchAttempts: {
            byId: !!intent.productId,
            byExactName: !!intent.productName,
            fuzzySearchTerm: intent.productName?.replace(/i$/i, "").replace(/e$/i, "").replace(/hi$/i, "o").trim(),
          }
        })
        return { type: "ERROR", error: "Product not found" }
      }
      
      if (product.stock !== null && product.stock < intent.quantity) {
        return { type: "ERROR", error: `Insufficient stock. Available: ${product.stock}` }
      }

      let cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (!cart) {
        cart = await this.prisma.carts.create({ data: { customerId, workspaceId } })
      }

      const existingItem = await this.prisma.cartItems.findFirst({ where: { cartId: cart.id, productId: product.id } })
      if (existingItem) {
        await this.prisma.cartItems.update({ where: { id: existingItem.id }, data: { quantity: existingItem.quantity + intent.quantity } })
        logger.info("🛒 [DataLoader] Updated existing cart item", {
          productName: product.name,
          newQuantity: existingItem.quantity + intent.quantity,
        })
      } else {
        await this.prisma.cartItems.create({ data: { cartId: cart.id, productId: product.id, quantity: intent.quantity } })
        logger.info("🛒 [DataLoader] Created new cart item", {
          productName: product.name,
          quantity: intent.quantity,
        })
      }

      return this.loadCart(workspaceId, customerId, customerDiscount)
    } catch (error) {
      logger.error("❌ [DataLoader] Error adding to cart", { error })
      return { type: "ERROR", error: "Failed to add to cart" }
    }
  }

  private async handleCartRemove(
    workspaceId: string,
    customerId: string,
    intent: RemoveFromCartIntent
  ): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (!cart) return { type: "ERROR", error: "Cart not found" }

      const product = await this.prisma.products.findFirst({
        where: { workspaceId, name: { contains: intent.productName, mode: "insensitive" } },
      })
      if (product) {
        await this.prisma.cartItems.deleteMany({ where: { cartId: cart.id, productId: product.id } })
      }

      return this.loadCart(workspaceId, customerId, 0)
    } catch (error) {
      logger.error("❌ [DataLoader] Error removing from cart", { error })
      return { type: "ERROR", error: "Failed to remove from cart" }
    }
  }

  private async handleCartUpdate(
    workspaceId: string,
    customerId: string,
    customerDiscount: number,
    intent: UpdateCartQuantityIntent
  ): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (!cart) return { type: "ERROR", error: "Cart not found" }

      if (intent.quantity <= 0) {
        return this.handleCartRemove(workspaceId, customerId, { type: "REMOVE_FROM_CART", productName: intent.productName })
      }

      const product = await this.prisma.products.findFirst({
        where: { workspaceId, name: { contains: intent.productName, mode: "insensitive" } },
      })
      if (product) {
        await this.prisma.cartItems.updateMany({ where: { cartId: cart.id, productId: product.id }, data: { quantity: intent.quantity } })
      }

      return this.loadCart(workspaceId, customerId, customerDiscount)
    } catch (error) {
      logger.error("❌ [DataLoader] Error updating cart", { error })
      return { type: "ERROR", error: "Failed to update cart" }
    }
  }

  private async handleCartClear(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      const cart = await this.prisma.carts.findFirst({ where: { customerId, workspaceId } })
      if (cart) {
        await this.prisma.cartItems.deleteMany({ where: { cartId: cart.id } })
      }
      return { type: "CART", cart: { id: cart?.id || "", items: [], itemCount: 0, totalAmount: 0, isEmpty: true } }
    } catch (error) {
      logger.error("❌ [DataLoader] Error clearing cart", { error })
      return { type: "ERROR", error: "Failed to clear cart" }
    }
  }

  // ================================================================================
  // ORDER LOADERS
  // ================================================================================

  private async loadOrders(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      const orders = await this.prisma.orders.findMany({
        where: { customerId, workspaceId },
        include: {
          items: { select: { quantity: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      })

      const orderData: OrderData[] = orders.map((o) => ({
        id: o.id,
        code: o.orderCode,
        status: o.status,
        totalAmount: o.totalAmount,
        itemCount: o.items.reduce((sum, item) => sum + item.quantity, 0),
        createdAt: o.createdAt,
      }))

      return { type: "ORDER_LIST", orders: orderData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading orders", { error })
      return { type: "ERROR", error: "Failed to load orders" }
    }
  }

  private async loadOrderStatus(workspaceId: string, customerId: string, orderCode: string): Promise<LoadedData> {
    try {
      const order = await this.prisma.orders.findFirst({
        where: {
          OR: [
            { id: orderCode, customerId, workspaceId },
            { orderCode: orderCode, customerId, workspaceId },
          ],
        },
        include: {
          items: {
            select: {
              quantity: true,
              unitPrice: true,
              totalPrice: true,
              product: { select: { name: true } },
            },
          },
        },
      })

      if (!order) return { type: "ORDER_DETAIL", order: null }

      return {
        type: "ORDER_DETAIL",
        order: {
          id: order.id,
          code: order.orderCode,
          status: order.status,
          totalAmount: order.totalAmount,
          itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            productName: item.product?.name || "Unknown",
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading order", { error })
      return { type: "ERROR", error: "Failed to load order" }
    }
  }

  // ================================================================================
  // WORKSPACE INFO
  // ================================================================================

  private async loadWorkspaceIdentity(workspaceId: string): Promise<LoadedData> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, description: true, botIdentityResponse: true, welcomeMessage: true },
      })
      if (!workspace) return { type: "ERROR", error: "Workspace not found" }
      // Handle botIdentityResponse (String) and welcomeMessage (Json)
      let welcomeMsg: string | undefined = undefined
      if (workspace.welcomeMessage) {
        welcomeMsg = typeof workspace.welcomeMessage === "string" 
          ? workspace.welcomeMessage 
          : JSON.stringify(workspace.welcomeMessage)
      }
      return {
        type: "IDENTITY",
        identity: {
          name: workspace.name,
          description: workspace.description || undefined,
          botName: workspace.botIdentityResponse || undefined,
          welcomeMessage: welcomeMsg,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading workspace identity", { error })
      return { type: "ERROR", error: "Failed to load workspace info" }
    }
  }

  private async loadWorkspaceLocation(workspaceId: string): Promise<LoadedData> {
    try {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { address: true, notificationEmail: true, whatsappPhoneNumber: true },
      })
      if (!workspace) return { type: "ERROR", error: "Workspace not found" }
      return {
        type: "LOCATION",
        location: {
          address: workspace.address || undefined,
          email: workspace.notificationEmail || undefined,
          phone: workspace.whatsappPhoneNumber || undefined,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading workspace location", { error })
      return { type: "ERROR", error: "Failed to load location info" }
    }
  }

  /**
   * Load products by group name (for hierarchical categories)
   * Groups are sub-categories like "Formaggi Freschi" within "Formaggi"
   */
  private async loadProductsByGroup(
    workspaceId: string,
    customerDiscount: number,
    groupName: string
  ): Promise<LoadedData> {
    try {
      // Groups could be stored as categories with parent relationship
      // or as tags/attributes on products
      // For now, treat group as a category name
      return this.loadProductsByCategory(workspaceId, customerDiscount, groupName)
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products by group", { error })
      return { type: "ERROR", error: "Failed to load products by group" }
    }
  }

  /**
   * Load products by SKU codes
   * Used when user selects a smart group that contains specific SKUs
   * 🆕 Made public for use in FAST-PATH groupMapping resolution
   */
  async loadProductsBySkus(
    workspaceId: string,
    skus: string[],
    customerDiscount: number = 0
  ): Promise<ProductData[]> {
    try {
      logger.info("📦 [DataLoader] Loading products by SKUs", {
        skus,
        count: skus.length,
      })

      const products = await this.prisma.products.findMany({
        where: {
          workspaceId,
          isActive: true,
          sku: { in: skus },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          certifications: true,
          allergens: true,
          productCategories: {
            select: {
              category: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      })

      if (products.length === 0) {
        logger.warn("📦 [DataLoader] No products found for SKUs", { skus })
        return []
      }

      const productData = products.map((p) => this.mapProduct(p, customerDiscount))

      logger.info("📦 [DataLoader] Products loaded by SKUs", {
        requested: skus.length,
        found: productData.length,
      })

      return productData
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading products by SKUs", { error, skus })
      return []
    }
  }

  /**
   * Load a specific service by name
   */
  private async loadServiceByName(
    workspaceId: string,
    serviceName: string
  ): Promise<LoadedData> {
    try {
      const product = await this.prisma.products.findFirst({
        where: {
          workspaceId,
          isActive: true,
          name: { contains: serviceName, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          description: true,
          price: true,
          stock: true,
          imageUrl: true,
          region: true,
          formato: true,
          certifications: true,
          allergens: true,
        },
      })

      if (!product) {
        return { type: "PRODUCT_DETAIL", product: null }
      }

      const serviceData = this.mapProduct(product, 0)
      return { type: "PRODUCT_DETAIL", product: serviceData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading service", { error })
      return { type: "ERROR", error: "Failed to load service" }
    }
  }

  // ================================================================================
  // SEMANTIC FILTERING (LLM-powered)
  // ================================================================================

  /**
   * Use LLM to filter products semantically based on a query
   * E.g., "latticini" → finds products in "Formaggi" category
   */
  private async semanticFilterProducts(
    products: any[],
    query: string,
    customerDiscount: number
  ): Promise<ProductData[]> {
    try {
      // Build a compact list of products with categories for the LLM
      const productList = products.map((p, i) => ({
        idx: i,
        name: p.name,
        category: p.productCategories?.[0]?.category?.name || "Altro",
        desc: (p.description || "").substring(0, 100),
      }))

      // Ask LLM to identify matching product indices
      const openRouterApiKey = process.env.OPENROUTER_API_KEY
      if (!openRouterApiKey) {
        logger.warn("⚠️ [DataLoader] OPENROUTER_API_KEY not set, cannot do semantic search")
        return []
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a precise product filter for an e-commerce catalog. Given a search query and a product list, identify products that match the user's search intent.

HOW TO HANDLE QUERIES:

1. CATEGORY queries - user wants ALL products in a category:
   - Look at the category in parentheses for each product
   - Return ALL products belonging to that category

2. QUALIFIED/SUBSET queries - user wants a SPECIFIC SUBSET:
   - Query has a qualifier (fresh, aged, organic, premium, frozen, etc.)
   - Analyze product NAMES and DESCRIPTIONS to find matches
   - Use your knowledge to understand product characteristics from names/descriptions
   - Return ONLY products matching BOTH the category AND the qualifier

3. PRODUCT NAME queries - user searching for a specific product:
   - Return products whose name matches or contains the query

4. SEMANTIC queries - user uses synonyms or related terms:
   - Map the term to the appropriate category or product type using your knowledge

RULES:
- Return a JSON array of matching product indices, e.g. [0, 3, 5, 8]
- Be INCLUSIVE for category queries (return all in category)
- Be STRICT for qualified queries (must match the qualifier)
- If nothing matches, return []
- Analyze the actual product data provided, don't assume`,
            },
            {
              role: "user",
              content: `Query: "${query}"

Products:
${productList.map((p) => `${p.idx}. ${p.name} (${p.category}) - ${p.desc}`).join("\n")}

Return ONLY the JSON array of indices for products that match "${query}":`,
            },
          ],
          temperature: 0.2,
          max_tokens: 200,
        }),
        signal: AbortSignal.timeout(3000), // 3s timeout
      })

      if (!response.ok) {
        logger.warn(`⚠️ [DataLoader] Semantic search LLM error: ${response.status}`)
        return []
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content?.trim() || "[]"

      // Parse the JSON array of indices
      let matchingIndices: number[] = []
      try {
        // Handle potential markdown code blocks
        const jsonStr = content.replace(/```json?\n?|\n?```/g, "").trim()
        matchingIndices = JSON.parse(jsonStr)
        if (!Array.isArray(matchingIndices)) {
          matchingIndices = []
        }
      } catch {
        logger.warn(`⚠️ [DataLoader] Failed to parse semantic search result: ${content}`)
        return []
      }

      // Debug: show what products were matched
      const matchedNames = matchingIndices
        .filter((idx) => idx >= 0 && idx < products.length)
        .map((idx) => products[idx]?.name)

      logger.info("📦 [DataLoader] Semantic search found matches", {
        query,
        matchCount: matchingIndices.length,
        totalProducts: products.length,
        matchedProducts: matchedNames.slice(0, 10), // First 10 for brevity
        indices: matchingIndices,
      })

      // Filter and return matching products
      const matchingProducts = matchingIndices
        .filter((idx) => idx >= 0 && idx < products.length)
        .map((idx) => products[idx])

      return this.mapProducts(matchingProducts, customerDiscount)
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        logger.warn("⏱️ [DataLoader] Semantic search timed out")
      } else {
        logger.error("❌ [DataLoader] Semantic search error", { error })
      }
      return []
    }
  }

  // ================================================================================
  // HELPERS
  // ================================================================================

  private mapProducts(products: any[], customerDiscount: number): ProductData[] {
    return products.map((p) => this.mapProduct(p, customerDiscount))
  }

  private mapProduct(p: any, customerDiscount: number): ProductData {
    const discountedPrice = customerDiscount > 0 ? p.price * (1 - customerDiscount / 100) : undefined
    // Handle certifications which can be Json
    const certs = Array.isArray(p.certifications) ? p.certifications.map(String) : []
    const allergenList = Array.isArray(p.allergens) ? p.allergens.map(String) : []
    return {
      id: p.id,
      name: p.name,
      sku: p.sku || undefined,
      description: p.description || undefined,
      price: p.price,
      priceWithDiscount: discountedPrice,
      stock: p.stock,
      imageUrl: Array.isArray(p.imageUrl) && p.imageUrl.length > 0 ? String(p.imageUrl[0]) : undefined,
      categoryId: p.productCategories?.[0]?.category?.id,
      categoryName: p.productCategories?.[0]?.category?.name,
      region: p.region || undefined,
      formato: p.formato || undefined,
      certifications: certs,
      allergens: allergenList,
      isAvailable: p.stock > 0,
    }
  }
}

// ================================================================================
// SINGLETON
// ================================================================================

let dataLoaderInstance: DataLoaderService | null = null

export function getDataLoader(prisma: PrismaClient): DataLoaderService {
  if (!dataLoaderInstance) {
    dataLoaderInstance = new DataLoaderService(prisma)
  }
  return dataLoaderInstance
}
