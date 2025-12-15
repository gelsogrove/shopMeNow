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
  isServiceIntent,
  isSupportIntent,
  isSelectionIntent,
  ShowCategoryIntent,
  ShowProductIntent,
  SearchProductsIntent,
  ShowOffersIntent,
  ShowServiceIntent,
  AddToCartIntent,
  RemoveFromCartIntent,
  UpdateCartQuantityIntent,
  OrderDetailsIntent,
  SelectOptionIntent,
  AskFAQIntent,
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

export interface ServiceData {
  id: string
  name: string
  code: string
  description?: string
  price: number
  priceWithDiscount?: number
  currency: string
  duration?: number
  imageUrl?: string[]
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
  hasCreditNotes?: boolean
  creditNotesCount?: number
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

export interface FAQData {
  id: string
  question: string
  answer: string
  keywords: string[]
  category?: string
}

export interface CustomerProfileData {
  name: string
  email?: string
  phone?: string
  discount: number  // Percentage discount (0-100)
  language?: string
}

export interface OfferData {
  id: string
  name: string
  description?: string
  discountPercent: number
  categoryName?: string
  startDate: Date
  endDate: Date
}

/**
 * Agent info for B2B customers
 * @see Feature 202 - Agent Variables
 */
export interface AgentInfoData {
  hasAgent: boolean
  name?: string
  email?: string
  phone?: string
  reason?: "workspace_no_agents" | "no_agent_assigned"
  message?: string
}

// ================================================================================
// LOADED DATA UNION TYPE
// ================================================================================

export type LoadedData =
  | { type: "CATEGORIES"; categories: CategoryData[] }
  | { type: "PRODUCTS"; products: ProductData[] }
  | { type: "PRODUCT_DETAIL"; product: ProductData | null }
  | { type: "SERVICES"; services: ServiceData[] }
  | { type: "SERVICE_DETAIL"; service: ServiceData | null }
  | { type: "CART"; cart: CartData }
  | { type: "ORDER_LIST"; orders: OrderData[] }
  | { type: "ORDER_DETAIL"; order: OrderData | null }
  | { type: "IDENTITY"; identity: WorkspaceIdentityData }
  | { type: "LOCATION"; location: WorkspaceLocationData }
  | { type: "FAQ"; faqs: FAQData[]; query: string }
  | { type: "PROFILE"; profile: CustomerProfileData }
  | { type: "OFFERS"; offers: OfferData[] }
  | { type: "ORDER_ACTION"; action: "SEND_INVOICE" | "REPEAT_ORDER" | "SEND_CREDIT_NOTES"; orderCode?: string }
  | { type: "AGENT_INFO"; agentInfo: AgentInfoData }
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
        case "SHOW_OFFERS":
          return this.loadOffers(workspaceId, customerDiscount)  // 🆕 Pass discount for single-offer optimization
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

    // Service Intents
    if (isServiceIntent(intent)) {
      switch (intent.type) {
        case "VIEW_SERVICES":
          return this.loadServices(workspaceId)
        case "SHOW_SERVICE":
          return this.loadServiceByName(workspaceId, (intent as ShowServiceIntent).serviceName)
        default:
          return this.loadServices(workspaceId)
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
        case "ASK_FAQ":
          // Load FAQs and pass the user query for context matching
          return this.loadFAQs(workspaceId, (intent as AskFAQIntent).query || "")
        case "VIEW_PROFILE":
          // Load customer profile (includes discount info)
          return this.loadCustomerProfile(workspaceId, customerId)
        case "SHOW_AGENT_INFO":
          // Load agent info for B2B customers
          return this.loadAgentInfo(workspaceId, customerId)
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
          // 🆕 FIX: Use SKU if available (more reliable than name search)
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            logger.info("📦 [DataLoader] Loading product by SKU (reliable)", {
              sku: selectIntent.skus[0],
            })
            return this.loadProductBySku(workspaceId, customerDiscount, selectIntent.skus[0])
          }
          // Fallback to name search (less reliable)
          return this.loadProductByName(workspaceId, customerDiscount, cleanedValue)
        
        case "ORDERS":
          // User selected an order → load order details
          // 🆕 CLEAN ARCHITECTURE: Use optionId if available (saved from ResponseBuilder)
          if (selectIntent.optionId) {
            // If optionId is an action (SEND_INVOICE, REPEAT_ORDER), treat as action
            if (["SEND_INVOICE", "REPEAT_ORDER", "SEND_CREDIT_NOTES"].includes(selectIntent.optionId)) {
              logger.info("📦 [DataLoader] ORDERS with action optionId", { optionId: selectIntent.optionId })
              return { type: "ORDER_ACTION", action: selectIntent.optionId as "SEND_INVOICE" | "REPEAT_ORDER" | "SEND_CREDIT_NOTES" }
            }
          }
          return this.loadOrderStatus(workspaceId, customerId, cleanedValue)
        
        case "ORDER_ACTIONS":
          // User selected an action from order detail options
          // 🆕 CLEAN ARCHITECTURE: Use optionId (e.g., "SEND_INVOICE", "REPEAT_ORDER")
          // This is set by ResponseBuilder when building ORDER_DETAIL response
          if (selectIntent.optionId) {
            logger.info("📦 [DataLoader] Using optionId for order action", {
              optionId: selectIntent.optionId,
            })
            return { 
              type: "ORDER_ACTION", 
              action: selectIntent.optionId as "SEND_INVOICE" | "REPEAT_ORDER" | "SEND_CREDIT_NOTES"
            }
          }
          // 🆕 If no optionId, this is an error - should not happen with clean architecture
          logger.error("📦 [DataLoader] ORDER_ACTIONS without optionId - mapping not saved correctly", {
            cleanedValue,
            selectIntent,
          })
          return { type: "EMPTY", reason: "missing_option_id" }
        
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
          // 🔧 FIX: Use code (SKU) if available (more reliable than name search)
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            logger.info("📦 [DataLoader] Loading service by code (reliable)", {
              code: selectIntent.skus[0],
            })
            return this.loadServiceByCode(workspaceId, selectIntent.skus[0])
          }
          // Fallback to name search (less reliable)
          return this.loadServiceByName(workspaceId, cleanedValue)
        
        case "OFFER_CATEGORIES":
          // 🆕 User selected to view products from an offer category
          // The category name is stored in skus[0] (see buildOffersResponse)
          if (selectIntent.skus && selectIntent.skus.length > 0) {
            const categoryName = selectIntent.skus[0]
            logger.info("📦 [DataLoader] Loading products for offer category", {
              categoryName,
            })
            return this.loadProductsByCategory(workspaceId, customerDiscount, categoryName)
          }
          // Fallback to cleanedValue (the option label)
          const categoryMatch = cleanedValue.match(/prodotti\\s+([\\w\\s]+)\\s+in sconto/i)
          if (categoryMatch) {
            return this.loadProductsByCategory(workspaceId, customerDiscount, categoryMatch[1].trim())
          }
          return { type: "EMPTY", reason: "offer_category_not_found" }
        
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

  private async loadServices(workspaceId: string): Promise<LoadedData> {
    try {
      const services = await this.prisma.services.findMany({
        where: { workspaceId, isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          price: true,
          currency: true,
          duration: true,
          imageUrl: true,
        },
        orderBy: { name: "asc" },
      })

      const serviceData: ServiceData[] = services.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        description: s.description || undefined,
        price: s.price,
        currency: s.currency || "EUR",
        duration: s.duration || 60,
        imageUrl: s.imageUrl || [],
        isAvailable: true,  // Services are always available if active
        priceWithDiscount: s.price,  // Services don't have discounts
      }))

      logger.info("📦 [DataLoader] Loaded services", { 
        workspaceId,
        count: serviceData.length 
      })

      return { type: "SERVICES", services: serviceData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading services", { error })
      return { type: "ERROR", error: "Failed to load services" }
    }
  }

  private async loadServiceByName(workspaceId: string, serviceName: string): Promise<LoadedData> {
    try {
      const service = await this.prisma.services.findFirst({
        where: {
          workspaceId,
          isActive: true,
          name: { contains: serviceName, mode: "insensitive" }
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          price: true,
          currency: true,
          duration: true,
          imageUrl: true,
        },
      })

      if (!service) {
        return { type: "ERROR", error: `Service "${serviceName}" not found` }
      }

      const serviceData: ServiceData = {
        id: service.id,
        name: service.name,
        code: service.code,
        description: service.description || undefined,
        price: service.price,
        currency: service.currency || "EUR",
        duration: service.duration || 60,
        imageUrl: service.imageUrl || [],
        isAvailable: true,
        priceWithDiscount: service.price,
      }

      logger.info("📦 [DataLoader] Loaded service detail", {
        workspaceId,
        serviceName,
        code: service.code
      })

      return { type: "SERVICE_DETAIL", service: serviceData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading service by name", { error, serviceName })
      return { type: "ERROR", error: "Failed to load service" }
    }
  }

  private async loadServiceByCode(workspaceId: string, serviceCode: string): Promise<LoadedData> {
    try {
      const service = await this.prisma.services.findFirst({
        where: {
          workspaceId,
          isActive: true,
          code: serviceCode,
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
          price: true,
          currency: true,
          duration: true,
          imageUrl: true,
        },
      })

      if (!service) {
        logger.warn("⚠️ [DataLoader] Service code not found", { serviceCode })
        return { type: "ERROR", error: `Service code "${serviceCode}" not found` }
      }

      const serviceData: ServiceData = {
        id: service.id,
        name: service.name,
        code: service.code,
        description: service.description || undefined,
        price: service.price,
        currency: service.currency || "EUR",
        duration: service.duration || 60,
        imageUrl: service.imageUrl || [],
        isAvailable: true,
        priceWithDiscount: service.price,
      }

      logger.info("📦 [DataLoader] Loaded service by code", {
        workspaceId,
        serviceCode,
        serviceName: service.name
      })

      return { type: "SERVICE_DETAIL", service: serviceData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading service by code", { error, serviceCode })
      return { type: "ERROR", error: "Failed to load service" }
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

  /**
   * 🆕 Load product by SKU (exact match - more reliable than name search)
   */
  private async loadProductBySku(
    workspaceId: string,
    customerDiscount: number,
    sku: string
  ): Promise<LoadedData> {
    try {
      const product = await this.prisma.products.findFirst({
        where: {
          workspaceId,
          isActive: true,
          sku: sku,
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
        logger.warn("📦 [DataLoader] Product not found by SKU, falling back to name search", { sku })
        return { type: "PRODUCT_DETAIL", product: null }
      }

      logger.info("📦 [DataLoader] Product found by SKU", { 
        sku, 
        productName: product.name 
      })
      
      const productData = this.mapProduct(product, customerDiscount)
      return { type: "PRODUCT_DETAIL", product: productData }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading product by SKU", { sku, error })
      return { type: "ERROR", error: "Failed to load product" }
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
          creditNotes: {
            select: {
              id: true,
              creditNoteCode: true,
              amount: true,
              reason: true,
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
          hasCreditNotes: order.creditNotes && order.creditNotes.length > 0,
          creditNotesCount: order.creditNotes?.length || 0,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading order", { error })
      return { type: "ERROR", error: "Failed to load order" }
    }
  }

  /**
   * @deprecated Use optionId from selectIntent instead
   * This method had hardcoded language patterns which break multilingual support
   * Kept only for reference - should not be called
   */
  private parseOrderAction(selectedLabel: string): LoadedData {
    logger.error("📦 [DataLoader] parseOrderAction called - should use optionId instead!", { selectedLabel })
    return { type: "EMPTY", reason: "deprecated_parse_order_action" }
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
   * Load FAQs for the workspace
   * Returns all active FAQs for LLM to match against user query
   */
  private async loadFAQs(workspaceId: string, query: string): Promise<LoadedData> {
    try {
      const faqs = await this.prisma.fAQ.findMany({
        where: {
          workspaceId,
          isActive: true,
        },
        select: {
          id: true,
          question: true,
          answer: true,
          keywords: true,
          category: true,
        },
        orderBy: { order: "asc" },
      })

      logger.info("📦 [DataLoader] Loaded FAQs", {
        workspaceId,
        faqCount: faqs.length,
        query,
      })

      return {
        type: "FAQ",
        faqs: faqs.map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords,
          category: faq.category || undefined,
        })),
        query,
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading FAQs", { error })
      return { type: "ERROR", error: "Failed to load FAQs" }
    }
  }

  /**
   * Load customer profile (includes discount information)
   */
  private async loadCustomerProfile(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      const customer = await this.prisma.customers.findFirst({
        where: {
          id: customerId,
          workspaceId,
        },
        select: {
          name: true,
          email: true,
          phone: true,
          discount: true,
          language: true,
        },
      })

      if (!customer) {
        return { type: "ERROR", error: "Customer not found" }
      }

      logger.info("📦 [DataLoader] Loaded customer profile", {
        workspaceId,
        customerId,
        discount: customer.discount,
      })

      return {
        type: "PROFILE",
        profile: {
          name: customer.name,
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          discount: customer.discount || 0,
          language: customer.language || undefined,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading customer profile", { error })
      return { type: "ERROR", error: "Failed to load profile" }
    }
  }

  /**
   * Load agent info for B2B customer
   * @see Feature 202 - Agent Variables
   * 
   * Returns agent details if:
   * 1. Workspace has hasSalesAgents=true
   * 2. Customer has a salesId assigned
   * 
   * Otherwise returns a message indicating no agent is assigned
   */
  private async loadAgentInfo(workspaceId: string, customerId: string): Promise<LoadedData> {
    try {
      // First check if workspace has sales agents enabled
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          hasSalesAgents: true,
          name: true,
        },
      })

      if (!workspace) {
        return { type: "ERROR", error: "Workspace not found" }
      }

      // If workspace doesn't use sales agents, return appropriate message
      if (!workspace.hasSalesAgents) {
        logger.info("📦 [DataLoader] Workspace doesn't use sales agents", { workspaceId })
        return {
          type: "AGENT_INFO",
          agentInfo: {
            hasAgent: false,
            reason: "workspace_no_agents",
            message: "This workspace doesn't use dedicated sales agents. For assistance, please contact our support team.",
          },
        }
      }

      // Load customer with agent info
      const customer = await this.prisma.customers.findFirst({
        where: {
          id: customerId,
          workspaceId,
        },
        select: {
          salesId: true,
          sales: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      })

      if (!customer) {
        return { type: "ERROR", error: "Customer not found" }
      }

      // If customer has no assigned agent
      if (!customer.salesId || !customer.sales) {
        logger.info("📦 [DataLoader] Customer has no assigned agent", { workspaceId, customerId })
        return {
          type: "AGENT_INFO",
          agentInfo: {
            hasAgent: false,
            reason: "no_agent_assigned",
            message: "You don't have a dedicated agent assigned yet. For assistance, please contact our support team.",
          },
        }
      }

      // Return agent info
      const agent = customer.sales
      logger.info("📦 [DataLoader] Loaded agent info", {
        workspaceId,
        customerId,
        agentId: agent.id,
      })

      return {
        type: "AGENT_INFO",
        agentInfo: {
          hasAgent: true,
          name: `${agent.firstName || ""} ${agent.lastName || ""}`.trim(),
          email: agent.email || undefined,
          phone: agent.phone || undefined,
        },
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading agent info", { error })
      return { type: "ERROR", error: "Failed to load agent info" }
    }
  }

  /**
   * Load active offers for a workspace
   * 🆕 If there's only ONE offer with a category, directly load the products (more fluid UX)
   */
  private async loadOffers(workspaceId: string, customerDiscount: number = 0): Promise<LoadedData> {
    try {
      const now = new Date()
      
      const offers = await this.prisma.offers.findMany({
        where: {
          workspaceId,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        include: {
          category: true,
        },
        orderBy: { endDate: "asc" },
      })

      logger.info("📦 [DataLoader] Loaded offers", {
        workspaceId,
        count: offers.length,
      })

      // 🆕 If there's only ONE offer with a category, load products directly (skip selection step)
      const offersWithCategories = offers.filter(o => o.category?.name)
      if (offersWithCategories.length === 1) {
        const singleOffer = offersWithCategories[0]
        logger.info("📦 [DataLoader] Single offer with category - loading products directly", {
          offerName: singleOffer.name,
          categoryName: singleOffer.category?.name,
          discount: singleOffer.discountPercent,
        })
        return this.loadProductsByCategory(workspaceId, customerDiscount, singleOffer.category!.name)
      }

      return {
        type: "OFFERS",
        offers: offers.map((offer) => ({
          id: offer.id,
          name: offer.name,
          description: offer.description || undefined,
          discountPercent: offer.discountPercent || 0,
          categoryName: offer.category?.name || undefined,
          startDate: offer.startDate,
          endDate: offer.endDate,
        })),
      }
    } catch (error) {
      logger.error("❌ [DataLoader] Error loading offers", { error })
      return { type: "ERROR", error: "Failed to load offers" }
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
